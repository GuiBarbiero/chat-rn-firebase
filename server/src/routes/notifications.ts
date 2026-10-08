import { Router } from 'express';

import { firestore, rtdb } from '../services/firebaseAdmin';
import { sendPush, type Device } from '../services/notificationSender';
import { resolveRecipients } from '../services/recipientResolver';
import {
  HttpError,
  type DeviceDoc,
  type DirectConversationDoc,
  type GroupDoc,
  type NotificationPolicy,
  type StoredMessage,
} from '../types';
import { asObject, requireId } from '../validation';

export const notificationsRouter = Router();

type Conversation =
  | { type: 'direct'; participantIds: string[] }
  | { type: 'group'; participantIds: string[]; policy: NotificationPolicy; name: string };

/** Participantes e política vêm sempre do Firestore, nunca do corpo da requisição. */
async function loadConversation(conversationId: string): Promise<Conversation> {
  const [direct, group] = await firestore.getAll(
    firestore.doc(`directConversations/${conversationId}`),
    firestore.doc(`groups/${conversationId}`),
  );
  if (direct.exists) {
    return { type: 'direct', participantIds: (direct.data() as DirectConversationDoc).participantIds };
  }
  if (group.exists) {
    const data = group.data() as GroupDoc;
    return { type: 'group', participantIds: data.memberIds, policy: data.notificationPolicy, name: data.name };
  }
  throw new HttpError(404, 'Conversa não encontrada.');
}

async function loadDevices(uids: readonly string[]): Promise<Device[]> {
  const snapshots = await Promise.all(
    uids.map((uid) => firestore.collection(`users/${uid}/devices`).where('enabled', '==', true).get()),
  );
  return snapshots.flatMap((snapshot) =>
    snapshot.docs.map((document) => {
      const { token, platform } = document.data() as DeviceDoc;
      return { ref: document.ref, token, platform };
    }),
  );
}

const isAlreadyExists = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 6; // gRPC ALREADY_EXISTS

/**
 * POST /notifications/messages  { conversationId, messageId }
 * Chamado pelo app depois de persistir a mensagem. Confere a mensagem, calcula os destinatários
 * pela política da conversa e envia o push. Reenviar a mesma mensagem não gera push repetido.
 */
notificationsRouter.post('/messages', async (req, res) => {
  const body = asObject(req.body);
  const conversationId = requireId(body.conversationId, 'conversationId');
  const messageId = requireId(body.messageId, 'messageId');

  // 1. A mensagem existe no Realtime Database e foi enviada pelo usuário autenticado?
  const snapshot = await rtdb.ref(`messages/${conversationId}/${messageId}`).get();
  if (!snapshot.exists()) throw new HttpError(404, 'Mensagem não encontrada.');
  const message = snapshot.val() as StoredMessage;
  if (message.senderId !== req.uid) {
    throw new HttpError(403, 'Somente o remetente pode solicitar a notificação desta mensagem.');
  }

  // 2. O remetente ainda participa da conversa?
  const conversation = await loadConversation(conversationId);
  if (!conversation.participantIds.includes(req.uid)) throw new HttpError(403, 'Você não participa desta conversa.');

  // 3. Proteção contra chamadas duplicadas: create() falha se o recibo desta mensagem já existir.
  const receipt = firestore.doc(`pushReceipts/${conversationId}_${messageId}`);
  try {
    await receipt.create({ senderId: req.uid, createdAt: Date.now() });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
    res.json({ status: 'duplicate', recipients: 0, sent: 0, failed: 0 });
    return;
  }

  try {
    // 4. Destinatários calculados no servidor.
    const recipients = resolveRecipients(
      conversation.type === 'direct'
        ? { conversationType: 'direct', participantIds: conversation.participantIds, senderId: req.uid }
        : {
            conversationType: 'group',
            participantIds: conversation.participantIds,
            senderId: req.uid,
            policy: conversation.policy,
            target: message.target,
            mentionedUserIds: message.mentionedUserIds ?? [],
          },
    );
    if (recipients.length === 0) {
      res.json({ status: 'skipped', recipients: 0, sent: 0, failed: 0 });
      return;
    }

    // 5. O texto da mensagem não vai no push: só quem enviou e em qual conversa.
    const [devices, sender] = await Promise.all([loadDevices(recipients), firestore.doc(`publicProfiles/${req.uid}`).get()]);
    const senderName = (sender.get('name') as string | undefined) ?? 'Alguém';
    const result = await sendPush(devices, {
      title: conversation.type === 'group' ? conversation.name : senderName,
      body: conversation.type === 'group' ? `${senderName} enviou uma mensagem` : 'Enviou uma nova mensagem',
      data: { conversationId, conversationType: conversation.type },
    });
    res.json({ status: 'sent', recipients: recipients.length, ...result });
  } catch (error) {
    // Falhou antes de concluir: libera o recibo para que uma nova tentativa possa enviar.
    await receipt.delete().catch(() => undefined);
    throw error;
  }
});
