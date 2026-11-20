/**
 * Colisão da aeronave com os objetos (terrain §4, survey-flight §5.11). Puro: o terreno
 * entra por `groundAt` e o estado dos móveis e dos feixes é função do tempo `t`.
 */
import type { WorldObject } from '@/types';

export const TRUNK_RADIUS_M = 0.6;
export const POLE_RADIUS_M = 0.3;
export const WIRE_RADIUS_M = 0.5;
/** Proporção da largura do arco ocupada por cada coluna; a viga tem 20 % da altura. */
const ARCH_COLUMN_FRACTION = 0.2;
const ARCH_BEAM_FRACTION = 0.2;

export interface AircraftBody {
  u: number;
  v: number;
  /** Altitude absoluta (m). */
  alt: number;
  radiusM: number;
}

export type GroundAt = (u: number, v: number) => number;

/** Feixe ligado em `t`: `(t + fase) mod (on + off) < on`. */
export function isBeamOn(o: Pick<WorldObject, 'activePeriod'>, t: number): boolean {
  const p = o.activePeriod;
  if (!p) return true;
  const cycle = p.onS + p.offS;
  return (((t + p.phase) % cycle) + cycle) % cycle < p.onS;
}

/** Deslocamento senoidal de um objeto móvel em `t`: `amplitude · sin(2π t / período + fase)`. */
export function motionOffset(
  o: Pick<WorldObject, 'motion'>,
  t: number,
): { du: number; dv: number; dh: number } {
  const m = o.motion;
  if (!m) return { du: 0, dv: 0, dh: 0 };
  const d = m.amplitudeM * Math.sin((2 * Math.PI * t) / m.periodS + m.phase);
  return { du: m.axis === 'u' ? d : 0, dv: m.axis === 'v' ? d : 0, dh: m.axis === 'h' ? d : 0 };
}

/** Ponto no frame local do objeto (centro da base, girado por `rotationRad`). */
function toLocal(o: WorldObject, u: number, v: number): { x: number; y: number } {
  const c = Math.cos(-(o.rotationRad ?? 0));
  const s = Math.sin(-(o.rotationRad ?? 0));
  const du = u - o.u;
  const dv = v - o.v;
  return { x: du * c - dv * s, y: du * s + dv * c };
}

function inBox(
  lx: number,
  ly: number,
  alt: number,
  r: number,
  b: { cx: number; cy: number; hw: number; hd: number; y0: number; y1: number },
): boolean {
  return (
    Math.abs(lx - b.cx) <= b.hw + r &&
    Math.abs(ly - b.cy) <= b.hd + r &&
    alt >= b.y0 - r &&
    alt <= b.y1 + r
  );
}

/** Distância do ponto `p` ao segmento `a`–`b` (3D). */
export function distanceToSegment(
  p: [number, number, number],
  a: [number, number, number],
  b: [number, number, number],
): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const len2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, (ap[0]! * ab[0]! + ap[1]! * ab[1]! + ap[2]! * ab[2]!) / len2));
  return Math.hypot(ap[0]! - ab[0]! * t, ap[1]! - ab[1]! * t, ap[2]! - ab[2]! * t);
}

