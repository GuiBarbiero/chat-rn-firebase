import { API_URL } from '../config';
import { AppError } from '../utils/errors';
import { auth } from './firebase';

// ponytail: 70 s cobre o "cold start" do plano gratuito do Render; reduzir se a API for para um plano sempre ligado.
const TIMEOUT_MS = 70_000;

const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.';

function serverMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return null;
  return typeof payload.error === 'string' ? payload.error : null;
}

/** Chama a API própria enviando o ID token do Firebase Authentication no cabeçalho Authorization. */
export async function apiRequest<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: object): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new AppError(SESSION_EXPIRED);
  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new AppError('Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.');
  } finally {
    clearTimeout(timer);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 401) throw new AppError(SESSION_EXPIRED);
  if (!response.ok) throw new AppError(serverMessage(payload) ?? 'O servidor não conseguiu concluir a operação.');
  return payload as T;
}
