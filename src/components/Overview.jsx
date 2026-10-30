import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownCircle, ArrowRight, ArrowUpCircle, CalendarClock, Check, CircleAlert, Landmark, Pencil, Target, X,
} from 'lucide-react';
import { TYPES, groupColor } from '../data/categories';
import { formatCurrency, formatDate, toISODate } from '../utils/format';
import { useCountUp } from '../hooks/useCountUp';
import AnalyticsCharts from './AnalyticsCharts';
import MonthReview from './MonthReview';

function Money({ value, className = '' }) {
  const shown = useCountUp(value);
  return <span className={`tabular-nums ${className}`}>{formatCurrency(shown)}</span>;
}

function Count({ value }) {
  const shown = useCountUp(value, 600);
  return <>{Math.round(shown)}</>;
}

const TONES = {
  income: { glow: 'rgba(34,197,94,0.45)', text: 'text-income', bg: 'from-emerald-500/20', ring: 'bg-emerald-500/10 text-emerald-300', bar: 'bg-emerald-400' },
  expense: { glow: 'rgba(239,68,68,0.45)', text: 'text-expense', bg: 'from-rose-500/20', ring: 'bg-rose-500/10 text-rose-300', bar: 'bg-rose-400' },
  sky: { glow: 'rgba(56,189,248,0.45)', text: 'text-sky-400', bg: 'from-sky-500/20', ring: 'bg-sky-500/10 text-sky-300', bar: 'bg-sky-400' },
  amber: { glow: 'rgba(251,191,36,0.45)', text: 'text-amber-400', bg: 'from-amber-500/20', ring: 'bg-amber-500/10 text-amber-300', bar: 'bg-amber-400' },
};

/** Quadrado grande que leva direto para uma área. */
function ModuleTile({ icon: Icon, tone, title, subtitle, value, valueLabel, onClick, delay }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ '--glow': t.glow, animationDelay: `${delay}ms` }}
      className={`anim-fade-up anim-shine group relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br ${t.bg} via-card to-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:glow-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`anim-float flex h-14 w-14 items-center justify-center rounded-2xl ${t.ring} ring-1 ring-white/10`} style={{ animationDelay: `${delay * 2}ms` }}>
          <Icon className="h-7 w-7" aria-hidden />
        </span>
        <span className="text-right">
          <span className="block text-2xl font-semibold tabular-nums text-zinc-50">{value}</span>
          {valueLabel && <span className="block text-[11px] text-zinc-400">{valueLabel}</span>}
        </span>
      </div>
      <div className="mt-auto pt-4">
        <p className="flex items-center gap-1.5 font-semibold text-zinc-50">
          {title}
          <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </p>
        <p className="truncate text-xs text-zinc-400">{subtitle}</p>
      </div>
    </button>
  );
}

function Indicator({ label, children, hint, bar, tone, delay, onClick }) {
  const t = TONES[tone] ?? {};
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="anim-fade-up relative min-w-0 p-4 text-left transition-colors hover:bg-white/[0.02]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${t.bar ?? 'bg-zinc-600'} anim-grow-x`} style={{ animationDelay: `${delay + 150}ms` }} aria-hidden />
      <p className="text-xs text-zinc-400">{label}</p>
      <div className={`mt-1 text-lg font-semibold sm:text-xl ${t.text ?? 'text-zinc-50'}`}>{children}</div>
      {bar != null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className={`h-full rounded-full ${t.bar ?? 'bg-zinc-400'} transition-[width] duration-700`} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      )}
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
    </Tag>
  );
}

