/**
 * Terreno em faixas (survey-flight §5.3): grade de N × M amostras à frente da aeronave,
 * pintada de longe para perto, com hillshade do sol, curvas de nível, névoa e os objetos
 * intercalados por faixa (oclusão natural). `buildDrawList` registra a mesma sequência que
 * `renderTerrain` desenha, para testar a ordem sem pixels.
 */
import { LIGHTING } from '@/domain/photogrammetry';
import type { LandCover, LightingId, Rgb, WorldObjectKind } from '@/types';
import type { BiomePalette } from '@/world/terrain/TerrainSampler';
import {
  CAMERA_OFFSET_M,
  halfWidthAt,
  projectAbs,
  QUALITY,
  type FlightCamera,
  type Quality,
} from './projection';

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

export interface SceneObject {
  id: number;
  kind: WorldObjectKind;
  /** Coordenadas do *run* relativas à aeronave. */
  X: number;
  Z: number;
  widthM: number;
  heightM: number;
  baseM: number;
  color: Rgb;
}

export interface GroundMark {
  id: string;
  kind: 'GCP' | 'CP';
  X: number;
  Z: number;
}

export interface TerrainScene {
  cam: FlightCamera;
  quality: Quality;
  /** Elevação e cobertura nas coordenadas do *run* (Z = 0 na aeronave). */
  elevation: (X: number, Z: number) => number;
  cover: (X: number, Z: number) => LandCover;
  palette: BiomePalette;
  lighting: LightingId;
  /** Vetor do sol no frame do *run* (X à direita, Z à frente). */
  sun: { x: number; z: number; up: number } | null;
  reliefM: number;
  timeS: number;
  objects: readonly SceneObject[];
  marks: readonly GroundMark[];
}

export type DrawCommand =
  | { type: 'QUAD'; band: number; z: number; color: string }
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
interface Sink {
  quad(band: number, z: number, pts: Float64Array, color: string): void;
  contour(band: number, x1: number, y1: number, x2: number, y2: number, master: boolean): void;
  object(band: number, o: SceneObject, scene: TerrainScene): void;
  mark(band: number, m: GroundMark, scene: TerrainScene): void;
}

interface Grid {
  n: number;
  m: number;
  z: Float64Array;
  x: Float64Array;
  elev: Float64Array;
  sx: Float64Array;
  sy: Float64Array;
  cover: LandCover[];
}

function sampleGrid(scene: TerrainScene): Grid {
  const { cam } = scene;
  const { bands: n, cols: m } = QUALITY[scene.quality];
  const size = (n + 1) * (m + 1);
  const g: Grid = {
    n,
    m,
    z: new Float64Array(n + 1),
    x: new Float64Array(size),
    elev: new Float64Array(size),
    sx: new Float64Array(size),
    sy: new Float64Array(size),
    cover: new Array<LandCover>(size),
  };
  for (let i = 0; i <= n; i++) {
    const Z = bandDistance(i, n, cam);
    g.z[i] = Z;
    const half = halfWidthAt(Z, cam);
    const scale = cam.focalPx / (Z + CAMERA_OFFSET_M);
    for (let j = 0; j <= m; j++) {
      const k = i * (m + 1) + j;
      const X = cam.camX - half + (2 * half * j) / m;
      const e = scene.elevation(X, Z);
      g.x[k] = X;
      g.elev[k] = e;
      g.cover[k] = scene.cover(X, Z);
      g.sx[k] = cam.horizonX + (X - cam.camX) * scale;
      g.sy[k] = cam.horizonY + (cam.camAlt - e) * scale;
    }
  }
  return g;
}

