import express from 'express';
import { TYPES } from '../shared/categories.js';
import { HttpError } from './errors.js';
import { validateTransactionInput } from './validation.js';

const parseTarget = (params) => {
  const type = params.type;
  if (type !== TYPES.INCOME && type !== TYPES.EXPENSE) throw new HttpError(400, 'Tipo inválido.');
  const row = Number(params.row);
  if (!Number.isInteger(row) || row < 2 || row > 100000) throw new HttpError(400, 'Linha inválida.');
  return { type, row };
};

/** Monta a API REST do painel em cima do repositório da planilha. */
export function createApp({ repository, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) {
      return next(new HttpError(415, 'Envie JSON.'));
    }
    next();
  });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  // As listas do Cadastro mudam pouco: guarda por 1 minuto.
  let optionsCache = null;
  const getOptions = async (fresh = false) => {
    if (!fresh && optionsCache && Date.now() - optionsCache.at < 60_000) return optionsCache.value;
    const value = await repository.options();
    optionsCache = { at: Date.now(), value };
    return value;
  };

  app.get('/api/status', wrap(async (req, res) => {
    res.json({ ...(await repository.info()), demo: config.demo });
  }));

  app.get('/api/options', wrap(async (req, res) => {
    res.json(await getOptions(req.query.fresh === '1'));
  }));

  app.get('/api/transactions', wrap(async (req, res) => {
    res.json(await repository.list());
  }));

  app.post('/api/transactions', wrap(async (req, res) => {
    const { value, errors } = validateTransactionInput(req.body, await getOptions());
    if (errors) throw new HttpError(400, errors.join(' '));
    res.status(201).json(await repository.create(value));
  }));

  app.put('/api/transactions/:type/:row', wrap(async (req, res) => {
    const { type, row } = parseTarget(req.params);
    const { value, errors } = validateTransactionInput(req.body?.transaction, await getOptions());
    if (errors) throw new HttpError(400, errors.join(' '));
    res.json(await repository.update(type, row, value, req.body?.expected));
  }));

  app.delete('/api/transactions/:type/:row', wrap(async (req, res) => {
    const { type, row } = parseTarget(req.params);
    await repository.remove(type, row, req.body?.expected);
    res.status(204).end();
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status === 500) console.error('[api]', err);
    else if (status >= 500) console.warn(`[api] ${err.message}`);
    res.status(status).json({ error: status === 500 ? 'Erro interno no servidor.' : err.message });
  });

  return app;
}
