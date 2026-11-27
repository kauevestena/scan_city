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
import { WORLD_MAP } from '@/world/overworld/tiles';

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

  it('addStats soma os deltas às estatísticas', () => {
    get().addStats({ distanceTiles: 1.5, photosTaken: 2 });
    get().addStats({ distanceTiles: 0.25 });
    expect(get().stats).toMatchObject({ distanceTiles: 1.75, photosTaken: 2, crashes: 0 });
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
  it('startMission cria a missão em planejamento com os padrões do plano', () => {
    const mission = get().startMission('C00', 0.85);
    expect(get().mission.active).toBe(mission);
    expect(mission).toMatchObject({
      contractId: 'C00',
      rivalAdjustment: 0.85,
      isReplay: false,
      status: 'PLANNING',
      fieldEquipmentId: 'TOTAL_STATION',
      groundPoints: [],
      shots: [],
    });
    expect(mission.id).toMatch(/^C00-\d+$/);
    // field-setup §5.3: Atlas recomendado e possuído, H = clamp(80) no teto de 80 m, p 75, q 65.
    expect(mission.plan.params).toMatchObject({
      aircraftId: 'ATLAS',
      sensorId: 'CAM_PIGEON',
      forwardOverlapPct: 75,
      sideOverlapPct: 65,
      lighting: 'SUN_HIGH',
    });
    expect(mission.plan.lines.length).toBeGreaterThan(0);
  });

  it('startMission de um contrato concluído é repetição', () => {
    useGameStore.setState((s) => ({
      contracts: { ...s.contracts, C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 } },
    }));
    expect(get().startMission('C00', 1).isReplay).toBe(true);
    expect(() => get().startMission('C99', 1)).toThrow(RangeError);
  });

  it('setFlightDifficulty grava a dificuldade na missão ativa (ADR-035)', () => {
    get().startMission('C00', 1);
    expect(get().mission.active?.difficulty).toBeUndefined();
    get().setFlightDifficulty('EASY');
    expect(get().mission.active?.difficulty).toBe('EASY');
  });

  it('updatePlan recalcula o plano; setGroundPoints troca os pontos', () => {
    const mission = get().startMission('C00', 1);
    get().updatePlan({
      ...mission.plan.params,
      heightM: 60,
      forwardOverlapPct: 70,
      sideOverlapPct: 60,
      speedMs: 10,
    });
    // G23: plano de referência do C00.
    const plan = get().mission.active?.plan;
    expect(plan?.stats.nLines).toBe(6);
    expect(plan?.stats.totalPhotos).toBe(96);
    const points = [{ id: 'GCP-01', kind: 'GCP' as const, u: 25, v: 20, elevM: 3, sigmaM: 0 }];
    get().setGroundPoints(points);
    expect(get().mission.active?.groundPoints).toEqual(points);
  });

  it('sem missão ativa, as ações de planejamento não fazem nada', () => {
    get().updatePlan(createDebugMission('C00', false).plan.params);
    get().setGroundPoints([]);
    expect(get().launchMission()).toBeNull();
    expect(get().mission.active).toBeNull();
  });

  it('launchMission: σ dos pontos, IN_FLIGHT e um voo da calibração do Atlas', () => {
    useGameStore.setState((s) => ({ inventory: { ...s.inventory, atlasCalibrationFlights: 3 } }));
    get().startMission('C00', 1);
    get().setGroundPoints([{ id: 'GCP-01', kind: 'GCP', u: 25, v: 20, elevM: 3, sigmaM: 0 }]);
    const launched = get().launchMission();
    // Estação total σ 1 cm, nivelamento padrão 0,5: σ = 1 × (1 + 2 × 0,5) = 2 cm.
    expect(launched?.groundPoints[0]?.sigmaM).toBeCloseTo(0.02, 9);
    expect(launched).toMatchObject({ status: 'IN_FLIGHT', atlasCalibrated: true });
    expect(get().inventory.atlasCalibrationFlights).toBe(2);
    expect(get().mission.active).toBe(launched);
    // Sem calibração restante, o Atlas voa descalibrado.
    useGameStore.setState((s) => ({ inventory: { ...s.inventory, atlasCalibrationFlights: 0 } }));
    get().startMission('C00', 1);
    expect(get().launchMission()?.atlasCalibrated).toBe(false);
    expect(get().inventory.atlasCalibrationFlights).toBe(0);
  });

  it('appendShots e endSortie: concluída guarda os dados e as linhas; queda descarta a surtida', () => {
    const debug = createDebugMission('C00', true);
    const shots = debug.shots.slice(0, 20);
    get().startMission('C00', 1);
    get().appendShots(shots.slice(0, 10));
    get().appendShots(shots.slice(10));
    get().appendShots([]);
    get().endSortie({ outcome: 'COMPLETED', durationS: 100, completedLines: [0, 1] });
    expect(get().mission.active).toMatchObject({
      completedLines: [0, 1],
      sorties: [{ index: 0, outcome: 'COMPLETED', durationS: 100 }],
    });
    expect(get().mission.active?.shots).toHaveLength(20);
    expect(get().stats).toMatchObject({ photosTaken: 20, flightTimeS: 100, crashes: 0 });

    // Segunda surtida cai: os disparos dela somem, os da primeira ficam.
    get().appendShots([{ ...(shots[0] as (typeof shots)[0]), i: 20, sortie: 1 }]);
    get().endSortie({ outcome: 'CRASH', durationS: 30, completedLines: [2] });
    expect(get().mission.active?.shots).toHaveLength(20);
    expect(get().mission.active?.completedLines).toEqual([0, 1]);
    expect(get().mission.active?.events.crashes).toBe(1);
    expect(get().stats).toMatchObject({ photosTaken: 20, flightTimeS: 130, crashes: 1 });
  });

  it('queda: descarta só os dados da surtida; as colisões ficam contadas', () => {
    const shots = createDebugMission('C00', true).shots;
    get().startMission('C00', 1);
    get().appendShots(shots.slice(0, 10));
    get().endSortie({ outcome: 'RTH', durationS: 50, completedLines: [0], collisions: 0 });
    get().appendShots(shots.slice(10, 15).map((s) => ({ ...s, sortie: 1 })));
    get().endSortie({ outcome: 'CRASH', durationS: 20, completedLines: [1], collisions: 3 });
    const m = get().mission.active;
    expect(m?.shots).toHaveLength(10);
    expect(m?.shots.every((s) => s.sortie === 0)).toBe(true);
    expect(m?.completedLines).toEqual([0]);
    expect(m?.events).toMatchObject({ crashes: 1, collisions: 3 });
  });

  it('milho: a decolagem enche o papo; a surtida gasta o que voou; a nova surtida realimenta', () => {
    useGameStore.setState((s) => ({ inventory: { ...s.inventory, corn: { stock: 20, crop: 3 } } }));
    get().startMission('C00', 1);
    get().launchMission();
    expect(get().inventory.corn).toEqual({ stock: 13, crop: 10 });
    get().endSortie({ outcome: 'RTH', durationS: 300, completedLines: [0], cornUsed: 4 });
    expect(get().inventory.corn).toEqual({ stock: 13, crop: 6 });
    // Nunca fica negativo.
    get().endSortie({ outcome: 'RTH', durationS: 10, completedLines: [], cornUsed: 99 });
    expect(get().inventory.corn.crop).toBe(0);
    expect(get().startNewSortie()).toBe(true);
    expect(get().inventory.corn).toEqual({ stock: 3, crop: 10 });
  });

  it('resumePlanning volta a missão ao planejamento; sem missão, nada muda', () => {
    get().startMission('C00', 1);
    get().launchMission();
    get().resumePlanning();
    expect(get().mission.active?.status).toBe('PLANNING');
    get().discardActive();
    get().resumePlanning();
    get().endSortie({ outcome: 'COMPLETED', durationS: 1, completedLines: [] });
    get().appendShots(createDebugMission('C00', true).shots.slice(0, 1));
    expect(get().mission.active).toBeNull();
  });

  it('novo jogo: C00 disponível', () => {
    expect(get().contracts.C00).toEqual({ status: 'AVAILABLE', completions: 0, bestScore: 0 });
  });

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
    const before = get().contracts;
    get().steal('C99');
    get().markStolen('C99');
    expect(get().rival.score).toBe(0);
    expect(get().contracts).toBe(before);
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
  it('novo jogo: o avatar começa no centro do tile de spawn `@`', () => {
    expect(get().world.avatar).toEqual({
      x: WORLD_MAP.spawn.x + 0.5,
      y: WORLD_MAP.spawn.y + 0.5,
      facing: 'S',
    });
  });

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

  it('grantXp sobe de nível com um toast por nível; addCorn e markFieldEvent', () => {
    get().grantXp(100);
    expect(get().player.level).toBe(2);
    expect(get().session.toasts.map((t) => t.title)).toContain('Nível 2! +1 ponto de habilidade');
    const xp = get().player.xp;
    get().grantXp(0);
    expect(get().player.xp).toBe(xp);

    const stock = get().inventory.corn.stock;
    get().addCorn(3);
    expect(get().inventory.corn.stock).toBe(stock + 3);
    get().addCorn(-1000);
    expect(get().inventory.corn.stock).toBe(0);

    get().markFieldEvent(1234);
    expect(get().world.lastEventAt).toBe(1234);
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
