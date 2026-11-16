import { CONTRACTS } from '@/data/contracts';
import { museumSlot } from '@/data/contracts/museum';
import { getAircraft } from '@/data/catalog';
import type { AircraftId, MuseumSector } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { drawAircraft } from '../flight/aircraftSprite';
import { projectPoint } from '../soft3d/mat4';
import { Soft3DRenderer, type LineSet, type MeshInstance, type PointSet } from '../soft3d/Renderer';
import { DIMENSION_FLY_S, HoloEngine, overviewDistance } from './HoloEngine';
import {
  BOB_AMPLITUDE,
  buildHoloScene,
  clearHoloCache,
  FLOAT_Y,
  PEDESTAL_Y,
  RING_TABLE_RADIUS,
  type HoloMode,
  type HoloView,
} from './sceneBuilder';

vi.mock('../flight/aircraftSprite', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../flight/aircraftSprite')>();
  return { ...mod, drawAircraft: vi.fn(mod.drawAircraft) };
});

const lines = [
  { start: { u: 0, v: 20 }, end: { u: 240, v: 20 } },
  { start: { u: 240, v: 60 }, end: { u: 0, v: 60 } },
];

const sector = (id: string): MuseumSector => ({
  contractId: id,
  qualityScore: 0.8,
  mappedAt: 0,
  incomePerMinBRL: 900,
  className: 'C',
});

function sceneOf(ids: string[], view: HoloView = {}, aircraft: AircraftId = 'ATLAS') {
  return buildHoloScene(
    Object.fromEntries(ids.map((id) => [id, sector(id)])),
    Object.fromEntries(
      ids.map((id) => [
        id,
        {
          status: 'COMPLETED' as const,
          completions: 1,
          bestScore: 0.8,
          bestMissionLines: lines,
          bestAircraftId: aircraft,
        },
      ]),
    ),
    'LOW',
    createTerrain,
    CONTRACTS,
    view,
  );
}

function surface() {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  return { ctx, width: 800, height: 600, dpr: 1 };
}

interface Frame {
  meshes: readonly MeshInstance[];
  lines: readonly LineSet[];
  points: readonly PointSet[];
}

/** Renderiza um quadro e devolve o que a engine mandou ao rasterizador. */
function frameOf(engine: HoloEngine, surf = surface()): Frame & { fills: string[] } {
  const spy = vi.spyOn(Soft3DRenderer.prototype, 'render');
  const fills: string[] = [];
  Object.defineProperty(surf.ctx, 'fillStyle', {
    set: (v: string) => fills.push(String(v)),
    get: () => '',
    configurable: true,
  });
  engine.attach(surf);
  engine.render();
  const call = spy.mock.calls.at(-1) as unknown[];
  spy.mockRestore();
  return {
    meshes: call[4] as readonly MeshInstance[],
    lines: call[5] as readonly LineSet[],
    points: call[6] as readonly PointSet[],
    fills,
  };
}

const engineFor = (scene: ReturnType<typeof sceneOf>, extra = {}) =>
  new HoloEngine({ scene, input: { axis: () => 0 }, focusSlot: null, ...extra });

beforeEach(() => {
  clearHoloCache();
  vi.mocked(drawAircraft).mockClear();
});

