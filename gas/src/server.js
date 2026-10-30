// Versão do servidor que roda DENTRO da planilha (Google Apps Script).
// Usa as mesmas regras do servidor Node (mapping/layout/validation),
// mas lê e grava com SpreadsheetApp, sem chave nem servidor externo.
import { MONTH_NAMES, TYPES } from '../../shared/categories.js';
import { CADASTRO_TAB, LAYOUT } from '../../server/layout.js';
import {
  detectColumns,
  expandRepeat,
  findHeaderRow,
  parseCadastro,
  rowToTransaction,
  transactionToRow,
} from '../../server/mapping.js';
import { validateTransactionInput } from '../../server/validation.js';
import {
  ACCOUNTS_HEADER,
  ACCOUNTS_TAB,
  BUDGETS_HEADER,
  BUDGETS_TAB,
  parseBudgets,
  validateBudgets,
  TRANSFERS_HEADER,
  TRANSFERS_TAB,
  parseAccounts,
  parseTransfers,
  validateAccountInput,
  validateTransferInput,
} from '../../shared/accounts.js';
import { parseDate, safeText } from '../../server/mapping.js';

/** Erro com código HTTP embutido na mensagem, para o navegador entender. */
const fail = (status, message) => {
  throw new Error(`[${status}] ${message}`);
};

