/**
 * Cena da Mesa Holográfica (holo-table §5.2–§5.3).
 *
 * - Terra Real: grade 4 × 2 de setores de 1 × 1 unidade (espaço de 0,05) sobre a mesa; o slot (3, 1)
 *   é o oceano decorativo.
 * - Multiverso: anel de 11 ilhas-diorama de raio 3,5, flutuando, cada uma com borda violeta.
 * - Setores mapeados com o relevo do contrato, prédios e a cor do modo (ORTHO, HYPSO, NEON);
 *   os demais em gesso com wireframe e "?" (Real) ou num cubo violeta girando (Multiverso).
 *
 * Puro: o terreno vem por parâmetro. A geometria é construída uma vez por contrato, resolução e
 * modo (a amostragem do terreno, uma vez por contrato e resolução).
 */
import { CONTRACTS } from '@/data/contracts';
import { MUSEUM_GRID, museumSlotCoords } from '@/data/contracts/museum';
import { hashString, mulberry32 } from '@/lib/rng';
import { COLORS, withAlpha } from '@/ui/tokens';
import type {
  AoiPoint,
  Contract,
  ContractProgress,
  Dimension,
  MuseumSector,
  WorldObjectKind,
} from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import { buildMesh, type LineSet, type Mesh, type PointSet } from '../soft3d/Renderer';
import type { Vec3 } from '../soft3d/vec3';

export type HoloQuality = 'LOW' | 'MEDIUM' | 'HIGH';
/** Modos de exibição (§5.3): ortofoto, hipsometria com curvas de nível e nuvem/TIN neon. */
export type HoloMode = 'ORTHO' | 'HYPSO' | 'NEON';
export const HOLO_MODES: readonly HoloMode[] = ['ORTHO', 'HYPSO', 'NEON'];
export type HoloDimension = Dimension;

export const HEIGHTMAP_RES: Readonly<Record<HoloQuality, number>> = {
  HIGH: 32,
  MEDIUM: 24,
  LOW: 16,
};
/**
 * Malha dos dioramas do anel, um nível abaixo da grade Real: as 11 ilhas ocupam uma fração da tela
 * (1 unidade num anel de raio 3,5) e 11 × 32² quads estourariam o orçamento de 10 ms por quadro.
 */
export const RING_RES: Readonly<Record<HoloQuality, number>> = {
  HIGH: 24,
  MEDIUM: 16,
  LOW: 12,
};
/** Qualidade logo abaixo (a queda automática da mesa, §5.7); `null` na mais baixa. */
export const LOWER_QUALITY: Readonly<Record<HoloQuality, HoloQuality | null>> = {
  HIGH: 'MEDIUM',
  MEDIUM: 'LOW',
  LOW: null,
};

export const SECTOR_GAP = 0.05;
/** Espessura do bloco de cada setor (a base fica em y = 0). */
export const BLOCK_Y = 0.04;
/** Exagero vertical: 0,25 unidade para a amplitude do relevo do setor. */
export const RELIEF_UNITS = 0.25;
export const MAX_BUILDINGS = 40;
/** Slot do oceano decorativo: (3, 1). */
export const OCEAN_SLOT = 7;
export const TABLE_RADIUS = 2.7;

/** Multiverso: 11 dioramas num anel de raio 3,5 (§5.2), sobre uma mesa um pouco maior. */
export const RING_SLOTS = 11;
export const RING_RADIUS = 3.5;
export const RING_TABLE_RADIUS = 4.4;
/** Os dioramas flutuam a esta altura e oscilam `0,05·sin(t + i)` (a engine soma a oscilação). */
export const FLOAT_Y = 0.14;
export const BOB_AMPLITUDE = 0.05;
/** Pedestal do setor em destaque (a Real o ergue; no anel, ele fica sob a ilha que flutua). */
export const PEDESTAL_Y = 0.07;
/** Cubo violeta do diorama em névoa. */
export const CUBE_SIZE = 0.55;
/** Curvas de nível a cada 1/10 do relevo. */
export const CONTOUR_LEVELS = 10;

const PLASTER: [number, number, number] = [148, 163, 184];
const OCEAN: [number, number, number] = [37, 99, 160];
const GLASS: [number, number, number] = [15, 23, 42];
const BLACK: [number, number, number] = [0, 0, 0];
const PEDESTAL: [number, number, number] = [100, 116, 139];
const SPOT: [number, number, number] = [254, 243, 199];
const BUILDING_SIDE: [number, number, number] = [210, 214, 220];
const WHITE: [number, number, number] = [255, 255, 255];
const BUILDING_KINDS: ReadonlySet<WorldObjectKind> = new Set([
  'BUILDING',
  'TOWER',
  'PIPE',
  'CLIFF_TEMPLE',
]);

