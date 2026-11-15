import { getVehicle } from '@/data/catalog';
import { R08 } from '@/data/contracts/rifts';
import { isAccessible, snapToAccessible } from '@/domain/accessibility';
import { RULE_PARAMS } from '@/domain/specialRules';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  alleyWidthU,
  alleyWidthV,
  ALLEYS_U,
  ALLEYS_V,
  blockRect,
  COURT,
  COURT_BLOCK,
  COURT_CENTER,
  HOUSE_GAP_M,
  HOUSE_HEIGHT_M,
  inCourt,
  PALM_CROWN_M,
  PALM_HEIGHT_M,
  RIFT_SANTOS_HOOD,
  VACANT_RATE,
} from './riftSantosHood';

const terrain = createTerrain(R08);
const { lengthM, widthM } = R08.aoi;
const foot = getVehicle('FOOT_BIKE');
const houses = terrain.objects.filter((o) => o.kind === 'BUILDING');
const palms = terrain.objects.filter((o) => o.kind === 'TREE');
const poles = terrain.objects.filter((o) => o.kind === 'POLE');
const wires = terrain.objects.filter((o) => o.kind === 'WIRE');
const hoops = poles.filter((p) => !p.solid);
const posts = poles.filter((p) => p.solid);

describe('createTerrain — RIFT_SANTOS_HOOD (R08)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_SANTOS_HOOD).toBe(RIFT_SANTOS_HOOD);
    expect(terrain.biome).toBe('RIFT_SANTOS_HOOD');
    expect(terrain.aoi).toEqual({ widthM: 240, lengthM: 300 });
  });

  it('determinismo: mesma seed → mesmas casas, palmeiras, postes e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(R08);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    for (let u = -50; u <= 350; u += 23) {
      for (let v = -40; v <= 280; v += 19) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('morro ondulado de até 20 m', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u <= lengthM; u += 3) {
      for (let v = 0; v <= widthM; v += 3) {
        const e = terrain.elevation(u, v);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    }
    expect(lo).toBeGreaterThanOrEqual(-0.01);
    expect(hi).toBeLessThanOrEqual(R08.terrainReliefM + 0.01);
    expect(hi - lo).toBeGreaterThan(R08.terrainReliefM * 0.6);
  });

  it('vielas de 4 a 6 m: uma polilinha de via por viela, de largura a ditar o ROAD do sampler', () => {
    expect(ALLEYS_U).toHaveLength(16);
    expect(ALLEYS_V).toHaveLength(13);
    const widths = [
      ...ALLEYS_U.map((_, i) => alleyWidthU(i)),
      ...ALLEYS_V.map((_, j) => alleyWidthV(j)),
    ];
    for (const w of widths) {
      expect(w).toBeGreaterThanOrEqual(4);
      expect(w).toBeLessThanOrEqual(6);
    }
    // Há larguras de 4, de 5 e de 6 m: não é tudo igual.
    expect(new Set(widths.map((w) => Math.round(w))).size).toBe(3);
    // Quadras de 26 a 36 m de eixo a eixo.
    for (const axes of [ALLEYS_U, ALLEYS_V]) {
      for (let i = 0; i + 1 < axes.length; i++) {
        const gap = (axes[i + 1] as number) - (axes[i] as number);
        expect(gap).toBeGreaterThanOrEqual(26);
        expect(gap).toBeLessThanOrEqual(36);
      }
    }
    expect(terrain.roads).toHaveLength(ALLEYS_U.length + ALLEYS_V.length);
    expect(terrain.roads.every((r) => r.kind === 'ROAD')).toBe(true);
    expect(terrain.roads.map((r) => r.widthM).sort()).toEqual([...widths].sort());
    // O eixo de cada viela dentro da AOI é ROAD, e fica a 0 m de uma via.
    for (const [i, u] of ALLEYS_U.entries()) {
      if (u < 0 || u > lengthM) continue;
      expect(terrain.landCover(u, 96), `viela u ${u}`).toBe('ROAD');
      expect(terrain.distanceToRoad(u, 96)).toBeLessThan(alleyWidthU(i) / 2);
    }
    for (const [j, v] of ALLEYS_V.entries()) {
      if (v < 0 || v > widthM) continue;
      expect(terrain.landCover(75, v), `viela v ${v}`).toBe('ROAD');
      expect(terrain.distanceToRoad(75, v)).toBeLessThan(alleyWidthV(j) / 2);
    }
  });

  it('casas coladas de 6 a 12 m de altura, dentro das quadras e sem pisar nas vielas', () => {
    expect(houses.length).toBeGreaterThan(500);
    for (const h of houses) {
      expect(h.heightM).toBeGreaterThanOrEqual(HOUSE_HEIGHT_M[0]);
      expect(h.heightM).toBeLessThanOrEqual(HOUSE_HEIGHT_M[1]);
      expect(h.solid).toBe(true);
      // Nenhuma casa invade uma viela: o miolo da quadra é o que sobra entre as bordas.
      ALLEYS_U.forEach((axis, i) => {
        const overlap =
          h.u + h.widthM / 2 > axis - alleyWidthU(i) / 2 + 1e-6 &&
          h.u - h.widthM / 2 < axis + alleyWidthU(i) / 2 - 1e-6;
        expect(overlap, `casa ${h.id} × viela u ${axis}`).toBe(false);
      });
      ALLEYS_V.forEach((axis, j) => {
        const overlap =
          h.v + h.depthM / 2 > axis - alleyWidthV(j) / 2 + 1e-6 &&
          h.v - h.depthM / 2 < axis + alleyWidthV(j) / 2 - 1e-6;
        expect(overlap, `casa ${h.id} × viela v ${axis}`).toBe(false);
      });
    }
    // Coladas: a área construída ocupa quase todo o miolo das quadras da AOI.
    let blocks = 0;
    for (let k = 0; k + 1 < ALLEYS_U.length; k++) {
      for (let j = 0; j + 1 < ALLEYS_V.length; j++) {
        if (k === COURT_BLOCK.k && j === COURT_BLOCK.j) continue;
        const r = blockRect(k, j);
        if (r.uMin < 0 || r.uMax > lengthM || r.vMin < 0 || r.vMax > widthM) continue;
        blocks += (r.uMax - r.uMin) * (r.vMax - r.vMin);
      }
    }
    const built = houses
      .filter((h) => h.u > 0 && h.u < lengthM && h.v > 0 && h.v < widthM)
      .reduce((s, h) => s + h.widthM * h.depthM, 0);
    expect(blocks).toBeGreaterThan(30_000);
    expect(built / blocks).toBeGreaterThan(0.85);
    expect(HOUSE_GAP_M).toBeLessThanOrEqual(0.5);
  });

  it('lotes vagos com palmeira: ~6 % dos lotes, de 4–5 m de copa e 8–12 m, fora dos telhados', () => {
    expect(VACANT_RATE).toBeCloseTo(0.06, 9);
    const lots = houses.length + palms.length;
    expect(palms.length / lots).toBeGreaterThan(0.02);
    expect(palms.length / lots).toBeLessThan(0.1);
    for (const p of palms) {
      expect(p.widthM).toBeGreaterThanOrEqual(3);
      expect(p.widthM).toBeLessThanOrEqual(PALM_CROWN_M[1]);
      expect(p.heightM).toBeGreaterThanOrEqual(PALM_HEIGHT_M[0] - 1e-9);
      expect(p.heightM).toBeLessThanOrEqual(PALM_HEIGHT_M[1]);
      expect(p.color[1]).toBeGreaterThan(p.color[0]);
      expect(terrain.landCover(p.u, p.v)).not.toBe('ROOF');
    }
  });

  it('a quadra de basquete (28 × 15 m) é de piso laranja, nivelada, com duas tabelas e a palmeira dos cantos', () => {
    expect(COURT.uMax - COURT.uMin).toBe(28);
    expect(COURT.vMax - COURT.vMin).toBe(15);
    expect(inCourt(COURT_CENTER.u, COURT_CENTER.v)).toBe(true);
    const e0 = terrain.elevation(COURT_CENTER.u, COURT_CENTER.v);
    for (let u = COURT.uMin; u <= COURT.uMax; u += 2) {
      for (let v = COURT.vMin; v <= COURT.vMax; v += 2) {
        expect(terrain.landCover(u, v)).toBe('BENCH');
        expect(terrain.elevation(u, v)).toBeCloseTo(e0, 6);
      }
    }
    expect(terrain.landCover(COURT.uMin - 3, COURT_CENTER.v)).not.toBe('BENCH');
    // Nenhuma casa na quadra do meio.
    const pad = blockRect(COURT_BLOCK.k, COURT_BLOCK.j);
    expect(
      houses.some((h) => h.u > pad.uMin && h.u < pad.uMax && h.v > pad.vMin && h.v < pad.vMax),
    ).toBe(false);
    expect(hoops).toHaveLength(2);
    for (const hoop of hoops) {
      expect(hoop.heightM).toBeCloseTo(3.2, 9);
      expect(inCourt(hoop.u, hoop.v)).toBe(true);
    }
    // O piso vira laranja na paleta, como a quadra do bairro.
    const [r, g, b] = terrain.palette.cover.BENCH;
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('LOW_WIRES: um emaranhado de postes à beira das vielas e fios entre eles a 8–14 m', () => {
    const [lo, hi] = RULE_PARAMS.lowWires.wireHeightM;
    expect(wires.length).toBeGreaterThan(150);
    expect(posts.length).toBeGreaterThan(150);
    for (const w of wires) {
      expect(w.baseM).toBeGreaterThanOrEqual(lo);
      expect(w.baseM).toBeLessThanOrEqual(hi);
      expect(w.solid).toBe(true);
      expect(Math.hypot((w.u2 ?? w.u) - w.u, (w.v2 ?? w.v) - w.v)).toBeLessThanOrEqual(41);
    }
    // Cada poste está dentro de uma viela (à beira dela), nunca no meio de uma casa.
    for (const p of posts) {
      const inU = ALLEYS_U.some((axis, i) => Math.abs(p.u - axis) <= alleyWidthU(i) / 2);
      const inV = ALLEYS_V.some((axis, j) => Math.abs(p.v - axis) <= alleyWidthV(j) / 2);
      expect(inU || inV, `poste ${p.id} em (${p.u.toFixed(1)}, ${p.v.toFixed(1)})`).toBe(true);
    }
  });

  it('a pé ou de bicicleta: as vielas e a quadra são acessíveis e todo ponto fica a ≤ 15 m de uma viela', () => {
    expect(terrain.guaranteedAccessible).toEqual([{ u: 150, v: 120 }]);
    expect(isAccessible(150, 120, terrain, [foot], { paintMarkers: false })).toEqual({ ok: true });
    let farthest = 0;
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4)
        farthest = Math.max(farthest, terrain.distanceToRoad(u, v));
    }
    expect(farthest).toBeLessThanOrEqual(15);
    // Pontos de apoio do plano: cada um encaixa numa viela ou na quadra a poucos metros.
    const ref = R08.referencePlan;
    for (const p of [...ref.gcps, ...ref.cps]) {
      const snapped = snapToAccessible(p, terrain, [foot], { paintMarkers: false }, 30);
      expect(snapped, `${p.u},${p.v}`).not.toBeNull();
      if (!snapped) continue;
      expect(Math.hypot(snapped.u - p.u, snapped.v - p.v)).toBeLessThanOrEqual(8);
    }
  });

  it('o plano de referência (H = 80 m) passa por cima de casas, postes e fios', () => {
    const planAlt = meanAoiElevation(terrain) + R08.referencePlan.heightM;
    for (const o of terrain.objects) {
      const top = terrain.elevation(o.u, o.v) + (o.baseM ?? 0) + o.heightM;
      expect(top).toBeLessThan(planAlt - 30);
    }
  });
});
