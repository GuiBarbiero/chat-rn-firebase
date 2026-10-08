import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';
import type { ChatMessage } from '../types/chat';

type ChatMessageBubbleProps = {
  message: ChatMessage;
  /** Mensagem enviada pelo usuário atual (alinha à direita). */
  isMine: boolean;
  /** Nome do autor; informado apenas em grupos. */
  authorName?: string;
  /** Nome do integrante a quem a mensagem foi direcionada, quando houver. */
  targetName?: string;
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  isMine,
  authorName,
  targetName,
}: ChatMessageBubbleProps) {
  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {authorName && !isMine ? <Text style={styles.author}>{authorName}</Text> : null}
        {targetName ? <Text style={styles.target}>Para {targetName}</Text> : null}
        <Text style={styles.text}>{message.text}</Text>
        <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: 3, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2 },
  bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 4 },
  author: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  target: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  text: { color: colors.text, fontSize: 16 },
  time: { color: colors.muted, fontSize: 11, alignSelf: 'flex-end' },
});
