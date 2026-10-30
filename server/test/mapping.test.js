import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  columnLetter, detectColumns, findHeaderRow, parseAmount, parseCadastro, parseDate,
  rowToTransaction, safeText, toSerial, transactionToRow,
} from '../mapping.js';
import { LAYOUT } from '../layout.js';
import { parseSpreadsheetId } from '../config.js';

const DESPESAS_HEADER = ['Data', 'Grupo', 'Despesa', 'Tipo', 'Forma de pagamento', 'Cartão', 'Parcela', 'Total de parcelas', 'Valor', 'Descrição', 'Status', 'Mês', 'Ano'];

test('acha o cabeçalho na linha 2 (linha 1 é o título da aba)', () => {
  assert.equal(findHeaderRow([['RECEITAS'], ['Data', 'Receita', 'Valor']]), 1);
  assert.equal(findHeaderRow([['nada']]), -1);
});

test('detecta todas as colunas da aba Despesas', () => {
  const { columns, missing } = detectColumns(DESPESAS_HEADER, LAYOUT.despesa);
  assert.deepEqual(missing, []);
  assert.equal(columns.group, 1);
  assert.equal(columns.amount, 8);
  assert.equal(columns.year, 12);
});

test('coluna Grupo com cabeçalho corrompido ("90~Ç") é achada pela posição', () => {
  const header = [...DESPESAS_HEADER];
  header[1] = '90~Ç';
  assert.equal(detectColumns(header, LAYOUT.despesa).columns.group, 1);
});

test('lê valores e datas', () => {
  assert.equal(parseAmount('R$ 1.234,56'), 1234.56);
  assert.equal(parseAmount(35), 35);
  assert.equal(parseDate(45962), '2025-11-01');
  assert.equal(parseDate('24/10/2026'), '2026-10-24');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(toSerial('2025-11-01'), 45962);
});

test('converte linha de despesa e ignora linha vazia', () => {
  const { columns } = detectColumns(DESPESAS_HEADER, LAYOUT.despesa);
  const row = [45962, 'Moradia', 'Aluguel', 'Essencial', 'Pix', '', 1, 14, 1000, '', 'Pago', 'novembro', 2025];
  assert.deepEqual(rowToTransaction(row, 3, columns, 'despesa').transaction, {
    id: 'despesa-3', row: 3, type: 'despesa', date: '2025-11-01', amount: 1000, category: 'Aluguel', description: '',
    account: '', group: 'Moradia', nature: 'Essencial', payment: 'Pix', card: '', installment: 1, installments: 14, status: 'Pago',
  });
  assert.ok(rowToTransaction(['', '', '', '', '', '', '', '', '', '', '', '', ''], 4, columns, 'despesa').blank);
});

test('valor zero vira aviso, não lançamento', () => {
  const { columns } = detectColumns(['Data', 'Receita', 'Valor', 'Observação', 'Mês', 'Ano'], LAYOUT.receita);
  assert.match(rowToTransaction([45969, 'Extras', 0, 'CARTAO'], 6, columns, 'receita').error, /Receitas, linha 6/);
});

test('monta a linha com Mês e Ano preenchidos a partir da data', () => {
  const { columns } = detectColumns(['Data', 'Receita', 'Valor', 'Observação', 'Mês', 'Ano'], LAYOUT.receita);
  const row = transactionToRow({ type: 'receita', date: '2026-10-24', category: 'Salário', amount: 3998, description: '' }, columns, 6);
  assert.deepEqual(row, [toSerial('2026-10-24'), 'Salário', 3998, '', 'outubro', 2026]);
});

test('bloqueia injeção de fórmulas', () => {
  assert.equal(safeText('=IMPORTXML("x")'), `'=IMPORTXML("x")`);
  assert.equal(safeText('Mercado'), 'Mercado');
});

test('lê listas da aba Cadastro', () => {
  const values = [
    ['Cartão', 'Receitas', 'Grupo', 'Moradia', 'Outras'],
    ['Nubank', 'Salário', 'Moradia', 'Aluguel', 'Doações'],
    ['Inter', 'Saldo Banco', 'Outras', 'Energia', ''],
    ['', 'Saldo Banco', '', '', ''],
  ];
  assert.deepEqual(parseCadastro(values), {
    incomeCategories: ['Salário', 'Saldo Banco'],
    groups: { Moradia: ['Aluguel', 'Energia'], Outras: ['Doações'] },
    cards: ['Nubank', 'Inter'],
  });
});

test('letra da coluna', () => {
  assert.equal(columnLetter(0), 'A');
  assert.equal(columnLetter(12), 'M');
  assert.equal(columnLetter(26), 'AA');
});

test('extrai o ID de links do Sheets e identifica links do Drive', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd';
  assert.deepEqual(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`), { id, kind: 'sheets' });
  assert.equal(parseSpreadsheetId(`https://drive.google.com/file/d/${id}/view`).kind, 'drive-file');
  assert.equal(parseSpreadsheetId('qualquer coisa').kind, 'invalid');
});
