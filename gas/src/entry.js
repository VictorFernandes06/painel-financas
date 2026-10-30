import { createGasBackend } from './server.js';

// Funções expostas ao navegador via google.script.run (ver rodapé do build).
const backend = () =>
  // eslint-disable-next-line no-undef
  createGasBackend({ SpreadsheetApp, Utilities, LockService });

export const api = {
  status: () => backend().status(),
  options: () => backend().options(),
  list: () => backend().list(),
  create: (body) => backend().create(body),
  update: (type, row, body, expected) => backend().update(type, row, body, expected),
  remove: (type, row, expected) => backend().remove(type, row, expected),
  accounts: () => backend().accounts(),
  saveBudgets: (body) => backend().saveBudgets(body),
  saveAccount: (body, row, expectedName) => backend().saveAccount(body, row, expectedName),
  removeAccount: (row, expectedName) => backend().removeAccount(row, expectedName),
  createTransfer: (body) => backend().createTransfer(body),
  removeTransfer: (row, expected) => backend().removeTransfer(row, expected),
};
