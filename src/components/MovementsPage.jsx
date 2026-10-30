import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { TYPES, groupColor } from '../data/categories';
import { MONTH_NAMES, formatCurrency, monthKey, monthLabel, toISODate } from '../utils/format';
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


const longMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} de ${y}`;
};

/** Menu de meses na horizontal: cada mês com total e quantidade. */
function MonthStrip({ months, selected, onSelect, tone, countLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  const accent = tone === 'income' ? 'text-income' : tone === 'amber' ? 'text-amber-300' : 'text-expense';
  const chip = (active) =>
    `flex shrink-0 flex-col items-start rounded-xl border px-3.5 py-2 text-left transition-all duration-200 ${
      active
        ? 'border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_16px_rgba(52,211,153,0.25)]'
        : 'border-white/[0.07] bg-card hover:-translate-y-0.5 hover:border-white/20'
    }`;
  return (
    <div ref={ref} className="anim-fade-up -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Escolher mês">
      <button type="button" aria-pressed={selected === 'all'} onClick={() => onSelect('all')} className={chip(selected === 'all')}>
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Todos</span>
        <span className="text-sm font-semibold tabular-nums text-zinc-100">{formatCurrency(months.reduce((s, m) => s + m.total, 0))}</span>
        <span className="text-[11px] text-zinc-500">{months.reduce((s, m) => s + m.count, 0)} {countLabel}</span>
      </button>
      {months.map((m) => (
        <button key={m.key} type="button" aria-pressed={selected === m.key} onClick={() => onSelect(m.key)} className={chip(selected === m.key)}>
          <span className={`text-[11px] font-medium uppercase tracking-wide ${m.late ? 'text-expense' : 'text-zinc-400'}`}>
            {monthLabel(m.key)}{m.late ? ' · vencido' : ''}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${accent}`}>{formatCurrency(m.total)}</span>
          <span className="text-[11px] text-zinc-500">{m.count} {m.count === 1 ? countLabel.replace(/s$/, '') : countLabel}</span>
        </button>
      ))}
    </div>
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

  const tabs = {
    mes: { filterFn: null, all: false, title: `${isIncome ? 'Receitas' : 'Despesas'} de ${monthName}` },
    proximas: { strip: true, base: (t) => t.date > monthEnd, title: 'Receitas previstas', label: 'Previsto para' },
    todas: { strip: true, base: null, title: `${isIncome ? 'Receitas' : 'Despesas'}`, label: 'Total de' },
    apagar: { strip: true, base: (t) => t.status && t.status !== 'Pago', title: 'Contas a pagar', label: 'A pagar em', tone: 'amber' },
    pagas: { strip: true, base: (t) => t.status === 'Pago', title: 'Contas pagas', label: 'Pago em', tone: 'income' },
  };
  const current = tabs[tab];

  // Meses disponíveis na aba (com total e quantidade) para o menu de meses.
  const stripMonths = useMemo(() => {
    if (!current?.strip) return [];
    const map = new Map();
    for (const t of transactions) {
      if (t.type !== type || (current.base && !current.base(t))) continue;
      const key = t.date.slice(0, 7);
      const m = map.get(key) ?? { key, total: 0, count: 0, late: false };
      m.total += t.amount;
      m.count += 1;
      if (tab === 'apagar' && t.date < today) m.late = true;
      map.set(key, m);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [transactions, type, tab, current, today]);

  const [picked, setPicked] = useState({});
  const fallback =
    tab === 'apagar' || tab === 'proximas'
      ? stripMonths[0]?.key
      : stripMonths.find((m) => m.key === month)?.key ?? stripMonths.find((m) => m.key > month)?.key ?? stripMonths[stripMonths.length - 1]?.key;
  const chosen = picked[tab];
  const selected = chosen === 'all' || stripMonths.some((m) => m.key === chosen) ? chosen : fallback ?? 'all';
  const selectedInfo = stripMonths.find((m) => m.key === selected);

  const table = current?.strip
    ? {
        filterFn: (t) => (!current.base || current.base(t)) && (selected === 'all' || t.date.startsWith(selected)),
        all: true,
        title: selected === 'all' ? `${current.title} · todos os meses` : `${current.title} · ${longMonth(selected)}`,
        subtitle: selected === 'all' ? 'Agrupado por mês' : 'Em ordem de data',
      }
    : current;

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

      {current?.strip && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <CalendarRange className="h-4 w-4" aria-hidden /> Escolha o mês
          </div>
          {stripMonths.length > 0 ? (
            <>
              <MonthStrip
                months={stripMonths}
                selected={selected}
                onSelect={(key) => setPicked((p) => ({ ...p, [tab]: key }))}
                tone={current.tone ?? (isIncome ? 'income' : 'expense')}
                countLabel={tab === 'apagar' || tab === 'pagas' ? 'contas' : 'lanç.'}
              />
              <div key={selected} className="anim-fade-up flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-white/[0.07] bg-gradient-to-r from-white/[0.04] to-transparent px-5 py-4">
                <p className="text-sm text-zinc-300">
                  {current.label} <span className="font-semibold text-zinc-50">{selected === 'all' ? 'todos os meses' : longMonth(selected)}</span>
                </p>
                <p className="flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold tabular-nums ${current.tone === 'amber' ? 'text-amber-300' : isIncome || current.tone === 'income' ? 'text-income' : 'text-expense'}`}>
                    {formatCurrency(selected === 'all' ? stripMonths.reduce((s2, m) => s2 + m.total, 0) : selectedInfo?.total ?? 0)}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {selected === 'all' ? stripMonths.reduce((s2, m) => s2 + m.count, 0) : selectedInfo?.count ?? 0} lançamento(s)
                  </span>
                </p>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-white/[0.07] px-5 py-4 text-sm text-zinc-400">
              {tab === 'apagar' ? 'Nenhuma conta a pagar. Tudo em dia!' : 'Nada por aqui ainda.'}
            </p>
          )}
        </div>
      )}

      {table && (!current?.strip || stripMonths.length > 0) ? (
        <div className="anim-fade-up" style={{ animationDelay: '120ms' }} key={`${tab}-${selected}`}>
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
            accounts={data.options?.accounts ?? []}
            onPay={(t, account) => data.update(t, { status: 'Pago', ...(account ? { account } : {}) })}
          />
        </div>
      ) : current ? null : (
        <Breakdown items={stats.breakdown} budgets={isIncome ? null : budgets} isIncome={isIncome} monthName={monthName} />
      )}
    </div>
  );
}
