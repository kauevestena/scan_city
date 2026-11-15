/**
 * Fendas de teste (T059): até as fendas reais chegarem (T060+), os testes das telas injetam duas
 * fendas fictícias no catálogo de contratos. Uso, no topo do arquivo de teste:
 *
 *   vi.mock('@/data/contracts', async (importOriginal) =>
 *     (await import('@/test/riftFixtures')).withTestRifts(await importOriginal()),
 *   );
 */
import type * as Catalog from '@/data/contracts';
import type { Contract } from '@/types';

/** R01 (marcador `a`) e R02 (`b`), liberadas pela conclusão do C01, como na spec. */
export function testRifts(base: Contract): Contract[] {
  const rift = (id: string, title: string, marker: string): Contract => ({
    ...base,
    id,
    dimension: 'RIFT',
    title,
    overworldMarker: marker,
    // Retrato de emblema abstrato, como todas as fendas.
    client: {
      ...base.client,
      name: `Cliente ${id}`,
      portrait: {
        shape: 'CIRCLE',
        icon: 'Tractor',
        primary: '#2563eb',
        secondary: '#ef4444',
        initials: 'TT',
      },
    },
    unlock: { type: 'CONTRACT_DONE', contractId: 'C01' },
    museum: { ...base.museum, wing: 'RIFT' },
    specialRules: ['EM_INTERFERENCE'],
  });
  return [
    rift('R01', 'Colinas Verdes de Teste', 'a'),
    rift('R02', 'Reino dos Canos de Teste', 'b'),
  ];
}

/** O módulo de contratos com as fendas de teste no catálogo e em todas as consultas. */
export function withTestRifts(actual: typeof Catalog) {
  const CONTRACTS = [...actual.CONTRACTS, ...testRifts(actual.C00)];
  const byId = new Map(CONTRACTS.map((c) => [c.id, c]));
  return {
    ...actual,
    CONTRACTS,
    findContract: (id: string) => byId.get(id),
    getContract: (id: string) => {
      const found = byId.get(id);
      if (!found) throw new RangeError(`Contrato desconhecido: ${id}`);
      return found;
    },
    contractByMarker: (char: string) => CONTRACTS.find((c) => c.overworldMarker === char),
    initialContracts: () =>
      Object.fromEntries(
        CONTRACTS.map((c) => [
          c.id,
          {
            status: c.unlock.type === 'ALWAYS' ? 'AVAILABLE' : 'LOCKED',
            completions: 0,
            bestScore: 0,
          },
        ]),
      ),
  };
}
