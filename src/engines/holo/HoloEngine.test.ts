import { museumSlot } from '@/data/contracts/museum';
import type { AircraftId } from '@/types';
import { PERF, setPerfEnabled } from '@/engines/perf';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FLY_TO_S, HoloEngine, SCULPT_S } from './HoloEngine';
import { HoloPreview } from './HoloPreview';
import { buildHoloScene, clearHoloCache } from './sceneBuilder';

const C00_SLOT = museumSlot(2, 1);
const lines = [
  { start: { u: 0, v: 20 }, end: { u: 240, v: 20 } },
  { start: { u: 240, v: 60 }, end: { u: 0, v: 60 } },
];
const scene = () =>
  buildHoloScene(
    {
      C00: {
        contractId: 'C00',
        qualityScore: 0.8,
        mappedAt: 0,
        incomePerMinBRL: 900,
        className: 'C',
      },
    },
    {
      C00: {
        status: 'COMPLETED',
        completions: 1,
        bestScore: 0.8,
        bestMissionLines: lines,
        bestAircraftId: 'ATLAS',
      },
    },
    'LOW',
    createTerrain,
  );

function surface() {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  return { ctx, width: 800, height: 600, dpr: 1 };
}

beforeEach(() => clearHoloCache());

describe('HoloEngine', () => {
  it('chegada com foco: fly-to de 1,2 s e o setor esculpido em 1,5 s (STAGE_DONE)', () => {
    let done = 0;
    const e = new HoloEngine({
      scene: scene(),
      input: { axis: () => 0 },
      focusSlot: C00_SLOT,
      onSculptDone: () => done++,
    });
    expect(e.selected).toBe(C00_SLOT);
    expect(e.camera.flying).toBe(true);
    expect(e.sculpting).toBe(true);
    for (let t = 0; t < Math.max(FLY_TO_S, SCULPT_S) + 0.1; t += 1 / 60) e.update(1 / 60);
    expect(e.camera.flying).toBe(false);
    expect(e.camera.target[0]).toBeCloseTo(e.sectorAt(C00_SLOT)?.center[0] ?? NaN, 6);
    expect(e.sculpting).toBe(false);
    expect(done).toBe(1);
  });

  it('clique seleciona pelo picking; arrastar orbita; roda dá zoom; teclas/analógico orbitam', () => {
    const selected: Array<number | null> = [];
    let lx = 0;
    const e = new HoloEngine({
      scene: scene(),
      input: { axis: (a) => (a === 'LOOK_X' ? lx : 0) },
      focusSlot: null,
      onSelect: (s) => selected.push(s),
    });
    const s = surface();
    e.attach(s);
    e.render();
    // Clique no centro da tela: a câmera mira o centro da mesa, no vão entre setores ou num setor.
    e.pointerDown(400, 300);
    e.pointerUp(400, 300);
    expect(selected).toHaveLength(1);
    // Clique fora da mesa: nada selecionado.
    e.pointerDown(2, 2);
    e.pointerUp(2, 2);
    expect(selected.at(-1)).toBeNull();
    const yaw = e.camera.yaw;
    e.pointerDown(100, 100);
    e.pointerMove(200, 120);
    e.pointerUp(200, 120);
    expect(e.camera.yaw).not.toBe(yaw);
    expect(selected).toHaveLength(2);
    const d = e.camera.distance;
    e.wheel(100);
    expect(e.camera.distance).toBeGreaterThan(d);
    lx = 1;
    const before = e.camera.yaw;
    e.update(0.1);
    expect(e.camera.yaw).toBeLessThan(before);
    // Render com miniatura e "?" nos setores em gesso.
    e.update(1);
    e.render();
    expect(s.ctx.fillText).toHaveBeenCalledWith('?', expect.any(Number), expect.any(Number));
  });

  it('pick de cada setor pelo centro projetado', () => {
    const sc = scene();
    const e = new HoloEngine({ scene: sc, input: { axis: () => 0 }, focusSlot: null });
    e.attach(surface());
    e.camera.pitch = (80 * Math.PI) / 180;
    e.camera.distance = e.camera.maxDistance;
    const m = e.camera.matrix(800 / 600);
    for (const sec of sc.sectors) {
      const x = m[0] as number;
      expect(typeof x).toBe('number');
      const p = { x: 0, y: 0 };
      // Centro do topo projetado.
      const cx = sec.center;
      const w =
        (m[3] as number) * cx[0] +
        (m[7] as number) * cx[1] +
        (m[11] as number) * cx[2] +
        (m[15] as number);
      p.x =
        ((((m[0] as number) * cx[0] +
          (m[4] as number) * cx[1] +
          (m[8] as number) * cx[2] +
          (m[12] as number)) /
          w) *
          0.5 +
          0.5) *
        800;
      p.y =
        (1 -
          ((((m[1] as number) * cx[0] +
            (m[5] as number) * cx[1] +
            (m[9] as number) * cx[2] +
            (m[13] as number)) /
            w) *
            0.5 +
            0.5)) *
        600;
      expect(e.pick(p.x, p.y)).toBe(sec.slot);
    }
  });

  it('o preview do escritório desenha a mesma cena num retângulo', () => {
    const { ctx } = surface();
    new HoloPreview(scene()).draw(ctx, 10, 10, 300, 120, 2);
    expect(ctx.clip).toHaveBeenCalled();
  });
});

