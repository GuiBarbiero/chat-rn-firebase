import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { useCurrentUser } from '../hooks/useAuth';
import type { ScreenProps } from '../navigation/types';
import { getUserProfile } from '../services/userService';
import { colors, spacing } from '../theme';
import type { ChatUser } from '../types/user';
import { errorCode, getErrorMessage } from '../utils/errors';
import { formatBirthDate } from '../utils/userValidation';

const UNAVAILABLE = 'Não informado';

export function ProfileScreen({ route }: ScreenProps<'Profile'>) {
  const currentUser = useCurrentUser();
  const { userId } = route.params;
  const isSelf = userId === currentUser.uid;
  const [fetched, setFetched] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(!isSelf);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSelf) return;
    let active = true;
    setLoading(true);
    setError(null);
    // As regras do Firestore só liberam o perfil para quem compartilha uma conversa ou um grupo.
    getUserProfile(userId)
      .then((result) => {
        if (!active) return;
        setFetched(result);
        if (!result) setError('Perfil não encontrado.');
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(
          errorCode(failure) === 'permission-denied'
            ? 'Você só pode ver o perfil de pessoas com quem compartilha uma conversa ou um grupo.'
            : getErrorMessage(failure, 'Não foi possível carregar o perfil.'),
        );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isSelf, userId]);

  const profile = isSelf ? currentUser : fetched;

  if (loading) return <Loading message="Carregando perfil..." />;
  if (!profile) return <ErrorMessage message={error ?? 'Perfil não encontrado.'} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Avatar uri={profile.photoUrl} size={128} />
      <Text style={styles.name}>{profile.name || UNAVAILABLE}</Text>
      <View style={styles.card}>
        <ProfileField label="E-mail" value={profile.email} />
        <ProfileField label="Celular" value={profile.phoneNumber} />
        <ProfileField label="Data de nascimento" value={formatBirthDate(profile.birthDate)} />
      </View>
    </ScrollView>
  );
}

type ProfileFieldProps = { label: string; value: string };

function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, !value && styles.unavailable]}>{value || UNAVAILABLE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  name: { color: colors.text, fontSize: 22, fontWeight: '700' },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  field: { padding: spacing.lg, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 16 },
  unavailable: { color: colors.muted, fontStyle: 'italic' },
});
