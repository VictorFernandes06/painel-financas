import { NATURES, PAYMENT_METHODS, STATUSES, TYPES } from '../shared/categories.js';

const MAX_TEXT = 120;
const MAX_AMOUNT = 1_000_000_000;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Valida o que chega do navegador antes de gravar.
 * `options` são as listas da aba Cadastro: a planilha recusa valores fora delas.
 */
export function validateTransactionInput(body, options) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = [];
  const type = input.type;
  const date = str(input.date);
  const category = str(input.category);
  const description = str(input.description);
  const amount = typeof input.amount === 'number' ? input.amount : NaN;

  if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) errors.push('Tipo deve ser receita ou despesa.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Data inválida.');
  else if (date < '2025-05-02') errors.push('A planilha só aceita datas a partir de 02/05/2025.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push('Valor inválido.');
  if (description.length > MAX_TEXT) errors.push('Descrição muito longa.');
  if (!category) errors.push('Categoria obrigatória.');

  const account = str(input.account);
  if (account && options?.accounts && !options.accounts.includes(account)) errors.push(`Conta "${account}" não está cadastrada.`);
  const value = { type, date, category, description, account, amount: Math.round(amount * 100) / 100 };

  // Recorrente (salário, aluguel) ou parcelas: um lançamento por mês, no mesmo dia.
  const repeat = input.repeat == null || input.repeat === '' ? 1 : Number(input.repeat);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 60) errors.push('Repetir: escolha de 1 a 60 meses.');
  else if (repeat > 1) value.repeat = repeat;

  if (type === TYPES.INCOME) {
    if (options?.incomeCategories?.length && category && !options.incomeCategories.includes(category)) {
      errors.push(`"${category}" não está na lista de Receitas do Cadastro.`);
    }
  }

  if (type === TYPES.EXPENSE) {
    const group = str(input.group);
    const nature = str(input.nature);
    const payment = str(input.payment);
    const card = str(input.card);
    const status = str(input.status);
    const installment = input.installment == null || input.installment === '' ? 1 : Number(input.installment);
    const installments = input.installments == null || input.installments === '' ? 1 : Number(input.installments);

    const groups = options?.groups ?? {};
    if (!group) errors.push('Grupo obrigatório.');
    else if (Object.keys(groups).length && !groups[group]) errors.push(`Grupo "${group}" não está no Cadastro.`);
    else if (groups[group]?.length && category && !groups[group].includes(category)) {
      errors.push(`"${category}" não pertence ao grupo ${group} no Cadastro.`);
    }
    if (!NATURES.includes(nature)) errors.push(`Tipo deve ser: ${NATURES.join(', ')}.`);
    if (!PAYMENT_METHODS.includes(payment)) errors.push(`Forma de pagamento deve ser: ${PAYMENT_METHODS.join(', ')}.`);
    if (!STATUSES.includes(status)) errors.push(`Status deve ser: ${STATUSES.join(', ')}.`);
    if (card && options?.cards?.length && !options.cards.includes(card)) errors.push(`Cartão "${card}" não está no Cadastro.`);
    if (!Number.isInteger(installment) || installment < 1 || installment > 360) errors.push('Parcela inválida.');
    if (!Number.isInteger(installments) || installments < 1 || installments > 360) errors.push('Total de parcelas inválido.');
    if (installment > installments) errors.push('A parcela não pode ser maior que o total de parcelas.');

    if (installments > 1 && value.repeat && installment + value.repeat - 1 > installments) {
      errors.push('Há mais meses do que parcelas restantes.');
    }
    Object.assign(value, { group, nature, payment, card, status, installment, installments });
  }

  return errors.length ? { errors } : { value };
}
