import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import type { PublicProfile } from '../types/user';
import { Avatar } from './Avatar';

type GroupMemberItemProps = {
  member: PublicProfile;
  /** Texto auxiliar: "Proprietário", "Você"... */
  caption?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: (member: PublicProfile) => void;
  /** Ação secundária à direita (ex.: remover integrante). */
  actionLabel?: string;
  actionBusy?: boolean;
  onAction?: (member: PublicProfile) => void;
};

/** Linha de pessoa usada na lista de usuários e nas listas de integrantes de grupo. */
export const GroupMemberItem = memo(function GroupMemberItem({
  member,
  caption,
  selected = false,
  disabled = false,
  onPress,
  actionLabel,
  actionBusy = false,
  onAction,
}: GroupMemberItemProps) {
  return (
    <View style={[styles.row, selected && styles.selected, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={{ selected, disabled }}
        disabled={disabled || !onPress}
        onPress={() => onPress?.(member)}
        style={({ pressed }) => [styles.person, pressed && styles.pressed]}
      >
        <Avatar uri={member.photoUrl} size={40} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {member.name}
          </Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
        {selected ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" disabled={actionBusy} onPress={() => onAction(member)} hitSlop={8}>
          <Text style={[styles.action, actionBusy && styles.disabled]}>{actionBusy ? 'Aguarde...' : actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  selected: { backgroundColor: colors.bubbleMine },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
  texts: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16 },
  caption: { color: colors.muted, fontSize: 12 },
  check: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  action: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
