import { collection, doc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';

import type { ChatGroup, GroupSettings, NewGroupInput } from '../types/group';
import { apiRequest } from './api';
import { db, readDoc } from './firebase';

// Leitura: direto do Firestore, em tempo real (as regras só liberam para integrantes).
// Escrita: sempre pela API, que valida proprietário e capacidade em transação e espelha os
// integrantes no Realtime Database. O cliente não tem permissão de escrita em groups/.

export function listenToGroups(
  uid: string,
  onData: (groups: ChatGroup[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)),
    (snapshot) => onData(snapshot.docs.map((document) => readDoc<ChatGroup>(document, 'id'))),
    onError,
  );
}

export function listenToGroup(
  groupId: string,
  onData: (group: ChatGroup | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snapshot) => onData(snapshot.exists() ? readDoc<ChatGroup>(snapshot, 'id') : null),
    onError,
  );
}

export async function createGroup(input: NewGroupInput): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('POST', '/groups', input);
  return id;
}

/** Atualiza nome, foto, limite de integrantes e/ou política de notificações. */
export async function updateGroup(groupId: string, changes: Partial<GroupSettings>): Promise<void> {
  await apiRequest<unknown>('PATCH', `/groups/${groupId}`, changes);
}

export async function addMember(groupId: string, memberId: string): Promise<void> {
  await apiRequest<unknown>('POST', `/groups/${groupId}/members`, { memberId });
}

export async function removeMember(groupId: string, memberId: string): Promise<void> {
  await apiRequest<unknown>('DELETE', `/groups/${groupId}/members/${memberId}`);
}
