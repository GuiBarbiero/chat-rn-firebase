import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authService from '../services/authService';
import { unregisterDevice } from '../services/notificationService';
import { listenToUserProfile } from '../services/userService';
import type { ChatUser, SignUpInput } from '../types/user';

export type AuthContextValue = {
  /** Usuário autenticado com perfil carregado; null quando não há sessão. */
  user: ChatUser | null;
  /** true enquanto a sessão salva ainda está sendo recuperada. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Disponível só dentro das telas autenticadas; nunca é null enquanto elas estão montadas. */
export const CurrentUserContext = createContext<ChatUser | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    const stopSession = authService.observeSession((firebaseUser) => {
      stopProfile?.();
      stopProfile = undefined;
      if (!firebaseUser) {
        // Logout, sessão expirada ou conta removida: limpa o estado e o fluxo volta à autenticação.
        setUser(null);
        setLoading(false);
        return;
      }
      stopProfile = listenToUserProfile(
        firebaseUser.uid,
        (profile) => {
          setUser(profile);
          setLoading(false);
        },
        () => {
          setUser(null);
          setLoading(false);
        },
      );
    });
    return () => {
      stopProfile?.();
      stopSession();
    };
  }, []);

  const signOut = useCallback(async () => {
    const uid = user?.uid;
    // Remove o token deste aparelho antes de sair, enquanto ainda há permissão para isso.
    if (uid) await unregisterDevice(uid).catch(() => undefined);
    await authService.signOut();
  }, [user?.uid]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn: authService.signIn, signUp: authService.signUp, signOut }),
    [user, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
