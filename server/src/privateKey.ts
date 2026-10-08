/**
 * Reconstrói o PEM da chave privada a partir do miolo em Base64.
 *
 * O valor costuma ser colado na hospedagem direto do JSON da conta de serviço e chega de várias
 * formas: com quebras de linha reais, com "\n" literais, entre aspas, com as quebras trocadas por
 * espaços ou só o miolo, sem as linhas BEGIN/END. Todas viram o mesmo PEM.
 */
export function normalizePrivateKey(raw: string | undefined): string | undefined {
  const body = raw
    ?.replace(/\\[rn]/g, '\n') // "\n" literal vira quebra de verdade (senão o "n" entraria no Base64)
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '');
  if (!body) return undefined;
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
}
