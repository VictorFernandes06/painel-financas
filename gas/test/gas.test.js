// Roda o Code.gs gerado dentro de uma "planilha falsa" (SpreadsheetApp simulado).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../dist/Code.gs', import.meta.url), 'utf8');
const d = (iso) => new Date(`${iso}T00:00:00Z`);

function fakeSheet(rows) {
  const isFormula = (c) => typeof c === 'string' && c.startsWith('=');
  return {
    rows,
    getDataRange: () => {
      const width = Math.max(1, ...rows.map((r) => r.length));
      return { getValues: () => rows.map((r) => Array.from({ length: width }, (_, i) => (isFormula(r[i]) ? 'calc' : r[i] ?? ''))) };
    },
    getRange: (row, col, numRows = 1, width = 1) => {
      while (rows.length < row + numRows - 1) rows.push([]);
      const grid = () => Array.from({ length: numRows }, (_, r) =>
        Array.from({ length: width }, (_, i) => rows[row - 1 + r][col - 1 + i] ?? ''));
      return {
        getFormulas: () => grid().map((r) => r.map((c) => (isFormula(c) ? c : ''))),
        getValues: () => grid(),
        setValues: (values) => values.forEach((vals, r) => vals.forEach((v, i) => { rows[row - 1 + r][col - 1 + i] = v; })),
        setValue: (v) => { rows[row - 1][col - 1] = v; },
        copyTo: () => {},
        setNumberFormat: () => {},
        setFontWeight: () => {},
      };
    },
    setFrozenRows: () => {},
  };
}

let tabs;
let ctx;
beforeEach(() => {
  tabs = {
    Cadastro: fakeSheet([
      ['Cartão', 'Receitas', 'Grupo', 'Moradia', 'Alimentação'],
      ['Nubank', 'Salário', 'Moradia', 'Aluguel', 'Mercado'],
      ['', 'Extras', 'Alimentação', 'Energia', 'Feira'],
    ]),
    Receitas: fakeSheet([['RECEITAS'], ['Data', 'Receita', 'Valor', 'Observação', 'Mês', 'Ano']]),
    Despesas: fakeSheet([
      ['DESPESAS'],
      ['Data', 'Grupo', 'Despesa', 'Tipo', 'Forma de pagamento', 'Cartão', 'Parcela', 'Total de parcelas', 'Valor', 'Descrição', 'Status', 'Mês', 'Ano', 'Calc'],
      [d('2026-10-02'), 'Moradia', 'Aluguel', 'Essencial', 'Pix', '', 1, 1, 1000, '', 'Pago', 'outubro', 2026, '=I3*2'],
    ]),
  };
  const ss = { getName: () => 'Minha planilha', getSpreadsheetTimeZone: () => 'UTC', getSheetByName: (n) => tabs[n] ?? null, insertSheet: (n) => (tabs[n] = fakeSheet([])) };
  ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    Utilities: {
      formatDate: (date, _tz, _fmt) => date.toISOString().slice(0, 10),
      parseDate: (s) => d(s),
    },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    HtmlService: {},
  });
  vm.runInContext(code, ctx);
});

const run = (fn, ...args) => JSON.parse(JSON.stringify(ctx[fn](...args) ?? null));
const err = (fn, ...args) => assert.throws(() => ctx[fn](...args));

test('status e listas do Cadastro', () => {
  assert.equal(run('apiStatus').mode, 'google-apps-script');
  assert.deepEqual(run('apiOptions').groups, { Moradia: ['Aluguel', 'Energia'], Alimentação: ['Mercado', 'Feira'] });
});

test('lista lançamentos com data como texto', () => {
  const { transactions } = run('apiList');
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].date, '2026-10-02');
  assert.equal(transactions[0].id, 'despesa-3');
});

test('cria receita com Mês e Ano e data como Date', () => {
  const r = run('apiCreate', { type: 'receita', date: '2026-10-24', category: 'Salário', amount: 3998, description: '=X()' });
  assert.equal(r.row, 3);
  const row = tabs.Receitas.rows[2];
  assert.ok(row[0] instanceof Date);
  assert.deepEqual(row.slice(1), ['Salário', 3998, "'=X()", 'outubro', 2026, '']);
  assert.equal(tabs.Receitas.rows[1][6], 'Conta');
});

