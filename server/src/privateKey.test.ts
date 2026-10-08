import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';

import { normalizePrivateKey } from './privateKey';

// Chave descartável, gerada a cada execução do teste.
const { privateKey: pem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').trim();
const escaped = pem.replace(/\n/g, '\\n');

const formats: Record<string, string> = {
  'quebras de linha reais': pem,
  '"\\n" literais (como no JSON)': escaped,
  'entre aspas duplas': `"${escaped}"`,
  'entre aspas simples': `'${escaped}'`,
  'com vírgula no final (copiado do JSON)': `"${escaped}",`,
  'CRLF': pem.replace(/\n/g, '\r\n'),
  'quebras trocadas por espaços': pem.replace(/\n/g, ' '),
  'sem nenhuma quebra': pem.replace(/\n/g, ''),
  'só o miolo, com "\\n" literais': body.replace(/\n/g, '\\n'),
  'só o miolo, em uma linha': body.replace(/\n/g, ''),
  'com espaços em volta': `  ${escaped}  `,
};

for (const [name, value] of Object.entries(formats)) {
  test(`aceita a chave ${name}`, () => {
    const normalized = normalizePrivateKey(value);
    assert.ok(normalized);
    // Se o PEM reconstruído for a mesma chave, exportá-lo devolve o original.
    assert.equal(createPrivateKey(normalized).export({ type: 'pkcs8', format: 'pem' }), pem);
  });
}

test('valor ausente ou sem Base64 não vira chave', () => {
  assert.equal(normalizePrivateKey(undefined), undefined);
  assert.equal(normalizePrivateKey(''), undefined);
  assert.equal(normalizePrivateKey('  "" '), undefined);
});
