import { getAircraft } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { createTerrain } from '@/world/terrain/createTerrain';
import { drawAircraft, drawGroundShadow } from './aircraftSprite';
import { makeCamera } from './projection';
import { paintSky } from './atmosphere';
import {
  bandDistance,
  buildDrawList,
  contourInterval,
  fogDistance,
  fogFactor,
  gridElevation,
  type GroundSample,
  quantizedColor,
  renderTerrain,
  sampleGrid,
  shadeFor,
  sunInRunFrame,
  type TerrainScene,
} from './terrainRenderer';

const palette = createTerrain(C00).palette;

/**
 * Cores dos trechos de quads vizinhos da mesma cor, na ordem da lista: um trecho acaba quando a
 * faixa ou a cor muda (as cenas de teste não descartam quads no meio de uma faixa).
 */
function colorRuns(quads: ReturnType<typeof buildDrawList>): string[] {
  const out: string[] = [];
  let band = -1;
  let color = '';
  for (const q of quads) {
    if (q.type !== 'QUAD') continue;
    if (q.band !== band || q.color !== color) out.push(q.color);
    band = q.band;
    color = q.color;
  }
  return out;
}

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
    // Os quads não levam mais traço de emenda: só as curvas, no máximo 2 traços por faixa.
    expect(strokes).toBeGreaterThan(0);
    expect(strokes).toBeLessThanOrEqual(2 * bands);
    expect(strokes).toBeLessThan(contours);
    // Um `fill` por trecho de mesma cor e cada segmento continua no caminho: 1 moveTo por trecho
    // e 1 por curva.
    const runs = colorRuns(quads).length;
    expect(vi.mocked(ctx.fill).mock.calls.length).toBe(runs);
    expect(vi.mocked(ctx.moveTo).mock.calls.length).toBe(runs + contours);
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
    for (const lighting of ['GOLDEN_HOUR', 'SUN_HIGH', 'OVERCAST'] as const) {
      const sky = {
        width: 1280,
        height: 720,
        horizonY: 252,
        focalPx: 914,
        palette,
        lighting,
        sun: lighting === 'OVERCAST' ? null : { x: 0.2, z: 0.9, up: 0.14 },
        quality: 'HIGH' as const,
      };
      paintSky(ctx, sky, 252, -80, 1440, 720);
    }
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

describe('quads sem contorno (survey-flight §5.18)', () => {
  it('cada trecho de quads vizinhos da mesma cor é um `fill` com a cor dele, sem `stroke`', () => {
    const s = scene({ quality: 'MEDIUM', elevation: () => 0 });
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const styles: unknown[] = [];
    vi.mocked(ctx.fill).mockImplementation(() => styles.push(ctx.fillStyle));
    renderTerrain(ctx, s);
    const quads = buildDrawList(s).filter((c) => c.type === 'QUAD');
    const runs = colorRuns(quads);
    // Bem menos `fill` que quads (no plano, quase uma cor por faixa).
    expect(styles).toHaveLength(runs.length);
    expect(runs.length).toBeLessThan(quads.length / 4);
    // O canvas guarda a cor em hexadecimal; a lista de comandos, em `rgb(r,g,b)`.
    const hex = (rgb: string) =>
      '#' + (rgb.match(/\d+/g) ?? []).map((v) => Number(v).toString(16).padStart(2, '0')).join('');
    expect(styles).toEqual(runs.map(hex));
    // Plano sem relevo: não há curva de nível, então nenhum traço.
    expect(vi.mocked(ctx.stroke)).not.toHaveBeenCalled();
  });
});

