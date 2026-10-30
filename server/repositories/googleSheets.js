import { sheets as sheetsApi } from '@googleapis/sheets';
import { JWT } from 'google-auth-library';
import { TYPES } from '../../shared/categories.js';
import { CADASTRO_TAB, LAYOUT } from '../layout.js';
import {
  columnLetter,
  detectColumns,
  findHeaderRow,
  parseCadastro,
  rowToTransaction,
  transactionToRow, expandRepeat } from '../mapping.js';
import { HttpError } from '../errors.js';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Cria o cliente oficial do Google Sheets a partir da configuração. */
export function createSheetsClient(config) {
  if (config.credentials) {
    const auth = new JWT({
      email: config.credentials.client_email,
      key: config.credentials.private_key,
      scopes: [SCOPE],
    });
    return sheetsApi({ version: 'v4', auth });
  }
  return sheetsApi({ version: 'v4', auth: config.apiKey });
}

/** Traduz erros da API do Google em mensagens úteis em português. */
function translateGoogleError(error, config) {
  if (error instanceof HttpError) return error;
  const status = error?.code ?? error?.response?.status;
  const message = String(error?.message ?? '');
  if (/must not be an Office file|not supported for this document/i.test(message)) {
    return new HttpError(
      422,
      'O link aponta para um arquivo Excel (.xlsx). No Drive, use "Arquivo > Salvar como Planilhas Google" e use o link novo.',
    );
  }
  if (/data validation|validação/i.test(message)) {
    return new HttpError(422, 'A planilha recusou o valor: ele não está nas listas da aba Cadastro.');
  }
  if (status === 403) {
    const who = config.credentials?.client_email;
    return new HttpError(
      403,
      who
        ? `Sem permissão. Compartilhe a planilha com ${who} como Editor.`
        : 'Sem permissão. Com chave de API a planilha precisa ser pública e fica só leitura; para gravar, use uma Service Account.',
    );
  }
  if (status === 404) return new HttpError(404, 'Planilha ou aba não encontrada. Confira o link no .env.');
  if (status === 400 && /API key not valid/i.test(message)) return new HttpError(401, 'Chave de API do Google inválida.');
  return new HttpError(502, `Erro ao falar com o Google Sheets: ${message || 'desconhecido'}`);
}

const quote = (title) => `'${title.replace(/'/g, "''")}'`;

/**
 * Lê e grava lançamentos na planilha "Oxigênio Financeiro":
 * receitas na aba Receitas, despesas na aba Despesas, listas na aba Cadastro.
 */
export class GoogleSheetsRepository {
  constructor(config, client = createSheetsClient(config)) {
    this.config = config;
    this.client = client;
    this.title = null;
  }

  async run(fn) {
    try {
      return await fn();
    } catch (error) {
      throw translateGoogleError(error, this.config);
    }
  }

