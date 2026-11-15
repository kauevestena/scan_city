import { CATALOG, getVehicle } from '@/data/catalog';
import { R11 } from '@/data/contracts/rifts';
import { isAccessible, snapToAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { RULE_PARAMS } from '@/domain/specialRules';
import { hitsObject } from '@/engines/flight/collision';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  BRIDGE_ABOVE_GROUND_M,
  BRIDGE_ENDS_V,
  BRIDGE_US,
  CENTER_V,
  FLOOR_MAX_M,
  FLOOR_MIN_M,
  FLOOR_PERIOD_M,
  floorM,
  PLATEAU_M,
  RIFT_CLIFF_TOMBS,
  RIVER,
  riverDistance,
  riverV,
  STRATA_M,
  TEMPLE_FACADE,
  TEMPLES,
  wallWeight,
} from './riftCliffTombs';

/** Altura dos paredões (spec): de 60 a 100 m. */
const WALL_MIN_M = 60;
const WALL_MAX_M = 100;

const terrain = createTerrain(R11);
const { lengthM, widthM } = R11.aoi;
const ground = (u: number, v: number) => terrain.elevation(u, v);
const foot = getVehicle('FOOT_BIKE');
const temples = terrain.objects.filter((o) => o.kind === 'CLIFF_TEMPLE');
const bridges = terrain.objects.filter((o) => o.kind === 'WIRE');
const posts = terrain.objects.filter((o) => o.kind === 'POLE');
const plan = buildFlightPlan(referenceParams(R11), R11, CATALOG);
const planAlt = meanAoiElevation(terrain) + R11.referencePlan.heightM;

