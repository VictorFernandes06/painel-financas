import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_KINDS } from '../../shared/accounts.js';
import { parseAmountInput } from '../utils/format';
import Dialog from './Dialog';

const toText = (n) => (n == null ? '' : String(n).replace('.', ','));

/** Cadastro/edição de conta (banco, carteira, reserva…). */
export default function AccountModal({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: initial?.name ?? '',
      bank: initial?.bank ?? '',
      kind: initial?.kind ?? ACCOUNT_KINDS[0],
      initial: toText(initial?.initial ?? ''),
      goal: toText(initial?.goal),
      deadline: initial?.deadline ?? '',
    });
    setError(null);
    setSending(false);
  }, [open, initial]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const initialValue = form.initial.trim() ? parseAmountInput(form.initial) : 0;
    const goal = form.goal.trim() ? parseAmountInput(form.goal) : null;
    if (!form.name.trim()) return setError('Dê um nome para a conta.');
    if (!Number.isFinite(initialValue)) return setError('Saldo inicial inválido.');
    if (goal !== null && (!Number.isFinite(goal) || goal <= 0)) return setError('Meta inválida.');
    setSending(true);
    setError(null);
    try {
      await onSave({
        name: form.name.trim(),
        bank: form.bank.trim(),
        kind: form.kind,
        initial: initialValue,
        goal,
        deadline: goal !== null && form.deadline ? form.deadline : '',
      });
      onClose();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  return (
    <Dialog open={open} title={initial ? 'Editar conta' : 'Nova conta'} onClose={onClose} busy={sending}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="acc-name" className="label">Nome da conta</label>
          <input id="acc-name" className="input" maxLength={60} placeholder="Ex.: Nubank, Reserva de emergência" value={form.name ?? ''} onChange={set('name')} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="acc-bank" className="label">Banco (opcional)</label>
            <input id="acc-bank" className="input" maxLength={60} placeholder="Ex.: Mercado Pago" value={form.bank ?? ''} onChange={set('bank')} />
          </div>
          <div>
            <label htmlFor="acc-kind" className="label">Tipo</label>
            <select id="acc-kind" className="input" value={form.kind ?? ''} onChange={set('kind')}>
              {ACCOUNT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="acc-initial" className="label">Saldo inicial (R$)</label>
            <input id="acc-initial" className="input" inputMode="decimal" placeholder="0,00" value={form.initial ?? ''} onChange={set('initial')} />
          </div>
          <div>
            <label htmlFor="acc-goal" className="label">Meta (opcional)</label>
            <input id="acc-goal" className="input" inputMode="decimal" placeholder="Ex.: 10.000,00" value={form.goal ?? ''} onChange={set('goal')} />
          </div>
        </div>
        {(form.goal ?? '').trim() && (
          <div>
            <label htmlFor="acc-deadline" className="label">Prazo da meta (opcional)</label>
            <input id="acc-deadline" type="date" className="input [color-scheme:dark]" value={form.deadline ?? ''} onChange={set('deadline')} />
            <p className="mt-1 text-xs text-muted-foreground">Com prazo, o painel calcula quanto guardar por mês.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Saldo inicial é quanto já havia na conta antes dos lançamentos do painel. A meta mostra uma barra de progresso (bom para reservas).
        </p>
        {error && (
          <p role="alert" className="rounded-lg border border-expense/40 bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={sending}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {sending ? 'Salvando…' : initial ? 'Salvar conta' : 'Criar conta'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
