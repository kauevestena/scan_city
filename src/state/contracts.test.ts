import type { Contract } from '@/types';
import { resetGameStore } from '@/test/resetStore';
import { AudioEngine } from '@/audio/AudioEngine';

// Catálogo de teste: o C00 real, um contrato que depende do C00 e da reputação e uma fenda.
vi.mock('@/data/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/contracts')>();
  const C01: Contract = {
    ...actual.C00,
    id: 'C01',
    title: 'Metrópole Vertical',
    overworldMarker: '1',
    unlock: {
      type: 'ALL',
      of: [
        { type: 'CONTRACT_DONE', contractId: 'C00' },
        { type: 'REPUTATION', min: 32 },
      ],
    },
  };
  const R01: Contract = {
    ...actual.C00,
    id: 'R01',
    dimension: 'RIFT',
    title: 'Colinas Verdes dos Espinhos',
    overworldMarker: 'a',
    unlock: { type: 'CONTRACT_DONE', contractId: 'C00' },
  };
  const R02: Contract = {
    ...R01,
    id: 'R02',
    title: 'Reino dos Encanamentos',
    overworldMarker: 'b',
  };
  const CONTRACTS = [actual.C00, C01, R01, R02];
  return { ...actual, CONTRACTS };
});

const { useGameStore, hydrateGame } = await import('./store');
const get = () => useGameStore.getState();

beforeEach(() => resetGameStore());

describe('refreshUnlocks', () => {
  it('contratos ausentes entram bloqueados; ALWAYS é liberado com toast', () => {
    useGameStore.setState({ contracts: {} });
    expect(get().refreshUnlocks()).toEqual(['C00']);
    expect(get().contracts.C00?.status).toBe('AVAILABLE');
    expect(get().contracts.C01?.status).toBe('LOCKED');
    expect(get().contracts.R01?.status).toBe('LOCKED');
    expect(get().contracts.R02?.status).toBe('LOCKED');
    expect(get().session.toasts.map((t) => t.title)).toEqual(['Novo contrato: Sítio do Avô']);
  });

  it('libera pela conclusão e pela reputação; fendas vão para as descobertas com RIFT_OPEN', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    useGameStore.setState((s) => ({
      contracts: {
        ...s.contracts,
        C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 },
        C01: { status: 'LOCKED', completions: 0, bestScore: 0 },
        R01: { status: 'LOCKED', completions: 0, bestScore: 0 },
        R02: { status: 'LOCKED', completions: 0, bestScore: 0 },
      },
    }));
    // Reputação 30 < 32: só as duas fendas saem.
    expect(get().refreshUnlocks()).toEqual(['R01', 'R02']);
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    // Duas fendas liberadas juntas tocam `RIFT_OPEN` uma vez só, e cada uma ganha o seu toast.
    expect(play.mock.calls.filter(([id]) => id === 'RIFT_OPEN')).toHaveLength(1);
    expect(get().session.toasts.slice(-2)).toMatchObject([
      { type: 'rift', title: 'Anomalia dimensional detectada: Colinas Verdes dos Espinhos' },
      { type: 'rift', title: 'Anomalia dimensional detectada: Reino dos Encanamentos' },
    ]);
    // Subir a reputação dispara a reavaliação.
    get().changeReputation(2);
    expect(get().contracts.C01?.status).toBe('AVAILABLE');
    expect(get().session.toasts.at(-1)?.title).toBe('Novo contrato: Metrópole Vertical');
    // Concluídos não voltam a ser avaliados.
    expect(get().refreshUnlocks()).toEqual([]);
    expect(get().contracts.C00?.status).toBe('COMPLETED');
  });

  it('silent: libera sem toast nem som (carregamento do save)', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    useGameStore.setState({
      contracts: { C00: { status: 'COMPLETED', completions: 1, bestScore: 1 } },
    });
    expect(get().refreshUnlocks({ silent: true })).toEqual(['R01', 'R02']);
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
    expect(get().session.toasts).toEqual([]);
    expect(play).not.toHaveBeenCalled();
  });

  it('o carregamento do save acrescenta os contratos novos do catálogo, em silêncio', () => {
    // Sem save no armazenamento: a store fica como está, com o catálogo vazio de progresso.
    useGameStore.setState({ contracts: {} });
    hydrateGame();
    expect(get().contracts.C00?.status).toBe('AVAILABLE');
    expect(get().contracts.C01?.status).toBe('LOCKED');
    expect(get().session.toasts).toEqual([]);
  });
});
