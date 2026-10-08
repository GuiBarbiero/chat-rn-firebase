import {
  limitToLast,
  onValue,
  orderByChild,
  push,
  query as rtdbQuery,
  ref,
  serverTimestamp,
  set,
} from 'firebase/database';
import { collection, doc, onSnapshot, query, runTransaction, where, type Unsubscribe } from 'firebase/firestore';

import type { ChatMessage, DirectConversation, NewMessage, StoredMessage } from '../types/chat';
import { AppError } from '../utils/errors';
import { directConversationId } from '../utils/conversationId';
import { db, readDoc, rtdb } from './firebase';

// ponytail: só as últimas 200 mensagens ficam sob listener; paginar o histórico quando isso fizer falta.
const MESSAGE_WINDOW = 200;

const messagesRef = (conversationId: string) => ref(rtdb, `messages/${conversationId}`);

const toDirectConversation = (snapshot: Parameters<typeof readDoc>[0]): DirectConversation => ({
  ...readDoc<Omit<DirectConversation, 'type'>>(snapshot, 'id'),
  type: 'direct',
});

/** Localiza a conversa individual do par ou cria uma (a transação evita duplicar em toques simultâneos). */
export async function getOrCreateDirectConversation(myUid: string, otherUid: string): Promise<string> {
  if (myUid === otherUid) throw new AppError('Você não pode conversar consigo mesmo.');
  const id = directConversationId(myUid, otherUid);
  const reference = doc(db, 'directConversations', id);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists()) return;
    const conversation: Omit<DirectConversation, 'id' | 'type'> = {
      participantIds: myUid < otherUid ? [myUid, otherUid] : [otherUid, myUid],
      createdAt: Date.now(),
    };
    transaction.set(reference, conversation);
  });
  return id;
}

export function listenToDirectConversations(
  uid: string,
  onData: (conversations: DirectConversation[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'directConversations'), where('participantIds', 'array-contains', uid)),
    (snapshot) => onData(snapshot.docs.map(toDirectConversation)),
    onError,
  );
}

/** Persiste a mensagem no Realtime Database e devolve o id gerado. */
export async function sendMessage(message: NewMessage): Promise<string> {
  const { conversationId, ...content } = message;
  const reference = push(messagesRef(conversationId));
  if (!reference.key) throw new AppError('Não foi possível gerar a mensagem. Tente novamente.');
  // createdAt vem do servidor; as regras exigem `now`, então o cliente não consegue forjar a data.
  await set(reference, { ...content, createdAt: serverTimestamp() });
  return reference.key;
}

/** Escuta a conversa em tempo real. A função devolvida remove o listener. */
export function listenToMessages(
  conversationId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    // Ordena pelo createdAt, que as regras obrigam a ser o horário do servidor. Ordenar pela chave
    // deixaria um participante esconder as mensagens novas escolhendo chaves "maiores".
    rtdbQuery(messagesRef(conversationId), orderByChild('createdAt'), limitToLast(MESSAGE_WINDOW)),
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const stored = child.val() as StoredMessage;
        messages.push({
          ...stored,
          id: child.key,
          conversationId,
          // Com índices esparsos o Realtime Database devolve objeto em vez de lista.
          mentionedUserIds: Object.values<string>(stored.mentionedUserIds ?? {}),
        });
      });
      onData(messages);
    },
    onError,
  );
}
