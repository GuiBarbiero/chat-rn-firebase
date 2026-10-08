/** Erro cuja mensagem já está pronta para ser exibida ao usuário. */
export class AppError extends Error {}

const DEFAULT_MESSAGE = 'Algo deu errado. Tente novamente.';
const INVALID_LOGIN = 'E-mail ou senha inválidos.';
const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.';
const OFFLINE = 'Sem conexão. Verifique sua internet e tente novamente.';

// Códigos do Firebase (Auth, Firestore e Realtime Database) traduzidos; detalhes internos nunca são exibidos.
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': INVALID_LOGIN,
  'auth/user-not-found': INVALID_LOGIN,
  'auth/wrong-password': INVALID_LOGIN,
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': OFFLINE,
  'auth/user-token-expired': SESSION_EXPIRED,
  'auth/requires-recent-login': SESSION_EXPIRED,
  unauthenticated: SESSION_EXPIRED,
  'permission-denied': 'Você não tem permissão para realizar esta ação.',
  unavailable: OFFLINE,
};

export function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  // O Realtime Database usa "PERMISSION_DENIED"; Auth e Firestore usam "permission-denied".
  return String(error.code).toLowerCase().replace(/_/g, '-');
}

export function getErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (error instanceof AppError) return error.message;
  return MESSAGES[errorCode(error)] ?? fallback;
}