/** O corpo toca este objeto em `t`? */
export function hitsObject(
  body: AircraftBody,
  o: WorldObject,
  t: number,
  groundAt: GroundAt,
): boolean {
  if (!o.solid) return false;
  const r = body.radiusM;
  const { alt } = body;
  switch (o.kind) {
    case 'RING':
    case 'SEARCHLIGHT':
    case 'GCP_TARGET':
      return false;
    case 'BUILDING':
    case 'CUBE_BLOCK':
    case 'BRICK_PLATFORM':
    case 'TOWER':
    case 'CLIFF_TEMPLE':
    case 'GIANT_WALKER': {
      const y0 = groundAt(o.u, o.v) + (o.baseM ?? 0);
      const l = toLocal(o, body.u, body.v);
      return inBox(l.x, l.y, alt, r, {
        cx: 0,
        cy: 0,
        hw: o.widthM / 2,
        hd: o.depthM / 2,
        y0,
        y1: y0 + o.heightM,
      });
    }
    case 'TREE': {
      const ground = groundAt(o.u, o.v);
      const horizontal = Math.hypot(body.u - o.u, body.v - o.v);
      // Copa: esfera de raio largura/2 no topo; tronco: cilindro até a base da copa.
      const crownR = o.widthM / 2;
      const crownY = ground + Math.max(crownR, o.heightM - crownR);
      if (Math.hypot(horizontal, alt - crownY) <= crownR + r) return true;
      return horizontal <= TRUNK_RADIUS_M + r && alt >= ground - r && alt <= crownY;
    }
    case 'PIPE':
    case 'POLE': {
      const ground = groundAt(o.u, o.v);
      const radius = o.kind === 'POLE' ? POLE_RADIUS_M : o.widthM / 2;
      const y0 = ground + (o.baseM ?? 0);
      return (
        Math.hypot(body.u - o.u, body.v - o.v) <= radius + r &&
        alt >= y0 - r &&
        alt <= y0 + o.heightM + r
      );
    }
    case 'WIRE': {
      const u2 = o.u2 ?? o.u;
      const v2 = o.v2 ?? o.v;
      const h = o.baseM ?? o.heightM;
      const a: [number, number, number] = [o.u, groundAt(o.u, o.v) + h, o.v];
      const b: [number, number, number] = [u2, groundAt(u2, v2) + h, v2];
      return distanceToSegment([body.u, alt, body.v], a, b) <= WIRE_RADIUS_M + r;
    }
    case 'STONE_ARCH': {
      const y0 = groundAt(o.u, o.v) + (o.baseM ?? 0);
      const l = toLocal(o, body.u, body.v);
      const col = o.widthM * ARCH_COLUMN_FRACTION;
      const beam = o.heightM * ARCH_BEAM_FRACTION;
      const half = o.widthM / 2;
      const hd = o.depthM / 2;
      // O vão entre as colunas, abaixo da viga, é livre.
      return (
        inBox(l.x, l.y, alt, r, {
          cx: -(half - col / 2),
          cy: 0,
          hw: col / 2,
          hd,
          y0,
          y1: y0 + o.heightM,
        }) ||
        inBox(l.x, l.y, alt, r, {
          cx: half - col / 2,
          cy: 0,
          hw: col / 2,
          hd,
          y0,
          y1: y0 + o.heightM,
        }) ||
        inBox(l.x, l.y, alt, r, {
          cx: 0,
          cy: 0,
          hw: half,
          hd,
          y0: y0 + o.heightM - beam,
          y1: y0 + o.heightM,
        })
      );
    }
    case 'ENERGY_BEAM': {
      if (!isBeamOn(o, t)) return false;
      const y0 = groundAt(o.u, o.v) + (o.baseM ?? 0);
      return (
        Math.hypot(body.u - o.u, body.v - o.v) <= o.widthM / 2 + r &&
        alt >= y0 - r &&
        alt <= y0 + o.heightM + r
      );
    }
    case 'MOVING_HAZARD': {
      const m = motionOffset(o, t);
      const cy = groundAt(o.u, o.v) + (o.baseM ?? 0) + o.heightM / 2 + m.dh;
      return Math.hypot(body.u - (o.u + m.du), body.v - (o.v + m.dv), alt - cy) <= o.widthM / 2 + r;
    }
    default:
      return false;
  }
}

/**
 * Teste barato, só no plano: o corpo pode tocar o objeto? Descarta os objetos longe antes de
 * `hitsObject`, que consulta a elevação do terreno (cara). Nunca descarta um que toque: o
 * raio usado envolve a forma inteira em qualquer rotação.
 */
export function mayTouch(body: AircraftBody, o: WorldObject): boolean {
  if (!o.solid) return false;
  const r = body.radiusM;
  switch (o.kind) {
    case 'WIRE': {
      const u2 = o.u2 ?? o.u;
      const v2 = o.v2 ?? o.v;
      const du = u2 - o.u;
      const dv = v2 - o.v;
      const len2 = du * du + dv * dv;
      const k =
        len2 === 0
          ? 0
          : Math.max(0, Math.min(1, ((body.u - o.u) * du + (body.v - o.v) * dv) / len2));
      return Math.hypot(body.u - (o.u + du * k), body.v - (o.v + dv * k)) <= WIRE_RADIUS_M + r;
    }
    case 'MOVING_HAZARD': {
      const amplitude = o.motion?.amplitudeM ?? 0;
      return Math.hypot(body.u - o.u, body.v - o.v) <= amplitude + o.widthM / 2 + r;
    }
    case 'TREE':
      return Math.hypot(body.u - o.u, body.v - o.v) <= Math.max(o.widthM / 2, TRUNK_RADIUS_M) + r;
    case 'POLE':
      return Math.hypot(body.u - o.u, body.v - o.v) <= POLE_RADIUS_M + r;
    default:
      // Caixas (e arcos, cilindros e feixes, que cabem nelas): a colisão exata expande o
      // retângulo pelo raio em cada eixo, então o canto vai até hypot(w/2 + r, d/2 + r).
      return (
        Math.hypot(body.u - o.u, body.v - o.v) <= Math.hypot(o.widthM / 2 + r, o.depthM / 2 + r)
      );
  }
}

/** Primeiro objeto sólido tocado em `t`, ou `null`. */
export function checkCollision(
  body: AircraftBody,
  objects: readonly WorldObject[],
  t: number,
  groundAt: GroundAt,
): WorldObject | null {
  for (const o of objects) if (mayTouch(body, o) && hitsObject(body, o, t, groundAt)) return o;
  return null;
}

/** Queda no terreno (survey-flight §5.11): `alt < elevation + radius`. */
export function hitsTerrain(body: AircraftBody, groundAt: GroundAt): boolean {
  return body.alt < groundAt(body.u, body.v) + body.radiusM;
}