describe('createTerrain — RIFT_CLIFF_TOMBS (R11)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_CLIFF_TOMBS).toBe(RIFT_CLIFF_TOMBS);
    expect(terrain.biome).toBe('RIFT_CLIFF_TOMBS');
    expect(terrain.aoi).toEqual({ widthM: 240, lengthM: 400 });
  });

  it('determinismo: mesma seed → mesmos templos, pontes e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(R11);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.features).toEqual(terrain.features);
    for (let u = -60; u <= 460; u += 29) {
      for (let v = -40; v <= 280; v += 23) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('cânion de fundo entre 0 e 40 m e planalto de 100 m, com a rampa de |v − 120| entre 85 e 95 m', () => {
    expect(PLATEAU_M).toBe(100);
    expect(R11.terrainReliefM).toBe(PLATEAU_M);
    // A cota do fundo sobe e desce ao longo do cânion, de 0 a 40 m, num ciclo só: média de 20 m.
    const floors = Array.from({ length: 41 }, (_, i) => floorM(i * 10));
    expect(Math.min(...floors)).toBeCloseTo(FLOOR_MIN_M, 0);
    expect(Math.max(...floors)).toBeCloseTo(FLOOR_MAX_M, 0);
    expect(FLOOR_PERIOD_M).toBe(lengthM);
    expect(floors.slice(0, 40).reduce((a, b) => a + b, 0) / 40).toBeCloseTo(20, 6);
    // A rampa: nula até 85 m do eixo, total a partir de 95 m.
    expect(wallWeight(CENTER_V)).toBe(0);
    expect(wallWeight(CENTER_V + 85)).toBe(0);
    expect(wallWeight(CENTER_V + 95)).toBe(1);
    expect(wallWeight(CENTER_V - 95)).toBe(1);
    expect(wallWeight(CENTER_V + 90)).toBeCloseTo(0.5, 9);
    for (const u of [0, 80, 160, 240, 320, 400]) {
      // Fundo (longe do rio) na cota do cânion; planalto a ~100 m, com ±1,5 m de rugosidade.
      expect(Math.abs(ground(u, 60) - floorM(u))).toBeLessThan(1.1);
      expect(Math.abs(ground(u, 10) - PLATEAU_M)).toBeLessThan(1.6);
      expect(Math.abs(ground(u, 230) - PLATEAU_M)).toBeLessThan(1.6);
    }
  });

  it('paredões de 60 a 100 m de altura, quase verticais (> 80°)', () => {
    for (let u = 0; u <= lengthM; u += 10) {
      for (const [top, base] of [
        [10, 60],
        [230, 180],
      ] as const) {
        const wall = ground(u, top) - ground(u, base);
        expect(wall, `paredão em u = ${u}`).toBeGreaterThan(WALL_MIN_M - 3);
        expect(wall, `paredão em u = ${u}`).toBeLessThan(WALL_MAX_M + 3);
      }
    }
    // Declive máximo no meio da rampa (v = 30 e v = 210): passa dos 80° (tan 80° = 567 %).
    let steepest = 0;
    for (let u = 0; u <= lengthM; u += 5) {
      for (const v of [28, 30, 32, 208, 210, 212])
        steepest = Math.max(steepest, terrain.slopePct(u, v));
    }
    expect(steepest).toBeGreaterThan(
      Math.tan((RULE_PARAMS.cliffs.minSlopeDeg * Math.PI) / 180) * 100,
    );
    // E o fundo do cânion não é íngreme.
    for (let u = 0; u <= lengthM; u += 20) expect(terrain.slopePct(u, 80)).toBeLessThan(36);
  });

  it('um rio sinuoso de 12 m no fundo, 3 m abaixo, com margens de areia', () => {
    for (let u = 0; u <= lengthM; u += 10) {
      const v = riverV(u);
      expect(terrain.landCover(u, v), `rio em u = ${u}`).toBe('WATER');
      expect(riverDistance(u, v)).toBeCloseTo(0, 9);
      // A margem de areia vem logo depois da água.
      expect(terrain.landCover(u, v + 12)).toBe('SAND');
      // O leito é mais baixo que a margem.
      expect(ground(u, v)).toBeLessThan(ground(u, v + 30) - 1);
    }
    expect(RIVER.halfWidthM * 2).toBe(12);
    expect(RIVER.carveM).toBe(3);
    // O rio serpenteia: o eixo vai de 120 − 14 a 120 + 14.
    const vs = Array.from({ length: 80 }, (_, i) => riverV(i * 5));
    expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(24);
  });

  it('as paredes têm estratos de cor: rocha e areia alternam a cada 12 m de cota', () => {
    expect(STRATA_M).toBe(12);
    const seen = new Set<string>();
    for (let v = 26; v <= 34; v += 0.5) seen.add(terrain.landCover(240, v));
    expect(seen).toEqual(new Set(['ROCK', 'SAND']));
    // No planalto é só rocha, e no fundo, rocha e areia sem estrato.
    for (let v = 0; v <= 20; v += 4) expect(terrain.landCover(240, v)).toBe('ROCK');
  });

  it('3 templos esculpidos no pé dos paredões, voltados para o fundo do cânion', () => {
    expect(temples).toHaveLength(3);
    expect(temples.map((t) => [t.u, t.v])).toEqual(
      [...TEMPLES].sort((a, b) => a.u - b.u).map((t) => [t.u, t.v]),
    );
    for (const t of temples) {
      expect(t.solid).toBe(true);
      expect(t.heightM).toBeGreaterThanOrEqual(25);
      expect(t.heightM).toBeLessThanOrEqual(40);
      // Fica dentro da AOI e junto do paredão (o pé da rampa é |v − 120| = 85).
      expect(t.u).toBeGreaterThan(0);
      expect(t.u).toBeLessThan(lengthM);
      expect(Math.abs(Math.abs(t.v - CENTER_V) - 76)).toBeLessThan(3);
      // O templo é uma caixa sólida: toca por dentro e não por cima.
      const y0 = ground(t.u, t.v);
      const at = (alt: number) => ({ u: t.u, v: t.v, alt, radiusM: 0.5 });
      expect(hitsObject(at(y0 + t.heightM / 2), t, 0, ground)).toBe(true);
      expect(hitsObject(at(y0 + t.heightM + 2), t, 0, ground)).toBe(false);
    }
    // A fachada do primeiro templo dá para o terraço do alvo: a menos de um raio do centro.
    const first = temples.find((t) => t.u === TEMPLE_FACADE.u);
    expect(first).toBeDefined();
    if (!first) return;
    const frontV = first.v + first.depthM / 2;
    expect(Math.abs(TEMPLE_FACADE.v - frontV)).toBeLessThan(TEMPLE_FACADE.radiusM);
  });

  it('o alvo TEMPLE_FACADE: (200, 60), r = 20 m, só fotos', () => {
    expect(terrain.features).toEqual([
      {
        id: 'TEMPLE_FACADE',
        name: 'Fachada do templo',
        u: 200,
        v: 60,
        radiusM: 20,
        needs: 'PHOTO',
      },
    ]);
    // O centro do alvo está no fundo seco do cânion, não na água.
    expect(terrain.landCover(200, 60)).not.toBe('WATER');
  });

  it('2 pontes de corda de borda a borda, 2 m acima do planalto, com um poste em cada ponta', () => {
    expect(bridges).toHaveLength(BRIDGE_US.length);
    expect(posts).toHaveLength(BRIDGE_US.length * 2);
    for (const b of bridges) {
      const u2 = b.u2 ?? b.u;
      const v2 = b.v2 ?? b.v;
      expect([b.v, v2].sort((x, y) => x - y)).toEqual([...BRIDGE_ENDS_V]);
      // As duas pontas estão no planalto: a corda atravessa o cânion inteiro.
      expect(ground(b.u, b.v)).toBeGreaterThan(PLATEAU_M - 2);
      expect(ground(u2, v2)).toBeGreaterThan(PLATEAU_M - 2);
      expect(b.baseM).toBe(BRIDGE_ABOVE_GROUND_M);
      expect(Math.hypot(u2 - b.u, v2 - b.v)).toBeGreaterThan(210);
      // A corda pende acima do voo? Não: o plano de referência passa 6 m ou mais por cima.
      expect(ground(b.u, b.v) + (b.baseM ?? 0)).toBeLessThan(planAlt - 6);
    }
  });

  it('PAINT_MARKERS: os GCPs dos cantos cravam no paredão com a tinta, e sem ela são íngremes demais', () => {
    const wall = R11.referencePlan.gcps.filter((p) => p.v === 30 || p.v === 210);
    expect(wall).toHaveLength(4);
    for (const p of wall) {
      // Estão a meia altura do paredão (entre 40 e 90 m acima do fundo).
      expect(ground(p.u, p.v)).toBeGreaterThan(floorM(p.u) + 20);
      expect(terrain.slopePct(p.u, p.v)).toBeGreaterThan(300);
      expect(isAccessible(p.u, p.v, terrain, [foot], { paintMarkers: true })).toEqual({ ok: true });
      expect(isAccessible(p.u, p.v, terrain, [foot], { paintMarkers: false }).reason).toBe(
        'TOO_STEEP',
      );
    }
    // A água continua inválida mesmo com a tinta: o GCP do meio, no rio, encaixa na margem.
    expect(isAccessible(200, 120, terrain, [foot], { paintMarkers: true })).toEqual({
      ok: false,
      reason: 'WATER',
    });
    const snapped = snapToAccessible(
      { u: 200, v: 120 },
      terrain,
      [foot],
      { paintMarkers: true },
      30,
    );
    expect(snapped).not.toBeNull();
    if (snapped) expect(terrain.landCover(snapped.u, snapped.v)).not.toBe('WATER');
    expect(terrain.guaranteedAccessible).toEqual([{ u: 200, v: 138 }]);
    expect(isAccessible(200, 138, terrain, [foot], { paintMarkers: true })).toEqual({ ok: true });
  });

  it('o plano de referência (H = 70 m sobre a cota média) passa por cima do planalto e das pontes', () => {
    // A altitude constante é a cota média da AOI mais H: 10 m ou mais acima do ponto mais alto
    // sob as linhas (as linhas de borda correm sobre o planalto).
    let highest = -Infinity;
    for (const line of plan.lines) {
      for (let u = -30; u <= lengthM + 30; u += 5) {
        highest = Math.max(highest, ground(u, line.start.v));
      }
    }
    expect(planAlt - highest).toBeGreaterThan(10);
    expect(plan.lines.some((l) => l.start.v < 0 || l.start.v > widthM)).toBe(true);
  });
});
