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
type SendResult = { sent: number; invalid: Device[] };

const EMPTY: SendResult = { sent: 0, invalid: [] };

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
    logRefusals('FCM', batch.length, result.responses.flatMap((response) => (response.error ? [response.error.code] : [])));
  }
  return { sent, invalid };
}

/** Registra no log por que o provedor recusou envios (só os códigos de erro, nunca os tokens). */
function logRefusals(provider: string, total: number, codes: string[]): void {
  if (codes.length === 0) return;
  console.warn(`${provider} recusou ${codes.length} de ${total} envios:`, [...new Set(codes)].join(', '));
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
    logRefusals(
      'Expo',
      batch.length,
      tickets.flatMap((ticket) => (ticket.status === 'error' ? [ticket.details?.error ?? 'desconhecido'] : [])),
    );
  }
  return { sent, invalid };
}

/** Envia o push e remove do Firestore os tokens que o provedor recusou como inválidos. */
export async function sendPush(devices: readonly Device[], content: PushContent): Promise<{ sent: number; failed: number }> {
  const android = devices.filter((device) => device.platform === 'android');
  const ios = devices.filter((device) => device.platform === 'ios');
  // Um provedor fora do ar não pode derrubar o envio do outro: se o Expo falhar depois de o FCM já
  // ter entregue, a chamada ainda termina bem e o recibo fica, evitando push repetido em um reenvio.
  const outcomes = await Promise.allSettled([
    android.length ? sendToAndroid(android, content) : EMPTY,
    ios.length ? sendToIos(ios, content) : EMPTY,
  ]);
  const results = outcomes.map((outcome) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    console.warn('Envio de push falhou:', outcome.reason instanceof Error ? outcome.reason.message : outcome.reason);
    return EMPTY;
  });
  const sent = results.reduce((total, result) => total + result.sent, 0);
  await Promise.allSettled(results.flatMap((result) => result.invalid).map((device) => device.ref.delete()));
  // Nada foi entregue e um provedor falhou: não há push repetido a evitar, então o erro sobe, a rota
  // libera o recibo e o app avisa que a notificação não foi disparada.
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure && sent === 0) throw failure.reason;
  return { sent, failed: devices.length - sent };
}
