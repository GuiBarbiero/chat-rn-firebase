// Valores públicos do app. Podem ser sobrescritos por variáveis EXPO_PUBLIC_* (veja .env.example).

/** URL pública da API que valida as operações de grupo e envia os pushes. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://chat-rn-firebase-api.onrender.com';

/** Cloudinary: serviço que armazena as fotos de perfil e de grupo. */
export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'qepoxwoi';
export const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'chat_unsigned';

/** Host dos emuladores do Firebase (somente desenvolvimento). Vazio = Firebase real. */
export const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '';
