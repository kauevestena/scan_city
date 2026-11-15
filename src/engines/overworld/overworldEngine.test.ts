import type { AxisAction } from '@/input/actions';
import { initialContracts } from '@/data/contracts';
import { markerViews, type MarkerView } from '@/world/overworld/markers';
import { parseMap, WORLD_MAP } from '@/world/overworld/tiles';
import { AVATAR_BOX, boxBlocker, stepAvatar, type AvatarState } from './avatar';
import { CAMERA_LERP, clampCamera, followCamera } from './camera';
import { drawMinimap, renderMinimapBase } from './minimap';
import {
  HINT_THROTTLE_S,
  INTERACT_RADIUS,
  OverworldEngine,
  zoomFor,
  type InteractTarget,
} from './OverworldEngine';
import {
  ChunkCache,
  CHUNK_TILES,
  drawMarker,
  drawPortal,
  drawRiftAtmosphere,
  MARKER_COLORS,
  TILE_COLORS,
} from './tileRenderer';
import { COLORS } from '@/ui/tokens';

// Porta em (2,1), spawn em (3,1), encosta íngreme em (5,1), água em (0,3), C00 em (8,3).
const MINI = parseMap(['..........', '..O@.A....', '..........', '~.......0.']);
const MINI_MARKERS = markerViews(initialContracts(), 'REAL', [], MINI);
const SKIN = { primary: '#f97316', secondary: '#1e293b' };
const at = (x: number, y: number, facing: AvatarState['facing'] = 'S'): AvatarState => ({
  x,
  y,
  facing,
  walked: 0,
});

type AvatarStart = Omit<AvatarState, 'walked'>;

function fakeInput() {
  const axes: Partial<Record<AxisAction, number>> = {};
  return { axes, axis: (a: AxisAction) => axes[a] ?? 0 };
}

function surface(width = 1280, height = 672) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  return { ctx, width, height, dpr: 1 };
}

function engineOn(map = MINI, start: AvatarStart = { x: 3.5, y: 1.5, facing: 'S' }) {
  const input = fakeInput();
  const hints: string[] = [];
  const targets: Array<InteractTarget | null> = [];
  const engine = new OverworldEngine({
    map,
    input,
    start,
    vehicle: () => 'FOOT_BIKE',
    speedMod: () => 1,
    skin: () => SKIN,
    markers: () => (map === MINI ? MINI_MARKERS : []),
    onHint: (t) => hints.push(t),
    onTargetChange: (t) => targets.push(t),
  });
  return { engine, input, hints, targets };
}

/** Roda `seconds` de simulação em sub-passos de 1/60 s. */
function run(engine: OverworldEngine, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) engine.update(1 / 60);
}

