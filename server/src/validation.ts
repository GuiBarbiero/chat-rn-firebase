import { HttpError, NOTIFICATION_POLICIES, type GroupSettings, type NotificationPolicy } from './types';

export const MIN_GROUP_MEMBERS = 2;
// ponytail: teto de 100 integrantes. O envio já é fatiado por lote; subir exige rever o custo de leitura por mensagem.
export const MAX_GROUP_LIMIT = 100;
const MAX_GROUP_NAME = 60;

type Body = Record<string, unknown>;

export function asObject(value: unknown): Body {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'Corpo da requisição inválido.');
  }
  return value as Body;
}

/** Ids viram segmentos de caminho no Firestore e no Realtime Database: só caracteres seguros passam. */
export function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpError(400, `Campo "${field}" inválido.`);
  }
  return value;
}

export function parseIdList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_GROUP_LIMIT) throw new HttpError(400, `Campo "${field}" inválido.`);
  return value.map((item) => requireId(item, field));
}

const isPolicy = (value: unknown): value is NotificationPolicy =>
  NOTIFICATION_POLICIES.some((policy) => policy === value);

/** Valida apenas os campos presentes; quem cria o grupo exige todos (veja groupService.createGroup). */
export function parseGroupSettings(body: Body): Partial<GroupSettings> {
  const settings: Partial<GroupSettings> = {};
  const { name, photoUrl, memberLimit, notificationPolicy } = body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_GROUP_NAME) {
      throw new HttpError(400, `O nome do grupo deve ter de 1 a ${MAX_GROUP_NAME} caracteres.`);
    }
    settings.name = name.trim();
  }
  if (photoUrl !== undefined) {
    // Só URL https (ou vazio): impede gravar imagem em Base64 no Firestore.
    if (typeof photoUrl !== 'string' || (photoUrl !== '' && !/^https:\/\/\S{1,500}$/.test(photoUrl))) {
      throw new HttpError(400, 'A foto do grupo deve ser uma URL https.');
    }
    settings.photoUrl = photoUrl;
  }
  if (memberLimit !== undefined) {
    if (typeof memberLimit !== 'number' || !Number.isInteger(memberLimit)) {
      throw new HttpError(400, 'O limite de integrantes deve ser um número inteiro.');
    }
    if (memberLimit < MIN_GROUP_MEMBERS || memberLimit > MAX_GROUP_LIMIT) {
      throw new HttpError(400, `O limite de integrantes deve ficar entre ${MIN_GROUP_MEMBERS} e ${MAX_GROUP_LIMIT}.`);
    }
    settings.memberLimit = memberLimit;
  }
  if (notificationPolicy !== undefined) {
    if (!isPolicy(notificationPolicy)) throw new HttpError(400, 'Política de notificações inválida.');
    settings.notificationPolicy = notificationPolicy;
  }
  return settings;
}
