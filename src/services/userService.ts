import { collection, doc, getDoc, onSnapshot, writeBatch, type Unsubscribe } from 'firebase/firestore';

import type { ChatUser, PublicProfile } from '../types/user';
import { db, readDoc } from './firebase';

const userRef = (uid: string) => doc(db, 'users', uid);
const publicProfileRef = (uid: string) => doc(db, 'publicProfiles', uid);

/** Grava o perfil completo (privado) e o perfil público usado na lista de usuários. */
export async function createUserProfile(user: ChatUser): Promise<void> {
  const { uid, ...profile } = user;
  const publicProfile: Omit<PublicProfile, 'uid'> = { name: user.name, photoUrl: user.photoUrl };
  const batch = writeBatch(db);
  batch.set(userRef(uid), profile);
  batch.set(publicProfileRef(uid), publicProfile);
  await batch.commit();
}

/** Recria um perfil mínimo caso a conta exista no Authentication sem documento no Firestore. */
export async function ensureUserProfile(uid: string, email: string): Promise<void> {
  const snapshot = await getDoc(userRef(uid));
  if (snapshot.exists()) return;
  await createUserProfile({
    uid,
    name: (email.split('@')[0] || 'Usuário').slice(0, 60), // as regras limitam o nome a 60 caracteres
    email,
    phoneNumber: '',
    birthDate: '',
    photoUrl: '',
    createdAt: Date.now(),
  });
}

export function listenToUserProfile(
  uid: string,
  onData: (user: ChatUser | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userRef(uid),
    // Necessário para a resposta do servidor "não existe" chegar depois de um cache vazio ignorado.
    { includeMetadataChanges: true },
    (snapshot) => {
      // Sem internet e com o cache vazio, o SDK responde "não existe" a partir do cache.
      // Isso não quer dizer perfil ausente: espera a resposta do servidor.
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onData(snapshot.exists() ? readDoc<ChatUser>(snapshot, 'uid') : null);
    },
    onError,
  );
}

/** As regras só liberam a leitura para o dono ou para quem compartilha uma conversa ou grupo com ele. */
export async function getUserProfile(uid: string): Promise<ChatUser | null> {
  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists() ? readDoc<ChatUser>(snapshot, 'uid') : null;
}

export function listenToPublicProfiles(
  onData: (profiles: PublicProfile[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'publicProfiles'),
    (snapshot) => onData(snapshot.docs.map((document) => readDoc<PublicProfile>(document, 'uid'))),
    onError,
  );
}
