import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TYPES, groupColor } from '../data/categories';
import { formatCompact, formatCurrency, monthKey, monthLabel } from '../utils/format';

const MONTHS_SHOWN = 6;

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-zinc-950 px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium text-zinc-200">{label}</p>}
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2 text-zinc-300">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color ?? item.payload?.fill }} />
          {item.name}: <span className="font-medium text-zinc-100">{formatCurrency(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsCharts({ transactions, today }) {
  const [period, setPeriod] = useState('month');
  const currentMonth = monthKey(today);

  const monthly = useMemo(() => {
    const keys = [];
    for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
      keys.push(monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)));
    }
    const map = Object.fromEntries(keys.map((k) => [k, { mes: monthLabel(k), Receitas: 0, Despesas: 0 }]));
    for (const t of transactions) {
      const row = map[monthKey(t.date)];
      if (!row) continue;
      if (t.type === TYPES.INCOME) row.Receitas += t.amount;
      else row.Despesas += t.amount;
    }
    return keys.map((k) => map[k]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, currentMonth]);

  // Despesas por Grupo (Moradia, Alimentação...), como na aba Despesas da planilha.
  const byCategory = useMemo(() => {
    const totals = new Map();
    for (const t of transactions) {
      if (t.type !== TYPES.EXPENSE) continue;
      if (period === 'month' && monthKey(t.date) !== currentMonth) continue;
      const group = t.group || 'Outras';
      totals.set(group, (totals.get(group) ?? 0) + t.amount);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: groupColor(name, i) }));
  }, [transactions, period, currentMonth]);

  const totalExpenses = byCategory.reduce((sum, d) => sum + d.value, 0);

  return (
    <section aria-label="Análises" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="card p-5 lg:col-span-3">
        <h2 className="text-base font-semibold">Evolução mensal</h2>
        <p className="text-sm text-muted-foreground">Entradas vs. saídas nos últimos {MONTHS_SHOWN} meses</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="mes" stroke="#71717a" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                stroke="#71717a"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickFormatter={formatCompact}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Despesas por grupo</h2>
            <p className="text-sm text-muted-foreground">Total: {formatCurrency(totalExpenses)}</p>
          </div>
          <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Período">
            {[
              ['month', 'No mês'],
              ['all', 'Tudo'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  period === value ? 'bg-muted text-zinc-100' : 'text-muted-foreground hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-72">
          {byCategory.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhuma despesa no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {byCategory.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
