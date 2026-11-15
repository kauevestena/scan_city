/** `?unlockAll=1` também descobre as fendas (T059): a aba Fendas do mapa aparece na depuração. */
vi.mock('@/data/contracts', async (importOriginal) =>
  (await import('@/test/riftFixtures')).withTestRifts(await importOriginal()),
);

const { useGameStore } = await import('@/state/store');
const { resetGameStore } = await import('@/test/resetStore');
const { applyDebugFlags } = await import('./debugFixtures');
const { parseDebugFlags } = await import('./debugFlags');

const get = () => useGameStore.getState();

beforeEach(() => resetGameStore());

describe('applyDebugFlags — unlockAll e as fendas', () => {
  it('libera as fendas e as descobre, para a aba Fendas aparecer', () => {
    expect(get().world.discoveredRifts).toEqual([]);
    applyDebugFlags(parseDebugFlags('?debug=1&unlockAll=1'));
    expect(get().contracts.R01?.status).toBe('AVAILABLE');
    expect(get().contracts.R02?.status).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(['R01', 'R02']);
  });

  it('sem unlockAll, nenhuma fenda é descoberta', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&skipIntro=1'));
    expect(get().world.discoveredRifts).toEqual([]);
  });
});
