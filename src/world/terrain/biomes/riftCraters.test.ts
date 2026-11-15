import { CATALOG, getVehicle } from '@/data/catalog';
import { R03 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { resolveRuleEffects, RULE_PARAMS } from '@/domain/specialRules';
import { hitsObject, isBeamOn } from '@/engines/flight/collision';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import type { LandCover } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { createNoiseKit, type NoiseKit } from '../noise';
import { BIOMES } from './index';
import {
  BEAM,
  BEAM_CRATERS,
  CRATER_DEPTH_FACTOR,
  CRATERS,
  craterAt,
  craterDepthM,
  craterVolumeM3,
  FLOATING_ROCKS,
  GCP_PADS,
  PAD_FLAT_M,
  PAD_RAMP_M,
  RELIEF_M,
  RIFT_CRATERS,
  ROCK_BASE_M,
  ROCK_HEIGHT_M,
  ROCK_SIZE_M,
  SAND_BELOW_M,
  TRAIL_WIDTH_M,
  trailNorthV,
  trailSouthV,
} from './riftCraters';

const terrain = createTerrain(R03);
const { lengthM, widthM } = R03.aoi;
const beams = terrain.objects.filter((o) => o.kind === 'ENERGY_BEAM');
const rocks = terrain.objects.filter((o) => o.kind === 'BRICK_PLATFORM');
const ground = (u: number, v: number) => terrain.elevation(u, v);

/** Ruído de cristas zerado: o planalto some e só sobram as crateras (e os patamares, a 0 m). */
const flat = { ...createNoiseKit(R03.seed), ridged: () => 0 } as NoiseKit;
const bare = (u: number, v: number) => RIFT_CRATERS.baseElevation(u, v, flat);

/** Alívio da AOI e declive máximo (graus, diferenças centrais de 2 m). */
function survey(step = 2) {
  let lo = Infinity;
  let hi = -Infinity;
  let maxSlope = 0;
  const covers: Partial<Record<LandCover, number>> = {};
  let n = 0;
  for (let u = 0; u <= lengthM; u += step) {
    for (let v = 0; v <= widthM; v += step) {
      const e = ground(u, v);
      lo = Math.min(lo, e);
      hi = Math.max(hi, e);
      const gx = (ground(u + 1, v) - ground(u - 1, v)) / 2;
      const gy = (ground(u, v + 1) - ground(u, v - 1)) / 2;
      maxSlope = Math.max(maxSlope, (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI);
      const c = terrain.landCover(u, v);
      covers[c] = (covers[c] ?? 0) + 1;
      n++;
    }
  }
  return { lo, hi, maxSlope, covers, n };
}
const stats = survey();

describe('createTerrain — RIFT_CRATERS (R03)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_CRATERS).toBe(RIFT_CRATERS);
    expect(terrain.biome).toBe('RIFT_CRATERS');
    expect(terrain.aoi).toEqual({ widthM: 300, lengthM: 400 });
  });

  it('determinismo: mesma seed → mesmos objetos, trilhas e amostras de cota e cobertura', () => {
    clearTerrainCache();
    const again = createTerrain(R03);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    for (let u = -60; u <= 460; u += 37) {
      for (let v = -40; v <= 340; v += 29) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('STEEP_RELIEF: alívio de 60 m ou mais e declive máximo entre 35° e 70°', () => {
    const effects = resolveRuleEffects(R03.specialRules);
    expect(effects.terrain.steepRelief).toMatchObject({ minReliefM: 60, slopeDeg: [35, 70] });
    expect(RELIEF_M).toBe(R03.terrainReliefM);
    // O planalto sobe a 60 m e as crateras fundas, em baixadas, afundam o chão abaixo de zero.
    expect(stats.hi).toBeGreaterThan(RELIEF_M - 1);
    expect(stats.hi).toBeLessThanOrEqual(RELIEF_M + 0.01);
    expect(stats.hi - stats.lo).toBeGreaterThanOrEqual(
      effects.terrain.steepRelief?.minReliefM ?? 0,
    );
    expect(stats.maxSlope).toBeGreaterThanOrEqual(35);
    expect(stats.maxSlope).toBeLessThanOrEqual(70);
  });

  it('em altitude constante o AGL varia mais de 100 m: a ficha pede Terrain Following', () => {
    const plan = buildFlightPlan(referenceParams(R03), R03, CATALOG);
    expect(plan.params.terrainFollowing).toBe(true);
    const alt = meanAoiElevation(terrain) + R03.referencePlan.heightM;
    expect(alt - stats.hi).toBeGreaterThan(30);
    expect(alt - stats.lo).toBeGreaterThan(R03.referencePlan.heightM * 1.5);
    expect(stats.hi - stats.lo).toBeGreaterThan(100 - 30);
  });
});

describe('RIFT_CRATERS: as crateras', () => {
  it('8 crateras de 15 a 45 m de raio, dentro da AOI, afastadas entre si e dos patamares dos GCPs', () => {
    expect(CRATERS).toHaveLength(8);
    expect(CRATERS.length).toBeGreaterThanOrEqual(6);
    expect(CRATERS.length).toBeLessThanOrEqual(10);
    const radii = CRATERS.map((c) => c.r);
    expect(Math.min(...radii)).toBe(15);
    expect(Math.max(...radii)).toBe(45);
    for (const c of CRATERS) {
      expect(c.u - c.r).toBeGreaterThanOrEqual(0);
      expect(c.u + c.r).toBeLessThanOrEqual(lengthM);
      expect(c.v - c.r).toBeGreaterThanOrEqual(0);
      expect(c.v + c.r).toBeLessThanOrEqual(widthM);
      // Nenhuma cratera toca a rampa de um patamar (a cratera fica intacta).
      for (const p of GCP_PADS) {
        expect(Math.hypot(c.u - p.u, c.v - p.v) - c.r).toBeGreaterThan(PAD_FLAT_M + PAD_RAMP_M);
      }
    }
    for (let i = 0; i < CRATERS.length; i++) {
      for (let j = i + 1; j < CRATERS.length; j++) {
        const a = CRATERS[i] as (typeof CRATERS)[number];
        const b = CRATERS[j] as (typeof CRATERS)[number];
        expect(Math.hypot(a.u - b.u, a.v - b.v), `${i} × ${j}`).toBeGreaterThan(a.r + b.r);
      }
    }
  });

  it('o perfil de cada cratera é −0,4·r·(1 − (d/r)²): fundo de 0,4·r, borda viva e nada fora', () => {
    expect(CRATER_DEPTH_FACTOR).toBe(0.4);
    for (const c of CRATERS) {
      expect(craterDepthM(c, 0)).toBeCloseTo(0.4 * c.r, 9);
      expect(craterDepthM(c, c.r / 2)).toBeCloseTo(0.4 * c.r * 0.75, 9);
      expect(craterDepthM(c, c.r)).toBe(0);
      expect(craterDepthM(c, c.r * 2)).toBe(0);
      // Com o planalto zerado, a receita devolve exatamente o perfil.
      expect(bare(c.u, c.v)).toBeCloseTo(-0.4 * c.r, 9);
      expect(bare(c.u + c.r / 2, c.v)).toBeCloseTo(-0.4 * c.r * 0.75, 9);
      expect(bare(c.u, c.v - c.r * 0.99)).toBeGreaterThan(-0.4 * c.r * 0.03);
      expect(bare(c.u + c.r * 1.01, c.v)).toBe(0);
      expect(craterAt(c.u, c.v)).toBe(c);
      expect(craterAt(c.u + c.r * 1.01, c.v)).not.toBe(c);
    }
  });

  it('o volume de cada cratera no mapa (integrado em grade) bate com o analítico 0,2·π·r³ em 1 %', () => {
    let total = 0;
    for (const c of CRATERS) {
      const step = 0.5;
      let sum = 0;
      for (let du = -c.r; du <= c.r; du += step) {
        for (let dv = -c.r; dv <= c.r; dv += step) sum -= bare(c.u + du, c.v + dv) * step * step;
      }
      expect(Math.abs(sum - craterVolumeM3(c)) / craterVolumeM3(c), `r = ${c.r}`).toBeLessThan(
        0.01,
      );
      total += craterVolumeM3(c);
    }
    // ~150 mil m³ de terra vaporizada, 2/3 dela nas duas maiores crateras.
    expect(total).toBeGreaterThan(140_000);
    expect(total).toBeLessThan(160_000);
    const [a, b] = CRATERS;
    expect(
      (craterVolumeM3(a as (typeof CRATERS)[number]) +
        craterVolumeM3(b as (typeof CRATERS)[number])) /
        total,
    ).toBeGreaterThan(0.6);
  });

  it('o declive da borda de uma cratera é de ~38,7° (atan 0,8): dentro da faixa de 35°–70° da regra', () => {
    const slopeAtRim = Math.atan(2 * CRATER_DEPTH_FACTOR) * (180 / Math.PI);
    expect(slopeAtRim).toBeGreaterThan(35);
    expect(slopeAtRim).toBeLessThan(70);
    const c = CRATERS[0] as (typeof CRATERS)[number];
    const e = 0.01;
    const inside = (bare(c.u + c.r, c.v) - bare(c.u + c.r - e, c.v)) / e;
    expect(Math.atan(Math.abs(inside)) * (180 / Math.PI)).toBeCloseTo(slopeAtRim, 0);
  });
});

describe('RIFT_CRATERS: cobertura, trilhas e patamares', () => {
  it('rocha cor de brasa no planalto e areia no fundo das crateras e nas baixadas', () => {
    const share = (c: LandCover) => (stats.covers[c] ?? 0) / stats.n;
    expect(Object.keys(stats.covers).sort()).toEqual(['ROCK', 'SAND']);
    expect(share('ROCK')).toBeGreaterThan(0.65);
    expect(share('ROCK')).toBeLessThan(0.9);
    expect(share('SAND')).toBeGreaterThan(0.1);
    // O fundo de cada cratera é areia, qualquer que seja a cota do planalto em volta.
    for (const c of CRATERS) expect(terrain.landCover(c.u, c.v), `cratera r=${c.r}`).toBe('SAND');
    // Fora das crateras, a areia é a baixada: só abaixo de SAND_BELOW_M.
    for (let u = 0; u <= lengthM; u += 8) {
      for (let v = 0; v <= widthM; v += 8) {
        if (craterAt(u, v)) continue;
        expect(terrain.landCover(u, v) === 'SAND').toBe(ground(u, v) < SAND_BELOW_M);
      }
    }
    // NDVI de pedra e areia, e nada de dossel.
    for (let u = 0; u <= lengthM; u += 20) {
      for (let v = 0; v <= widthM; v += 20) {
        expect(terrain.ndvi(u, v)).toBeLessThan(0.12);
        expect(terrain.canopy(u, v)).toBe(0);
      }
    }
    const [sr, sg] = terrain.palette.cover.SAND;
    const [rr, rg] = terrain.palette.cover.ROCK;
    expect(sr + sg).toBeGreaterThan(rr + rg);
  });

  it('duas trilhas de terra de 3 m, uma por borda: a pé se chega (≤ 150 m) a qualquer ponto da AOI', () => {
    expect(TRAIL_WIDTH_M).toBe(3);
    expect(terrain.roads).toHaveLength(2);
    expect(terrain.roads.every((r) => r.kind === 'TRAIL' && r.widthM === 3)).toBe(true);
    for (const r of terrain.roads) {
      expect(r.points[0]?.u).toBeLessThan(0);
      expect(r.points.at(-1)?.u).toBeGreaterThan(lengthM);
    }
    expect(terrain.distanceToTrack(150, trailSouthV(150))).toBeLessThan(0.5);
    expect(terrain.distanceToTrack(150, trailNorthV(150))).toBeLessThan(0.5);
    let far = 0;
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) far = Math.max(far, terrain.distanceToTrack(u, v));
    }
    expect(far).toBeLessThan(getVehicle('FOOT_BIKE').gcpReachM);
    // As trilhas passam longe das bordas das crateras.
    for (const c of CRATERS) {
      expect(terrain.distanceToTrack(c.u, c.v)).toBeGreaterThan(c.r + 3);
    }
  });

  it('5 patamares nivelados nos GCPs: o chão é plano e a pé se chega a todos', () => {
    expect(GCP_PADS).toEqual(R03.referencePlan.gcps);
    expect(terrain.guaranteedAccessible).toEqual(GCP_PADS);
    const foot = getVehicle('FOOT_BIKE');
    for (const p of GCP_PADS) {
      expect(isAccessible(p.u, p.v, terrain, [foot], { paintMarkers: false })).toEqual({
        ok: true,
      });
      // Plano (a cota é a mesma) num raio de 10 m do centro.
      const e0 = ground(p.u, p.v);
      for (let a = 0; a < 2 * Math.PI; a += Math.PI / 6) {
        expect(ground(p.u + PAD_FLAT_M * Math.cos(a), p.v + PAD_FLAT_M * Math.sin(a))).toBeCloseTo(
          e0,
          6,
        );
      }
      expect(terrain.slopePct(p.u, p.v)).toBeLessThan(1);
    }
  });
});

