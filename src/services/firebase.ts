import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import { connectFirestoreEmulator, getFirestore, type QueryDocumentSnapshot } from 'firebase/firestore';
import { Platform } from 'react-native';

import firebaseConfig from '../../firebaseConfig.json';
import { EMULATOR_HOST } from '../config';

const app = initializeApp(firebaseConfig);

// No celular a sessão fica no AsyncStorage; é isso que permite recuperá-la ao reabrir o app.
export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

/** Cloud Firestore: perfis, grupos, conversas individuais e tokens de dispositivos. */
export const db = getFirestore(app);

/** Realtime Database: mensagens e sincronização em tempo real. */
export const rtdb = getDatabase(app);

if (EMULATOR_HOST) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectDatabaseEmulator(rtdb, EMULATOR_HOST, 9000);
}

/** Converte um documento do Firestore no tipo do app, colocando o id do documento em `idField`. */
export function readDoc<T extends object>(snapshot: QueryDocumentSnapshot, idField: keyof T): T {
  return { ...snapshot.data(), [idField]: snapshot.id } as T;
}
