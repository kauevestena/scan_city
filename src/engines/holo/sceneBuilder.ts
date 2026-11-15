/**
 * Cena da Mesa Holográfica (holo-table §5.2): grade 4 × 2 de setores de 1 × 1 unidade
 * (espaço de 0,05) sobre a mesa; setores mapeados com o relevo do contrato e prédios,
 * os demais em gesso com wireframe e "?". Puro: o terreno vem por parâmetro.
 */
import { CONTRACTS } from '@/data/contracts';
import { MUSEUM_GRID, museumSlotCoords } from '@/data/contracts/museum';
import type { AoiPoint, Contract, ContractProgress, MuseumSector, WorldObjectKind } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';
import { buildMesh, type LineSet, type Mesh } from '../soft3d/Renderer';
import type { Vec3 } from '../soft3d/vec3';

export type HoloQuality = 'LOW' | 'MEDIUM' | 'HIGH';
export const HEIGHTMAP_RES: Readonly<Record<HoloQuality, number>> = {
  HIGH: 32,
  MEDIUM: 24,
  LOW: 16,
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

const PLASTER: [number, number, number] = [148, 163, 184];
const OCEAN: [number, number, number] = [37, 99, 160];
const GLASS: [number, number, number] = [15, 23, 42];
const BUILDING_KINDS: ReadonlySet<WorldObjectKind> = new Set([
  'BUILDING',
  'TOWER',
  'PIPE',
  'CLIFF_TEMPLE',
]);

export interface HoloSector {
  slot: number;
  /** Contrato do setor (se existir no catálogo). */
  contract?: Contract;
  mapped: boolean;
  x0: number;
  z0: number;
  /** Altura máxima do topo (base + relevo). */
  topY: number;
  center: Vec3;
  /** Cantos do topo, para o picking. */
  corners: Vec3[];
  mesh: Mesh;
  buildings?: Mesh;
  wire?: LineSet;
  bestLines?: ReadonlyArray<{ start: AoiPoint; end: AoiPoint }>;
  bestAircraftId?: string;
  museum?: MuseumSector;
}

export interface HoloScene {
  sectors: HoloSector[];
  ocean: { mesh: Mesh; x0: number; z0: number };
  table: Mesh;
  rim: LineSet;
  radius: number;
  mappedCount: number;
}

/** Canto (x0, z0) do slot na grade centrada na origem. */
export function slotOrigin(slot: number): { x0: number; z0: number } {
  const { col, lin } = museumSlotCoords(slot);
  const step = 1 + SECTOR_GAP;
  return {
    x0: (col - MUSEUM_GRID.cols / 2) * step + SECTOR_GAP / 2,
    z0: (lin - MUSEUM_GRID.rows / 2) * step + SECTOR_GAP / 2,
  };
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

function plasterSector(slot: number, contract: Contract | undefined): HoloSector {
  const { x0, z0 } = slotOrigin(slot);
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
  // Wireframe 8 × 8 sobre o topo.
  const wp: number[] = [];
  const seg: number[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const i = wp.length / 3;
    wp.push(
      x0 + t,
      BLOCK_Y + 0.001,
      z0,
      x0 + t,
      BLOCK_Y + 0.001,
      z0 + 1,
      x0,
      BLOCK_Y + 0.001,
      z0 + t,
      x0 + 1,
      BLOCK_Y + 0.001,
      z0 + t,
    );
    seg.push(i, i + 1, i + 2, i + 3);
  }
  const sector: HoloSector = {
    slot,
    mapped: false,
    x0,
    z0,
    topY: BLOCK_Y,
    center: [x0 + 0.5, BLOCK_Y, z0 + 0.5],
    corners: [
      [x0, BLOCK_Y, z0],
      [x0, BLOCK_Y, z0 + 1],
      [x0 + 1, BLOCK_Y, z0 + 1],
      [x0 + 1, BLOCK_Y, z0],
    ],
    mesh: buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors), true),
    wire: {
      positions: new Float32Array(wp),
      segments: new Uint32Array(seg),
      color: 'rgba(14, 116, 144, 0.9)',
      width: 1,
    },
  };
  if (contract) sector.contract = contract;
  return sector;
}

const geometryCache = new Map<string, { mesh: Mesh; buildings: Mesh; topY: number }>();

