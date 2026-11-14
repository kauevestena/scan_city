import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from '@/state/store';
import { applyDebugFlags, debugScreenPayload } from './debugFixtures';
import { getDebugFlags, NO_DEBUG, parseDebugFlags, resetDebugFlagsCache } from './debugFlags';

describe('parseDebugFlags', () => {
  it('sem debug=1, ignora todos os parâmetros', () => {
    expect(parseDebugFlags('')).toEqual(NO_DEBUG);
    expect(parseDebugFlags('?screen=UIKIT&money=999&unlockAll=1&skipIntro=1')).toEqual(NO_DEBUG);
    expect(parseDebugFlags('?debug=0&money=5')).toEqual(NO_DEBUG);
  });

  it('lê todos os parâmetros com debug=1', () => {
    expect(
      parseDebugFlags(
        '?debug=1&seed=42&screen=SURVEY_FLIGHT&contract=C01&autopilot=1&unlockAll=1&money=12345&skipIntro=1',
      ),
    ).toEqual({
      debug: true,
      seed: 42,
      screen: 'SURVEY_FLIGHT',
      contract: 'C01',
      autopilot: true,
      unlockAll: true,
      money: 12345,
      skipIntro: true,
    });
  });

  it('aceita as galerias e descarta valores inválidos', () => {
    expect(parseDebugFlags('?debug=1&screen=UIKIT').screen).toBe('UIKIT');
    expect(parseDebugFlags('?debug=1&screen=SOUNDBOARD').screen).toBe('SOUNDBOARD');
    const flags = parseDebugFlags('?debug=1&screen=NOPE&money=abc&seed=&contract=');
    expect(flags).toEqual({ ...NO_DEBUG, debug: true });
  });

  it('getDebugFlags lê a URL atual uma vez', () => {
    window.history.replaceState(null, '', '/?debug=1&money=7');
    resetDebugFlagsCache();
    expect(getDebugFlags().money).toBe(7);
    window.history.replaceState(null, '', '/');
    expect(getDebugFlags().money).toBe(7);
    resetDebugFlagsCache();
    expect(getDebugFlags()).toEqual(NO_DEBUG);
  });
});

describe('applyDebugFlags', () => {
  beforeEach(() => resetGameStore());
  const get = () => useGameStore.getState();

  it('não faz nada sem debug', () => {
    applyDebugFlags({ ...NO_DEBUG, money: 99, skipIntro: true, screen: 'WORLD_MAP' });
    expect(get().player.money).toBe(500_000);
    expect(get().flags.introSeen).toBe(false);
    expect(get().session.screen).toBe('OFFICE');
  });

  it('money define o saldo em reais e skipIntro marca a intro como vista', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&money=12345&skipIntro=1'));
    expect(get().player.money).toBe(1_234_500);
    expect(get().flags.introSeen).toBe(true);
    expect(get().session.screen).toBe('OFFICE');
  });

  it('screen abre a tela direto com um payload de teste', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&screen=SURVEY_FLIGHT'));
    expect(get().session.screen).toBe('SURVEY_FLIGHT');
    expect(get().mission.active?.contractId).toBe('C00');
    expect(get().session.payload).toEqual({ missionId: get().mission.active?.id });
  });

  it('contract escolhe o contrato do payload de teste', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&screen=PROCESSING_RESULTS&contract=C01'));
    expect(get().session.screen).toBe('PROCESSING_RESULTS');
    expect(get().mission.pending[0]?.contractId).toBe('C01');
    expect(get().session.payload).toEqual({
      missionId: get().mission.pending[0]?.id,
      inField: false,
    });
  });

  it('unlockAll dá todos os itens do catálogo', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&unlockAll=1'));
    const { inventory } = get();
    expect(inventory.aircraft).toEqual(['ATLAS', 'DRONE_T1', 'DRONE_T2', 'VTOL_T3']);
    expect(inventory.vehicles).toContain('LAB_VAN');
    expect(inventory.payloads).toEqual(['POD_LIDAR']);
    expect(inventory.fieldEquipment).toEqual(['TOTAL_STATION', 'GNSS_RTK_KIT']);
    expect(inventory.hardware).toBe('CLOUD');
    expect(inventory.sensors).toContain('CAM_THERMAL');
    expect(inventory.cosmetics).toContain('CHAR_GRANDPA_HAT');
  });

  it('as galerias não mexem na tela do jogo', () => {
    applyDebugFlags(parseDebugFlags('?debug=1&screen=UIKIT'));
    expect(get().session.screen).toBe('OFFICE');
  });

  it('telas sem payload de teste recebem undefined', () => {
    expect(debugScreenPayload('WORLD_MAP')).toBeUndefined();
    expect(debugScreenPayload('HOLO_TABLE_VIEW')).toBeUndefined();
    const first = debugScreenPayload('FIELD_SETUP');
    expect(debugScreenPayload('FIELD_SETUP')).toEqual(first);
  });
});
