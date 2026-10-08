import * as ImagePicker from 'expo-image-picker';

import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../config';
import { AppError } from '../utils/errors';

const UPLOAD_FAILED = 'Não foi possível enviar a foto. Tente novamente.';

/** Pede permissão, abre a galeria e devolve a imagem escolhida como data URI (null se o usuário cancelar). */
export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new AppError('Permissão para acessar as fotos negada. Libere o acesso nas configurações do aparelho.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: true,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.base64) return null;
  return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
}

/**
 * Envia a imagem ao Cloudinary e devolve a URL final. Só essa URL vai para o Firestore;
 * o base64 é apenas o formato de transporte do upload e nunca é gravado nos bancos.
 */
// ponytail: upload "unsigned" (qualquer cliente com o preset envia). Assinar o upload na API se abuso virar problema.
export async function uploadImage(dataUri: string): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME) throw new AppError('O armazenamento de fotos (Cloudinary) não está configurado.');
  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: dataUri, upload_preset: CLOUDINARY_UPLOAD_PRESET }),
    });
  } catch {
    throw new AppError('Sem conexão para enviar a foto. Tente novamente.');
  }
  const payload: unknown = await response.json().catch(() => null);
  const url = typeof payload === 'object' && payload !== null && 'secure_url' in payload ? payload.secure_url : null;
  if (!response.ok || typeof url !== 'string') throw new AppError(UPLOAD_FAILED);
  return url;
}
