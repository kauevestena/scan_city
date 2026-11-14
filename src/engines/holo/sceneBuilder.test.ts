import { museumSlot } from '@/data/contracts/museum';
import type { MuseumSector } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  BLOCK_Y,
  buildHoloScene,
  clearHoloCache,
  HEIGHTMAP_RES,
  MAX_BUILDINGS,
  OCEAN_SLOT,
  RELIEF_UNITS,
  slotOrigin,
  trajectoryAt,
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
