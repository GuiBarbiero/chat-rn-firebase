import type { ConversationType } from './chat';

export type NotificationPolicy =
  | 'all_group_messages'
  | 'mentioned_members'
  | 'direct_messages_only'
  | 'disabled';

export const NOTIFICATION_POLICIES: readonly { value: NotificationPolicy; label: string; description: string }[] = [
  {
    value: 'all_group_messages',
    label: 'Todas as mensagens',
    description: 'Todos os integrantes, exceto o remetente, recebem push.',
  },
  {
    value: 'mentioned_members',
    label: 'Somente mencionados',
    description: 'Só recebe push quem foi mencionado ou selecionado como destinatário.',
  },
  {
    value: 'direct_messages_only',
    label: 'Somente conversas individuais',
    description: 'Mensagens deste grupo não geram push; conversas individuais continuam gerando.',
  },
  {
    value: 'disabled',
    label: 'Desativadas',
    description: 'Nenhuma mensagem desta conversa gera push.',
  },
];

/** Documento users/{uid}/devices/{deviceId}. */
export type DeviceRegistration = {
  token: string;
  platform: 'android' | 'ios';
  enabled: boolean;
  updatedAt: number;
};

/** Dados que a API envia no payload do push para identificar a conversa. */
export type NotificationPayload = {
  conversationId: string;
  conversationType: ConversationType;
};

export type PushStatus = 'pending' | 'registered' | 'denied' | 'unavailable' | 'error';