describe('pintura dos drones na mesa (REQ-PRG-008)', () => {
  const sceneWith = (bestAircraftId: AircraftId) =>
    buildHoloScene(
      {
        C00: {
          contractId: 'C00',
          qualityScore: 0.8,
          mappedAt: 0,
          incomePerMinBRL: 900,
          className: 'C',
        },
      },
      {
        C00: {
          status: 'COMPLETED',
          completions: 1,
          bestScore: 0.8,
          bestMissionLines: lines,
          bestAircraftId,
        },
      },
      'LOW',
      createTerrain,
    );
  const PAINT = { primary: '#22d3ee', secondary: '#0f172a' };

  /** Cores usadas num quadro (fill e stroke). */
  function colorsUsed(bestAircraftId: AircraftId): Set<string> {
    const engine = new HoloEngine({
      scene: sceneWith(bestAircraftId),
      input: { axis: () => 0 },
      focusSlot: null,
      droneColors: () => PAINT,
    });
    const s = surface();
    const used = new Set<string>();
    for (const prop of ['fillStyle', 'strokeStyle'] as const) {
      Object.defineProperty(s.ctx, prop, {
        set: (v: string) => used.add(String(v)),
        get: () => '',
        configurable: true,
      });
    }
    engine.attach(s);
    engine.update(1 / 60);
    engine.render();
    return used;
  }

  it('a miniatura do drone usa a pintura equipada', () => {
    expect(colorsUsed('DRONE_T1').has(PAINT.primary)).toBe(true);
  });

  it('o Atlas (ave) mantém as cores do pombo', () => {
    expect(colorsUsed('ATLAS').has(PAINT.primary)).toBe(false);
  });
});

describe('HoloEngine — contador de tempo por etapa (holo-table §5.7)', () => {
  afterEach(() => setPerfEnabled(false));

  it('ligado, cada render fecha um quadro com cena, renderer e rótulos; desligado, não mede', () => {
    const e = new HoloEngine({ scene: scene(), input: { axis: () => 0 }, focusSlot: null });
    e.attach(surface());
    e.update(1 / 60);
    e.render();
    expect(PERF.holo.frameCount).toBe(0);

    setPerfEnabled(true);
    e.update(1 / 60);
    e.render();
    e.update(1 / 60);
    e.render();
    expect(PERF.holo.frameCount).toBe(2);
    const [update, sceneMs, raster] = PERF.holo.readings();
    expect(update?.ms).toBeGreaterThanOrEqual(0);
    expect(sceneMs?.ms).toBeGreaterThan(0);
    expect(raster?.ms).toBeGreaterThan(0);
  });
});
