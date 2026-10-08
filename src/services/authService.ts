import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';

import type { SignUpInput } from '../types/user';
import { auth } from './firebase';
import { uploadImage } from './storageService';
import { createUserProfile, ensureUserProfile } from './userService';

/** Cadastro com e-mail e senha (única forma de autenticação do app). */
export async function signUp(input: SignUpInput): Promise<void> {
  // A foto sobe antes: se o upload falhar, nenhuma conta fica criada pela metade.
  const photoUrl = input.photo ? await uploadImage(input.photo) : '';
  const { user } = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  try {
    await createUserProfile({
      uid: user.uid,
      name: input.name.trim(),
      email: user.email ?? input.email.trim().toLowerCase(),
      phoneNumber: input.phoneNumber,
      birthDate: input.birthDate,
      photoUrl,
      createdAt: Date.now(),
    });
  } catch (error) {
    await deleteUser(user).catch(() => undefined);
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureUserProfile(user.uid, user.email ?? email.trim().toLowerCase());
}

/** Observa a sessão: dispara ao abrir o app (sessão recuperada), no login e no logout. */
export function observeSession(onChange: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, onChange);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}
