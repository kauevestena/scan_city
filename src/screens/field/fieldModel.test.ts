import { getFieldEquipment, getVehicle } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { isAccessible } from '@/domain/accessibility';
import type { Contract, GroundPoint } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  accessRefusal,
  distribution,
  heightWarnRange,
  minimumPoints,
  movePoint,
  nextPointId,
  overlapWarnRange,
  placePoint,
  pointLimits,
  removePoint,
  suggestGcps,
} from './fieldModel';

const terrain = createTerrain(C00);
const FOOT = [getVehicle('FOOT_BIKE')];
const RULES = { paintMarkers: false };
const STATION = getFieldEquipment('TOTAL_STATION');
const gcp = (id: string, u: number, v: number): GroundPoint => ({
  id,
  kind: 'GCP',
  u,
  v,
  elevM: 0,
  sigmaM: 0,
});

describe('distribuição dos pontos (REQ-FLD-004)', () => {
  it('3 GCPs colineares: índice < 0,05, semáforo vermelho e dica sobre o Z', () => {
    const d = distribution([gcp('a', 20, 20), gcp('b', 120, 80), gcp('c', 220, 140)], C00);
    expect(d.collinearity).toBeLessThan(0.05);
    expect(d.light).toBe('RED');
    expect(d.hint).toBe('Pontos quase alinhados: o Z vai sofrer');
  });

  it('cantos + centro: verde; menos de 3 GCPs: vermelho; espalhamento parcial: âmbar', () => {
    const five = [
      gcp('a', 25, 20),
      gcp('b', 215, 20),
      gcp('c', 215, 140),
      gcp('d', 25, 140),
      gcp('e', 120, 80),
    ];
    const good = distribution(five, C00);
    expect(good).toMatchObject({
      gcps: 5,
      minGcp: 3,
      light: 'GREEN',
      hint: 'Boa distribuição: o ajuste fica firme',
    });
    expect(good.coverage).toBeGreaterThan(0.4);
    expect(distribution([gcp('a', 25, 20)], C00)).toMatchObject({
      light: 'RED',
      hint: 'Coloque ao menos 3 GCPs',
      coverage: 0,
    });
    const clustered = distribution([gcp('a', 100, 60), gcp('b', 140, 60), gcp('c', 120, 100)], C00);
    expect(clustered.light).toBe('AMBER');
    expect(clustered.hint).toBe('Distribua nos 4 cantos e no centro');
  });

  it('mínimos vêm dos requisitos do contrato', () => {
    expect(minimumPoints(C00, 'GCP')).toBe(3);
    expect(minimumPoints(C00, 'CP')).toBe(0);
  });
});

describe('acessibilidade dos pontos (REQ-FLD-003)', () => {
  it('só a pé, um ponto além do alcance é recusado com "Fora do alcance"', () => {
    expect(accessRefusal(-44, 188, terrain, FOOT, RULES)).toMatch(
      /^Fora do alcance \(18\d m da via mais próxima > 150 m\)$/,
    );
    // A picape alcança por estrada (rede ROADS) até mais longe.
    expect(accessRefusal(25, 20, terrain, FOOT, RULES)).toBeNull();
  });

  it('água, telhado e copa densa têm a mensagem do motivo', () => {
    const reasons = new Map<string, string>();
    for (let u = -40; u <= 280 && reasons.size < 3; u += 2) {
      for (let v = -30; v <= 190; v += 2) {
        const r = isAccessible(u, v, terrain, FOOT, RULES);
        if (!r.ok && r.reason && r.reason !== 'OUT_OF_REACH' && !reasons.has(r.reason)) {
          reasons.set(r.reason, accessRefusal(u, v, terrain, FOOT, RULES) ?? '');
        }
      }
    }
    expect(Object.fromEntries(reasons)).toEqual({
      WATER: 'Água',
      ROOF: 'Telhado',
      CANOPY: 'Copa densa (sem visada)',
    });
  });

  it('declividade e brejo, com os números do melhor veículo', () => {
    const steep = {
      ...terrain,
      slopePct: () => 45,
      landCover: () => 'GRASS' as const,
      canopy: () => 0,
      distanceToRoad: () => 1,
      distanceToTrack: () => 1,
    };
    expect(accessRefusal(0, 0, steep, FOOT, RULES)).toBe('Declividade 45 % > 30 %');
    const swamp = { ...steep, slopePct: () => 0, landCover: () => 'SWAMP' as const };
    expect(accessRefusal(0, 0, swamp, FOOT, RULES)).toBe('Brejo');
  });
});

