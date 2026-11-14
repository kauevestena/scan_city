import { useGameStore } from '@/state/store';

/** Devolve a store ao estado inicial (uso em `beforeEach`). */
export function resetGameStore(): void {
  useGameStore.setState(useGameStore.getInitialState(), true);
}