describe('grade: elevação e cobertura de uma vez, buffers reaproveitados', () => {
  /** Plano inclinado: a malha bilinear o reproduz exatamente. */
  const plane = (X: number, Z: number) => 0.1 * X + 0.05 * Z + 3;

  it('com `sampleGround`, a grade não chama `elevation` nem `cover`; o resultado é o mesmo', () => {
    const elevation = vi.fn(plane);
    const cover = vi.fn(() => 'GRASS' as const);
    const sampleGround = vi.fn((X: number, Z: number, out: GroundSample) => {
      out.elev = plane(X, Z);
      out.cover = 'GRASS';
    });
    const together = scene({ elevation, cover, sampleGround });
    const apart = scene({ elevation: plane, cover: () => 'GRASS' });
    expect(buildDrawList(together)).toEqual(buildDrawList(apart));
    // 41 faixas × 29 colunas na qualidade BAIXA (40 e 28 mais a borda).
    expect(sampleGround).toHaveBeenCalledTimes(41 * 29);
    expect(elevation).not.toHaveBeenCalled();
    expect(cover).not.toHaveBeenCalled();
  });

  it('objetos, sombras e alvos assentam na malha da grade, sem reavaliar o relevo', () => {
    const elevation = vi.fn(plane);
    const sampleGround = (X: number, Z: number, out: GroundSample) => {
      out.elev = plane(X, Z);
      out.cover = 'GRASS';
    };
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    renderTerrain(
      ctx,
      scene({
        elevation,
        cover: () => 'GRASS',
        sampleGround,
        objects: [
          {
            id: 1,
            kind: 'BUILDING',
            X: 5,
            Z: 120,
            widthM: 10,
            heightM: 6,
            baseM: 0,
            color: [1, 2, 3],
          },
          { id: 2, kind: 'TREE', X: -8, Z: 300, widthM: 6, heightM: 8, baseM: 0, color: [1, 2, 3] },
        ],
        marks: [{ id: 'GCP-01', kind: 'GCP', X: 0, Z: 60 }],
      }),
    );
    expect(elevation).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('`gridElevation` reproduz os vértices e o plano; fora da grade vale a borda', () => {
    const s = scene({ elevation: plane });
    const g = sampleGrid(s);
    // Nos vértices: o valor amostrado, exatamente.
    for (const [i, j] of [
      [0, 0],
      [10, 7],
      [25, 28],
      [40, 14],
    ] as const) {
      const k = i * (g.m + 1) + j;
      expect(gridElevation(g, s.cam, g.x[k] as number, g.z[i] as number)).toBeCloseTo(
        g.elev[k] as number,
        9,
      );
    }
    // Entre vértices: um plano é reproduzido pela interpolação bilinear.
    for (const [X, Z] of [
      [3.3, 42.5],
      [-20, 100],
      [14.2, 333.3],
      [-60, 640],
    ] as const) {
      expect(gridElevation(g, s.cam, X, Z)).toBeCloseTo(plane(X, Z), 6);
    }
    // Muito à direita e muito à esquerda: a elevação da borda da faixa, sem extrapolar.
    const right = gridElevation(g, s.cam, 1e6, 200);
    const left = gridElevation(g, s.cam, -1e6, 200);
    expect(Number.isFinite(right) && Number.isFinite(left)).toBe(true);
    expect(right).toBeGreaterThan(left);
    expect(right).toBeLessThan(plane(1e6, 200));
    // Antes de zNear e depois de zFar: a primeira e a última faixa.
    expect(Number.isFinite(gridElevation(g, s.cam, 0, -50))).toBe(true);
    expect(Number.isFinite(gridElevation(g, s.cam, 0, 1e5))).toBe(true);
  });

  it('o relevo curvo da malha fica perto do verdadeiro (o erro é o da própria grade)', () => {
    const hills = (X: number, Z: number) => 6 * Math.sin(X / 25) + 4 * Math.cos(Z / 60);
    const s = scene({ quality: 'HIGH', elevation: hills });
    const g = sampleGrid(s);
    let worst = 0;
    for (const Z of [40, 90, 150, 220, 400]) {
      for (const X of [-30, -7, 0, 11, 28]) {
        worst = Math.max(worst, Math.abs(gridElevation(g, s.cam, X, Z) - hills(X, Z)));
      }
    }
    expect(worst).toBeLessThan(0.35);
  });

  it('os buffers da grade são os mesmos entre quadros da mesma qualidade', () => {
    const low = sampleGrid(scene({ quality: 'LOW' }));
    expect(sampleGrid(scene({ quality: 'LOW' }))).toBe(low);
    const high = sampleGrid(scene({ quality: 'HIGH' }));
    expect(high).not.toBe(low);
    expect(high.n).toBe(72);
    expect(high.m).toBe(48);
    // A grade reaproveitada traz o conteúdo do quadro novo.
    const moved = sampleGrid(
      scene({ quality: 'HIGH', cam: makeCamera(1280, 720, 50, 40, 'HIGH') }),
    );
    expect(moved).toBe(high);
    // A coluna do meio da primeira faixa está no X da câmera.
    expect(moved.x[24] as number).toBeCloseTo(50, 6);
  });
});
