import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Hospedagens guardam a chave em uma linha, com "\n" literais.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

if (!projectId || !process.env.FIREBASE_DATABASE_URL) {
  throw new Error('Defina FIREBASE_PROJECT_ID e FIREBASE_DATABASE_URL.');
}
if (!usingEmulators && !(clientEmail && privateKey)) {
  throw new Error('Defina FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY nas variáveis secretas da hospedagem.');
}

// A credencial administrativa existe só aqui, vinda do ambiente. Com os emuladores ela não é necessária.
const app = initializeApp({
  projectId,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  ...(clientEmail && privateKey ? { credential: cert({ projectId, clientEmail, privateKey }) } : {}),
});

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const rtdb = getDatabase(app);
export const messaging = getMessaging(app);
