import type { DocumentReference } from 'firebase-admin/firestore';

import type { ConversationType } from '../types';
import { messaging } from './firebaseAdmin';

export type Device = { ref: DocumentReference; token: string; platform: 'android' | 'ios' };

export type PushContent = {
  title: string;
  body: string;
  /** Vai no payload para o app abrir a conversa certa ao tocar na notificação. */
  data: { conversationId: string; conversationType: ConversationType };
};

/** Canal Android criado pelo app (notificationService.ts) e declarado em app.json. */
const ANDROID_CHANNEL = 'messages';
const FCM_BATCH = 500;
const EXPO_BATCH = 100;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Respostas do FCM que indicam token definitivamente inválido.
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
}

/** Android: Firebase Cloud Messaging (HTTP v1) via Admin SDK. Devolve os dispositivos com token inválido. */
async function sendToAndroid(devices: Device[], content: PushContent): Promise<{ sent: number; invalid: Device[] }> {
  let sent = 0;
  const invalid: Device[] = [];
  for (const batch of chunk(devices, FCM_BATCH)) {
    const result = await messaging.sendEachForMulticast({
      tokens: batch.map((device) => device.token),
      notification: { title: content.title, body: content.body },
      data: content.data,
      android: { priority: 'high', notification: { channelId: ANDROID_CHANNEL, sound: 'default' } },
    });
    sent += result.successCount;
    result.responses.forEach((response, index) => {
      if (response.error && INVALID_TOKEN_CODES.has(response.error.code)) invalid.push(batch[index]);
    });
  }
  return { sent, invalid };
}

/** iOS: Expo Push Service, que entrega pelo APNs. */
async function sendToIos(devices: Device[], content: PushContent): Promise<{ sent: number; invalid: Device[] }> {
  let sent = 0;
  const invalid: Device[] = [];
  for (const batch of chunk(devices, EXPO_BATCH)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map((device) => ({ to: device.token, sound: 'default', ...content }))),
    });
    if (!response.ok) throw new Error(`Expo Push Service respondeu ${response.status}`);
    const { data: tickets } = (await response.json()) as { data: ExpoTicket[] };
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'ok') sent += 1;
      else if (ticket.details?.error === 'DeviceNotRegistered') invalid.push(batch[index]);
    });
  }
  return { sent, invalid };
}

/** Envia o push e remove do Firestore os tokens que o provedor recusou como inválidos. */
export async function sendPush(devices: readonly Device[], content: PushContent): Promise<{ sent: number; failed: number }> {
  const android = devices.filter((device) => device.platform === 'android');
  const ios = devices.filter((device) => device.platform === 'ios');
  const results = await Promise.all([
    android.length ? sendToAndroid(android, content) : { sent: 0, invalid: [] },
    ios.length ? sendToIos(ios, content) : { sent: 0, invalid: [] },
  ]);
  const sent = results[0].sent + results[1].sent;
  const invalid = [...results[0].invalid, ...results[1].invalid];
  await Promise.all(invalid.map((device) => device.ref.delete()));
  return { sent, failed: devices.length - sent };
}
