import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import type { ConversationSummary } from '../types/chat';
import { Avatar } from './Avatar';

type ConversationItemProps = {
  conversation: ConversationSummary;
  onPress: (conversation: ConversationSummary) => void;
};

export const ConversationItem = memo(function ConversationItem({ conversation, onPress }: ConversationItemProps) {
  const isGroup = conversation.type === 'group';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(conversation)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar uri={conversation.photoUrl} kind={isGroup ? 'group' : 'user'} />
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {conversation.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {conversation.subtitle}
        </Text>
      </View>
      {/* Identificação visual do tipo de conversa */}
      <View style={[styles.badge, isGroup && styles.groupBadge]}>
        <Text style={[styles.badgeText, isGroup && styles.groupBadgeText]}>{isGroup ? 'Grupo' : 'Individual'}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.background },
  texts: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  subtitle: { color: colors.muted, fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: colors.background },
  groupBadge: { backgroundColor: colors.bubbleMine },
  badgeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  groupBadgeText: { color: colors.primary },
});
