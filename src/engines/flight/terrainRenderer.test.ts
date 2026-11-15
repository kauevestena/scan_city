import { getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { createTerrain } from '@/world/terrain/createTerrain';
import { drawAircraft, drawGroundShadow } from './aircraftSprite';
import { makeCamera } from './projection';
import { drawSky } from './sky';
import {
  bandDistance,
  buildDrawList,
  contourInterval,
  fogDistance,
  fogFactor,
  quantizedColor,
  renderTerrain,
  shadeFor,
  sunInRunFrame,
  type TerrainScene,
} from './terrainRenderer';

const palette = createTerrain(C00).palette;

/** Cena sintética: plano a 0 m com um morro de 80 m entre Z = 150 e 250 m. */
function scene(over: Partial<TerrainScene> = {}): TerrainScene {
  return {
    cam: makeCamera(1280, 720, 0, 40),
    quality: 'LOW',
    elevation: (_X, Z) => (Z > 150 && Z < 250 ? 80 * Math.sin(((Z - 150) / 100) * Math.PI) : 0),
    cover: () => 'GRASS',
    palette,
    lighting: 'SUN_HIGH',
    sun: sunInRunFrame('SUN_HIGH', { u: 1, v: 0 }, { u: 0, v: 1 }),
    reliefM: 80,
    timeS: 0,
    objects: [],
    marks: [],
    ...over,
  };
}

describe('faixas, sombreamento e névoa', () => {
  it('faixas mais densas perto: Z_0 = zNear e Z_N = zFar', () => {
    const cam = makeCamera(1280, 720, 0, 40, 'HIGH');
    expect(bandDistance(0, 72, cam)).toBe(1);
    expect(bandDistance(72, 72, cam)).toBe(1200);
    expect(bandDistance(36, 72, cam) - bandDistance(35, 72, cam)).toBeGreaterThan(
      bandDistance(2, 72, cam) - bandDistance(1, 72, cam),
    );
  });

  it('névoa por iluminação e curvas por relevo', () => {
    expect([fogDistance('SUN_HIGH'), fogDistance('BLIZZARD'), fogDistance('MAGIC_FOG')]).toEqual([
      900, 350, 220,
    ]);
    expect(fogFactor(0, 900)).toBe(0);
    expect(fogFactor(900, 900)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect([contourInterval(15), contourInterval(100), contourInterval(300)]).toEqual([5, 10, 25]);
  });

  it('sol de SE: encosta voltada a ele mais clara; luz difusa quase uniforme', () => {
    const sun = sunInRunFrame('SUN_HIGH', { u: 1, v: 0 }, { u: 0, v: 1 });
    expect(sun?.up).toBeCloseTo(Math.sin((70 * Math.PI) / 180), 9);
    expect(sunInRunFrame('OVERCAST', { u: 1, v: 0 }, { u: 0, v: 1 })).toBeNull();
    // Voando para leste, o sol (SE) fica à frente e à direita: o chão que sobe para o lado oposto o encara.
    expect(shadeFor(-0.5, -0.5, sun)).toBeGreaterThan(shadeFor(0.5, 0.5, sun));
    expect(shadeFor(0, 0, null)).toBe(1);
    expect(quantizedColor(255, 128.4, 3)).toBe('rgb(252,128,0)');
    expect(quantizedColor(255, 128.4, 3)).toBe(quantizedColor(253, 129, 1));
  });
});

describe('draw list (§5.3, oclusão)', () => {
  it('pinta de longe para perto; o morro na frente encobre o objeto atrás dele', () => {
    const list = buildDrawList(
      scene({
        objects: [
          {
            id: 7,
            kind: 'GCP_TARGET',
            X: 0,
            Z: 400,
            widthM: 1,
            heightM: 0.2,
            baseM: 0,
            color: [255, 255, 255],
          },
        ],
      }),
    );
    const quads = list.filter((c) => c.type === 'QUAD');
    expect(quads.length).toBeGreaterThan(0);
    // Ordem de pintura: Z não cresce ao longo da lista.
    for (let k = 1; k < quads.length; k++) {
      expect((quads[k] as { z: number }).z).toBeLessThanOrEqual((quads[k - 1] as { z: number }).z);
    }
    const objIndex = list.findIndex((c) => c.type === 'OBJECT' && c.id === 7);
    expect(objIndex).toBeGreaterThan(0);
    // Todos os quads do morro (150 < Z < 250) vêm depois do objeto: são pintados por cima.
    const hillQuads = list
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.type === 'QUAD' && c.z > 150 && c.z < 250);
    expect(hillQuads.length).toBeGreaterThan(0);
    for (const { i } of hillQuads) expect(i).toBeGreaterThan(objIndex);
    // E os quads além do objeto vêm antes dele.
    const behind = list.findIndex((c) => c.type === 'QUAD' && c.z > 450);
    expect(behind).toBeLessThan(objIndex);
    // O relevo gera curvas de nível, com mestras a cada 5.
    expect(list.some((c) => c.type === 'CONTOUR' && c.master)).toBe(true);
    expect(list.some((c) => c.type === 'CONTOUR' && !c.master)).toBe(true);
  });

  it('alvos da missão entram na faixa certa; objetos fora do alcance ficam de fora', () => {
    const list = buildDrawList(
      scene({
        marks: [{ id: 'GCP-01', kind: 'GCP', X: 2, Z: 60 }],
        objects: [
          {
            id: 9,
            kind: 'BUILDING',
            X: 0,
            Z: 5000,
            widthM: 10,
            heightM: 10,
            baseM: 0,
            color: [1, 2, 3],
          },
        ],
      }),
    );
    expect(list.some((c) => c.type === 'MARK' && c.id === 'GCP-01')).toBe(true);
    expect(list.some((c) => c.type === 'OBJECT' && c.id === 9)).toBe(false);
  });

  it('a água ondula com o tempo; render desenha sem erro', () => {
    const water = scene({ cover: () => 'WATER', elevation: () => 0 });
    const a = buildDrawList({ ...water, timeS: 0 }).find((c) => c.type === 'QUAD');
    const b = buildDrawList({ ...water, timeS: 1 }).find((c) => c.type === 'QUAD');
    expect(a).not.toEqual(b);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    renderTerrain(
      ctx,
      scene({
        objects: [
          {
            id: 1,
            kind: 'TREE',
            X: 5,
            Z: 80,
            widthM: 6,
            heightM: 8,
            baseM: 0,
            color: [40, 120, 50],
          },
          {
            id: 2,
            kind: 'BUILDING',
            X: -10,
            Z: 120,
            widthM: 10,
            heightM: 6,
            baseM: 0,
            color: [160, 80, 60],
          },
          { id: 3, kind: 'WIRE', X: 0, Z: 90, widthM: 1, heightM: 1, baseM: 10, color: [0, 0, 0] },
        ],
        marks: [
          { id: 'GCP-01', kind: 'GCP', X: 0, Z: 40 },
          { id: 'CP-01', kind: 'CP', X: 3, Z: 40 },
        ],
      }),
    );
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

describe('brilho laranja da lava (LAVA_THERMALS)', () => {
  const lava = scene({ cover: () => 'LAVA', elevation: () => 0, sun: null });
  const colors = (over: Partial<TerrainScene>, timeS: number) =>
    buildDrawList({ ...lava, ...over, timeS })
      .filter((c) => c.type === 'QUAD')
      .map((c) => (c.type === 'QUAD' ? c.color : ''));
  const channels = (rgb: string) => (rgb.match(/\d+/g) ?? []).map(Number);
  const mean = (list: string[], ch: number) =>
    list.reduce((sum, c) => sum + (channels(c)[ch] as number), 0) / list.length;

  it('sem a regra a lava é só a cor do bioma: não pulsa com o tempo', () => {
    expect(colors({}, 0)).toEqual(colors({}, 1.3));
  });

  it('com a regra a lava pulsa de ponto em ponto e fica mais clara que a cor do bioma', () => {
    const plain = colors({}, 0);
    const a = colors({ lavaGlow: true }, 0);
    const b = colors({ lavaGlow: true }, 1);
    expect(a).not.toEqual(b);
    // Mais brilho em vermelho e verde: o laranja clareia e fica mais saturado em amarelo.
    expect(mean(a, 1)).toBeGreaterThan(mean(plain, 1));
    expect(mean(b, 1)).toBeGreaterThan(mean(plain, 1));
    expect(mean(a, 0)).toBeGreaterThanOrEqual(mean(plain, 0));
    // O brilho só mexe na lava: capim com a regra ligada fica igual.
    const grass = scene({ cover: () => 'GRASS', elevation: () => 0, sun: null });
    const g = (over: Partial<TerrainScene>) =>
      buildDrawList({ ...grass, ...over }).filter((c) => c.type === 'QUAD');
    expect(g({ lavaGlow: true })).toEqual(g({}));
  });
});

describe('curvas de nível em lote', () => {
  it('saem num traço só por faixa e estilo, sem perder nenhum segmento', () => {
    const s = scene({ quality: 'MEDIUM' });
    const list = buildDrawList(s);
    const quads = list.filter((c) => c.type === 'QUAD');
    const contours = list.filter((c) => c.type === 'CONTOUR').length;
    // O morro de 80 m, com curvas a cada 10 m, cruza muitos quads.
    expect(contours).toBeGreaterThan(50);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    renderTerrain(ctx, s);
    const strokes = vi.mocked(ctx.stroke).mock.calls.length;
    const bands = new Set(quads.map((c) => c.band)).size;
    // Cada quad ainda leva o seu traço de emenda; as curvas viram, no máximo, 2 por faixa.
    expect(strokes).toBeGreaterThanOrEqual(quads.length);
    expect(strokes).toBeLessThanOrEqual(quads.length + 2 * bands);
    expect(strokes).toBeLessThan(quads.length + contours);
    // Cada segmento continua no caminho: 1 moveTo por quad e 1 por curva.
    expect(vi.mocked(ctx.moveTo).mock.calls.length).toBe(quads.length + contours);
  });

  it('as curvas de uma faixa saem antes dos objetos dela, que as cobrem', () => {
    const tree = {
      id: 1,
      kind: 'TREE' as const,
      X: 0,
      Z: 200,
      widthM: 6,
      heightM: 8,
      baseM: 0,
      color: [40, 120, 50] as [number, number, number],
    };
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const order: string[] = [];
    vi.mocked(ctx.stroke).mockImplementation(() => order.push('stroke'));
    vi.mocked(ctx.ellipse).mockImplementation(() => order.push('ellipse'));
    vi.mocked(ctx.arc).mockImplementation(() => order.push('arc'));
    renderTerrain(ctx, scene({ quality: 'MEDIUM', objects: [tree] }));
    // A copa (arco ou elipse) só é desenhada depois do último traço da sua faixa.
    const crown = order.findIndex((c) => c === 'arc' || c === 'ellipse');
    expect(crown).toBeGreaterThan(0);
    expect(order[crown - 1]).toBe('stroke');
  });
});

describe('céu e sprites', () => {
  it('desenham sem erro para cada aeronave e iluminação', () => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    drawSky(ctx, 1280, 720, 252, palette, 'GOLDEN_HOUR');
    drawSky(ctx, 1280, 720, 252, palette, 'SUN_HIGH');
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    for (const id of ['ATLAS', 'DRONE_T1', 'VTOL_T3'] as const) {
      drawAircraft(ctx, {
        kind: getAircraft(id).kind,
        x: 640,
        y: 600,
        scale: 30,
        timeS: 1,
        speedMs: 10,
        bankRad: 0.2,
        colors: { primary: '#64748b', secondary: '#0f172a' },
        accessory: { primary: '#22d3ee', secondary: '#0f172a' },
      });
    }
    drawGroundShadow(ctx, 640, 700, 30, 60);
    expect(ctx.ellipse).toHaveBeenCalled();
  });
});
