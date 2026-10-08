import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authService from '../services/authService';
import { registerDevice, unregisterDevice } from '../services/notificationService';
import { listenToUserProfile } from '../services/userService';
import type { ChatUser, SignUpInput } from '../types/user';
import { AppError } from '../utils/errors';

export type AuthContextValue = {
  /** Usuário autenticado com perfil carregado; null quando não há sessão. */
  user: ChatUser | null;
  /** true enquanto a sessão salva ainda está sendo recuperada. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const LOGOUT_WAIT_MS = 5000;

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
    if (uid) {
      // Remove o token deste aparelho antes de sair, enquanto ainda há permissão para isso.
      // O token é do aparelho e continua válido depois do logout: sair sem a confirmação da exclusão
      // deixaria este aparelho recebendo os pushes da conta. Sem internet a confirmação não chega,
      // então a espera é limitada e o logout é recusado em vez de ficar preso.
      const removed = await Promise.race([
        unregisterDevice(uid).then(() => true, () => true), // exclusão rejeitada: segue para o logout
        new Promise<false>((resolve) => setTimeout(() => resolve(false), LOGOUT_WAIT_MS)),
      ]);
      if (!removed) {
        // A exclusão continua na fila do Firestore: regrava o registro para a conta não ficar sem
        // push quando a conexão voltar.
        void registerDevice(uid).catch(() => undefined);
        throw new AppError('Sem conexão: não foi possível sair agora. Tente novamente.');
      }
    }
    await authService.signOut();
  }, [user?.uid]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn: authService.signIn, signUp: authService.signUp, signOut }),
    [user, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
