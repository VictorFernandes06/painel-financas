export { TYPES, NATURES, PAYMENT_METHODS, STATUSES } from '../../shared/categories.js';

// Cores fixas para os grupos de despesa da planilha.
export const GROUP_COLORS = {
  Moradia: '#6366f1',
  Alimentação: '#f59e0b',
  Transporte: '#06b6d4',
  Lazer: '#ec4899',
  Saúde: '#10b981',
  Pessoais: '#8b5cf6',
  Educação: '#3b82f6',
  Financeiras: '#f43f5e',
  Investimentos: '#84cc16',
  Pet: '#f97316',
  Outras: '#a1a1aa',
};

const EXTRA_COLORS = ['#14b8a6', '#eab308', '#d946ef', '#0ea5e9', '#fb7185', '#a3e635'];

export function groupColor(name, index = 0) {
  return GROUP_COLORS[name] ?? EXTRA_COLORS[index % EXTRA_COLORS.length];
}

/** Garante que o valor atual aparece na lista, mesmo que não esteja no Cadastro. */
export const withCurrent = (list, current) => (current && !list.includes(current) ? [current, ...list] : list);
