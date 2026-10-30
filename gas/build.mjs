// Gera os 2 arquivos para colar no Apps Script da planilha:
//   gas/dist/Code.gs     -> servidor (lê e grava na planilha)
//   gas/dist/index.html  -> painel inteiro em um único arquivo
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'gas/dist');
mkdirSync(out, { recursive: true });

// 1) Servidor
const server = await esbuild({
  entryPoints: [join(root, 'gas/src/entry.js')],
  bundle: true,
  format: 'iife',
  globalName: 'Painel',
  target: 'es2020',
  write: false,
  charset: 'utf8',
});
const footer = `
// ===== Funções chamadas pelo navegador =====
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Finanças Pessoais')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function apiStatus() { return Painel.api.status(); }
function apiOptions() { return Painel.api.options(); }
function apiList() { return Painel.api.list(); }
function apiCreate(body) { return Painel.api.create(body); }
function apiUpdate(type, row, body, expected) { return Painel.api.update(type, row, body, expected); }
function apiRemove(type, row, expected) { return Painel.api.remove(type, row, expected); }
// Chamada genérica: o navegador usa só esta (assim o Code.gs não muda quando surgem funções novas).
function apiCall(name, args) {
  if (!Object.prototype.hasOwnProperty.call(Painel.api, name)) throw new Error('[404] Função desconhecida: ' + name);
  return Painel.api[name].apply(null, args || []);
}
function apiAccounts() { return Painel.api.accounts(); }
function apiSaveBudgets(body) { return Painel.api.saveBudgets(body); }
function apiSaveAccount(body, row, expectedName) { return Painel.api.saveAccount(body, row, expectedName); }
function apiRemoveAccount(row, expectedName) { return Painel.api.removeAccount(row, expectedName); }
function apiCreateTransfer(body) { return Painel.api.createTransfer(body); }
function apiRemoveTransfer(row, expected) { return Painel.api.removeTransfer(row, expected); }
`;
const header = '// Painel de Finanças Pessoais — cole este arquivo inteiro em Code.gs (gerado automaticamente).\n';
writeFileSync(join(out, 'Code.gs'), header + server.outputFiles[0].text + footer);

// 2) Painel: build normal do Vite e depois tudo embutido num único HTML
const tmp = join(root, 'gas/.web');
await viteBuild({ root, logLevel: 'warn', build: { outDir: tmp, emptyOutDir: true, modulePreload: false } });
let html = readFileSync(join(tmp, 'index.html'), 'utf8');
const assets = join(tmp, 'assets');
const safe = (code) => code.replace(/<\/script/gi, '<\\/script');
for (const file of readdirSync(assets)) {
  const code = readFileSync(join(assets, file), 'utf8');
  if (file.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*href="/assets/${file}"[^>]*>`), () => `<style>${code}</style>`);
  } else if (file.endsWith('.js')) {
    html = html.replace(new RegExp(`<script([^>]*) src="/assets/${file}"[^>]*></script>`), (_, attrs) => `<script${attrs}>${safe(code)}</script>`);
  }
}
html = html.replace(/<link rel="icon"[^>]*>\s*/, '');
// O script vai para o fim do body (o Apps Script embrulha a página).
const scripts = [];
html = html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, (m) => (scripts.push(m), ''));
html = html.replace('</body>', () => `${scripts.join('\n')}\n</body>`);
if (/src="\/assets|href="\/assets/.test(html)) throw new Error('Sobrou referência a /assets no HTML');
writeFileSync(join(out, 'index.html'), html);
console.log('ok', Math.round(html.length / 1024) + 'KB html,', Math.round(server.outputFiles[0].text.length / 1024) + 'KB gs');

// 3) Versão "auto-atualizável": Loader.gs (colado uma vez) baixa estes arquivos do GitHub.
writeFileSync(join(out, 'painel-server.js'), server.outputFiles[0].text);
writeFileSync(join(out, 'Loader.gs'), readFileSync(join(root, 'gas/src/loader.gs'), 'utf8'));
