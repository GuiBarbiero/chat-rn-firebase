import { useCallback, useMemo } from 'react';

import { listenToGroup, listenToGroups } from '../services/groupService';
import type { ChatGroup } from '../types/group';
import { useListener, type Subscribe } from './useListener';

const NO_GROUPS: ChatGroup[] = [];

/** Grupos dos quais o usuário é integrante, em tempo real. */
export function useGroups(uid: string) {
  const subscribe = useCallback<Subscribe<ChatGroup[]>>(
    (onData, onError) => listenToGroups(uid, onData, onError),
    [uid],
  );
  const { data: groups, loading, error } = useListener(subscribe, NO_GROUPS);
  return { groups, loading, error };
}

/** Um grupo em tempo real. Se o usuário for removido, as regras negam a leitura e `error` é preenchido. */
export function useGroup(groupId: string | null) {
  const subscribe = useMemo<Subscribe<ChatGroup | null> | null>(
    () => (groupId ? (onData, onError) => listenToGroup(groupId, onData, onError) : null),
    [groupId],
  );
  const { data: group, loading, error } = useListener(subscribe, null);
  return { group, loading, error };
}
