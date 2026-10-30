import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Check, CheckCircle2, Clock, Flag, Loader2, Maximize2, Pencil, Search, Trash2, TriangleAlert, X } from 'lucide-react';
import { STATUSES, TYPES } from '../data/categories';
import { formatCurrency, formatDate, monthLabel, parseAmountInput, toISODate } from '../utils/format';

const FILTERS = [
  { value: 'all', label: 'Ver todas' },
  { value: TYPES.INCOME, label: 'Apenas receitas' },
  { value: TYPES.EXPENSE, label: 'Apenas despesas' },
];

function TypeBadge({ type }) {
  const income = type === TYPES.INCOME;
  const Icon = income ? ArrowUpCircle : ArrowDownCircle;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        income ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {income ? 'Receita' : 'Despesa'}
    </span>
  );
}

function DeleteButton({ onConfirm, description, disabled }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            try {
              await onConfirm();
            } catch {
              setDeleting(false);
              setConfirming(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-md bg-expense/15 px-2 py-1 text-xs font-medium text-expense hover:bg-expense/25 disabled:opacity-60"
        >
          {deleting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          Excluir
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => setConfirming(false)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-zinc-100"
        >
          Cancelar
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setConfirming(true)}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-expense/10 hover:text-expense disabled:opacity-40"
      aria-label={`Excluir ${description}`}
      title="Excluir linha da planilha"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

const STATUS_STYLE = {
  Pago: 'text-emerald-300',
  'A Pagar': 'text-amber-400',
  Atrasado: 'text-expense',
};

/** Selo de status: "Pago" em verde neon, bem visível. */
function StatusPill({ status, overdue, auto }) {
  if (!status) return null;
  if (status === 'Pago') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/50"
        title={auto ? 'Débito automático: baixa feita sozinha no dia' : undefined}>
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Pago{auto && <span className="font-normal text-emerald-200/80">· automático</span>}
      </span>
    );
  }
  const late = status === 'Atrasado' || overdue;
  const Icon = late ? TriangleAlert : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
      late ? 'bg-expense/10 text-expense ring-expense/40' : 'bg-amber-500/10 text-amber-300 ring-amber-400/30'
    }`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {late ? 'Atrasado' : 'A pagar'}
    </span>
  );
}

/** Bandeira "marcar como pago": escolhe de qual conta saiu o dinheiro e confirma. */
function PayFlag({ transaction, accounts = [], onPay, disabled }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(transaction.account || '');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-0.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 hover:shadow-[0_0_12px_rgba(52,211,153,0.35)] disabled:opacity-40"
        title="Marcar como pago"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> Marcar pago
      </button>
    );
  }
  const confirm = async () => {
    setBusy(true);
    try {
      await onPay(transaction, account);
    } catch {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {accounts.length > 0 && (
        <select
          aria-label="Saiu de qual conta"
          className="input h-7 w-36 px-2 py-0 text-xs"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          autoFocus
        >
          <option value="">Saiu de qual conta?</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      <button type="button" onClick={confirm} disabled={busy}
        className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500/20 px-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Pago
      </button>
      <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-md p-1 text-muted-foreground hover:text-zinc-100" aria-label="Cancelar">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Selo da receita: "Recebido" em verde (com a data, se veio antes) ou "A receber". */
function IncomePill({ transaction, today }) {
  const got = (transaction.receivedAt || transaction.date) <= today;
  if (got) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/50">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Recebido
        {transaction.receivedAt && transaction.receivedAt !== transaction.date && (
          <span className="font-normal text-emerald-200/80">em {formatDate(transaction.receivedAt).slice(0, 5)}</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
      <Clock className="h-3.5 w-3.5" aria-hidden /> A receber
    </span>
  );
}

/** Bandeira "marcar recebido": data em que caiu (pode ser antecipado) e conta. */
function ReceiveFlag({ transaction, accounts = [], onReceive, disabled, today }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [account, setAccount] = useState(transaction.account || '');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-0.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15 hover:shadow-[0_0_12px_rgba(52,211,153,0.35)] disabled:opacity-40"
        title="Marcar como recebido (inclusive antecipado)"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden /> Marcar recebido
      </button>
    );
  }
  const confirm = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setBusy(true);
    try {
      await onReceive(transaction, { date, account });
    } catch {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input type="date" aria-label="Recebido em" className="input h-7 w-36 px-2 py-0 text-xs [color-scheme:dark]" value={date} onChange={(e) => setDate(e.target.value)} />
      {accounts.length > 0 && (
        <select aria-label="Caiu em qual conta" className="input h-7 w-36 px-2 py-0 text-xs" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="">Caiu em qual conta?</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      <button type="button" onClick={confirm} disabled={busy}
        className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500/20 px-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Recebido
      </button>
      <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-md p-1 text-muted-foreground hover:text-zinc-100" aria-label="Cancelar">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Título e categoria exibidos de cada lançamento. */
const titleOf = (t) => t.description || t.category;
const categoryOf = (t) => (t.type === TYPES.EXPENSE ? `${t.group} › ${t.category}` : t.category);
const installmentOf = (t) => (t.installments > 1 ? ` · ${t.installment}/${t.installments}` : '');

/** Linha em modo de edição (desktop): data, descrição, valor e status. */
function EditableRow({ transaction, onCancel, onSave, onOpenForm }) {
  const [draft, setDraft] = useState({
    date: transaction.date,
    description: transaction.description,
    amount: String(transaction.amount).replace('.', ','),
    status: transaction.status,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const isExpense = transaction.type === TYPES.EXPENSE;
  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  const save = async () => {
    const amount = parseAmountInput(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError('Valor inválido.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date < '2025-05-02') return setError('Data inválida (mínimo 02/05/2025).');
    setSaving(true);
    setError(null);
    const changes = { date: draft.date, description: draft.description.trim(), amount: Math.round(amount * 100) / 100 };
    if (isExpense) changes.status = draft.status;
    try {
      await onSave(changes);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') onCancel();
  };

  const cell = 'input h-8 px-2 py-1 text-sm';
  return (
    <>
      <tr className="border-b border-border/60 bg-muted/40" onKeyDown={onKeyDown}>
        <td className="px-3 py-2">
          <input type="date" min="2025-05-02" aria-label="Data" className={`${cell} [color-scheme:dark]`} value={draft.date} onChange={set('date')} />
        </td>
        <td className="px-3 py-2">
          <input aria-label="Descrição" className={cell} maxLength={120} placeholder={transaction.category} value={draft.description} onChange={set('description')} autoFocus />
        </td>
        <td className="px-5 py-2 text-xs text-zinc-400">{categoryOf(transaction)}</td>
        <td className="px-3 py-2">
          {isExpense ? (
            <select aria-label="Status" className={cell} value={draft.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <TypeBadge type={transaction.type} />
          )}
        </td>
        <td className="px-3 py-2">
          <input aria-label="Valor" inputMode="decimal" className={`${cell} text-right`} value={draft.amount} onChange={set('amount')} />
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <button type="button" onClick={save} disabled={saving} className="rounded-md p-1.5 text-income hover:bg-income/10 disabled:opacity-50" aria-label="Salvar alterações" title="Salvar (Enter)">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button type="button" onClick={onOpenForm} disabled={saving} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-zinc-100" aria-label="Abrir formulário completo" title="Editar todos os campos">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-zinc-100" aria-label="Cancelar edição" title="Cancelar (Esc)">
            <X className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {error && (
        <tr className="bg-muted/40">
          <td colSpan={6} className="px-5 pb-2 text-xs text-expense" role="alert">{error}</td>
        </tr>
      )}
    </>
  );
}

const normalizeSearch = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function TransactionTable({
  transactions, readOnly, busy, onUpdate, onDelete, onEdit, month, monthName,
  fixedType, filterFn, forceAll = false, title = 'Histórico de transações', subtitle, accounts = [], onPay, onReceive,
}) {
  const todayISO = toISODate(new Date());
  const [typeFilter, setFilter] = useState('all');
  const filter = fixedType ?? typeFilter;
  const [query, setQuery] = useState('');
  const [allMonthsState, setAllMonths] = useState(false);
  const allMonths = forceAll || allMonthsState;
  const [editingId, setEditingId] = useState(null);

  const rows = useMemo(
    () =>
      transactions
        .filter((t) => filter === 'all' || t.type === filter)
        .filter((t) => !filterFn || filterFn(t))
        .filter((t) => allMonths || !month || t.date.startsWith(month))
        .filter((t) => {
          if (!query.trim()) return true;
          const haystack = normalizeSearch([t.description, t.category, t.group, t.card, t.account, t.status].join(' '));
          return normalizeSearch(query).trim().split(/\s+/).every((word) => haystack.includes(word));
        })
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row)),
    [transactions, filter, filterFn, month, allMonths, query],
  );

  // Mês escolhido: Receitas e Despesas separadas. Todos os meses: um bloco por mês.
  const flat = useMemo(() => {
    const sections = [];
    if (allMonths || !month) {
      for (const t of rows) {
        const key = t.date.slice(0, 7);
        let sec = sections[sections.length - 1];
        if (!sec || sec.key !== key) sections.push((sec = { key, label: monthLabel(key), items: [], income: 0, expense: 0 }));
        sec.items.push(t);
        if (t.type === TYPES.INCOME) sec.income += t.amount;
        else sec.expense += t.amount;
      }
      sections.forEach((sec) => {
        sec.total = sec.income - sec.expense;
        sec.detail = `+${formatCurrency(sec.income)} · −${formatCurrency(sec.expense)}`;
      });
    } else {
      for (const [type, label] of [[TYPES.INCOME, 'Receitas'], [TYPES.EXPENSE, 'Despesas']]) {
        const items = rows.filter((t) => t.type === type);
        if (!items.length) continue;
        const total = items.reduce((sum, t) => sum + t.amount, 0);
        const pending = items.filter((t) => t.status && t.status !== 'Pago').reduce((sum, t) => sum + t.amount, 0);
        sections.push({
          key: type,
          label: `${label} (${items.length})`,
          items,
          total: type === TYPES.INCOME ? total : -total,
          detail: pending > 0 ? `${formatCurrency(pending)} a pagar` : '',
        });
      }
    }
    return sections.flatMap((sec) => [{ header: true, id: `h-${sec.key}`, ...sec }, ...sec.items]);
  }, [rows, allMonths, month]);

  const amountClass = (t) => (t.type === TYPES.INCOME ? 'text-income' : 'text-expense');
  const sign = (t) => (t.type === TYPES.INCOME ? '+' : '−');

  return (
    <section aria-label="Histórico de transações" className="card">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {subtitle ? `${subtitle} · ` : ''}
            {rows.length} lançamento(s) · {formatCurrency(rows.reduce((sum, t) => sum + t.amount, 0))}
            {!subtitle && (allMonths || !month ? ' em todos os meses' : ` em ${monthName}`)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label="Buscar lançamento"
            placeholder="Buscar (ex.: mercado, nubank)"
            className="input h-9 pl-8 sm:w-56"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {month && !forceAll && (
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />
            Todos os meses
          </label>
        )}
        {!fixedType && (
        <div className="flex rounded-lg border border-border p-0.5 text-xs sm:text-sm" role="group" aria-label="Filtrar por tipo">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`flex-1 whitespace-nowrap rounded-md px-2 py-1.5 transition-colors sm:px-3 ${
                filter === f.value ? 'bg-muted text-zinc-100' : 'text-muted-foreground hover:text-zinc-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          {query.trim() ? `Nada encontrado para "${query.trim()}".` : 'Nenhuma transação neste período.'}
          {!allMonths && month && (
            <button type="button" className="ml-1 text-zinc-200 underline underline-offset-2" onClick={() => setAllMonths(true)}>
              Ver todos os meses
            </button>
          )}
        </p>
      ) : (
        <>
          {/* Tabela com edição em linha (telas médias e grandes) */}
          <div className="hidden max-h-[520px] overflow-auto md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Descrição</th>
                  <th className="px-5 py-3 font-medium">Categoria</th>
                  <th className="px-5 py-3 font-medium">{fixedType ? 'Status' : 'Tipo / Status'}</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                  <th className="w-px px-5 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {flat.map((t) =>
                  t.header ? (
                    <tr key={t.id} className="sticky top-[41px] z-[5] border-b border-border bg-muted">
                      <td colSpan={6} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                        <span className="flex items-center justify-between gap-3">
                          <span>{t.label}</span>
                          <span className="font-normal normal-case tracking-normal text-muted-foreground">
                            {t.detail && <span className="mr-3">{t.detail}</span>}
                            <span className={t.total >= 0 ? 'font-semibold text-income' : 'font-semibold text-expense'}>{formatCurrency(t.total)}</span>
                          </span>
                        </span>
                      </td>
                    </tr>
                  ) : editingId === t.id ? (
                    <EditableRow
                      key={t.id}
                      transaction={t}
                      onCancel={() => setEditingId(null)}
                      onOpenForm={() => {
                        setEditingId(null);
                        onEdit(t);
                      }}
                      onSave={async (changes) => {
                        await onUpdate(t, changes);
                        setEditingId(null);
                      }}
                    />
                  ) : (
                    <tr key={t.id} className="group border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-400">{formatDate(t.date)}</td>
                      <td className="px-5 py-3 font-medium">{titleOf(t)}</td>
                      <td className="px-5 py-3 text-zinc-400">
                        {categoryOf(t)}
                        <span className="text-zinc-500">{installmentOf(t)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {fixedType ? null : <TypeBadge type={t.type} />}
                          <StatusPill status={t.status} overdue={t.date < todayISO} auto={t.autoPaid} />
                          {t.type === TYPES.INCOME && <IncomePill transaction={t} today={todayISO} />}
                          {t.type === TYPES.INCOME && (t.receivedAt || t.date) > todayISO && !readOnly && onReceive && (
                            <ReceiveFlag transaction={t} accounts={accounts} onReceive={onReceive} disabled={busy} today={todayISO} />
                          )}
                          {t.status && t.status !== 'Pago' && !readOnly && onPay && (
                            <PayFlag transaction={t} accounts={accounts} onPay={onPay} disabled={busy} />
                          )}
                        </span>
                        {t.status === 'Pago' && t.account && <span className="mt-0.5 block text-[11px] text-zinc-500">saiu de {t.account}</span>}
                        {t.type === TYPES.INCOME && t.account && <span className="mt-0.5 block text-[11px] text-zinc-500">entrou em {t.account}</span>}
                      </td>
                      <td className={`whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums ${amountClass(t)}`}>
                        {sign(t)} {formatCurrency(t.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {!readOnly && (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setEditingId(t.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-zinc-100 disabled:opacity-40"
                              aria-label={`Editar ${titleOf(t)}`}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <DeleteButton description={titleOf(t)} disabled={busy} onConfirm={() => onDelete(t)} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          {/* Lista (celular): editar abre o formulário */}
          <ul className="max-h-[70vh] divide-y divide-border/60 overflow-auto md:hidden">
            {flat.map((t) => t.header ? (
              <li key={t.id} className="sticky top-0 z-[5] flex items-center justify-between gap-2 bg-muted px-4 py-2 text-xs">
                <span className="font-semibold uppercase tracking-wide text-zinc-300">{t.label}</span>
                <span className="text-right text-muted-foreground">
                  {t.detail && <span className="mr-2">{t.detail}</span>}
                  <span className={t.total >= 0 ? 'font-semibold text-income' : 'font-semibold text-expense'}>{formatCurrency(t.total)}</span>
                </span>
              </li>
            ) : (
              <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="block w-full min-w-0 text-left"
                  disabled={readOnly}
                  onClick={() => onEdit(t)}
                  aria-label={`Editar ${titleOf(t)}`}
                >
                  <p className="truncate font-medium">{titleOf(t)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(t.date)} · {categoryOf(t)}{installmentOf(t)}
                    {t.account && <span> · {t.account}</span>}
                  </p>
                </button>
                {t.type === TYPES.INCOME && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <IncomePill transaction={t} today={todayISO} />
                    {(t.receivedAt || t.date) > todayISO && !readOnly && onReceive && (
                      <ReceiveFlag transaction={t} accounts={accounts} onReceive={onReceive} disabled={busy} today={todayISO} />
                    )}
                  </span>
                )}
                {t.status && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill status={t.status} overdue={t.date < todayISO} auto={t.autoPaid} />
                    {t.status !== 'Pago' && !readOnly && onPay && <PayFlag transaction={t} accounts={accounts} onPay={onPay} disabled={busy} />}
                  </span>
                )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`text-sm font-medium tabular-nums ${amountClass(t)}`}>
                    {sign(t)} {formatCurrency(t.amount)}
                  </span>
                  {!readOnly && <DeleteButton description={titleOf(t)} disabled={busy} onConfirm={() => onDelete(t)} />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
