import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { GoogleSheetsRepository } from './repositories/googleSheets.js';
import { MemorySheetsClient } from './repositories/memorySheetsClient.js';
import { createDemoTabs } from './demoData.js';
import { HttpError } from './errors.js';

dotenv.config({ quiet: true });

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`\n[api] Erro no .env: ${error.message}\n`);
  process.exit(1);
}

if (!config.demo && !config.spreadsheetId) {
  console.error('\n[api] Defina GOOGLE_SHEET_URL no .env (ou DEMO_MODE=true para testar sem planilha).\n');
  process.exit(1);
}

// Configuração incompleta: o servidor sobe mesmo assim, mostra o que falta
// e tenta ler o .env de novo a cada pedido (não precisa reiniciar após corrigir).
let liveRepository = null;
const pending = (method) => async (...args) => {
  if (!liveRepository) {
    dotenv.config({ override: true, quiet: true });
    const fresh = loadConfig();
    if (fresh.setupError) throw new HttpError(503, fresh.setupError);
    Object.assign(config, fresh);
    liveRepository = new GoogleSheetsRepository(config);
    console.log('[api] Configuração encontrada: conectado ao Google Sheets.');
  }
  return liveRepository[method](...args);
};
const setupPending = Object.fromEntries(
  ['info', 'options', 'list', 'create', 'update', 'remove'].map((m) => [m, pending(m)]),
);

const repository = config.setupError && !config.demo
  ? setupPending
  : config.demo
  ? new GoogleSheetsRepository(
      { ...config, spreadsheetId: 'demo', readOnly: false },
      new MemorySheetsClient({ tabs: createDemoTabs() }),
    )
  : new GoogleSheetsRepository(config);

// Nunca derruba o servidor por um erro inesperado: registra e continua.
process.on('unhandledRejection', (error) => console.error('[api] Erro não tratado:', error));
process.on('uncaughtException', (error) => console.error('[api] Erro não tratado:', error));

const app = createApp({ repository, config });

// Em produção (npm start), o mesmo servidor entrega o site compilado.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const server = app.listen(config.port, '127.0.0.1', () => {
  const mode = config.demo
    ? 'DEMONSTRAÇÃO (dados em memória, nada é gravado no Google)'
    : config.setupError
    ? 'aguardando configuração'
    : `Google Sheets ${config.readOnly ? '(somente leitura)' : '(leitura e escrita)'}`;
  console.log(`[api] http://127.0.0.1:${config.port} · modo: ${mode}`);
  if (config.setupError && !config.demo) console.warn(`[api] Falta configurar: ${config.setupError}`);
  if (config.linkKind === 'drive-file') {
    console.warn('[api] Atenção: o link é de um arquivo do Drive (/file/d/). Se for .xlsx, converta para Planilhas Google.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n[api] A porta ${config.port} já está em uso. Feche o outro terminal com o painel aberto (ou mude API_PORT no .env).\n`);
    process.exit(1);
  }
  throw error;
});