/** Rampa hipsométrica clássica: verde, amarelo, ocre, marrom e neve. */
const HYPSO_STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 38, 120, 78],
  [0.3, 150, 184, 92],
  [0.55, 214, 190, 100],
  [0.78, 160, 104, 72],
  [1, 246, 246, 242],
];

/** Cor hipsométrica de `t` ∈ [0, 1] (0 = ponto mais baixo do setor). */
export function hypsoColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let k = 1; k < HYPSO_STOPS.length; k++) {
    const b = HYPSO_STOPS[k] as readonly [number, number, number, number];
    if (x <= b[0]) {
      const a = HYPSO_STOPS[k - 1] as readonly [number, number, number, number];
      const f = (x - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    }
  }
  const last = HYPSO_STOPS[HYPSO_STOPS.length - 1] as readonly [number, number, number, number];
  return [last[1], last[2], last[3]];
}

export interface HoloSector {
  /** Slot dentro da ala (grade 4 × 2 na Real, posição no anel no Multiverso). */
  slot: number;
  wing: HoloDimension;
  /** Contrato do setor (se existir no catálogo). */
  contract?: Contract;
  mapped: boolean;
  x0: number;
  z0: number;
  /** Altura máxima do topo (base + relevo), sem a elevação do pedestal ou da flutuação. */
  topY: number;
  /** Elevação estática do setor: pedestal (destaque) ou flutuação do diorama. */
  hover: number;
  /** Diorama do Multiverso: oscila com `sin(t + slot)`. */
  floating: boolean;
  /** Centro do topo, já com `hover` (alvo do fly-to). */
  center: Vec3;
  /** Cantos do topo, com `hover`, para o picking. */
  corners: Vec3[];
  mesh: Mesh;
  buildings?: Mesh;
  /** Translucidez dos prédios (HYPSO: branco translúcido). */
  buildingsAlpha?: number;
  /** Wireframe do gesso (setor em névoa). */
  wire?: LineSet;
  /** Linhas estáticas do setor mapeado: curvas de nível (HYPSO), TIN e arestas de prédios (NEON). */
  overlays?: LineSet[];
  /** Pontos do heightmap (NEON). */
  points?: PointSet;
  /** Borda luminosa violeta do diorama. */
  rim?: LineSet;
  /** Diorama em névoa: a engine desenha um cubo violeta girando. */
  cube?: boolean;
  /** Setor em destaque: pedestal e cone de luz. */
  featured: boolean;
  pedestal?: Mesh;
  spot?: Mesh;
  bestLines?: ReadonlyArray<{ start: AoiPoint; end: AoiPoint }>;
  bestAircraftId?: string;
  museum?: MuseumSector;
}

export interface HoloScene {
  dimension: HoloDimension;
  mode: HoloMode;
  sectors: HoloSector[];
  /** Oceano decorativo do slot (3, 1): só na Terra Real. */
  ocean?: { mesh: Mesh; x0: number; z0: number };
  table: Mesh;
  rim: LineSet;
  radius: number;
  mappedCount: number;
}

/** Visão da mesa: dimensão, modo e os setores em destaque de cada ala. */
export interface HoloView {
  dimension?: HoloDimension;
  mode?: HoloMode;
  featured?: Partial<Record<Dimension, string>>;
}

const EMPTY_MESH: Mesh = buildMesh(new Float32Array(0), new Uint32Array(0), new Uint8Array(0));

/** Canto (x0, z0) do slot na grade centrada na origem. */
export function slotOrigin(slot: number): { x0: number; z0: number } {
  const { col, lin } = museumSlotCoords(slot);
  const step = 1 + SECTOR_GAP;
  return {
    x0: (col - MUSEUM_GRID.cols / 2) * step + SECTOR_GAP / 2,
    z0: (lin - MUSEUM_GRID.rows / 2) * step + SECTOR_GAP / 2,
  };
}

/** Centro do diorama `slot` no anel do Multiverso (o slot 0 fica ao fundo, no sentido horário). */
export function ringCenter(slot: number): { x: number; z: number } {
  const a = (slot / RING_SLOTS) * Math.PI * 2 - Math.PI / 2;
  return { x: RING_RADIUS * Math.cos(a), z: RING_RADIUS * Math.sin(a) };
}

/** Canto (x0, z0) do diorama (a ilha também tem 1 × 1 unidade). */
export function dioramaOrigin(slot: number): { x0: number; z0: number } {
  const c = ringCenter(slot);
  return { x0: c.x - 0.5, z0: c.z - 0.5 };
}

