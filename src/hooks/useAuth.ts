import { useContext } from 'react';

import { AuthContext, CurrentUserContext, type AuthContextValue } from '../contexts/AuthContext';
import type { ChatUser } from '../types/user';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}

/** Usuário autenticado, para as telas que só existem com sessão ativa. */
export function useCurrentUser(): ChatUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser deve ser usado em uma tela autenticada.');
  return user;
}
