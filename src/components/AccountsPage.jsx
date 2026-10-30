import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Landmark, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { computeBalances, monthlyToGoal } from '../../shared/accounts.js';
import { formatCurrency, formatDate, monthLabel, receivedOn, toISODate } from '../utils/format';
import AccountModal from './AccountModal';
import TransferModal from './TransferModal';

function ConfirmDelete({ label, onConfirm, busy }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button type="button" className="btn-ghost h-8 px-2 text-expense" disabled={busy} onClick={onConfirm} aria-label={`Confirmar exclusão de ${label}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button type="button" className="btn-ghost h-8 px-2" onClick={() => setConfirming(false)} aria-label="Cancelar exclusão">
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }
  return (
    <button type="button" className="btn-ghost h-8 px-2" onClick={() => setConfirming(true)} aria-label={`Excluir ${label}`} title="Excluir">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function GoalPlan({ account }) {
  const plan = monthlyToGoal(account.balance, account.goal, account.deadline, toISODate(new Date()));
  if (!plan) return null;
  if (plan.late) {
    return <p className="mt-1 text-xs text-amber-400">O prazo passou. Faltam {formatCurrency(plan.missing)}.</p>;
  }
  return (
    <p className="mt-1 text-xs text-zinc-300">
      Guarde <span className="font-semibold text-income">{formatCurrency(plan.perMonth)}/mês</span> para chegar até{' '}
      {monthLabel(account.deadline.slice(0, 7))} ({plan.months} {plan.months === 1 ? 'mês' : 'meses'})
    </p>
  );
}

function AccountCard({ account, readOnly, busy, onEdit, onDelete, onSend }) {
  const percent = account.goal ? Math.max(0, Math.min(100, (account.balance / account.goal) * 100)) : null;
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{account.name}</p>
          <p className="truncate text-xs text-muted-foreground">{[account.bank, account.kind].filter(Boolean).join(' · ')}</p>
        </div>
        {!readOnly && (
          <div className="-mr-2 -mt-1 flex shrink-0">
            <button type="button" className="btn-ghost h-8 px-2" onClick={onEdit} aria-label={`Editar ${account.name}`} title="Editar">
              <Pencil className="h-4 w-4" />
            </button>
            <ConfirmDelete label={account.name} busy={busy} onConfirm={onDelete} />
          </div>
        )}
      </div>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${account.balance < 0 ? 'text-expense' : 'text-zinc-100'}`}>
        {formatCurrency(account.balance)}
      </p>
      {percent !== null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-income transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {Math.round(percent)}% da meta de {formatCurrency(account.goal)}
            {account.balance >= account.goal && ' · Meta atingida!'}
          </p>
          <GoalPlan account={account} />
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dt>Entradas</dt>
        <dd className="text-right text-income">{formatCurrency(account.income + account.transferIn)}</dd>
        <dt>Saídas</dt>
        <dd className="text-right text-expense">{formatCurrency(account.expense + account.transferOut)}</dd>
      </dl>
      {!readOnly && (
        <button type="button" className="btn-ghost mt-auto justify-start px-0 pt-4 text-xs" onClick={onSend}>
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Transferir para esta conta
        </button>
      )}
    </div>
  );
}