export function createGasBackend({ SpreadsheetApp, Utilities, LockService }) {
  const ss = () => SpreadsheetApp.getActiveSpreadsheet();
  const tz = () => ss().getSpreadsheetTimeZone();

  // Datas chegam como Date; viram "AAAA-MM-DD" no fuso da planilha.
  const normalizeCell = (v) =>
    Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, tz(), 'yyyy-MM-dd') : v;

  function sheetOrFail(name) {
    const sheet = ss().getSheetByName(name);
    if (!sheet) fail(422, `A planilha não tem a aba "${name}".`);
    return sheet;
  }

  function readTab(type) {
    const layout = LAYOUT[type];
    const sheet = sheetOrFail(layout.tab);
    const values = sheet.getDataRange().getValues().map((r) => r.map(normalizeCell));
    const headerIndex = findHeaderRow(values);
    if (headerIndex === -1) fail(422, `Não achei o cabeçalho (com "Data" e "Valor") na aba ${layout.tab}.`);
    const header = values[headerIndex];
    const { columns, missing } = detectColumns(header, layout);
    if (!missing.length && columns.account === undefined) {
      // Primeira vez: cria a coluna "Conta" logo depois da última coluna do cabeçalho.
      let last = header.length - 1;
      while (last > 0 && String(header[last] ?? '').trim() === '') last--;
      const target = sheet.getRange(headerIndex + 1, last + 2);
      try {
        sheet.getRange(headerIndex + 1, last + 1).copyTo(target, { formatOnly: true });
      } catch (e) {
        // sem formatação, tudo bem
      }
      target.setValue('Conta');
      columns.account = last + 1;
    }
    if (missing.length) fail(422, `Faltam colunas na aba ${layout.tab}: ${missing.join(', ')}.`);
    const width = Math.max(...Object.values(columns)) + 1;
    return { sheet, layout, columns, width, firstDataRow: headerIndex + 2, rows: values.slice(headerIndex + 1) };
  }

  /** Grava a linha; colunas null mantêm o que já existe (inclusive fórmulas). */
  function writeRow(sheet, rowNumber, width, row) {
    const range = sheet.getRange(rowNumber, 1, 1, width);
    const formulas = range.getFormulas()[0];
    const current = range.getValues()[0];
    const merged = row.map((v, i) => (v === null ? formulas[i] || current[i] : v));
    range.setValues([merged]);
  }

  function prepareRow(input, columns, width) {
    const row = transactionToRow(input, columns, width);
    // A data vai como Date no fuso da planilha (respeita a validação de data).
    row[columns.date] = Utilities.parseDate(input.date, tz(), 'yyyy-MM-dd');
    return row;
  }

  function checkRow(type, rowNumber, expected) {
    const tab = readTab(type);
    const current = tab.rows[rowNumber - tab.firstDataRow];
    const parsed = current ? rowToTransaction(current, rowNumber, tab.columns, type).transaction : null;
    const same =
      parsed && expected &&
      parsed.date === expected.date &&
      parsed.amount === expected.amount &&
      parsed.category === expected.category &&
      parsed.description === (expected.description ?? '');
    if (!same) fail(409, 'A planilha foi alterada em outro lugar. Os dados foram recarregados; tente de novo.');
    return tab;
  }

  function withLock(fn) {
    const lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  const parseTarget = (type, row) => {
    if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) fail(400, 'Tipo inválido.');
    const n = Number(row);
    if (!Number.isInteger(n) || n < 2) fail(400, 'Linha inválida.');
    return n;
  };

  function options() {
    const sheet = ss().getSheetByName(CADASTRO_TAB);
    const base = sheet ? parseCadastro(sheet.getDataRange().getValues()) : { incomeCategories: [], groups: {}, cards: [] };
    return { ...base, accounts: readAccounts().map((a) => a.name) };
  }

  function listTransactions() {
    const transactions = [];
    const warnings = [];
    for (const type of [TYPES.INCOME, TYPES.EXPENSE]) {
      const { columns, rows, firstDataRow } = readTab(type);
      rows.forEach((row, i) => {
        const r = rowToTransaction(row, firstDataRow + i, columns, type);
        if (r.transaction) transactions.push(r.transaction);
        else if (r.error) warnings.push(r.error);
      });
    }
    return { transactions, warnings };
  }

  // --- Contas e transferências (abas criadas na primeira vez que forem usadas) ---

  function readValues(name) {
    const sheet = ss().getSheetByName(name);
    return sheet ? sheet.getDataRange().getValues().map((r) => r.map(normalizeCell)) : [];
  }
  const readAccounts = () => parseAccounts(readValues(ACCOUNTS_TAB), parseDate);
  const readBudgets = () => parseBudgets(readValues(BUDGETS_TAB));
  const readTransfers = () => parseTransfers(readValues(TRANSFERS_TAB), parseDate);

  function ensureTab(name, header) {
    let sheet = ss().getSheetByName(name);
    if (!sheet) sheet = ss().insertSheet(name);
    const first = sheet.getRange(1, 1, 1, header.length);
    const current = first.getValues()[0];
    if (current.some((v) => v === '' || v === null)) {
      // Cabeçalho novo, ou coluna nova numa aba antiga (ex.: "Prazo da meta").
      first.setValues([header.map((h, i) => (current[i] === '' || current[i] === null ? h : current[i]))]);
      try {
        first.setFontWeight('bold');
        sheet.setFrozenRows(1);
      } catch (e) {
        // só aparência
      }
    }
    return sheet;
  }

  /** Primeira linha vazia (a partir da 2) da aba. */
  function firstEmptyRow(sheet, width) {
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i].slice(0, width).every((v) => v === '' || v === null)) return i + 1;
    }
    return Math.max(values.length, 1) + 1;
  }

  function accountRowOrFail(row, expectedName) {
    const n = Number(row);
    const account = readAccounts().find((a) => a.row === n);
    if (!account || account.name !== expectedName) {
      fail(409, 'A aba Contas foi alterada em outro lugar. Os dados foram recarregados; tente de novo.');
    }
    return account;
  }

  /** Troca o nome da conta em todos os lançamentos e transferências. */
  function renameAccountEverywhere(oldName, newName) {
    for (const type of [TYPES.INCOME, TYPES.EXPENSE]) {
      const { sheet, columns, rows, firstDataRow } = readTab(type);
      rows.forEach((r, i) => {
        if (String(r[columns.account] ?? '').trim() === oldName) sheet.getRange(firstDataRow + i, columns.account + 1).setValue(newName);
      });
    }
    const sheet = ss().getSheetByName(TRANSFERS_TAB);
    if (!sheet) return;
    sheet.getDataRange().getValues().forEach((r, i) => {
      if (i === 0) return;
      if (String(r[1]).trim() === oldName) sheet.getRange(i + 1, 2).setValue(newName);
      if (String(r[2]).trim() === oldName) sheet.getRange(i + 1, 3).setValue(newName);
    });
  }

  function isAccountUsed(name) {
    if (readTransfers().some((t) => t.from === name || t.to === name)) return true;
    return listTransactions().transactions.some((t) => t.account === name);
  }

  function saveAccount(body, row, expectedName) {
    const accounts = readAccounts();
    const editing = row != null && row !== '';
    const current = editing ? accountRowOrFail(row, expectedName) : null;
    const others = accounts.filter((a) => !current || a.row !== current.row).map((a) => a.name);
    const { value, errors } = validateAccountInput(body, others);
    if (errors) fail(400, errors.join(' '));
    const sheet = ensureTab(ACCOUNTS_TAB, ACCOUNTS_HEADER);
    const rowNumber = current ? current.row : firstEmptyRow(sheet, ACCOUNTS_HEADER.length);
    const range = sheet.getRange(rowNumber, 1, 1, ACCOUNTS_HEADER.length);
    const deadline = value.deadline ? Utilities.parseDate(value.deadline, tz(), 'yyyy-MM-dd') : '';
    range.setValues([[value.name, safeText(value.bank), value.kind, value.initial, value.goal ?? '', deadline]]);
    try {
      sheet.getRange(rowNumber, 4, 1, 2).setNumberFormat('R$ #,##0.00');
      sheet.getRange(rowNumber, 6).setNumberFormat('dd/MM/yyyy');
    } catch (e) {
      // só aparência
    }
    if (current && current.name !== value.name) renameAccountEverywhere(current.name, value.name);
    return { ...value, row: rowNumber };
  }

  function removeAccount(row, expectedName) {
    const account = accountRowOrFail(row, expectedName);
    if (isAccountUsed(account.name)) {
      fail(409, `A conta "${account.name}" tem lançamentos ou transferências. Troque a conta deles antes de excluir, ou só renomeie.`);
    }
    const sheet = ss().getSheetByName(ACCOUNTS_TAB);
    sheet.getRange(account.row, 1, 1, ACCOUNTS_HEADER.length).setValues([ACCOUNTS_HEADER.map(() => '')]);
  }

  function saveBudgets(body) {
    const { value, errors } = validateBudgets(body, Object.keys(options().groups));
    if (errors) fail(400, errors.join(' '));
    const sheet = ensureTab(BUDGETS_TAB, BUDGETS_HEADER);
    const old = sheet.getDataRange().getValues().length;
    const rows = Object.entries(value);
    const height = Math.max(old - 1, rows.length);
    if (height > 0) {
      const blank = ['', ''];
      sheet.getRange(2, 1, height, 2).setValues(Array.from({ length: height }, (_, i) => rows[i] ?? blank));
    }
    return value;
  }

  function createTransfer(body) {
    const { value, errors } = validateTransferInput(body, readAccounts().map((a) => a.name));
    if (errors) fail(400, errors.join(' '));
    const sheet = ensureTab(TRANSFERS_TAB, TRANSFERS_HEADER);
    const rowNumber = firstEmptyRow(sheet, 4);
    const [year, month] = value.date.split('-').map(Number);
    sheet.getRange(rowNumber, 1, 1, TRANSFERS_HEADER.length).setValues([[
      Utilities.parseDate(value.date, tz(), 'yyyy-MM-dd'),
      value.from,
      value.to,
      value.amount,
      safeText(value.description),
      MONTH_NAMES[month - 1],
      year,
    ]]);
    try {
      sheet.getRange(rowNumber, 1).setNumberFormat('dd/MM/yyyy');
      sheet.getRange(rowNumber, 4).setNumberFormat('R$ #,##0.00');
    } catch (e) {
      // só aparência
    }
    return { ...value, row: rowNumber, id: `transferencia-${rowNumber}` };
  }

  function removeTransfer(row, expected) {
    const n = Number(row);
    const current = readTransfers().find((t) => t.row === n);
    const same = current && expected && current.date === expected.date && current.from === expected.from &&
      current.to === expected.to && current.amount === expected.amount;
    if (!same) fail(409, 'A aba Transferências foi alterada em outro lugar. Os dados foram recarregados; tente de novo.');
    const sheet = ss().getSheetByName(TRANSFERS_TAB);
    sheet.getRange(n, 1, 1, TRANSFERS_HEADER.length).setValues([TRANSFERS_HEADER.map(() => '')]);
  }

  function validated(body) {
    const { value, errors } = validateTransactionInput(body, options());
    if (errors) fail(400, errors.join(' '));
    return value;
  }

  function create(input) {
    const { sheet, columns, width, rows, firstDataRow } = readTab(input.type);
    const created = [];
    let from = 0;
    for (const item of expandRepeat(input)) {
      // Próxima linha vazia (as já preenchidas nesta mesma chamada são puladas).
      let index = rows.findIndex((r, i) => i >= from && rowToTransaction(r, 0, columns, input.type).blank);
      if (index === -1) index = Math.max(rows.length, from);
      from = index + 1;
      const rowNumber = firstDataRow + index;
      writeRow(sheet, rowNumber, width, prepareRow(item, columns, width));
      created.push({ ...item, row: rowNumber, id: `${item.type}-${rowNumber}` });
    }
    return { ...created[0], created: created.length };
  }

  function remove(type, rowNumber, expected) {
    const { sheet, columns, width } = checkRow(type, rowNumber, expected);
    const known = Object.values(columns);
    writeRow(sheet, rowNumber, width, Array.from({ length: width }, (_, i) => (known.includes(i) ? '' : null)));
  }

  return {
    status: () => ({ mode: 'google-apps-script', readOnly: false, demo: false, features: { accounts: true }, spreadsheetTitle: ss().getName() }),
    options,
    list: () => listTransactions(),
    accounts: () => ({ accounts: readAccounts(), transfers: readTransfers(), budgets: readBudgets() }),
    saveBudgets: (body) => withLock(() => saveBudgets(body)),
    saveAccount: (body, row, expectedName) => withLock(() => saveAccount(body, row, expectedName)),
    removeAccount: (row, expectedName) => withLock(() => { removeAccount(row, expectedName); return null; }),
    createTransfer: (body) => withLock(() => createTransfer(body)),
    removeTransfer: (row, expected) => withLock(() => { removeTransfer(row, expected); return null; }),
    create: (body) => withLock(() => create(validated(body))),
    update: (type, row, body, expected) =>
      withLock(() => {
        const rowNumber = parseTarget(type, row);
        const input = validated(body);
        if (input.type !== type) {
          remove(type, rowNumber, expected);
          return create(input);
        }
        const { sheet, columns, width } = checkRow(type, rowNumber, expected);
        writeRow(sheet, rowNumber, width, prepareRow(input, columns, width));
        return { ...input, row: rowNumber, id: `${type}-${rowNumber}` };
      }),
    remove: (type, row, expected) =>
      withLock(() => {
        remove(type, parseTarget(type, row), expected);
        return null;
      }),
  };
}
