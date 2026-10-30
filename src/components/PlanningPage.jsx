import { useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CreditCard, Loader2, Pencil, Target, X } from 'lucide-react';
import { TYPES } from '../data/categories';
import { formatCurrency, monthKey, monthLabel, parseAmountInput, toISODate } from '../utils/format';

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

// --- 1. Previsão dos próximos meses ----------------------------------------

function Forecast({ transactions, startBalance, onOpenBills }) {
  const today = todayISO();
  const start = monthKey(new Date());
  const months = useMemo(() => {
    const keys = Array.from({ length: 6 }, (_, i) => addMonthKey(start, i));
    let balance = startBalance;
    return keys.map((key, i) => {
      let entra = 0;
      let sai = 0;
      let count = 0;
      for (const t of transactions) {
        const k = t.date.slice(0, 7);
        // Contas atrasadas de meses passados entram no mês atual.
        const inMonth = k === key || (i === 0 && k < key);
        if (!inMonth) continue;
        if (t.type === TYPES.INCOME) {
          if (t.date > today) entra += t.amount;
        } else if (t.status && t.status !== 'Pago') {
          sai += t.amount;
          count += 1;
        }
      }
      balance += entra - sai;
      return { key, entra, sai, count, sobra: entra - sai, fim: balance };
    });
  }, [transactions, startBalance, start, today]);
  const max = Math.max(...months.map((m) => Math.abs(m.fim)), 1);

  return (
    <Section
      icon={CalendarClock}
      title="Previsão dos próximos meses"
      subtitle={`Começa com ${formatCurrency(startBalance)} (o que tem hoje nas contas) e soma o que vai entrar menos o que falta pagar.`}
      action={<button type="button" className="btn-ghost h-8 px-2 text-xs" onClick={onOpenBills}>Ver contas a pagar</button>}
    >
      <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3 xl:grid-cols-6">
        {months.map((m, i) => (
          <div key={m.key} className={`anim-fade-up rounded-xl border p-3 ${i === 0 ? 'border-emerald-400/40 bg-emerald-500/[0.04]' : 'border-border'}`} style={{ animationDelay: `${i * 60}ms` }}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i === 0 ? 'Este mês' : monthLabel(m.key)}</p>
            <dl className="mt-2 space-y-0.5 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-zinc-500">Entra</dt><dd className="tabular-nums text-income">{formatCurrency(m.entra)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-zinc-500">A pagar</dt><dd className="tabular-nums text-expense">{formatCurrency(m.sai)}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-zinc-500">Termina o mês com</p>
            <p className={`text-base font-semibold tabular-nums ${m.fim < 0 ? 'text-expense' : 'text-zinc-50'}`}>{formatCurrency(m.fim)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`anim-grow-x h-full rounded-full ${m.fim < 0 ? 'bg-expense' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'}`} style={{ width: `${(Math.abs(m.fim) / max) * 100}%` }} />
            </div>
            {m.fim < 0 && <p className="mt-1 text-[11px] text-expense">Vai faltar dinheiro</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const items = [
    ['Previsão', 'Mostra com quanto você termina cada mês, se tudo for pago como está lançado. Se ficar vermelho, vai faltar dinheiro.'],
    ['Limites por grupo', 'Você define quanto quer gastar no máximo em cada grupo (ex.: Lazer R$ 300). A barra enche conforme gasta e avisa quando passar.'],
    ['Faturas dos cartões', 'Soma as compras feitas com forma de pagamento "Cartão", mês a mês, incluindo parcelas futuras.'],
  ];
  return (
    <section className="card anim-fade-up p-5">
      <h2 className="font-semibold">Como funciona o Planejamento</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Aqui você olha para frente. Para marcar uma conta como paga, use <span className="text-zinc-200">Despesas › A pagar</span>.
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map(([title, text], i) => (
          <li key={title} className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium"><span className="mr-1.5 text-emerald-400">{i + 1}.</span>{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
    </section>
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

/** Página "Planejamento": previsão, limites por grupo e faturas. */
export default function PlanningPage({ data, readOnly, canEditBudgets, startBalance = 0, navigate }) {
  const { transactions, options, budgets } = data;
  return (
    <div className="space-y-6">
      <HowItWorks />
      <Forecast transactions={transactions} startBalance={startBalance} onOpenBills={() => navigate?.('despesas', 'apagar')} />
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