/** Canto do setor na ala da dimensão. */
export function wingOrigin(dimension: HoloDimension, slot: number): { x0: number; z0: number } {
  return dimension === 'RIFT' ? dioramaOrigin(slot) : slotOrigin(slot);
}

/** Caixa (5 faces visíveis) de (x0, z0) a (x1, z1), de y0 a y1. */
function boxQuads(
  pos: number[],
  quads: number[],
  colors: number[],
  b: { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number },
  side: readonly number[],
  topColor: readonly number[],
): void {
  const v = pos.length / 3;
  const corners: Array<[number, number, number]> = [
    [b.x0, b.y0, b.z0],
    [b.x1, b.y0, b.z0],
    [b.x1, b.y0, b.z1],
    [b.x0, b.y0, b.z1],
    [b.x0, b.y1, b.z0],
    [b.x1, b.y1, b.z0],
    [b.x1, b.y1, b.z1],
    [b.x0, b.y1, b.z1],
  ];
  for (const c of corners) pos.push(...c);
  const faces: Array<[number, number, number, number, readonly number[]]> = [
    [4, 7, 6, 5, topColor], // topo (normal +y)
    [0, 4, 5, 1, side], // −z
    [1, 5, 6, 2, side], // +x
    [2, 6, 7, 3, side], // +z
    [3, 7, 4, 0, side], // −x
  ];
  for (const [a, bb, c, d, col] of faces) {
    quads.push(v + a, v + bb, v + c, v + d);
    colors.push(...col);
  }
}

/** As 12 arestas de uma caixa (para o NEON): índices a partir de `v` (os 8 cantos já empilhados). */
const BOX_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

function boxWire(
  pos: number[],
  seg: number[],
  b: { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number },
): void {
  const v = pos.length / 3;
  pos.push(
    b.x0, b.y0, b.z0,
    b.x1, b.y0, b.z0,
    b.x1, b.y0, b.z1,
    b.x0, b.y0, b.z1,
    b.x0, b.y1, b.z0,
    b.x1, b.y1, b.z0,
    b.x1, b.y1, b.z1,
    b.x0, b.y1, b.z1,
  ); // prettier-ignore
  for (const [a, c] of BOX_EDGES) seg.push(v + a, v + c);
}

function rimOf(x0: number, z0: number, y: number, color: string, glow: string): LineSet {
  return {
    positions: new Float32Array([x0, y, z0, x0, y, z0 + 1, x0 + 1, y, z0 + 1, x0 + 1, y, z0]),
    segments: new Uint32Array([0, 1, 1, 2, 2, 3, 3, 0]),
    color,
    width: 2,
    glow,
  };
}

function cornersOf(x0: number, z0: number, y: number): Vec3[] {
  return [
    [x0, y, z0],
    [x0, y, z0 + 1],
    [x0 + 1, y, z0 + 1],
    [x0 + 1, y, z0],
  ];
}

// --- setor em gesso -------------------------------------------------------------------

function plasterWire(x0: number, z0: number, color: string): LineSet {
  const y = BLOCK_Y + 0.001;
  const wp: number[] = [];
  const seg: number[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const i = wp.length / 3;
    wp.push(x0 + t, y, z0, x0 + t, y, z0 + 1, x0, y, z0 + t, x0 + 1, y, z0 + t);
    seg.push(i, i + 1, i + 2, i + 3);
  }
  return {
    positions: new Float32Array(wp),
    segments: new Uint32Array(seg),
    color,
    width: 1,
  };
}

function plasterSector(
  wing: HoloDimension,
  slot: number,
  contract: Contract | undefined,
  mode: HoloMode,
): HoloSector {
  const { x0, z0 } = wingOrigin(wing, slot);
  const floating = wing === 'RIFT';
  const hover = floating ? FLOAT_Y : 0;
  const sector: HoloSector = {
    slot,
    wing,
    mapped: false,
    x0,
    z0,
    topY: BLOCK_Y,
    hover,
    floating,
    featured: false,
    center: [x0 + 0.5, BLOCK_Y + hover, z0 + 0.5],
    corners: cornersOf(x0, z0, BLOCK_Y + hover),
    mesh: EMPTY_MESH,
  };
  if (floating) {
    // Diorama em névoa: só o cubo violeta (a engine o faz girar). Picking pela altura do meio.
    sector.cube = true;
    sector.corners = cornersOf(x0, z0, hover + CUBE_SIZE / 2);
    sector.center = [x0 + 0.5, hover + CUBE_SIZE / 2, z0 + 0.5];
  } else {
    if (mode !== 'NEON') {
      const pos: number[] = [];
      const quads: number[] = [];
      const colors: number[] = [];
      boxQuads(
        pos,
        quads,
        colors,
        { x0, z0, x1: x0 + 1, z1: z0 + 1, y0: 0, y1: BLOCK_Y },
        PLASTER,
        PLASTER,
      );
      sector.mesh = buildMesh(
        new Float32Array(pos),
        new Uint32Array(quads),
        new Uint8Array(colors),
        true,
      );
    }
    sector.wire = plasterWire(
      x0,
      z0,
      mode === 'NEON' ? withAlpha(COLORS.radar, 0.55) : 'rgba(14, 116, 144, 0.9)',
    );
  }
  if (contract) sector.contract = contract;
  return sector;
}