describe('RIFT_CRATERS: colunas de energia e rochas flutuantes', () => {
  it('6 colunas de 80 m no centro das 6 maiores crateras, em ciano e amarelo alternados', () => {
    expect(beams).toHaveLength(6);
    expect(BEAM_CRATERS).toHaveLength(6);
    // O sampler ordena os objetos por `u`: acha-se cada coluna pelo centro da sua cratera.
    BEAM_CRATERS.forEach((k, i) => {
      const c = CRATERS[k] as (typeof CRATERS)[number];
      const b = beams.find((o) => o.u === c.u && o.v === c.v);
      expect(b, `coluna da cratera r=${c.r}`).toBeDefined();
      expect(b?.heightM).toBe(80);
      expect(b?.widthM).toBe(BEAM.widthM);
      expect(b?.solid).toBe(true);
      expect(b?.color).toEqual(i % 2 === 0 ? [34, 211, 238] : [250, 204, 21]);
    });
    // Ciano e amarelo: os dois aparecem.
    expect(new Set(beams.map((b) => b.color.join(','))).size).toBe(2);
    // As seis maiores: nenhuma cratera de fora é maior que uma de dentro.
    const inner = Math.min(...BEAM_CRATERS.map((k) => (CRATERS[k] as (typeof CRATERS)[number]).r));
    const outer = CRATERS.filter((_, k) => !(BEAM_CRATERS as readonly number[]).includes(k));
    for (const c of outer) expect(c.r).toBeLessThan(inner + 1);
  });

  it('ligam por 2 s e desligam por 3 s (a regra ENERGY_BEAMS), com os ciclos defasados', () => {
    const fx = resolveRuleEffects(R03.specialRules);
    expect(fx.flight.energyBeams).toEqual(RULE_PARAMS.energyBeams);
    expect(fx.flight.energyBeams).toMatchObject({ onS: BEAM.onS, offS: BEAM.offS, warnS: 0.5 });
    const phases = new Set<number>();
    for (const b of beams) {
      expect(b.activePeriod).toMatchObject({ onS: 2, offS: 3 });
      phases.add(b.activePeriod?.phase ?? -1);
      let on = 0;
      for (let k = 0; k < 500; k++) if (isBeamOn(b, k * 0.01)) on++;
      expect(on * 0.01).toBeCloseTo(2, 1);
    }
    expect(phases.size).toBe(6);
    // Sempre há coluna ligada e coluna desligada: o campo nunca fica todo livre nem todo fechado.
    for (let k = 0; k < 40; k++) {
      const live = beams.filter((b) => isBeamOn(b, k * 0.25)).length;
      expect(live).toBeGreaterThan(0);
      expect(live).toBeLessThan(beams.length);
    }
  });

  it('só ferem quando ligadas e só abaixo do topo: de 90 m acima do chão o T2 passa', () => {
    const b = beams[0] as (typeof beams)[number];
    const y0 = ground(b.u, b.v);
    const at = (alt: number) => ({ u: b.u, v: b.v, alt, radiusM: 0.8 });
    let tOn = 0;
    while (!isBeamOn(b, tOn)) tOn += 0.1;
    let tOff = 0;
    while (isBeamOn(b, tOff)) tOff += 0.1;
    expect(hitsObject(at(y0 + 40), b, tOn, ground)).toBe(true);
    expect(hitsObject(at(y0 + 40), b, tOff, ground)).toBe(false);
    expect(hitsObject(at(y0 + 80.5), b, tOn, ground)).toBe(true);
    expect(hitsObject(at(y0 + 90), b, tOn, ground)).toBe(false);
    // Fora do raio da coluna (3 m + 0,8 m do T2) não há contato.
    expect(hitsObject({ ...at(y0 + 40), u: b.u + 5 }, b, tOn, ground)).toBe(false);
  });

  it('14 rochas flutuantes de 3 a 7 m, soltas a 8–24 m do chão e sem colisão: só enfeitam', () => {
    expect(rocks).toHaveLength(FLOATING_ROCKS);
    expect(terrain.objects).toHaveLength(6 + FLOATING_ROCKS);
    for (const r of rocks) {
      expect(r.solid).toBe(false);
      expect(r.widthM).toBeGreaterThanOrEqual(ROCK_SIZE_M[0]);
      expect(r.widthM).toBeLessThanOrEqual(ROCK_SIZE_M[1]);
      expect(r.heightM).toBeGreaterThanOrEqual(ROCK_HEIGHT_M[0]);
      expect(r.heightM).toBeLessThanOrEqual(ROCK_HEIGHT_M[1]);
      expect(r.baseM).toBeGreaterThanOrEqual(ROCK_BASE_M[0]);
      expect(r.baseM).toBeLessThanOrEqual(ROCK_BASE_M[1]);
      // No meio da rocha o T2 passa: não sólida, não colide.
      const body = {
        u: r.u,
        v: r.v,
        alt: ground(r.u, r.v) + (r.baseM ?? 0) + r.heightM / 2,
        radiusM: 0.8,
      };
      expect(hitsObject(body, r, 0, ground)).toBe(false);
    }
  });
});

describe('RIFT_CRATERS: custo', () => {
  it('criação em poucas centenas de ms e a cota custa poucos µs por chamada', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(R03);
    expect(performance.now() - t0).toBeLessThan(1500);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += fresh.elevation(i % 400, (i * 7) % 300);
    expect(acc).not.toBe(0);
    expect(performance.now() - start).toBeLessThan(800);
  });
});
