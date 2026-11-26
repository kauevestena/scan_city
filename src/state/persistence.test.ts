import { createDebugMission } from '@/app/debugFixtures';
import type { LidarSample, SaveGame } from '@/types';
import { createNewGame, gameDataFromSave, saveFromGameData } from './initialState';
import { MIGRATIONS, migrateSave, SAVE_VERSION } from './migrations';
import {
  backupSave,
  compactMission,
  loadSave,
  loadSettings,
  MAX_SAVED_LIDAR_SAMPLES,
  removeSave,
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  serializeSave,
  SETTINGS_KEY,
  validateSave,
  writeSave,
  writeSettings,
} from './persistence';
import { defaultSettings } from './slices/settingsSlice';

beforeEach(() => localStorage.clear());

const fresh = () => createNewGame(1_700_000_000_000);

/** Cópia profunda do save com um caminho alterado (ou removido, com `undefined`). */
function mutated(path: string, value: unknown): unknown {
  const copy = JSON.parse(JSON.stringify(fresh())) as Record<string, unknown>;
  const keys = path.split('.');
  let node = copy;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  const last = keys.at(-1) as string;
  if (value === undefined) delete node[last];
  else node[last] = value;
  return copy;
}

describe('createNewGame (progression §3)', () => {
  it('gera um save válido com o estado inicial', () => {
    const save = fresh();
    expect(validateSave(save)).toBe(true);
    expect(save).toMatchObject({
      version: 1,
      createdAt: 1_700_000_000_000,
      player: { money: 500_000, level: 1, xp: 0, skillPoints: 0, reputation: 30 },
      staff: { INTERN: 0, JUNIOR_ENG: 0 },
      contracts: {},
      souvenirs: [],
      pendingMissions: [],
      flags: { introSeen: false, finaleSeen: false, tutorialStep: 0 },
    });
    expect(save.museum.lastIncomeAt).toBe(1_700_000_000_000);
  });

  it('gameDataFromSave e saveFromGameData são inversos', () => {
    const save: SaveGame = { ...fresh(), pendingMissions: [createDebugMission('C00', true)] };
    const data = gameDataFromSave(save);
    expect(data.mission).toEqual({ active: null, pending: save.pendingMissions });
    expect(saveFromGameData(data, save.updatedAt)).toEqual(save);
  });
});

describe('validateSave', () => {
  it('aceita um save com missões, contratos, setores e histórico', () => {
    const save: SaveGame = {
      ...fresh(),
      pendingMissions: [createDebugMission('C00', true)],
      contracts: { C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8, bestClass: 'C' } },
      museum: {
        ...fresh().museum,
        sectors: {
          C00: {
            contractId: 'C00',
            qualityScore: 0.8,
            mappedAt: 5,
            incomePerMinBRL: 1000,
            className: 'C',
          },
        },
        featured: { REAL: 'C00' },
      },
      rival: { score: 1, history: [{ at: 1, contractId: 'C05', kind: 'STEAL' }] },
    };
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toBe(true);
  });

  it.each([null, undefined, 42, 'save', []])('rejeita %j', (value) => {
    expect(validateSave(value)).toBe(false);
  });

  it.each([
    ['version', 2],
    ['createdAt', 'ontem'],
    ['player', undefined],
    ['player.money', '5000'],
    ['player.name', 7],
    ['skills', [1, 2]],
    ['staff.INTERN', undefined],
    ['inventory.aircraft', 'ATLAS'],
    ['inventory.equipped.dronePaint', undefined],
    ['inventory.emblem', null],
    ['inventory.corn.stock', NaN],
    ['inventory.atlasCalibrationFlights', undefined],
    ['contracts', { C00: { status: 'DONE', completions: 0, bestScore: 0 } }],
    ['contracts', { C00: { status: 'AVAILABLE' } }],
    ['museum.sectors', { C00: { contractId: 'C00' } }],
    ['museum.lastIncomeAt', undefined],
    ['souvenirs', undefined],
    ['pendingMissions', [{ id: 'x' }]],
    ['pendingMissions', {}],
    ['world.avatar.facing', 'NE'],
    ['world.dimensionTab', 'OUTRA'],
    ['world.discoveredRifts', undefined],
    ['rival.history', [{ at: 1, contractId: 'C00', kind: 'OUTRO' }]],
    ['rival.score', undefined],
    ['stats.crashes', undefined],
    ['flags.introSeen', 'sim'],
    ['flags.tutorialStep', undefined],
  ])('rejeita %s = %j', (path, value) => {
    expect(validateSave(mutated(path, value))).toBe(false);
  });
});

