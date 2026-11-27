/**
 * Terreno em faixas (survey-flight §5.3): grade de N × M amostras à frente da aeronave,
 * pintada de longe para perto, com hillshade do sol, curvas de nível, névoa e os objetos
 * intercalados por faixa (oclusão natural). `buildDrawList` registra a mesma sequência que
 * `renderTerrain` desenha, para testar a ordem sem pixels.
 */
import { shadowLengthM } from '@/domain/flightPhysics';
import { LIGHTING } from '@/domain/photogrammetry';
import { FLIGHT_STAGE, PERF } from '@/engines/perf';
import type { LandCover, LightingId, Rgb, WorldObjectKind } from '@/types';
import { drawSceneObject, type SceneObject } from './objectRenderer';
import type { BiomePalette } from '@/world/terrain/TerrainSampler';
import {
  CAMERA_OFFSET_M,
  halfWidthAt,
  projectAbs,
  QUALITY,
  type FlightCamera,
  type Quality,
} from './projection';
import { QuadStrip } from './terrainStrip';
import { COVER_HEAT, thermalColor } from './thermal';

/** Sol do voo: azimute 135° (§5.3); a elevação vem da iluminação. */
export const SUN_AZIMUTH_DEG = 135;

export function fogDistance(lighting: LightingId): number {
  if (lighting === 'BLIZZARD') return 350;
  if (lighting === 'MAGIC_FOG') return 220;
  return 900;
}

export function fogFactor(Z: number, zFog: number): number {
  return 1 - Math.exp(-Math.max(0, Z) / zFog);
}

/** Intervalo das curvas de nível pela amplitude do relevo. */
export function contourInterval(reliefM: number): number {
  if (reliefM < 50) return 5;
  if (reliefM < 150) return 10;
  return 25;
}

/** Distância da faixa i: mais densa perto, `Z_i = zNear + (zFar − zNear)·(i/N)^2,2`. */
export function bandDistance(
  i: number,
  n: number,
  cam: Pick<FlightCamera, 'zNear' | 'zFar'>,
): number {
  return cam.zNear + (cam.zFar - cam.zNear) * (i / n) ** 2.2;
}

/**
 * Uma estrada no frame do *run* (X à direita, Z à frente da aeronave), desenhada como uma faixa
 * contínua sobre o relevo (ADR-035): a grade não pinta a estrada, então ela não vira escada de
 * quadrados nem pontos soltos onde a grade só às vezes a pega.
 */
export interface GroundRoad {
  points: ReadonlyArray<{ X: number; Z: number }>;
  halfWidthM: number;
}

export interface GroundMark {
  id: string;
  kind: 'GCP' | 'CP';
  X: number;
  Z: number;
}

export type { SceneObject };

/** Resultado de `TerrainScene.sampleGround`, reaproveitado entre as amostras. */
export interface GroundSample {
  elev: number;
  cover: LandCover;
}

export interface TerrainScene {
  cam: FlightCamera;
  quality: Quality;
  /** Elevação e cobertura nas coordenadas do *run* (Z = 0 na aeronave). */
  elevation: (X: number, Z: number) => number;
  cover: (X: number, Z: number) => LandCover;
  /**
   * Elevação e cobertura de uma vez só: uma busca do ponto no mapa e uma avaliação do relevo por
   * amostra da grade (a cobertura reaproveita a elevação). Sem ela, a grade chama `elevation` e
   * `cover` separados.
   */
  sampleGround?: (X: number, Z: number, out: GroundSample) => void;
  palette: BiomePalette;
  lighting: LightingId;
  /** Vetor do sol no frame do *run* (X à direita, Z à frente). */
  sun: { x: number; z: number; up: number } | null;
  reliefM: number;
  /** Regra `SPECULAR_WATER`: brilho na água sob `SUN_HIGH`. */
  specularWater?: boolean;
  /** Regra `LAVA_THERMALS`: a lava pulsa num brilho laranja. */
  lavaGlow?: boolean;
  /**
   * Câmera termal: o terreno vira uma rampa de calor (cobertura mais o calor extra de `heatAt`,
   * em coordenadas do *run*), no lugar das cores do bioma.
   */
  thermal?: { heatAt: (X: number, Z: number) => number };
  timeS: number;
  objects: readonly SceneObject[];
  marks: readonly GroundMark[];
  /**
   * Estradas desenhadas como faixas, faixa do terreno a faixa (por cima do chão dela, antes dos
   * objetos). Com elas, `sampleGround`/`cover` devem dar a cobertura sob a estrada.
   */
  roads?: readonly GroundRoad[];
  /**
   * Folga (px) além das bordas de cima e de baixo em que os quads ainda são desenhados: a câmera
   * inclinada mostra um pouco além delas. Padrão: 0.
   */
  cullMarginPx?: number;
}

