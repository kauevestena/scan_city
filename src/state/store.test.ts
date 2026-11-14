import { createDebugMission } from '@/app/debugFixtures';
import { resetGameStore } from '@/test/resetStore';
import {
  selectContractIdsByStatus,
  selectMoney,
  selectOwnsVehicle,
  selectPaused,
  selectPendingMission,
  selectScreen,
} from './selectors';
import { MAX_TRANSACTIONS } from './slices/playerSlice';
import { useGameStore } from './store';

const get = () => useGameStore.getState();

beforeEach(() => resetGameStore());

describe('estado inicial (progression §3)', () => {
  it('começa no escritório, com o equipamento herdado do avô', () => {
    const s = get();
    expect(s.session).toMatchObject({ screen: 'OFFICE', paused: false, toasts: [] });
    expect(s.player).toMatchObject({
      money: 500_000,
      level: 1,
      xp: 0,
      skillPoints: 0,
      reputation: 30,
    });
    expect(s.inventory.aircraft).toEqual(['ATLAS']);
    expect(s.inventory.sensors).toEqual(['CAM_PIGEON']);
    expect(s.inventory.vehicles).toEqual(['FOOT_BIKE']);
    expect(s.inventory.fieldEquipment).toEqual(['TOTAL_STATION']);
    expect(s.inventory.hardware).toBe('OLD_LAPTOP');
    expect(s.inventory.corn).toEqual({ stock: 20, crop: 10 });
    expect(s.inventory.equipped).toEqual({
      character: 'CHAR_VEST',
      dronePaint: 'PAINT_GREY',
      atlasAccessory: 'ATLAS_NONE',
    });
    expect(s.inventory.emblem).toMatchObject({ shape: 'SHIELD', icon: 'Compass', initials: 'GS' });
    expect(s.world.vehicleMode).toBe('FOOT_BIKE');
    expect(s.flags).toEqual({ introSeen: false, finaleSeen: false, tutorialStep: 0 });
    expect(s.mission).toEqual({ active: null, pending: [] });
  });
});

describe('session', () => {
  it('pausa, modais e toasts', () => {
    get().setPaused(true);
    expect(selectPaused(get())).toBe(true);
    get().openModal('briefing');
    expect(get().session.activeModal).toBe('briefing');
    get().closeModal();
    expect(get().session.activeModal).toBeNull();

    const a = get().pushToast({ type: 'info', title: 'A' });
    const b = get().pushToast({ type: 'money', title: 'B', body: 'corpo' });
    expect(a).not.toBe(b);
    expect(get().session.toasts.map((t) => t.title)).toEqual(['A', 'B']);
    get().dismissToast(a);
    expect(get().session.toasts.map((t) => t.id)).toEqual([b]);
    expect(selectScreen(get())).toBe('OFFICE');
  });
});

describe('player', () => {
  it('earn credita e registra a transação', () => {
    get().earn(250_000, 'Contrato C00');
    expect(selectMoney(get())).toBe(750_000);
    expect(get().session.transactions).toEqual([
      { at: expect.any(Number), amount: 250_000, reason: 'Contrato C00' },
    ]);
  });

  it('spend debita quando há saldo', () => {
    expect(get().spend(120_000, 'Milho')).toBe(true);
    expect(get().player.money).toBe(380_000);
    expect(get().session.transactions.at(-1)).toMatchObject({ amount: -120_000, reason: 'Milho' });
  });

  it('spend recusa sem saldo: não altera nada e avisa quanto falta', () => {
    expect(get().spend(900_000, 'PC Gamer')).toBe(false);
    expect(get().player.money).toBe(500_000);
    expect(get().session.transactions).toHaveLength(0);
    const toast = get().session.toasts.at(-1);
    expect(toast?.type).toBe('error');
    expect(toast?.title.replace(/\s/g, ' ')).toBe('Saldo insuficiente (faltam R$ 4.000,00)');
  });

  it('mantém só as últimas 50 transações', () => {
    for (let i = 0; i < MAX_TRANSACTIONS + 10; i++) get().earn(100, `t${i}`);
    expect(get().session.transactions).toHaveLength(MAX_TRANSACTIONS);
    expect(get().session.transactions[0]?.reason).toBe('t10');
  });

  it('a reputação fica entre 0 e 100', () => {
    get().changeReputation(5);
    expect(get().player.reputation).toBe(35);
    get().changeReputation(500);
    expect(get().player.reputation).toBe(100);
    get().changeReputation(-500);
    expect(get().player.reputation).toBe(0);
  });
});

describe('inventory', () => {
  it('equip só aceita cosméticos possuídos', () => {
    get().equip('dronePaint', 'PAINT_RADAR');
    expect(get().inventory.equipped.dronePaint).toBe('PAINT_GREY');
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, cosmetics: [...s.inventory.cosmetics, 'PAINT_RADAR'] },
    }));
    get().equip('dronePaint', 'PAINT_RADAR');
    expect(get().inventory.equipped.dronePaint).toBe('PAINT_RADAR');
  });

  it('setEmblem normaliza as iniciais (maiúsculas, ≤ 4)', () => {
    get().setEmblem({ ...get().inventory.emblem, shape: 'HEXAGON', initials: 'geosurvey' });
    expect(get().inventory.emblem).toMatchObject({ shape: 'HEXAGON', initials: 'GEOS' });
  });
});

