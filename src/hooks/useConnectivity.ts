import { onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';

import { rtdb } from '../services/firebase';

const OFFLINE_DELAY_MS = 2500;

/** Estado da conexão com o Realtime Database (nó especial .info/connected). */
export function useConnectivity(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onValue(ref(rtdb, '.info/connected'), (snapshot) => {
      clearTimeout(timer);
      if (snapshot.val() === true) setOnline(true);
      // O SDK informa "desconectado" por um instante ao abrir o app; só avisa se persistir.
      else timer = setTimeout(() => setOnline(false), OFFLINE_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, []);

  return online;
}
