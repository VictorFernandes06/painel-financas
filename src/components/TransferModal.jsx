import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { formatCurrency, parseAmountInput, toISODate } from '../utils/format';
import Dialog from './Dialog';

/** Transferir dinheiro entre duas contas (ex.: Nubank -> Reserva). */
export default function TransferModal({ open, accounts, preset, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = accounts[0]?.name ?? '';
    const to = preset?.to ?? accounts.find((a) => a.name !== first)?.name ?? '';
    const from = preset?.to && preset.to === first ? accounts[1]?.name ?? '' : first;
    setForm({ date: toISODate(new Date()), from, to, amount: '', description: '' });
    setError(null);
    setSending(false);
  }, [open, accounts, preset]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const fromAccount = accounts.find((a) => a.name === form.from);

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseAmountInput(form.amount);
    if (!form.from || !form.to) return setError('Escolha as duas contas.');
    if (form.from === form.to) return setError('A origem e o destino precisam ser contas diferentes.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Informe um valor maior que zero.');
    setSending(true);
    setError(null);
    try {
      await onSave({ date: form.date, from: form.from, to: form.to, amount: Math.round(amount * 100) / 100, description: form.description.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  const options = accounts.map((a) => <option key={a.name} value={a.name}>{a.name}</option>);

  return (
    <Dialog open={open} title="Transferir entre contas" onClose={onClose} busy={sending}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <label htmlFor="tr-from" className="label">De</label>
            <select id="tr-from" className="input" value={form.from ?? ''} onChange={set('from')}>{options}</select>
          </div>
          <ArrowRight className="mb-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <div>
            <label htmlFor="tr-to" className="label">Para</label>
            <select id="tr-to" className="input" value={form.to ?? ''} onChange={set('to')}>{options}</select>
          </div>
        </div>
        {fromAccount && (
          <p className="-mt-2 text-xs text-muted-foreground">Saldo em {fromAccount.name}: {formatCurrency(fromAccount.balance)}</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tr-amount" className="label">Valor (R$)</label>
            <input id="tr-amount" className="input" inputMode="decimal" placeholder="0,00" value={form.amount ?? ''} onChange={set('amount')} autoFocus />
          </div>
          <div>
            <label htmlFor="tr-date" className="label">Data</label>
            <input id="tr-date" type="date" className="input [color-scheme:dark]" value={form.date ?? ''} onChange={set('date')} />
          </div>
        </div>
        <div>
          <label htmlFor="tr-desc" className="label">Descrição (opcional)</label>
          <input id="tr-desc" className="input" maxLength={120} placeholder="Ex.: guardar para a reserva" value={form.description ?? ''} onChange={set('description')} />
        </div>
        <p className="text-xs text-muted-foreground">Transferência só muda onde o dinheiro está. Não conta como receita nem despesa.</p>
        {error && (
          <p role="alert" className="rounded-lg border border-expense/40 bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={sending}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {sending ? 'Transferindo…' : 'Transferir'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
