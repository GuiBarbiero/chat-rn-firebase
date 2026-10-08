import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../theme';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, variant = 'primary', loading = false, disabled = false }: PrimaryButtonProps) {
  const inactive = disabled || loading;
  const filled = variant === 'primary';
  const textColor = filled ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        filled ? styles.filled : styles.outlined,
        variant === 'danger' && styles.danger,
        (inactive || pressed) && styles.dimmed,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.title, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  filled: { backgroundColor: colors.primary, borderColor: colors.primary },
  outlined: { backgroundColor: colors.surface, borderColor: colors.primary },
  danger: { borderColor: colors.danger },
  dimmed: { opacity: 0.6 },
  title: { fontSize: 16, fontWeight: '600' },
});