// --- relevo esculpido -----------------------------------------------------------------

interface BuildingBox {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  /** Altura da base e do topo, em unidades da mesa. */
  base: number;
  top: number;
  roof: readonly number[];
}

/** Amostragem do terreno do contrato numa grade (n + 1)², comum a todos os modos. */
interface Grid {
  n: number;
  /** Elevação normalizada em [0, 1] por vértice, linha a linha (j · (n + 1) + i). */
  t: Float32Array;
  /** `t` do ponto mais alto (0 num terreno plano). */
  hiT: number;
  /** Cor da cobertura por célula (rgb × n²). */
  cover: Uint8Array;
  boxes: BuildingBox[];
}

export interface SculptGeometry {
  mesh: Mesh;
  buildings: Mesh;
  topY: number;
  /** Translucidez dos prédios (HYPSO). */
  buildingsAlpha: number;
  /** Linhas estáticas: curvas de nível (HYPSO), TIN e arestas dos prédios (NEON). */
  overlays: LineSet[];
  /** Pontos do heightmap com jitter (NEON). */
  points?: PointSet;
}

const gridCache = new Map<string, Grid>();
const geometryCache = new Map<string, SculptGeometry>();

const yOfT = (t: number): number => BLOCK_Y + RELIEF_UNITS * t;

function sampleGrid(contract: Contract, terrain: TerrainSampler, n: number): Grid {
  const key = `${contract.id}:${n}`;
  const hit = gridCache.get(key);
  if (hit) return hit;
  const { lengthM, widthM } = contract.aoi;
  const elev = new Float32Array((n + 1) * (n + 1));
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const e = terrain.elevation((i / n) * lengthM, (j / n) * widthM);
      elev[j * (n + 1) + i] = e;
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
  }
  const relief = Math.max(1e-6, hi - lo);
  const t = elev.map((e) => (e - lo) / relief);
  const cover = new Uint8Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const c = terrain.landCover(((i + 0.5) / n) * lengthM, ((j + 0.5) / n) * widthM);
      const rgb = c === 'WATER' ? terrain.palette.water : terrain.palette.cover[c];
      cover.set(rgb, (j * n + i) * 3);
    }
  }
  // Prédios: os maiores, extrudados na mesma escala vertical (no máximo 0,5).
  const roof = terrain.palette.cover.ROOF;
  const boxes = terrain.objects
    .filter(
      (o) => BUILDING_KINDS.has(o.kind) && o.u >= 0 && o.u <= lengthM && o.v >= 0 && o.v <= widthM,
    )
    .sort((a, b) => b.widthM * b.depthM * b.heightM - a.widthM * a.depthM * a.heightM)
    .slice(0, MAX_BUILDINGS)
    .map((o): BuildingBox => {
      const base = yOfT((terrain.elevation(o.u, o.v) - lo) / relief);
      const h = Math.min(0.5, (RELIEF_UNITS * o.heightM) / Math.max(relief, 10));
      return {
        cx: o.u / lengthM,
        cz: o.v / widthM,
        hw: o.widthM / lengthM / 2,
        hd: o.depthM / widthM / 2,
        base,
        top: base + h,
        roof,
      };
    });
  const grid: Grid = { n, t, hiT: (hi - lo) / relief, cover, boxes };
  gridCache.set(key, grid);
  return grid;
}

