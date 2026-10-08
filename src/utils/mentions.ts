import type { PublicProfile } from '../types/user';

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** Integrantes mencionados no texto com @PrimeiroNome (sem diferenciar maiúsculas). */
export function extractMentions(text: string, members: readonly PublicProfile[]): string[] {
  const tokens = new Set((text.toLowerCase().match(/@[^\s@,.;:!?]+/g) ?? []).map((token) => token.slice(1)));
  if (tokens.size === 0) return [];
  return members.filter((member) => tokens.has(firstName(member.name).toLowerCase())).map((member) => member.uid);
}
