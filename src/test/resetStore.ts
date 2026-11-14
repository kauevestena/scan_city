import { useGameStore } from '@/state/store';

/** Devolve a store ao estado inicial e limpa o armazenamento (uso em `beforeEach`). */
export function resetGameStore(): void {
  useGameStore.setState(useGameStore.getInitialState(), true);
  // Descarta o save pendente gerado pelo reset e apaga as chaves do jogo.
  useGameStore.persist.clearStorage();
  localStorage.clear();
}