describe('mission', () => {
  it('beginMission → queueActive → consumePending', () => {
    get().queueActive();
    expect(get().mission.pending).toHaveLength(0);

    const mission = createDebugMission('C00', true);
    get().beginMission({ ...mission, status: 'IN_FLIGHT' });
    expect(get().mission.active?.id).toBe(mission.id);

    get().queueActive();
    expect(get().mission.active).toBeNull();
    expect(get().mission.pending).toHaveLength(1);
    expect(get().mission.pending[0]?.status).toBe('PENDING_PROCESSING');
    expect(selectPendingMission(mission.id)(get())?.id).toBe(mission.id);

    expect(get().consumePending('inexistente')).toBeNull();
    expect(get().consumePending(mission.id)?.id).toBe(mission.id);
    expect(get().mission.pending).toHaveLength(0);
  });

  it('discardActive abandona a missão ativa', () => {
    get().beginMission(createDebugMission('C00', false));
    get().discardActive();
    expect(get().mission.active).toBeNull();
  });
});

describe('contracts e rival', () => {
  const seed = () =>
    useGameStore.setState((s) => ({
      contracts: {
        C05: { status: 'AVAILABLE', completions: 0, bestScore: 0 },
        C01: { status: 'COMPLETED', completions: 1, bestScore: 0.9 },
        C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 },
      },
      stats: { ...s.stats, contractsCompleted: 2 },
    }));

  it('steal marca o contrato como roubado e pontua a MegaMap', () => {
    seed();
    get().steal('C05');
    expect(get().contracts.C05).toMatchObject({ status: 'STOLEN', stolenAtCompletionCount: 2 });
    expect(get().rival.score).toBe(1);
    expect(get().rival.history).toEqual([
      { at: expect.any(Number), contractId: 'C05', kind: 'STEAL' },
    ]);
  });

  it('contratos desconhecidos são ignorados', () => {
    get().steal('C99');
    get().markStolen('C99');
    expect(get().rival.score).toBe(0);
    expect(get().contracts).toEqual({});
  });

  it('selectContractIdsByStatus é memoizado pela identidade de contracts', () => {
    seed();
    const completed = selectContractIdsByStatus('COMPLETED');
    const first = completed(get());
    expect(first).toEqual(['C00', 'C01']);
    get().earn(1, 'x');
    expect(completed(get())).toBe(first);
    expect(selectContractIdsByStatus('AVAILABLE')(get())).toEqual(['C05']);
  });
});

describe('museum', () => {
  it('setFeatured só destaca setores mapeados e aceita limpar', () => {
    get().setFeatured('REAL', 'C00');
    expect(get().museum.featured).toEqual({});
    useGameStore.setState((s) => ({
      museum: {
        ...s.museum,
        sectors: {
          C00: {
            contractId: 'C00',
            qualityScore: 0.8,
            mappedAt: 1,
            incomePerMinBRL: 1000,
            className: 'C',
          },
        },
      },
    }));
    get().setFeatured('REAL', 'C00');
    expect(get().museum.featured).toEqual({ REAL: 'C00' });
    get().setFeatured('REAL', null);
    expect(get().museum.featured).toEqual({});
  });
});

describe('world', () => {
  it('setAvatar faz merge parcial', () => {
    get().setAvatar({ x: 10, y: 20 });
    expect(get().world.avatar).toEqual({ x: 10, y: 20, facing: 'S' });
    get().setAvatar({ facing: 'E' });
    expect(get().world.avatar).toEqual({ x: 10, y: 20, facing: 'E' });
  });

  it('cycleVehicle percorre só os veículos possuídos', () => {
    expect(get().cycleVehicle()).toBe('FOOT_BIKE');
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, vehicles: ['FOOT_BIKE', 'LAB_VAN', 'COMPACT_CAR'] },
    }));
    expect(selectOwnsVehicle('LAB_VAN')(get())).toBe(true);
    expect(selectOwnsVehicle('PICKUP_4X4')(get())).toBe(false);
    expect(get().cycleVehicle()).toBe('COMPACT_CAR');
    expect(get().cycleVehicle()).toBe('LAB_VAN');
    expect(get().cycleVehicle()).toBe('FOOT_BIKE');
    expect(get().world.vehicleMode).toBe('FOOT_BIKE');
  });

  it('dimensão e fendas descobertas', () => {
    get().setDimensionTab('RIFT');
    expect(get().world.dimensionTab).toBe('RIFT');
    get().discoverRift('R01');
    get().discoverRift('R01');
    expect(get().world.discoveredRifts).toEqual(['R01']);
  });
});

describe('settings', () => {
  it('setSetting altera uma chave', () => {
    get().setSetting('masterVolume', 0.5);
    get().setSetting('reduceFlashes', true);
    expect(get().settings).toMatchObject({
      masterVolume: 0.5,
      reduceFlashes: true,
      quality: 'HIGH',
    });
  });
});
