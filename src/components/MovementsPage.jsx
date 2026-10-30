import { useMemo } from 'react';
import { TYPES, groupColor } from '../data/categories';
import { formatCurrency, monthKey, toISODate } from '../utils/format';
import { useCountUp } from '../hooks/useCountUp';
import TransactionTable from './TransactionTable';

function Kpi({ label, value, hint, tone, delay }) {
  const shown = useCountUp(value);
  const bar = { income: 'bg-emerald-400', expense: 'bg-rose-400', amber: 'bg-amber-400', sky: 'bg-sky-400' }[tone] ?? 'bg-zinc-500';
  const text = { income: 'text-income', expense: 'text-expense', amber: 'text-amber-300', sky: 'text-sky-300' }[tone] ?? 'text-zinc-50';
  return (
    <div className="anim-fade-up relative p-4" style={{ animationDelay: `${delay}ms` }}>
      <span className={`anim-grow-x absolute inset-x-0 top-0 h-0.5 ${bar}`} style={{ animationDelay: `${delay + 120}ms` }} aria-hidden />
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${text}`}>{formatCurrency(shown)}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function Breakdown({ items, budgets, isIncome, monthName }) {
  const total = items.reduce((s, r) => s + r.value, 0);
  const max = Math.max(...items.map((r) => Math.max(r.value, budgets?.[r.name] ?? 0)), 1);
  return (
    <section className="card anim-fade-up p-5">
      <h2 className="font-semibold">{isIncome ? 'Receitas por tipo' : 'Despesas por grupo'}</h2>
      <p className="text-xs text-muted-foreground">
        {monthName} · total {formatCurrency(total)}
        {!isIncome && ' · a linha clara marca o limite do grupo'}
      </p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nada lançado neste mês.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((r, i) => {
            const limit = budgets?.[r.name];
            const color = isIncome ? '#22c55e' : groupColor(r.name, i);
            return (
              <li key={r.name} className="anim-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                    <span className="truncate text-zinc-200">{r.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{r.count} lanç.</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-medium text-zinc-50">{formatCurrency(r.value)}</span>
                    <span className="ml-2 text-xs text-zinc-500">{total ? Math.round((r.value / total) * 100) : 0}%</span>
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-white/[0.05]">
                  <div className="anim-grow-x h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color, animationDelay: `${i * 50}ms` }} />
                  {limit && <span className="absolute -top-1 h-4 w-0.5 rounded bg-zinc-200/70" style={{ left: `${(limit / max) * 100}%` }} title={`Limite ${formatCurrency(limit)}`} />}
                </div>
                {limit && (
                  <p className={`mt-1 text-[11px] ${r.value > limit ? 'text-expense' : 'text-zinc-500'}`}>
                    {r.value > limit ? `Passou ${formatCurrency(r.value - limit)} do limite` : `Restam ${formatCurrency(limit - r.value)} do limite de ${formatCurrency(limit)}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Página de Receitas ou de Despesas, com abas. */
export default function MovementsPage({ type, tab, data, month, monthName, readOnly, onEdit }) {
  const { transactions, budgets, saving } = data;
  const isIncome = type === TYPES.INCOME;
  const today = toISODate(new Date());
  const monthEnd = `${month}-31`;

  const stats = useMemo(() => {
    const mine = transactions.filter((t) => t.type === type);
    const inMonth = mine.filter((t) => t.date.startsWith(month));
    const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
    const [y, m] = month.split('-').map(Number);
    const next3 = new Set([1, 2, 3].map((n) => monthKey(new Date(y, m - 1 + n, 1))));
    const byKey = new Map();
    for (const t of inMonth) {
      const key = (isIncome ? t.category : t.group) || 'Outras';
      const cur = byKey.get(key) ?? { name: key, value: 0, count: 0 };
      cur.value += t.amount;
      cur.count += 1;
      byKey.set(key, cur);
    }
    const unpaid = mine.filter((t) => t.status && t.status !== 'Pago');
    return {
      month: sum(inMonth),
      received: sum(inMonth.filter((t) => t.date <= today)),
      toReceive: sum(inMonth.filter((t) => t.date > today)),
      next3: sum(mine.filter((t) => next3.has(t.date.slice(0, 7)))),
      year: sum(mine.filter((t) => t.date.startsWith(String(y)))),
      paid: sum(inMonth.filter((t) => t.status === 'Pago' || !t.status)),
      pending: sum(inMonth.filter((t) => t.status && t.status !== 'Pago')),
      overdue: unpaid.filter((t) => t.date < today),
      breakdown: [...byKey.values()].sort((a, b) => b.value - a.value),
    };
  }, [transactions, type, month, today, isIncome]);

  const table = {
    mes: { filterFn: null, all: false, title: `${isIncome ? 'Receitas' : 'Despesas'} de ${monthName}` },
    proximas: { filterFn: (t) => t.date > monthEnd, all: true, title: 'Receitas dos próximos meses' },
    todas: { filterFn: null, all: true, title: `Todas as ${isIncome ? 'receitas' : 'despesas'}` },
    apagar: { filterFn: (t) => t.status && t.status !== 'Pago', all: true, title: 'Contas a pagar', subtitle: 'Tudo que ainda não foi pago, mês a mês' },
    pagas: { filterFn: (t) => t.status === 'Pago', all: false, title: `Pagas em ${monthName}` },
  }[tab];

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-2 overflow-hidden lg:grid-cols-4 [&>*]:border-white/[0.06] [&>*:nth-child(odd)]:border-r lg:[&>*]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0">
        {isIncome ? (
          <>
            <Kpi label={`Total em ${monthName}`} value={stats.month} tone="income" delay={0} />
            <Kpi label="Já recebido" value={stats.received} tone="income" delay={60} hint="Com data até hoje" />
            <Kpi label="A receber no mês" value={stats.toReceive} tone="amber" delay={120} />
            <Kpi label="Próximos 3 meses" value={stats.next3} tone="sky" delay={180} hint={`${formatCurrency(stats.year)} no ano`} />
          </>
        ) : (
          <>
            <Kpi label={`Total em ${monthName}`} value={stats.month} tone="expense" delay={0} />
            <Kpi label="Pago" value={stats.paid} tone="income" delay={60} />
            <Kpi label="A pagar no mês" value={stats.pending} tone="amber" delay={120} />
            <Kpi label="Vencidas (todos os meses)" value={stats.overdue.reduce((s, t) => s + t.amount, 0)} tone="expense" delay={180}
              hint={stats.overdue.length ? `${stats.overdue.length} conta(s) atrasada(s)` : 'Nenhuma atrasada'} />
          </>
        )}
      </div>

      {table ? (
        <div className="anim-fade-up" style={{ animationDelay: '120ms' }} key={tab}>
          <TransactionTable
            month={month}
            monthName={monthName}
            transactions={transactions}
            fixedType={type}
            filterFn={table.filterFn}
            forceAll={table.all}
            title={table.title}
            subtitle={table.subtitle}
            readOnly={readOnly}
            busy={saving}
            onUpdate={data.update}
            onDelete={data.remove}
            onEdit={onEdit}
          />
        </div>
      ) : (
        <Breakdown items={stats.breakdown} budgets={isIncome ? null : budgets} isIncome={isIncome} monthName={monthName} />
      )}
    </div>
  );
}
