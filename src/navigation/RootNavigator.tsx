import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Loading } from '../components/Loading';
import { CurrentUserContext } from '../contexts/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { GroupFormScreen } from '../screens/GroupFormScreen';
import { GroupMembersScreen } from '../screens/GroupMembersScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerTintColor: colors.text,
  headerStyle: { backgroundColor: colors.surface },
  contentStyle: { backgroundColor: colors.background },
};

const USERS_TITLES = {
  direct: 'Nova conversa',
  newGroup: 'Selecionar integrantes',
  addMembers: 'Adicionar integrantes',
} as const;

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <Loading message="Recuperando sessão..." />;

  // Sem sessão só existem as telas de autenticação. No logout, todas as telas protegidas
  // são desmontadas e os listeners delas são removidos.
  if (!user) {
    return (
      <Stack.Navigator key="auth" screenOptions={screenOptions}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false, title: 'Entrar' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Criar conta' }} />
      </Stack.Navigator>
    );
  }

  return (
    <CurrentUserContext.Provider value={user}>
      <Stack.Navigator key="app" screenOptions={screenOptions}>
        <Stack.Screen name="Conversations" component={ConversationsScreen} options={{ title: 'Conversas' }} />
        <Stack.Screen
          name="Users"
          component={UsersScreen}
          options={({ route }) => ({ title: USERS_TITLES[route.params.mode] })}
        />
        <Stack.Screen
          name="GroupForm"
          component={GroupFormScreen}
          options={({ route }) => ({ title: 'groupId' in route.params ? 'Gerenciar grupo' : 'Novo grupo' })}
        />
        <Stack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: 'Integrantes' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: '' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
      </Stack.Navigator>
    </CurrentUserContext.Provider>
  );
}
