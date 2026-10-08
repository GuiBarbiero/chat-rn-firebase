import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { NotificationPolicy } from '../types';
import { resolveRecipients } from './recipientResolver';

const members = ['ana', 'bia', 'caio', 'duda'];

const inGroup = (policy: NotificationPolicy, overrides: { target?: string; mentions?: string[] } = {}) =>
  resolveRecipients({
    conversationType: 'group',
    participantIds: members,
    senderId: 'ana',
    policy,
    target: overrides.target ? { type: 'member', memberId: overrides.target } : { type: 'conversation' },
    mentionedUserIds: overrides.mentions ?? [],
  });

test('conversa individual notifica só o outro participante', () => {
  assert.deepEqual(
    resolveRecipients({ conversationType: 'direct', participantIds: ['ana', 'bia'], senderId: 'ana' }),
    ['bia'],
  );
});

test('all_group_messages notifica todos, exceto o remetente', () => {
  assert.deepEqual(inGroup('all_group_messages'), ['bia', 'caio', 'duda']);
  assert.deepEqual(inGroup('all_group_messages', { target: 'bia' }), ['bia', 'caio', 'duda']);
});

test('mentioned_members notifica só mencionados ou selecionados', () => {
  assert.deepEqual(inGroup('mentioned_members'), []);
  assert.deepEqual(inGroup('mentioned_members', { target: 'caio' }), ['caio']);
  assert.deepEqual(inGroup('mentioned_members', { mentions: ['duda', 'bia'] }), ['bia', 'duda']);
  assert.deepEqual(inGroup('mentioned_members', { target: 'caio', mentions: ['bia'] }), ['bia', 'caio']);
});

test('mentioned_members ignora o remetente e quem não é integrante', () => {
  assert.deepEqual(inGroup('mentioned_members', { target: 'ana', mentions: ['ana', 'intruso'] }), []);
});

test('direct_messages_only e disabled não geram push em grupo', () => {
  assert.deepEqual(inGroup('direct_messages_only', { target: 'bia', mentions: ['caio'] }), []);
  assert.deepEqual(inGroup('disabled', { target: 'bia', mentions: ['caio'] }), []);
});
