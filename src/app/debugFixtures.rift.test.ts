/** `?unlockAll=1` também descobre as fendas (T059): a aba Fendas do mapa aparece na depuração. */
import { CONTRACTS } from '@/data/contracts';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { applyDebugFlags } from './debugFixtures';
import { parseDebugFlags } from './debugFlags';

const get = () => useGameStore.getState();
const RIFT_IDS = CONTRACTS.filter((c) => c.dimension === 'RIFT').map((c) => c.id);

beforeEach(() => resetGameStore());

describe('applyDebugFlags — unlockAll e as fendas', () => {
  it('libera todas as fendas do catálogo e as descobre, para a aba Fendas aparecer', () => {
    expect(RIFT_IDS.length).toBeGreaterThanOrEqual(3);
    expect(get().world.discoveredRifts).toEqual([]);
    applyDebugFlags(parseDebugFlags('?debug=1&unlockAll=1'));
    for (const id of RIFT_IDS) expect(get().contracts[id]?.status, id).toBe('AVAILABLE');
    expect(get().world.discoveredRifts).toEqual(RIFT_IDS);
  });

  it('sem unlockAll, nenhuma fenda é descoberta', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&skipIntro=1'));
    expect(get().world.discoveredRifts).toEqual([]);
  });
});
