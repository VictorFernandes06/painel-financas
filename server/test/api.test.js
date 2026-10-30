import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { GoogleSheetsRepository } from '../repositories/googleSheets.js';
import { MemorySheetsClient } from '../repositories/memorySheetsClient.js';
import { toSerial } from '../mapping.js';

let server;
let base;
let client;

const CADASTRO = [
  ['Cartão', 'Receitas', 'Grupo', 'Moradia', 'Alimentação'],
  ['Nubank', 'Salário', 'Moradia', 'Aluguel', 'Mercado'],
  ['Inter', 'Extras', 'Alimentação', 'Energia', 'Feira'],
];
const RECEITAS = [
  ['RECEITAS'],
  ['Data', 'Receita', 'Valor', 'Observação', 'Mês', 'Ano'],
  [toSerial('2026-10-01'), 'Salário', 3998, '', 'outubro', 2026],
];
const DESPESAS = [
  ['DESPESAS'],
  ['Data', 'Grupo', 'Despesa', 'Tipo', 'Forma de pagamento', 'Cartão', 'Parcela', 'Total de parcelas', 'Valor', 'Descrição', 'Status', 'Mês', 'Ano', 'Fórmula'],
  [toSerial('2026-10-02'), 'Moradia', 'Aluguel', 'Essencial', 'Pix', '', 1, 1, 1000, '', 'Pago', 'outubro', 2026, '=X'],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '=X'],
  [toSerial('2026-10-03'), 'Alimentação', 'Mercado', 'Essencial', 'Cartão', 'Nubank', 1, 1, 250.5, 'Semana', 'A Pagar', 'outubro', 2026, '=X'],
];

async function start({ readOnly = false, tabs } = {}) {
  if (server) server.close();
  client = new MemorySheetsClient({ tabs: tabs ?? { Cadastro: CADASTRO, Receitas: RECEITAS, Despesas: DESPESAS } });
  const config = { spreadsheetId: 'x', readOnly, demo: false };
  const app = createApp({ repository: new GoogleSheetsRepository(config, client), config });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
}

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const expense = (extra = {}) => ({
  type: 'despesa', date: '2026-10-24', group: 'Alimentação', category: 'Feira', description: 'Hortifruti',
  nature: 'Essencial', payment: 'Pix', card: '', installment: 1, installments: 1, status: 'Pago', amount: 80, ...extra,
});

beforeEach(() => start());
after(() => server?.close());

test('lista receitas e despesas das duas abas', async () => {
  const { status, body } = await call('GET', '/transactions');
  assert.equal(status, 200);
  assert.deepEqual(body.transactions.map((t) => t.id), ['receita-3', 'despesa-3', 'despesa-5']);
  assert.equal(body.transactions[2].card, 'Nubank');
});

test('devolve as listas do Cadastro', async () => {
  const { body } = await call('GET', '/options');
  assert.deepEqual(body.groups, { Moradia: ['Aluguel', 'Energia'], Alimentação: ['Mercado', 'Feira'] });
  assert.deepEqual(body.incomeCategories, ['Salário', 'Extras']);
});

test('nova despesa ocupa a primeira linha vazia e não mexe na coluna de fórmula', async () => {
  const { status, body } = await call('POST', '/transactions', expense());
  assert.equal(status, 201);
  assert.equal(body.row, 4);
  const written = client.tabs.Despesas[3];
  assert.deepEqual(written, [toSerial('2026-10-24'), 'Alimentação', 'Feira', 'Essencial', 'Pix', '', 1, 1, 80, 'Hortifruti', 'Pago', 'outubro', 2026, '=X']);
});

test('nova receita vai para o fim da aba Receitas com Mês e Ano', async () => {
  const { status, body } = await call('POST', '/transactions', {
    type: 'receita', date: '2026-11-01', category: 'Extras', description: '=HACK()', amount: 100,
  });
  assert.equal(status, 201);
  assert.equal(body.row, 4);
  assert.equal(client.calls.at(-1)[2][0][3], "'=HACK()");
  assert.deepEqual(client.tabs.Receitas[3].slice(4), ['novembro', 2026]);
});

test('recusa valores fora das listas do Cadastro', async () => {
  const bad = await call('POST', '/transactions', expense({ category: 'Aluguel' }));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /não pertence ao grupo Alimentação/);
  const badIncome = await call('POST', '/transactions', { type: 'receita', date: '2026-11-01', category: 'Loteria', amount: 1 });
  assert.match(badIncome.body.error, /Loteria/);
  const old = await call('POST', '/transactions', expense({ date: '2024-01-01' }));
  assert.match(old.body.error, /02\/05\/2025/);
});

