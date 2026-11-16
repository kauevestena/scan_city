import { CONTRACTS } from '@/data/contracts';
import { museumSlot } from '@/data/contracts/museum';
import type { MuseumSector } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  BLOCK_Y,
  buildHoloScene,
  clearHoloCache,
  contourLines,
  CUBE_SIZE,
  dioramaOrigin,
  FLOAT_Y,
  HEIGHTMAP_RES,
  HOLO_MODES,
  hypsoColor,
  invalidateHoloSector,
  LOWER_QUALITY,
  MAX_BUILDINGS,
  OCEAN_SLOT,
  oceanWaves,
  PEDESTAL_Y,
  RELIEF_UNITS,
  RING_RADIUS,
  RING_RES,
  RING_SLOTS,
  RING_TABLE_RADIUS,
  ringCenter,
  slotOrigin,
  TABLE_RADIUS,
  trajectoryAt,
  wingOrigin,
  wireCube,
} from './sceneBuilder';

const sector: MuseumSector = {
  contractId: 'C00',
  qualityScore: 0.8,
  mappedAt: 0,
  incomePerMinBRL: 900,
  className: 'C',
};
const lines = [
  { start: { u: 0, v: 0 }, end: { u: 100, v: 0 } },
  { start: { u: 100, v: 10 }, end: { u: 0, v: 10 } },
];

beforeEach(() => clearHoloCache());

describe('buildHoloScene (REQ-HOL-002, REQ-HOL-003)', () => {
  it('nada mapeado: 7 setores em gesso (névoa) e o oceano no slot (3, 1)', () => {
    const scene = buildHoloScene({}, {}, 'LOW', createTerrain);
    expect(scene.sectors).toHaveLength(7);
    expect(scene.sectors.every((s) => !s.mapped && s.wire && s.topY === BLOCK_Y)).toBe(true);
    expect(scene.sectors.map((s) => s.slot)).not.toContain(OCEAN_SLOT);
    expect(scene.mappedCount).toBe(0);
    // O C00 existe no catálogo: o setor em névoa sabe de qual contrato é.
    expect(scene.sectors.find((s) => s.slot === museumSlot(2, 1))?.contract?.id).toBe('C00');
  });

  it('só o C00 mapeado: slot (2, 1) com relevo, prédios e a melhor missão; os outros 6 em gesso', () => {
    const scene = buildHoloScene(
      { C00: sector },
      {
        C00: {
          status: 'COMPLETED',
          completions: 1,
          bestScore: 0.8,
          bestMissionLines: lines,
          bestAircraftId: 'ATLAS',
        },
      },
      'HIGH',
      createTerrain,
    );
    const c00 = scene.sectors.find((s) => s.mapped);
    expect(scene.mappedCount).toBe(1);
    expect(c00?.slot).toBe(museumSlot(2, 1));
    const n = HEIGHTMAP_RES.HIGH;
    expect(c00?.mesh.quads.length).toBe((n * n + 4 * n) * 4);
    expect(c00?.topY).toBeCloseTo(BLOCK_Y + RELIEF_UNITS, 9);
    expect((c00?.buildings?.quads.length ?? 0) / 4 / 5).toBeLessThanOrEqual(MAX_BUILDINGS);
    expect(c00?.bestLines).toBe(lines);
    expect(c00?.bestAircraftId).toBe('ATLAS');
    expect(scene.sectors.filter((s) => !s.mapped)).toHaveLength(6);
    // Geometria em cache por (contrato, resolução).
    const again = buildHoloScene({ C00: sector }, {}, 'HIGH', createTerrain);
    expect(again.sectors.find((s) => s.mapped)?.mesh).toBe(c00?.mesh);
  });

  it('grade centrada: slots com espaço de 0,05', () => {
    const a = slotOrigin(0);
    const b = slotOrigin(1);
    expect(b.x0 - a.x0).toBeCloseTo(1.05, 9);
    expect(slotOrigin(4).z0 - a.z0).toBeCloseTo(1.05, 9);
    expect(a.x0 + slotOrigin(3).x0 + 1).toBeCloseTo(0, 9);
  });
});