describe('migrateSave', () => {
  afterEach(() => {
    delete MIGRATIONS[0];
  });

  it('não altera um save na versão atual', () => {
    const save = { ...fresh() } as Record<string, unknown>;
    expect(migrateSave(save)).toEqual({ ok: true, save, from: SAVE_VERSION });
  });

  it('aplica a migração fictícia v0 → v1', () => {
    MIGRATIONS[0] = (old) => {
      const { cash, ...rest } = old as { cash: number } & Record<string, unknown>;
      const player = rest.player as Record<string, unknown>;
      return { ...rest, player: { ...player, money: cash * 100 } };
    };
    const v0 = mutated('player.money', undefined) as Record<string, unknown>;
    v0.version = 0;
    v0.cash = 77;
    const result = migrateSave(v0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.from).toBe(0);
      expect(result.save.version).toBe(1);
      expect(validateSave(result.save)).toBe(true);
      expect((result.save as unknown as SaveGame).player.money).toBe(7700);
    }
  });

  it('falha sem migração registrada, com versão futura ou versão inválida', () => {
    expect(migrateSave({ version: 0 })).toEqual({
      ok: false,
      reason: 'não há migração da versão 0',
    });
    expect(migrateSave({ version: 2 }).ok).toBe(false);
    expect(migrateSave({}).ok).toBe(false);
    expect(migrateSave({ version: 1.5 }).ok).toBe(false);
    expect(migrateSave({ version: -1 }).ok).toBe(false);
  });
});

describe('missão com dados de execução do voo (campos opcionais, sem migração)', () => {
  const mission = createDebugMission('C00', true);
  const pass = { lineIndex: 0, pass: 0, sortie: 0, counts: [10, 3, 1, 1], complete: true };

  it('o save anterior (sem `linePasses` nem `grade`) continua válido na versão 1', () => {
    expect(mission.linePasses).toBeUndefined();
    expect(mission.shots.every((s) => s.grade === undefined)).toBe(true);
    const save: SaveGame = { ...fresh(), pendingMissions: [mission] };
    expect(save.version).toBe(1);
    expect(validateSave(save)).toBe(true);
  });

  it('com passadas e notas: válido e idêntico depois de gravar e ler', () => {
    const graded = {
      ...mission,
      linePasses: [pass, { ...pass, lineIndex: 1, pass: 1, complete: false }],
      shots: mission.shots.map((s, i) => (i % 2 === 0 ? { ...s, grade: 'WEAK' as const } : s)),
    } as SaveGame['pendingMissions'][number];
    const save: SaveGame = { ...fresh(), pendingMissions: [graded] };
    expect(validateSave(save)).toBe(true);
    expect(writeSave(save)).toBe(true);
    expect(loadSave()).toEqual({ status: 'OK', save, migratedFrom: null });
  });

  it('passada malformada invalida o save', () => {
    const bad: unknown[] = [
      {},
      [{ lineIndex: 0 }],
      [{ ...pass, counts: [1, 2, 3] }],
      [{ ...pass, counts: [1, 2, 3, 'x'] }],
      [{ ...pass, complete: 'sim' }],
      [{ ...pass, sortie: undefined }],
    ];
    for (const linePasses of bad) {
      expect(
        validateSave({ ...fresh(), pendingMissions: [{ ...mission, linePasses }] }),
        JSON.stringify(linePasses),
      ).toBe(false);
    }
  });
});

describe('loadSave', () => {
  it('sem save, o resultado é EMPTY', () => {
    expect(loadSave()).toEqual({ status: 'EMPTY' });
  });

  it('round-trip: writeSave → loadSave devolve o mesmo save', () => {
    const save: SaveGame = { ...fresh(), pendingMissions: [createDebugMission('C00', true)] };
    expect(writeSave(save)).toBe(true);
    expect(loadSave()).toEqual({ status: 'OK', save, migratedFrom: null });
  });

  it('JSON truncado → backup criado e resultado INVALID', () => {
    const truncated = serializeSave(fresh()).slice(0, 120);
    localStorage.setItem(SAVE_KEY, truncated);
    expect(loadSave()).toEqual({ status: 'INVALID', reason: 'JSON inválido' });
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe(truncated);
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it('campo obrigatório ausente → backup criado e resultado INVALID', () => {
    const raw = JSON.stringify(mutated('inventory', undefined));
    localStorage.setItem(SAVE_KEY, raw);
    expect(loadSave().status).toBe('INVALID');
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe(raw);
  });

  it('JSON que não é objeto e versão futura também são inválidos', () => {
    localStorage.setItem(SAVE_KEY, '[1,2,3]');
    expect(loadSave().status).toBe('INVALID');
    const future = JSON.stringify({ ...fresh(), version: 99 });
    localStorage.setItem(SAVE_KEY, future);
    expect(loadSave().status).toBe('INVALID');
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe(future);
  });

  it('save de versão menor passa pelas migrações', () => {
    MIGRATIONS[0] = (old) => ({ ...old, souvenirs: [] });
    const v0 = mutated('souvenirs', undefined) as Record<string, unknown>;
    v0.version = 0;
    localStorage.setItem(SAVE_KEY, JSON.stringify(v0));
    const result = loadSave();
    delete MIGRATIONS[0];
    expect(result).toMatchObject({ status: 'OK', migratedFrom: 0 });
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBeNull();
  });

  it('writeSave devolve false quando o armazenamento recusa', () => {
    const full = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      },
    };
    expect(writeSave(fresh(), full)).toBe(false);
    expect(writeSettings(defaultSettings(), full)).toBe(false);
  });

  it('backupSave copia o save atual', () => {
    expect(backupSave()).toBe(false);
    writeSave(fresh());
    expect(backupSave()).toBe(true);
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBe(localStorage.getItem(SAVE_KEY));
  });
});

