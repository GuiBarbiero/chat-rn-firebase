export type ConversationType = 'direct' | 'group';

/** Documento directConversations/{id}; o id são os dois uid ordenados e unidos por "_". */
export type DirectConversation = {
  id: string;
  type: 'direct';
  participantIds: [string, string];
  createdAt: number;
};

export type MessageTarget = { type: 'conversation' } | { type: 'member'; memberId: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType: ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};

/** Formato gravado em messages/{conversationId}/{messageId} (o Realtime Database omite arrays vazios). */
export type StoredMessage = Omit<ChatMessage, 'id' | 'conversationId' | 'mentionedUserIds'> & {
  mentionedUserIds?: string[];
};

export type NewMessage = Omit<ChatMessage, 'id' | 'createdAt'>;

/** Item da lista de conversas, já com nome e foto resolvidos. */
export type ConversationSummary = {
  id: string;
  type: ConversationType;
  title: string;
  photoUrl: string;
  subtitle: string;
  createdAt: number;
};
