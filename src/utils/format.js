const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const formatCurrency = (value) => currency.format(Number(value) || 0);
export const formatCompact = (value) => compact.format(Number(value) || 0);

/** Date -> "AAAA-MM-DD" no fuso local (evita o deslocamento de UTC). */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "AAAA-MM-DD" -> "DD/MM/AAAA" */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Chave de mês "AAAA-MM" a partir de uma data ISO ou Date. */
export const monthKey = (value) =>
  typeof value === 'string' ? value.slice(0, 7) : toISODate(value).slice(0, 7);

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
}

export const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Converte o que a pessoa digitou ("1.234,56", "1234.56", "50") em número. */
export function parseAmountInput(raw) {
  const text = String(raw ?? '').trim().replace(/[R$\s]/g, '');
  if (!text) return NaN;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  return Number(normalized);
}

/** Dia em que a receita entrou de fato ("Recebido em" ou a própria data). */
export const receivedOn = (t) => t.receivedAt || t.date;
