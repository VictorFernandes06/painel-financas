import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/**
 * Carrega as transações da planilha e expõe ações de criar, editar e excluir.
 * Depois de cada alteração os dados são relidos da planilha, porque excluir
 * uma linha muda o número das linhas abaixo dela.
 */
export function useTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [status, setStatus] = useState(null);
  const [options, setOptions] = useState({ incomeCategories: [], groups: {}, cards: [], accounts: [] });
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const [info, data, opts, acc] = await Promise.all([api.status(), api.list(), api.options(), api.accounts()]);
      if (id !== requestId.current) return;
      setAccounts(acc?.accounts ?? []);
      setTransfers(acc?.transfers ?? []);
      setBudgets(acc?.budgets ?? {});
      setStatus(info);
      setOptions(opts);
      setTransactions(data.transactions);
      setWarnings(data.warnings ?? []);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(err.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Executa uma alteração; em caso de erro, mostra a mensagem e relê a planilha.
  const mutate = useCallback(
    async (action) => {
      setSaving(true);
      try {
        await action();
        await refresh();
        return true;
      } catch (err) {
        setError(err.message);
        if (err.status === 409) await refresh();
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  return {
    transactions,
    accounts,
    transfers,
    budgets,
    warnings,
    status,
    options,
    loading,
    saving,
    error,
    clearError: () => setError(null),
    refresh,
    create: (t) => mutate(() => api.create(t)),
    update: (original, changes) => mutate(() => api.update(original, changes)),
    remove: (original) => mutate(() => api.remove(original)),
    saveAccount: (account, original) => mutate(() => api.saveAccount(account, original)),
    removeAccount: (original) => mutate(() => api.removeAccount(original)),
    saveBudgets: (b) => mutate(() => api.saveBudgets(b)),
    createTransfer: (t) => mutate(() => api.createTransfer(t)),
    removeTransfer: (original) => mutate(() => api.removeTransfer(original)),
  };
}