describe('compactMission', () => {
  const samples = (n: number): LidarSample[] =>
    Array.from({ length: n }, (_, i) => ({ u: i, v: 0, z: 0, ret: 'GROUND' }));
  const withLidar = (n: number) => ({
    ...createDebugMission('C00', true),
    lidar: {
      grid: { cols: 1, rows: 1, pulses: [0], firstAbove: [0], ground: [0], cellAreaM2: 1 },
      samples: samples(n),
    },
  });

  it('limita as amostras LiDAR a 8.000 no save, por amostragem uniforme', () => {
    const compact = compactMission(withLidar(50_000));
    expect(compact.lidar?.samples).toHaveLength(MAX_SAVED_LIDAR_SAMPLES);
    expect(compact.lidar?.samples[0]?.u).toBe(0);
    expect(compact.lidar?.samples.at(-1)?.u).toBeGreaterThan(49_000);
  });

  it('não mexe em missões dentro do limite ou sem LiDAR', () => {
    const small = withLidar(100);
    expect(compactMission(small)).toBe(small);
    const photoOnly = createDebugMission('C00', true);
    expect(compactMission(photoOnly)).toBe(photoOnly);
  });

  it('serializeSave aplica o limite', () => {
    const save: SaveGame = { ...fresh(), pendingMissions: [withLidar(9000)] };
    const parsed = JSON.parse(serializeSave(save)) as SaveGame;
    expect(parsed.pendingMissions[0]?.lidar?.samples).toHaveLength(MAX_SAVED_LIDAR_SAMPLES);
  });
});

describe('settings', () => {
  it('sem chave, JSON inválido ou valor não objeto → padrões', () => {
    expect(loadSettings()).toEqual(defaultSettings());
    localStorage.setItem(SETTINGS_KEY, '{quebrado');
    expect(loadSettings()).toEqual(defaultSettings());
    localStorage.setItem(SETTINGS_KEY, '"texto"');
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it('round-trip e saneamento de campos inválidos', () => {
    const custom = {
      ...defaultSettings(),
      masterVolume: 0.25,
      muted: true,
      quality: 'LOW' as const,
    };
    expect(writeSettings(custom)).toBe(true);
    expect(loadSettings()).toEqual(custom);

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ masterVolume: 7, sfxVolume: 'alto', quality: 'ULTRA', showFps: true }),
    );
    expect(loadSettings()).toEqual({ ...defaultSettings(), masterVolume: 1, showFps: true });
    expect(defaultSettings().gnssNav).toBe(true);
  });
});

describe('armazenamento do navegador indisponível (REQ-CORE-004)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('com `localStorage` lançando ao ser acessado (cookies bloqueados), lê vazio e recusa gravar, sem lançar', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(loadSave()).toEqual({ status: 'EMPTY' });
    expect(loadSettings()).toEqual(defaultSettings());
    expect(writeSave(fresh())).toBe(false);
    expect(writeSettings(defaultSettings())).toBe(false);
    expect(backupSave()).toBe(false);
    expect(() => removeSave()).not.toThrow();
  });

  it('com `getItem` e `removeItem` quebrados, a leitura é vazia e a remoção não lança', () => {
    localStorage.setItem(SAVE_KEY, serializeSave(fresh()));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('quebrado', 'InvalidStateError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('quebrado', 'InvalidStateError');
    });
    expect(loadSave()).toEqual({ status: 'EMPTY' });
    expect(loadSettings()).toEqual(defaultSettings());
    expect(backupSave()).toBe(false);
    expect(() => removeSave()).not.toThrow();
  });

  it('com a cota cheia, o backup falha sem lançar e um save inválido não é apagado sem cópia', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1,"player":');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });
    expect(backupSave()).toBe(false);
    expect(loadSave()).toMatchObject({ status: 'INVALID' });
    expect(localStorage.getItem(SAVE_KEY)).toBe('{"version":1,"player":');
    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBeNull();
  });
});
