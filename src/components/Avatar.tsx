import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import defaultAvatar from '../../assets/default-avatar.png';
import defaultGroup from '../../assets/default-group.png';
import { colors } from '../theme';

type AvatarProps = {
  /** URL (ou data URI de pré-visualização) da foto. Vazio usa a imagem padrão. */
  uri?: string | null;
  size?: number;
  kind?: 'user' | 'group';
};

/** Foto de perfil ou de grupo, com imagem padrão quando não há foto ou ela falha ao carregar. */
export function Avatar({ uri, size = 48, kind = 'user' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  const fallback = kind === 'group' ? defaultGroup : defaultAvatar;
  return (
    <Image
      source={uri && !failed ? { uri } : fallback}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }}
      accessibilityLabel={kind === 'group' ? 'Foto do grupo' : 'Foto de perfil'}
    />
  );
}
