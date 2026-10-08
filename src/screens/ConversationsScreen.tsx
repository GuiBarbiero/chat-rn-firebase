import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { ConversationItem } from '../components/ConversationItem';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { OfflineBanner } from '../components/OfflineBanner';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth, useCurrentUser } from '../hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { useNotifications } from '../hooks/useNotifications';
import type { ScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme';
import type { ConversationSummary } from '../types/chat';
import type { PushStatus } from '../types/notification';
import { getErrorMessage } from '../utils/errors';

const PUSH_WARNINGS: Record<PushStatus, string | null> = {
  pending: null,
  registered: null,
  denied: 'Notificações desativadas: a permissão foi negada. Ative-a nas configurações do aparelho para ser avisado de novas mensagens.',
  unavailable: 'Este dispositivo não tem token de push disponível. Use um aparelho físico com o app instalado por build nativo.',
  error: 'Não foi possível registrar este dispositivo para notificações.',
};

export function ConversationsScreen({ navigation }: ScreenProps<'Conversations'>) {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { conversations, loading, error } = useConversations(user.uid);
  const pushStatus = useNotifications(user.uid);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (failure) {
      setSignOutError(getErrorMessage(failure, 'Não foi possível sair. Tente novamente.'));
      setSigningOut(false);
    }
  }, [signOut]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Meu perfil"
          onPress={() => navigation.navigate('Profile', { userId: user.uid })}
          style={styles.headerAvatar}
        >
          <Avatar uri={user.photoUrl} size={32} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          disabled={signingOut}
          onPress={handleSignOut}
          hitSlop={8}
          style={styles.headerSignOut}
        >
          <Text style={styles.headerAction}>{signingOut ? 'Saindo...' : 'Sair'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, user.uid, user.photoUrl, signingOut, handleSignOut]);

  const openConversation = useCallback(
    (conversation: ConversationSummary) =>
      navigation.navigate('Chat', { conversationId: conversation.id, conversationType: conversation.type }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ConversationSummary>) => <ConversationItem conversation={item} onPress={openConversation} />,
    [openConversation],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <OfflineBanner />
      <ErrorMessage message={PUSH_WARNINGS[pushStatus]} tone="warning" />
      <ErrorMessage message={error ?? signOutError} />
      {loading ? (
        <Loading message="Carregando conversas..." />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <EmptyState
              title="Nenhuma conversa ainda"
              description="Inicie uma conversa individual ou crie um grupo usando os botões abaixo."
            />
          }
        />
      )}
      <View style={styles.actions}>
        <View style={styles.action}>
          <PrimaryButton title="Nova conversa" onPress={() => navigation.navigate('Users', { mode: 'direct' })} />
        </View>
        <View style={styles.action}>
          <PrimaryButton
            title="Novo grupo"
            variant="secondary"
            onPress={() => navigation.navigate('Users', { mode: 'newGroup' })}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyList: { flexGrow: 1 },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  action: { flex: 1 },
  // No navegador o cabeçalho não tem as margens que o cabeçalho nativo aplica sozinho.
  headerAvatar: { marginRight: spacing.md, marginLeft: Platform.OS === 'web' ? spacing.lg : 0 },
  headerSignOut: { marginRight: Platform.OS === 'web' ? spacing.lg : 0 },
  headerAction: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