/** Relevo esculpido do setor: heightmap n × n do terreno do contrato, com saias e prédios. */
export function sculptGeometry(
  contract: Contract,
  terrain: TerrainSampler,
  n: number,
  x0: number,
  z0: number,
): { mesh: Mesh; buildings: Mesh; topY: number } {
  const key = `${contract.id}:${n}`;
  const hit = geometryCache.get(key);
  if (hit) return hit;
  const { lengthM, widthM } = contract.aoi;
  const elev: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const e = terrain.elevation((i / n) * lengthM, (j / n) * widthM);
      elev.push(e);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
    }
  }
  const relief = Math.max(1e-6, hi - lo);
  const yOf = (e: number) => BLOCK_Y + (RELIEF_UNITS * (e - lo)) / relief;
  const pos: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++)
      pos.push(x0 + i / n, yOf(elev[j * (n + 1) + i] as number), z0 + j / n);
  }
  const quads: number[] = [];
  const colors: number[] = [];
  const at = (i: number, j: number) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      quads.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
      const cover = terrain.landCover(((i + 0.5) / n) * lengthM, ((j + 0.5) / n) * widthM);
      colors.push(...(cover === 'WATER' ? terrain.palette.water : terrain.palette.cover[cover]));
    }
  }
  // Saias: ligam a borda do relevo à base (y = 0).
  const skirt = (a: number, b: number) => {
    const v = pos.length / 3;
    const pa = [pos[a * 3] as number, pos[a * 3 + 2] as number];
    const pb = [pos[b * 3] as number, pos[b * 3 + 2] as number];
    pos.push(pa[0] as number, 0, pa[1] as number, pb[0] as number, 0, pb[1] as number);
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
  const mesh = buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors));

  // Prédios: os maiores, extrudados na mesma escala vertical (no máximo 0,5).
  const bPos: number[] = [];
  const bQuads: number[] = [];
  const bColors: number[] = [];
  const roof = terrain.palette.cover.ROOF;
  const objs = terrain.objects
    .filter(
      (o) => BUILDING_KINDS.has(o.kind) && o.u >= 0 && o.u <= lengthM && o.v >= 0 && o.v <= widthM,
    )
    .sort((a, b) => b.widthM * b.depthM * b.heightM - a.widthM * a.depthM * a.heightM)
    .slice(0, MAX_BUILDINGS);
  for (const o of objs) {
    const base = yOf(terrain.elevation(o.u, o.v));
    const h = Math.min(0.5, (RELIEF_UNITS * o.heightM) / Math.max(relief, 10));
    const hw = o.widthM / lengthM / 2;
    const hd = o.depthM / widthM / 2;
    const cx = x0 + o.u / lengthM;
    const cz = z0 + o.v / widthM;
    boxQuads(
      bPos,
      bQuads,
      bColors,
      { x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd, y0: base, y1: base + h },
      [210, 214, 220],
      roof,
    );
  }
  const buildings = buildMesh(
    new Float32Array(bPos),
    new Uint32Array(bQuads),
    new Uint8Array(bColors),
  );
  const out = { mesh, buildings, topY: yOf(hi) };
  geometryCache.set(key, out);
  return out;
}

export function clearHoloCache(): void {
  geometryCache.clear();
}

function tableMesh(radius: number): { table: Mesh; rim: LineSet } {
  const seg = 48;
  const pos: number[] = [0, -0.02, 0];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    pos.push(radius * Math.cos(a), -0.02, radius * Math.sin(a));
  }
  const quads: number[] = [];
  const colors: number[] = [];
  for (let k = 0; k < seg; k++) {
    // Leque de quads degenerados (centro repetido) com normal para cima.
    quads.push(0, k + 2, k + 1, 0);
    colors.push(...GLASS);
  }
  const rimPos: number[] = [];
  const rimSeg: number[] = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    rimPos.push(radius * Math.cos(a), -0.01, radius * Math.sin(a));
    rimSeg.push(k, (k + 1) % seg);
  }
  return {
    table: buildMesh(new Float32Array(pos), new Uint32Array(quads), new Uint8Array(colors), true),
    rim: {
      positions: new Float32Array(rimPos),
      segments: new Uint32Array(rimSeg),
      color: 'rgba(34, 211, 238, 0.9)',
      width: 2,
      glow: 'rgba(34, 211, 238, 0.15)',
    },
  };
}

/** Cena da ala Real: 7 setores (mapeados ou em gesso) e o oceano decorativo. */
export function buildHoloScene(
  sectors: Readonly<Record<string, MuseumSector>>,
  progress: Readonly<Record<string, ContractProgress>>,
  quality: HoloQuality,
  terrainFor: (contract: Contract) => TerrainSampler,
  contracts: readonly Contract[] = CONTRACTS,
): HoloScene {
  const n = HEIGHTMAP_RES[quality];
  const bySlot = new Map(
    contracts.filter((c) => c.museum.wing === 'REAL').map((c) => [c.museum.slot, c]),
  );
  const out: HoloSector[] = [];
  for (let slot = 0; slot < MUSEUM_GRID.cols * MUSEUM_GRID.rows; slot++) {
    if (slot === OCEAN_SLOT) continue;
    const contract = bySlot.get(slot);
    const museum = contract ? sectors[contract.id] : undefined;
    if (!contract || !museum) {
      out.push(plasterSector(slot, contract));
      continue;
    }
    const { x0, z0 } = slotOrigin(slot);
    const geo = sculptGeometry(contract, terrainFor(contract), n, x0, z0);
    const p = progress[contract.id];
    const sector: HoloSector = {
      slot,
      contract,
      mapped: true,
      x0,
      z0,
      topY: geo.topY,
      center: [x0 + 0.5, geo.topY, z0 + 0.5],
      corners: [
        [x0, geo.topY, z0],
        [x0, geo.topY, z0 + 1],
        [x0 + 1, geo.topY, z0 + 1],
        [x0 + 1, geo.topY, z0],
      ],
      mesh: geo.mesh,
      buildings: geo.buildings,
      museum,
    };
    if (p?.bestMissionLines) sector.bestLines = p.bestMissionLines;
    if (p?.bestAircraftId) sector.bestAircraftId = p.bestAircraftId;
    out.push(sector);
  }
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
  const { table, rim } = tableMesh(TABLE_RADIUS);
  return {
    sectors: out,
    ocean: {
      mesh: buildMesh(
        new Float32Array(ocean),
        new Uint32Array(oQuads),
        new Uint8Array(oColors),
        true,
      ),
      x0,
      z0,
    },
    table,
    rim,
    radius: TABLE_RADIUS,
    mappedCount: out.filter((s) => s.mapped).length,
  };
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