  async loadTitle() {
    if (this.title) return this.title;
    const { data } = await this.run(() =>
      this.client.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'properties.title,sheets.properties.title',
      }),
    );
    const tabs = data.sheets.map((s) => s.properties.title);
    const needed = [LAYOUT[TYPES.INCOME].tab, LAYOUT[TYPES.EXPENSE].tab];
    const absent = needed.filter((t) => !tabs.includes(t));
    if (absent.length) {
      throw new HttpError(422, `A planilha não tem a(s) aba(s): ${absent.join(', ')}. Abas encontradas: ${tabs.join(', ')}`);
    }
    this.hasCadastro = tabs.includes(CADASTRO_TAB);
    this.title = data.properties.title;
    return this.title;
  }

  async getValues(tab) {
    const { data } = await this.run(() =>
      this.client.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: quote(tab),
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      }),
    );
    return data.values ?? [];
  }

  /** Lê uma aba de lançamentos: cabeçalho, colunas detectadas e linhas de dados. */
  async readTab(type) {
    await this.loadTitle();
    const layout = LAYOUT[type];
    const values = await this.getValues(layout.tab);
    const headerIndex = findHeaderRow(values);
    if (headerIndex === -1) {
      throw new HttpError(422, `Não achei o cabeçalho (com "Data" e "Valor") na aba ${layout.tab}.`);
    }
    const header = values[headerIndex];
    const { columns, missing } = detectColumns(header, layout);
    if (missing.length) {
      throw new HttpError(422, `Faltam colunas na aba ${layout.tab}: ${missing.join(', ')}. Cabeçalho atual: ${header.join(' | ')}`);
    }
    // Largura = até a última coluna conhecida (não toca no que vem depois).
    const width = Math.max(...Object.values(columns)) + 1;
    return { layout, columns, width, firstDataRow: headerIndex + 2, rows: values.slice(headerIndex + 1) };
  }

  async info() {
    const title = await this.loadTitle();
    return { mode: 'google-sheets', readOnly: this.config.readOnly, spreadsheetTitle: title };
  }

  async options() {
    await this.loadTitle();
    if (!this.hasCadastro) return { incomeCategories: [], groups: {}, cards: [] };
    return parseCadastro(await this.getValues(CADASTRO_TAB));
  }

  async list() {
    const transactions = [];
    const warnings = [];
    for (const type of [TYPES.INCOME, TYPES.EXPENSE]) {
      const { columns, rows, firstDataRow } = await this.readTab(type);
      rows.forEach((row, i) => {
        const result = rowToTransaction(row, firstDataRow + i, columns, type);
        if (result.transaction) transactions.push(result.transaction);
        else if (result.error) warnings.push(result.error);
      });
    }
    return { transactions, warnings };
  }

  ensureWritable() {
    if (this.config.readOnly) {
      throw new HttpError(403, 'Modo somente leitura: configure uma Service Account no .env para gravar na planilha.');
    }
  }

  async writeRow(tab, rowNumber, width, row) {
    await this.run(() =>
      this.client.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${quote(tab)}!A${rowNumber}:${columnLetter(width - 1)}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      }),
    );
  }

  /**
   * Grava na primeira linha vazia da aba. As linhas da planilha já vêm
   * formatadas e com listas suspensas, então não inserimos linhas novas.
   */
  async create(input) {
    this.ensureWritable();
    const { layout, columns, width, rows, firstDataRow } = await this.readTab(input.type);
    const created = [];
    let from = 0;
    for (const item of expandRepeat(input)) {
      // Próxima linha vazia (as já preenchidas nesta mesma chamada são puladas).
      let index = rows.findIndex((r, i) => i >= from && rowToTransaction(r, 0, columns, input.type).blank);
      if (index === -1) index = Math.max(rows.length, from);
      from = index + 1;
      const rowNumber = firstDataRow + index;
      await this.writeRow(layout.tab, rowNumber, width, transactionToRow(item, columns, width));
      created.push({ ...item, row: rowNumber, id: `${item.type}-${rowNumber}` });
    }
    return { ...created[0], created: created.length };
  }

  /**
   * Confere se a linha ainda tem os dados que o navegador viu.
   * Evita gravar por cima ou apagar a linha errada se a planilha mudou.
   */
  async checkRow(type, rowNumber, expected) {
    const tab = await this.readTab(type);
    const current = tab.rows[rowNumber - tab.firstDataRow];
    const parsed = current ? rowToTransaction(current, rowNumber, tab.columns, type).transaction : null;
    const same =
      parsed &&
      expected &&
      parsed.date === expected.date &&
      parsed.amount === expected.amount &&
      parsed.category === expected.category &&
      parsed.description === (expected.description ?? '');
    if (!same) {
      throw new HttpError(409, 'A planilha foi alterada em outro lugar. Os dados foram recarregados; tente de novo.');
    }
    return tab;
  }

  async update(type, rowNumber, input, expected) {
    this.ensureWritable();
    if (input.type !== type) {
      // Receita virou despesa (ou o contrário): muda de aba.
      await this.remove(type, rowNumber, expected);
      return this.create(input);
    }
    const { layout, columns, width } = await this.checkRow(type, rowNumber, expected);
    await this.writeRow(layout.tab, rowNumber, width, transactionToRow(input, columns, width));
    return { ...input, row: rowNumber, id: `${type}-${rowNumber}` };
  }

  /** Apaga só os valores da linha: formatação e listas suspensas continuam. */
  async remove(type, rowNumber, expected) {
    this.ensureWritable();
    const { layout, columns, width } = await this.checkRow(type, rowNumber, expected);
    const row = Array.from({ length: width }, (_, i) => (Object.values(columns).includes(i) ? '' : null));
    await this.writeRow(layout.tab, rowNumber, width, row);
  }
}
