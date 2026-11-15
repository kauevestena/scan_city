/** Catálogo de contratos (data-model §4): Mundo Real e, a partir de T059, Fendas. */
import type { Contract, ContractProgress } from '@/types';
import { REAL_CONTRACTS } from './real';

export { C00, C01 } from './real';
export { MUSEUM_GRID, museumSlot, museumSlotCoords } from './museum';

export const CONTRACTS: readonly Contract[] = [...REAL_CONTRACTS];

const BY_ID = new Map(CONTRACTS.map((c) => [c.id, c]));
const BY_MARKER = new Map(CONTRACTS.map((c) => [c.overworldMarker, c]));

export function findContract(id: string): Contract | undefined {
  return BY_ID.get(id);
}

export function getContract(id: string): Contract {
  const contract = BY_ID.get(id);
  if (!contract) throw new RangeError(`Contrato desconhecido: ${id}`);
  return contract;
}

/** Contrato do marcador do mapa (`0`–`6`, `a`–`k`). */
export function contractByMarker(char: string): Contract | undefined {
  return BY_MARKER.get(char);
}

/** Progresso de um jogo novo: os de desbloqueio `ALWAYS` disponíveis, os outros bloqueados. */
export function initialContracts(): Record<string, ContractProgress> {
  return Object.fromEntries(
    CONTRACTS.map((c) => [
      c.id,
      { status: c.unlock.type === 'ALWAYS' ? 'AVAILABLE' : 'LOCKED', completions: 0, bestScore: 0 },
    ]),
  );
}
