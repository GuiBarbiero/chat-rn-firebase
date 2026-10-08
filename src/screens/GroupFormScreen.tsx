import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormScrollView } from '../components/FormScrollView';
import { GroupMemberItem } from '../components/GroupMemberItem';
import { Loading } from '../components/Loading';
import { PrimaryButton } from '../components/PrimaryButton';
import { TextField } from '../components/TextField';
import { useCurrentUser } from '../hooks/useAuth';
import { useGroup } from '../hooks/useGroups';
import { useUsers } from '../hooks/useUsers';
import type { ScreenProps } from '../navigation/types';
import { createGroup, removeMember, updateGroup } from '../services/groupService';
import { pickImage, uploadImage } from '../services/storageService';
import { colors, spacing } from '../theme';
import type { GroupSettings } from '../types/group';
import { NOTIFICATION_POLICIES, type NotificationPolicy } from '../types/notification';
import type { PublicProfile } from '../types/user';
import { getErrorMessage } from '../utils/errors';
import { availableSlots, MAX_GROUP_NAME, MIN_GROUP_MEMBERS, parseMemberLimit, validateGroup } from '../utils/groupValidation';

const DEFAULT_LIMIT = 5;

export function GroupFormScreen({ navigation, route }: ScreenProps<'GroupForm'>) {
  const user = useCurrentUser();
  const editingId = 'groupId' in route.params ? route.params.groupId : null;
  const initialMemberIds = 'memberIds' in route.params ? route.params.memberIds : [];
  const { group, loading, error } = useGroup(editingId);
  const { usersById } = useUsers();

  const [name, setName] = useState('');
  const [limitText, setLimitText] = useState(String(Math.max(initialMemberIds.length + 1, DEFAULT_LIMIT)));
  const [policy, setPolicy] = useState<NotificationPolicy>('all_group_messages');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [draftMemberIds, setDraftMemberIds] = useState<string[]>(initialMemberIds);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Edição: preenche o formulário uma única vez, quando o grupo chega do Firestore.
  const filled = useRef(false);
  useEffect(() => {
    if (!group || filled.current) return;
    filled.current = true;
    setName(group.name);
    setLimitText(String(group.memberLimit));
    setPolicy(group.notificationPolicy);
  }, [group]);

  // Integrantes: os do grupo (em tempo real) na edição; proprietário + selecionados na criação.
  const memberIds = useMemo(
    () => (group ? group.memberIds : [user.uid, ...draftMemberIds]),
    [group, user.uid, draftMemberIds],
  );
  const members = useMemo<PublicProfile[]>(
    () => memberIds.map((uid) => usersById.get(uid) ?? { uid, name: 'Usuário', photoUrl: '' }),
    [memberIds, usersById],
  );
  const ownerId = group?.ownerId ?? user.uid;
  const memberLimit = parseMemberLimit(limitText);
  const slots = memberLimit === null ? null : availableSlots(memberLimit, memberIds.length);
  // Vagas pelo limite já salvo: é o que a API considera ao adicionar integrantes.
  const savedSlots = group ? availableSlots(group.memberLimit, group.memberIds.length) : 0;

  const handlePickPhoto = useCallback(async () => {
    setFormError(null);
    try {
      const picked = await pickImage();
      if (picked) setNewPhoto(picked);
    } catch (failure) {
      setFormError(getErrorMessage(failure, 'Não foi possível abrir a galeria.'));
    }
  }, []);

  const handleRemove = useCallback(
    async (member: PublicProfile) => {
      setFormError(null);
      setNotice(null);
      if (!group) {
        setDraftMemberIds((current) => current.filter((id) => id !== member.uid));
        return;
      }
      setRemovingId(member.uid);
      try {
        await removeMember(group.id, member.uid);
      } catch (failure) {
        setFormError(getErrorMessage(failure, 'Não foi possível remover o integrante.'));
      } finally {
        setRemovingId(null);
      }
    },
    [group],
  );

  const handleSave = useCallback(async () => {
    setNotice(null);
    const problem = validateGroup({ name, memberLimit, memberCount: memberIds.length });
    if (problem || memberLimit === null) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const photoUrl = newPhoto ? await uploadImage(newPhoto) : (group?.photoUrl ?? '');
      const settings: GroupSettings = { name: name.trim(), photoUrl, memberLimit, notificationPolicy: policy };
      if (group) {
        await updateGroup(group.id, settings);
        setNewPhoto(null);
        setNotice('Alterações salvas.');
      } else {
        const groupId = await createGroup({ ...settings, memberIds: draftMemberIds });
        navigation.popToTop();
        navigation.navigate('Chat', { conversationId: groupId, conversationType: 'group' });
      }
    } catch (failure) {
      setFormError(getErrorMessage(failure, 'Não foi possível salvar o grupo.'));
    } finally {
      setSaving(false);
    }
  }, [draftMemberIds, group, memberIds.length, memberLimit, name, navigation, newPhoto, policy]);

  if (editingId && loading) return <Loading message="Carregando grupo..." />;
  if (editingId && (!group || error)) return <ErrorMessage message={error ?? 'Grupo não encontrado.'} />;
  if (group && group.ownerId !== user.uid) {
    return <ErrorMessage message="Somente o proprietário pode gerenciar o grupo." />;
  }

  return (
    <FormScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={handlePickPhoto} disabled={saving} style={styles.photo}>
        <Avatar uri={newPhoto ?? group?.photoUrl} size={96} kind="group" />
        <Text style={styles.link}>{newPhoto || group?.photoUrl ? 'Trocar foto do grupo' : 'Escolher foto do grupo'}</Text>
      </Pressable>

      <TextField label="Nome do grupo" value={name} onChangeText={setName} placeholder="Ex.: Turma de Mobile" maxLength={MAX_GROUP_NAME} />

      <TextField
        label="Limite máximo de integrantes"
        value={limitText}
        onChangeText={setLimitText}
        keyboardType="number-pad"
        placeholder={`Mínimo ${MIN_GROUP_MEMBERS}`}
        maxLength={3}
      />
      <Text style={[styles.capacity, slots === 0 && styles.capacityFull]}>
        {memberIds.length} de {memberLimit ?? '?'} integrantes ·{' '}
        {slots === null ? 'informe um limite válido' : slots === 0 ? 'grupo sem vagas' : `${slots} vaga(s) disponível(is)`}
      </Text>

      <Text style={styles.sectionTitle}>Política de notificações</Text>
      <View style={styles.card}>
        {NOTIFICATION_POLICIES.map((option) => {
          const selected = option.value === policy;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setPolicy(option.value)}
              style={[styles.policy, selected && styles.policySelected]}
            >
              <Text style={[styles.policyLabel, selected && styles.policyLabelSelected]}>
                {selected ? '● ' : '○ '}
                {option.label}
              </Text>
              <Text style={styles.policyDescription}>{option.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Integrantes ({memberIds.length})</Text>
      <View style={styles.card}>
        {members.map((member) => {
          const isOwner = member.uid === ownerId;
          return (
            <GroupMemberItem
              key={member.uid}
              member={member}
              caption={isOwner ? 'Proprietário' : undefined}
              actionLabel={isOwner ? undefined : 'Remover'}
              actionBusy={removingId === member.uid}
              onAction={handleRemove}
            />
          );
        })}
      </View>
      {group ? (
        <>
          <PrimaryButton
            title="Adicionar integrantes"
            variant="secondary"
            disabled={savedSlots === 0}
            onPress={() => navigation.navigate('Users', { mode: 'addMembers', groupId: group.id })}
          />
          {savedSlots === 0 ? (
            <Text style={styles.capacityFull}>Grupo sem vagas. Aumente o limite e salve para adicionar integrantes.</Text>
          ) : null}
        </>
      ) : null}

      <ErrorMessage message={formError} />
      <ErrorMessage message={notice} tone="info" />
      <PrimaryButton title={group ? 'Salvar alterações' : 'Criar grupo'} onPress={handleSave} loading={saving} />
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  photo: { alignItems: 'center', gap: spacing.sm },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  capacity: { color: colors.muted, fontSize: 13 },
  capacityFull: { color: colors.danger, fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  policy: { padding: spacing.md, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  policySelected: { backgroundColor: colors.bubbleMine },
  policyLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  policyLabelSelected: { color: colors.primary },
  policyDescription: { color: colors.muted, fontSize: 13 },
});
