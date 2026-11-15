import { CONTRACTS, initialContracts } from '@/data/contracts';
import { activeDimension, markerViews } from './markers';
import { WORLD_MAP } from './tiles';

const REAL = CONTRACTS.filter((c) => c.dimension === 'REAL');

describe('markerViews', () => {
  it('aba Real: só os contratos do catálogo, com o status salvo', () => {
    const views = markerViews(initialContracts(), 'REAL', []);
    expect(views.map((v) => v.contractId).sort()).toEqual(REAL.map((c) => c.id).sort());
    const c00 = WORLD_MAP.markers.find((m) => m.char === '0');
    expect(views.find((v) => v.contractId === 'C00')).toEqual({
      ...c00,
      contractId: 'C00',
      status: 'AVAILABLE',
    });
    // No jogo novo só o C00 está liberado; o resto aparece bloqueado.
    expect(views.filter((v) => v.status === 'AVAILABLE').map((v) => v.contractId)).toEqual(['C00']);
    const done = markerViews(
      { C00: { status: 'COMPLETED', completions: 1, bestScore: 1 } },
      'REAL',
      [],
    );
    expect(done.find((v) => v.contractId === 'C00')?.status).toBe('COMPLETED');
  });

  it('sem progresso salvo, o marcador aparece bloqueado; a aba Fendas só mostra as descobertas', () => {
    const views = markerViews({}, 'REAL', []);
    expect(views.length).toBeGreaterThan(0);
    expect(views.every((v) => v.status === 'LOCKED')).toBe(true);
    expect(markerViews(initialContracts(), 'RIFT', [])).toEqual([]);
    // Marcador sem contrato no catálogo não aparece.
    const orphan = {
      ...WORLD_MAP,
      markers: [{ char: '9', kind: 'CONTRACT' as const, x: 1, y: 1 }],
    };
    expect(markerViews({}, 'REAL', [], orphan)).toEqual([]);
  });
});

describe('activeDimension', () => {
  it('a aba das Fendas só vale depois da primeira descoberta', () => {
    expect(activeDimension({ dimensionTab: 'REAL', discoveredRifts: [] })).toBe('REAL');
    expect(activeDimension({ dimensionTab: 'RIFT', discoveredRifts: [] })).toBe('REAL');
    expect(activeDimension({ dimensionTab: 'REAL', discoveredRifts: ['R01'] })).toBe('REAL');
    expect(activeDimension({ dimensionTab: 'RIFT', discoveredRifts: ['R01'] })).toBe('RIFT');
  });
});
