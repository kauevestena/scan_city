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
}

export type DrawCommand =
  | { type: 'QUAD'; band: number; z: number; color: string }
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

/** Ordem dos cantos ao redor do quad e limite de curvas por quad (relevo muito íngreme). */
const QUAD_ORDER = [0, 1, 2, 3] as const;
const MAX_CONTOURS_PER_QUAD = 6;

/** Destino dos comandos: o canvas (render) ou uma lista (testes). */
/** Elevação do chão em (X, Z) tirada da malha da grade (a mesma superfície dos quads). */
type GroundFn = (X: number, Z: number) => number;

interface Sink {
  quad(band: number, z: number, pts: Float64Array, color: string): void;
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

function traverse(scene: TerrainScene, sink: Sink): void {
  PERF.flight.enter(FLIGHT_STAGE.GRID);
  const g = sampleGrid(scene);
  PERF.flight.enter(FLIGHT_STAGE.OBJECTS);
  const { n, m } = g;
  const ground: GroundFn = (X, Z) => gridElevation(g, scene.cam, X, Z);
  const H = scene.cam.height;
  const zFog = fogDistance(scene.lighting);
  const interval = contourInterval(scene.reliefM);
  const pts = new Float64Array(8);
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
        (y00 < 0 && y01 < 0 && y10 < 0 && y11 < 0) ||
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
      const cover = g.cover[k00] as LandCover;
      let base: Rgb = scene.palette.cover[cover];
      let shade = shadeFor(dzdx, dzdz, scene.sun);
      if (cover === 'WATER') {
        base = scene.palette.water;
        shade = 1 + 0.06 * Math.sin(scene.timeS * 2 + Zi * 0.1 + (g.x[k00] as number) * 0.05);
      }
      if (cover === 'LAVA' && scene.lavaGlow) {
        // Brilho laranja: mais claro que o resto e pulsando devagar, de ponto em ponto.
        shade = 1.18 + 0.14 * Math.sin(scene.timeS * 2.4 + Zi * 0.08 + (g.x[k00] as number) * 0.06);
      }
      if (scene.thermal) {
        // Termal: o calor da cobertura, a mancha quente do ponto e um toque do relevo.
        const xMid = ((g.x[k00] as number) + (g.x[k01] as number)) / 2;
        const heat =
          COVER_HEAT[cover] + scene.thermal.heatAt(xMid, (Zi + Zn) / 2) + 0.18 * (shade - 1);
        base = thermalColor(heat);
        shade = 1;
      }
      // Cor com sombreamento e névoa, sem alocar vetores por quad (mesma conta de `mix`).
      const fogColor = scene.palette.fog;
      const lr = base[0] * shade;
      const lg = base[1] * shade;
      const lb = base[2] * shade;
      const r = lr + (fogColor[0] - lr) * fog;
      const gg = lg + (fogColor[1] - lg) * fog;
      const b = lb + (fogColor[2] - lb) * fog;
      pts[0] = g.sx[k00] as number;
      pts[1] = y00;
      pts[2] = g.sx[k01] as number;
      pts[3] = y01;
      pts[4] = g.sx[k11] as number;
      pts[5] = y11;
      pts[6] = g.sx[k10] as number;
      pts[7] = y10;
      sink.quad(i, Zi, pts, quantizedColor(r, gg, b));
      if (cover === 'WATER' && scene.specularWater && scene.lighting === 'SUN_HIGH') {
        sink.glint(i, Zi, pts, scene.timeS);
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
export const QUAD_OVERLAP_PX = 1;

/**
 * Cantos do quad `p` (x, y × 4, na ordem perto-esquerda, perto-direita, longe-direita,
 * longe-esquerda; `perto` fica embaixo na tela) com o avanço de `QUAD_OVERLAP_PX` na borda de baixo
 * (a da faixa mais perto, pintada depois) e na da direita (a da coluna seguinte). As bordas de cima
 * e da esquerda ficam onde estão. Escreve em `out` e o devolve.
 */
export function extendQuad(p: Float64Array, out: Float64Array): Float64Array {
  out[0] = p[0] as number;
  out[1] = (p[1] as number) + QUAD_OVERLAP_PX;
  out[2] = (p[2] as number) + QUAD_OVERLAP_PX;
  out[3] = (p[3] as number) + QUAD_OVERLAP_PX;
  out[4] = (p[4] as number) + QUAD_OVERLAP_PX;
  out[5] = p[5] as number;
  out[6] = p[6] as number;
  out[7] = p[7] as number;
  return out;
}

/**
 * Desenha o terreno, os objetos e os alvos da missão. Ganhos de custo (survey-flight §5.18),
 * medidos no navegador sem GPU: (1) o `stroke` por quad (que escondia as emendas) saiu, trocado
 * pelo avanço de `QUAD_OVERLAP_PX` sobre o vizinho; (2) as curvas de nível de uma faixa saem num
 * traço só por estilo, depois dos quads dela e antes dos seus objetos (um `stroke` por segmento
 * custava caro nos relevos íngremes, R01); (3) objetos, sombras e alvos assentam na elevação da
 * própria grade, sem reavaliar o relevo.
 */
export function renderTerrain(ctx: CanvasRenderingContext2D, scene: TerrainScene): void {
  ctx.lineWidth = 1;
  const minor: number[] = [];
  const master: number[] = [];
  let band = -1;
  const extended = new Float64Array(8);
  const flush = () => {
    strokeSegments(ctx, minor, CONTOUR_MINOR);
    strokeSegments(ctx, master, CONTOUR_MASTER);
  };
  traverse(scene, {
    quad: (b, _z, p, color) => {
      if (b !== band) {
        flush();
        band = b;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      const q = extendQuad(p, extended);
      ctx.moveTo(q[0] as number, q[1] as number);
      ctx.lineTo(q[2] as number, q[3] as number);
      ctx.lineTo(q[4] as number, q[5] as number);
      ctx.lineTo(q[6] as number, q[7] as number);
      ctx.closePath();
      ctx.fill();
    },
    contour: (_band, x1, y1, x2, y2, isMaster) => {
      (isMaster ? master : minor).push(x1, y1, x2, y2);
    },
    shadow: (_band, o, s, lengthM, ground) => {
      flush();
      drawShadow(ctx, o, s, lengthM, ground);
    },
    glint: (_band, _z, p, timeS) => drawGlint(ctx, p, timeS),
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
