import { useEffect } from 'react';
import type { InputContext } from './actions';
import { InputManager } from './InputManager';

/** Define o contexto de input da tela enquanto o componente estiver montado. */
export function useInputContext(ctx: InputContext): void {
  useEffect(() => {
    const manager = InputManager.get();
    const previous = manager.screenContext;
    manager.setContext(ctx);
    return () => manager.setContext(previous);
  }, [ctx]);
}