function mix(a: Rgb, b: Rgb, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function traverse(scene: TerrainScene, sink: Sink): void {
  const g = sampleGrid(scene);
  const { n, m } = g;
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
    if (b >= 0) byBand[b]?.push({ z: o.Z, draw: (band) => sink.object(band, o, scene) });
  }
  for (const mk of scene.marks) {
    const b = bandOf(mk.Z);
    if (b >= 0) byBand[b]?.push({ z: mk.Z, draw: (band) => sink.mark(band, mk, scene) });
  }

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
      const lit: Rgb = [base[0] * shade, base[1] * shade, base[2] * shade];
      const [r, gg, b] = mix(lit, scene.palette.fog, fog);
      pts[0] = g.sx[k00] as number;
      pts[1] = y00;
      pts[2] = g.sx[k01] as number;
      pts[3] = y01;
      pts[4] = g.sx[k11] as number;
      pts[5] = y11;
      pts[6] = g.sx[k10] as number;
      pts[7] = y10;
      sink.quad(i, Zi, pts, quantizedColor(r, gg, b));
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
      items.sort((a, b) => b.z - a.z);
      for (const it of items) it.draw(i);
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
    mark: (band, mk) => list.push({ type: 'MARK', band, z: mk.Z, id: mk.id }),
  });
  return list;
}

function drawObject(ctx: CanvasRenderingContext2D, o: SceneObject, scene: TerrainScene): void {
  const ground = scene.elevation(o.X, o.Z);
  const base = projectAbs(o.X, ground + o.baseM, o.Z, scene.cam);
  const top = projectAbs(o.X, ground + o.baseM + o.heightM, o.Z, scene.cam);
  if (!base || !top) return;
  const w = o.widthM * base.scale;
  if (w < 1 && base.y - top.y < 1) return;
  const fog = fogFactor(o.Z, fogDistance(scene.lighting));
  const [r, g, b] = mix(o.color, scene.palette.fog, fog);
  if (o.kind === 'TREE') {
    const trunkW = Math.max(1, w * 0.15);
    ctx.fillStyle = quantizedColor(90 * (1 - fog) + scene.palette.fog[0] * fog, 64, 40);
    ctx.fillRect(
      base.x - trunkW / 2,
      top.y + (base.y - top.y) * 0.5,
      trunkW,
      (base.y - top.y) * 0.5,
    );
    ctx.fillStyle = quantizedColor(r, g, b);
    ctx.beginPath();
    ctx.arc(base.x, top.y + (base.y - top.y) * 0.35, Math.max(1, w / 2), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (o.kind === 'WIRE') return;
  // Face voltada à câmera (×0,85) e topo (×1,0).
  ctx.fillStyle = quantizedColor(r * 0.85, g * 0.85, b * 0.85);
  ctx.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
  ctx.fillStyle = quantizedColor(r, g, b);
  ctx.fillRect(base.x - w / 2, top.y - Math.max(1, w * 0.12), w, Math.max(1, w * 0.12));
}

function drawMark(ctx: CanvasRenderingContext2D, mk: GroundMark, scene: TerrainScene): void {
  const e = scene.elevation(mk.X, mk.Z);
  const c = projectAbs(mk.X, e, mk.Z, scene.cam);
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

/** Desenha o terreno, os objetos e os alvos da missão. */
export function renderTerrain(ctx: CanvasRenderingContext2D, scene: TerrainScene): void {
  ctx.lineWidth = 1;
  traverse(scene, {
    quad: (_band, _z, p, color) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(p[0] as number, p[1] as number);
      ctx.lineTo(p[2] as number, p[3] as number);
      ctx.lineTo(p[4] as number, p[5] as number);
      ctx.lineTo(p[6] as number, p[7] as number);
      ctx.closePath();
      ctx.fill();
      // Contorno da mesma cor fecha as frestas de antisserrilhado entre quads.
      ctx.stroke();
    },
    contour: (_band, x1, y1, x2, y2, master) => {
      ctx.strokeStyle = master ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0.25)';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    object: (_band, o, s) => drawObject(ctx, o, s),
    mark: (_band, mk, s) => drawMark(ctx, mk, s),
  });
}
