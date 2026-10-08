import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';

import { listenToNotificationTaps, listenToTokenRefresh, registerDevice } from '../services/notificationService';
import type { PushStatus } from '../types/notification';

/** Registra o dispositivo do usuário para push e abre a conversa quando uma notificação é tocada. */
export function useNotifications(uid: string): PushStatus {
  const navigation = useNavigation();
  const [status, setStatus] = useState<PushStatus>('pending');

  useEffect(() => {
    let active = true;
    registerDevice(uid).then(
      (result) => active && setStatus(result),
      () => active && setStatus('error'),
    );
    const stopTokenRefresh = listenToTokenRefresh(uid);
    return () => {
      active = false;
      stopTokenRefresh();
    };
  }, [uid]);

  useEffect(() => listenToNotificationTaps((payload) => navigation.navigate('Chat', payload)), [navigation]);

  return status;
}
