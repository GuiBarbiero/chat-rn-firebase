import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';

import { authenticate } from './middleware/authenticate';
import { groupsRouter } from './routes/groups';
import { notificationsRouter } from './routes/notifications';
import { verifyCredential } from './services/firebaseAdmin';
import { HttpError } from './types';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/', (_req, res) => {
  res.json({ name: 'chat-rn-firebase-api', health: '/health' });
});

/** Health check público: verifica a disponibilidade e mantém o serviço acordado. */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

// Tudo abaixo exige um Firebase ID token válido.
app.use('/groups', authenticate, groupsRouter);
app.use('/notifications', authenticate, notificationsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Erros esperados viram respostas com mensagem segura; o resto vai só para o log do servidor.
const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // Erros do leitor do corpo: JSON malformado (400), corpo grande demais (413), codificação não suportada (415).
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'Corpo da requisição inválido.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;

// Só aceita requisições depois de o Google confirmar a credencial. Se ela for recusada, o processo
// termina e a hospedagem marca o deploy como falho, em vez de subir uma API que responderia 500.
verifyCredential()
  .then(() => app.listen(port, () => console.log(`API ouvindo na porta ${port}`)))
  .catch((error: unknown) => {
    console.error('Credencial do Firebase recusada pelo Google:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
