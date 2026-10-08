import { useEffect, useState } from 'react';

import { getErrorMessage } from '../utils/errors';

export type Subscribe<T> = (onData: (data: T) => void, onError: (error: Error) => void) => () => void;

type ListenerState<T> = { data: T; loading: boolean; error: string | null };

/**
 * Assina uma fonte em tempo real (Firestore ou Realtime Database).
 * O listener é removido quando o componente desmonta ou quando `subscribe` muda
 * (troca de conversa, logout), então `subscribe` precisa ser estável (useCallback/useMemo).
 */
export function useListener<T>(subscribe: Subscribe<T> | null, initial: T): ListenerState<T> {
  const [state, setState] = useState<ListenerState<T>>({ data: initial, loading: subscribe !== null, error: null });

  useEffect(() => {
    if (!subscribe) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    return subscribe(
      (data) => setState({ data, loading: false, error: null }),
      (error) => setState((current) => ({ ...current, loading: false, error: getErrorMessage(error) })),
    );
  }, [subscribe]);

  return state;
}