test('edita sem apagar a fórmula da coluna extra', () => {
  const [t] = run('apiList').transactions;
  run('apiUpdate', 'despesa', 3, { ...t, amount: 1200 }, t);
  assert.equal(tabs.Despesas.rows[2][8], 1200);
  assert.equal(tabs.Despesas.rows[2][13], '=I3*2');
});

test('exclui só os valores e recusa linha alterada', () => {
  const [t] = run('apiList').transactions;
  assert.throws(() => ctx.apiRemove('despesa', 3, { ...t, amount: 5 }), /\[409\]/);
  ctx.apiRemove('despesa', 3, t);
  assert.equal(tabs.Despesas.rows[2][0], '');
  assert.equal(tabs.Despesas.rows[2][13], '=I3*2');
  assert.equal(run('apiList').transactions.length, 0);
});

test('valida contra o Cadastro', () => {
  assert.throws(
    () => ctx.apiCreate({ type: 'despesa', date: '2026-10-24', group: 'Moradia', category: 'Feira', amount: 10, nature: 'Essencial', payment: 'Pix', status: 'Pago' }),
    /\[400\].*não pertence/,
  );
  err('apiRemove', 'outro', 3, {});
});

test('receita recorrente preenche os próximos meses', () => {
  const r = run('apiCreate', { type: 'receita', date: '2026-10-05', category: 'Salário', amount: 3998, repeat: 12 });
  assert.equal(r.created, 12);
  const rows = tabs.Receitas.rows.slice(2);
  assert.equal(rows.length, 12);
  assert.equal(rows[11][0].toISOString().slice(0, 10), '2027-09-05');
  assert.deepEqual(rows[11].slice(4, 6), ['setembro', 2027]);
  assert.equal(run('apiList').transactions.length, 13);
});

test('contas: cria abas, salva conta, transfere e calcula saldo', () => {
  assert.deepEqual(run('apiAccounts'), { accounts: [], transfers: [], budgets: {} });
  run('apiSaveAccount', { name: 'Nubank', bank: 'Nubank', kind: 'Conta corrente', initial: 100 });
  run('apiSaveAccount', { name: 'Reserva', bank: 'Mercado Pago', kind: 'Reserva', initial: 0, goal: 10000 });
  assert.deepEqual(tabs.Contas.rows[0], ['Conta', 'Banco', 'Tipo', 'Saldo inicial', 'Meta', 'Prazo da meta']);
  assert.throws(() => ctx.apiSaveAccount({ name: 'nubank', kind: 'Conta corrente' }), /\[400\].*Já existe/);

  run('apiCreate', { type: 'receita', date: '2026-10-05', category: 'Salário', amount: 3000, account: 'Nubank' });
  assert.throws(() => ctx.apiCreate({ type: 'receita', date: '2026-10-05', category: 'Salário', amount: 1, account: 'Itaú' }), /não está cadastrada/);
  const tr = run('apiCreateTransfer', { date: '2026-10-06', from: 'Nubank', to: 'Reserva', amount: 500, description: 'guardar' });
  assert.equal(tr.row, 2);
  assert.throws(() => ctx.apiCreateTransfer({ date: '2026-10-06', from: 'Nubank', to: 'Nubank', amount: 1 }), /diferentes/);

  const { accounts, transfers } = run('apiAccounts');
  assert.equal(transfers[0].date, '2026-10-06');
  assert.equal(accounts[1].goal, 10000);
  assert.equal(run('apiOptions').accounts.join(), 'Nubank,Reserva');
});

test('renomear conta atualiza lançamentos e transferências; excluir em uso é recusado', () => {
  run('apiSaveAccount', { name: 'Nubank', kind: 'Conta corrente', initial: 0 });
  run('apiSaveAccount', { name: 'Reserva', kind: 'Reserva', initial: 0 });
  run('apiCreate', { type: 'receita', date: '2026-10-05', category: 'Salário', amount: 3000, account: 'Nubank' });
  const t = run('apiCreateTransfer', { date: '2026-10-06', from: 'Nubank', to: 'Reserva', amount: 500 });
  run('apiSaveAccount', { name: 'Nu', kind: 'Conta corrente', initial: 0 }, 2, 'Nubank');
  assert.equal(run('apiList').transactions.find((x) => x.type === 'receita').account, 'Nu');
  assert.equal(run('apiAccounts').transfers[0].from, 'Nu');
  assert.throws(() => ctx.apiRemoveAccount(2, 'Nu'), /\[409\]/);
  assert.throws(() => ctx.apiRemoveAccount(2, 'Nubank'), /\[409\].*alterada/);
  ctx.apiRemoveTransfer(t.row, { date: '2026-10-06', from: 'Nu', to: 'Reserva', amount: 500 });
  assert.equal(run('apiAccounts').transfers.length, 0);
});

