import { useConnectivity } from '../hooks/useConnectivity';
import { ErrorMessage } from './ErrorMessage';

/** Aviso de falha de conectividade; some sozinho quando a conexão volta. */
export function OfflineBanner() {
  const online = useConnectivity();
  return (
    <ErrorMessage
      tone="warning"
      message={online ? null : 'Sem conexão. As mensagens voltam a sincronizar quando a internet retornar.'}
    />
  );
}
