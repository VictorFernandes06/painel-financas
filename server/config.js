import fs from 'node:fs';
import path from 'node:path';

/**
 * Extrai o ID de um link do Google Sheets.
 * Aceita o ID puro ou links como https://docs.google.com/spreadsheets/d/<ID>/edit.
 */
export function parseSpreadsheetId(input) {
  const value = String(input ?? '').trim();
  if (!value) return { id: null, kind: 'empty' };
  const sheetsMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (sheetsMatch) return { id: sheetsMatch[1], kind: 'sheets' };
  const driveMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/) || value.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (driveMatch) return { id: driveMatch[1], kind: 'drive-file' };
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return { id: value, kind: 'id' };
  return { id: null, kind: 'invalid' };
}

/** Lê as credenciais da Service Account de uma das três formas aceitas. */
function readServiceAccount(env, cwd) {
  if (env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    const file = path.resolve(cwd, env.GOOGLE_SERVICE_ACCOUNT_FILE);
    if (!fs.existsSync(file)) {
      throw new Error(
        `Arquivo da Service Account não encontrado (${env.GOOGLE_SERVICE_ACCOUNT_FILE}). Siga o passo 2 do README e salve o JSON nesse caminho.`,
      );
    }
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { client_email: json.client_email, private_key: json.private_key };
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const json = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return { client_email: json.client_email, private_key: json.private_key };
  }
  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: env.GOOGLE_CLIENT_EMAIL,
      // No .env a chave costuma vir com "\n" literais.
      private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

export function loadConfig(env = process.env, cwd = process.cwd()) {
  const sheet = parseSpreadsheetId(env.GOOGLE_SHEET_URL || env.GOOGLE_SHEET_ID);
  let credentials = null;
  let setupError = null;
  try {
    credentials = readServiceAccount(env, cwd);
  } catch (error) {
    setupError = error.message;
  }
  const apiKey = env.GOOGLE_API_KEY || null;
  const demo = env.DEMO_MODE === 'true' || (!sheet.id && !credentials && !apiKey);

  return {
    port: Number(env.API_PORT) || 3001,
    demo,
    spreadsheetId: sheet.id,
    linkKind: sheet.kind,
    credentials,
    apiKey,
    readOnly: !credentials,
    setupError,
  };
}
