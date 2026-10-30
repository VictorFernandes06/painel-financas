import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Check, Pencil, PiggyBank, Scale, X } from 'lucide-react';
import { formatCurrency } from '../utils/format';

function KpiCard({ title, value, icon: Icon, tone, hint, children }) {
  const tones = {
    income: 'text-income',
    expense: 'text-expense',
    neutral: 'text-zinc-100',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className={`h-5 w-5 ${tones[tone] ?? tones.neutral}`} aria-hidden />
      </div>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${tones[tone] ?? tones.neutral}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function GoalCard({ saved, goal, onGoalChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));

  const percent = goal > 0 ? Math.max(0, Math.min(100, (saved / goal) * 100)) : 0;
  const reached = goal > 0 && saved >= goal;

  const save = () => {
    const value = Number(String(draft).replace(',', '.'));
    if (Number.isFinite(value) && value >= 0) onGoalChange(Math.round(value * 100) / 100);
    setEditing(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Meta de economia mensal</p>
        <PiggyBank className="h-5 w-5 text-emerald-400" aria-hidden />
      </div>

      {editing ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            inputMode="decimal"
            aria-label="Valor da meta"
            className="input h-9"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn-ghost h-9 px-2" aria-label="Salvar meta">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost h-9 px-2" aria-label="Cancelar" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight">{formatCurrency(goal)}</p>
          <button
            type="button"
            className="text-muted-foreground hover:text-zinc-100"
            aria-label="Editar meta"
            onClick={() => {
              setDraft(String(goal));
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Progresso da meta"
      >
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-income' : 'bg-emerald-500/80'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {saved >= 0 ? `Poupado: ${formatCurrency(saved)}` : `Gasto acima da receita: ${formatCurrency(-saved)}`}
        {' · '}
        {Math.round(percent)}%{reached && ' · Meta atingida!'}
      </p>
    </div>
  );
}

export default function SummaryCards({ summary, goal, onGoalChange, monthName = 'mês corrente' }) {
  const { balance, balanceHint, monthIncome, monthExpense, monthPending = 0, monthSaved } = summary;
  return (
    <section aria-label="Resumo" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Saldo atual"
        value={formatCurrency(balance)}
        icon={Scale}
        tone={balance >= 0 ? 'income' : 'expense'}
        hint={balanceHint}
      />
      <KpiCard
        title="Receitas do mês"
        value={formatCurrency(monthIncome)}
        icon={ArrowUpCircle}
        tone="income"
        hint={`Entradas em ${monthName}`}
      />
      <KpiCard
        title="Despesas do mês"
        value={formatCurrency(monthExpense)}
        icon={ArrowDownCircle}
        tone="expense"
        hint={monthPending > 0 ? `${formatCurrency(monthExpense - monthPending)} pagos · ${formatCurrency(monthPending)} a pagar` : `Saídas em ${monthName}`}
      />
      <GoalCard saved={monthSaved} goal={goal} onGoalChange={onGoalChange} />
    </section>
  );
}
