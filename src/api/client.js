// Comunicação com o backend (server/), que fala com o Google Sheets.
// O navegador nunca vê as credenciais do Google.

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor. Ele está rodando? (npm run dev)');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback =
      response.status >= 500 && !data
        ? 'O servidor do painel não respondeu. Olhe o terminal onde rodou "npm run dev": a mensagem de erro aparece lá.'
        : `Erro ${response.status}`;
    const error = new Error(data?.error || fallback);
    error.status = response.status;
    throw error;
  }
  return data;
}

const FIELDS = ['type', 'date', 'category', 'description', 'amount', 'group', 'nature', 'payment', 'card', 'installment', 'installments', 'status', 'repeat', 'account'];
const payload = (t) => Object.fromEntries(FIELDS.filter((f) => t[f] !== undefined).map((f) => [f, t[f]]));
/** O que o servidor confere antes de alterar a linha (proteção contra linha errada). */
const fingerprint = ({ date, amount, category, description }) => ({ date, amount, category, description });

// Quando o painel abre pelo link do Google (Apps Script), fala direto com a planilha.
const gasRun = typeof window !== 'undefined' ? window.google?.script?.run : undefined;

// Nome antigo da função no Apps Script -> nome em Painel.api.
const GAS_NAMES = {
  apiStatus: 'status', apiOptions: 'options', apiList: 'list', apiCreate: 'create', apiUpdate: 'update',
  apiRemove: 'remove', apiAccounts: 'accounts', apiSaveBudgets: 'saveBudgets', apiSaveAccount: 'saveAccount',
  apiRemoveAccount: 'removeAccount', apiCreateTransfer: 'createTransfer', apiRemoveTransfer: 'removeTransfer',
};

function callGas(name, ...args) {
  return new Promise((resolve, reject) => {
    gasRun
      .withSuccessHandler(resolve)
      .withFailureHandler((err) => {
        const text = String(err?.message ?? err ?? '');
        const match = text.match(/\[(\d{3})\]\s*([\s\S]*)$/);
        const error = new Error(match ? match[2] : text || 'Erro ao falar com a planilha.');
        error.status = match ? Number(match[1]) : 500;
        reject(error);
      })
      .apiCall(GAS_NAMES[name] ?? name, args);
  });
}

const gasApi = {
  status: () => callGas('apiStatus'),
  options: () => callGas('apiOptions'),
  list: () => callGas('apiList'),
  create: (t) => callGas('apiCreate', payload(t)),
  update: (original, changes) =>
    callGas('apiUpdate', original.type, original.row, payload({ ...original, ...changes }), fingerprint(original)),
  remove: (original) => callGas('apiRemove', original.type, original.row, fingerprint(original)),
  accounts: () => callGas('apiAccounts'),
  saveBudgets: (budgets) => callGas('apiSaveBudgets', budgets),
  saveAccount: (account, original) =>
    callGas('apiSaveAccount', account, original?.row ?? null, original?.name ?? null),
  removeAccount: (original) => callGas('apiRemoveAccount', original.row, original.name),
  createTransfer: (t) => callGas('apiCreateTransfer', t),
  removeTransfer: (original) =>
    callGas('apiRemoveTransfer', original.row, { date: original.date, from: original.from, to: original.to, amount: original.amount }),
};

const onlyOnGoogle = () =>
  Promise.reject(new Error('Contas e transferências funcionam pelo link do Google (Apps Script).'));

const httpApi = {
  accounts: () => Promise.resolve({ accounts: [], transfers: [], budgets: {} }),
  saveBudgets: onlyOnGoogle,
  saveAccount: onlyOnGoogle,
  removeAccount: onlyOnGoogle,
  createTransfer: onlyOnGoogle,
  removeTransfer: onlyOnGoogle,
  status: () => request('GET', '/status'),
  options: () => request('GET', '/options'),
  list: () => request('GET', '/transactions'),
  create: (t) => request('POST', '/transactions', payload(t)),
  update: (original, changes) =>
    request('PUT', `/transactions/${original.type}/${original.row}`, {
      transaction: payload({ ...original, ...changes }),
      expected: fingerprint(original),
    }),
  remove: (original) =>
    request('DELETE', `/transactions/${original.type}/${original.row}`, { expected: fingerprint(original) }),
};

export const api = gasRun ? gasApi : httpApi;