describe('trajectoryAt (REQ-HOL-004)', () => {
  it('percorre as linhas em zigue-zague num ciclo de 12 s', () => {
    expect(trajectoryAt(lines, 0)).toEqual({ u: 0, v: 0, heading: 0 });
    // Comprimento total: 100 + 10 + 100 = 210; em 6 s, 105 percorridos (5 m na ligação).
    const mid = trajectoryAt(lines, 6);
    expect(mid.u).toBeCloseTo(100, 6);
    expect(mid.v).toBeCloseTo(5, 6);
    expect(mid.heading).toBeCloseTo(Math.PI / 2, 6);
    const back = trajectoryAt(lines, 9);
    expect(back.heading).toBeCloseTo(Math.PI, 6);
    expect(trajectoryAt(lines, 12)).toEqual(trajectoryAt(lines, 0));
    expect(trajectoryAt([], 3)).toEqual({ u: 0, v: 0, heading: 0 });
    expect(trajectoryAt(lines, -6).u).toBeCloseTo(100, 6);
  });
});

const mapped = (...ids: string[]): Record<string, MuseumSector> =>
  Object.fromEntries(
    ids.map((id) => [
      id,
      { contractId: id, qualityScore: 0.8, mappedAt: 0, incomePerMinBRL: 900, className: 'C' },
    ]),
  );
const done = (...ids: string[]) =>
  Object.fromEntries(
    ids.map((id) => [id, { status: 'COMPLETED' as const, completions: 1, bestScore: 0.8 }]),
  );