/** Curvas de nível (marching squares) em k/`levels` do relevo, k = 1…levels − 1. */
export function contourLines(
  t: ArrayLike<number>,
  n: number,
  x0: number,
  z0: number,
  levels = CONTOUR_LEVELS,
): LineSet {
  const pos: number[] = [];
  const seg: number[] = [];
  const at = (i: number, j: number): number => t[j * (n + 1) + i] as number;
  const pts: number[] = [];
  for (let k = 1; k < levels; k++) {
    const level = k / levels;
    const y = yOfT(level) + 0.002;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v00 = at(i, j);
        const v10 = at(i + 1, j);
        const v11 = at(i + 1, j + 1);
        const v01 = at(i, j + 1);
        pts.length = 0;
        const cross = (ax: number, az: number, av: number, bx: number, bz: number, bv: number) => {
          if (av < level === bv < level) return;
          const f = (level - av) / (bv - av);
          pts.push(ax + (bx - ax) * f, az + (bz - az) * f);
        };
        cross(i, j, v00, i + 1, j, v10); // 0: borda z = j
        cross(i + 1, j, v10, i + 1, j + 1, v11); // 1: borda x = i + 1
        cross(i, j + 1, v01, i + 1, j + 1, v11); // 2: borda z = j + 1
        cross(i, j, v00, i, j + 1, v01); // 3: borda x = i
        const joinEdges = (a: number, b: number) => {
          const v = pos.length / 3;
          pos.push(
            x0 + (pts[a * 2] as number) / n,
            y,
            z0 + (pts[a * 2 + 1] as number) / n,
            x0 + (pts[b * 2] as number) / n,
            y,
            z0 + (pts[b * 2 + 1] as number) / n,
          );
          seg.push(v, v + 1);
        };
        if (pts.length === 4) joinEdges(0, 1);
        else if (pts.length === 8) {
          // Sela: o centro decide quais cantos ficam isolados.
          const aboveCenter = (v00 + v10 + v11 + v01) / 4 >= level;
          // Centro acima: isola os cantos abaixo (bordas 0–1 e 2–3 ou 0–3 e 1–2, conforme a sela).
          if (aboveCenter === v00 < level) {
            joinEdges(0, 3);
            joinEdges(1, 2);
          } else {
            joinEdges(0, 1);
            joinEdges(2, 3);
          }
        }
      }
    }
  }
  return {
    positions: new Float32Array(pos),
    segments: new Uint32Array(seg),
    color: 'rgba(2, 6, 23, 0.6)',
    width: 1,
  };
}

/** Nuvem (heightmap com jitter) e TIN (grade triangulada, a cada `stride` amostras) do NEON. */
function neonCloud(
  grid: Grid,
  contractId: string,
  x0: number,
  z0: number,
): { points: PointSet; tin: LineSet } {
  const { n, t } = grid;
  const rng = mulberry32(hashString(`holo:${contractId}`));
  const jitter = 0.35 / n;
  const pts = new Float32Array((n + 1) * (n + 1) * 3);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = (j * (n + 1) + i) * 3;
      // O jitter fica de fora das bordas: os pontos não saem do setor.
      const jx = i === 0 || i === n ? 0 : (rng.next() - 0.5) * 2 * jitter;
      const jz = j === 0 || j === n ? 0 : (rng.next() - 0.5) * 2 * jitter;
      pts[k] = x0 + i / n + jx;
      pts[k + 1] = yOfT(t[j * (n + 1) + i] as number) + 0.003;
      pts[k + 2] = z0 + j / n + jz;
    }
  }
  const stride = Math.max(1, Math.round(n / 16));
  const seg: number[] = [];
  const at = (i: number, j: number) => j * (n + 1) + i;
  for (let j = 0; j <= n; j += stride) {
    for (let i = 0; i <= n; i += stride) {
      const ni = Math.min(n, i + stride);
      const nj = Math.min(n, j + stride);
      if (ni > i) seg.push(at(i, j), at(ni, j));
      if (nj > j) seg.push(at(i, j), at(i, nj));
      if (ni > i && nj > j) seg.push(at(i, j), at(ni, nj));
    }
  }
  return {
    points: { positions: pts, color: withAlpha(COLORS.radar, 0.95), size: 2 },
    tin: {
      positions: pts,
      segments: new Uint32Array(seg),
      color: withAlpha(COLORS.radar, 0.4),
      width: 1,
      glow: withAlpha(COLORS.radar, 0.1),
    },
  };
}

