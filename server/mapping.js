import { MONTH_NAMES, TYPES } from '../shared/categories.js';

/** Remove acentos, símbolos e caixa para comparar textos. */
export const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Acha a linha de cabeçalho: a primeira (entre as 5 primeiras) com "Data" e "Valor". */
export function findHeaderRow(values) {
  for (let i = 0; i < Math.min(values.length, 5); i++) {
    const cells = (values[i] ?? []).map(normalize);
    if (cells.includes('data') && cells.includes('valor')) return i;
  }
  return -1;
}

/** Descobre a coluna de cada campo a partir do cabeçalho. */
export function detectColumns(headerRow, layout) {
  const normalized = (headerRow ?? []).map(normalize);
  const columns = {};
  for (const [field, aliases] of Object.entries(layout.fields)) {
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index !== -1) columns[field] = index;
  }
  // Na planilha original o cabeçalho de "Grupo" estava corrompido ("90~Ç").
  // Se não achar pelo nome, usa a coluna logo antes de "Despesa".
  if (layout.fields.group && columns.group === undefined && columns.category > 0) {
    columns.group = columns.category - 1;
  }
  const missing = layout.required.filter((f) => columns[f] === undefined);
  return { columns, missing };
}

// --- Leitura -------------------------------------------------------------

export function parseAmount(value) {
  if (typeof value === 'number') return value;
  let s = String(value ?? '').trim();
  if (!s) return NaN;
  const negative = /^\(.*\)$/.test(s) || s.includes('-');
  s = s.replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return negative ? -Math.abs(n) : n;
}

const pad = (n) => String(n).padStart(2, '0');

function valid(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Data serial do Sheets (dias desde 30/12/1899) ou texto "DD/MM/AAAA" -> "AAAA-MM-DD". */
export function parseDate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(value ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(year, +m[2], +m[1]);
  }
  return null;
}

/** "AAAA-MM-DD" -> número de série de data do Sheets. */
export function toSerial(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

const text = (v) => String(v ?? '').trim();
const intOrNull = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Converte uma linha da planilha em transação.
 * A leitura usa UNFORMATTED_VALUE + SERIAL_NUMBER: datas e valores chegam como números.
 */
export function rowToTransaction(row, rowNumber, columns, type) {
  const cell = (field) => (columns[field] === undefined ? '' : row[columns[field]]);
  if (['date', 'amount', 'category'].every((f) => text(cell(f)) === '')) return { blank: true };

  const date = parseDate(cell('date'));
  const amount = parseAmount(cell('amount'));
  const problems = [];
  if (!date) problems.push('data inválida');
  if (!Number.isFinite(amount) || amount <= 0) problems.push('valor vazio ou inválido');
  if (problems.length) {
    const tab = type === TYPES.INCOME ? 'Receitas' : 'Despesas';
    return { error: `${tab}, linha ${rowNumber}: ${problems.join(', ')}` };
  }

  const base = {
    id: `${type}-${rowNumber}`,
    row: rowNumber,
    type,
    date,
    amount: Math.round(amount * 100) / 100,
    category: text(cell('category')) || 'Outros',
    description: text(cell('description')),
    account: text(cell('account')),
  };
  if (type === TYPES.INCOME) return { transaction: base };

  return {
    transaction: {
      ...base,
      group: text(cell('group')) || 'Outras',
      nature: text(cell('nature')),
      payment: text(cell('payment')),
      card: text(cell('card')),
      installment: intOrNull(cell('installment')),
      installments: intOrNull(cell('installments')),
      status: text(cell('status')),
    },
  };
}

// --- Escrita -------------------------------------------------------------

/** Impede que um texto vire fórmula na planilha (injeção de fórmulas). */
export function safeText(value) {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/**
 * Monta a linha a gravar. Colunas que o painel não conhece ficam null,
 * o que faz a API do Sheets não mexer nelas (nem em fórmulas).
 * Mês e Ano são preenchidos a partir da data, como a planilha espera.
 */
export function transactionToRow(t, columns, width) {
  const row = Array.from({ length: width }, () => null);
  const [year, month] = t.date.split('-').map(Number);
  const values = {
    date: toSerial(t.date),
    category: safeText(t.category),
    amount: t.amount,
    description: safeText(t.description ?? ''),
    month: MONTH_NAMES[month - 1],
    year,
    group: safeText(t.group ?? ''),
    nature: t.nature ?? '',
    payment: t.payment ?? '',
    card: safeText(t.card ?? ''),
    installment: t.installment ?? '',
    installments: t.installments ?? '',
    status: t.status ?? '',
    account: safeText(t.account ?? ''),
  };
  for (const [field, index] of Object.entries(columns)) {
    if (field in values) row[index] = values[field];
  }
  return row;
}

/** Índice de coluna (0) -> letra (A). */
export function columnLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Lê as listas da aba Cadastro (linha 1 = nome da lista, abaixo os itens):
 * fontes de receita, grupos com suas despesas e cartões.
 */
export function parseCadastro(values) {
  const header = (values[0] ?? []).map(text);
  const column = (name) => {
    const index = header.findIndex((h) => normalize(h) === normalize(name));
    if (index === -1) return [];
    return [...new Set(values.slice(1).map((r) => text(r[index])).filter(Boolean))];
  };
  const groups = column('Grupo');
  return {
    incomeCategories: column('Receitas'),
    groups: Object.fromEntries(groups.map((g) => [g, column(g)])),
    cards: column('Cartão'),
  };
}

/** Soma meses a uma data AAAA-MM-DD; dia 31 vira o último dia do mês quando preciso. */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Uma receita/despesa com "repetir" vira um lançamento por mês. */
export function expandRepeat(input) {
  const { repeat = 1, ...base } = input;
  // Despesa parcelada: cada mês leva o número da parcela seguinte (1/10, 2/10…).
  const parcelado = base.installments > 1;
  return Array.from({ length: repeat }, (_, i) => ({
    ...base,
    date: addMonths(base.date, i),
    ...(parcelado ? { installment: base.installment + i } : {}),
  }));
}