describe('modos de exibição (REQ-HOL-006)', () => {
  const scene = (mode: 'ORTHO' | 'HYPSO' | 'NEON', quality: 'LOW' | 'HIGH' = 'LOW') =>
    buildHoloScene(mapped('C00'), done('C00'), quality, createTerrain, CONTRACTS, { mode });
  const c00 = (mode: 'ORTHO' | 'HYPSO' | 'NEON') => scene(mode).sectors.find((s) => s.mapped);

  it('rampa hipsométrica: do verde ao branco, fora de [0, 1] fica preso nas pontas', () => {
    const low = hypsoColor(0);
    const high = hypsoColor(1);
    expect(low[1]).toBeGreaterThan(low[0]);
    expect(high.every((c) => c > 230)).toBe(true);
    expect(hypsoColor(-3)).toEqual(low);
    expect(hypsoColor(9)).toEqual(high);
    expect(hypsoColor(0.5)).not.toEqual(low);
  });

  it('ORTHO: cor da cobertura; sem curvas, pontos nem TIN', () => {
    const s = c00('ORTHO');
    expect(s?.mesh.quads.length).toBeGreaterThan(0);
    expect(s?.overlays).toEqual([]);
    expect(s?.points).toBeUndefined();
    expect(s?.buildingsAlpha).toBe(1);
  });

  it('HYPSO: mesma malha com a rampa hipsométrica, curvas de nível a cada 1/10 e prédios translúcidos', () => {
    const ortho = c00('ORTHO');
    const hypso = c00('HYPSO');
    expect(hypso?.mesh.quads).toEqual(ortho?.mesh.quads);
    expect(Array.from(hypso?.mesh.colors ?? [])).not.toEqual(Array.from(ortho?.mesh.colors ?? []));
    expect(hypso?.buildingsAlpha).toBeLessThan(1);
    const contours = hypso?.overlays?.[0];
    expect(contours?.segments.length ?? 0).toBeGreaterThan(0);
    // Cada curva fica numa altura k/10 do relevo (mais o pequeno deslocamento anti-z-fighting).
    const levels = new Set<number>();
    for (let k = 0; k < (contours?.positions.length ?? 0); k += 3) {
      levels.add(Math.round(((contours?.positions[k + 1] ?? 0) - BLOCK_Y - 0.002) * 1e4));
    }
    const expected = Array.from({ length: 9 }, (_, k) =>
      Math.round(((RELIEF_UNITS * (k + 1)) / 10) * 1e4),
    );
    expect(levels.size).toBeGreaterThan(0);
    for (const y of levels) expect(expected).toContain(y);
  });

  it('NEON: sem preenchimento; pontos ciano (um por amostra do heightmap) e TIN com glow', () => {
    const neon = c00('NEON');
    const n = HEIGHTMAP_RES.LOW;
    expect(neon?.mesh.quads.length).toBe(0);
    expect(neon?.buildings?.quads.length).toBe(0);
    expect(neon?.points?.positions.length).toBe((n + 1) * (n + 1) * 3);
    expect(neon?.points?.color).toContain('34, 211, 238');
    const tin = neon?.overlays?.[0];
    expect(tin?.segments.length ?? 0).toBeGreaterThan(0);
    expect(tin?.glow).toBeDefined();
    // O jitter não tira os pontos do setor.
    const { x0, z0 } = slotOrigin(museumSlot(2, 1));
    for (let k = 0; k < (neon?.points?.positions.length ?? 0); k += 3) {
      const x = neon?.points?.positions[k] ?? NaN;
      const z = neon?.points?.positions[k + 2] ?? NaN;
      expect(x).toBeGreaterThanOrEqual(x0 - 1e-6);
      expect(x).toBeLessThanOrEqual(x0 + 1 + 1e-6);
      expect(z).toBeGreaterThanOrEqual(z0 - 1e-6);
      expect(z).toBeLessThanOrEqual(z0 + 1 + 1e-6);
    }
  });

  it('NEON é determinístico (jitter com seed do contrato)', () => {
    const a = Array.from(c00('NEON')?.points?.positions ?? []);
    clearHoloCache();
    const b = Array.from(c00('NEON')?.points?.positions ?? []);
    expect(a).toEqual(b);
  });

  it('NEON: setores em gesso viram só wireframe e a mesa fica preta; o oceano some', () => {
    const neon = scene('NEON');
    const ortho = scene('ORTHO');
    expect(neon.sectors.filter((s) => !s.mapped).every((s) => s.mesh.quads.length === 0)).toBe(
      true,
    );
    expect(neon.sectors.filter((s) => !s.mapped).every((s) => s.wire)).toBe(true);
    expect(Array.from(neon.table.colors.subarray(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(ortho.table.colors.subarray(0, 3))).not.toEqual([0, 0, 0]);
    expect(neon.ocean?.mesh.quads.length).toBe(0);
    expect(ortho.ocean?.mesh.quads.length).toBeGreaterThan(0);
    expect(neon.mode).toBe('NEON');
  });

  it('NEON: prédios só em arestas emerald (12 por prédio)', () => {
    const scene = buildHoloScene(mapped('C01'), done('C01'), 'LOW', createTerrain, CONTRACTS, {
      mode: 'NEON',
    });
    const sector = scene.sectors.find((s) => s.mapped);
    const wire = sector?.overlays?.find((l) => l.color.includes('52, 211, 153'));
    expect(wire).toBeDefined();
    const buildings = (wire?.positions.length ?? 0) / 3 / 8;
    expect(buildings).toBeGreaterThan(0);
    expect(buildings).toBeLessThanOrEqual(MAX_BUILDINGS);
    expect(wire?.segments.length).toBe(buildings * 12 * 2);
  });

  it('a geometria é construída uma vez por contrato, resolução e modo', () => {
    const a = c00('HYPSO');
    expect(c00('HYPSO')?.mesh).toBe(a?.mesh);
    expect(c00('ORTHO')?.mesh).not.toBe(a?.mesh);
    // Invalidar o contrato reconstrói o setor (replay melhor, §7).
    invalidateHoloSector('C00');
    const rebuilt = c00('HYPSO');
    expect(rebuilt?.mesh).not.toBe(a?.mesh);
    expect(Array.from(rebuilt?.mesh.positions ?? [])).toEqual(Array.from(a?.mesh.positions ?? []));
    expect(HOLO_MODES).toEqual(['ORTHO', 'HYPSO', 'NEON']);
  });

  it('contourLines (marching squares): num plano inclinado, uma reta por nível', () => {
    const n = 10;
    const t: number[] = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) t.push(i / n);
    const lines = contourLines(t, n, 0, 0);
    // 9 níveis × 10 células por coluna.
    expect(lines.segments.length / 2).toBe(9 * n);
    // Nível 0,5: x = 0,5 em todos os vértices daquela altura.
    const yHalf = BLOCK_Y + RELIEF_UNITS * 0.5 + 0.002;
    let found = 0;
    for (let k = 0; k < lines.positions.length; k += 3) {
      if (Math.abs((lines.positions[k + 1] ?? 0) - yHalf) < 1e-6) {
        found++;
        expect(lines.positions[k]).toBeCloseTo(0.5, 6);
      }
    }
    expect(found).toBe(n * 2);
    // Terreno plano: nenhuma curva.
    expect(contourLines(new Array((n + 1) * (n + 1)).fill(0), n, 0, 0).segments.length).toBe(0);
  });

  it('contourLines: a sela (dois cantos opostos acima) gera dois segmentos na célula', () => {
    // Célula única 1 × 1: cantos (0,0) e (1,1) acima do nível 0,5; (1,0) e (0,1) abaixo.
    const t = [0.9, 0.1, 0.1, 0.9];
    const lines = contourLines(t, 1, 0, 0, 2);
    expect(lines.segments.length / 2).toBe(2);
  });
});

describe('Multiverso: anel de 11 dioramas (REQ-HOL-005)', () => {
  const ring = (ids: string[] = [], featured?: string) =>
    buildHoloScene(mapped(...ids), done(...ids), 'LOW', createTerrain, CONTRACTS, {
      dimension: 'RIFT',
      featured: featured ? { RIFT: featured } : {},
    });

  it('os 11 slots das fendas cobrem o anel inteiro, sem repetição', () => {
    const slots = CONTRACTS.filter((c) => c.museum.wing === 'RIFT')
      .map((c) => c.museum.slot)
      .sort((a, b) => a - b);
    expect(slots).toEqual(Array.from({ length: RING_SLOTS }, (_, k) => k));
  });

  it('só R01 mapeada: 1 diorama esculpido e 10 em cubo violeta; sem oceano', () => {
    const scene = ring(['R01']);
    expect(scene.dimension).toBe('RIFT');
    expect(scene.sectors).toHaveLength(RING_SLOTS);
    expect(scene.mappedCount).toBe(1);
    expect(scene.ocean).toBeUndefined();
    const r01 = scene.sectors.find((s) => s.mapped);
    expect(r01?.contract?.id).toBe('R01');
    expect(r01?.slot).toBe(0);
    expect(r01?.mesh.quads.length).toBeGreaterThan(0);
    const fog = scene.sectors.filter((s) => !s.mapped);
    expect(fog).toHaveLength(10);
    expect(fog.every((s) => s.cube === true && s.mesh.quads.length === 0)).toBe(true);
    expect(fog.every((s) => s.rim?.color.includes('139, 92, 246'))).toBe(true);
    // O mapeado também ganha a borda violeta, e todos flutuam.
    expect(r01?.rim?.color).toContain('139, 92, 246');
    expect(scene.sectors.every((s) => s.floating)).toBe(true);
  });

  it('a malha dos dioramas usa um nível a menos que a da grade Real (orçamento de quadro)', () => {
    for (const q of ['HIGH', 'MEDIUM', 'LOW'] as const) {
      expect(RING_RES[q]).toBeLessThan(HEIGHTMAP_RES[q]);
      clearHoloCache();
      const scene = buildHoloScene(mapped('R01'), done('R01'), q, createTerrain, CONTRACTS, {
        dimension: 'RIFT',
      });
      const n = RING_RES[q];
      expect(scene.sectors.find((s) => s.mapped)?.mesh.quads.length).toBe((n * n + 4 * n) * 4);
    }
    expect(RING_RES.HIGH).toBeGreaterThanOrEqual(HEIGHTMAP_RES.LOW);
  });

  it('dioramas a 3,5 do centro, distribuídos igualmente; a mesa cobre o anel', () => {
    const scene = ring();
    for (const s of scene.sectors) {
      expect(Math.hypot(s.x0 + 0.5, s.z0 + 0.5)).toBeCloseTo(RING_RADIUS, 9);
    }
    // Ângulo entre dioramas vizinhos: 360° / 11.
    const a0 = ringCenter(0);
    const a1 = ringCenter(1);
    const cos = (a0.x * a1.x + a0.z * a1.z) / RING_RADIUS ** 2;
    expect(Math.acos(cos)).toBeCloseTo((2 * Math.PI) / RING_SLOTS, 9);
    expect(scene.radius).toBe(RING_TABLE_RADIUS);
    expect(RING_TABLE_RADIUS).toBeGreaterThan(RING_RADIUS + Math.SQRT1_2);
    expect(buildHoloScene({}, {}, 'LOW', createTerrain).radius).toBe(TABLE_RADIUS);
    expect(wingOrigin('RIFT', 3)).toEqual(dioramaOrigin(3));
    expect(wingOrigin('REAL', 3)).toEqual(slotOrigin(3));
  });

  it('o diorama flutua; o cubo do diorama em névoa fica sobre ele (picking pela altura do meio)', () => {
    const scene = ring(['R01']);
    const r01 = scene.sectors.find((s) => s.mapped);
    expect(r01?.hover).toBe(FLOAT_Y);
    expect(r01?.center[1]).toBeCloseTo(FLOAT_Y + (r01?.topY ?? 0), 9);
    const cube = scene.sectors.find((s) => s.cube);
    expect(cube?.center[1]).toBeCloseTo(FLOAT_Y + CUBE_SIZE / 2, 9);
    expect(cube?.corners.every((c) => c[1] === FLOAT_Y + CUBE_SIZE / 2)).toBe(true);
  });

  it('wireCube: 8 vértices, 12 arestas, centro preservado ao girar', () => {
    const a = wireCube([1, 2, 3], 0.5, 0, 'c', 'g');
    const b = wireCube([1, 2, 3], 0.5, 0.7, 'c', 'g');
    expect(a.positions.length / 3).toBe(8);
    expect(a.segments.length / 2).toBe(12);
    for (const cube of [a, b]) {
      const mean = [0, 0, 0];
      for (let k = 0; k < 8; k++)
        for (let c = 0; c < 3; c++) mean[c] = (mean[c] ?? 0) + (cube.positions[k * 3 + c] ?? 0) / 8;
      expect(mean[0]).toBeCloseTo(1, 6);
      expect(mean[1]).toBeCloseTo(2, 6);
      expect(mean[2]).toBeCloseTo(3, 6);
    }
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
    expect(a.glow).toBe('g');
  });
});

describe('destaque: pedestal e holofote (REQ-HOL-007)', () => {
  it('Real: o setor destacado sobe no pedestal e ganha o cone de luz; os outros, não', () => {
    const scene = buildHoloScene(
      mapped('C00', 'C02'),
      done('C00', 'C02'),
      'LOW',
      createTerrain,
      CONTRACTS,
      { featured: { REAL: 'C00' } },
    );
    const featured = scene.sectors.filter((s) => s.featured);
    expect(featured).toHaveLength(1);
    const [c00] = featured;
    expect(c00?.contract?.id).toBe('C00');
    expect(c00?.hover).toBe(PEDESTAL_Y);
    expect(c00?.pedestal?.quads.length).toBeGreaterThan(0);
    // Cone: todas as faces apontam para cima/fora (visíveis de cima).
    const spot = c00?.spot;
    expect(spot?.quads.length).toBeGreaterThan(0);
    for (let q = 0; q < (spot?.quads.length ?? 0) / 4; q++)
      expect(spot?.normals[q * 3 + 1]).toBeGreaterThan(0);
    const others = scene.sectors.filter((s) => !s.featured);
    expect(others.every((s) => s.pedestal === undefined && s.spot === undefined)).toBe(true);
    expect(others.filter((s) => s.mapped).every((s) => s.hover === 0)).toBe(true);
  });

  it('o destaque de uma ala não afeta a outra', () => {
    const scene = buildHoloScene(
      mapped('C00', 'R01'),
      done('C00', 'R01'),
      'LOW',
      createTerrain,
      CONTRACTS,
      { dimension: 'RIFT', featured: { REAL: 'C00', RIFT: 'R01' } },
    );
    const r01 = scene.sectors.find((s) => s.mapped);
    expect(r01?.featured).toBe(true);
    // No anel, a ilha já flutua: o pedestal fica sob ela, sem erguê-la mais.
    expect(r01?.hover).toBe(FLOAT_Y);
    expect(scene.sectors.filter((s) => s.featured)).toHaveLength(1);
  });
});

describe('oceano e qualidade', () => {
  it('as ondas do oceano correm com o tempo', () => {
    const { x0, z0 } = slotOrigin(OCEAN_SLOT);
    const a = oceanWaves(x0, z0, 0);
    const b = oceanWaves(x0, z0, 0.5);
    expect(a.segments.length).toBeGreaterThan(0);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
    for (let k = 0; k < a.positions.length; k += 3) {
      expect(a.positions[k]).toBeGreaterThanOrEqual(x0 - 1e-6);
      expect(a.positions[k]).toBeLessThanOrEqual(x0 + 1 + 1e-6);
    }
  });

  it('a qualidade cai um nível por vez, até a mais baixa', () => {
    expect(LOWER_QUALITY).toEqual({ HIGH: 'MEDIUM', MEDIUM: 'LOW', LOW: null });
  });
});
