import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

type ErrorMessageProps = {
  /** Sem mensagem, o componente não renderiza nada. */
  message: string | null | undefined;
  /** error: falha · warning: aviso que não impede o uso · info: confirmação. */
  tone?: 'error' | 'warning' | 'info';
};

export function ErrorMessage({ message, tone = 'error' }: ErrorMessageProps) {
  if (!message) return null;
  return (
    <View style={[styles.container, styles[`${tone}Container`]]} accessibilityRole="alert">
      <Text style={[styles.text, styles[`${tone}Text`]]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  text: { fontSize: 14 },
  errorContainer: { backgroundColor: colors.dangerSurface },
  errorText: { color: colors.danger },
  warningContainer: { backgroundColor: colors.warningSurface },
  warningText: { color: colors.warning },
  infoContainer: { backgroundColor: colors.bubbleMine },
  infoText: { color: colors.primary },
});
