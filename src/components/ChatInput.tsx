import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '../theme';
import type { MessageTarget } from '../types/chat';
import type { PublicProfile } from '../types/user';
import { firstName } from '../utils/mentions';

type ChatInputProps = {
  sending: boolean;
  /** Em grupos: os outros integrantes, para escolher um destinatário. Em conversas individuais, omitir. */
  members?: readonly PublicProfile[];
  /** Devolve true se a mensagem foi persistida; só então o campo é limpo. */
  onSend: (text: string, target: MessageTarget) => Promise<boolean>;
};

export function ChatInput({ sending, members, onSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);

  // Se o integrante escolhido sair do grupo, o destino volta a ser a conversa inteira.
  const target = useMemo<MessageTarget>(
    () =>
      targetId && members?.some((member) => member.uid === targetId)
        ? { type: 'member', memberId: targetId }
        : { type: 'conversation' },
    [targetId, members],
  );

  const canSend = text.trim().length > 0 && !sending;

  const handleSend = useCallback(async () => {
    if (await onSend(text, target)) {
      setText('');
      setTargetId(null);
    }
  }, [onSend, text, target]);

  return (
    <View style={styles.container}>
      {members && members.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targets}>
          <Text style={styles.targetsLabel}>Para:</Text>
          <TargetChip label="Todos" selected={target.type === 'conversation'} onPress={() => setTargetId(null)} />
          {members.map((member) => (
            <TargetChip
              key={member.uid}
              label={firstName(member.name)}
              selected={target.type === 'member' && target.memberId === member.uid}
              onPress={() => setTargetId(member.uid)}
            />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel="Mensagem"
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={members ? 'Mensagem (use @nome para mencionar)' : 'Mensagem'}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={handleSend}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.sendText}>Enviar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

type TargetChipProps = { label: string; selected: boolean; onPress: () => void };

function TargetChip({ label, selected, onPress }: TargetChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  targets: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  targetsLabel: { color: colors.muted, fontSize: 13 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextSelected: { color: colors.onPrimary, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    minHeight: 40,
    minWidth: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
});