describe('HoloEngine — modos (REQ-HOL-006)', () => {
  it('ORTHO e HYPSO: fundo slate-950 e grade de chão; NEON: preto puro, sem grade', () => {
    const ortho = frameOf(engineFor(sceneOf(['C00'], { mode: 'ORTHO' })));
    expect(ortho.fills[0]).toBe('#020617');
    expect(ortho.lines.some((l) => l.color.includes('0.1)'))).toBe(true);
    const hypso = frameOf(engineFor(sceneOf(['C00'], { mode: 'HYPSO' })));
    expect(hypso.fills[0]).toBe('#020617');
    const neon = frameOf(engineFor(sceneOf(['C00'], { mode: 'NEON' })));
    expect(neon.fills[0]).toBe('#000000');
    expect(neon.lines.some((l) => l.color.includes('0.1)'))).toBe(false);
  });

  it('NEON: o setor mapeado vai como pontos ciano e wireframe (TIN), sem malha de preenchimento', () => {
    const frame = frameOf(engineFor(sceneOf(['C00'], { mode: 'NEON' })));
    // Só a mesa (fundo) é malha; o terreno do C00 não é preenchido.
    expect(frame.meshes.filter((m) => !m.background)).toHaveLength(0);
    expect(frame.points.some((p) => p.color.includes('34, 211, 238'))).toBe(true);
    expect(frame.lines.some((l) => l.glow !== undefined && l.color.includes('0.4)'))).toBe(true);
  });

  it('HYPSO: curvas de nível como linhas e prédios translúcidos', () => {
    const frame = frameOf(engineFor(sceneOf(['C01'], { mode: 'HYPSO' })));
    expect(frame.lines.some((l) => l.color === 'rgba(2, 6, 23, 0.6)')).toBe(true);
    expect(frame.meshes.some((m) => m.alpha === 0.6)).toBe(true);
  });

  it.each<HoloMode>(['ORTHO', 'HYPSO', 'NEON'])('%s: desenha a mesa completa sem erro', (mode) => {
    const e = engineFor(sceneOf(['C00', 'C02'], { mode }));
    e.attach(surface());
    e.update(0.5);
    expect(() => e.render()).not.toThrow();
  });
});

describe('HoloEngine — Multiverso (REQ-HOL-005)', () => {
  const ringView: HoloView = { dimension: 'RIFT' };

  it('anel: 1 diorama esculpido (R01) e 10 cubos violeta em wireframe', () => {
    const frame = frameOf(engineFor(sceneOf(['R01'], ringView)));
    const cubes = frame.lines.filter(
      (l) =>
        l.positions.length === 24 && l.segments.length === 24 && l.color.includes('139, 92, 246'),
    );
    expect(cubes).toHaveLength(10);
    // Esculpido: uma malha de terreno com o deslocamento do diorama.
    const relief = frame.meshes.filter((m) => !m.background);
    expect(relief.length).toBeGreaterThan(0);
    // Sem oceano, sem pedestal.
    expect(relief.every((m) => m.alpha === undefined || m.alpha === 1)).toBe(true);
  });

  it('o diorama flutua: elevação = FLOAT_Y + 0,05·sin(t + slot)', () => {
    const e = engineFor(sceneOf(['R01'], ringView));
    e.update(1.3);
    const r01 = e.sectorAt(0);
    if (!r01) throw new Error('R01 ausente');
    expect(e.bob(r01)).toBeCloseTo(BOB_AMPLITUDE * Math.sin(1.3 + 0), 9);
    const other = e.sectorAt(4);
    expect(e.bob(other ?? r01)).toBeCloseTo(BOB_AMPLITUDE * Math.sin(1.3 + 4), 9);
    const frame = frameOf(e);
    const relief = frame.meshes.find((m) => !m.background);
    expect(relief?.yOffset).toBeCloseTo(FLOAT_Y + BOB_AMPLITUDE * Math.sin(1.3), 9);
    // A oscilação nunca passa de ±0,05.
    for (let t = 0; t < 7; t += 0.25) {
      e.update(0.25);
      expect(Math.abs(e.bob(r01))).toBeLessThanOrEqual(BOB_AMPLITUDE + 1e-12);
    }
  });

  it('a Real não oscila nem tem cubos', () => {
    const e = engineFor(sceneOf(['C00']));
    e.update(2);
    const sec = e.sectorAt(museumSlot(2, 1));
    if (!sec) throw new Error('setor ausente');
    expect(e.bob(sec)).toBe(0);
  });

  it('troca de dimensão: raio da mesa novo, câmera de volta ao centro; a seleção fica com a tela', () => {
    const real = sceneOf(['C00']);
    const e = engineFor(real);
    e.select(museumSlot(2, 1));
    e.setScene(sceneOf(['R01'], ringView));
    expect(e.camera.radius).toBe(RING_TABLE_RADIUS);
    expect(e.camera.flying).toBe(true);
    for (let t = 0; t < DIMENSION_FLY_S + 0.1; t += 1 / 60) e.update(1 / 60);
    expect(e.camera.flying).toBe(false);
    expect(e.camera.target).toEqual([0, 0, 0]);
    expect(e.camera.distance).toBeCloseTo(overviewDistance(sceneOf(['R01'], ringView)), 6);
    expect(e.camera.distance).toBeCloseTo(2.2 * RING_TABLE_RADIUS, 6);
    // Trocar só o modo (mesma dimensão) não mexe na câmera.
    e.camera.distance = 5;
    e.setScene(sceneOf(['R01'], { ...ringView, mode: 'NEON' }));
    expect(e.camera.flying).toBe(false);
    expect(e.camera.distance).toBe(5);
  });

  it('chegada de uma fenda: foca o diorama e esculpe; o picking vê o diorama', () => {
    let done = 0;
    const scene = sceneOf(['R01'], ringView);
    const e = engineFor(scene, { focusSlot: 0, onSculptDone: () => done++ });
    expect(e.selected).toBe(0);
    expect(e.sculpting).toBe(true);
    for (let t = 0; t < 1.7; t += 1 / 60) e.update(1 / 60);
    expect(e.sculpting).toBe(false);
    expect(done).toBe(1);
    // O alvo da câmera fica sobre o diorama (a mesa é maior que a da Real).
    const r01 = e.sectorAt(0);
    expect(e.camera.target[0]).toBeCloseTo(r01?.center[0] ?? NaN, 6);
    e.attach(surface());
    const m = e.camera.matrix(800 / 600);
    const c = r01?.center ?? [0, 0, 0];
    const p = projectPoint(m, c[0], c[1] + (r01 ? e.bob(r01) : 0), c[2], 800, 600);
    expect(e.pick(p.x, p.y)).toBe(0);
  });
});

