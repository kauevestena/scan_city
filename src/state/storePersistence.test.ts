import { createDebugMission } from '@/app/debugFixtures';
import { resetGameStore } from '@/test/resetStore';
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_INTERVAL_S, startAutosave } from './autosave';
import { createNewGame } from './initialState';
import { MIGRATIONS } from './migrations';
import { SAVE_BACKUP_KEY, SAVE_KEY, serializeSave, SETTINGS_KEY } from './persistence';
import { defaultSettings } from './slices/settingsSlice';
import { flushSave, hydrateGame, newGame, saveSettings, useGameStore } from './store';
import type { SaveGame } from '@/types';

const get = () => useGameStore.getState();
const stored = () => JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as SaveGame | null;

/** Simula o recarregamento da página: estado de fábrica + leitura do armazenamento. */
function reload() {
  useGameStore.setState(useGameStore.getInitialState(), true);
  return hydrateGame();
}

beforeEach(() => resetGameStore());
afterEach(() => vi.restoreAllMocks());

describe('save e load pela store', () => {
  it('as mudanças só chegam ao localStorage no flush', () => {
    get().earn(100_000, 'teste');
    expect(stored()).toBeNull();
    expect(flushSave()).toBe(true);
    expect(stored()?.player.money).toBe(600_000);
    expect(stored()?.version).toBe(1);
  });

  it('flush sem mudança pendente não grava nada', () => {
    hydrateGame();
    expect(flushSave()).toBe(true);
    expect(stored()).toBeNull();
  });

  it('round-trip: dinheiro, inventário, contratos, museu, fila e posição no mapa', () => {
    // Relógio parado: a renda offline do museu (R$ 10/min ≈ 1 centavo a cada 60 ms) não pode
    // depender do tempo que a montagem das missões de teste leva.
    const t0 = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(t0);
    const mission = createDebugMission('C00', true);
    get().earn(123_400, 'teste');
    get().setAvatar({ x: 12, y: 34, facing: 'E' });
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, vehicles: ['FOOT_BIKE', 'COMPACT_CAR'] },
      contracts: { C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 } },
      museum: {
        ...s.museum,
        sectors: {
          C00: {
            contractId: 'C00',
            qualityScore: 0.8,
            mappedAt: 9,
            incomePerMinBRL: 1000,
            className: 'C',
          },
        },
      },
      mission: { active: createDebugMission('C01', false), pending: [mission] },
      session: { ...s.session, screen: 'WORLD_MAP', paused: true },
    }));
    get().syncIncomeClock(t0);
    flushSave();

    expect(reload()).toMatchObject({ status: 'OK', migratedFrom: null });
    vi.restoreAllMocks();
    const s = get();
    expect(s.player.money).toBe(623_400);
    expect(s.inventory.vehicles).toEqual(['FOOT_BIKE', 'COMPACT_CAR']);
    expect(s.contracts.C00?.status).toBe('COMPLETED');
    expect(s.museum.sectors.C00?.qualityScore).toBe(0.8);
    expect(s.world.avatar).toEqual({ x: 12, y: 34, facing: 'E' });
    expect(s.mission.pending).toEqual([mission]);
    // O estado efêmero não é persistido: missão em voo, tela e pausa.
    expect(s.mission.active).toBeNull();
    expect(s.session).toMatchObject({ screen: 'OFFICE', paused: false });
    // Carregar não gera uma gravação pendente.
    localStorage.removeItem(SAVE_KEY);
    flushSave();
    expect(stored()).toBeNull();
  });

  it('JSON truncado → backup + novo jogo + toast de aviso', () => {
    const truncated = serializeSave({
      ...createNewGame(),
      player: { ...createNewGame().player, money: 1 },
    }).slice(0, 200);
    localStorage.setItem(SAVE_KEY, truncated);
    expect(reload().status).toBe('INVALID');
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe(truncated);
    expect(get().player.money).toBe(500_000);
    expect(get().session.toasts).toEqual([
      expect.objectContaining({ type: 'warn', title: 'Save inválido descartado' }),
    ]);
  });

  it('campo obrigatório ausente → backup + novo jogo + toast', () => {
    const { world: _world, ...broken } = createNewGame();
    const raw = JSON.stringify(broken);
    localStorage.setItem(SAVE_KEY, raw);
    expect(reload().status).toBe('INVALID');
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe(raw);
    expect(get().world.vehicleMode).toBe('FOOT_BIKE');
    expect(get().session.toasts).toHaveLength(1);
  });

  it('save v0 fictício é migrado ao carregar', () => {
    MIGRATIONS[0] = (old) => {
      const { coins, ...rest } = old as { coins: number } & Record<string, unknown>;
      return { ...rest, player: { ...(rest.player as object), money: coins * 100 } };
    };
    const v0 = JSON.parse(JSON.stringify(createNewGame())) as Record<string, unknown>;
    v0.version = 0;
    v0.coins = 321;
    delete (v0.player as Record<string, unknown>).money;
    localStorage.setItem(SAVE_KEY, JSON.stringify(v0));
    const result = reload();
    delete MIGRATIONS[0];
    expect(result).toMatchObject({ status: 'OK', migratedFrom: 0 });
    expect(get().player.money).toBe(32_100);
    expect(get().session.toasts).toHaveLength(0);
  });

  it('avisa uma vez quando o navegador recusa a gravação', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    get().earn(1, 'a');
    expect(flushSave()).toBe(false);
    get().earn(1, 'b');
    expect(flushSave()).toBe(false);
    expect(get().session.toasts.filter((t) => t.type === 'error')).toHaveLength(1);
    setItem.mockRestore();
    expect(flushSave()).toBe(true);
    expect(stored()?.player.money).toBe(500_002);
  });
});