describe('stepAvatar — velocidade e colisão por eixo', () => {
  it('anda na velocidade do tile; MOVE_Y > 0 é para o norte', () => {
    const r = stepAvatar(MINI, at(5.5, 2.5), 1, 0, 'FOOT_BIKE', 1, 0.5);
    expect(r.state.x).toBeCloseTo(7, 6); // grama: 3 tiles/s
    expect(r.state.facing).toBe('E');
    expect(r.moved).toBeCloseTo(1.5, 6);
    const n = stepAvatar(MINI, at(7.5, 2.5), 0, 1, 'FOOT_BIKE', 1, 0.1);
    expect(n.state.y).toBeCloseTo(2.2, 6);
    expect(n.state.facing).toBe('N');
  });

  it('normaliza a diagonal, respeita o analógico parcial e o modificador de velocidade', () => {
    const d = stepAvatar(MINI, at(7.5, 2.5), 1, -1, 'FOOT_BIKE', 1, 0.1);
    expect(d.moved).toBeCloseTo(0.3, 6);
    const half = stepAvatar(MINI, at(7.5, 2.5), 0.5, 0, 'FOOT_BIKE', 1, 0.1);
    expect(half.moved).toBeCloseTo(0.15, 6);
    const fast = stepAvatar(MINI, at(7.5, 2.5), 1, 0, 'FOOT_BIKE', 1.2, 0.1);
    expect(fast.moved).toBeCloseTo(0.36, 6);
    expect(stepAvatar(MINI, at(7.5, 2.5), 0, 0, 'FOOT_BIKE', 1, 0.1).moved).toBe(0);
  });

  it('para no tile intransponível e informa o tipo; desliza no outro eixo', () => {
    // Encostado na encosta (5,1): a caixa de 0,6 tile não pode invadir x ≥ 5.
    const start = at(5 - AVATAR_BOX / 2 - 0.01, 1.5);
    const blocked = stepAvatar(MINI, start, 1, 0, 'FOOT_BIKE', 1, 0.1);
    expect(blocked.blockedBy).toBe('HILL_STEEP');
    expect(blocked.state.x).toBe(start.x);
    const slide = stepAvatar(MINI, start, 1, -1, 'FOOT_BIKE', 1, 0.1);
    expect(slide.state.x).toBe(start.x);
    expect(slide.state.y).toBeGreaterThan(start.y);
    expect(boxBlocker(MINI, 0.5, 3.5, 'FOOT_BIKE')).toBe('WATER');
    // Fora do mapa conta como montanha.
    expect(stepAvatar(MINI, at(0.35, 0.5), -1, 0, 'FOOT_BIKE', 1, 0.1).blockedBy).toBe('MOUNTAIN');
  });
});

describe('câmera', () => {
  it('lerp de 0,15 por frame a 60 FPS, independente da taxa', () => {
    const c = followCamera({ x: 0, y: 0 }, { x: 10, y: 0 }, 1 / 60);
    expect(c.x).toBeCloseTo(10 * CAMERA_LERP, 9);
    const twoHalf = followCamera(
      followCamera({ x: 0, y: 0 }, { x: 10, y: 0 }, 1 / 120),
      { x: 10, y: 0 },
      1 / 120,
    );
    expect(twoHalf.x).toBeCloseTo(c.x, 9);
  });

  it('presa aos limites do mapa; centrada se a vista for maior', () => {
    expect(clampCamera({ x: 1, y: 99 }, 26.7, 14, 160, 100)).toEqual({ x: 13.35, y: 93 });
    expect(clampCamera({ x: 3, y: 1 }, 20, 10, 10, 4)).toEqual({ x: 5, y: 2 });
  });

  it('zoom 1,5× em 1280 px (≈ 27 tiles), com limites', () => {
    expect(zoomFor(1280)).toBe(1.5);
    expect(1280 / (32 * zoomFor(1280))).toBeCloseTo(26.7, 1);
    expect(zoomFor(320)).toBe(1);
    expect(zoomFor(5000)).toBe(3);
  });
});