describe('colocar, mover e remover (REQ-FLD-002)', () => {
  it('ids sequenciais por tipo, elevação do terreno e σ calculado só na decolagem', () => {
    const placed = placePoint([], 'GCP', { u: 25, v: 20 }, terrain, FOOT, RULES, STATION);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.points[0]).toMatchObject({
      id: 'GCP-01',
      kind: 'GCP',
      sigmaM: 0,
      elevM: terrain.elevation(25, 20),
    });
    const cp = placePoint(placed.points, 'CP', { u: 70, v: 50 }, terrain, FOOT, RULES, STATION);
    expect(cp.ok && cp.points.map((p) => p.id)).toEqual(['GCP-01', 'CP-01']);
    expect(nextPointId([gcp('GCP-01', 0, 0), gcp('GCP-03', 0, 0)], 'GCP')).toBe('GCP-02');
  });

  it('limite do instrumento (8 na Estação Total) e ponto inválido', () => {
    const eight = Array.from({ length: 8 }, (_, i) => gcp(`GCP-0${i + 1}`, 20 + i * 20, 80));
    expect(placePoint(eight, 'CP', { u: 30, v: 30 }, terrain, FOOT, RULES, STATION)).toEqual({
      ok: false,
      reason: 'Limite do instrumento (8)',
    });
    expect(placePoint([], 'GCP', { u: -44, v: 188 }, terrain, FOOT, RULES, STATION).ok).toBe(false);
  });

  it('mover revalida a acessibilidade; remover tira pelo id', () => {
    const pts = [gcp('GCP-01', 25, 20)];
    const moved = movePoint(pts, 'GCP-01', { u: 30, v: 25 }, terrain, FOOT, RULES);
    expect(moved.ok && moved.points[0]).toMatchObject({
      u: 30,
      v: 25,
      elevM: terrain.elevation(30, 25),
    });
    expect(movePoint(pts, 'GCP-01', { u: -44, v: 188 }, terrain, FOOT, RULES).ok).toBe(false);
    expect(removePoint(pts, 'GCP-01')).toEqual([]);
  });

  it('sugestão automática do C00: 5 GCPs acessíveis nos cantos e no centro, mantendo os CPs', () => {
    const cp: GroundPoint = { id: 'CP-01', kind: 'CP', u: 70, v: 50, elevM: 0, sigmaM: 0 };
    const points = suggestGcps([gcp('GCP-01', 1, 1), cp], C00, terrain, FOOT, RULES, STATION);
    expect(points.filter((p) => p.kind === 'GCP')).toHaveLength(5);
    expect(points).toContainEqual(cp);
    for (const p of points) expect(isAccessible(p.u, p.v, terrain, FOOT, RULES).ok).toBe(true);
    expect(distribution(points, C00).light).toBe('GREEN');
    // Respeita o limite do instrumento.
    expect(suggestGcps([], C00, terrain, FOOT, RULES, { maxPoints: 2 })).toHaveLength(2);
  });
});

describe('limites por instrumento (catalog §4)', () => {
  const at = (i: number): [number, number] => [20 + (i % 10) * 10, 20 + Math.floor(i / 10) * 10];
  const fill = (n: number, kind: GroundPoint['kind']): GroundPoint[] =>
    Array.from({ length: n }, (_, i) => ({ ...gcp(`${kind}-${i}`, ...at(i)), kind }));

  it('Estação Total: 8 pontos no total; com o kit GNSS entre os possuídos, valem os dele', () => {
    expect(pointLimits(['TOTAL_STATION'])).toEqual({ maxPoints: 8, gcp: 8, cp: 8 });
    expect(pointLimits(['TOTAL_STATION', 'GNSS_RTK_KIT'])).toEqual({
      maxPoints: 20,
      gcp: 12,
      cp: 8,
    });
  });

  it('GNSS: GCP ≤ 12, CP ≤ 8, total ≤ 20, cada recusa com o limite que estourou', () => {
    const limits = pointLimits(['GNSS_RTK_KIT']);
    const place = (pts: GroundPoint[], kind: GroundPoint['kind']) =>
      placePoint(pts, kind, { u: 100, v: 60 }, terrain, FOOT, RULES, limits);
    expect(place(fill(12, 'GCP'), 'GCP')).toEqual({
      ok: false,
      reason: 'Limite do instrumento (12)',
    });
    expect(place(fill(12, 'GCP'), 'CP').ok).toBe(true);
    expect(place([...fill(12, 'GCP'), ...fill(8, 'CP')], 'CP')).toEqual({
      ok: false,
      reason: 'Limite do instrumento (20)',
    });
    expect(place(fill(8, 'CP'), 'CP')).toEqual({ ok: false, reason: 'Limite do instrumento (8)' });
  });
});

describe('faixas de aviso dos sliders', () => {
  it('H: a partir da altura em que o GSD passa do máximo (C05 com DRONE_T1: 1,5 cm a ~54,7 m)', () => {
    const c05 = {
      requirements: [
        { id: 'x', label: '', severity: 'MAJOR', check: { type: 'MAX_GSD_CM', value: 1.5 } },
      ],
    } as Pick<Contract, 'requirements'>;
    // DRONE_T1 + CAM_20MP_RS: focal 8,8 mm, pixel 2,41 µm → GSD(55 m) = 1,508 cm.
    const range = heightWarnRange(c05, { focalM: 0.0088, pixelPitchM: 0.000002412 }, 120);
    expect(range?.[0]).toBeCloseTo(54.73, 1);
    expect(range?.[1]).toBe(120);
    expect(heightWarnRange(c05, { focalM: 0.0088, pixelPitchM: 0.000002412 }, 50)).toBeUndefined();
    expect(
      heightWarnRange({ requirements: [] }, { focalM: 1, pixelPitchM: 1 }, 100),
    ).toBeUndefined();
  });

  it('sobreposições abaixo do mínimo exigido', () => {
    expect(overlapWarnRange(C00, 'MIN_FORWARD_OVERLAP', 60)).toEqual([60, 64]);
    expect(overlapWarnRange(C00, 'MIN_SIDE_OVERLAP', 50)).toEqual([50, 54]);
    expect(overlapWarnRange({ requirements: [] }, 'MIN_SIDE_OVERLAP', 50)).toBeUndefined();
  });
});
