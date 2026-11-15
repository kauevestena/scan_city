import { CATALOG, getVehicle } from '@/data/catalog';
import { R01 } from '@/data/contracts/rifts';
import { isAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { referenceParams } from '@/domain/referencePlan';
import { hitsObject } from '@/engines/flight/collision';
import { ringCollected } from '@/engines/flight/fieldElements';
import { clearTerrainCache, createTerrain } from '../createTerrain';
import { BIOMES } from './index';
import {
  ARCH_COUNT,
  ARCH_HEIGHT_M,
  ARCH_SITES,
  ARCH_SPAN_M,
  ARCH_WIDTH_M,
  CHECKER_M,
  CRESTS,
  FALL,
  hillHeight,
  PALM_COUNT,
  PALM_CROWN_M,
  PALM_HEIGHT_M,
  POOL_RADIUS_M,
  POOLS,
  RELIEF_M,
  RING_ARCS,
  RING_BASE_M,
  RING_COUNT,
  RING_DIAMETER_M,
  RINGS_PER_ARC,
  RIFT_GREEN_HILLS,
  ringSite,
  WAVELENGTH_M,
  waterAt,
} from './riftGreenHills';

const terrain = createTerrain(R01);
const { lengthM, widthM } = R01.aoi;
const ground = (u: number, v: number) => terrain.elevation(u, v);
const arches = terrain.objects.filter((o) => o.kind === 'STONE_ARCH');
const rings = terrain.objects.filter((o) => o.kind === 'RING');
const palms = terrain.objects.filter((o) => o.kind === 'TREE');

describe('createTerrain — RIFT_GREEN_HILLS (R01)', () => {
  it('a receita está registrada e é a do contrato', () => {
    expect(BIOMES.RIFT_GREEN_HILLS).toBe(RIFT_GREEN_HILLS);
    expect(terrain.biome).toBe('RIFT_GREEN_HILLS');
    expect(terrain.aoi).toEqual({ widthM: 200, lengthM: 400 });
  });

  it('determinismo: mesma seed → mesmos arcos, anéis, palmeiras e amostras', () => {
    clearTerrainCache();
    const again = createTerrain(R01);
    expect(again).not.toBe(terrain);
    expect(again.objects).toEqual(terrain.objects);
    expect(again.roads).toEqual(terrain.roads);
    for (let u = -60; u <= 460; u += 37) {
      for (let v = -30; v <= 230; v += 29) {
        expect(again.elevation(u, v)).toBe(terrain.elevation(u, v));
        expect(again.landCover(u, v)).toBe(terrain.landCover(u, v));
      }
    }
  });

  it('relevo de senoides cruzadas: 35 m de amplitude, 120 m de comprimento de onda', () => {
    expect([RELIEF_M, WAVELENGTH_M]).toEqual([35, 120]);
    expect(R01.terrainReliefM).toBe(RELIEF_M);
    // Cristas (35 m) e vales (0 m) nas posições da receita; o sampler devolve o mesmo relevo.
    expect(hillHeight(30, 30)).toBeCloseTo(35, 6);
    expect(hillHeight(90, 90)).toBeCloseTo(0, 6);
    expect(hillHeight(30, 90)).toBeCloseTo(17.5, 6);
    let lo = Infinity;
    let hi = -Infinity;
    for (let u = 0; u <= lengthM; u += 2) {
      for (let v = 0; v <= widthM; v += 2) {
        const e = ground(u, v);
        expect(e).toBeCloseTo(hillHeight(u, v), 9);
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
    }
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(34.5);
    expect(hi).toBeLessThanOrEqual(RELIEF_M);
    // Periódico em u e em v.
    for (const [u, v] of [
      [13, 41],
      [77, 133],
      [201, 9],
    ] as const) {
      expect(hillHeight(u + WAVELENGTH_M, v)).toBeCloseTo(hillHeight(u, v), 9);
      expect(hillHeight(u, v + WAVELENGTH_M)).toBeCloseTo(hillHeight(u, v), 9);
    }
  });

  it('relva em xadrez de 8 m, de dois verdes: GRASS (claro) e CROP (escuro) alternam por casa', () => {
    expect(CHECKER_M).toBe(8);
    const at = (i: number, j: number) =>
      terrain.landCover(i * CHECKER_M + CHECKER_M / 2, j * CHECKER_M + CHECKER_M / 2);
    // Fora das trilhas e da água: a casa (0, 0) é clara e as vizinhas alternam.
    expect([at(0, 0), at(1, 0), at(0, 1), at(1, 1)]).toEqual(['GRASS', 'CROP', 'CROP', 'GRASS']);
    expect([at(20, 14), at(21, 14), at(20, 15), at(21, 15)]).toEqual([
      'GRASS',
      'CROP',
      'CROP',
      'GRASS',
    ]);
    // Dentro de uma casa a cobertura é uma só.
    for (const [du, dv] of [
      [0.5, 0.5],
      [7.5, 0.5],
      [0.5, 7.5],
      [7.5, 7.5],
    ] as const) {
      expect(terrain.landCover(16 + du, 8 + dv)).toBe(terrain.landCover(20, 12));
    }
    const { palette } = terrain;
    expect(palette.cover.GRASS).not.toEqual(palette.cover.CROP);
    // As duas tonalidades são verdes (G domina) e a clara é mais luminosa.
    for (const rgb of [palette.cover.GRASS, palette.cover.CROP]) {
      expect(rgb[1]).toBeGreaterThan(rgb[0]);
      expect(rgb[1]).toBeGreaterThan(rgb[2]);
    }
    expect(palette.cover.GRASS[1]).toBeGreaterThan(palette.cover.CROP[1]);
    // Na AOI quase tudo é xadrez: metade e metade, e só uns 2 % de água.
    const counts: Record<string, number> = {};
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4) {
        const c = terrain.landCover(u, v);
        counts[c] = (counts[c] ?? 0) + 1;
      }
    }
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    expect((counts.GRASS ?? 0) / total).toBeGreaterThan(0.45);
    expect((counts.CROP ?? 0) / total).toBeGreaterThan(0.45);
    expect((counts.WATER ?? 0) / total).toBeLessThan(0.03);
  });

  it('três lagoas nos vales, cada uma com uma cachoeira que desce da crista', () => {
    expect(POOLS).toHaveLength(3);
    for (const p of POOLS) {
      // O fundo do vale é a cota 0 e a água cobre a lagoa inteira.
      expect(hillHeight(p.u, p.v)).toBeCloseTo(0, 6);
      expect(terrain.landCover(p.u, p.v)).toBe('WATER');
      expect(terrain.landCover(p.u + POOL_RADIUS_M - 1, p.v)).toBe('WATER');
      expect(terrain.landCover(p.u + POOL_RADIUS_M + 3, p.v)).not.toBe('WATER');
      // A cachoeira é uma faixa estreita ao longo de `u`, a montante da lagoa.
      const top = p.u - POOL_RADIUS_M - FALL.lengthM + 2;
      expect(waterAt(top, p.v)).toBe(true);
      expect(waterAt(top, p.v + FALL.widthM)).toBe(false);
      expect(waterAt(top - 6, p.v)).toBe(false);
      // Desce: a cabeceira é mais alta que a lagoa.
      expect(ground(top, p.v)).toBeGreaterThan(ground(p.u, p.v) + 8);
    }
    // A água não é miragem de ndvi: negativo, como nos outros biomas.
    expect(terrain.ndvi(POOLS[0]?.u ?? 0, POOLS[0]?.v ?? 0)).toBeLessThan(0);
    // Todos os pontos da água são WATER no sampler.
    expect(waterAt(0, 0)).toBe(false);
  });

  it('6 arcos de pedra de 20 a 30 m, com 12 m de vão livre entre as colunas', () => {
    expect(ARCH_COUNT).toBe(6);
    expect(arches).toHaveLength(ARCH_COUNT);
    // O sampler guarda os objetos ordenados por `u`.
    const byUv = (a: { u: number; v: number }, b: { u: number; v: number }) =>
      a.u - b.u || a.v - b.v;
    expect([...arches].sort(byUv).map((a) => [a.u, a.v])).toEqual(
      [...ARCH_SITES].sort(byUv).map((s) => [s.u, s.v]),
    );
    for (const a of arches) {
      expect(a.heightM).toBeGreaterThanOrEqual(ARCH_HEIGHT_M[0]);
      expect(a.heightM).toBeLessThanOrEqual(ARCH_HEIGHT_M[1]);
      expect(a.solid).toBe(true);
      expect(a.u).toBeGreaterThan(0);
      expect(a.u).toBeLessThan(lengthM);
      expect(a.v).toBeGreaterThan(0);
      expect(a.v).toBeLessThan(widthM);
      // Colunas de 20 % da largura: o vão entre elas é de 12 m.
      expect(a.widthM).toBe(ARCH_WIDTH_M);
      expect(a.widthM * (1 - 2 * 0.2)).toBeCloseTo(ARCH_SPAN_M, 9);
      expect(waterAt(a.u, a.v)).toBe(false);
    }
  });

  it('o vão é livre: passa-se por baixo da viga; as colunas e a viga colidem; por cima, o ar é livre', () => {
    const body = (u: number, v: number, alt: number) => ({ u, v, alt, radiusM: 0.5 });
    for (const a of arches) {
      const y0 = ground(a.u, a.v);
      const under = y0 + a.heightM * 0.4;
      // A largura do arco corre ao longo de `v` (rotação de 90°): o vão são ±6 m do centro.
      for (const dv of [0, -4, 4, 5]) {
        expect(hitsObject(body(a.u, a.v + dv, under), a, 0, ground), `vão ${dv}`).toBe(false);
      }
      // Uma linha de voo ao longo de `u`, pelo centro do vão, atravessa o arco sem tocá-lo.
      for (let du = -25; du <= 25; du += 0.5) {
        expect(hitsObject(body(a.u + du, a.v, under), a, 0, ground), `u ${du}`).toBe(false);
      }
      // As colunas ocupam de 6 a 10 m do centro, de cada lado.
      for (const dv of [-9, -7, 7, 9]) {
        expect(hitsObject(body(a.u, a.v + dv, under), a, 0, ground), `coluna ${dv}`).toBe(true);
      }
      // A viga fecha o topo (20 % da altura); acima do topo o corpo passa.
      expect(hitsObject(body(a.u, a.v, y0 + a.heightM * 0.9), a, 0, ground)).toBe(true);
      expect(hitsObject(body(a.u, a.v, y0 + a.heightM + 1), a, 0, ground)).toBe(false);
    }
  });

  it('40 anéis dourados em 5 arcos de 8, de 10 m nas pontas a 40 m no meio, não sólidos e coletáveis', () => {
    expect(RING_COUNT).toBe(40);
    expect(RING_ARCS).toHaveLength(5);
    expect(RING_ARCS.length * RINGS_PER_ARC).toBe(RING_COUNT);
    expect(rings).toHaveLength(RING_COUNT);
    for (const r of rings) {
      expect(r.solid).toBe(false);
      expect(r.collectible).toBe(true);
      expect(r.widthM).toBe(RING_DIAMETER_M);
      expect(r.baseM).toBeGreaterThanOrEqual(RING_BASE_M[0]);
      expect(r.baseM).toBeLessThanOrEqual(RING_BASE_M[1]);
      expect(r.u).toBeGreaterThan(0);
      expect(r.u).toBeLessThan(lengthM);
    }
    for (let arc = 0; arc < RING_ARCS.length; arc++) {
      const heights = Array.from({ length: RINGS_PER_ARC }, (_, k) => ringSite(arc, k).baseM);
      // O arco é simétrico: sobe das pontas (10 m) ao meio (≈ 40 m).
      expect(heights[0]).toBeCloseTo(RING_BASE_M[0], 6);
      expect(heights[RINGS_PER_ARC - 1]).toBeCloseTo(RING_BASE_M[0], 6);
      expect(Math.max(...heights)).toBeGreaterThan(38);
      expect(Math.max(...heights)).toBeLessThanOrEqual(RING_BASE_M[1]);
      for (let k = 0; k < RINGS_PER_ARC / 2; k++) {
        expect(heights[k]).toBeCloseTo(heights[RINGS_PER_ARC - 1 - k] as number, 6);
      }
      // Os anéis do arco estão no mundo, na ordem da receita.
      for (let k = 0; k < RINGS_PER_ARC; k++) {
        const site = ringSite(arc, k);
        expect(rings.some((r) => r.u === site.u && r.v === site.v && r.baseM === site.baseM)).toBe(
          true,
        );
      }
    }
  });

  it('cada arco de anéis corre sobre uma linha de voo do plano de referência', () => {
    const plan = buildFlightPlan(referenceParams(R01), R01, CATALOG);
    const lineVs = plan.lines.map((l) => l.start.v);
    for (const arc of RING_ARCS) {
      const nearest = Math.min(...lineVs.map((v) => Math.abs(v - arc.v)));
      expect(nearest).toBeLessThan(0.2);
    }
    // E cada linha só carrega um arco: cinco linhas distintas.
    expect(new Set(RING_ARCS.map((a) => a.v)).size).toBe(RING_ARCS.length);
  });

  it('o anel é coletado a menos de 3 m do centro e não além disso', () => {
    for (const r of rings.slice(0, 8)) {
      const cy = ground(r.u, r.v) + (r.baseM ?? 0) + r.heightM / 2;
      expect(ringCollected(r, { u: r.u, v: r.v, alt: cy }, ground)).toBe(true);
      expect(ringCollected(r, { u: r.u, v: r.v, alt: cy + 2.9 }, ground)).toBe(true);
      expect(ringCollected(r, { u: r.u, v: r.v, alt: cy + 3.1 }, ground)).toBe(false);
      expect(ringCollected(r, { u: r.u + 3.1, v: r.v, alt: cy }, ground)).toBe(false);
    }
  });

  it('48 palmeiras estilizadas, fora da água, das trilhas, dos arcos e das cristas de apoio', () => {
    expect(PALM_COUNT).toBe(48);
    expect(palms).toHaveLength(PALM_COUNT);
    for (const p of palms) {
      expect(p.widthM).toBeGreaterThanOrEqual(PALM_CROWN_M[0]);
      expect(p.widthM).toBeLessThanOrEqual(PALM_CROWN_M[1]);
      expect(p.heightM).toBeGreaterThanOrEqual(PALM_HEIGHT_M[0]);
      expect(p.heightM).toBeLessThanOrEqual(PALM_HEIGHT_M[1]);
      expect(waterAt(p.u, p.v)).toBe(false);
      expect(terrain.distanceToTrack(p.u, p.v)).toBeGreaterThan(3);
      for (const a of ARCH_SITES) expect(Math.hypot(p.u - a.u, p.v - a.v)).toBeGreaterThan(18);
      for (const c of CRESTS) expect(Math.hypot(p.u - c.u, p.v - c.v)).toBeGreaterThan(9);
      // Verdes de palmeira (G domina).
      expect(p.color[1]).toBeGreaterThan(p.color[0]);
      expect(p.color[1]).toBeGreaterThan(p.color[2]);
    }
  });

  it('a pé ou de bicicleta: as cristas planas dos pontos de apoio são acessíveis e as trilhas chegam a ≤ 60 m de tudo', () => {
    const foot = getVehicle('FOOT_BIKE');
    expect(terrain.guaranteedAccessible).toEqual(CRESTS.map((c) => ({ u: c.u, v: c.v })));
    for (const c of terrain.guaranteedAccessible) {
      expect(
        isAccessible(c.u, c.v, terrain, [foot], { paintMarkers: false }),
        `${c.u},${c.v}`,
      ).toEqual({ ok: true });
    }
    let farthest = 0;
    let ok = 0;
    let n = 0;
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4) {
        farthest = Math.max(farthest, terrain.distanceToTrack(u, v));
        n++;
        if (isAccessible(u, v, terrain, [foot], { paintMarkers: false }).ok) ok++;
      }
    }
    expect(farthest).toBeLessThanOrEqual(60);
    // As colinas são íngremes (máx. 65 %): só as cristas e os vales servem, mas há bastante deles.
    expect(ok / n).toBeGreaterThan(0.08);
    expect(ok / n).toBeLessThan(0.4);
  });

  it('as colinas são íngremes: o declive passa de 30 % na maior parte da AOI', () => {
    let steep = 0;
    let n = 0;
    let max = 0;
    for (let u = 0; u <= lengthM; u += 4) {
      for (let v = 0; v <= widthM; v += 4) {
        const s = terrain.slopePct(u, v);
        max = Math.max(max, s);
        n++;
        if (s > 30) steep++;
      }
    }
    expect(steep / n).toBeGreaterThan(0.6);
    // O máximo teórico é 35 · ¼ · (2π/120) · √2 ≈ 65 %.
    expect(max).toBeGreaterThan(55);
    expect(max).toBeLessThan(70);
  });
});
