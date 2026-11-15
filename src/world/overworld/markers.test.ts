import { initialContracts } from '@/data/contracts';
import { markerViews } from './markers';
import { parseMap, WORLD_MAP } from './tiles';

describe('markerViews', () => {
  it('aba Real: só os contratos do catálogo, com o status salvo', () => {
    const views = markerViews(initialContracts(), 'REAL', []);
    expect(views).toHaveLength(1);
    const c00 = WORLD_MAP.markers.find((m) => m.char === '0');
    expect(views[0]).toEqual({ ...c00, contractId: 'C00', status: 'AVAILABLE' });
    const done = markerViews(
      { C00: { status: 'COMPLETED', completions: 1, bestScore: 1 } },
      'REAL',
      [],
    );
    expect(done[0]?.status).toBe('COMPLETED');
  });

  it('sem progresso salvo, o marcador aparece bloqueado; a aba Fendas só mostra as descobertas', () => {
    expect(markerViews({}, 'REAL', [])[0]?.status).toBe('LOCKED');
    expect(markerViews(initialContracts(), 'RIFT', [])).toEqual([]);
    // Marcador sem contrato no catálogo não aparece.
    expect(markerViews({}, 'REAL', [], parseMap(['.1.']))).toEqual([]);
  });
});
