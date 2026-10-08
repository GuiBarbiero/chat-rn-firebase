/**
 * Verificação de ponta a ponta contra os emuladores do Firebase (Auth, Firestore e Realtime Database):
 * regras de segurança, endpoints da API, políticas de notificação e limite do grupo sob concorrência.
 *
 *   1) na raiz do repositório:  npx firebase-tools emulators:start --only auth,firestore,database
 *   2) em server/:              npm run test:emulators
 *
 * Os usuários agem pelo SDK cliente (sujeito às regras); a API roda neste mesmo processo.
 */
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, type User } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  setWithPriority,
  type Database,
} from 'firebase/database';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'chat-rn-firebase-a38c7';
const DATABASE_URL = `https://${PROJECT_ID}-default-rtdb.firebaseio.com`;
const API = 'http://127.0.0.1:3999';
const RUN = Date.now();

Object.assign(process.env, {
  PORT: '3999',
  FIREBASE_PROJECT_ID: PROJECT_ID,
  FIREBASE_DATABASE_URL: DATABASE_URL,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
});

type Session = { name: string; uid: string; user: User; app: FirebaseApp; db: Firestore; rtdb: Database };
type Outcome = 'ok' | 'denied';
type ApiResult = { status: number; body: Record<string, unknown> };

let failures = 0;

function report(pass: boolean, label: string, detail = ''): void {
  if (!pass) failures += 1;
  console.log(`${pass ? ' ok ' : 'FAIL'}  ${label}${pass || !detail ? '' : `  -> ${detail}`}`);
}

function isDenied(error: unknown): boolean {
  return /permission[_ -]denied/i.test(String(error));
}

/** Executa uma operação do SDK cliente e confere se as regras permitiram ou negaram. */
async function expectRule(label: string, expected: Outcome, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
    report(expected === 'ok', label, 'as regras permitiram, mas deveriam negar');
  } catch (error) {
    if (isDenied(error)) report(expected === 'denied', label, 'as regras negaram, mas deveriam permitir');
    else report(false, label, `erro inesperado: ${String(error)}`);
  }
}

async function api(session: Session, method: string, path: string, body?: object): Promise<ApiResult> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await session.user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function expectApi(label: string, expected: number | Record<string, unknown>, call: Promise<ApiResult>): Promise<ApiResult> {
  const result = await call;
  const pass =
    typeof expected === 'number'
      ? result.status === expected
      : result.status < 300 && Object.entries(expected).every(([key, value]) => result.body[key] === value);
  report(pass, label, `status ${result.status} ${JSON.stringify(result.body)}`);
  return result;
}

