import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Sheet, Wallet, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTransactions } from '../hooks/useTransactions';
import { TYPES } from '../data/categories';
import { formatCurrency, monthKey, MONTH_NAMES, toISODate } from '../utils/format';
import { computeBalances } from '../../shared/accounts.js';
import SummaryCards from './SummaryCards';
import AnalyticsCharts from './AnalyticsCharts';
import TransactionTable from './TransactionTable';
import TransactionModal from './TransactionModal';
import AccountsPage from './AccountsPage';
import PlanningPage from './PlanningPage';
import MonthReview from './MonthReview';

// A meta é uma preferência pessoal de tela: fica no navegador, não na planilha.
const GOAL_KEY = 'financas:config:v1';
const isValidSettings = (v) =>
  v !== null && typeof v === 'object' && Number.isFinite(v.savingsGoal) && v.savingsGoal >= 0;

function ConnectionBadge({ status }) {
  if (!status) return null;
  if (status.demo) {
    return (
      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
        Modo demonstração
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-income/30 bg-income/10 px-2 py-0.5 text-[11px] font-medium text-income"
      title={status.spreadsheetTitle}
    >
      <Sheet className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{status.spreadsheetTitle}</span>
      {status.readOnly && <span className="text-amber-400">· somente leitura</span>}
    </span>
  );
}

export default function Dashboard() {
  const data = useTransactions();
  const { transactions, status, loading, saving, error } = data;
  const [settings, setSettings] = useLocalStorage(GOAL_KEY, { savingsGoal: 2000 }, isValidSettings);
  const [modal, setModal] = useState(null); // null | { transaction?: obj }
  const [view, setView] = useState('painel'); // 'painel' | 'contas' | 'planejamento'
  const hasAccounts = Boolean(status?.features?.accounts);
  const closeModal = useCallback(() => setModal(null), []);

  const readOnly = Boolean(status?.readOnly);
  const today = new Date();
  const [month, setMonth] = useState(() => monthKey(today)); // mês escolhido "AAAA-MM"
  const currentMonth = month;
  const monthDate = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [month]);
  const monthName = `${MONTH_NAMES[monthDate.getMonth()]} de ${monthDate.getFullYear()}`;
  const shiftMonth = (delta) => setMonth(monthKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1)));
  const isThisMonth = month === monthKey(today);

  const todayISO = toISODate(today);
  const summary = useMemo(() => {
    // Saldo de hoje: só o que já aconteceu (receitas até hoje, despesas pagas).
    // Lançamentos futuros (salários e contas dos próximos meses) não entram.
    const happened = transactions.filter((t) =>
      t.type === TYPES.INCOME ? t.date <= todayISO : t.status === 'Pago' || (!t.status && t.date <= todayISO),
    );
    const accounts = computeBalances(data.accounts, happened, data.transfers);
    let balance = 0;
    for (const t of happened) balance += t.type === TYPES.INCOME ? t.amount : -t.amount;
    let monthIncome = 0;
    let monthExpense = 0;
    let monthPending = 0;
    for (const t of transactions) {
      if (monthKey(t.date) !== currentMonth) continue;
      if (t.type === TYPES.INCOME) monthIncome += t.amount;
      else {
        monthExpense += t.amount;
        if (t.status && t.status !== 'Pago') monthPending += t.amount;
      }
    }
    const hasAccounts = data.accounts.length > 0;
    return {
      balance: hasAccounts ? accounts.total : balance,
      balanceHint: hasAccounts
        ? `Soma das suas ${data.accounts.length} contas hoje`
        : 'Receitas recebidas menos despesas pagas até hoje',
      accounts: accounts.accounts,
      monthIncome,
      monthExpense,
      monthPending,
      monthSaved: monthIncome - monthExpense,
    };
  }, [transactions, currentMonth, todayISO, data.accounts, data.transfers]);

  const saveFromModal = async (values) => {
    if (modal?.transaction) await data.update(modal.transaction, values);
    else await data.create(values);
  };

  const firstLoad = loading && !status && !error;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Wallet className="h-5 w-5 text-income" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="text-base font-semibold leading-tight sm:text-lg">Finanças Pessoais</h1>
                <span className="hidden sm:inline"><ConnectionBadge status={status} /></span>
              </div>
              <p className="text-xs text-muted-foreground">
                {MONTH_NAMES[today.getMonth()].replace(/^./, (c) => c.toUpperCase())} de {today.getFullYear()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={data.refresh}
              disabled={loading}
              className="btn-ghost px-2.5"
              aria-label="Recarregar dados da planilha"
              title="Recarregar dados da planilha"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setModal({})}
              disabled={readOnly || !status}
              className="btn-primary"
              title={readOnly ? 'Planilha em modo somente leitura' : undefined}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Nova transação</span>
              <span className="sm:hidden">Nova</span>
            </button>
          </div>
        </div>
        <div className="px-4 pb-2 sm:hidden"><ConnectionBadge status={status} /></div>
        {(
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label="Seções">
            {[['painel', 'Painel'], ...(hasAccounts ? [['contas', 'Contas']] : []), ['planejamento', 'Planejamento']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-current={view === id ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  view === id ? 'border-income text-zinc-100' : 'border-transparent text-muted-foreground hover:text-zinc-100'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-expense/40 bg-expense/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-expense" aria-hidden />
            <p className="flex-1 text-zinc-200">{error}</p>
            <button type="button" onClick={data.clearError} aria-label="Fechar aviso" className="text-zinc-400 hover:text-zinc-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {data.warnings.length > 0 && (
          <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            <summary className="cursor-pointer">
              {data.warnings.length} linha(s) da planilha foram ignoradas por terem data ou valor inválido.
            </summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-200/80">
              {data.warnings.slice(0, 20).map((w) => <li key={w}>{w}</li>)}
            </ul>
          </details>
        )}

        {firstLoad ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando dados da planilha…
          </div>
        ) : hasAccounts && view === 'contas' ? (
          <AccountsPage data={data} readOnly={readOnly || !status} />
        ) : view === 'planejamento' ? (
          <PlanningPage data={data} readOnly={readOnly || !status} canEditBudgets={hasAccounts} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="min-w-[150px] text-center text-sm font-semibold sm:text-base">{monthName.replace(/^./, (c) => c.toUpperCase())}</p>
                <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {!isThisMonth && (
                <button type="button" className="btn-ghost h-9 text-xs" onClick={() => setMonth(monthKey(today))}>
                  Voltar para o mês atual
                </button>
              )}
            </div>
            <SummaryCards
              monthName={monthName}
              summary={summary}
              goal={settings.savingsGoal}
              onGoalChange={(savingsGoal) => setSettings((prev) => ({ ...prev, savingsGoal }))}
            />
            {summary.accounts.length > 0 && (
              <section aria-label="Onde está o dinheiro" className="card p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold">Onde está o dinheiro</h2>
                  {hasAccounts && (
                    <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-zinc-100 hover:underline" onClick={() => setView('contas')}>
                      Ver contas
                    </button>
                  )}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {summary.accounts.map((a) => (
                    <li key={a.row} className="rounded-lg border border-border p-3">
                      <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                      <p className={`mt-1 font-semibold tabular-nums ${a.balance < 0 ? 'text-expense' : 'text-zinc-100'}`}>{formatCurrency(a.balance)}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{a.kind}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <MonthReview transactions={transactions} month={month} monthName={monthName} />
            <AnalyticsCharts transactions={transactions} today={monthDate} />
            <TransactionTable
              month={month}
              monthName={monthName}
              transactions={transactions}
              readOnly={readOnly || !status}
              busy={saving}
              onUpdate={data.update}
              onDelete={data.remove}
              onEdit={(transaction) => setModal({ transaction })}
            />
          </>
        )}

        <p className="pb-4 text-center text-xs text-muted-foreground">
          {status?.demo
            ? 'Modo demonstração: as alterações ficam só na memória do servidor. Configure o .env para usar sua planilha.'
            : status?.mode === 'google-apps-script'
              ? 'Os dados vêm direto da sua planilha do Google. Só você tem acesso a este link.'
              : 'Os dados vêm direto da sua planilha do Google. As credenciais ficam só no servidor (.env).'}
        </p>
      </main>

      <TransactionModal
        open={modal !== null}
        initial={modal?.transaction}
        options={data.options}
        onClose={closeModal}
        onSave={saveFromModal}
      />
    </div>
  );
}
