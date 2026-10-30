// Contas (onde o dinheiro está) e transferências entre elas.
// Usado pelo servidor (ler/gravar na planilha) e pelo navegador (calcular saldos).

export const ACCOUNTS_TAB = 'Contas';
export const TRANSFERS_TAB = 'Transferências';

export const ACCOUNT_KINDS = ['Conta corrente', 'Poupança', 'Reserva', 'Investimento', 'Carteira', 'Outro'];

export const ACCOUNTS_HEADER = ['Conta', 'Banco', 'Tipo', 'Saldo inicial', 'Meta', 'Prazo da meta'];
export const BUDGETS_TAB = 'Limites';
export const BUDGETS_HEADER = ['Grupo', 'Limite mensal'];
export const TRANSFERS_HEADER = ['Data', 'De', 'Para', 'Valor', 'Descrição', 'Mês', 'Ano'];

const MAX_TEXT = 60;
const MAX_AMOUNT = 1_000_000_000;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/\./g, '').replace(',', '.')));
const money = (v) => Math.round(v * 100) / 100;

/** Linhas da aba Contas -> lista de contas (linha 1 é o cabeçalho). */
export function parseAccounts(values, toISO = () => null) {
  const accounts = [];
  (values ?? []).slice(1).forEach((r, i) => {
    const name = String(r?.[0] ?? '').trim();
    if (!name) return;
    const initial = num(r[3]);
    const goal = num(r[4]);
    accounts.push({
      row: i + 2,
      name,
      bank: String(r[1] ?? '').trim(),
      kind: String(r[2] ?? '').trim() || 'Outro',
      initial: Number.isFinite(initial) ? money(initial) : 0,
      goal: Number.isFinite(goal) && goal > 0 ? money(goal) : null,
      deadline: r[5] ? toISO(r[5]) : null,
    });
  });
  return accounts;
}

/** Linhas da aba Transferências -> lista. `toISO` converte a célula de data. */
export function parseTransfers(values, toISO) {
  const transfers = [];
  (values ?? []).slice(1).forEach((r, i) => {
    const date = toISO(r?.[0]);
    const amount = num(r?.[3]);
    const from = String(r?.[1] ?? '').trim();
    const to = String(r?.[2] ?? '').trim();
    if (!date || !from || !to || !Number.isFinite(amount) || amount <= 0) return;
    transfers.push({ row: i + 2, id: `transferencia-${i + 2}`, date, from, to, amount: money(amount), description: String(r[4] ?? '').trim() });
  });
  return transfers;
}

/**
 * Saldo de cada conta = saldo inicial + receitas que entraram nela
 * - despesas pagas por ela + transferências recebidas - enviadas.
 * Despesas "A Pagar"/"Atrasado" ainda não saíram da conta.
 */
export function computeBalances(accounts, transactions, transfers) {
  const byName = new Map(accounts.map((a) => [a.name, { ...a, income: 0, expense: 0, transferIn: 0, transferOut: 0 }]));
  let unassignedIncome = 0;
  let unassignedExpense = 0;
  for (const t of transactions) {
    const acc = t.account ? byName.get(t.account) : null;
    if (t.type === 'receita') {
      if (acc) acc.income += t.amount;
      else unassignedIncome += t.amount;
    } else if (!t.status || t.status === 'Pago') {
      if (acc) acc.expense += t.amount;
      else unassignedExpense += t.amount;
    }
  }
  for (const tr of transfers) {
    if (byName.has(tr.from)) byName.get(tr.from).transferOut += tr.amount;
    if (byName.has(tr.to)) byName.get(tr.to).transferIn += tr.amount;
  }
  const list = [...byName.values()].map((a) => ({
    ...a,
    balance: money(a.initial + a.income - a.expense + a.transferIn - a.transferOut),
  }));
  return {
    accounts: list,
    total: money(list.reduce((s, a) => s + a.balance, 0)),
    unassigned: { income: money(unassignedIncome), expense: money(unassignedExpense) },
  };
}

export function validateAccountInput(body, existingNames = []) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = [];
  const name = str(input.name);
  const bank = str(input.bank);
  const kind = str(input.kind);
  const initial = input.initial == null || input.initial === '' ? 0 : num(input.initial);
  const goal = input.goal == null || input.goal === '' ? null : num(input.goal);
  if (!name) errors.push('Dê um nome para a conta.');
  else if (name.length > MAX_TEXT) errors.push('Nome muito longo.');
  else if (/^[=+\-@]/.test(name)) errors.push('O nome não pode começar com = + - ou @.');
  else if (existingNames.some((n) => n.toLowerCase() === name.toLowerCase())) errors.push(`Já existe uma conta chamada "${name}".`);
  if (bank.length > MAX_TEXT) errors.push('Nome do banco muito longo.');
  if (!ACCOUNT_KINDS.includes(kind)) errors.push(`Tipo deve ser: ${ACCOUNT_KINDS.join(', ')}.`);
  if (!Number.isFinite(initial) || Math.abs(initial) > MAX_AMOUNT) errors.push('Saldo inicial inválido.');
  if (goal !== null && (!Number.isFinite(goal) || goal <= 0 || goal > MAX_AMOUNT)) errors.push('Meta inválida.');
  const deadline = str(input.deadline);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.push('Prazo inválido.');
  if (deadline && goal === null) errors.push('Defina a meta para usar o prazo.');
  if (errors.length) return { errors };
  return { value: { name, bank, kind, initial: money(initial), goal: goal === null ? null : money(goal), deadline: deadline || null } };
}

export function validateTransferInput(body, accountNames = []) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = [];
  const date = str(input.date);
  const from = str(input.from);
  const to = str(input.to);
  const description = str(input.description);
  const amount = typeof input.amount === 'number' ? input.amount : NaN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Data inválida.');
  if (!accountNames.includes(from)) errors.push('Escolha a conta de origem.');
  if (!accountNames.includes(to)) errors.push('Escolha a conta de destino.');
  if (from && from === to) errors.push('A origem e o destino precisam ser contas diferentes.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push('Valor inválido.');
  if (description.length > 120) errors.push('Descrição muito longa.');
  if (errors.length) return { errors };
  return { value: { date, from, to, amount: money(amount), description } };
}

/** Linhas da aba Limites -> { Grupo: limite }. */
export function parseBudgets(values) {
  const budgets = {};
  (values ?? []).slice(1).forEach((r) => {
    const group = String(r?.[0] ?? '').trim();
    const limit = num(r?.[1]);
    if (group && Number.isFinite(limit) && limit > 0) budgets[group] = money(limit);
  });
  return budgets;
}

export function validateBudgets(body, groups = []) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = [];
  const value = {};
  for (const [group, raw] of Object.entries(input)) {
    if (raw === '' || raw == null || raw === 0) continue;
    const limit = typeof raw === 'number' ? raw : NaN;
    if (groups.length && !groups.includes(group)) errors.push(`Grupo "${group}" não está no Cadastro.`);
    else if (!Number.isFinite(limit) || limit < 0 || limit > MAX_AMOUNT) errors.push(`Limite inválido para ${group}.`);
    else value[group] = money(limit);
  }
  return errors.length ? { errors } : { value };
}

/** Quanto guardar por mês para chegar na meta até o prazo. */
export function monthlyToGoal(balance, goal, deadline, todayISO) {
  if (!goal || !deadline || balance >= goal) return null;
  const [y1, m1] = todayISO.split('-').map(Number);
  const [y2, m2] = deadline.split('-').map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) + 1;
  if (months <= 0) return { late: true, missing: money(goal - balance) };
  return { months, perMonth: money((goal - balance) / months), missing: money(goal - balance) };
}
