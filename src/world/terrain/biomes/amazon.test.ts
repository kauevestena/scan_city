import { getVehicle } from '@/data/catalog';
import { C03 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import { groundDensity, groundReturnProbability } from '@/domain/lidar';
import { resolveRuleEffects } from '@/domain/specialRules';
import { mulberry32 } from '@/lib/rng';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  AMAZON,
  CLEARINGS,
  clearingAt,
  FOREST_CANOPY,
  RELIEF_M,
  STREAM,
  streamDistance,
  streamV,
  TREE_HEIGHT_M,
  TREE_SPACING_M,
} from './amazon';

const terrain = createTerrain(C03);
const { lengthM, widthM } = C03.aoi;
const trees = terrain.objects.filter((o) => o.kind === 'TREE');

describe('createTerrain — AMAZON (C03)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.AMAZON).toBe(AMAZON);
    expect(terrain.biome).toBe('AMAZON');
    expect(terrain.aoi).toEqual({ widthM: 500, lengthM: 1000 });
  });

  it('determinismo: mesma seed → mesma mata, igarapé e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(C03);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    const rng = mulberry32(2);
    for (let i = 0; i < 1000; i++) {
      const u = rng.range(-190, 1190);
      const v = rng.range(-90, 590);
      expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
      expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      expect(again.canopy(u, v)).toBe(terrain.canopy(u, v));
    }
  });

  it('7 clareiras fixas nas posições da spec, de 22 a 35 m de raio, sem dossel e sem se tocar', () => {
    expect(CLEARINGS.map((c) => [c.u, c.v])).toEqual([
      [150, 100],
      [850, 100],
      [150, 400],
      [850, 400],
      [500, 250],
      [300, 250],
      [700, 250],
    ]);
    for (const c of CLEARINGS) {
      expect(c.r).toBeGreaterThanOrEqual(22);
      expect(c.r).toBeLessThanOrEqual(35);
      expect(terrain.landCover(c.u, c.v)).toBe('GRASS');
      expect(terrain.canopy(c.u, c.v)).toBe(0);
      expect(terrain.canopy(c.u + c.r - 9, c.v)).toBe(0); // a copa da borda não entra aqui
      expect(terrain.landCover(c.u + c.r + 3, c.v)).toBe('FOREST');
      expect(clearingAt(c.u, c.v)).toBe(c);
      // Longe do igarapé: nunca na água nem no brejo.
      expect(streamDistance(c.u, c.v)).toBeGreaterThan(STREAM.swampM + c.r);
    }
    for (let i = 0; i < CLEARINGS.length; i++) {
      for (let j = i + 1; j < CLEARINGS.length; j++) {
        const a = CLEARINGS[i] as (typeof CLEARINGS)[number];
        const b = CLEARINGS[j] as (typeof CLEARINGS)[number];
        expect(Math.hypot(a.u - b.u, a.v - b.v)).toBeGreaterThan(a.r + b.r + 10);
      }
    }
    // Todas dentro da AOI, e o gerador as declara como pontos garantidos.
    expect(CLEARINGS.every((c) => c.u > 0 && c.u < lengthM && c.v > 0 && c.v < widthM)).toBe(true);
    expect(terrain.guaranteedAccessible).toEqual(CLEARINGS.map((c) => ({ u: c.u, v: c.v })));
  });

  it('mata densa: dossel de 0,95–0,98 (média 0,97) em mais de 85 % da AOI, DENSE_CANOPY satisfeita', () => {
    const rule = resolveRuleEffects(C03.specialRules).terrain.denseCanopy;
    expect(rule).toMatchObject({ minCanopy: 0.9, maxCanopy: 0.98 });
    let forest = 0;
    let total = 0;
    let sum = 0;
    for (let u = 0; u <= lengthM; u += 8) {
      for (let v = 0; v <= widthM; v += 8) {
        total++;
        if (terrain.landCover(u, v) !== 'FOREST') continue;
        forest++;
        const c = terrain.canopy(u, v);
        sum += c;
        expect(c).toBeGreaterThanOrEqual(0.95);
        expect(c).toBeLessThanOrEqual(0.98);
        expect(c).toBeGreaterThanOrEqual(rule?.minCanopy ?? 0);
      }
    }
    expect(forest / total).toBeGreaterThan(0.85);
    expect(sum / forest).toBeCloseTo(FOREST_CANOPY, 2);
    expect(terrain.ndvi(100, 300)).toBeGreaterThan(0.75);
  });

  it('igarapé sinuoso: água a ±4 m do eixo, brejo até 14 m, leito escavado 4 m', () => {
    const vs = [];
    for (let u = 0; u <= lengthM; u += 10) vs.push(streamV(u));
    expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(55);
    // Atravessa a AOI de ponta a ponta, entre as fileiras de clareiras.
    expect(Math.min(...vs)).toBeGreaterThan(120);
    expect(Math.max(...vs)).toBeLessThan(230);
    for (const u of [100, 400, 700, 950]) {
      const v = streamV(u);
      expect(terrain.landCover(u, v)).toBe('WATER');
      expect(terrain.landCover(u, v + STREAM.halfWidthM + 6)).toBe('SWAMP');
      expect(terrain.landCover(u, v + STREAM.swampM + 12)).toBe('FOREST');
      expect(terrain.canopy(u, v)).toBe(0);
      expect(terrain.canopy(u, v + STREAM.halfWidthM + 6)).toBeLessThan(0.9);
      // O leito fica ~4 m abaixo da média das duas margens (a 14 m do eixo).
      const banks = (terrain.elevation(u, v + 14) + terrain.elevation(u, v - 14)) / 2;
      expect(banks - terrain.elevation(u, v)).toBeGreaterThan(2);
    }
  });

  it('relevo de até 40 m e declives que a picape vence nas clareiras', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let u = 0; u <= lengthM; u += 10) {
      for (let v = 0; v <= widthM; v += 10) {
        const e = terrain.elevation(u, v);
        min = Math.min(min, e);
        max = Math.max(max, e);
      }
    }
    expect(max).toBeLessThanOrEqual(RELIEF_M);
    expect(max - min).toBeGreaterThan(30);
    expect(min).toBeGreaterThanOrEqual(-STREAM.carveM - 0.5);
    for (const c of CLEARINGS) {
      expect(terrain.slopePct(c.u, c.v)).toBeLessThan(getVehicle('PICKUP_4X4').maxSlopePct);
    }
  });

  it('uma copa aglutinada de 25–45 m a cada ~15 m, fora das clareiras e do igarapé', () => {
    const cells = ((lengthM * 1.4) / TREE_SPACING_M) * ((widthM * 1.4) / TREE_SPACING_M);
    expect(trees.length).toBeGreaterThan(cells * 0.8);
    expect(trees.length).toBeLessThan(cells);
    for (const t of trees) {
      expect(t.heightM).toBeGreaterThanOrEqual(TREE_HEIGHT_M[0]);
      expect(t.heightM).toBeLessThanOrEqual(TREE_HEIGHT_M[1]);
      expect(t.widthM).toBeGreaterThanOrEqual(11);
      expect(t.widthM).toBeLessThanOrEqual(15);
      expect(clearingAt(t.u, t.v, 3)).toBeUndefined();
      expect(streamDistance(t.u, t.v)).toBeGreaterThan(STREAM.halfWidthM);
    }
    // O MDS sobre uma copa passa de 25 m acima do chão.
    const t = trees[500] as (typeof trees)[number];
    expect(terrain.surface(t.u, t.v) - terrain.elevation(t.u, t.v)).toBeGreaterThan(20);
  });

  it('GCP só vale nas clareiras: a mata dá CANOPY e a picape chega a todas por trilha', () => {
    const pickup = [getVehicle('PICKUP_4X4')];
    const foot = [getVehicle('FOOT_BIKE')];
    for (const c of CLEARINGS) {
      expect(
        isAccessible(c.u, c.v, terrain, pickup, { paintMarkers: false }),
        `(${c.u}, ${c.v})`,
      ).toEqual({
        ok: true,
      });
      // As trilhas passam pelo centro das clareiras: a pé também se chega.
      expect(terrain.distanceToTrack(c.u, c.v)).toBeLessThan(4);
      expect(terrain.distanceToRoad(c.u, c.v)).toBeGreaterThan(100); // sem estradas, só trilhas
      expect(isAccessible(c.u, c.v, terrain, foot, { paintMarkers: false }).ok).toBe(true);
    }
    // Sob a mata nenhum veículo põe GCP: dossel acima de 0,6.
    expect(isAccessible(400, 330, terrain, pickup, { paintMarkers: false })).toEqual({
      ok: false,
      reason: 'CANOPY',
    });
    // Pintando os marcadores (regra de outro contrato), só a água segue inválida.
    expect(
      isAccessible(streamV(400) < 0 ? 0 : 400, streamV(400), terrain, pickup, {
        paintMarkers: true,
      }),
    ).toEqual({
      ok: false,
      reason: 'WATER',
    });
    expect(terrain.roads.every((r) => r.kind === 'TRAIL')).toBe(true);
  });

  it('trilhas de 3 m entram no campo de distâncias de 4 m em todo o traçado', () => {
    for (const trail of terrain.roads) {
      for (let k = 1; k < trail.points.length; k++) {
        const a = trail.points[k - 1] as { u: number; v: number };
        const b = trail.points[k] as { u: number; v: number };
        for (let f = 0; f <= 1; f += 0.02) {
          const u = a.u + (b.u - a.u) * f;
          const v = a.v + (b.v - a.v) * f;
          if (u < terrain.bounds.uMin || u > terrain.bounds.uMax) continue;
          expect(terrain.distanceToTrack(u, v), `(${u.toFixed(0)}, ${v.toFixed(0)})`).toBeLessThan(
            4,
          );
        }
      }
    }
  });

  it('o laser chega ao solo sob o dossel de 0,97: ~11 % dos pulsos (5 retornos), 100 % na clareira', () => {
    expect(groundReturnProbability(FOREST_CANOPY, 5)).toBeCloseTo(0.1076, 4);
    // 158,7 pts/m² do plano de referência → ~17 pts/m² de solo na mata, 158,7 na clareira.
    expect(groundDensity(158.7, FOREST_CANOPY, 5)).toBeCloseTo(17.08, 1);
    expect(groundDensity(158.7, 0, 5)).toBeCloseTo(158.7, 9);
    // Sem o laser (só foto), o solo precisaria aparecer em 2 fotos: (1 − c)² = 0,0009.
    expect((1 - FOREST_CANOPY) ** 2).toBeLessThan(0.001);
  });

  it('criação em poucas centenas de ms e elevation custa < 2 µs por chamada', () => {
    clearTerrainCache();
    const t0 = performance.now();
    const fresh = createTerrain(C03);
    expect(performance.now() - t0).toBeLessThan(1500);
    const start = performance.now();
    let acc = 0;
    for (let i = 0; i < 100_000; i++) acc += fresh.elevation(i % 1000, (i * 7) % 500);
    expect(acc).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
