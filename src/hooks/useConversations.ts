import { useCallback, useMemo } from 'react';

import { listenToDirectConversations } from '../services/chatService';
import type { ConversationSummary, DirectConversation } from '../types/chat';
import { otherParticipantId } from '../utils/conversationId';
import { useGroups } from './useGroups';
import { useListener, type Subscribe } from './useListener';
import { useUsers } from './useUsers';

const NO_CONVERSATIONS: DirectConversation[] = [];

/** Lista única com conversas individuais e grupos, das mais recentes para as mais antigas. */
export function useConversations(uid: string) {
  const users = useUsers();
  const groups = useGroups(uid);
  const subscribe = useCallback<Subscribe<DirectConversation[]>>(
    (onData, onError) => listenToDirectConversations(uid, onData, onError),
    [uid],
  );
  const directs = useListener(subscribe, NO_CONVERSATIONS);

  const conversations = useMemo<ConversationSummary[]>(() => {
    const directItems = directs.data.map<ConversationSummary>((conversation) => {
      const other = users.usersById.get(otherParticipantId(conversation.id, uid));
      return {
        id: conversation.id,
        type: 'direct',
        title: other?.name ?? 'Usuário',
        photoUrl: other?.photoUrl ?? '',
        subtitle: 'Conversa individual',
        createdAt: conversation.createdAt,
      };
    });
    const groupItems = groups.groups.map<ConversationSummary>((group) => ({
      id: group.id,
      type: 'group',
      title: group.name,
      photoUrl: group.photoUrl,
      subtitle: `${group.memberIds.length} de ${group.memberLimit} integrantes`,
      createdAt: group.createdAt,
    }));
    return [...directItems, ...groupItems].sort((a, b) => b.createdAt - a.createdAt);
  }, [directs.data, groups.groups, users.usersById, uid]);

  return {
    conversations,
    loading: users.loading || groups.loading || directs.loading,
    error: users.error ?? groups.error ?? directs.error,
  };
}