test('edita a linha certa', async () => {
  const { body } = await call('GET', '/transactions');
  const mercado = body.transactions.find((t) => t.id === 'despesa-5');
  const res = await call('PUT', '/transactions/despesa/5', { transaction: { ...mercado, amount: 300, status: 'Pago' }, expected: mercado });
  assert.equal(res.status, 200);
  assert.equal(client.tabs.Despesas[4][8], 300);
  assert.equal(client.tabs.Despesas[4][10], 'Pago');
});

test('mudar despesa para receita move o lançamento de aba', async () => {
  const { body } = await call('GET', '/transactions');
  const aluguel = body.transactions.find((t) => t.id === 'despesa-3');
  const res = await call('PUT', '/transactions/despesa/3', {
    transaction: { type: 'receita', date: aluguel.date, category: 'Extras', description: 'Estorno', amount: 1000 },
    expected: aluguel,
  });
  assert.equal(res.status, 200);
  assert.equal(client.tabs.Despesas[2][0], '');
  assert.equal(client.tabs.Receitas[3][1], 'Extras');
});

test('recusa editar/excluir se a linha mudou na planilha', async () => {
  const { body } = await call('GET', '/transactions');
  const aluguel = body.transactions.find((t) => t.id === 'despesa-3');
  client.tabs.Despesas[2][8] = 999;
  const put = await call('PUT', '/transactions/despesa/3', { transaction: aluguel, expected: aluguel });
  assert.equal(put.status, 409);
  const del = await call('DELETE', '/transactions/despesa/3', { expected: aluguel });
  assert.equal(del.status, 409);
});

test('excluir apaga só os valores da linha', async () => {
  const { body } = await call('GET', '/transactions');
  const aluguel = body.transactions.find((t) => t.id === 'despesa-3');
  const { status } = await call('DELETE', '/transactions/despesa/3', { expected: aluguel });
  assert.equal(status, 204);
  assert.deepEqual(client.tabs.Despesas[2], ['', '', '', '', '', '', '', '', '', '', '', '', '', '=X']);
  const after = await call('GET', '/transactions');
  assert.equal(after.body.transactions.length, 2);
});

test('modo somente leitura bloqueia escrita', async () => {
  await start({ readOnly: true });
  const { status, body } = await call('POST', '/transactions', expense());
  assert.equal(status, 403);
  assert.match(body.error, /somente leitura/);
});

test('explica quando falta uma aba', async () => {
  await start({ tabs: { Receitas: RECEITAS } });
  const { status, body } = await call('GET', '/transactions');
  assert.equal(status, 422);
  assert.match(body.error, /Despesas/);
});

test('rota com tipo ou linha inválidos', async () => {
  assert.equal((await call('DELETE', '/transactions/outro/3', { expected: {} })).status, 400);
  assert.equal((await call('DELETE', '/transactions/despesa/1', { expected: {} })).status, 400);
});

test('receita recorrente cria uma linha por mês', async () => {
  const { status, body } = await call('POST', '/transactions', {
    type: 'receita', date: '2026-10-31', category: 'Salário', amount: 3998, repeat: 4,
  });
  assert.equal(status, 201);
  assert.equal(body.created, 4);
  const rows = client.tabs.Receitas.slice(3).map((r) => [r[0], r[4], r[5]]);
  assert.deepEqual(rows, [
    [toSerial('2026-10-31'), 'outubro', 2026],
    [toSerial('2026-11-30'), 'novembro', 2026],
    [toSerial('2026-12-31'), 'dezembro', 2026],
    [toSerial('2027-01-31'), 'janeiro', 2027],
  ]);
  const bad = await call('POST', '/transactions', { type: 'receita', date: '2026-10-01', category: 'Salário', amount: 1, repeat: 100 });
  assert.equal(bad.status, 400);
});

test('aceita despesa sem forma de pagamento (linhas antigas da planilha)', async () => {
  const { status } = await call('POST', '/transactions', expense({ payment: '', status: 'A Pagar' }));
  assert.equal(status, 201);
  const bad = await call('POST', '/transactions', expense({ payment: 'Boleto' }));
  assert.equal(bad.status, 400);
});
