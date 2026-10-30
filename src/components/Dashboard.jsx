import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Menu, Plus, RefreshCw, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTransactions } from '../hooks/useTransactions';
import { TYPES } from '../data/categories';
import { formatCurrency, monthKey, MONTH_NAMES, toISODate } from '../utils/format';
import { computeBalances } from '../../shared/accounts.js';
import TransactionModal from './TransactionModal';
import AccountsPage from './AccountsPage';
import PlanningPage from './PlanningPage';
import Overview from './Overview';
import MovementsPage from './MovementsPage';
import Sidebar, { PAGES } from './Sidebar';
import { LogoMark } from './Logo';

// A meta é uma preferência pessoal de tela: fica no navegador, não na planilha.
const GOAL_KEY = 'financas:config:v1';
const ROUTE_KEY = 'financas:rota:v1';
const isValidRoute = (v) =>
  v !== null && typeof v === 'object' && Object.prototype.hasOwnProperty.call(PAGES, v.page) &&
  (!PAGES[v.page].tabs || PAGES[v.page].tabs.some(([k]) => k === v.tab));
const isValidSettings = (v) =>
  v !== null && typeof v === 'object' && Number.isFinite(v.savingsGoal) && v.savingsGoal >= 0;

export default function Dashboard() {
  const data = useTransactions();
  const { transactions, status, loading, saving, error } = data;
  const [settings, setSettings] = useLocalStorage(GOAL_KEY, { savingsGoal: 2000 }, isValidSettings);
  const [modal, setModal] = useState(null); // null | { transaction?: obj, type?: string }
  const [route, setRoute] = useLocalStorage(ROUTE_KEY, { page: 'visao' }, isValidRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useCallback((page, tab) => {
    setRoute({ page, ...(tab ? { tab } : PAGES[page].tabs ? { tab: PAGES[page].tabs[0][0] } : {}) });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [setRoute]);
  const hasAccounts = Boolean(status?.features?.accounts);
  const closeModal = useCallback(() => setModal(null), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const readOnly = Boolean(status?.readOnly);
  const today = new Date();
  const [month, setMonth] = useState(() => monthKey(today)); // mês escolhido "AAAA-MM"
  // O salário do fim do mês paga o mês seguinte: se o mês atual está vazio e o
  // próximo já tem lançamentos, o painel abre no próximo.
  const pickedStart = useRef(false);
  useEffect(() => {
    if (pickedStart.current || !transactions.length) return;
    pickedStart.current = true;
    const now = monthKey(new Date());
    const d = new Date();
    const next = monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    const has = (key) => transactions.some((t) => t.date.startsWith(key));
    if (!has(now) && has(next)) setMonth(next);
  }, [transactions]);
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
  const page = hasAccounts || route.page !== 'contas' ? route.page : 'visao';
  const info = PAGES[page];
  const showMonth = page === 'visao' || page === 'receitas' || page === 'despesas';
  const action = {
    visao: { label: 'Novo lançamento', short: 'Novo', type: TYPES.EXPENSE },
    receitas: { label: 'Nova receita', short: 'Receita', type: TYPES.INCOME },
    despesas: { label: 'Nova despesa', short: 'Despesa', type: TYPES.EXPENSE },
  }[page];

  const unpaid = transactions.filter((t) => t.type === TYPES.EXPENSE && t.status && t.status !== 'Pago').length;
  const pages = Object.fromEntries(Object.entries(PAGES).filter(([id]) => id !== 'contas' || hasAccounts));
  const hints = {
    visao: 'Indicadores e atalhos',
    receitas: `${formatCurrency(summary.monthIncome)} em ${MONTH_NAMES[monthDate.getMonth()].slice(0, 3)}`,
    despesas: `${formatCurrency(summary.monthExpense)} em ${MONTH_NAMES[monthDate.getMonth()].slice(0, 3)}`,
    contas: `${formatCurrency(summary.balance)} no total`,
    planejamento: 'Previsão, limites e cartões',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        pages={pages}
        route={{ page, tab: route.tab }}
        onNavigate={navigate}
        open={menuOpen}
        onClose={closeMenu}
        hints={hints}
        badges={{ despesas: unpaid, contas: data.accounts.length }}
        spreadsheetTitle={status?.demo ? 'Modo demonstração' : status?.spreadsheetTitle}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
            <button type="button" className="btn-ghost -ml-2 h-9 w-9 p-0 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <LogoMark className="h-8 w-8 shrink-0 lg:hidden" animated={false} />
            <div className="min-w-0 flex-1">
              <p className="hidden truncate text-[11px] text-zinc-500 sm:block">
                {info.section ? `Visão geral / ${info.section}` : 'Início'}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{info.label}</h1>
                {status && !status.demo && (
                  <span className="hidden items-center gap-1 rounded-full border border-income/25 bg-income/10 px-2 py-0.5 text-[11px] text-income md:inline-flex" title={status.spreadsheetTitle}>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-income" aria-hidden /> planilha conectada
                    {status.readOnly && <span className="text-amber-400"> · somente leitura</span>}
                  </span>
                )}
                {status?.demo && <span className="hidden rounded-full border border-amber-500/30 sm:inline bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">demonstração</span>}
              </div>
            </div>

            {showMonth && (
              <div className="hidden items-center rounded-lg border border-white/[0.08] bg-white/[0.02] md:flex">
                <button type="button" className="h-9 w-9 rounded-l-lg text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
                  <ChevronLeft className="mx-auto h-4 w-4" />
                </button>
                <button type="button" className="min-w-[130px] px-2 text-sm font-medium" onClick={() => setMonth(monthKey(today))} title="Voltar para o mês atual">
                  {monthName.replace(/^./, (c) => c.toUpperCase())}
                </button>
                <button type="button" className="h-9 w-9 rounded-r-lg text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
                  <ChevronRight className="mx-auto h-4 w-4" />
                </button>
              </div>
            )}
            <button type="button" onClick={data.refresh} disabled={loading} className="btn-ghost h-9 w-9 p-0" aria-label="Recarregar dados da planilha" title="Recarregar dados da planilha">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
            {action && (
              <button
                type="button"
                onClick={() => setModal({ type: action.type })}
                disabled={readOnly || !status}
                className="btn-primary h-9 px-3"
                title={readOnly ? 'Planilha em modo somente leitura' : undefined}
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{action.label}</span>
                <span className="sm:hidden">{action.short}</span>
              </button>
            )}
          </div>

          {showMonth && (
            <div className="flex items-center justify-between gap-2 px-4 pb-2 md:hidden">
              <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => shiftMonth(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" className="text-sm font-medium" onClick={() => setMonth(monthKey(today))}>
                {monthName.replace(/^./, (c) => c.toUpperCase())}
                {!isThisMonth && <span className="ml-1 text-[11px] text-zinc-500">(voltar ao atual)</span>}
              </button>
              <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={() => shiftMonth(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}

          {info.tabs && (
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6" aria-label={`Abas de ${info.label}`}>
              {info.tabs.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigate(page, key)}
                  aria-current={route.tab === key ? 'page' : undefined}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    route.tab === key ? 'border-emerald-400 text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {label}
                  {key === 'apagar' && unpaid > 0 && <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 text-[11px] text-amber-300">{unpaid}</span>}
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
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-sm text-muted-foreground">
              <LogoMark className="h-14 w-14" />
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando dados da planilha…</span>
            </div>
          ) : (
            <div key={page} className="anim-fade">
              {page === 'visao' && (
                <Overview
                  data={data}
                  summary={summary}
                  month={month}
                  monthName={monthName}
                  monthDate={monthDate}
                  goal={settings.savingsGoal}
                  onGoalChange={(savingsGoal) => setSettings((prev) => ({ ...prev, savingsGoal }))}
                  navigate={navigate}
                />
              )}
              {(page === 'receitas' || page === 'despesas') && (
                <MovementsPage
                  type={page === 'receitas' ? TYPES.INCOME : TYPES.EXPENSE}
                  tab={route.tab}
                  data={data}
                  month={month}
                  monthName={monthName}
                  readOnly={readOnly || !status}
                  onEdit={(transaction) => setModal({ transaction })}
                />
              )}
              {page === 'contas' && <AccountsPage data={data} readOnly={readOnly || !status} tab={route.tab} />}
              {page === 'planejamento' && <PlanningPage data={data} readOnly={readOnly || !status} canEditBudgets={hasAccounts} startBalance={summary.balance} navigate={navigate} />}
            </div>
          )}

          <p className="pb-4 text-center text-xs text-muted-foreground">
            {status?.demo
              ? 'Modo demonstração: as alterações ficam só na memória do servidor.'
              : 'Os dados vêm direto da sua planilha do Google. Só você tem acesso a este link.'}
          </p>
        </main>
      </div>

      <TransactionModal
        open={modal !== null}
        initial={modal?.transaction}
        defaultType={modal?.type}
        options={data.options}
        onClose={closeModal}
        onSave={saveFromModal}
      />
    </div>
  );
}
