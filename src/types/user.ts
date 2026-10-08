/** Perfil completo, guardado em users/{uid} (dados cadastrais privados). */
export type ChatUser = {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string; // AAAA-MM-DD
  photoUrl: string;
  createdAt: number;
};

/** Dados mínimos para listar e identificar usuários, guardados em publicProfiles/{uid}. */
export type PublicProfile = Pick<ChatUser, 'uid' | 'name' | 'photoUrl'>;

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  birthDate: string; // AAAA-MM-DD
  /** Imagem escolhida no dispositivo (data URI) ou null para usar a imagem padrão. */
  photo: string | null;
};
