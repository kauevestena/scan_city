import { CATALOG, getVehicle } from '@/data/catalog';
import { R02 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { RULE_PARAMS } from '@/domain/specialRules';
import { hitsObject, motionOffset } from '@/engines/flight/collision';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  EYE_SPREAD,
  eyeRadius,
  HAZARD_BASE_M,
  HAZARD_COUNT,
  HAZARD_DIAMETER_M,
  HILLS,
  PIPE_COUNT,
  PIPE_DIAMETER_M,
  PIPE_HEIGHT_M,
  PLATFORM_BASE_M,
  PLATFORM_COUNT,
  RIFT_PIPES,
  SUPPORT_POINTS,
} from './riftPipes';

const terrain = createTerrain(R02);
const { lengthM, widthM } = R02.aoi;
const ground = (u: number, v: number) => terrain.elevation(u, v);
const pipes = terrain.objects.filter((o) => o.kind === 'PIPE');
const platforms = terrain.objects.filter((o) => o.kind === 'BRICK_PLATFORM');
const hazards = terrain.objects.filter((o) => o.kind === 'MOVING_HAZARD');

describe('createTerrain — RIFT_PIPES (R02)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_PIPES).toBe(RIFT_PIPES);
    expect(terrain.biome).toBe('RIFT_PIPES');
    expect(terrain.aoi).toEqual({ widthM: 240, lengthM: 300 });
  });

  it('determinismo: mesma seed → mesmos canos, plataformas, cascos e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(R02);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    for (let u = -50; u <= 350; u += 31) {
      for (let v = -40; v <= 280; v += 27) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('relevo suave de uns 20 m, com os morrinhos por cima', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u <= lengthM; u += 3) {
      for (let v = 0; v <= widthM; v += 3) {
        const e = ground(u, v);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    }
    expect(lo).toBeGreaterThanOrEqual(-0.01);
    expect(hi - lo).toBeGreaterThan(R02.terrainReliefM * 0.7);
    expect(hi - lo).toBeLessThan(R02.terrainReliefM * 1.25);
  });

  it('10 morrinhos semiesféricos, cada um com dois olhos pretos no topo', () => {
    expect(HILLS).toHaveLength(10);
    for (const hill of HILLS) {
      // A meia elipsoide é mais alta no centro que na borda e some fora do raio.
      const top = ground(hill.u, hill.v);
      expect(top - ground(hill.u + hill.r + 3, hill.v)).toBeGreaterThan(hill.h * 0.4);
      expect(ground(hill.u + hill.r * 0.5, hill.v)).toBeLessThan(top + 1.5);
      // Dois discos pretos (ROCK) lado a lado, nunca no centro.
      const eye = eyeRadius(hill);
      for (const side of [-1, 1]) {
        const v = hill.v + side * EYE_SPREAD * hill.r;
        expect(terrain.landCover(hill.u, v), `olho ${side}`).toBe('ROCK');
        expect(terrain.landCover(hill.u, v + side * (eye + 1.2))).toBe('GRASS');
      }
      expect(terrain.landCover(hill.u, hill.v)).toBe('GRASS');
    }
    // O resto do campo é só relva (os olhos e as trilhas são as únicas exceções).
    const other = new Set<string>();
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4) other.add(terrain.landCover(u, v));
    }
    expect([...other].every((c) => ['GRASS', 'ROCK', 'ROAD'].includes(c))).toBe(true);
    // Os olhos são pretos na paleta.
    expect(terrain.palette.cover.ROCK.every((c) => c < 40)).toBe(true);
  });

  it('14 canos verdes gigantes de 6–10 m de diâmetro e 15–40 m de altura, separados e longe dos pontos de apoio', () => {
    expect(pipes).toHaveLength(PIPE_COUNT);
    for (const p of pipes) {
      expect(p.widthM).toBeGreaterThanOrEqual(PIPE_DIAMETER_M[0]);
      expect(p.widthM).toBeLessThanOrEqual(PIPE_DIAMETER_M[1]);
      expect(p.depthM).toBe(p.widthM);
      expect(p.heightM).toBeGreaterThanOrEqual(PIPE_HEIGHT_M[0]);
      expect(p.heightM).toBeLessThanOrEqual(PIPE_HEIGHT_M[1]);
      expect(p.solid).toBe(true);
      expect(p.color[1]).toBeGreaterThan(p.color[0]);
      expect(p.color[1]).toBeGreaterThan(p.color[2]);
      expect(p.u).toBeGreaterThan(0);
      expect(p.u).toBeLessThan(lengthM);
      expect(p.v).toBeGreaterThan(0);
      expect(p.v).toBeLessThan(widthM);
      expect(terrain.distanceToTrack(p.u, p.v)).toBeGreaterThan(p.widthM / 2);
      for (const s of SUPPORT_POINTS) {
        expect(Math.hypot(p.u - s.u, p.v - s.v)).toBeGreaterThan(p.widthM / 2 + 8);
      }
    }
    expect(Math.max(...pipes.map((p) => p.heightM))).toBeLessThanOrEqual(40);
    for (let i = 0; i < pipes.length; i++) {
      for (let j = i + 1; j < pipes.length; j++) {
        const a = pipes[i];
        const b = pipes[j];
        if (!a || !b) continue;
        expect(Math.hypot(a.u - b.u, a.v - b.v)).toBeGreaterThan((a.widthM + b.widthM) / 2 + 10);
      }
    }
  });

  it('o cano é um cilindro sólido: toca no tronco, não no ar ao lado nem acima do topo', () => {
    for (const p of pipes) {
      const y0 = ground(p.u, p.v);
      const at = (du: number, alt: number) => ({ u: p.u + du, v: p.v, alt, radiusM: 0.5 });
      expect(hitsObject(at(0, y0 + p.heightM / 2), p, 0, ground)).toBe(true);
      expect(hitsObject(at(p.widthM / 2 - 0.2, y0 + p.heightM / 2), p, 0, ground)).toBe(true);
      expect(hitsObject(at(p.widthM / 2 + 1, y0 + p.heightM / 2), p, 0, ground)).toBe(false);
      expect(hitsObject(at(0, y0 + p.heightM + 1), p, 0, ground)).toBe(false);
    }
  });

  it('10 plataformas de tijolos flutuantes, de 20 a 50 m do chão', () => {
    expect(platforms).toHaveLength(PLATFORM_COUNT);
    for (const p of platforms) {
      expect(p.baseM).toBeGreaterThanOrEqual(PLATFORM_BASE_M[0]);
      expect(p.baseM).toBeLessThanOrEqual(PLATFORM_BASE_M[1]);
      expect(p.heightM).toBe(3);
      expect(p.solid).toBe(true);
      // A laje paira: passa-se por baixo dela, mas não por dentro.
      const y0 = ground(p.u, p.v) + (p.baseM ?? 0);
      expect(hitsObject({ u: p.u, v: p.v, alt: y0 + 1, radiusM: 0.5 }, p, 0, ground)).toBe(true);
      expect(hitsObject({ u: p.u, v: p.v, alt: y0 - 3, radiusM: 0.5 }, p, 0, ground)).toBe(false);
      expect(hitsObject({ u: p.u, v: p.v, alt: y0 + 5, radiusM: 0.5 }, p, 0, ground)).toBe(false);
      // Longe do chão: não cobre os pontos de apoio.
      for (const s of SUPPORT_POINTS) {
        expect(Math.hypot(p.u - s.u, p.v - s.v)).toBeGreaterThan(p.widthM / 2 + 8);
      }
    }
  });

  it('8 cascos flutuantes, verdes e vermelhos, que oscilam de 10 a 25 m em ciclos de 3 a 6 s', () => {
    expect(hazards).toHaveLength(HAZARD_COUNT);
    const { amplitudeM, periodS } = RULE_PARAMS.movingHazards;
    expect(new Set(hazards.map((h) => h.motion?.axis))).toEqual(new Set(['u', 'v', 'h']));
    expect(new Set(hazards.map((h) => h.color.join(','))).size).toBe(2);
    for (const h of hazards) {
      const m = h.motion;
      expect(m).toBeDefined();
      if (!m) continue;
      expect(m.amplitudeM).toBeGreaterThanOrEqual(amplitudeM[0]);
      expect(m.amplitudeM).toBeLessThanOrEqual(amplitudeM[1]);
      expect(m.periodS).toBeGreaterThanOrEqual(periodS[0]);
      expect(m.periodS).toBeLessThanOrEqual(periodS[1]);
      expect(h.widthM).toBe(HAZARD_DIAMETER_M);
      expect(h.solid).toBe(true);
      expect(h.baseM).toBeGreaterThanOrEqual(HAZARD_BASE_M[0] - 1e-9);
      // O vertical não enterra o casco no chão.
      if (m.axis === 'h') expect((h.baseM ?? 0) - m.amplitudeM).toBeGreaterThan(0);
    }
  });

  it('o casco é função pura do tempo: periódico e, no meio do ciclo, noutro lugar', () => {
    for (const h of hazards) {
      const m = h.motion;
      if (!m) continue;
      for (const t of [0, 1.3, 7.1]) {
        const a = motionOffset(h, t);
        const b = motionOffset(h, t + m.periodS);
        expect(b.du).toBeCloseTo(a.du, 9);
        expect(b.dv).toBeCloseTo(a.dv, 9);
        expect(b.dh).toBeCloseTo(a.dh, 9);
      }
      // O casco acompanha o corpo: colide no centro, no instante em que está lá, e não depois.
      const t0 = 1.7;
      const o = motionOffset(h, t0);
      const cy = ground(h.u, h.v) + (h.baseM ?? 0) + h.heightM / 2 + o.dh;
      const hit = (u: number, v: number, alt: number, t: number) =>
        hitsObject({ u, v, alt, radiusM: 0.5 }, h, t, ground);
      expect(hit(h.u + o.du, h.v + o.dv, cy, t0)).toBe(true);
      // Um quarto de ciclo depois, ele já saiu de onde estava (a amplitude passa de 10 m).
      const later = t0 + m.periodS / 4;
      const moved = motionOffset(h, later);
      const shift = Math.hypot(moved.du - o.du, moved.dv - o.dv, moved.dh - o.dh);
      if (shift > HAZARD_DIAMETER_M + 1) {
        expect(hit(h.u + o.du, h.v + o.dv, cy, later)).toBe(false);
      }
    }
  });

  it('o plano de referência (H = 100 m) passa por cima de tudo: canos, lajes e cascos ficam abaixo', () => {
    const planAlt = meanAoiElevation(terrain) + R02.referencePlan.heightM;
    for (const p of pipes) {
      expect(ground(p.u, p.v) + p.heightM).toBeLessThan(planAlt - 20);
    }
    for (const p of platforms) {
      expect(ground(p.u, p.v) + (p.baseM ?? 0) + p.heightM).toBeLessThan(planAlt - 20);
    }
    for (const h of hazards) {
      const rise = h.motion?.axis === 'h' ? (h.motion?.amplitudeM ?? 0) : 0;
      const top = ground(h.u, h.v) + (h.baseM ?? 0) + h.heightM + rise;
      expect(top).toBeLessThan(planAlt - 8);
    }
  });

  it('a pé ou de bicicleta: os pontos de apoio do plano são acessíveis e as trilhas chegam a ≤ 80 m de tudo', () => {
    const foot = getVehicle('FOOT_BIKE');
    expect(terrain.guaranteedAccessible).toEqual(SUPPORT_POINTS.map((p) => ({ u: p.u, v: p.v })));
    for (const p of terrain.guaranteedAccessible) {
      expect(
        isAccessible(p.u, p.v, terrain, [foot], { paintMarkers: false }),
        `${p.u},${p.v}`,
      ).toEqual({ ok: true });
    }
    const ref = R02.referencePlan;
    const support = new Set([...ref.gcps, ...ref.cps].map((p) => `${p.u},${p.v}`));
    expect(SUPPORT_POINTS.map((p) => `${p.u},${p.v}`).sort()).toEqual([...support].sort());
    let farthest = 0;
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4)
        farthest = Math.max(farthest, terrain.distanceToTrack(u, v));
    }
    expect(farthest).toBeLessThanOrEqual(80);
  });

  it('o plano de referência do R02 tem a geometria da spec (7 linhas) sobre a AOI de 240 × 300 m', () => {
    const plan = buildFlightPlan(referenceParams(R02), R02, CATALOG);
    expect(plan.stats.nLines).toBe(7);
  });
});
