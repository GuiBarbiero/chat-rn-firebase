import type { MessageTarget, NotificationPolicy } from '../types';

export type RecipientInput = {
  /** Participantes lidos do Firestore (nunca enviados pelo app). */
  participantIds: readonly string[];
  senderId: string;
} & (
  | { conversationType: 'direct' }
  | {
      conversationType: 'group';
      policy: NotificationPolicy;
      target: MessageTarget;
      mentionedUserIds: readonly string[];
    }
);

/**
 * Decide quem recebe o push de uma mensagem.
 * - O remetente nunca recebe a própria mensagem.
 * - Só participantes da conversa podem receber.
 * - Conversa individual: o outro participante.
 * - Grupo: depende da política configurada pelo proprietário.
 */
export function resolveRecipients(input: RecipientInput): string[] {
  const others = input.participantIds.filter((uid) => uid !== input.senderId);
  if (input.conversationType === 'direct') return others;

  switch (input.policy) {
    case 'all_group_messages':
      return others;
    case 'mentioned_members': {
      const addressed = new Set(input.mentionedUserIds);
      if (input.target.type === 'member') addressed.add(input.target.memberId);
      return others.filter((uid) => addressed.has(uid));
    }
    case 'direct_messages_only': // mensagens de grupo não geram push; só as conversas individuais
    case 'disabled':
      return [];
  }
}
