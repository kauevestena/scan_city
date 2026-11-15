import { useGameStore } from '@/state/store';

/**
 * Seed global fixa dos testes (`createdAt`): com ela, a MegaMap não faz contraproposta ao
 * aceitar o C00 (progression §8). Os testes da contraproposta trocam a seed.
 */
export const TEST_SEED = 4;
/** Uma seed em que o primeiro aceite do C00 recebe a contraproposta. */
export const TEST_SEED_COUNTER_OFFER = 3;

/** Devolve a store ao estado inicial e limpa o armazenamento (uso em `beforeEach`). */
export function resetGameStore(): void {
  useGameStore.setState({ ...useGameStore.getInitialState(), createdAt: TEST_SEED }, true);
  // Descarta o save pendente gerado pelo reset e apaga as chaves do jogo.
  useGameStore.persist.clearStorage();
  localStorage.clear();
}
