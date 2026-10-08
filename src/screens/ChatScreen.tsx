import { useHeaderHeight } from '@react-navigation/elements';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { ChatInput } from '../components/ChatInput';
import { ChatMessageBubble } from '../components/ChatMessage';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { OfflineBanner } from '../components/OfflineBanner';
import { useCurrentUser } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useGroup } from '../hooks/useGroups';
import { useUsers } from '../hooks/useUsers';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import type { ChatMessage, MessageTarget } from '../types/chat';
import type { PublicProfile } from '../types/user';
import { otherParticipantId } from '../utils/conversationId';
import { extractMentions } from '../utils/mentions';

export function ChatScreen({ navigation, route }: ScreenProps<'Chat'>) {
  const { conversationId, conversationType } = route.params;
  const isGroup = conversationType === 'group';
  const user = useCurrentUser();
  const { usersById } = useUsers();
  const { group, loading: loadingGroup, error: groupError } = useGroup(isGroup ? conversationId : null);
  const { messages, loading, error, sending, sendError, pushError, send } = useChat(conversationId, conversationType);
  const headerHeight = useHeaderHeight();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const otherUserId = isGroup ? null : otherParticipantId(conversationId, user.uid);
  const otherUser = otherUserId ? usersById.get(otherUserId) : undefined;
  const title = isGroup ? (group?.name ?? 'Grupo') : (otherUser?.name ?? 'Conversa');
  const photoUrl = isGroup ? group?.photoUrl : otherUser?.photoUrl;

  // Removido do grupo (ou grupo inexistente): as regras negam a leitura e o envio é bloqueado.
  const noAccess = isGroup && !loadingGroup && (!group || groupError !== null);

  // Tocar na foto abre o perfil do participante ou a lista de integrantes do grupo.
  const openDetails = useCallback(() => {
    if (otherUserId) navigation.navigate('Profile', { userId: otherUserId });
    else navigation.navigate('GroupMembers', { groupId: conversationId });
  }, [conversationId, navigation, otherUserId]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isGroup ? `Ver integrantes de ${title}` : `Ver perfil de ${title}`}
          onPress={openDetails}
          style={styles.header}
        >
          <Avatar uri={photoUrl} size={36} kind={isGroup ? 'group' : 'user'} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
      ),
    });
  }, [isGroup, navigation, openDetails, photoUrl, title]);

  /** Outros integrantes do grupo: destinatários possíveis e alvo das menções. */
  const otherMembers = useMemo<PublicProfile[]>(
    () =>
      (group?.memberIds ?? [])
        .filter((uid) => uid !== user.uid)
        .map((uid) => usersById.get(uid) ?? { uid, name: 'Usuário', photoUrl: '' }),
    [group, user.uid, usersById],
  );

  const handleSend = useCallback(
    (text: string, target: MessageTarget) => send(text, target, extractMentions(text, otherMembers)),
    [otherMembers, send],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessage>) => (
      <ChatMessageBubble
        message={item}
        isMine={item.senderId === user.uid}
        authorName={isGroup ? (usersById.get(item.senderId)?.name ?? 'Usuário') : undefined}
        targetName={item.target.type === 'member' ? (usersById.get(item.target.memberId)?.name ?? 'integrante') : undefined}
      />
    ),
    [isGroup, user.uid, usersById],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* "padding" nas duas plataformas: no Android (edge-to-edge) a janela não encolhe para o teclado. */}
      <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={headerHeight}>
        <OfflineBanner />
        <ErrorMessage message={noAccess ? 'Você não faz mais parte deste grupo.' : error} />
        {loading ? (
          <Loading message="Carregando mensagens..." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState title="Nenhuma mensagem ainda" description="Envie a primeira mensagem desta conversa." />
            }
          />
        )}
        <ErrorMessage message={sendError} />
        <ErrorMessage message={pushError} tone="warning" />
        {noAccess ? null : <ChatInput sending={sending} members={isGroup ? otherMembers : undefined} onSend={handleSend} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingVertical: spacing.sm },
  emptyList: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 240 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '600', flexShrink: 1 },
});
