import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { NATURES, PAYMENT_METHODS, STATUSES, TYPES, withCurrent } from '../data/categories';
import { parseAmountInput, toISODate } from '../utils/format';

const MAX_DESCRIPTION = 120;
const MAX_AMOUNT = 1_000_000_000;
const MIN_DATE = '2025-05-02'; // a planilha só aceita datas depois de 01/05/2025

function formFrom(t, type) {
  if (t) {
    return {
      type: t.type,
      date: t.date,
      amount: String(t.amount).replace('.', ','),
      description: t.description ?? '',
      category: t.category ?? '',
      group: t.group ?? '',
      nature: t.nature || NATURES[0],
      payment: t.payment || PAYMENT_METHODS[0],
      card: t.card ?? '',
      installment: String(t.installment ?? 1),
      installments: String(t.installments ?? 1),
      status: t.status || STATUSES[0],
      account: t.account ?? '',
    };
  }
  return {
    type: type ?? TYPES.EXPENSE,
    date: toISODate(new Date()),
    amount: '',
    description: '',
    category: '',
    group: '',
    nature: NATURES[0],
    payment: PAYMENT_METHODS[0],
    card: '',
    installment: '1',
    installments: '1',
    status: STATUSES[0],
    repeat: false,
    months: '12',
    parcelAll: true,
    account: '',
  };
}

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (iso, plus) => {
  const [y, m] = iso.split('-').map(Number);
  return MONTH_LABEL.format(new Date(Date.UTC(y, m - 1 + plus, 1))).replace('.', '').replace(' de ', '/');
};

function Field({ id, label, error, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-expense">{error}</p>}
    </div>
  );
}

