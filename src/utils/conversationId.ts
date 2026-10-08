/**
 * Id determinístico da conversa individual: os dois uid ordenados.
 * O mesmo par sempre gera o mesmo id, então não existem duas conversas para o mesmo par.
 * As regras do Firestore e do Realtime Database usam esse mesmo formato.
 */
export function directConversationId(uidA: string, uidB: string): string {
  if (uidA === uidB) throw new Error('Uma conversa individual precisa de dois usuários diferentes.');
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export function otherParticipantId(conversationId: string, myUid: string): string {
  const [first, second] = conversationId.split('_');
  return first === myUid ? second : first;
}
