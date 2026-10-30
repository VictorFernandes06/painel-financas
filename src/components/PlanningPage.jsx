import { useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, Check, CreditCard, Loader2, Pencil, Target, X } from 'lucide-react';
import { TYPES } from '../data/categories';
import { formatCurrency, formatDate, monthKey, monthLabel, parseAmountInput, toISODate } from '../utils/format';

const todayISO = () => toISODate(new Date());
const addMonthKey = (key, n) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};

function Section({ icon: Icon, title, subtitle, action, children }) {
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="flex gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// --- 1. Contas a pagar -------------------------------------------------------

function PayButton({ bill, accounts, disabled, onPay }) {
  const [account, setAccount] = useState(bill.account || '');
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      await onPay(bill, account);
    } catch {
      setBusy(false); // a mensagem aparece no aviso do topo
    }
  };
  return (
    <div className="flex items-center gap-2">
      {accounts.length > 0 && (
        <select
          aria-label="Pagar com qual conta"
          className="input h-8 w-32 px-2 py-1 text-xs"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">Sem conta</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      <button type="button" className="btn-primary h-8 px-3 text-xs" disabled={disabled || busy} onClick={pay}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Pagar
      </button>
    </div>
  );
}

function Bills({ transactions, accounts, readOnly, busy, onPay }) {
  const today = todayISO();
  const bills = useMemo(
    () =>
      transactions
        .filter((t) => t.type === TYPES.EXPENSE && (t.status === 'A Pagar' || t.status === 'Atrasado'))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [transactions],
  );
  const late = bills.filter((b) => b.date < today);
  const month = monthKey(today);
  const thisMonth = bills.filter((b) => b.date >= today && b.date.startsWith(month));
  const later = bills.filter((b) => b.date >= today && !b.date.startsWith(month)).slice(0, 15);
  const total = (list) => formatCurrency(list.reduce((s, b) => s + b.amount, 0));

  const groups = [
    ['Vencidas', late, 'text-expense'],
    ['Ainda neste mês', thisMonth, 'text-amber-400'],
    ['Próximos meses', later, 'text-muted-foreground'],
  ].filter(([, list]) => list.length);

  return (
    <Section
      icon={CalendarClock}
      title="Contas a pagar"
      subtitle={bills.length ? `${bills.length} em aberto · ${total(bills)}` : 'Despesas com status "A Pagar" ou "Atrasado" aparecem aqui'}
    >
      {groups.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Tudo pago. Nenhuma conta em aberto.</p>
      ) : (
        groups.map(([label, list, tone]) => (
          <div key={label}>
            <p className={`flex justify-between bg-muted/40 px-5 py-2 text-xs font-medium ${tone}`}>
              <span>{label}</span>
              <span>{total(list)}</span>
            </p>
            <ul className="divide-y divide-border/60">
              {list.map((b) => (
                <li key={b.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {b.description || b.category}
                      {b.installments > 1 && <span className="text-muted-foreground"> · {b.installment}/{b.installments}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(b.date)} · {b.group} › {b.category}{b.card && ` · ${b.card}`}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-sm font-semibold tabular-nums text-expense">{formatCurrency(b.amount)}</span>
                    {!readOnly && <PayButton bill={b} accounts={accounts} disabled={busy} onPay={onPay} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Section>
  );
}

// --- 2. Orçamento por grupo -------------------------------------------------

function Budgets({ transactions, groups, budgets, canEdit, readOnly, onSave }) {
  const month = monthKey(new Date());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const spent = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.type === TYPES.EXPENSE && t.date.startsWith(month)) map[t.group] = (map[t.group] ?? 0) + t.amount;
    }
    return map;
  }, [transactions, month]);

  const allGroups = [...new Set([...groups, ...Object.keys(budgets)])];
  const shown = allGroups
    .filter((g) => budgets[g] || spent[g])
    .sort((a, b) => (spent[b] ?? 0) / (budgets[b] || Infinity) - (spent[a] ?? 0) / (budgets[a] || Infinity) || (spent[b] ?? 0) - (spent[a] ?? 0));

  const startEdit = () => {
    setDraft(Object.fromEntries(allGroups.map((g) => [g, budgets[g] ? String(budgets[g]).replace('.', ',') : ''])));
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    const value = {};
    for (const [g, raw] of Object.entries(draft)) {
      if (!raw.trim()) continue;
      const n = parseAmountInput(raw);
      if (!Number.isFinite(n) || n < 0) return setError(`Limite inválido em ${g}.`);
      if (n > 0) value[g] = Math.round(n * 100) / 100;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const action = canEdit && !readOnly && !editing && (
    <button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={startEdit}>
      <Pencil className="h-3.5 w-3.5" /> Definir limites
    </button>
  );

  return (
    <Section icon={Target} title="Orçamento do mês" subtitle={`Gasto por grupo em ${monthLabel(month)} contra o limite que você definiu`} action={action}>
      {editing ? (
        <div className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {allGroups.map((g) => (
              <label key={g} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{g}</span>
                <input
                  className="input h-8 w-32 text-right"
                  inputMode="decimal"
                  placeholder="sem limite"
                  value={draft[g] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [g]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-expense">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-4 w-4" /> Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar limites
            </button>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          {canEdit ? 'Defina um limite por grupo (ex.: Alimentação R$ 1.200) para acompanhar aqui.' : 'Os limites ficam disponíveis pelo link do Google.'}
        </p>
      ) : (
        <ul className="space-y-4 p-5">
          {shown.map((g) => {
            const value = spent[g] ?? 0;
            const limit = budgets[g];
            const pct = limit ? (value / limit) * 100 : null;
            const tone = pct === null ? 'bg-zinc-500' : pct > 100 ? 'bg-expense' : pct >= 80 ? 'bg-amber-400' : 'bg-income';
            return (
              <li key={g}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{g}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <span className={pct > 100 ? 'text-expense' : 'text-zinc-100'}>{formatCurrency(value)}</span>
                    {limit ? ` de ${formatCurrency(limit)}` : ' · sem limite'}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, pct ?? 100)}%`, opacity: pct === null ? 0.3 : 1 }} />
                </div>
                {pct > 100 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-expense">
                    <AlertCircle className="h-3.5 w-3.5" /> Passou {formatCurrency(value - limit)} do limite
                  </p>
                )}
                {pct !== null && pct <= 100 && <p className="mt-1 text-xs text-muted-foreground">Ainda pode gastar {formatCurrency(limit - value)}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// --- 3. Fatura por cartão ----------------------------------------------------

function CardBills({ transactions, cards }) {
  const start = monthKey(new Date());
  const months = Array.from({ length: 6 }, (_, i) => addMonthKey(start, i));
  const table = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      if (t.type !== TYPES.EXPENSE || t.payment !== 'Cartão') continue;
      const key = t.date.slice(0, 7);
      if (!months.includes(key)) continue;
      const card = t.card || 'Cartão sem nome';
      if (!map.has(card)) map.set(card, {});
      const row = map.get(card);
      row[key] = (row[key] ?? 0) + t.amount;
    }
    for (const c of cards) if (!map.has(c)) map.set(c, {});
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, cards, start]);

  return (
    <Section icon={CreditCard} title="Faturas dos cartões" subtitle="Compras no cartão por mês da fatura, incluindo parcelas que ainda vão cair">
      {table.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nenhuma compra no cartão. Lance uma despesa com forma de pagamento "Cartão".</p>
      ) : (
        <div className="divide-y divide-border/60">
          {table.map(([card, row]) => (
            <div key={card} className="p-5">
              <p className="mb-3 text-sm font-medium">{card}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {months.map((m, i) => (
                  <div key={m} className={`rounded-lg border p-2 ${i === 0 ? 'border-zinc-500' : 'border-border'}`}>
                    <p className="text-[11px] text-muted-foreground">{i === 0 ? 'Este mês' : monthLabel(m)}</p>
                    <p className={`text-sm font-semibold tabular-nums ${row[m] ? 'text-zinc-100' : 'text-muted-foreground'}`}>
                      {formatCurrency(row[m] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/** Página "Planejamento": contas a pagar, orçamento por grupo e faturas. */
export default function PlanningPage({ data, readOnly, canEditBudgets }) {
  const { transactions, options, budgets, saving } = data;
  const pay = (bill, account) => data.update(bill, { status: 'Pago', ...(account ? { account } : {}) });

  return (
    <div className="space-y-6">
      <Bills transactions={transactions} accounts={options.accounts ?? []} readOnly={readOnly} busy={saving} onPay={pay} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Budgets
          transactions={transactions}
          groups={Object.keys(options.groups ?? {})}
          budgets={budgets ?? {}}
          canEdit={canEditBudgets}
          readOnly={readOnly}
          onSave={data.saveBudgets}
        />
        <CardBills transactions={transactions} cards={options.cards ?? []} />
      </div>
    </div>
  );
}
