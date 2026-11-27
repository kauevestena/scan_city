/**
 * Geradores genéricos das regras especiais (contracts-real §1), para as receitas de bioma:
 * zonas de cânion RTK, térmicas de lava, perfil da trincheira e postes com fios baixos.
 * Puros e determinísticos (o RNG vem do chamador).
 */
import { RULE_PARAMS } from '@/domain/specialRules';
import type { Rng } from '@/lib/rng';
import type { AoiPoint, Rgb, SpecialZone, WorldObject } from '@/types';
import { makeObject } from './objects';

type Canyon = Extract<SpecialZone, { kind: 'RTK_CANYON' }>;

/** Meia-extensão conservadora de um prédio (ignora a rotação). */
const halfExtent = (o: WorldObject): number => Math.max(o.widthM, o.depthM) / 2;

/**
 * `URBAN_CANYON_RTK_LOSS`: uma zona `RTK_CANYON` onde dois prédios mais altos que 45 m ficam a
 * menos de 40 m um do outro. A zona é a caixa que cobre as duas pegadas.
 */
export function rtkCanyonZones(
  objects: readonly WorldObject[],
  params: { minBuildingHeightM: number; maxGapM: number } = RULE_PARAMS.rtkCanyon,
): Canyon[] {
  const tall = objects
    .filter((o) => o.kind === 'BUILDING' && o.heightM + (o.baseM ?? 0) > params.minBuildingHeightM)
    .sort((a, b) => a.u - b.u || a.v - b.v);
  const maxHalf = tall.reduce((m, o) => Math.max(m, halfExtent(o)), 0);
  const zones: Canyon[] = [];
  for (let i = 0; i < tall.length; i++) {
    const a = tall[i] as WorldObject;
    for (let j = i + 1; j < tall.length; j++) {
      const b = tall[j] as WorldObject;
      // Ordenados por `u`: daqui em diante só se afastam.
      if (b.u - a.u - 2 * maxHalf >= params.maxGapM) break;
      const ha = halfExtent(a);
      const hb = halfExtent(b);
      const gap = Math.hypot(
        Math.max(0, Math.abs(a.u - b.u) - (ha + hb)),
        Math.max(0, Math.abs(a.v - b.v) - (ha + hb)),
      );
      if (gap >= params.maxGapM) continue;
      zones.push({
        kind: 'RTK_CANYON',
        uMin: Math.min(a.u - ha, b.u - hb),
        uMax: Math.max(a.u + ha, b.u + hb),
        vMin: Math.min(a.v - ha, b.v - hb),
        vMax: Math.max(a.v + ha, b.v + hb),
      });
    }
  }
  return zones;
}

/**
 * `LAVA_THERMALS`: uma térmica (6 m/s, r = 40 m) por aglomerado de células de lava; as células
 * da mesma "casa" de 40 m dividem a térmica, posta no centroide.
 */
export function lavaThermalZones(
  lavaCells: readonly AoiPoint[],
  params: { liftMs: number; radiusM: number } = RULE_PARAMS.lava,
): SpecialZone[] {
  const bins = new Map<string, { u: number; v: number; n: number }>();
  for (const c of lavaCells) {
    const key = `${Math.floor(c.u / params.radiusM)}:${Math.floor(c.v / params.radiusM)}`;
    const bin = bins.get(key) ?? { u: 0, v: 0, n: 0 };
    bin.u += c.u;
    bin.v += c.v;
    bin.n++;
    bins.set(key, bin);
  }
  return [...bins.values()].map((b) => ({
    kind: 'THERMAL',
    u: b.u / b.n,
    v: b.v / b.n,
    radiusM: params.radiusM,
    liftMs: params.liftMs,
  }));
}

/** `NARROW_TRENCH`: −profundidade dentro da faixa de largura 50 m em torno de `centerV`. */
export function trenchElevation(
  v: number,
  centerV: number,
  params: { widthM: number; depthM: number } = RULE_PARAMS.trench,
): number {
  return Math.abs(v - centerV) < params.widthM / 2 ? -params.depthM : 0;
}

const POLE_COLOR: Rgb = [70, 70, 78];
const WIRE_COLOR: Rgb = [20, 20, 24];

/**
 * `LOW_WIRES`: postes a cada 30–40 m ao longo de uma polilinha, com um fio entre cada par, a
 * 8–14 m de altura (sorteada por trecho). O poste passa 1,5 m do fio mais alto que prende.
 */
export function lowWireLine(
  line: readonly AoiPoint[],
  rng: Rng,
  nextId: () => number,
  params: {
    poleSpacingM: readonly [number, number];
    wireHeightM: readonly [number, number];
  } = RULE_PARAMS.lowWires,
): { poles: WorldObject[]; wires: WorldObject[] } {
  // Pontos dos postes ao longo da polilinha.
  const stops: AoiPoint[] = line.length > 0 ? [line[0] as AoiPoint] : [];
  let toNext = rng.range(...params.poleSpacingM);
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as AoiPoint;
    const b = line[i] as AoiPoint;
    const len = Math.hypot(b.u - a.u, b.v - a.v);
    let at = 0;
    while (len - at >= toNext) {
      at += toNext;
      const t = at / len;
      stops.push({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t });
      toNext = rng.range(...params.poleSpacingM);
    }
    toNext -= len - at;
  }
  const heights: number[] = [];
  const wires: WorldObject[] = [];
  for (let k = 1; k < stops.length; k++) {
    const a = stops[k - 1] as AoiPoint;
    const b = stops[k] as AoiPoint;
    const h = rng.range(...params.wireHeightM);
    heights.push(h);
    wires.push(
      makeObject(nextId, {
        kind: 'WIRE',
        u: a.u,
        v: a.v,
        u2: b.u,
        v2: b.v,
        widthM: 0.1,
        depthM: Math.hypot(b.u - a.u, b.v - a.v),
        heightM: h,
        baseM: h,
        color: WIRE_COLOR,
      }),
    );
  }
  const poles = stops.map((p, k) => {
    const top = Math.max(heights[k - 1] ?? 0, heights[k] ?? 0) + 1.5;
    return makeObject(nextId, {
      kind: 'POLE',
      u: p.u,
      v: p.v,
      widthM: 0.6,
      depthM: 0.6,
      heightM: top,
      color: POLE_COLOR,
    });
  });
  return { poles, wires };
}
