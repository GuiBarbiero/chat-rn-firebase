import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

type EmptyStateProps = { title: string; description?: string };

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
