import { FieldValue } from 'firebase-admin/firestore';

import { HttpError, type GroupDoc, type GroupSettings } from '../types';
import { MIN_GROUP_MEMBERS } from '../validation';
import { firestore, rtdb } from './firebaseAdmin';

// Grupos vivem em dois bancos: o documento (integrantes, limite, política) fica no Firestore e as
// mensagens no Realtime Database. Como as regras de um banco não enxergam o outro, toda alteração
// de grupo passa por aqui: a transação do Firestore decide e o resultado é espelhado em
// groupMembers/{groupId}/{uid} no Realtime Database, que é o que libera ler e enviar mensagens.

const groupRef = (groupId: string) => firestore.doc(`groups/${groupId}`);
/** Índice "grupos de cada usuário", usado pelas regras do Firestore para liberar a leitura de perfis. */
const userGroupsRef = (uid: string) => firestore.doc(`userGroups/${uid}`);
const membersRef = (groupId: string) => rtdb.ref(`groupMembers/${groupId}`);

const OWNER_ONLY = 'Somente o proprietário pode gerenciar o grupo.';

async function assertUsersExist(uids: readonly string[]): Promise<void> {
  const profiles = await firestore.getAll(...uids.map((uid) => firestore.doc(`publicProfiles/${uid}`)));
  if (profiles.some((profile) => !profile.exists)) throw new HttpError(404, 'Usuário não encontrado.');
}

export async function createGroup(
  ownerId: string,
  settings: Partial<GroupSettings>,
  requestedMemberIds: readonly string[],
): Promise<string> {
  const { name, memberLimit, notificationPolicy, photoUrl = '' } = settings;
  if (name === undefined || memberLimit === undefined || notificationPolicy === undefined) {
    throw new HttpError(400, 'Informe nome, limite de integrantes e política de notificações.');
  }
  const memberIds = [...new Set([ownerId, ...requestedMemberIds])];
  if (memberIds.length < MIN_GROUP_MEMBERS) {
    throw new HttpError(400, 'O grupo precisa de pelo menos dois integrantes.');
  }
  if (memberIds.length > memberLimit) {
    throw new HttpError(409, 'A quantidade de integrantes ultrapassa o limite do grupo.');
  }
  await assertUsersExist(memberIds);

  const reference = firestore.collection('groups').doc();
  const now = Date.now();
  const group: GroupDoc = { name, photoUrl, ownerId, memberIds, memberLimit, notificationPolicy, createdAt: now, updatedAt: now };

  // O acesso às mensagens é liberado antes: o id ainda não existe para ninguém, então não há exposição.
  await membersRef(reference.id).set(Object.fromEntries(memberIds.map((uid) => [uid, true])));
  const batch = firestore.batch();
  batch.create(reference, group);
  for (const uid of memberIds) {
    batch.set(userGroupsRef(uid), { groupIds: FieldValue.arrayUnion(reference.id) }, { merge: true });
  }
  await batch.commit();
  return reference.id;
}

export async function updateGroup(requesterId: string, groupId: string, changes: Partial<GroupSettings>): Promise<void> {
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(groupRef(groupId));
    if (!snapshot.exists) throw new HttpError(404, 'Grupo não encontrado.');
    const group = snapshot.data() as GroupDoc;
    if (group.ownerId !== requesterId) throw new HttpError(403, OWNER_ONLY);
    if (changes.memberLimit !== undefined && changes.memberLimit < group.memberIds.length) {
      throw new HttpError(409, `O limite não pode ser menor que a quantidade atual de integrantes (${group.memberIds.length}).`);
    }
    transaction.update(groupRef(groupId), { ...changes, updatedAt: Date.now() });
  });
}

/**
 * Adiciona um integrante respeitando o limite mesmo com requisições simultâneas: a transação lê o
 * grupo, confere a capacidade e grava. Se outra inclusão acontecer no meio, o Firestore refaz a
 * transação com o dado novo, então duas requisições nunca ocupam a mesma vaga.
 */
export async function addMember(requesterId: string, groupId: string, memberId: string): Promise<void> {
  await assertUsersExist([memberId]);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(groupRef(groupId));
    if (!snapshot.exists) throw new HttpError(404, 'Grupo não encontrado.');
    const group = snapshot.data() as GroupDoc;
    if (group.ownerId !== requesterId) throw new HttpError(403, OWNER_ONLY);
    if (group.memberIds.includes(memberId)) return; // já é integrante: repetir a chamada não muda nada
    if (group.memberIds.length >= group.memberLimit) {
      throw new HttpError(409, 'O grupo atingiu o limite de integrantes.');
    }
    transaction.update(groupRef(groupId), { memberIds: [...group.memberIds, memberId], updatedAt: Date.now() });
    transaction.set(userGroupsRef(memberId), { groupIds: FieldValue.arrayUnion(groupId) }, { merge: true });
  });
  // Só depois de confirmado no Firestore o integrante ganha acesso às mensagens.
  await membersRef(groupId).child(memberId).set(true);
}

export async function removeMember(requesterId: string, groupId: string, memberId: string): Promise<void> {
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(groupRef(groupId));
    if (!snapshot.exists) throw new HttpError(404, 'Grupo não encontrado.');
    const group = snapshot.data() as GroupDoc;
    if (group.ownerId !== requesterId) throw new HttpError(403, OWNER_ONLY);
    if (memberId === group.ownerId) throw new HttpError(400, 'O proprietário não pode ser removido do grupo.');
    if (!group.memberIds.includes(memberId)) return;
    if (group.memberIds.length <= MIN_GROUP_MEMBERS) {
      throw new HttpError(409, 'O grupo precisa manter pelo menos dois integrantes.');
    }
    transaction.update(groupRef(groupId), {
      memberIds: group.memberIds.filter((uid) => uid !== memberId),
      updatedAt: Date.now(),
    });
    transaction.set(userGroupsRef(memberId), { groupIds: FieldValue.arrayRemove(groupId) }, { merge: true });
  });
  // Revoga o acesso às mensagens. A operação é idempotente: se esta escrita falhar, repetir a chamada conclui.
  await membersRef(groupId).child(memberId).remove();
}
