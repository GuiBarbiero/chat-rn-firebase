export const NOTIFICATION_POLICIES = ['all_group_messages', 'mentioned_members', 'direct_messages_only', 'disabled'] as const;

export type NotificationPolicy = (typeof NOTIFICATION_POLICIES)[number];

export type ConversationType = 'direct' | 'group';

export type MessageTarget = { type: 'conversation' } | { type: 'member'; memberId: string };

/** messages/{conversationId}/{messageId} no Realtime Database. */
export type StoredMessage = {
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds?: string[];
  createdAt: number;
};

/** groups/{groupId} no Firestore. */
export type GroupDoc = {
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  createdAt: number;
  updatedAt: number;
};

export type GroupSettings = Pick<GroupDoc, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>;

/** directConversations/{id} no Firestore. */
export type DirectConversationDoc = { participantIds: string[]; createdAt: number };

/** users/{uid}/devices/{deviceId} no Firestore. */
export type DeviceDoc = { token: string; platform: 'android' | 'ios'; enabled: boolean; updatedAt: number };

/** Erro com status HTTP e mensagem segura para devolver ao app. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
