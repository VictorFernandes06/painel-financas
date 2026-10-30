import { useMemo } from 'react';
import { Award, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { TYPES } from '../data/categories';
import { formatCurrency, formatDate } from '../utils/format';

const prevMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function Item({ icon: Icon, tone, title, children }) {
  return (
    <div className="flex gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

/** Resumo do mês: quanto sobrou, maior gasto e o grupo que mais mudou. */
export default function MonthReview({ transactions, month, monthName }) {
  const review = useMemo(() => {
    const previous = prevMonth(month);
    let income = 0;
    let expense = 0;
    let biggest = null;
    const groupsNow = new Map();
    const groupsBefore = new Map();
    for (const t of transactions) {
      const key = t.date.slice(0, 7);
      if (t.type === TYPES.EXPENSE) {
        const target = key === month ? groupsNow : key === previous ? groupsBefore : null;
        if (target) target.set(t.group || 'Outras', (target.get(t.group || 'Outras') ?? 0) + t.amount);
      }
      if (key !== month) continue;
      if (t.type === TYPES.INCOME) income += t.amount;
      else {
        expense += t.amount;
        if (!biggest || t.amount > biggest.amount) biggest = t;
      }
    }
    let change = null;
    for (const group of new Set([...groupsNow.keys(), ...groupsBefore.keys()])) {
      const diff = (groupsNow.get(group) ?? 0) - (groupsBefore.get(group) ?? 0);
      if (!change || Math.abs(diff) > Math.abs(change.diff)) change = { group, diff, before: groupsBefore.get(group) ?? 0 };
    }
    return { income, expense, left: income - expense, biggest, change };
  }, [transactions, month]);

  const { income, expense, left, biggest, change } = review;
  if (!income && !expense) return null;
  const savedPct = income > 0 ? Math.round((left / income) * 100) : null;

  return (
    <section aria-label="Resumo do mês" className="card p-5">
      <h2 className="text-base font-semibold">Resumo de {monthName}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Item icon={PiggyBank} tone={left >= 0 ? 'text-income' : 'text-expense'} title="Quanto sobrou">
          <p className={`font-semibold ${left >= 0 ? 'text-income' : 'text-expense'}`}>{formatCurrency(left)}</p>
          {savedPct !== null && (
            <p className="text-xs text-muted-foreground">
              {left >= 0 ? `${savedPct}% do que entrou` : `gastou ${Math.abs(savedPct)}% a mais do que entrou`}
            </p>
          )}
        </Item>
        <Item icon={Award} tone="text-amber-400" title="Maior gasto">
          {biggest ? (
            <>
              <p className="truncate font-semibold">{formatCurrency(biggest.amount)} · {biggest.description || biggest.category}</p>
              <p className="truncate text-xs text-muted-foreground">{biggest.group} · {formatDate(biggest.date)}</p>
            </>
          ) : (
            <p className="text-muted-foreground">Nenhuma despesa</p>
          )}
        </Item>
        <Item
          icon={change && change.diff > 0 ? TrendingUp : TrendingDown}
          tone={change && change.diff > 0 ? 'text-expense' : 'text-income'}
          title="Maior mudança vs. mês anterior"
        >
          {change && change.diff !== 0 ? (
            <>
              <p className="truncate font-semibold">
                {change.group} {change.diff > 0 ? '+' : '−'}{formatCurrency(Math.abs(change.diff))}
              </p>
              <p className="text-xs text-muted-foreground">
                {change.before > 0 ? `${change.diff > 0 ? '+' : ''}${Math.round((change.diff / change.before) * 100)}% em relação ao mês anterior` : 'não teve gasto no mês anterior'}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Sem mudança</p>
          )}
        </Item>
      </div>
    </section>
  );
}