describe('HoloEngine — destaque (REQ-HOL-007)', () => {
  it('o setor destacado ganha pedestal e cone de luz (alfa 0,13) e sobe PEDESTAL_Y', () => {
    const plain = frameOf(engineFor(sceneOf(['C00', 'C02'])));
    expect(plain.meshes.some((m) => m.alpha === 0.13)).toBe(false);
    const frame = frameOf(engineFor(sceneOf(['C00', 'C02'], { featured: { REAL: 'C00' } })));
    expect(frame.meshes.filter((m) => m.alpha === 0.13)).toHaveLength(1);
    expect(frame.meshes.filter((m) => m.yOffset === PEDESTAL_Y).length).toBeGreaterThan(0);
    // Pedestal + cone são as duas malhas extras, só do setor destacado.
    expect(frame.meshes.length).toBe(plain.meshes.length + 2);
  });
});

describe('HoloEngine — miniaturas por aeronave (REQ-HOL-004)', () => {
  const kindsDrawn = (aircraft: AircraftId, view: HoloView = {}, ids = ['C00']) => {
    const e = engineFor(sceneOf(ids, view, aircraft));
    e.attach(surface());
    e.update(1);
    e.render();
    return vi.mocked(drawAircraft).mock.calls.map(([, p]) => p.kind);
  };

  it.each<[AircraftId, string]>([
    ['ATLAS', 'BIRD'],
    ['DRONE_T1', 'MULTIROTOR'],
    ['DRONE_T2', 'MULTIROTOR'],
    ['VTOL_T3', 'FIXED_WING_VTOL'],
  ])('%s voa como %s', (id, kind) => {
    expect(getAircraft(id).kind).toBe(kind);
    expect(kindsDrawn(id)).toEqual([kind]);
  });

  it('também voa nos dioramas do Multiverso, acima da ilha que flutua', () => {
    expect(kindsDrawn('VTOL_T3', { dimension: 'RIFT' }, ['R01'])).toEqual(['FIXED_WING_VTOL']);
    const calls = vi.mocked(drawAircraft).mock.calls;
    expect(calls).toHaveLength(1);
  });

  it('uma miniatura por setor mapeado com a melhor missão', () => {
    expect(kindsDrawn('DRONE_T1', {}, ['C00', 'C02', 'C03'])).toHaveLength(3);
  });
});