/** Relevo esculpido do setor: heightmap n × n do terreno do contrato, no modo `mode`. */
export function sculptGeometry(
  contract: Contract,
  terrain: TerrainSampler,
  n: number,
  x0: number,
  z0: number,
  mode: HoloMode = 'ORTHO',
): SculptGeometry {
  const key = `${contract.id}:${n}:${mode}`;
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const grid = sampleGrid(contract, terrain, n);
  const { t, boxes } = grid;
  const at = (i: number, j: number) => j * (n + 1) + i;
  const topY = yOfT(grid.hiT);
  const overlays: LineSet[] = [];
  let points: PointSet | undefined;
  let mesh = EMPTY_MESH;
  let buildings = EMPTY_MESH;
  let buildingsAlpha = 1;

  if (mode === 'NEON') {
    const cloud = neonCloud(grid, contract.id, x0, z0);
    points = cloud.points;
    overlays.push(cloud.tin);
    // Prédios só em arestas emerald.
    const wp: number[] = [];
    const ws: number[] = [];
    for (const b of boxes) {
      boxWire(wp, ws, {
        x0: x0 + b.cx - b.hw,
        z0: z0 + b.cz - b.hd,
        x1: x0 + b.cx + b.hw,
        z1: z0 + b.cz + b.hd,
        y0: b.base,
        y1: b.top,
      });
    }
    if (ws.length > 0) {
      overlays.push({
        positions: new Float32Array(wp),
        segments: new Uint32Array(ws),
        color: withAlpha(COLORS.ok, 0.95),
        width: 1,
      });
    }
  } else {
    const pos: number[] = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) pos.push(x0 + i / n, yOfT(t[at(i, j)] as number), z0 + j / n);
    }
    const quads: number[] = [];
    const colors: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        quads.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
        if (mode === 'HYPSO') {
          const tm =
            ((t[at(i, j)] as number) +
              (t[at(i + 1, j)] as number) +
              (t[at(i, j + 1)] as number) +
              (t[at(i + 1, j + 1)] as number)) /
            4;
          colors.push(...hypsoColor(tm));
        } else {
          const c = (j * n + i) * 3;
          colors.push(
            grid.cover[c] as number,
            grid.cover[c + 1] as number,
            grid.cover[c + 2] as number,
          );
        }
      }
    }
    // Saias: ligam a borda do relevo à base (y = 0).
    const skirt = (a: number, b: number) => {
      const v = pos.length / 3;
      pos.push(
        pos[a * 3] as number,
        0,
        pos[a * 3 + 2] as number,
        pos[b * 3] as number,
        0,
        pos[b * 3 + 2] as number,
      );
      quads.push(a, v, v + 1, b);
      colors.push(...GLASS.map((c) => c + 40));
    };
    for (let i = 0; i < n; i++) {
      skirt(at(i + 1, 0), at(i, 0));
      skirt(at(i, n), at(i + 1, n));
    }
    for (let j = 0; j < n; j++) {
      skirt(at(0, j), at(0, j + 1));
      skirt(at(n, j + 1), at(n, j));
    }
    mesh = buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors));

    const bPos: number[] = [];
    const bQuads: number[] = [];
    const bColors: number[] = [];
    for (const b of boxes) {
      boxQuads(
        bPos,
        bQuads,
        bColors,
        {
          x0: x0 + b.cx - b.hw,
          z0: z0 + b.cz - b.hd,
          x1: x0 + b.cx + b.hw,
          z1: z0 + b.cz + b.hd,
          y0: b.base,
          y1: b.top,
        },
        mode === 'HYPSO' ? WHITE : BUILDING_SIDE,
        mode === 'HYPSO' ? WHITE : b.roof,
      );
    }
    buildings = buildMesh(new Float32Array(bPos), new Uint32Array(bQuads), new Uint8Array(bColors));
    if (mode === 'HYPSO') {
      buildingsAlpha = 0.6;
      overlays.push(contourLines(t, n, x0, z0));
    }
  }
  const out: SculptGeometry = { mesh, buildings, topY, buildingsAlpha, overlays };
  if (points) out.points = points;
  geometryCache.set(key, out);
  return out;
}

/** Descarta a geometria em cache (testes e novo jogo). */
export function clearHoloCache(): void {
  geometryCache.clear();
  gridCache.clear();
}

/** Invalida o cache de um contrato (o setor é reconstruído após um replay melhor). */
export function invalidateHoloSector(contractId: string): void {
  for (const cache of [geometryCache, gridCache] as const) {
    for (const key of [...cache.keys()]) {
      if (key.startsWith(`${contractId}:`)) cache.delete(key);
    }
  }
}

// --- mesa, pedestal e holofote ---------------------------------------------------------

function tableMesh(
  radius: number,
  mode: HoloMode,
  dimension: HoloDimension,
): { table: Mesh; rim: LineSet } {
  const seg = 48;
  const pos: number[] = [0, -0.02, 0];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    pos.push(radius * Math.cos(a), -0.02, radius * Math.sin(a));
  }
  const quads: number[] = [];
  const colors: number[] = [];
  const fill = mode === 'NEON' ? BLACK : GLASS;
  for (let k = 0; k < seg; k++) {
    // Leque de quads degenerados (centro repetido) com normal para cima.
    quads.push(0, k + 2, k + 1, 0);
    colors.push(...fill);
  }
  const rimPos: number[] = [];
  const rimSeg: number[] = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    rimPos.push(radius * Math.cos(a), -0.01, radius * Math.sin(a));
    rimSeg.push(k, (k + 1) % seg);
  }
  const glowColor = dimension === 'RIFT' ? COLORS.rift : COLORS.radar;
  return {
    table: buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors), true),
    rim: {
      positions: new Float32Array(rimPos),
      segments: new Uint32Array(rimSeg),
      color: withAlpha(glowColor, 0.9),
      width: 2,
      glow: withAlpha(glowColor, 0.15),
    },
  };
}

