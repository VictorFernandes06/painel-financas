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

// Página do painel: título, ícone (navegador e tela inicial do celular) e metas.
const ICON_URL = 'https://raw.githubusercontent.com/VictorFernandes06/painel-financas/main/public/icon-180.png';
export function web(html) {
  // eslint-disable-next-line no-undef
  let out = HtmlService.createHtmlOutput(html).setTitle('Fôlego · Finanças');
  try {
    out = out.setFaviconUrl(ICON_URL);
  } catch (e) {
    // sem ícone, tudo bem
  }
  return out
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}