describe('OverworldEngine', () => {
  it('anda até a porta, avisa a proximidade e o INTERACT aponta a sede', () => {
    const { engine, input, targets } = engineOn();
    expect(engine.interact()).toBeNull();
    input.axes.MOVE_X = -1;
    run(engine, 0.25);
    expect(engine.isNearDoor()).toBe(true);
    expect(targets).toEqual([{ kind: 'DOOR' }]);
    expect(engine.interact()).toEqual({ kind: 'DOOR' });
    expect(Math.hypot(engine.avatar.x - 2.5, engine.avatar.y - 1.5)).toBeLessThanOrEqual(
      INTERACT_RADIUS,
    );
    input.axes.MOVE_X = 1;
    run(engine, 0.5);
    expect(targets).toEqual([{ kind: 'DOOR' }, null]);
  });

  it('marcador no raio de 0,8 tile vira o alvo; o teleporte leva até ele', () => {
    const { engine, targets } = engineOn();
    engine.teleport(8.5, 3.5);
    expect(engine.position).toMatchObject({ x: 8.5, y: 3.5 });
    engine.update(1 / 60);
    const target = targets.at(-1);
    expect(target?.kind).toBe('MARKER');
    expect(target?.kind === 'MARKER' && target.marker).toMatchObject({
      contractId: 'C00',
      status: 'AVAILABLE',
    });
    expect(engine.interact()).toEqual(target);
    // Mesmo alvo nos frames seguintes: nenhum aviso novo.
    engine.update(1 / 60);
    expect(targets).toHaveLength(1);
  });

  it('dica de bloqueio com throttle de 3 s', () => {
    const { engine, input, hints } = engineOn(MINI, { x: 4.6, y: 1.5, facing: 'E' });
    input.axes.MOVE_X = 1;
    run(engine, HINT_THROTTLE_S * 2 - 0.5);
    expect(hints).toEqual([
      'Encosta íngreme — requer Picape 4x4',
      'Encosta íngreme — requer Picape 4x4',
    ]);
    expect(engine.isMoving).toBe(false);
  });

  it('acumula a distância para as estatísticas e zera na leitura', () => {
    const { engine, input } = engineOn(MINI, { x: 7.5, y: 2.5, facing: 'S' });
    input.axes.MOVE_X = 1;
    run(engine, 0.5);
    expect(engine.takeDistance()).toBeCloseTo(1.5, 6);
    expect(engine.takeDistance()).toBe(0);
    expect(engine.position).toMatchObject({ facing: 'E' });
  });

  it('save em tile inválido: vai para o tile caminhável mais próximo', () => {
    const { engine } = engineOn(MINI, { x: 0.5, y: 3.5, facing: 'N' });
    expect(engine.position).toEqual({ x: 1.5, y: 3.5, facing: 'N' });
  });

  it('renderiza chunks visíveis, água e marcadores; a câmera segue o avatar', () => {
    const { engine, input } = engineOn(WORLD_MAP, {
      x: WORLD_MAP.spawn.x + 0.5,
      y: WORLD_MAP.spawn.y + 0.5,
      facing: 'S',
    });
    const s = surface();
    engine.attach(s);
    expect(engine.viewTiles().w).toBeCloseTo(26.7, 1);
    engine.render();
    expect(s.ctx.drawImage).toHaveBeenCalled();
    const before = engine.camera.x;
    input.axes.MOVE_X = 1;
    run(engine, 0.1);
    engine.render();
    expect(engine.camera.x).toBeGreaterThan(before);
    expect(engine.camera.x).toBeLessThan(engine.avatar.x);
  });
});

