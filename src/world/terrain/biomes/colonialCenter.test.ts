import { getAircraft, getVehicle } from '@/data/catalog';
import { C05 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { checkCollision, hitsObject } from '@/engines/flight/collision';
import { mulberry32 } from '@/lib/rng';
import type { WorldObject } from '@/types';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  CHURCH,
  COLONIAL_CENTER,
  HOUSE_DEPTH_M,
  LARGO_CENTER,
  SLOPE_RISE_M,
  STREET_WIDTH_M,
  STREETS,
} from './colonialCenter';

const terrain = createTerrain(C05);
const of = (kind: WorldObject['kind']) => terrain.objects.filter((o) => o.kind === kind);
const buildings = of('BUILDING');
const nave = buildings.find((b) => b.heightM === CHURCH.nave.heightM) as WorldObject;
const houses = buildings.filter((b) => b !== nave);
const ground = (u: number, v: number) => terrain.elevation(u, v);

describe('createTerrain — COLONIAL_CENTER (C05)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.COLONIAL_CENTER).toBe(COLONIAL_CENTER);
    expect(terrain.biome).toBe('COLONIAL_CENTER');
    expect(terrain.aoi).toEqual({ widthM: 150, lengthM: 150 });
  });

  it('determinismo: mesma seed → mesma cidade, mesmas amostras', () => {
    clearTerrainCache();
    const again = createTerrain(C05);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-28, 178);
      const v = rng.range(-28, 178);
      expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
      expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
    }
    expect(createTerrain({ ...C05, id: 'C05-OUTRA', seed: 99 }).objects).not.toEqual(
      terrain.objects,
    );
  });

  it('ladeira: o plano sobe 25 m ao longo de u, com taludes que os veículos vencem', () => {
    let slope = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u <= 150; u += 5) {
      for (let v = 0; v <= 150; v += 5) {
        const e = ground(u, v);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
        slope = Math.max(slope, terrain.slopePct(u, v));
      }
    }
    expect(hi - lo).toBeGreaterThan(SLOPE_RISE_M - 3);
    expect(hi - lo).toBeLessThanOrEqual(SLOPE_RISE_M + 3);
    expect(ground(150, 75)).toBeGreaterThan(ground(0, 75) + SLOPE_RISE_M - 4);
    // Ao longo de v a rampa é só a ondulação leve.
    expect(Math.abs(ground(75, 150) - ground(75, 0))).toBeLessThan(5);
    expect(slope).toBeLessThan(25);
    expect(slope).toBeLessThan(getVehicle('COMPACT_CAR').maxSlopePct);
    expect(C05.terrainReliefM).toBe(SLOPE_RISE_M);
  });

  it('ruas de pedra de 7 m em grade, quintais de grama e telhado sob os casarões', () => {
    expect(terrain.roads).toHaveLength(2 * STREETS.length);
    expect(terrain.roads.every((r) => r.kind === 'ROAD' && r.widthM === STREET_WIDTH_M)).toBe(true);
    expect(terrain.landCover(48, 20)).toBe('ROAD'); // eixo de rua de u constante
    expect(terrain.landCover(20, 102)).toBe('ROAD'); // eixo de rua de v constante
    // O quintal (o miolo depois das fileiras de 13 m) é grama; a calçada, o piso de pedra.
    const inset = -6 + STREET_WIDTH_M / 2 + HOUSE_DEPTH_M + 5;
    expect(terrain.landCover(inset, inset)).toBe('GRASS');
    expect(terrain.landCover(48 + 3.5 + 1, 75)).toBe('URBAN');
    const h = houses[20] as WorldObject;
    expect(terrain.landCover(h.u, h.v)).toBe('ROOF');
    expect(terrain.canopy(48, 20)).toBe(0);
  });

  it('casarões de 8–10 m em fileira ao longo das quadras, sem sobreposição nem invadir ruas', () => {
    expect(houses.length).toBeGreaterThan(100);
    expect(houses.every((h) => h.heightM >= 8 && h.heightM <= 10 && h.solid)).toBe(true);
    const half = STREET_WIDTH_M / 2;
    for (let i = 0; i < houses.length; i++) {
      const a = houses[i] as WorldObject;
      // Dentro de uma quadra (fora de qualquer rua) e colado a um dos lados dela.
      for (const s of STREETS) {
        expect(
          Math.abs(a.u - s) - a.widthM / 2,
          `casa ${a.id} × rua u=${s}`,
        ).toBeGreaterThanOrEqual(half - 1e-9);
        expect(
          Math.abs(a.v - s) - a.depthM / 2,
          `casa ${a.id} × rua v=${s}`,
        ).toBeGreaterThanOrEqual(half - 1e-9);
      }
      for (let j = i + 1; j < houses.length; j++) {
        const b = houses[j] as WorldObject;
        const gapU = Math.abs(a.u - b.u) - (a.widthM + b.widthM) / 2;
        const gapV = Math.abs(a.v - b.v) - (a.depthM + b.depthM) / 2;
        expect(Math.max(gapU, gapV), `${a.id} × ${b.id}`).toBeGreaterThanOrEqual(0.6 - 1e-9);
      }
    }
  });

  it('igreja matriz: nave de 30 × 20 × 18 m e duas torres de 35 m na fachada, sobre o largo', () => {
    expect(nave).toMatchObject({ u: 75, v: 63, widthM: 30, depthM: 20, heightM: 18, solid: true });
    const towers = of('TOWER');
    expect(towers).toHaveLength(2);
    for (const t of towers) {
      expect([t.widthM, t.depthM, t.heightM]).toEqual([5, 5, 35]);
      // Cada torre encosta na parede da fachada (a face sul da nave).
      expect(t.v - t.depthM / 2).toBeCloseTo(nave.v + nave.depthM / 2, 9);
      expect(Math.abs(t.u - nave.u)).toBeCloseTo(12.5, 9);
    }
    // Ninguém mais ocupa a quadra da igreja: o largo fica aberto.
    const inside = terrain.objects.filter(
      (o) => o.kind !== 'WIRE' && o.u > 51.5 && o.u < 98.5 && o.v > 51.5 && o.v < 98.5,
    );
    expect(inside.filter((o) => o.kind === 'BUILDING' && o !== nave)).toHaveLength(0);
    expect(terrain.guaranteedAccessible).toEqual([LARGO_CENTER]);
    expect(
      isAccessible(LARGO_CENTER.u, LARGO_CENTER.v, terrain, [getVehicle('FOOT_BIKE')], {
        paintMarkers: false,
      }),
    ).toEqual({ ok: true });
  });

  it('postes a 30–40 m e fios de 8–14 m de altura entre eles', () => {
    const poles = of('POLE');
    const wires = of('WIRE');
    expect(poles.length).toBeGreaterThan(40);
    expect(wires.length).toBeGreaterThan(40);
    for (const w of wires) {
      expect(w.baseM).toBeGreaterThanOrEqual(8);
      expect(w.baseM).toBeLessThanOrEqual(14);
      // As pontas do fio são postes.
      const hasPole = (u: number, v: number) =>
        poles.some((p) => Math.hypot(p.u - u, p.v - v) < 1e-9);
      expect(hasPole(w.u, w.v) && hasPole(w.u2 as number, w.v2 as number)).toBe(true);
      const span = Math.hypot((w.u2 as number) - w.u, (w.v2 as number) - w.v);
      expect(span).toBeGreaterThanOrEqual(30 - 1e-6);
      expect(span).toBeLessThanOrEqual(40 + 1e-6);
    }
  });

  it('os fios colidem a ±1 m da sua altura, e a 20 m de AGL a aeronave passa por cima', () => {
    const rng = mulberry32(11);
    for (let n = 0; n < 12; n++) {
      const w = rng.pick(of('WIRE'));
      const t = rng.range(0.2, 0.8);
      const u = w.u + t * ((w.u2 as number) - w.u);
      const v = w.v + t * ((w.v2 as number) - w.v);
      // O fio segue o terreno: a altura é medida sobre o chão de cada ponta.
      const gU = ground(w.u, w.v);
      const gV = ground(w.u2 as number, w.v2 as number);
      const wireAlt = gU + (gV - gU) * t + (w.baseM as number);
      // Fio (0,5 m) + corpo de 0,6 m de raio: alcance de 1,1 m, o "±1 m" da regra.
      const at = (alt: number) => hitsObject({ u, v, alt, radiusM: 0.6 }, w, 0, ground);
      expect(at(wireAlt), `fio ${w.id}`).toBe(true);
      expect(at(wireAlt + 1)).toBe(true);
      expect(at(wireAlt - 1)).toBe(true);
      expect(at(wireAlt + 3)).toBe(false);
      expect(at(wireAlt - 3)).toBe(false);
    }
    // A nota do briefing: AGL acima de 20 m livra a fiação (e os casarões e as árvores).
    let hits = 0;
    for (const w of of('WIRE')) {
      const u = (w.u + (w.u2 as number)) / 2;
      const v = (w.v + (w.v2 as number)) / 2;
      const body = { u, v, alt: ground(u, v) + 20, radiusM: 0.4 };
      if (checkCollision(body, terrain.objects, 0, ground)) hits++;
    }
    expect(hits).toBe(0);
  });

  it('o plano de referência (H 50 m) passa acima de tudo, com folga', () => {
    const planAltM = meanAoiElevation(terrain) + C05.referencePlan.heightM;
    let top = 0;
    for (const o of terrain.objects) {
      if (o.kind === 'WIRE') continue;
      top = Math.max(top, ground(o.u, o.v) + (o.baseM ?? 0) + o.heightM);
    }
    expect(planAltM - top).toBeGreaterThanOrEqual(10);
    expect(C05.referencePlan.heightM).toBeLessThanOrEqual(getAircraft('DRONE_T1').hMaxM);
  });

  it('a cidade cobre a margem de 20 % e elevation custa < 2 µs por chamada', () => {
    expect(buildings.some((b) => b.u < 0 || b.v < 0)).toBe(true);
    expect(buildings.some((b) => b.u > 150 || b.v > 150)).toBe(true);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += terrain.elevation(i % 150, (i * 7) % 150);
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
