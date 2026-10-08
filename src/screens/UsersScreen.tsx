import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { PrimaryButton } from '../components/PrimaryButton';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { useUsers } from '../hooks/useUsers';
import type { ScreenProps } from '../navigation/types';
import { getOrCreateDirectConversation } from '../services/chatService';
import { addMember } from '../services/groupService';
import { colors, spacing } from '../theme';
import type { PublicProfile } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import { availableSlots, MAX_GROUP_LIMIT } from '../utils/groupValidation';

export function UsersScreen({ navigation, route }: ScreenProps<'Users'>) {
  const params = route.params;
  const user = useCurrentUser();
  const { users, loading, error } = useUsers();
  const { group } = useGroup(params.mode === 'addMembers' ? params.groupId : null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selecting = params.mode !== 'direct';

  // Quantos integrantes ainda cabem: vagas do grupo existente ou teto de um grupo novo (sem contar o proprietário).
  const slots = group ? availableSlots(group.memberLimit, group.memberIds.length) : MAX_GROUP_LIMIT - 1;

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const currentMembers = new Set(group?.memberIds ?? []);
    return users
      .filter((candidate) => !currentMembers.has(candidate.uid) && candidate.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, search, group]);

  const handlePress = useCallback(
    async (target: PublicProfile) => {
      setActionError(null);
      if (params.mode === 'direct') {
        setBusy(true);
        try {
          const conversationId = await getOrCreateDirectConversation(user.uid, target.uid);
          navigation.replace('Chat', { conversationId, conversationType: 'direct' });
        } catch (failure) {
          setActionError(getErrorMessage(failure, 'Não foi possível iniciar a conversa.'));
          setBusy(false);
        }
        return;
      }
      if (!selectedIds.includes(target.uid) && selectedIds.length >= slots) {
        setActionError(slots === 0 ? 'Grupo sem vagas.' : `Só há ${slots} vaga(s) disponível(is).`);
        return;
      }
      setSelectedIds((current) =>
        current.includes(target.uid) ? current.filter((id) => id !== target.uid) : [...current, target.uid],
      );
    },
    [navigation, params.mode, selectedIds, slots, user.uid],
  );

  const handleConfirm = useCallback(async () => {
    if (params.mode === 'newGroup') {
      navigation.navigate('GroupForm', { memberIds: selectedIds });
      return;
    }
    if (params.mode !== 'addMembers') return;
    setBusy(true);
    setActionError(null);
    try {
      // Um por vez: a API valida o limite em transação a cada inclusão.
      for (const memberId of selectedIds) await addMember(params.groupId, memberId);
      navigation.goBack();
    } catch (failure) {
      setActionError(getErrorMessage(failure, 'Não foi possível adicionar os integrantes.'));
      setBusy(false);
    }
  }, [navigation, params, selectedIds]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PublicProfile>) => {
      const isSelf = item.uid === user.uid;
      return (
        <GroupMemberItem
          member={item}
          caption={isSelf ? 'Você' : undefined}
          disabled={isSelf || busy} // o próprio usuário nunca pode ser selecionado
          selected={selectedIds.includes(item.uid)}
          onPress={handlePress}
        />
      );
    },
    [busy, handlePress, selectedIds, user.uid],
  );

  if (loading) return <Loading message="Carregando usuários..." />;

  const hasOthers = visibleUsers.some((candidate) => candidate.uid !== user.uid);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TextInput
        accessibilityLabel="Buscar usuário"
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
      />
      {params.mode === 'addMembers' ? (
        <Text style={styles.hint}>{slots === 0 ? 'Grupo sem vagas.' : `${slots} vaga(s) disponível(is) no grupo.`}</Text>
      ) : null}
      <ErrorMessage message={error ?? actionError} />
      {hasOthers ? (
        <FlatList data={visibleUsers} keyExtractor={(item) => item.uid} renderItem={renderItem} extraData={selectedIds} />
      ) : (
        <EmptyState
          title="Nenhum usuário disponível"
          description={search ? 'Nenhum usuário corresponde à busca.' : 'Ainda não há outros usuários para selecionar.'}
        />
      )}
      {selecting ? (
        <View style={styles.footer}>
          <PrimaryButton
            title={
              params.mode === 'newGroup'
                ? `Avançar (${selectedIds.length} selecionado(s))`
                : `Adicionar ${selectedIds.length} integrante(s)`
            }
            onPress={handleConfirm}
            loading={busy}
            disabled={selectedIds.length === 0}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  hint: { color: colors.muted, fontSize: 13, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  footer: { padding: spacing.lg },
});
