import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalances, validateAccountInput, validateTransferInput } from '../../shared/accounts.js';

test('saldo por conta: inicial + receitas - despesas pagas ± transferências', () => {
  const accounts = [{ name: 'Nubank', initial: 100 }, { name: 'Reserva', initial: 0, goal: 1000 }];
  const tx = [
    { type: 'receita', amount: 3000, account: 'Nubank' },
    { type: 'despesa', amount: 200, account: 'Nubank', status: 'Pago' },
    { type: 'despesa', amount: 999, account: 'Nubank', status: 'A Pagar' },
    { type: 'receita', amount: 50, account: '' },
  ];
  const tr = [{ from: 'Nubank', to: 'Reserva', amount: 500 }];
  const r = computeBalances(accounts, tx, tr);
  assert.deepEqual(r.accounts.map((a) => a.balance), [2400, 500]);
  assert.equal(r.total, 2900);
  assert.deepEqual(r.unassigned, { income: 50, expense: 0 });
});

test('valida conta e transferência', () => {
  assert.ok(validateAccountInput({ name: '=X', kind: 'Reserva' }).errors);
  assert.deepEqual(validateAccountInput({ name: 'Reserva', kind: 'Reserva', initial: '1.000,50' }).value.initial, 1000.5);
  assert.ok(validateTransferInput({ date: '2026-10-01', from: 'A', to: 'B', amount: 0 }, ['A', 'B']).errors);
});
