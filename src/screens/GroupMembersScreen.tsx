import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { ErrorMessage } from '../components/ErrorMessage';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { PrimaryButton } from '../components/PrimaryButton';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { useUsers } from '../hooks/useUsers';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import { NOTIFICATION_POLICIES } from '../types/notification';
import type { PublicProfile } from '../types/user';
import { availableSlots } from '../utils/groupValidation';

/** Aberta ao tocar na foto do grupo: mostra todos os integrantes; tocar em um deles abre o perfil. */
export function GroupMembersScreen({ navigation, route }: ScreenProps<'GroupMembers'>) {
  const user = useCurrentUser();
  const { group, loading, error } = useGroup(route.params.groupId);
  const { usersById } = useUsers();

  const members = useMemo<PublicProfile[]>(
    () => (group?.memberIds ?? []).map((uid) => usersById.get(uid) ?? { uid, name: 'Usuário', photoUrl: '' }),
    [group, usersById],
  );

  const openProfile = useCallback(
    (member: PublicProfile) => navigation.navigate('Profile', { userId: member.uid }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PublicProfile>) => {
      const captions = [item.uid === group?.ownerId ? 'Proprietário' : null, item.uid === user.uid ? 'Você' : null];
      return <GroupMemberItem member={item} caption={captions.filter(Boolean).join(' · ') || undefined} onPress={openProfile} />;
    },
    [group?.ownerId, openProfile, user.uid],
  );

  if (loading) return <Loading message="Carregando integrantes..." />;
  if (!group || error) return <ErrorMessage message={error ?? 'Grupo não encontrado.'} />;

  const slots = availableSlots(group.memberLimit, group.memberIds.length);
  const policy = NOTIFICATION_POLICIES.find((option) => option.value === group.notificationPolicy);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <Avatar uri={group.photoUrl} size={96} kind="group" />
            <Text style={styles.name}>{group.name}</Text>
            <Text style={[styles.detail, slots === 0 && styles.full]}>
              {group.memberIds.length} de {group.memberLimit} integrantes ·{' '}
              {slots === 0 ? 'grupo sem vagas' : `${slots} vaga(s) disponível(is)`}
            </Text>
            <Text style={styles.detail}>Notificações: {policy?.label ?? 'Não definida'}</Text>
          </View>
        }
      />
      {group.ownerId === user.uid ? (
        <View style={styles.footer}>
          <PrimaryButton title="Gerenciar grupo" onPress={() => navigation.navigate('GroupForm', { groupId: group.id })} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', gap: spacing.xs, padding: spacing.xl },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  detail: { color: colors.muted, fontSize: 14 },
  full: { color: colors.danger },
  footer: { padding: spacing.lg },
});
