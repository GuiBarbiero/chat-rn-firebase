export const MIN_GROUP_MEMBERS = 2;
export const MAX_GROUP_LIMIT = 100;
export const MAX_GROUP_NAME = 60;

/** Aceita somente inteiros; "5.5", "abc" e "" viram null. */
export function parseMemberLimit(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

export function availableSlots(memberLimit: number, memberCount: number): number {
  return Math.max(0, memberLimit - memberCount);
}

type GroupFormValues = { name: string; memberLimit: number | null; memberCount: number };

/** Mesma validação aplicada pela API; aqui serve para dar feedback antes de enviar. */
export function validateGroup({ name, memberLimit, memberCount }: GroupFormValues): string | null {
  const trimmedName = name.trim();
  if (!trimmedName) return 'Informe o nome do grupo.';
  if (trimmedName.length > MAX_GROUP_NAME) return `O nome pode ter no máximo ${MAX_GROUP_NAME} caracteres.`;
  if (memberLimit === null) return 'O limite de integrantes deve ser um número inteiro.';
  if (memberLimit < MIN_GROUP_MEMBERS) return `O limite mínimo é de ${MIN_GROUP_MEMBERS} integrantes.`;
  if (memberLimit > MAX_GROUP_LIMIT) return `O limite máximo é de ${MAX_GROUP_LIMIT} integrantes.`;
  if (memberCount < MIN_GROUP_MEMBERS) return 'Selecione pelo menos um integrante além de você.';
  if (memberLimit < memberCount) {
    return `O limite não pode ser menor que a quantidade atual de integrantes (${memberCount}).`;
  }
  return null;
}