test('aba Contas antiga ganha a coluna de prazo; meta com prazo é lida', () => {
  tabs.Contas = fakeSheet([['Conta', 'Banco', 'Tipo', 'Saldo inicial', 'Meta']]);
  run('apiSaveAccount', { name: 'Viagem', kind: 'Reserva', initial: 0, goal: 8000, deadline: '2027-07-31' });
  assert.equal(tabs.Contas.rows[0][5], 'Prazo da meta');
  assert.equal(run('apiAccounts').accounts[0].deadline, '2027-07-31');
});

test('limites por grupo: grava, troca e apaga', () => {
  run('apiSaveBudgets', { Moradia: 2000, Alimentação: 1200 });
  assert.deepEqual(run('apiAccounts').budgets, { Moradia: 2000, Alimentação: 1200 });
  run('apiSaveBudgets', { Moradia: 2500 });
  assert.deepEqual(run('apiAccounts').budgets, { Moradia: 2500 });
  assert.throws(() => ctx.apiSaveBudgets({ Lazer: 10 }), /\[400\]/);
});

test('despesa parcelada lança uma parcela por mês', () => {
  const r = run('apiCreate', {
    type: 'despesa', date: '2026-11-10', group: 'Alimentação', category: 'Mercado', amount: 100,
    nature: 'Essencial', payment: 'Pix', status: 'A Pagar', installment: 1, installments: 3, repeat: 3,
  });
  assert.equal(r.created, 3);
  const parcels = run('apiList').transactions.filter((t) => t.category === 'Mercado');
  assert.deepEqual(parcels.map((t) => [t.date, t.installment]), [['2026-11-10', 1], ['2026-12-10', 2], ['2027-01-10', 3]]);
  assert.throws(() => ctx.apiCreate({
    type: 'despesa', date: '2026-11-10', group: 'Alimentação', category: 'Mercado', amount: 100,
    nature: 'Essencial', payment: 'Pix', status: 'A Pagar', installment: 2, installments: 3, repeat: 3,
  }), /parcelas restantes/);
});

test('carregador baixa o painel do GitHub, usa cache e a chave quando houver', () => {
  const files = {
    'gas/dist/painel-server.js': readFileSync(new URL('../dist/painel-server.js', import.meta.url), 'utf8'),
    'gas/dist/index.html': readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8'),
  };
  const fetches = [];
  const store = {};
  ctx.UrlFetchApp = {
    fetch: (url, opts) => {
      fetches.push({ url, auth: opts.headers.Authorization });
      const path = url.split('/contents/')[1].split('?')[0];
      return { getResponseCode: () => (files[path] ? 200 : 404), getContentText: () => files[path] };
    },
  };
  ctx.CacheService = { getScriptCache: () => ({
    get: (k) => store[k] ?? null,
    getAll: (ks) => Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]])),
    putAll: (o) => Object.assign(store, o),
  }) };
  ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'tok' }) };
  let served = null;
  ctx.HtmlService = { createHtmlOutput: (h) => { served = h; const o = { setTitle: () => o, addMetaTag: () => o }; return o; } };
  vm.runInContext(readFileSync(new URL('../dist/Loader.gs', import.meta.url), 'utf8'), ctx);
  ctx.doGet();
  assert.equal(served, files['gas/dist/index.html']);
  ctx.doGet();
  assert.equal(fetches.length, 1, 'segunda abertura vem do cache');
  assert.equal(fetches[0].auth, 'Bearer tok');
  assert.match(fetches[0].url, /VictorFernandes06\/painel-financas\/contents\/gas\/dist\/index.html\?ref=main/);
  assert.equal(JSON.parse(JSON.stringify(ctx.apiCall('status', []))).mode, 'google-apps-script');
  assert.throws(() => ctx.apiCall('constructor', []), /\[404\]/);
});