async function createSession(name: string): Promise<Session> {
  const app = initializeApp({ apiKey: 'fake-api-key', projectId: PROJECT_ID, databaseURL: DATABASE_URL }, `${name}-${RUN}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const rtdb = getDatabase(app);
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);

  const email = `${name.toLowerCase()}-${RUN}@teste.dev`;
  const { user } = await createUserWithEmailAndPassword(auth, email, 'senha-de-teste');
  // Mesmo formato que o app grava em userService.createUserProfile.
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), {
    name,
    email,
    phoneNumber: '(11) 90000-0000',
    birthDate: '2000-01-01',
    photoUrl: '',
    createdAt: Date.now(),
  });
  batch.set(doc(db, 'publicProfiles', user.uid), { name, photoUrl: '' });
  await batch.commit();
  return { name, uid: user.uid, user, app, db, rtdb };
}

const directId = (a: Session, b: Session) => (a.uid < b.uid ? `${a.uid}_${b.uid}` : `${b.uid}_${a.uid}`);

function message(sender: Session, type: 'direct' | 'group', overrides: Record<string, unknown> = {}) {
  return {
    conversationType: type,
    senderId: sender.uid,
    text: 'Olá!',
    target: { type: 'conversation' },
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

async function sendMessage(session: Session, conversationId: string, payload: object): Promise<string> {
  const reference = push(ref(session.rtdb, `messages/${conversationId}`));
  await set(reference, payload);
  return reference.key ?? '';
}

async function memberCount(session: Session, groupId: string): Promise<number> {
  const snapshot = await getDoc(doc(session.db, 'groups', groupId));
  return ((snapshot.data()?.memberIds as string[] | undefined) ?? []).length;
}

async function main(): Promise<void> {
  await import('../src/app');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await fetch(`${API}/health`).then((response) => response.ok, () => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const [ana, bia, caio, duda] = await Promise.all(['Ana', 'Bia', 'Caio', 'Duda'].map(createSession));
  const sessions: Session[] = [ana, bia, caio, duda];

  console.log('\n# Perfis e dados cadastrais');
  await expectRule('lista o diretório público (nome e foto)', 'ok', () => getDocs(collection(ana.db, 'publicProfiles')));
  await expectRule('não lista a coleção de dados cadastrais', 'denied', () => getDocs(collection(ana.db, 'users')));
  await expectRule('lê o próprio perfil completo', 'ok', () => getDoc(doc(ana.db, 'users', ana.uid)));
  await expectRule('não lê perfil de quem não compartilha conversa', 'denied', () => getDoc(doc(ana.db, 'users', bia.uid)));
  await expectRule('não altera o perfil público de outro usuário', 'denied', () =>
    setDoc(doc(ana.db, 'publicProfiles', bia.uid), { name: 'Invasor', photoUrl: '' }),
  );
  await expectRule('não grava foto em Base64 no Firestore', 'denied', () =>
    setDoc(doc(ana.db, 'publicProfiles', ana.uid), { name: 'Ana', photoUrl: 'data:image/png;base64,AAAA' }),
  );

  console.log('\n# Tokens de dispositivos');
  const device = { token: 'token-de-teste', platform: 'android', enabled: true, updatedAt: Date.now() };
  await expectRule('grava o próprio dispositivo', 'ok', () => setDoc(doc(ana.db, 'users', ana.uid, 'devices', 'd1'), device));
  await expectRule('não lê tokens de outro usuário', 'denied', () => getDocs(collection(bia.db, 'users', ana.uid, 'devices')));
  await expectRule('não grava dispositivo para outro usuário', 'denied', () =>
    setDoc(doc(bia.db, 'users', ana.uid, 'devices', 'd2'), device),
  );

  console.log('\n# Conversa individual');
  const anaBia = directId(ana, bia);
  const participants = ana.uid < bia.uid ? [ana.uid, bia.uid] : [bia.uid, ana.uid];
  await expectRule('não cria conversa consigo mesmo', 'denied', () =>
    setDoc(doc(ana.db, 'directConversations', `${ana.uid}_${ana.uid}`), { participantIds: [ana.uid, ana.uid], createdAt: Date.now() }),
  );
  await expectRule('não cria conversa com id fora do padrão (duplicata)', 'denied', () =>
    setDoc(doc(ana.db, 'directConversations', `${participants[1]}_${participants[0]}`), {
      participantIds: [participants[1], participants[0]],
      createdAt: Date.now(),
    }),
  );
  await expectRule('não cria conversa entre outros dois usuários', 'denied', () =>
    setDoc(doc(caio.db, 'directConversations', anaBia), { participantIds: participants, createdAt: Date.now() }),
  );
  await expectRule('cria a conversa individual', 'ok', () =>
    setDoc(doc(ana.db, 'directConversations', anaBia), { participantIds: participants, createdAt: Date.now() }),
  );
  await expectRule('não sobrescreve conversa existente', 'denied', () =>
    setDoc(doc(bia.db, 'directConversations', anaBia), { participantIds: participants, createdAt: 1 }),
  );
  await expectRule('participante lê a conversa', 'ok', () => getDoc(doc(bia.db, 'directConversations', anaBia)));
  await expectRule('terceiro não lê a conversa', 'denied', () => getDoc(doc(caio.db, 'directConversations', anaBia)));
  await expectRule('quem compartilha conversa lê o perfil', 'ok', () => getDoc(doc(ana.db, 'users', bia.uid)));
  await expectRule('terceiro continua sem ler o perfil', 'denied', () => getDoc(doc(caio.db, 'users', bia.uid)));

  console.log('\n# Mensagens individuais (Realtime Database)');
  let directMessageId = '';
  await expectRule('participante envia mensagem', 'ok', async () => {
    directMessageId = await sendMessage(ana, anaBia, message(ana, 'direct'));
  });
  await expectRule('o outro participante lê', 'ok', () => get(ref(bia.rtdb, `messages/${anaBia}`)));
  await expectRule('terceiro não lê', 'denied', () => get(ref(caio.rtdb, `messages/${anaBia}`)));
  await expectRule('terceiro não envia', 'denied', () => sendMessage(caio, anaBia, message(caio, 'direct')));
  await expectRule('não envia em nome de outro (senderId)', 'denied', () => sendMessage(ana, anaBia, message(bia, 'direct')));
  await expectRule('não forja a data da mensagem', 'denied', () => sendMessage(ana, anaBia, message(ana, 'direct', { createdAt: 1 })));
  await expectRule('não envia texto vazio', 'denied', () => sendMessage(ana, anaBia, message(ana, 'direct', { text: '' })));
  await expectRule('não inclui campos extras', 'denied', () => sendMessage(ana, anaBia, message(ana, 'direct', { admin: true })));
  await expectRule('não aceita menções que não sejam uma lista (ex.: Base64)', 'denied', () =>
    sendMessage(ana, anaBia, message(ana, 'direct', { mentionedUserIds: `data:image/png;base64,${'A'.repeat(5000)}` })),
  );
  await expectRule('não aceita mensagem com prioridade definida pelo cliente', 'denied', () =>
    setWithPriority(push(ref(ana.rtdb, `messages/${anaBia}`)), message(ana, 'direct'), 1),
  );
  await expectRule('não altera mensagem já enviada', 'denied', () =>
    set(ref(ana.rtdb, `messages/${anaBia}/${directMessageId}`), message(ana, 'direct', { text: 'editada' })),
  );
  await expectRule('não lê a raiz das mensagens', 'denied', () => get(ref(ana.rtdb, 'messages')));
  await expectRule('não lê o espelho de integrantes', 'denied', () => get(ref(ana.rtdb, 'groupMembers')));

  console.log('\n# Grupos pela API');
  const settings = { name: 'Turma', photoUrl: '', memberLimit: 3, notificationPolicy: 'all_group_messages' };
  await expectApi('sem token: 401', 401, fetch(`${API}/groups`, { method: 'POST' }).then(async (response) => ({
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  })));
  await expectApi('limite não inteiro: 400', 400, api(ana, 'POST', '/groups', { ...settings, memberLimit: 2.5, memberIds: [bia.uid] }));
  await expectApi('grupo só com o proprietário: 400', 400, api(ana, 'POST', '/groups', { ...settings, memberIds: [] }));
  await expectApi('mais integrantes que o limite: 409', 409, api(ana, 'POST', '/groups', { ...settings, memberLimit: 2, memberIds: [bia.uid, caio.uid] }));
  const created = await expectApi('cria o grupo: 201', 201, api(ana, 'POST', '/groups', { ...settings, memberIds: [bia.uid] }));
  const groupId = String(created.body.id);

  await expectRule('integrante lê o grupo', 'ok', () => getDoc(doc(bia.db, 'groups', groupId)));
  await expectRule('não integrante não lê o grupo', 'denied', () => getDoc(doc(caio.db, 'groups', groupId)));
  await expectRule('cliente não grava no grupo (nem o proprietário)', 'denied', () =>
    setDoc(doc(ana.db, 'groups', groupId), { memberLimit: 999 }, { merge: true }),
  );
  await expectApi('não proprietário não altera o grupo: 403', 403, api(bia, 'PATCH', `/groups/${groupId}`, { memberLimit: 10 }));
  await expectApi('não proprietário não adiciona integrante: 403', 403, api(bia, 'POST', `/groups/${groupId}/members`, { memberId: caio.uid }));
  await expectApi('proprietário adiciona integrante', { status: 'added' }, api(ana, 'POST', `/groups/${groupId}/members`, { memberId: caio.uid }));
  await expectApi('grupo cheio: 409', 409, api(ana, 'POST', `/groups/${groupId}/members`, { memberId: duda.uid }));
  await expectApi('limite abaixo da quantidade atual: 409', 409, api(ana, 'PATCH', `/groups/${groupId}`, { memberLimit: 2 }));
  await expectApi('proprietário não pode ser removido: 400', 400, api(ana, 'DELETE', `/groups/${groupId}/members/${ana.uid}`));
  await expectRule('quem compartilha grupo lê o perfil', 'ok', () => getDoc(doc(caio.db, 'users', bia.uid)));
  await expectRule('quem não compartilha grupo não lê o perfil', 'denied', () => getDoc(doc(duda.db, 'users', bia.uid)));

  console.log('\n# Mensagens de grupo (Realtime Database)');
  await expectRule('integrante envia mensagem geral', 'ok', () => sendMessage(bia, groupId, message(bia, 'group')));
  await expectRule('integrante lê o histórico', 'ok', () => get(ref(caio.rtdb, `messages/${groupId}`)));
  await expectRule('não integrante não lê', 'denied', () => get(ref(duda.rtdb, `messages/${groupId}`)));
  await expectRule('não integrante não envia', 'denied', () => sendMessage(duda, groupId, message(duda, 'group')));
  await expectRule('direciona mensagem a um integrante', 'ok', () =>
    sendMessage(ana, groupId, message(ana, 'group', { target: { type: 'member', memberId: bia.uid }, mentionedUserIds: [caio.uid] })),
  );
  await expectRule('não direciona a quem não é integrante', 'denied', () =>
    sendMessage(ana, groupId, message(ana, 'group', { target: { type: 'member', memberId: duda.uid } })),
  );
  await expectRule('não menciona quem não é integrante', 'denied', () =>
    sendMessage(ana, groupId, message(ana, 'group', { mentionedUserIds: [duda.uid] })),
  );
  await expectRule('tipo da mensagem precisa combinar com a conversa', 'denied', () => sendMessage(ana, groupId, message(ana, 'direct')));
  await expectRule('não aceita menções com chave que não seja índice de lista', 'denied', () =>
    sendMessage(ana, groupId, message(ana, 'group', { mentionedUserIds: { foo: bia.uid } })),
  );

  // A janela do chat é ordenada pelo horário do servidor (mesma consulta de chatService.listenToMessages),
  // então uma chave "maior" escolhida por um participante não esconde as mensagens novas.
  await set(ref(ana.rtdb, `messages/${groupId}/zzz-chave-forjada`), message(ana, 'group', { text: 'chave forjada' }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const newest = await sendMessage(bia, groupId, message(bia, 'group', { text: 'mensagem nova' }));
  const chatWindow = await get(query(ref(bia.rtdb, `messages/${groupId}`), orderByChild('createdAt'), limitToLast(1)));
  let lastKey = '';
  chatWindow.forEach((child) => {
    lastKey = child.key;
  });
  report(lastKey === newest, 'mensagem nova continua sendo a última da janela do chat', `última: ${lastKey}`);

  console.log('\n# Políticas de notificação');
  const notify = (session: Session, conversationId: string, messageId: string) =>
    api(session, 'POST', '/notifications/messages', { conversationId, messageId });
  const general = await sendMessage(ana, groupId, message(ana, 'group'));
  const targeted = await sendMessage(ana, groupId, message(ana, 'group', { target: { type: 'member', memberId: bia.uid } }));
  const mentioned = await sendMessage(ana, groupId, message(ana, 'group', { mentionedUserIds: [bia.uid, caio.uid] }));

  await expectApi('mensagem inexistente: 404', 404, notify(ana, groupId, 'nao-existe'));
  await expectApi('só o remetente pede o push: 403', 403, notify(bia, groupId, general));
  await expectApi('all_group_messages: todos menos o remetente', { status: 'sent', recipients: 2 }, notify(ana, groupId, general));
  await expectApi('mesma mensagem de novo: sem push repetido', { status: 'duplicate' }, notify(ana, groupId, general));

  await api(ana, 'PATCH', `/groups/${groupId}`, { notificationPolicy: 'mentioned_members' });
  const general2 = await sendMessage(ana, groupId, message(ana, 'group'));
  await expectApi('mentioned_members: mensagem geral não notifica', { status: 'skipped', recipients: 0 }, notify(ana, groupId, general2));
  await expectApi('mentioned_members: destinatário selecionado', { status: 'sent', recipients: 1 }, notify(ana, groupId, targeted));
  await expectApi('mentioned_members: mencionados', { status: 'sent', recipients: 2 }, notify(ana, groupId, mentioned));

  for (const policy of ['direct_messages_only', 'disabled']) {
    await api(ana, 'PATCH', `/groups/${groupId}`, { notificationPolicy: policy });
    const id = await sendMessage(ana, groupId, message(ana, 'group', { target: { type: 'member', memberId: bia.uid } }));
    await expectApi(`${policy}: grupo não gera push`, { status: 'skipped', recipients: 0 }, notify(ana, groupId, id));
  }
  await expectApi('conversa individual: notifica o outro participante', { status: 'sent', recipients: 1 }, notify(ana, anaBia, directMessageId));
  await expectApi('não participante não pede push da conversa: 403', 403, notify(caio, anaBia, directMessageId));

  console.log('\n# Remoção de integrante');
  let cancelled = false;
  let received = 0;
  const stop = onValue(ref(caio.rtdb, `messages/${groupId}`), (snapshot) => (received = snapshot.size), () => (cancelled = true));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const before = received;
  await expectApi('proprietário remove integrante', { status: 'removed' }, api(ana, 'DELETE', `/groups/${groupId}/members/${caio.uid}`));
  await sendMessage(ana, groupId, message(ana, 'group', { text: 'depois da remoção' }));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  stop();
  report(received === before, 'removido não recebe mensagens novas pelo listener já aberto', `recebeu ${received - before}`);
  console.log(`info  listener do removido cancelado pelo servidor: ${cancelled ? 'sim' : 'não'}`);
  await expectRule('removido não lê mais as mensagens', 'denied', () => get(ref(caio.rtdb, `messages/${groupId}`)));
  await expectRule('removido não envia mais mensagens', 'denied', () => sendMessage(caio, groupId, message(caio, 'group')));
  await expectRule('removido não lê mais o grupo', 'denied', () => getDoc(doc(caio.db, 'groups', groupId)));
  await expectRule('removido não lê mais perfis do grupo', 'denied', () => getDoc(doc(caio.db, 'users', bia.uid)));

  console.log('\n# Limite do grupo sob concorrência');
  const LIMIT = 5;
  await api(ana, 'PATCH', `/groups/${groupId}`, { memberLimit: LIMIT });
  const candidates = await Promise.all(Array.from({ length: 10 }, (_, index) => createSession(`Extra${index}`)));
  sessions.push(...candidates);
  const membersBefore = await memberCount(ana, groupId);
  const results = await Promise.all(
    candidates.map((candidate) => api(ana, 'POST', `/groups/${groupId}/members`, { memberId: candidate.uid })),
  );
  const added = results.filter((result) => result.status === 200).length;
  const refused = results.filter((result) => result.status === 409).length;
  const membersAfter = await memberCount(ana, groupId);
  console.log(`info  ${candidates.length} inclusões simultâneas com ${LIMIT - membersBefore} vaga(s): ${added} aceitas, ${refused} recusadas (409)`);
  report(membersAfter === LIMIT, `grupo termina exatamente no limite (${membersAfter}/${LIMIT})`);
  report(added === LIMIT - membersBefore, 'só as vagas disponíveis foram preenchidas', `${added} aceitas`);
  report(added + refused === candidates.length, 'as demais foram recusadas com 409', JSON.stringify(results.map((result) => result.status)));

  await Promise.all(sessions.map((session) => deleteApp(session.app)));
  console.log(failures === 0 ? '\nTudo certo.' : `\n${failures} verificação(ões) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
