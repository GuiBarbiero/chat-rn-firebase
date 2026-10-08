import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import type { DeviceRegistration, NotificationPayload, PushStatus } from '../types/notification';
import { apiRequest } from './api';
import { db } from './firebase';

// O app só registra o dispositivo e reage às notificações. O envio do push fica na API online,
// que é quem tem a credencial administrativa e calcula os destinatários.

/** Mesmo id usado pela API em android.notification.channelId e em app.json (defaultChannel). */
const MESSAGES_CHANNEL = 'messages';
const DEVICE_ID_KEY = 'chat.deviceId';

type PushToken = Pick<DeviceRegistration, 'token' | 'platform'>;

let activeConversationId: string | null = null;
let lastHandledNotificationId: string | null = null;

/** A conversa que está aberta não gera banner: a mensagem já aparece na tela em tempo real. */
export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

/** Extrai conversationId e conversationType dos dados do payload enviado pela API. */
export function parseNotificationPayload(data: unknown): NotificationPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const { conversationId, conversationType } = data as Record<string, unknown>;
  if (typeof conversationId !== 'string' || !conversationId) return null;
  if (conversationType !== 'direct' && conversationType !== 'group') return null;
  return { conversationId, conversationType };
}

if (Platform.OS !== 'web') {
  // Recebimento com o app em primeiro plano.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const payload = parseNotificationPayload(notification.request.content.data);
      const show = payload?.conversationId !== activeConversationId;
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
}

async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const created = doc(collection(db, 'devices')).id; // só gera um id aleatório; nada é gravado nessa coleção
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

async function getPushToken(): Promise<PushToken> {
  if (Platform.OS === 'android') {
    // Token nativo do Firebase Cloud Messaging; a API envia direto pelo FCM.
    const token = await Notifications.getDevicePushTokenAsync();
    if (token.type !== 'android') throw new Error('Token de push inesperado.');
    return { token: token.data, platform: 'android' };
  }
  // iOS: token do Expo Push Service (entrega via APNs). Exige o projectId do EAS no build.
  const token = await Notifications.getExpoPushTokenAsync();
  return { token: token.data, platform: 'ios' };
}

async function saveDevice(uid: string, pushToken: PushToken): Promise<void> {
  const registration: DeviceRegistration = { ...pushToken, enabled: true, updatedAt: Date.now() };
  await setDoc(doc(db, 'users', uid, 'devices', await getDeviceId()), registration);
}

/** Pede a permissão, obtém o token e registra o dispositivo em users/{uid}/devices/{deviceId}. */
export async function registerDevice(uid: string): Promise<PushStatus> {
  if (Platform.OS === 'web') return 'unavailable';
  if (Platform.OS === 'android') {
    // No Android 13+ o pedido de permissão só aparece depois que existe um canal.
    await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL, {
      name: 'Mensagens',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';

  let pushToken: PushToken;
  try {
    pushToken = await getPushToken();
  } catch {
    return 'unavailable'; // emulador sem Google Play, Expo Go ou build sem credenciais de push
  }
  await saveDevice(uid, pushToken);
  return 'registered';
}

/** O sistema pode trocar o token a qualquer momento; mantém o documento do dispositivo atualizado. */
export function listenToTokenRefresh(uid: string): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addPushTokenListener(() => {
    getPushToken()
      .then((pushToken) => saveDevice(uid, pushToken))
      .catch(() => undefined);
  });
  return () => subscription.remove();
}

/** Chamado no logout, ainda autenticado: este aparelho deixa de receber os pushes do usuário. */
export async function unregisterDevice(uid: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await deleteDoc(doc(db, 'users', uid, 'devices', await getDeviceId()));
}

/** Toque na notificação: entrega os dados da conversa para a navegação abrir o chat certo. */
export function listenToNotificationTaps(onOpen: (payload: NotificationPayload) => void): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { identifier, content } = response.notification.request;
    if (identifier === lastHandledNotificationId) return;
    lastHandledNotificationId = identifier;
    Notifications.clearLastNotificationResponse();
    const payload = parseNotificationPayload(content.data);
    if (payload) onOpen(payload);
  };
  handle(Notifications.getLastNotificationResponse()); // app estava fechado e foi aberto pelo toque
  const subscription = Notifications.addNotificationResponseReceivedListener(handle); // app em segundo plano
  return () => subscription.remove();
}

/** Depois de persistir a mensagem, pede o push à API. Os destinatários são calculados no servidor. */
export async function requestMessagePush(conversationId: string, messageId: string): Promise<void> {
  await apiRequest<unknown>('POST', '/notifications/messages', { conversationId, messageId });
}