function GoalIndicator({ saved, goal, onGoalChange, delay }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const percent = goal > 0 ? (saved / goal) * 100 : 0;
  if (editing) {
    return (
      <form
        className="relative p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(draft.replace(/\./g, '').replace(',', '.'));
          if (Number.isFinite(v) && v >= 0) onGoalChange(Math.round(v * 100) / 100);
          setEditing(false);
        }}
      >
        <label htmlFor="goal-input" className="text-xs text-zinc-400">Meta de economia do mês</label>
        <div className="mt-1 flex gap-1">
          <input id="goal-input" autoFocus inputMode="decimal" className="input h-8 px-2" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="btn-ghost h-8 px-2" aria-label="Salvar meta"><Check className="h-4 w-4" /></button>
          <button type="button" className="btn-ghost h-8 px-2" aria-label="Cancelar" onClick={() => setEditing(false)}><X className="h-4 w-4" /></button>
        </div>
      </form>
    );
  }
  return (
    <div className="relative">
      <Indicator
        label="Meta de economia"
        tone="amber"
        delay={delay}
        bar={percent}
        hint={saved >= 0 ? `${Math.round(percent)}% de ${formatCurrency(goal)}` : 'Gastou mais do que entrou'}
      >
        <Money value={Math.max(0, saved)} />
      </Indicator>
      <button
        type="button"
        className="absolute right-2 top-3 rounded-md p-1.5 text-zinc-500 hover:text-zinc-100"
        aria-label="Editar meta"
        title="Editar meta"
        onClick={() => {
          setDraft(String(goal).replace('.', ','));
          setEditing(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Panel({ title, subtitle, action, children, delay = 0, className = '' }) {
  return (
    <section className={`card anim-fade-up overflow-hidden ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BarList({ rows, emptyText, colorOf }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <p className="px-5 pb-5 text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-3 px-5 pb-5">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-zinc-300">{r.name}</span>
            <span className="shrink-0 tabular-nums text-zinc-100">{formatCurrency(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="anim-grow-x h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: colorOf(r, i), animationDelay: `${i * 60}ms` }}
            />
          </div>
          {r.note && <p className={`mt-0.5 text-[11px] ${r.over ? 'text-expense' : 'text-zinc-500'}`}>{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Página inicial: atalhos grandes, indicadores, alertas e gráficos. */
export default function Overview({ data, summary, month, monthName, monthDate, goal, onGoalChange, navigate }) {
  const { transactions, budgets } = data;
  const todayISO = toISODate(new Date());

  const info = useMemo(() => {
    const inMonth = transactions.filter((t) => t.date.startsWith(month));
    const incomes = inMonth.filter((t) => t.type === TYPES.INCOME);
    const expenses = inMonth.filter((t) => t.type === TYPES.EXPENSE);
    const unpaid = transactions.filter((t) => t.type === TYPES.EXPENSE && t.status && t.status !== 'Pago');
    const overdue = unpaid.filter((t) => t.date < todayISO);
    const in7 = toISODate(new Date(Date.now() + 7 * 864e5));
    const soon = unpaid.filter((t) => t.date >= todayISO && t.date <= in7);
    const byCategory = new Map();
    for (const t of incomes) byCategory.set(t.category || 'Outras', (byCategory.get(t.category || 'Outras') ?? 0) + t.amount);
    const byGroup = new Map();
    for (const t of expenses) byGroup.set(t.group || 'Outras', (byGroup.get(t.group || 'Outras') ?? 0) + t.amount);
    const groups = [...byGroup].map(([name, value]) => {
      const limit = budgets?.[name];
      return { name, value, over: limit && value > limit, note: limit ? `${Math.round((value / limit) * 100)}% do limite de ${formatCurrency(limit)}` : null };
    }).sort((a, b) => b.value - a.value);
    const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
    return {
      incomeCount: incomes.length,
      expenseCount: expenses.length,
      paid: sum(expenses.filter((t) => t.status === 'Pago' || !t.status)),
      unpaidCount: unpaid.length,
      overdue, soon,
      overdueSum: sum(overdue),
      soonSum: sum(soon),
      categories: [...byCategory].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      groups,
    };
  }, [transactions, month, todayISO, budgets]);

  const attention = [
    info.overdue.length > 0 && {
      icon: CircleAlert, tone: 'text-expense', tag: 'Urgente',
      title: `${info.overdue.length} ${info.overdue.length === 1 ? 'conta vencida' : 'contas vencidas'} · ${formatCurrency(info.overdueSum)}`,
      detail: info.overdue.slice(0, 3).map((t) => `${t.description || t.category} (${formatDate(t.date).slice(0, 5)})`).join(' · '),
      go: () => navigate('despesas', 'apagar'),
    },
    info.soon.length > 0 && {
      icon: CalendarClock, tone: 'text-amber-400', tag: 'Atenção',
      title: `${info.soon.length} ${info.soon.length === 1 ? 'conta vence' : 'contas vencem'} nos próximos 7 dias · ${formatCurrency(info.soonSum)}`,
      detail: info.soon.slice(0, 3).map((t) => `${t.description || t.category} (${formatDate(t.date).slice(0, 5)})`).join(' · '),
      go: () => navigate('despesas', 'apagar'),
    },
    ...info.groups.filter((g) => g.over).map((g) => ({
      icon: AlertTriangle, tone: 'text-amber-400', tag: 'Limite',
      title: `${g.name} passou do limite`, detail: g.note, go: () => navigate('despesas', 'grupos'),
    })),
    ...summary.accounts.filter((a) => a.balance < 0).map((a) => ({
      icon: AlertTriangle, tone: 'text-expense', tag: 'Conta',
      title: `${a.name} está negativa`, detail: formatCurrency(a.balance), go: () => navigate('contas', 'saldos'),
    })),
  ].filter(Boolean);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const maxAcc = Math.max(...summary.accounts.map((a) => Math.abs(a.balance)), 1);
  const paidPct = summary.monthExpense > 0 ? (info.paid / summary.monthExpense) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{hello}!</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Você tem <span className="font-medium text-zinc-100">{formatCurrency(summary.balance)}</span> nas contas
          {summary.monthPending > 0 && (
            <> e <span className="font-medium text-amber-300">{formatCurrency(summary.monthPending)}</span> a pagar em {monthName}</>
          )}
          .
        </p>
      </div>

      <section aria-label="Atalhos">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Ir para</h3>
          <span className="text-[11px] text-zinc-500">Toque em um quadrado para abrir</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <ModuleTile icon={ArrowUpCircle} tone="income" title="Receitas" delay={0}
            value={<Count value={info.incomeCount} />} valueLabel={`em ${monthName.split(' ')[0]}`}
            subtitle={`${formatCurrency(summary.monthIncome)} no mês`} onClick={() => navigate('receitas', 'mes')} />
          <ModuleTile icon={ArrowDownCircle} tone="expense" title="Despesas" delay={70}
            value={<Count value={info.expenseCount} />} valueLabel={`em ${monthName.split(' ')[0]}`}
            subtitle={`${info.unpaidCount} a pagar no total`} onClick={() => navigate('despesas', 'mes')} />
          <ModuleTile icon={Landmark} tone="sky" title="Contas" delay={140}
            value={<Count value={summary.accounts.length} />} valueLabel="contas"
            subtitle={`${formatCurrency(summary.balance)} guardados`} onClick={() => navigate('contas', 'saldos')} />
          <ModuleTile icon={Target} tone="amber" title="Planejamento" delay={210}
            value={<Count value={attention.length} />} valueLabel={attention.length === 1 ? 'alerta' : 'alertas'}
            subtitle="Contas a pagar, limites e metas" onClick={() => navigate('planejamento')} />
        </div>
      </section>

      <section aria-label={`Indicadores de ${monthName}`}>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-zinc-300">Indicadores de {monthName}</h3>
          <span className="hidden text-[11px] text-zinc-500 sm:inline">Clique para abrir os detalhes</span>
        </div>
        <div className="card grid grid-cols-2 divide-white/[0.06] overflow-hidden sm:grid-cols-3 xl:grid-cols-5 [&>*]:border-white/[0.06] [&>*]:border-b xl:[&>*]:border-b-0 xl:[&>*]:border-r">
          <Indicator label="Saldo nas contas" tone="sky" delay={0} hint={summary.balanceHint} onClick={() => navigate('contas', 'saldos')}>
            <Money value={summary.balance} />
          </Indicator>
          <Indicator label="Receitas" tone="income" delay={60} hint={`${info.incomeCount} lançamentos`} onClick={() => navigate('receitas', 'mes')}>
            <Money value={summary.monthIncome} />
          </Indicator>
          <Indicator label="Despesas" tone="expense" delay={120} bar={paidPct} hint={`${Math.round(paidPct)}% já pago`} onClick={() => navigate('despesas', 'mes')}>
            <Money value={summary.monthExpense} />
          </Indicator>
          <Indicator label="A pagar no mês" tone="amber" delay={180}
            hint={info.overdue.length ? `${info.overdue.length} vencida(s) no total` : 'Nenhuma vencida'} onClick={() => navigate('despesas', 'apagar')}>
            <Money value={summary.monthPending} />
          </Indicator>
          <GoalIndicator saved={summary.monthSaved} goal={goal} onGoalChange={onGoalChange} delay={240} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          delay={100}
          title={<span className="flex items-center gap-2">Requer atenção {attention.length > 0 && <span className="rounded-full bg-expense/15 px-1.5 text-xs text-expense">{attention.length}</span>}</span>}
          subtitle="O que precisa de você agora, do mais urgente para o menos."
        >
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 px-5 pb-5 text-sm text-zinc-400">
              <Check className="h-4 w-4 text-income" aria-hidden /> Tudo em dia. Nenhuma conta vencida ou limite estourado.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {attention.map((a, i) => (
                <li key={i}>
                  <button type="button" onClick={a.go} className="group flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02]">
                    <a.icon className={`h-4 w-4 shrink-0 ${a.tone}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">{a.title}</span>
                      {a.detail && <span className="block truncate text-xs text-zinc-500">{a.detail}</span>}
                    </span>
                    <span className={`hidden text-xs font-medium sm:inline ${a.tone}`}>{a.tag}</span>
                    <ArrowRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          delay={160}
          title="Onde está o dinheiro"
          subtitle="Saldo de hoje em cada conta"
          action={<button type="button" className="text-xs text-sky-400 hover:underline" onClick={() => navigate('contas', 'saldos')}>Abrir contas</button>}
        >
          {summary.accounts.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Cadastre suas contas para ver os saldos aqui.</p>
          ) : (
            <ul className="space-y-3 px-5 pb-5">
              {summary.accounts.map((a, i) => (
                <li key={a.row}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-zinc-300">{a.name}</span>
                    <span className={`shrink-0 font-medium tabular-nums ${a.balance < 0 ? 'text-expense' : 'text-zinc-50'}`}>{formatCurrency(a.balance)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className={`anim-grow-x h-full rounded-full ${a.balance < 0 ? 'bg-expense' : 'bg-gradient-to-r from-sky-500 to-cyan-300'}`}
                      style={{ width: `${(Math.abs(a.balance) / maxAcc) * 100}%`, animationDelay: `${i * 80}ms` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="anim-fade-up" style={{ animationDelay: '200ms' }}>
        <AnalyticsCharts transactions={transactions} today={monthDate} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel delay={240} title="Receitas por tipo" subtitle={`De onde veio o dinheiro em ${monthName}`}
          action={<button type="button" className="text-xs text-income hover:underline" onClick={() => navigate('receitas', 'categorias')}>Ver mais</button>}>
          <BarList rows={info.categories} emptyText="Nenhuma receita neste mês." colorOf={() => '#22c55e'} />
        </Panel>
        <Panel delay={300} title="Despesas por grupo" subtitle={`Para onde foi o dinheiro em ${monthName}`}
          action={<button type="button" className="text-xs text-expense hover:underline" onClick={() => navigate('despesas', 'grupos')}>Ver mais</button>}>
          <BarList rows={info.groups} emptyText="Nenhuma despesa neste mês." colorOf={(r, i) => groupColor(r.name, i)} />
        </Panel>
      </div>

      <div className="anim-fade-up" style={{ animationDelay: '320ms' }}>
        <MonthReview transactions={transactions} month={month} monthName={monthName} />
      </div>
    </div>
  );
}
