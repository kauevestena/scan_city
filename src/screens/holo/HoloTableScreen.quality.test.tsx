import { act, render } from '@testing-library/react';
import { museumSlot } from '@/data/contracts/museum';
import type { HoloEngine, HoloEngineOptions } from '@/engines/holo/HoloEngine';
import { HEIGHTMAP_RES } from '@/engines/holo/sceneBuilder';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { HoloTableScreen } from './HoloTableScreen';

const engines: HoloEngine[] = [];

vi.mock('@/engines/holo/HoloEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/engines/holo/HoloEngine')>();
  class Spied extends mod.HoloEngine {
    constructor(options: HoloEngineOptions) {
      super(options);
      engines.push(this);
    }
  }
  return { ...mod, HoloEngine: Spied };
});

const get = () => useGameStore.getState();

/** Quads do terreno do C00 (o setor mapeado) na cena atual da engine. */
function c00Quads(): number {
  const sector = engines[0]?.sectorAt(museumSlot(2, 1));
  return (sector?.mesh.quads.length ?? 0) / 4;
}

let clock = 0;

/** Desenha `seconds` de quadros a `fps` (relógio falso) dentro de `act`. */
function run(fps: number, seconds: number): void {
  act(() => {
    for (let k = 0; k < fps * seconds; k++) {
      clock += 1000 / fps;
      engines[0]?.render();
    }
  });
}

beforeEach(() => {
  engines.length = 0;
  clock = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  resetGameStore();
  useGameStore.setState((s) => ({
    museum: {
      ...s.museum,
      sectors: {
        C00: {
          contractId: 'C00',
          qualityScore: 0.8,
          mappedAt: 0,
          incomePerMinBRL: 900,
          className: 'C',
        },
      },
    },
    contracts: { ...s.contracts, C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 } },
    settings: { ...s.settings, quality: 'HIGH' },
  }));
  act(() => {
    get().goTo('HOLO_TABLE_VIEW');
  });
});

afterEach(() => vi.restoreAllMocks());

/**
 * Contexto que ignora tudo: o mock de canvas do jsdom guarda cada chamada, e centenas de quadros
 * de um terreno em qualidade alta estourariam a memória do teste.
 */
const NULL_CTX = new Proxy(
  {},
  { get: () => () => undefined, set: () => true },
) as unknown as CanvasRenderingContext2D;

/** No jsdom o canvas não tem tamanho (sem superfície): dá uma à engine para ela desenhar. */
function mount(): void {
  render(<HoloTableScreen />);
  engines[0]?.attach({ ctx: NULL_CTX, width: 800, height: 600, dpr: 1 });
}

describe('HoloTableScreen — queda automática de qualidade (§5.7)', () => {
  it('FPS baixo por 3 s: a mesa cai um nível por vez, com toast; a qualidade global não muda', () => {
    mount();
    const high = HEIGHTMAP_RES.HIGH;
    expect(c00Quads()).toBe(high * high + 4 * high);

    run(30, 3.2);
    const medium = HEIGHTMAP_RES.MEDIUM;
    expect(c00Quads()).toBe(medium * medium + 4 * medium);
    expect(get().session.toasts.map((t) => t.title)).toEqual([
      'Qualidade da mesa reduzida para Média (FPS baixo)',
    ]);
    expect(get().session.toasts[0]?.type).toBe('warn');

    run(30, 3.2);
    const low = HEIGHTMAP_RES.LOW;
    expect(c00Quads()).toBe(low * low + 4 * low);
    expect(get().session.toasts.at(-1)?.title).toBe(
      'Qualidade da mesa reduzida para Baixa (FPS baixo)',
    );

    // Já na mais baixa: continua lento, mas não há mais o que cortar (nem toast repetido).
    const toasts = get().session.toasts.length;
    run(30, 6.5);
    expect(c00Quads()).toBe(low * low + 4 * low);
    expect(get().session.toasts).toHaveLength(toasts);
    expect(get().settings.quality).toBe('HIGH');
  });

  it('a 60 FPS, a qualidade fica como está', () => {
    mount();
    run(60, 8);
    const high = HEIGHTMAP_RES.HIGH;
    expect(c00Quads()).toBe(high * high + 4 * high);
    expect(get().session.toasts).toEqual([]);
  });
});