describe('render de tiles e minimapa', () => {
  it('cada tipo de tile tem cor', () => {
    for (const t of new Set(WORLD_MAP.tiles)) expect(TILE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('ChunkCache: reaproveita, descarta o mais antigo e refaz na troca de escala', () => {
    const cache = new ChunkCache(WORLD_MAP, 2);
    const a = cache.get(0, 0, 1);
    expect(cache.get(0, 0, 1)).toBe(a);
    expect(a.canvas.width).toBe(CHUNK_TILES * 32);
    cache.get(1, 0, 1);
    cache.get(0, 0, 1);
    cache.get(2, 0, 1); // descarta (1,0), o usado há mais tempo
    expect(cache.size).toBe(2);
    expect(cache.get(0, 0, 1)).toBe(a);
    const scaled = cache.get(0, 0, 2);
    expect(scaled).not.toBe(a);
    expect(scaled.canvas.width).toBe(CHUNK_TILES * 32 * 2);
    expect(cache.size).toBe(1);
  });

  it('marcadores por status (cadeado, "MM") e minimapa desenham sem erro', () => {
    const { ctx } = surface();
    const base: MarkerView = {
      char: '0',
      kind: 'CONTRACT',
      x: 3,
      y: 4,
      contractId: 'C00',
      status: 'AVAILABLE',
    };
    for (const status of ['AVAILABLE', 'LOCKED', 'COMPLETED', 'STOLEN'] as const) {
      drawMarker(ctx, { ...base, status }, 1.2);
    }
    expect(MARKER_COLORS.AVAILABLE).not.toBe(MARKER_COLORS.LOCKED);
    expect(ctx.fillText).toHaveBeenCalledWith('MM', expect.any(Number), expect.any(Number));
    const mini = renderMinimapBase(MINI);
    expect([mini.width, mini.height]).toEqual([10, 4]);
    drawMinimap(ctx, mini, MINI_MARKERS, { x: 3.5, y: 1.5 }, MINI.door, 0);
    expect(ctx.drawImage).toHaveBeenCalledWith(mini, 0, 0);
  });
});

describe('Fendas: portais, atmosfera violeta e a aba (contracts-rifts §1)', () => {
  const riftMarker = (status: MarkerView['status'] = 'AVAILABLE'): MarkerView => ({
    char: 'a',
    kind: 'RIFT',
    x: 3,
    y: 4,
    contractId: 'R01',
    status,
  });
  /** Valores atribuídos a uma propriedade do contexto, na ordem (vitest-canvas-mock). */
  const assigned = (ctx: CanvasRenderingContext2D, prop: 'fillStyle' | 'strokeStyle') =>
    (
      ctx as unknown as {
        __getEvents(): Array<{ type: string; props: { value?: unknown } }>;
      }
    )
      .__getEvents()
      .filter((e) => e.type === prop)
      .map((e) => String(e.props.value));

  it('o marcador de fenda é um portal: anéis violeta e 8 faíscas; sem faíscas só os anéis', () => {
    const { ctx } = surface();
    drawMarker(ctx, riftMarker(), 1.2);
    expect(ctx.ellipse).toHaveBeenCalledTimes(3);
    expect(ctx.fillRect).toHaveBeenCalledTimes(8);
    expect(assigned(ctx, 'strokeStyle')[0]).toBe('rgba(139, 92, 246, 0.9)');
    const calm = surface();
    drawMarker(calm.ctx, riftMarker(), 1.2, false);
    expect(calm.ctx.fillRect).not.toHaveBeenCalled();
    expect(calm.ctx.ellipse).toHaveBeenCalledTimes(3);
    // Contrato comum continua sendo o losango, sem elipses de portal.
    const plain = surface();
    drawMarker(plain.ctx, { ...riftMarker(), kind: 'CONTRACT', char: '0', contractId: 'C00' }, 1.2);
    expect(plain.ctx.ellipse).not.toHaveBeenCalled();
  });

  it('o portal pulsa no tempo, e o da fenda concluída é verde e mais calmo', () => {
    const a = surface();
    const b = surface();
    drawPortal(a.ctx, riftMarker(), 0);
    drawPortal(b.ctx, riftMarker(), Math.PI / 8);
    const radius = (c: { ctx: CanvasRenderingContext2D }) =>
      (c.ctx.arc as unknown as { mock: { calls: number[][] } }).mock.calls[0]?.[2] as number;
    expect(radius(a)).not.toBeCloseTo(radius(b), 3);
    const done = surface();
    drawPortal(done.ctx, riftMarker('COMPLETED'), 0);
    expect(assigned(done.ctx, 'strokeStyle')[0]).toBe('rgba(52, 211, 153, 0.9)');
  });

  it('a atmosfera da aba Fendas: véu violeta e 60 partículas; reduceFlashes, só o véu, sem pulso', () => {
    const live = surface();
    drawRiftAtmosphere(live.ctx, 800, 600, 1, 2.5, false);
    expect(live.ctx.fillRect).toHaveBeenCalledTimes(1 + 60);
    expect(assigned(live.ctx, 'fillStyle')[0]).toMatch(/^rgba\(139, 92, 246, 0\.1\d*\)$/);
    const calm = surface();
    drawRiftAtmosphere(calm.ctx, 800, 600, 1, 2.5, true);
    expect(calm.ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(assigned(calm.ctx, 'fillStyle')[0]).toBe('rgba(139, 92, 246, 0.16)');
    // O véu calmo é o mesmo em qualquer instante.
    const later = surface();
    drawRiftAtmosphere(later.ctx, 800, 600, 1, 99, true);
    expect(assigned(later.ctx, 'fillStyle')[0]).toBe('rgba(139, 92, 246, 0.16)');
  });

  it('o engine só aplica o véu na aba Fendas, e os portais entram na lista de marcadores', () => {
    const fills = (dimension: 'REAL' | 'RIFT', reduceFlashes = false) => {
      const input = fakeInput();
      const engine = new OverworldEngine({
        map: MINI,
        input,
        start: { x: 3.5, y: 1.5, facing: 'E' },
        vehicle: () => 'FOOT_BIKE',
        speedMod: () => 1,
        skin: () => SKIN,
        markers: () => [{ ...riftMarker(), x: 6, y: 1 }],
        dimension: () => dimension,
        reduceFlashes: () => reduceFlashes,
      });
      const s = surface();
      engine.attach(s);
      engine.update(1 / 60);
      engine.render();
      return {
        rects: (s.ctx.fillRect as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
        veil: assigned(s.ctx, 'fillStyle').filter((v) => v.startsWith('rgba(139, 92, 246, 0.1')),
      };
    };
    const real = fills('REAL');
    const rift = fills('RIFT');
    const calm = fills('RIFT', true);
    expect(real.veil).toEqual([]);
    expect(rift.veil.length).toBeGreaterThan(0);
    // Mais retângulos na aba Fendas (véu + partículas) que na Real; calmo, quase nenhum a mais.
    expect(rift.rects).toBeGreaterThan(real.rects + 50);
    expect(calm.rects).toBeLessThan(rift.rects - 50);
  });

  it('no minimapa a fenda é violeta, e verde depois de concluída', () => {
    const { ctx } = surface();
    const mini = renderMinimapBase(MINI);
    drawMinimap(
      ctx,
      mini,
      [riftMarker(), { ...riftMarker('COMPLETED'), x: 6 }],
      { x: 1, y: 1 },
      MINI.door,
      0,
    );
    const fills = assigned(ctx, 'fillStyle');
    expect(fills).toContain(COLORS.rift);
    expect(fills).toContain(COLORS.ok);
  });
});

describe('eventos de campo: ganchos do engine', () => {
  const GRASS_ROW = parseMap(['..............', '..............', '..............']);
  const make = (extra: Partial<ConstructorParameters<typeof OverworldEngine>[0]> = {}) => {
    const input = fakeInput();
    const tiles: string[] = [];
    const engine = new OverworldEngine({
      map: GRASS_ROW,
      input,
      start: { x: 1.5, y: 1.5, facing: 'E' },
      vehicle: () => 'FOOT_BIKE',
      speedMod: () => 1,
      skin: () => SKIN,
      markers: () => [],
      onTile: (t) => tiles.push(t),
      ...extra,
    });
    return { engine, input, tiles };
  };

  it('onTile dispara uma vez por tile inteiro percorrido', () => {
    const { engine, input, tiles } = make();
    input.axes.MOVE_X = 1;
    run(engine, 1.05); // 3 tiles/s na grama: 3,15 tiles
    expect(tiles).toEqual(['GRASS', 'GRASS', 'GRASS']);
    expect(engine.pendingDistance).toBeCloseTo(3.15, 4);
  });

  it('parado ou bloqueado, não anda nem sorteia', () => {
    let blocked = true;
    const { engine, input, tiles } = make({ blocked: () => blocked });
    input.axes.MOVE_X = 1;
    run(engine, 2);
    expect(engine.position.x).toBe(1.5);
    expect(tiles).toEqual([]);
    expect(engine.isMoving).toBe(false);
    blocked = false;
    run(engine, 1);
    expect(engine.position.x).toBeGreaterThan(3);
  });

  it('com chuva, desenha a camada de partículas; sem chuva, não', () => {
    const strokes = (rain: boolean) => {
      const { engine } = make({ rain: () => rain });
      const s = surface();
      let n = 0;
      vi.spyOn(s.ctx, 'stroke').mockImplementation(() => {
        n++;
      });
      engine.attach(s);
      engine.update(1 / 60);
      engine.render();
      return n;
    };
    expect(strokes(true)).toBeGreaterThan(strokes(false));
  });
});
