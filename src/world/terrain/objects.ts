/** Objetos do mundo: auxiliares de posicionamento e de superfície (terrain §4). */
import type { Rgb, WorldObject, WorldObjectKind } from '@/types';

/** Gera ids sequenciais de objetos dentro de um terreno. */
export function objectIdFactory(): () => number {
  let next = 1;
  return () => next++;
}

/** Ponto (u, v) dentro da caixa (rotacionada) do objeto no plano? */
export function insideFootprint(o: WorldObject, u: number, v: number): boolean {
  const rot = o.rotationRad ?? 0;
  const du = u - o.u;
  const dv = v - o.v;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const lu = du * cos - dv * sin;
  const lv = du * sin + dv * cos;
  return Math.abs(lu) <= o.widthM / 2 && Math.abs(lv) <= o.depthM / 2;
}

/** Objetos que formam superfície (MDS) e telhado. */
const BOX_KINDS: ReadonlySet<WorldObjectKind> = new Set([
  'BUILDING',
  'CUBE_BLOCK',
  'BRICK_PLATFORM',
  'TOWER',
  'CLIFF_TEMPLE',
  'GIANT_WALKER',
  'PIPE',
]);

export function isBoxLike(o: WorldObject): boolean {
  return BOX_KINDS.has(o.kind);
}

/** Altura do topo do objeto sobre o ponto, acima do solo; `null` se o ponto não está sob ele. */
export function objectTopAt(o: WorldObject, u: number, v: number): number | null {
  if (o.kind === 'TREE') {
    const r = o.widthM / 2;
    const d = Math.hypot(u - o.u, v - o.v);
    if (d > r) return null;
    // Copa arredondada: mais alta no centro.
    return (o.baseM ?? 0) + o.heightM * (0.75 + 0.25 * Math.sqrt(1 - (d / r) ** 2));
  }
  if (isBoxLike(o) && insideFootprint(o, u, v)) return (o.baseM ?? 0) + o.heightM;
  return null;
}

export interface ObjectSpec {
  kind: WorldObjectKind;
  u: number;
  v: number;
  widthM: number;
  depthM: number;
  heightM: number;
  color: Rgb;
  solid?: boolean;
  rotationRad?: number;
  baseM?: number;
}

/** Monta um `WorldObject` com id novo; `solid` padrão verdadeiro. */
export function makeObject(nextId: () => number, spec: ObjectSpec): WorldObject {
  const o: WorldObject = {
    id: nextId(),
    kind: spec.kind,
    u: spec.u,
    v: spec.v,
    widthM: spec.widthM,
    depthM: spec.depthM,
    heightM: spec.heightM,
    color: spec.color,
    solid: spec.solid ?? true,
  };
  if (spec.rotationRad !== undefined) o.rotationRad = spec.rotationRad;
  if (spec.baseM !== undefined) o.baseM = spec.baseM;
  return o;
}