/** Pedestal do setor em destaque: caixa um pouco maior que a ilha, da mesa até `height`. */
function pedestalMesh(x0: number, z0: number, height: number): Mesh {
  const pos: number[] = [];
  const quads: number[] = [];
  const colors: number[] = [];
  const pad = 0.06;
  boxQuads(
    pos,
    quads,
    colors,
    { x0: x0 - pad, z0: z0 - pad, x1: x0 + 1 + pad, z1: z0 + 1 + pad, y0: -0.02, y1: height },
    PEDESTAL,
    PEDESTAL,
  );
  return buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors));
}

/** Cone de luz do holofote: do ponto acima do setor até um círculo no topo dele. */
function spotMesh(cx: number, cz: number, baseY: number): Mesh {
  const seg = 16;
  const apexY = baseY + 1.5;
  const radius = 0.62;
  const pos: number[] = [cx, apexY, cz];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    pos.push(cx + radius * Math.cos(a), baseY, cz + radius * Math.sin(a));
  }
  const quads: number[] = [];
  const colors: number[] = [];
  for (let k = 0; k < seg; k++) {
    // Leque de quads degenerados (ápice repetido), com a normal para cima e para fora.
    quads.push(0, k + 2, k + 1, 0);
    colors.push(...SPOT);
  }
  return buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors), true);
}

/** Ondas do oceano decorativo: linhas senoidais que correm sobre o slot (3, 1), por instante. */
export function oceanWaves(x0: number, z0: number, tS: number): LineSet {
  const lines = 5;
  const samples = 12;
  const pos: number[] = [];
  const seg: number[] = [];
  const y = BLOCK_Y * 0.6 + 0.004;
  for (let l = 0; l < lines; l++) {
    const z = z0 + (l + 0.5) / lines;
    const base = pos.length / 3;
    for (let k = 0; k <= samples; k++) {
      const x = x0 + k / samples;
      pos.push(x, y + 0.006 * Math.sin(tS * 2 + (k / samples) * 6 + l), z);
      if (k > 0) seg.push(base + k - 1, base + k);
    }
  }
  return {
    positions: new Float32Array(pos),
    segments: new Uint32Array(seg),
    color: 'rgba(186, 230, 253, 0.7)',
    width: 1,
  };
}

/** Cubo em wireframe girando em torno do eixo vertical (o diorama em névoa do Multiverso). */
export function wireCube(
  center: Vec3,
  size: number,
  angleRad: number,
  color: string,
  glow: string,
): LineSet {
  const h = size / 2;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const pos: number[] = [];
  for (const dy of [-h, h]) {
    for (const [dx, dz] of [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ] as const) {
      pos.push(center[0] + dx * cos - dz * sin, center[1] + dy, center[2] + dx * sin + dz * cos);
    }
  }
  const seg: number[] = [];
  for (const [a, b] of BOX_EDGES) seg.push(a, b);
  return {
    positions: new Float32Array(pos),
    segments: new Uint32Array(seg),
    color,
    width: 1.5,
    glow,
  };
}

// --- cena ---------------------------------------------------------------------------------

