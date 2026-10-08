import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ConversationType } from '../types/chat';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Conversations: undefined;
  /** direct: iniciar conversa individual · newGroup: escolher integrantes de um grupo novo · addMembers: adicionar a um grupo existente */
  Users: { mode: 'direct' } | { mode: 'newGroup' } | { mode: 'addMembers'; groupId: string };
  /** Com groupId edita um grupo existente; com memberIds cria um grupo com os integrantes escolhidos. */
  GroupForm: { groupId: string } | { memberIds: string[] };
  GroupMembers: { groupId: string };
  Chat: { conversationId: string; conversationType: ConversationType };
  Profile: { userId: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Name>;

// Tipa useNavigation() em todo o app.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