describe('HoloEngine — seleção espacial (§5.6)', () => {
  const projected = (e: HoloEngine, slot: number) => {
    const sec = e.sectorAt(slot);
    const m = e.camera.matrix(800 / 600);
    const c = sec?.center ?? [0, 0, 0];
    return projectPoint(m, c[0], c[1], c[2], 800, 600);
  };

  it('sem seleção, escolhe o setor mais central; depois, o vizinho na direção pedida', () => {
    const selected: Array<number | null> = [];
    const e = engineFor(sceneOf(['C00']), { onSelect: (s: number | null) => selected.push(s) });
    e.attach(surface());
    e.camera.pitch = (70 * Math.PI) / 180;
    const first = e.moveSelection('RIGHT');
    expect(first).not.toBeNull();
    expect(selected).toHaveLength(1);
    const from = projected(e, first as number);
    for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN'] as const) {
      const start = e.selected as number;
      const next = e.moveSelection(dir);
      if (next === start) continue; // beira da mesa: não há vizinho nessa direção
      const a = projected(e, start);
      const b = projected(e, next as number);
      if (dir === 'RIGHT') expect(b.x).toBeGreaterThan(a.x);
      if (dir === 'LEFT') expect(b.x).toBeLessThan(a.x);
      if (dir === 'UP') expect(b.y).toBeLessThan(a.y);
      if (dir === 'DOWN') expect(b.y).toBeGreaterThan(a.y);
      e.select(start);
    }
    expect(from.w).toBeGreaterThan(0);
  });

  it('sem superfície, a seleção não muda', () => {
    const e = engineFor(sceneOf([]));
    expect(e.moveSelection('LEFT')).toBeNull();
  });

  it('percorre os 7 setores da Real só pelas direções', () => {
    const e = engineFor(sceneOf([]));
    e.attach(surface());
    e.camera.pitch = (75 * Math.PI) / 180;
    e.camera.yaw = 0;
    e.moveSelection('UP');
    const seen = new Set<number>([e.selected as number]);
    for (const dir of ['RIGHT', 'RIGHT', 'RIGHT', 'DOWN', 'LEFT', 'LEFT', 'LEFT', 'UP'] as const) {
      e.moveSelection(dir);
      seen.add(e.selected as number);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe('HoloEngine — queda automática de qualidade (§5.7)', () => {
  /** Engine com relógio falso e superfície; `frames(fps, s)` desenha `s` segundos a `fps`. */
  function rig(onLowFps: () => void) {
    let clock = 5000;
    const engine = engineFor(sceneOf(['C00']), { onLowFps, now: () => clock });
    // Contexto que ignora tudo: o mock de canvas guarda cada chamada de centenas de quadros.
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    engine.attach({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      width: 800,
      height: 600,
      dpr: 1,
    });
    return {
      engine,
      frames(fps: number, seconds: number) {
        for (let k = 0; k < Math.round(fps * seconds); k++) {
          clock += 1000 / fps;
          engine.render();
        }
      },
    };
  }

  it('abaixo de 50 FPS por 3 s avisa a tela; a 60 FPS, não', () => {
    let drops = 0;
    const slow = rig(() => drops++);
    slow.frames(30, 3.2);
    expect(drops).toBe(1);
    const fast = rig(() => drops++);
    fast.frames(60, 6);
    expect(drops).toBe(1);
  });

  it('mede o quadro desenhado, não os sub-passos do update (o loop divide cada quadro em passos de 1/60 s)', () => {
    let drops = 0;
    const { engine, frames } = rig(() => drops++);
    // 25 FPS reais: cada quadro de 40 ms chega ao update como 3 sub-passos de ~13 ms.
    for (let k = 0; k < 25 * 3.4; k++) {
      for (let step = 0; step < 3; step++) engine.update(0.04 / 3);
      frames(25, 1 / 25);
    }
    expect(drops).toBe(1);
  });

  it('trocar a cena recomeça a janela', () => {
    let drops = 0;
    const { engine, frames } = rig(() => drops++);
    frames(30, 2.5);
    engine.setScene(sceneOf(['C00'], { mode: 'HYPSO' }));
    frames(30, 2.5);
    expect(drops).toBe(0);
  });

  it('o tranco de uma troca de cena não conta como quadro lento', () => {
    let drops = 0;
    const { engine, frames } = rig(() => drops++);
    frames(60, 2.8);
    engine.setScene(sceneOf(['C00'], { mode: 'NEON' }));
    // O primeiro quadro depois da troca não tem referência (o rebuild pode ter levado 300 ms).
    frames(60, 3.1);
    expect(drops).toBe(0);
  });

  it('setLowFpsHandler troca o ouvinte', () => {
    let a = 0;
    let b = 0;
    const { engine, frames } = rig(() => a++);
    engine.setLowFpsHandler(() => b++);
    frames(30, 3.2);
    expect([a, b]).toEqual([0, 1]);
  });
});