/** Página "Contas": onde o dinheiro está, saldos e transferências. */
export default function AccountsPage({ data, readOnly, tab = 'saldos' }) {
  const { accounts, transfers, transactions, saving } = data;
  const [accountModal, setAccountModal] = useState(null); // null | { account? }
  const [transferModal, setTransferModal] = useState(null); // null | { to? }
  const [busyId, setBusyId] = useState(null);

  const summary = useMemo(() => {
    // Só o que já aconteceu: receitas até hoje e despesas pagas.
    const today = toISODate(new Date());
    const happened = transactions.filter((t) => (t.type === 'receita' ? receivedOn(t) <= today : t.status === 'Pago' || (!t.status && t.date <= today)));
    return computeBalances(accounts, happened, transfers);
  }, [accounts, transactions, transfers]);
  const recentTransfers = useMemo(
    () => [...transfers].sort((a, b) => b.date.localeCompare(a.date) || b.row - a.row),
    [transfers],
  );

  const run = async (id, action) => {
    setBusyId(id);
    try {
      await action();
    } catch {
      // a mensagem aparece no aviso do topo
    } finally {
      setBusyId(null);
    }
  };

  const hasUnassigned = summary.unassigned.income > 0 || summary.unassigned.expense > 0;

  return (
    <div className="space-y-6">
      {tab === 'saldos' && (<>
      <section className="card anim-fade-up flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Total nas contas</p>
          <p className={`mt-1 text-3xl font-semibold tracking-tight ${summary.total < 0 ? 'text-expense' : 'text-income'}`}>
            {formatCurrency(summary.total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'} · saldo inicial + receitas − despesas pagas ± transferências
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost border border-border" onClick={() => setTransferModal({})} disabled={accounts.length < 2}
              title={accounts.length < 2 ? 'Cadastre pelo menos duas contas' : undefined}>
              <ArrowLeftRight className="h-4 w-4" aria-hidden /> Transferir
            </button>
            <button type="button" className="btn-primary" onClick={() => setAccountModal({})}>
              <Plus className="h-4 w-4" aria-hidden /> Nova conta
            </button>
          </div>
        )}
      </section>

      {accounts.length === 0 ? (
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <Landmark className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">Nenhuma conta cadastrada ainda</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Cadastre onde seu dinheiro fica (Nubank, Mercado Pago, Banco do Brasil…) e uma conta de Reserva para guardar.
            </p>
          </div>
          {!readOnly && (
            <button type="button" className="btn-primary" onClick={() => setAccountModal({})}>
              <Plus className="h-4 w-4" aria-hidden /> Cadastrar primeira conta
            </button>
          )}
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:anim-fade-up">
          {summary.accounts.map((a) => (
            <AccountCard
              key={a.row}
              account={a}
              readOnly={readOnly}
              busy={busyId === `acc-${a.row}`}
              onEdit={() => setAccountModal({ account: a })}
              onDelete={() => run(`acc-${a.row}`, () => data.removeAccount(a))}
              onSend={() => setTransferModal({ to: a.name })}
            />
          ))}
        </section>
      )}

      {hasUnassigned && accounts.length > 0 && (
        <p className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          Lançamentos sem conta escolhida não mudam os saldos acima:{' '}
          {[
            summary.unassigned.income > 0 && `${formatCurrency(summary.unassigned.income)} em receitas`,
            summary.unassigned.expense > 0 && `${formatCurrency(summary.unassigned.expense)} em despesas pagas`,
          ].filter(Boolean).join(' e ')}
          . Para um lançamento mexer no saldo, escolha a conta dele.
        </p>
      )}

      </>)}

      {tab === 'transferencias' && (
      <section className="card anim-fade-up">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
          <h2 className="font-semibold">Transferências</h2>
          <p className="text-xs text-muted-foreground">Dinheiro que mudou de conta. Não conta como receita nem despesa.</p>
          </div>
          {!readOnly && accounts.length >= 2 && (
            <button type="button" className="btn-primary" onClick={() => setTransferModal({})}>
              <ArrowLeftRight className="h-4 w-4" aria-hidden /> Nova transferência
            </button>
          )}
        </div>
        {recentTransfers.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma transferência ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentTransfers.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate">
                    <span className="truncate">{t.from}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{t.to}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(t.date)}
                    {t.description && ` · ${t.description}`}
                  </p>
                </div>
                <span className="shrink-0 font-medium">{formatCurrency(t.amount)}</span>
                {!readOnly && <ConfirmDelete label="transferência" busy={busyId === t.id} onConfirm={() => run(t.id, () => data.removeTransfer(t))} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      <AccountModal
        open={accountModal !== null}
        initial={accountModal?.account}
        onClose={() => setAccountModal(null)}
        onSave={(values) => data.saveAccount(values, accountModal?.account)}
      />
      <TransferModal
        open={transferModal !== null}
        accounts={summary.accounts}
        preset={transferModal}
        onClose={() => setTransferModal(null)}
        onSave={data.createTransfer}
      />
      {saving && <span className="sr-only">Salvando…</span>}
    </div>
  );
}