/** Cena da dimensão: setores mapeados ou em névoa, o oceano (Real) e a mesa. */
export function buildHoloScene(
  sectors: Readonly<Record<string, MuseumSector>>,
  progress: Readonly<Record<string, ContractProgress>>,
  quality: HoloQuality,
  terrainFor: (contract: Contract) => TerrainSampler,
  contracts: readonly Contract[] = CONTRACTS,
  view: HoloView = {},
): HoloScene {
  const dimension = view.dimension ?? 'REAL';
  const mode = view.mode ?? 'ORTHO';
  const featuredId = view.featured?.[dimension];
  const n = (dimension === 'RIFT' ? RING_RES : HEIGHTMAP_RES)[quality];
  const bySlot = new Map(
    contracts.filter((c) => c.museum.wing === dimension).map((c) => [c.museum.slot, c]),
  );
  const slots =
    dimension === 'RIFT'
      ? Array.from({ length: RING_SLOTS }, (_, k) => k)
      : Array.from({ length: MUSEUM_GRID.cols * MUSEUM_GRID.rows }, (_, k) => k).filter(
          (k) => k !== OCEAN_SLOT,
        );
  const floating = dimension === 'RIFT';
  const out: HoloSector[] = [];
  for (const slot of slots) {
    const contract = bySlot.get(slot);
    const museum = contract ? sectors[contract.id] : undefined;
    if (!contract || !museum) {
      out.push(plasterSector(dimension, slot, contract, mode));
      continue;
    }
    const { x0, z0 } = wingOrigin(dimension, slot);
    const geo = sculptGeometry(contract, terrainFor(contract), n, x0, z0, mode);
    const featured = featuredId === contract.id;
    // Na Real, o destaque ergue o setor num pedestal; no anel, a ilha já flutua sobre o dele.
    const hover = floating ? FLOAT_Y : featured ? PEDESTAL_Y : 0;
    const p = progress[contract.id];
    const sector: HoloSector = {
      slot,
      wing: dimension,
      contract,
      mapped: true,
      x0,
      z0,
      topY: geo.topY,
      hover,
      floating,
      featured,
      center: [x0 + 0.5, geo.topY + hover, z0 + 0.5],
      corners: cornersOf(x0, z0, geo.topY + hover),
      mesh: geo.mesh,
      buildings: geo.buildings,
      buildingsAlpha: geo.buildingsAlpha,
      overlays: geo.overlays,
      museum,
    };
    if (geo.points) sector.points = geo.points;
    if (floating) {
      sector.rim = rimOf(x0, z0, 0.002, withAlpha(COLORS.rift, 0.95), withAlpha(COLORS.rift, 0.25));
    }
    if (featured) {
      sector.pedestal = pedestalMesh(x0, z0, floating ? 0 : PEDESTAL_Y);
      sector.spot = spotMesh(x0 + 0.5, z0 + 0.5, geo.topY + hover);
    }
    if (p?.bestMissionLines) sector.bestLines = p.bestMissionLines;
    if (p?.bestAircraftId) sector.bestAircraftId = p.bestAircraftId;
    out.push(sector);
  }
  if (floating) {
    // Os dioramas em névoa também têm borda luminosa violeta, sob o cubo.
    for (const s of out) {
      if (!s.mapped) {
        s.rim = rimOf(s.x0, s.z0, 0.002, withAlpha(COLORS.rift, 0.6), withAlpha(COLORS.rift, 0.15));
      }
    }
  }
  const radius = floating ? RING_TABLE_RADIUS : TABLE_RADIUS;
  const { table, rim } = tableMesh(radius, mode, dimension);
  const scene: HoloScene = {
    dimension,
    mode,
    sectors: out,
    table,
    rim,
    radius,
    mappedCount: out.filter((s) => s.mapped).length,
  };
  if (!floating) {
    const { x0, z0 } = slotOrigin(OCEAN_SLOT);
    const ocean: number[] = [];
    const oQuads: number[] = [];
    const oColors: number[] = [];
    boxQuads(
      ocean,
      oQuads,
      oColors,
      { x0, z0, x1: x0 + 1, z1: z0 + 1, y0: 0, y1: BLOCK_Y * 0.6 },
      OCEAN,
      OCEAN,
    );
    scene.ocean = {
      mesh:
        mode === 'NEON'
          ? EMPTY_MESH
          : buildMesh(
              new Float32Array(ocean),
              new Uint32Array(oQuads),
              new Uint8Array(oColors),
              true,
            ),
      x0,
      z0,
    };
  }
  return scene;
}

/**
 * Posição da miniatura sobre as linhas da melhor missão (holo-table §5.4): percorre as
 * linhas em zigue-zague (com as ligações entre elas) num ciclo de `cycleS`.
 */
export function trajectoryAt(
  lines: ReadonlyArray<{ start: AoiPoint; end: AoiPoint }>,
  tS: number,
  cycleS = 12,
): { u: number; v: number; heading: number } {
  const pts: AoiPoint[] = [];
  for (const l of lines) pts.push(l.start, l.end);
  if (pts.length === 0) return { u: 0, v: 0, heading: 0 };
  if (pts.length === 1) return { ...(pts[0] as AoiPoint), heading: 0 };
  const lens: number[] = [];
  let total = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k] as AoiPoint;
    const b = pts[k + 1] as AoiPoint;
    const d = Math.hypot(b.u - a.u, b.v - a.v);
    lens.push(d);
    total += d;
  }
  const f = ((((tS % cycleS) + cycleS) % cycleS) / cycleS) * total;
  let acc = 0;
  for (let k = 0; k < lens.length; k++) {
    const d = lens[k] as number;
    if (acc + d >= f || k === lens.length - 1) {
      const a = pts[k] as AoiPoint;
      const b = pts[k + 1] as AoiPoint;
      const t = d > 0 ? Math.min(1, (f - acc) / d) : 0;
      return {
        u: a.u + (b.u - a.u) * t,
        v: a.v + (b.v - a.v) * t,
        heading: Math.atan2(b.v - a.v, b.u - a.u),
      };
    }
    acc += d;
  }
  return { ...(pts[0] as AoiPoint), heading: 0 };
}