function Select({ id, value, onChange, options, placeholder }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/**
 * Formulário de receita/despesa com os mesmos campos e listas da planilha.
 * Sem `initial` cria; com `initial` edita.
 */
export default function TransactionModal({ open, initial, options, onClose, onSave }) {
  const [form, setForm] = useState(() => formFrom(initial));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(formFrom(initial));
    setErrors({});
    setSubmitError(null);
    setSending(false);
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 0);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, initial, onClose]);

  if (!open) return null;

  const isIncome = form.type === TYPES.INCOME;
  const editing = Boolean(initial);
  const groups = Object.keys(options.groups ?? {});
  const items = form.group ? options.groups?.[form.group] ?? [] : [];
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const parcelado = !isIncome && Number(form.installments) > 1;
  const hasAccounts = Array.isArray(options.accounts) && (options.accounts.length > 0 || Boolean(form.account));

  const changeType = (type) => setForm((f) => ({ ...f, type, category: '', group: '' }));

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseAmountInput(form.amount);
    const installment = Number(form.installment);
    const installments = Number(form.installments);
    const next = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = 'Informe uma data válida.';
    else if (form.date < MIN_DATE) next.date = 'A planilha só aceita datas a partir de 02/05/2025.';
    if (!Number.isFinite(amount) || amount <= 0) next.amount = 'Informe um valor maior que zero.';
    else if (amount > MAX_AMOUNT) next.amount = 'Valor muito alto.';
    if (!form.category) next.category = isIncome ? 'Escolha a receita.' : 'Escolha a despesa.';
    const months = Number(form.months);
    const repeating = !editing && !parcelado && form.repeat;
    const parcelRepeat = !editing && parcelado && form.parcelAll ? installments - installment + 1 : 1;
    if (repeating && (!Number.isInteger(months) || months < 2 || months > 60)) next.months = 'De 2 a 60 meses.';
    if (!isIncome) {
      if (!form.group) next.group = 'Escolha o grupo.';
      if (!Number.isInteger(installment) || installment < 1) next.installment = 'Parcela inválida.';
      if (!Number.isInteger(installments) || installments < 1) next.installments = 'Total inválido.';
      else if (installment > installments) next.installment = 'Maior que o total.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const base = {
      type: form.type,
      date: form.date,
      amount: Math.round(amount * 100) / 100,
      category: form.category,
      description: form.description.trim().slice(0, MAX_DESCRIPTION),
      ...(hasAccounts ? { account: form.account } : {}),
    };
    const values = isIncome
      ? { ...base, ...(repeating ? { repeat: months } : {}) }
      : {
          ...base,
          group: form.group,
          nature: form.nature,
          payment: form.payment,
          card: form.payment === 'Cartão' ? form.card : '',
          installment,
          installments,
          status: form.status,
          ...(repeating ? { repeat: months } : parcelRepeat > 1 ? { repeat: parcelRepeat } : {}),
        };

    setSending(true);
    setSubmitError(null);
    try {
      await onSave(values);
      onClose();
    } catch (err) {
      setSubmitError(err.message);
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={sending ? undefined : onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold">
            {editing ? 'Editar lançamento' : isIncome ? 'Nova receita' : 'Nova despesa'}
          </h2>
          <button type="button" onClick={onClose} className="btn-ghost h-8 w-8 p-0" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1" role="group" aria-label="Tipo de lançamento">
            {[[TYPES.EXPENSE, 'Despesa', 'bg-expense/15 text-expense'], [TYPES.INCOME, 'Receita', 'bg-income/15 text-income']].map(
              ([value, label, active]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeType(value)}
                  aria-pressed={form.type === value}
                  className={`rounded-md py-2 text-sm font-medium transition-colors ${
                    form.type === value ? active : 'text-muted-foreground hover:text-zinc-100'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field id="tx-date" label="Data" error={errors.date}>
              <input
                id="tx-date"
                ref={firstFieldRef}
                type="date"
                min={MIN_DATE}
                className="input [color-scheme:dark]"
                value={form.date}
                onChange={(e) => set('date')(e.target.value)}
              />
            </Field>
            <Field id="tx-amount" label={parcelado ? 'Valor da parcela (R$)' : 'Valor (R$)'} error={errors.amount}>
              <input
                id="tx-amount"
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => set('amount')(e.target.value)}
              />
            </Field>
          </div>

          {isIncome ? (
            <Field id="tx-category" label="Receita" error={errors.category}>
              <Select
                id="tx-category"
                value={form.category}
                onChange={set('category')}
                options={withCurrent(options.incomeCategories ?? [], form.category)}
                placeholder="Escolha…"
              />
            </Field>
          ) : null}

          {hasAccounts && (
            <Field id="tx-account" label={isIncome ? 'Conta (onde o dinheiro entrou)' : 'Conta (de onde o dinheiro saiu)'}>
              <Select
                id="tx-account"
                value={form.account}
                onChange={set('account')}
                options={withCurrent(options.accounts, form.account)}
                placeholder="Sem conta"
              />
            </Field>
          )}

          {isIncome ? null : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field id="tx-group" label="Grupo" error={errors.group}>
                  <Select
                    id="tx-group"
                    value={form.group}
                    onChange={(g) => setForm((f) => ({ ...f, group: g, category: '' }))}
                    options={withCurrent(groups, form.group)}
                    placeholder="Escolha…"
                  />
                </Field>
                <Field id="tx-category" label="Despesa" error={errors.category}>
                  <Select
                    id="tx-category"
                    value={form.category}
                    onChange={set('category')}
                    options={withCurrent(items, form.category)}
                    placeholder={form.group ? 'Escolha…' : 'Escolha o grupo'}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field id="tx-nature" label="Tipo">
                  <Select id="tx-nature" value={form.nature} onChange={set('nature')} options={NATURES} />
                </Field>
                <Field id="tx-status" label="Status">
                  <Select id="tx-status" value={form.status} onChange={set('status')} options={STATUSES} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field id="tx-payment" label="Forma de pagamento">
                  <Select id="tx-payment" value={form.payment} onChange={set('payment')} options={PAYMENT_METHODS} />
                </Field>
                {form.payment === 'Cartão' ? (
                  <Field id="tx-card" label="Cartão">
                    <Select
                      id="tx-card"
                      value={form.card}
                      onChange={set('card')}
                      options={withCurrent(options.cards ?? [], form.card)}
                      placeholder="Escolha…"
                    />
                  </Field>
                ) : (
                  <div />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field id="tx-installment" label="Parcela" error={errors.installment}>
                  <input
                    id="tx-installment"
                    type="number"
                    min="1"
                    className="input"
                    value={form.installment}
                    onChange={(e) => set('installment')(e.target.value)}
                  />
                </Field>
                <Field id="tx-installments" label="Total de parcelas" error={errors.installments}>
                  <input
                    id="tx-installments"
                    type="number"
                    min="1"
                    className="input"
                    value={form.installments}
                    onChange={(e) => set('installments')(e.target.value)}
                  />
                </Field>
              </div>
              {parcelado && !editing && (
                <label className="-mt-1 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                    checked={form.parcelAll}
                    onChange={(e) => set('parcelAll')(e.target.checked)}
                  />
                  <span>
                    Lançar as parcelas {form.installment || 1} a {form.installments}, uma por mês
                    <span className="block text-xs text-muted-foreground">O valor acima é o de cada parcela.</span>
                  </span>
                </label>
              )}
              {form.payment === 'Cartão' && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Dica da planilha: em compras no cartão, use como data o vencimento da fatura.
                </p>
              )}
            </>
          )}

          {!editing && !parcelado ? (
            <div className="rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  checked={form.repeat}
                  onChange={(e) => set('repeat')(e.target.checked)}
                />
                {isIncome ? 'Repetir todo mês (ex.: salário)' : 'Repetir todo mês (ex.: aluguel, internet)'}
              </label>
              {form.repeat && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <label htmlFor="tx-months" className="text-muted-foreground">Por</label>
                  <input
                    id="tx-months"
                    type="number"
                    min="2"
                    max="60"
                    className="input w-20"
                    value={form.months}
                    onChange={(e) => set('months')(e.target.value)}
                  />
                  <span className="text-muted-foreground">meses</span>
                  {errors.months ? (
                    <p className="w-full text-xs text-expense">{errors.months}</p>
                  ) : (
                    /^\d{4}-\d{2}-\d{2}$/.test(form.date) && Number(form.months) >= 2 && Number(form.months) <= 60 && (
                      <p className="w-full text-xs text-muted-foreground">
                        Cria {form.months} lançamentos, um por mês, de {monthLabel(form.date, 0)} a {monthLabel(form.date, Number(form.months) - 1)}.
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          ) : null}

          <Field id="tx-description" label={isIncome ? 'Observação (opcional)' : 'Descrição (opcional)'}>
            <input
              id="tx-description"
              className="input"
              maxLength={MAX_DESCRIPTION}
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
            />
          </Field>

          {submitError && (
            <p role="alert" className="rounded-lg border border-expense/40 bg-expense/10 px-3 py-2 text-sm text-expense">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost" disabled={sending}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {sending ? 'Salvando na planilha…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