describe('armazenamento do navegador indisponível (REQ-CORE-004)', () => {
  it('com o `localStorage` bloqueado, a partida abre, joga e avisa uma vez que não salva', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(reload()).toEqual({ status: 'EMPTY' });
    expect(get().player.money).toBe(500_000);
    expect(get().settings).toEqual(defaultSettings());
    get().earn(1, 'a');
    expect(flushSave()).toBe(false);
    get().earn(1, 'b');
    expect(flushSave()).toBe(false);
    expect(get().session.toasts.filter((t) => t.type === 'error')).toHaveLength(1);
    expect(() => newGame()).not.toThrow();
    expect(get().player.money).toBe(500_000);
  });

  it('com `getItem` quebrado, a partida abre vazia (um jogo novo) sem lançar', () => {
    localStorage.setItem(SAVE_KEY, serializeSave(createNewGame()));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('quebrado', 'InvalidStateError');
    });
    expect(reload()).toEqual({ status: 'EMPTY' });
    expect(get().player.money).toBe(500_000);
  });
});

describe('newGame', () => {
  it('faz backup, volta ao estado inicial e força a tela OFFICE', () => {
    get().earn(900_000, 'teste');
    get().goTo('WORLD_MAP');
    get().setPaused(true);
    flushSave();

    newGame();

    expect(JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY) ?? '{}')).toMatchObject({
      player: { money: 1_400_000 },
    });
    expect(get().player.money).toBe(500_000);
    expect(get().session).toMatchObject({ screen: 'OFFICE', paused: false, payload: undefined });
    expect(get().flags.introSeen).toBe(false);
    expect(stored()?.player.money).toBe(500_000);
  });

  it('as configurações sobrevivem ao novo jogo e ao recarregamento', () => {
    get().setSetting('masterVolume', 0.3);
    get().setSetting('reduceFlashes', true);
    expect(saveSettings()).toBe(true);
    newGame();
    expect(get().settings).toMatchObject({ masterVolume: 0.3, reduceFlashes: true });
    reload();
    expect(get().settings).toEqual({
      ...defaultSettings(),
      masterVolume: 0.3,
      reduceFlashes: true,
    });
  });
});

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('grava 1 s depois de uma troca de tela (debounce)', () => {
    const stop = startAutosave();
    get().earn(5000, 'teste');
    get().goTo('WORLD_MAP');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 100);
    get().goTo('OFFICE');
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 100);
    expect(stored()).toBeNull();
    vi.advanceTimersByTime(100);
    expect(stored()?.player.money).toBe(505_000);
    stop();
  });

  it('grava a cada 30 s de jogo não pausado', () => {
    const stop = startAutosave();
    get().earn(100, 'a');
    vi.advanceTimersByTime((AUTOSAVE_INTERVAL_S - 1) * 1000);
    expect(stored()).toBeNull();
    get().setPaused(true);
    vi.advanceTimersByTime(60_000);
    expect(stored()).toBeNull();
    get().setPaused(false);
    vi.advanceTimersByTime(1000);
    expect(stored()?.player.money).toBe(500_100);
    stop();
  });

  it('grava no beforeunload e as configurações na hora', () => {
    const stop = startAutosave();
    get().earn(700, 'a');
    window.dispatchEvent(new Event('beforeunload'));
    expect(stored()?.player.money).toBe(500_700);

    get().setSetting('muted', true);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toMatchObject({ muted: true });
    stop();
  });

  it('depois de parar, nada mais é gravado', () => {
    const stop = startAutosave();
    stop();
    get().earn(100, 'a');
    get().goTo('WORLD_MAP');
    window.dispatchEvent(new Event('beforeunload'));
    vi.advanceTimersByTime(120_000);
    expect(stored()).toBeNull();
  });
});
