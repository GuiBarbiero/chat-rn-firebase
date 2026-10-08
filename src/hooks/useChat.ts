import { useCallback, useEffect, useState } from 'react';

import { listenToMessages, sendMessage } from '../services/chatService';
import { requestMessagePush, setActiveConversation } from '../services/notificationService';
import type { ChatMessage, ConversationType, MessageTarget } from '../types/chat';
import { getErrorMessage } from '../utils/errors';
import { useCurrentUser } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { useListener, type Subscribe } from './useListener';

const NO_MESSAGES: ChatMessage[] = [];

/** Mensagens da conversa em tempo real + envio (persistência no Realtime Database e pedido de push à API). */
export function useChat(conversationId: string, conversationType: ConversationType) {
  const user = useCurrentUser();
  const online = useConnectivity();
  const subscribe = useCallback<Subscribe<ChatMessage[]>>(
    (onData, onError) => listenToMessages(conversationId, onData, onError),
    [conversationId],
  );
  const { data: messages, loading, error } = useListener(subscribe, NO_MESSAGES);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId]);

  /** Devolve true quando a mensagem foi persistida. */
  const send = useCallback(
    async (text: string, target: MessageTarget, mentionedUserIds: string[]): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      setPushError(null);
      if (!online) {
        setSendError('Sem conexão. A mensagem não foi enviada; tente novamente quando a internet voltar.');
        return false;
      }
      setSending(true);
      setSendError(null);
      try {
        const messageId = await sendMessage({
          conversationId,
          conversationType,
          senderId: user.uid,
          text: trimmed,
          target,
          mentionedUserIds,
        });
        // O push é pedido depois da persistência e não bloqueia o chat: se falhar, a mensagem continua enviada.
        requestMessagePush(conversationId, messageId).catch((pushFailure: unknown) =>
          setPushError(`Mensagem enviada, mas a notificação não foi disparada. ${getErrorMessage(pushFailure, '')}`.trim()),
        );
        return true;
      } catch (failure) {
        setSendError(getErrorMessage(failure, 'Não foi possível enviar a mensagem. Tente novamente.'));
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, conversationType, online, user.uid],
  );

  return { messages, loading, error, sending, sendError, pushError, send };
}
