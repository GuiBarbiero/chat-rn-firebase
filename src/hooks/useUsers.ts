import { useMemo } from 'react';

import { listenToPublicProfiles } from '../services/userService';
import type { PublicProfile } from '../types/user';
import { useListener } from './useListener';

const NO_USERS: PublicProfile[] = [];

// ponytail: cada tela escuta o diretório inteiro (o SDK reaproveita a mesma conexão).
// Trocar por busca paginada no servidor se a base de usuários crescer.
export function useUsers() {
  const { data: users, loading, error } = useListener(listenToPublicProfiles, NO_USERS);
  const usersById = useMemo(() => new Map(users.map((user) => [user.uid, user])), [users]);
  return { users, usersById, loading, error };
}
