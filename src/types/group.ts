import type { NotificationPolicy } from './notification';

/** Documento groups/{groupId}. Só a API grava; o app lê em tempo real. */
export type ChatGroup = {
  id: string;
  name: string;
  photoUrl: string;
  ownerId: string;
  memberIds: string[];
  memberLimit: number;
  notificationPolicy: NotificationPolicy;
  createdAt: number;
  updatedAt: number;
};

/** Configurações que o proprietário pode alterar. */
export type GroupSettings = Pick<ChatGroup, 'name' | 'photoUrl' | 'memberLimit' | 'notificationPolicy'>;

export type NewGroupInput = GroupSettings & { memberIds: string[] };