export type DrawCommand =
  | { type: 'QUAD'; band: number; z: number; color: string }
  | { type: 'PATCH'; band: number; z: number; color: string; corners: number }
  | { type: 'ROAD'; band: number; z: number; color: string }
  | { type: 'GLINT'; band: number; z: number }
  | { type: 'SHADOW'; band: number; id: number; lengthM: number }
  | { type: 'CONTOUR'; band: number; master: boolean }
  | { type: 'OBJECT'; band: number; z: number; id: number; kind: WorldObjectKind }
  | { type: 'MARK'; band: number; z: number; id: string };

/** Vetor do sol no frame do *run*, a partir do rumo da linha. Luz difusa: `null`. */
export function sunInRunFrame(
  lighting: LightingId,
  dir: { u: number; v: number },
  right: { u: number; v: number },
): TerrainScene['sun'] {
  const elevationDeg = LIGHTING[lighting].sunElevationDeg;
  if (elevationDeg === null) return null;
  const az = (SUN_AZIMUTH_DEG * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  // Frame da AOI: leste = +u, sul = +v.
  const lu = Math.sin(az) * Math.cos(el);
  const lv = -Math.cos(az) * Math.cos(el);
  return { x: lu * right.u + lv * right.v, z: lu * dir.u + lv * dir.v, up: Math.sin(el) };
}

/** Sombreamento: sol (ambiente 0,45 + difusa 0,65) ou luz difusa (0,75 + 0,25). */
export function shadeFor(dzdx: number, dzdz: number, sun: TerrainScene['sun']): number {
  const len = Math.hypot(dzdx, dzdz, 1);
  if (!sun) return 0.75 + 0.25 * (1 / len);
  const dot = (-dzdx * sun.x - dzdz * sun.z + sun.up) / len;
  return 0.45 + 0.65 * Math.max(0, dot);
}

// Cache de strings de cor quantizadas (64 níveis por canal, §5.18).
const colorCache = new Map<number, string>();
export function quantizedColor(r: number, g: number, b: number): string {
  const q = (c: number) => Math.max(0, Math.min(255, Math.round(c))) & 0xfc;
  const key = (q(r) << 16) | (q(g) << 8) | q(b);
  let s = colorCache.get(key);
  if (!s) {
    s = `rgb(${q(r)},${q(g)},${q(b)})`;
    colorCache.set(key, s);
  }
  return s;
}

/** As coberturas dos 4 cantos do quad em curso e o contorno de um pedaço (até 4 pontos). */
const QUAD_COVERS: [LandCover, LandCover, LandCover, LandCover] = [
  'GRASS',
  'GRASS',
  'GRASS',
  'GRASS',
];
const PATCH = new Float64Array(8);
const ROAD_PTS = new Float64Array(8);
const RGB = new Float64Array(3);
/**
 * Altura na tela (px) a partir da qual um quad de cantos mistos ganha pedaços; abaixo dela (as
 * faixas finas perto do horizonte), a média das cores.
 */
export const PATCH_MIN_PX = 6;

/** Ordem dos cantos ao redor do quad e limite de curvas por quad (relevo muito íngreme). */
const QUAD_ORDER = [0, 1, 2, 3] as const;
const MAX_CONTOURS_PER_QUAD = 6;

/** Destino dos comandos: o canvas (render) ou uma lista (testes). */
/** Elevação do chão em (X, Z) tirada da malha da grade (a mesma superfície dos quads). */
type GroundFn = (X: number, Z: number) => number;

interface Sink {
  quad(band: number, z: number, pts: Float64Array, color: string): void;
  /**
   * Um pedaço de outra cobertura dentro do quad (os cantos dela, cortados nos meios das
   * arestas): `n` pontos (x, y) em `pts`.
   */
  patch(band: number, z: number, pts: Float64Array, n: number, color: string): void;
  /** Um pedaço de estrada na faixa: 4 pontos (x, y) em `pts`. */
  road(band: number, z: number, pts: Float64Array, color: string): void;
  contour(band: number, x1: number, y1: number, x2: number, y2: number, master: boolean): void;
  object(band: number, o: SceneObject, scene: TerrainScene, ground: GroundFn): void;
  shadow(
    band: number,
    o: SceneObject,
    scene: TerrainScene,
    lengthM: number,
    ground: GroundFn,
  ): void;
  glint(band: number, z: number, pts: Float64Array, timeS: number): void;
  mark(band: number, m: GroundMark, scene: TerrainScene, ground: GroundFn): void;
}

export interface Grid {
  n: number;
  m: number;
  z: Float64Array;
  x: Float64Array;
  elev: Float64Array;
  sx: Float64Array;
  sy: Float64Array;
  cover: LandCover[];
}

/** A grade é a mesma a cada quadro (só muda o conteúdo): um jogo de buffers por qualidade. */
let gridCache: Grid | null = null;

function gridFor(n: number, m: number): Grid {
  const cached = gridCache;
  if (cached && cached.n === n && cached.m === m) return cached;
  const size = (n + 1) * (m + 1);
  const g: Grid = {
    n,
    m,
    z: new Float64Array(n + 1),
    x: new Float64Array(size),
    elev: new Float64Array(size),
    sx: new Float64Array(size),
    sy: new Float64Array(size),
    cover: new Array<LandCover>(size).fill('GRASS'),
  };
  gridCache = g;
  return g;
}

export function sampleGrid(scene: TerrainScene): Grid {
  const { cam } = scene;
  const { bands: n, cols: m } = QUALITY[scene.quality];
  const g = gridFor(n, m);
  const out: GroundSample = { elev: 0, cover: 'GRASS' };
  for (let i = 0; i <= n; i++) {
    const Z = bandDistance(i, n, cam);
    g.z[i] = Z;
    const half = halfWidthAt(Z, cam);
    const scale = cam.focalPx / (Z + CAMERA_OFFSET_M);
    for (let j = 0; j <= m; j++) {
      const k = i * (m + 1) + j;
      const X = cam.camX - half + (2 * half * j) / m;
      if (scene.sampleGround) {
        scene.sampleGround(X, Z, out);
      } else {
        out.elev = scene.elevation(X, Z);
        out.cover = scene.cover(X, Z);
      }
      g.x[k] = X;
      g.elev[k] = out.elev;
      g.cover[k] = out.cover;
      g.sx[k] = cam.horizonX + (X - cam.camX) * scale;
      g.sy[k] = cam.horizonY + (cam.camAlt - out.elev) * scale;
    }
  }
  return g;
}

/** Elevação da grade ao longo da fileira `r` (interpolada em X). */
function rowElevation(g: Grid, r: number, X: number): number {
  const base = r * (g.m + 1);
  const x0 = g.x[base] as number;
  const span = (g.x[base + g.m] as number) - x0;
  let u = span > 0 ? ((X - x0) / span) * g.m : 0;
  if (u < 0) u = 0;
  else if (u > g.m) u = g.m;
  const j = Math.min(Math.floor(u), g.m - 1);
  const a = g.elev[base + j] as number;
  return a + ((g.elev[base + j + 1] as number) - a) * (u - j);
}

/**
 * Elevação do ponto (X, Z) pela **malha da grade** (interpolação bilinear das elevações já
 * amostradas no quadro), em vez de reavaliar o relevo por objeto, sombra ou alvo (survey-flight
 * §5.18). É a superfície que os quads desenham, então a base dos objetos assenta nela sem folga.
 * Fora do alcance da grade vale a borda.
 */
export function gridElevation(
  g: Grid,
  cam: Pick<FlightCamera, 'zNear' | 'zFar'>,
  X: number,
  Z: number,
): number {
  const n = g.n;
  // Inverso de `bandDistance`, ajustado pelos vizinhos (arredondamento).
  let i = Math.floor(n * ((Z - cam.zNear) / (cam.zFar - cam.zNear)) ** (1 / 2.2));
  if (!(i > 0)) i = 0;
  else if (i > n - 1) i = n - 1;
  while (i > 0 && Z < (g.z[i] as number)) i--;
  while (i < n - 1 && Z >= (g.z[i + 1] as number)) i++;
  const z0 = g.z[i] as number;
  const t = Math.min(1, Math.max(0, (Z - z0) / ((g.z[i + 1] as number) - z0)));
  const near = rowElevation(g, i, X);
  return near + (rowElevation(g, i + 1, X) - near) * t;
}

/** Índices dos cantos do quad em volta (00, 01, 11, 10), na ordem de `pts`. */
const CYCLE = [0, 1, 2, 3] as const;

/**
 * A cobertura que pinta o quad inteiro: a da maioria dos cantos (no empate, a do primeiro canto
 * empatado na ordem 00, 01, 11, 10). Os outros cantos viram pedaços por cima.
 */
export function majorityCover(covers: readonly LandCover[]): LandCover {
  let best = covers[0] as LandCover;
  let bestN = 0;
  for (const c of covers) {
    let n = 0;
    for (const o of covers) if (o === c) n++;
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

/**
 * Os pedaços de cobertura de um quad de cantos mistos (survey-flight §5.3, ADR-035): cada canto
 * que não é da cobertura de base vira um triângulo cortado nos meios das duas arestas dele; dois
 * cantos vizinhos da mesma cobertura viram meio quad. Assim a divisa passa pelo meio das
 * arestas, em diagonal, no lugar da escada de quadrados de uma cor só. Devolve, para cada pedaço,
 * a cobertura e os cantos (índices 0–3, na ordem em volta) que ele leva.
 */
export function coverPatches(
  covers: readonly [LandCover, LandCover, LandCover, LandCover],
  base: LandCover,
): Array<{ cover: LandCover; corners: number[] }> {
  const out: Array<{ cover: LandCover; corners: number[] }> = [];
  const used = [false, false, false, false];
  for (const c of CYCLE) {
    if (used[c] || covers[c] === base) continue;
    used[c] = true;
    const next = (c + 1) % 4;
    const prev = (c + 3) % 4;
    if (!used[next] && covers[next] === covers[c]) {
      used[next] = true;
      out.push({ cover: covers[c], corners: [c, next] });
    } else if (!used[prev] && covers[prev] === covers[c]) {
      used[prev] = true;
      out.push({ cover: covers[c], corners: [prev, c] });
    } else {
      out.push({ cover: covers[c], corners: [c] });
    }
  }
  return out;
}

/**
 * Contorno de um pedaço em `out` (x, y): o meio da aresta antes do primeiro canto, os cantos e o
 * meio da aresta depois do último. Devolve o número de pontos.
 */
export function patchOutline(
  pts: Float64Array,
  corners: readonly number[],
  out: Float64Array,
): number {
  const first = corners[0] as number;
  const last = corners[corners.length - 1] as number;
  const before = (first + 3) % 4;
  const after = (last + 1) % 4;
  let n = 0;
  const mid = (a: number, b: number) => {
    out[n * 2] = ((pts[a * 2] as number) + (pts[b * 2] as number)) / 2;
    out[n * 2 + 1] = ((pts[a * 2 + 1] as number) + (pts[b * 2 + 1] as number)) / 2;
    n++;
  };
  mid(before, first);
  for (const c of corners) {
    out[n * 2] = pts[c * 2] as number;
    out[n * 2 + 1] = pts[c * 2 + 1] as number;
    n++;
  }
  mid(last, after);
  return n;
}

/**
 * O pedaço de um trecho de estrada `a`→`b` dentro de `[z0, z1]` (frame do *run*): os quatro
 * cantos no chão (X, Z), com a meia largura para cada lado, na ordem em volta. `null` se o
 * trecho não passa pela faixa.
 */
export function roadPiece(
  a: { X: number; Z: number },
  b: { X: number; Z: number },
  halfWidthM: number,
  z0: number,
  z1: number,
): Array<{ X: number; Z: number }> | null {
  const dx = b.X - a.X;
  const dz = b.Z - a.Z;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dz) < 1e-9) {
    if (a.Z < z0 || a.Z >= z1) return null;
  } else {
    const ta = (z0 - a.Z) / dz;
    const tb = (z1 - a.Z) / dz;
    t0 = Math.max(0, Math.min(ta, tb));
    t1 = Math.min(1, Math.max(ta, tb));
    if (!(t1 > t0)) return null;
  }
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * halfWidthM;
  const pz = (dx / len) * halfWidthM;
  const x0 = a.X + dx * t0;
  const zz0 = a.Z + dz * t0;
  const x1 = a.X + dx * t1;
  const zz1 = a.Z + dz * t1;
  return [
    { X: x0 + px, Z: zz0 + pz },
    { X: x1 + px, Z: zz1 + pz },
    { X: x1 - px, Z: zz1 - pz },
    { X: x0 - px, Z: zz0 - pz },
  ];
}

/** Quanto o pedaço de estrada de uma faixa avança sobre a de trás (fração da profundidade). */
const ROAD_SEAM = 0.25;

function traverse(scene: TerrainScene, sink: Sink): void {
  PERF.flight.enter(FLIGHT_STAGE.GRID);
  const g = sampleGrid(scene);
  PERF.flight.enter(FLIGHT_STAGE.OBJECTS);
  const { n, m } = g;
  const ground: GroundFn = (X, Z) => gridElevation(g, scene.cam, X, Z);
  const cull = scene.cullMarginPx ?? 0;
  const top = -cull;
  const H = scene.cam.height + cull;
  const zFog = fogDistance(scene.lighting);
  const interval = contourInterval(scene.reliefM);
  const pts = new Float64Array(8);
  const fogColor = scene.palette.fog;
  /**
   * Cor final de uma cobertura no quad: a base com o sombreamento do relevo (a água ondula e a
   * lava pulsa; na termal, a rampa de calor) e a névoa da distância, sem alocar por quad.
   */
  const rgbOf = (
    cover: LandCover,
    relief: number,
    fog: number,
    Zi: number,
    Zn: number,
    x00: number,
    xMid: number,
    out: Float64Array,
  ): void => {
    let base: Rgb = scene.palette.cover[cover];
    let shade = relief;
    if (cover === 'WATER') {
      base = scene.palette.water;
      shade = 1 + 0.06 * Math.sin(scene.timeS * 2 + Zi * 0.1 + x00 * 0.05);
    }
    if (cover === 'LAVA' && scene.lavaGlow) {
      // Brilho laranja: mais claro que o resto e pulsando devagar, de ponto em ponto.
      shade = 1.18 + 0.14 * Math.sin(scene.timeS * 2.4 + Zi * 0.08 + x00 * 0.06);
    }
    if (scene.thermal) {
      // Termal: o calor da cobertura, a mancha quente do ponto e um toque do relevo.
      const heat =
        COVER_HEAT[cover] + scene.thermal.heatAt(xMid, (Zi + Zn) / 2) + 0.18 * (relief - 1);
      base = thermalColor(heat);
      shade = 1;
    }
    const lr = base[0] * shade;
    const lg = base[1] * shade;
    const lb = base[2] * shade;
    out[0] = lr + (fogColor[0] - lr) * fog;
    out[1] = lg + (fogColor[1] - lg) * fog;
    out[2] = lb + (fogColor[2] - lb) * fog;
  };
  const colorOf = (
    cover: LandCover,
    relief: number,
    fog: number,
    Zi: number,
    Zn: number,
    x00: number,
    xMid: number,
  ): string => {
    rgbOf(cover, relief, fog, Zi, Zn, x00, xMid, RGB);
    return quantizedColor(RGB[0] as number, RGB[1] as number, RGB[2] as number);
  };
  /** A média das cores dos quatro cantos: o quad fino de longe vira um tom, não um ponto. */
  const blendOf = (
    relief: number,
    fog: number,
    Zi: number,
    Zn: number,
    x00: number,
    xMid: number,
  ): string => {
    let r = 0;
    let gg = 0;
    let b = 0;
    for (const c of QUAD_COVERS) {
      rgbOf(c, relief, fog, Zi, Zn, x00, xMid, RGB);
      r += RGB[0] as number;
      gg += RGB[1] as number;
      b += RGB[2] as number;
    }
    return quantizedColor(r / 4, gg / 4, b / 4);
  };
  // Cantos do quad em volta: (x, y, elev) × 4, na ordem 00, 01, 11, 10.
  const corner = new Float64Array(12);
  const at = (i: number, j: number) => i * (m + 1) + j;

  // Objetos e alvos por faixa, de longe para perto.
  const byBand: Array<Array<{ z: number; draw: (band: number) => void }>> = Array.from(
    { length: n },
    () => [],
  );
  const bandOf = (Z: number) => {
    if (Z < (g.z[0] as number) || Z >= (g.z[n] as number)) return -1;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((g.z[mid] as number) <= Z) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  for (const o of scene.objects) {
    const b = bandOf(o.Z);
    if (b >= 0) {
      byBand[b]?.push({
        z: o.Z,
        draw: (band) => {
          // Sombras só com sol (SUN_HIGH e GOLDEN_HOUR), no chão, antes do objeto.
          const len = castsShadow(o.kind) ? shadowLengthM(o.heightM + o.baseM, scene.lighting) : 0;
          if (len > 0 && scene.sun) sink.shadow(band, o, scene, len, ground);
          sink.object(band, o, scene, ground);
        },
      });
    }
  }
  for (const mk of scene.marks) {
    const b = bandOf(mk.Z);
    if (b >= 0) byBand[b]?.push({ z: mk.Z, draw: (band) => sink.mark(band, mk, scene, ground) });
  }

  PERF.flight.enter(FLIGHT_STAGE.TERRAIN);
  for (let i = n - 1; i >= 0; i--) {
    const Zi = g.z[i] as number;
    const Zn = g.z[i + 1] as number;
    const fog = fogFactor((Zi + Zn) / 2, zFog);
    for (let j = 0; j < m; j++) {
      const k00 = at(i, j);
      const k01 = at(i, j + 1);
      const k10 = at(i + 1, j);
      const k11 = at(i + 1, j + 1);
      const y00 = g.sy[k00] as number;
      const y01 = g.sy[k01] as number;
      const y10 = g.sy[k10] as number;
      const y11 = g.sy[k11] as number;
      if (
        (y00 < top && y01 < top && y10 < top && y11 < top) ||
        (y00 > H && y01 > H && y10 > H && y11 > H)
      ) {
        continue;
      }
      const e00 = g.elev[k00] as number;
      const e01 = g.elev[k01] as number;
      const e10 = g.elev[k10] as number;
      const e11 = g.elev[k11] as number;
      const dx = (g.x[k01] as number) - (g.x[k00] as number);
      const dzdx = (e01 - e00 + e11 - e10) / (2 * Math.max(dx, 1e-6));
      const dzdz = (e10 - e00 + e11 - e01) / (2 * Math.max(Zn - Zi, 1e-6));
      const c00 = g.cover[k00] as LandCover;
      const c01 = g.cover[k01] as LandCover;
      const c11 = g.cover[k11] as LandCover;
      const c10 = g.cover[k10] as LandCover;
      const mixed = c00 !== c01 || c00 !== c11 || c00 !== c10;
      QUAD_COVERS[0] = c00;
      QUAD_COVERS[1] = c01;
      QUAD_COVERS[2] = c11;
      QUAD_COVERS[3] = c10;
      const cover = mixed ? majorityCover(QUAD_COVERS) : c00;
      const shade = shadeFor(dzdx, dzdz, scene.sun);
      const x00 = g.x[k00] as number;
      const xMid = (x00 + (g.x[k01] as number)) / 2;
      pts[0] = g.sx[k00] as number;
      pts[1] = y00;
      pts[2] = g.sx[k01] as number;
      pts[3] = y01;
      pts[4] = g.sx[k11] as number;
      pts[5] = y11;
      pts[6] = g.sx[k10] as number;
      pts[7] = y10;
      // Cantos de outra cobertura (survey-flight §5.3): no quad alto na tela, pedaços cortados
      // nos meios das arestas, por cima da base (a divisa em diagonal, sem escada); no quad fino
      // de longe, a média das cores (um tom, não um ponto solto).
      const patched = mixed && (y00 + y01 - y10 - y11) / 2 >= PATCH_MIN_PX;
      const color =
        mixed && !patched
          ? blendOf(shade, fog, Zi, Zn, x00, xMid)
          : colorOf(cover, shade, fog, Zi, Zn, x00, xMid);
      sink.quad(i, Zi, pts, color);
      if (cover === 'WATER' && scene.specularWater && scene.lighting === 'SUN_HIGH') {
        sink.glint(i, Zi, pts, scene.timeS);
      }
      if (patched) {
        for (const p of coverPatches(QUAD_COVERS, cover)) {
          const n = patchOutline(pts, p.corners, PATCH);
          sink.patch(i, Zi, PATCH, n, colorOf(p.cover, shade, fog, Zi, Zn, x00, xMid));
        }
      }
      corner[0] = pts[0] as number;
      corner[1] = y00;
      corner[2] = e00;
      corner[3] = pts[2] as number;
      corner[4] = y01;
      corner[5] = e01;
      corner[6] = pts[4] as number;
      corner[7] = y11;
      corner[8] = e11;
      corner[9] = pts[6] as number;
      corner[10] = y10;
      corner[11] = e10;

      // Curvas de nível: cada nível cruzado pelas arestas do quad (marching squares simplificado).
      const lo = Math.min(e00, e01, e10, e11);
      const hi = Math.max(e00, e01, e10, e11);
      const first = Math.floor(lo / interval) + 1;
      const last = Math.min(Math.floor(hi / interval), first + MAX_CONTOURS_PER_QUAD - 1);
      for (let lv = first; lv <= last; lv++) {
        const level = lv * interval;
        if (level <= lo || level > hi) continue;
        let n0 = -1;
        let x1 = 0;
        let y1 = 0;
        for (let c = 0; c < 4; c++) {
          const ka = QUAD_ORDER[c] as number;
          const kb = QUAD_ORDER[(c + 1) % 4] as number;
          const ea = corner[ka * 3 + 2] as number;
          const eb = corner[kb * 3 + 2] as number;
          if (ea < level === eb < level) continue;
          const t = (level - ea) / (eb - ea);
          const cx =
            (corner[ka * 3] as number) +
            ((corner[kb * 3] as number) - (corner[ka * 3] as number)) * t;
          const cy =
            (corner[ka * 3 + 1] as number) +
            ((corner[kb * 3 + 1] as number) - (corner[ka * 3 + 1] as number)) * t;
          if (n0 < 0) {
            n0 = c;
            x1 = cx;
            y1 = cy;
          } else {
            sink.contour(i, x1, y1, cx, cy, lv % 5 === 0);
            break;
          }
        }
      }
    }
    // Estradas: os pedaços que passam pela faixa, por cima do chão dela e antes dos objetos. O
    // pedaço avança um pouco sobre a faixa de trás (já pintada), para a emenda não aparecer.
    if (scene.roads) {
      const z1 = Zn + ROAD_SEAM * (Zn - Zi);
      for (const road of scene.roads) {
        for (let k = 1; k < road.points.length; k++) {
          const a = road.points[k - 1] as { X: number; Z: number };
          const b = road.points[k] as { X: number; Z: number };
          if (
            Math.max(a.Z, b.Z) + road.halfWidthM < Zi ||
            Math.min(a.Z, b.Z) - road.halfWidthM > z1
          ) {
            continue;
          }
          const piece = roadPiece(a, b, road.halfWidthM, Zi, z1);
          if (!piece) continue;
          let ok = true;
          let cx = 0;
          let cz = 0;
          for (let q = 0; q < 4; q++) {
            const c = piece[q] as { X: number; Z: number };
            const p = projectAbs(c.X, ground(c.X, c.Z), c.Z, scene.cam);
            if (!p) {
              ok = false;
              break;
            }
            ROAD_PTS[q * 2] = p.x;
            ROAD_PTS[q * 2 + 1] = p.y;
            cx += c.X / 4;
            cz += c.Z / 4;
          }
          if (!ok) continue;
          // Fora da tela de lado: nada a desenhar.
          const xs = [ROAD_PTS[0], ROAD_PTS[2], ROAD_PTS[4], ROAD_PTS[6]] as number[];
          if (Math.max(...xs) < -cull || Math.min(...xs) > scene.cam.width + cull) continue;
          const e = ground(cx, cz);
          const sx = (ground(cx + 1, cz) - ground(cx - 1, cz)) / 2;
          const sz = (ground(cx, cz + 1) - e) / 1;
          const roadFog = fogFactor(cz, zFog);
          sink.road(
            i,
            Zi,
            ROAD_PTS,
            colorOf('ROAD', shadeFor(sx, sz, scene.sun), roadFog, cz, cz, cx, cx),
          );
        }
      }
    }
    const items = byBand[i];
    if (items && items.length > 0) {
      PERF.flight.enter(FLIGHT_STAGE.OBJECTS);
      items.sort((a, b) => b.z - a.z);
      for (const it of items) it.draw(i);
      PERF.flight.enter(FLIGHT_STAGE.TERRAIN);
    }
  }
}

/** Sequência de comandos do terreno, na ordem de pintura (para testes). */
export function buildDrawList(scene: TerrainScene): DrawCommand[] {
  const list: DrawCommand[] = [];
  traverse(scene, {
    quad: (band, z, _pts, color) => list.push({ type: 'QUAD', band, z, color }),
    patch: (band, z, _pts, n, color) =>
      list.push({ type: 'PATCH', band, z, color, corners: n - 2 }),
    road: (band, z, _pts, color) => list.push({ type: 'ROAD', band, z, color }),
    contour: (band, _x1, _y1, _x2, _y2, master) => list.push({ type: 'CONTOUR', band, master }),
    object: (band, o) => list.push({ type: 'OBJECT', band, z: o.Z, id: o.id, kind: o.kind }),
    shadow: (band, o, _s, lengthM) => list.push({ type: 'SHADOW', band, id: o.id, lengthM }),
    glint: (band, z) => list.push({ type: 'GLINT', band, z }),
    mark: (band, mk) => list.push({ type: 'MARK', band, z: mk.Z, id: mk.id }),
  });
  return list;
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  mk: GroundMark,
  scene: TerrainScene,
  ground: GroundFn,
): void {
  const c = projectAbs(mk.X, ground(mk.X, mk.Z), mk.Z, scene.cam);
  if (!c || c.scale <= 0.5) return;
  const s = Math.max(2, c.scale);
  ctx.fillStyle = '#ffffff';
  if (mk.kind === 'GCP') {
    ctx.fillRect(c.x - s / 2, c.y - s / 4, s, s / 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(c.x - s / 2, c.y - s / 4, s / 2, s / 4);
    ctx.fillRect(c.x, c.y, s / 2, s / 4);
  } else {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - s / 4);
    ctx.lineTo(c.x + s / 2, c.y + s / 4);
    ctx.lineTo(c.x - s / 2, c.y + s / 4);
    ctx.closePath();
    ctx.fill();
  }
}

const NO_SHADOW: ReadonlySet<WorldObjectKind> = new Set([
  'WIRE',
  'RING',
  'SEARCHLIGHT',
  'GCP_TARGET',
  'ENERGY_BEAM',
  'POLE',
]);
export const castsShadow = (kind: WorldObjectKind) => !NO_SHADOW.has(kind);

/** Sombra projetada no chão, afastada do sol (alfa 0,3). */
function drawShadow(
  ctx: CanvasRenderingContext2D,
  o: SceneObject,
  s: TerrainScene,
  lengthM: number,
  ground: GroundFn,
): void {
  const sun = s.sun;
  if (!sun) return;
  const h = Math.hypot(sun.x, sun.z) || 1;
  const dx = (-sun.x / h) * lengthM;
  const dz = (-sun.z / h) * lengthM;
  const g = (X: number, Z: number) => projectAbs(X, ground(X, Z), Z, s.cam);
  const half = o.widthM / 2;
  const a = g(o.X - half, o.Z);
  const b = g(o.X + half, o.Z);
  const c = g(o.X + half + dx, o.Z + dz);
  const d = g(o.X - half + dx, o.Z + dz);
  if (!a || !b || !c || !d) return;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** Brilho especular na água: elipse branca aditiva que cintila. */
function drawGlint(ctx: CanvasRenderingContext2D, p: Float64Array, timeS: number): void {
  const cx = ((p[0] as number) + (p[2] as number) + (p[4] as number) + (p[6] as number)) / 4;
  const cy = ((p[1] as number) + (p[3] as number) + (p[5] as number) + (p[7] as number)) / 4;
  const w = Math.abs((p[2] as number) - (p[0] as number));
  const a = 0.18 + 0.14 * Math.sin(timeS * 3 + cx * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, w * 0.45), Math.max(0.5, w * 0.08), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Estilo das curvas de nível comuns e das mestras (a cada 5 níveis). */
const CONTOUR_MINOR = 'rgba(15, 23, 42, 0.25)';
const CONTOUR_MASTER = 'rgba(15, 23, 42, 0.45)';

/** Um só traço para todos os segmentos (x1, y1, x2, y2) acumulados; esvazia a lista. */
function strokeSegments(ctx: CanvasRenderingContext2D, segs: number[], style: string): void {
  if (segs.length === 0) return;
  ctx.strokeStyle = style;
  ctx.beginPath();
  for (let k = 0; k < segs.length; k += 4) {
    ctx.moveTo(segs[k] as number, segs[k + 1] as number);
    ctx.lineTo(segs[k + 2] as number, segs[k + 3] as number);
  }
  ctx.stroke();
  segs.length = 0;
}

/**
 * Quanto cada quad avança sobre o vizinho que vem depois (embaixo e à direita), em px. A grade é
 * pintada de longe para perto e, em cada faixa, da esquerda para a direita, então o vizinho cobre
 * esse avanço por cima: a emenda de antisserrilhado entre os dois some sem precisar de contorno.
 */
/**
 * Avanço da borda de perto (a de baixo, coberta pela faixa mais perto) e da ponta da direita (a
 * do trecho seguinte) de cada trecho de quads, em px: esconde a emenda sem `stroke`.
 */
export const QUAD_OVERLAP_PX = 1;
/** O maior número de colunas de uma faixa (Alta tem 48). */
const MAX_COLS = 128;
/** Trecho de quads da mesma cor em curso, reaproveitado entre os quadros. */
const STRIP = new QuadStrip(MAX_COLS, QUAD_OVERLAP_PX);
/** Cantos dos quads de água com brilho, da faixa em curso. */
const GLINTS = new Float64Array(MAX_COLS * 8);
/**
 * Pedaços de cobertura da faixa em curso (até 2 por quad, 4 pontos cada): desenhados depois do
 * último trecho, por cima dos quads de base (cada um fica dentro do próprio quad).
 */
const MAX_PATCHES = MAX_COLS * 4;
const PATCH_PTS = new Float64Array(MAX_PATCHES * 8);
const PATCH_N = new Uint8Array(MAX_PATCHES);
const PATCH_COLOR: string[] = new Array<string>(MAX_PATCHES).fill('');

/**
 * Desenha o terreno, os objetos e os alvos da missão. Ganhos de custo (survey-flight §5.18): (1) o
 * `stroke` por quad (que escondia as emendas) saiu, trocado pelo avanço de `QUAD_OVERLAP_PX` sobre
 * o vizinho; (2) os quads vizinhos de mesma cor de uma faixa saem num polígono só (`QuadStrip`,
 * ADR-033), e o brilho da água espera o fim da faixa; (3) as curvas de nível de uma faixa saem
 * num traço só por estilo, depois dos quads dela e antes dos seus objetos (um `stroke` por
 * segmento custava caro nos relevos íngremes, R01); (4) objetos, sombras e alvos assentam na
 * elevação da própria grade, sem reavaliar o relevo.
 */
export function renderTerrain(ctx: CanvasRenderingContext2D, scene: TerrainScene): void {
  ctx.lineWidth = 1;
  const minor: number[] = [];
  const master: number[] = [];
  let band = -1;
  // Brilhos da água da faixa, desenhados por cima dela depois do último trecho.
  let glints = 0;
  let patches = 0;
  const flush = () => {
    STRIP.flush(ctx);
    // Os pedaços de outra cobertura: os da mesma cor seguidos saem num `fill` só.
    let style = '';
    for (let k = 0; k < patches; k++) {
      const color = PATCH_COLOR[k] as string;
      if (color !== style) {
        if (style !== '') ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        style = color;
      }
      const o = k * 8;
      const n = PATCH_N[k] as number;
      ctx.moveTo(PATCH_PTS[o] as number, PATCH_PTS[o + 1] as number);
      for (let q = 1; q < n; q++)
        ctx.lineTo(PATCH_PTS[o + q * 2] as number, PATCH_PTS[o + q * 2 + 1] as number);
      ctx.closePath();
    }
    if (style !== '') ctx.fill();
    patches = 0;
    for (let k = 0; k < glints; k++) {
      drawGlint(ctx, GLINTS.subarray(k * 8, k * 8 + 8), scene.timeS);
    }
    glints = 0;
    strokeSegments(ctx, minor, CONTOUR_MINOR);
    strokeSegments(ctx, master, CONTOUR_MASTER);
  };
  traverse(scene, {
    quad: (b, _z, p, color) => {
      if (b !== band) {
        flush();
        band = b;
      }
      STRIP.push(ctx, p, color);
    },
    patch: (_band, _z, p, n, color) => {
      if (patches >= MAX_PATCHES) return;
      PATCH_PTS.set(p.subarray(0, n * 2), patches * 8);
      PATCH_N[patches] = n;
      PATCH_COLOR[patches] = color;
      patches++;
    },
    // As estradas da faixa entram na mesma fila dos pedaços, depois deles.
    road: (_band, _z, p, color) => {
      if (patches >= MAX_PATCHES) return;
      PATCH_PTS.set(p.subarray(0, 8), patches * 8);
      PATCH_N[patches] = 4;
      PATCH_COLOR[patches] = color;
      patches++;
    },
    contour: (_band, x1, y1, x2, y2, isMaster) => {
      (isMaster ? master : minor).push(x1, y1, x2, y2);
    },
    shadow: (_band, o, s, lengthM, ground) => {
      flush();
      drawShadow(ctx, o, s, lengthM, ground);
    },
    glint: (_band, _z, p) => {
      if ((glints + 1) * 8 > GLINTS.length) return;
      GLINTS.set(p, glints * 8);
      glints++;
    },
    object: (_band, o, s, ground) => {
      flush();
      drawSceneObject(ctx, o, {
        cam: s.cam,
        elevation: ground,
        fog: fogFactor(o.Z, fogDistance(s.lighting)),
        fogColor: s.palette.fog,
        timeS: s.timeS,
      });
    },
    mark: (_band, mk, s, ground) => {
      flush();
      drawMark(ctx, mk, s, ground);
    },
  });
  flush();
}
