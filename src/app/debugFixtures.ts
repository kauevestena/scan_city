import { findTransition, type TransitionDef } from '@/state/machine';
import { useGameStore } from '@/state/store';
import type { GameStore, ScreenPayload } from '@/state/types';
import type {
  ContractProgress,
  FlightLine,
  FlightPlan,
  MissionData,
  MuseumSector,
  ScreenId,
  Shot,
} from '@/types';
import { AIRCRAFT, FIELD_EQUIPMENT, LENSES, PAYLOADS, SENSORS, VEHICLES } from '@/data/catalog';
import { COSMETICS } from '@/data/cosmetics';
import { CONTRACTS } from '@/data/contracts';
import type { DebugFlags } from './debugFlags';

/**
 * Estado e payloads de teste para depuração (architecture §7): o shell de telas,
 * `?screen=`, e as ações rápidas do painel F9. Nada aqui roda sem `?debug=1`,
 * exceto pelo `DebugScreenShell` enquanto houver telas sem implementação.
 */
export const DEBUG_CONTRACT_ID = 'C00';

/** Plano de referência do C00 (domain-math, golden value G23). */
function debugPlan(): FlightPlan {
  const spacingM = 32.907;
  const nLines = 6;
  const lengthM = 240;
  const widthM = 160;
  const leadM = 30;
  const v0 = (widthM - (nLines - 1) * spacingM) / 2;
  const lines: FlightLine[] = Array.from({ length: nLines }, (_, index) => {
    const direction: 1 | -1 = index % 2 === 0 ? 1 : -1;
    const v = v0 + index * spacingM;
    const a = { u: -leadM, v };
    const b = { u: lengthM + leadM, v };
    return {
      index,
      pass: 'PRIMARY',
      start: direction === 1 ? a : b,
      end: direction === 1 ? b : a,
      aoiStartS: leadM,
      aoiEndS: leadM + lengthM,
      direction,
    };
  });
  return {
    params: {
      aircraftId: 'ATLAS',
      sensorId: 'CAM_PIGEON',
      primarySensor: 'RGB',
      heightM: 60,
      forwardOverlapPct: 70,
      sideOverlapPct: 60,
      speedMs: 10,
      orientation: 'ALONG_LENGTH',
      crossGrid: false,
      terrainFollowing: false,
      lighting: 'SUN_HIGH',
    },
    lines,
    stats: {
      focalM: 0.0045,
      pixelPitchM: 0.00000189,
      gsdM: 0.025204,
      footprintWM: 82.267,
      footprintHM: 60.667,
      baseM: 18.2,
      spacingM,
      intervalS: 1.82,
      nLines,
      photosPerLine: 16,
      totalPhotos: 96,
      lineLengthM: lengthM + 2 * leadM,
      turnTimeS: 0,
      flightTimeS: 231.45,
      batteriesNeeded: 1,
      blurPx: 0,
      skewPx: 0,
    },
  };
}

function debugShots(plan: FlightPlan): Shot[] {
  const shots: Shot[] = [];
  for (const line of plan.lines) {
    for (let k = 0; k < plan.stats.photosPerLine; k++) {
      const along = k * plan.stats.baseM;
      shots.push({
        i: shots.length,
        t: shots.length * plan.stats.intervalS,
        sortie: 0,
        lineIndex: line.index,
        u: line.direction === 1 ? along : 240 - along,
        v: line.start.v,
        aglM: plan.params.heightM,
        altM: plan.params.heightM,
        speedMs: plan.params.speedMs,
        headingRad: line.direction === 1 ? 0 : Math.PI,
        crabRad: 0,
        tiltDeg: 0,
        footprintWM: plan.stats.footprintWM,
        footprintHM: plan.stats.footprintHM,
        blurPx: 0,
        skewPx: 0,
        blurred: false,
        lighting: plan.params.lighting,
        rtk: 'NONE',
        manual: false,
        overWater: false,
        inFog: false,
      });
    }
  }
  return shots;
}

let missionCounter = 0;

/** Missão de teste; com `withData`, inclui as 96 fotos do plano de referência. */
export function createDebugMission(contractId: string, withData: boolean): MissionData {
  const plan = debugPlan();
  const shots = withData ? debugShots(plan) : [];
  missionCounter += 1;
  return {
    id: `${contractId}-debug-${missionCounter}`,
    contractId,
    createdAt: Date.now(),
    rivalAdjustment: 1,
    isReplay: false,
    plan,
    groundPoints: [
      { id: 'GCP1', kind: 'GCP', u: 25, v: 20, elevM: 0, sigmaM: 0.01 },
      { id: 'GCP2', kind: 'GCP', u: 215, v: 20, elevM: 0, sigmaM: 0.01 },
      { id: 'GCP3', kind: 'GCP', u: 25, v: 140, elevM: 0, sigmaM: 0.01 },
      { id: 'GCP4', kind: 'GCP', u: 215, v: 140, elevM: 0, sigmaM: 0.01 },
      { id: 'GCP5', kind: 'GCP', u: 120, v: 80, elevM: 0, sigmaM: 0.01 },
      { id: 'CP1', kind: 'CP', u: 70, v: 50, elevM: 0, sigmaM: 0.01 },
      { id: 'CP2', kind: 'CP', u: 170, v: 110, elevM: 0, sigmaM: 0.01 },
    ],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: withData
      ? [{ index: 0, outcome: 'COMPLETED', durationS: plan.stats.flightTimeS }]
      : [],
    completedLines: withData ? plan.lines.map((l) => l.index) : [],
    shots,
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: withData ? 'PENDING_PROCESSING' : 'PLANNING',
  };
}

function debugSector(contractId: string): MuseumSector {
  return {
    contractId,
    qualityScore: 0.8,
    mappedAt: Date.now(),
    incomePerMinBRL: 1000,
    className: 'C',
  };
}

type Store = Pick<typeof useGameStore, 'getState' | 'setState'>;

function ensureActiveMission(store: Store, contractId: string, withData: boolean): MissionData {
  const current = store.getState().mission.active;
  const hasData = current !== null && current.shots.length > 0;
  if (current && current.contractId === contractId && hasData === withData) return current;
  const mission = { ...createDebugMission(contractId, withData), status: 'IN_FLIGHT' as const };
  store.getState().beginMission(mission);
  return mission;
}

/**
 * Prepara o estado para que a guarda da transição passe e devolve o payload mínimo de teste.
 */
export function prepareDebugTransition(
  def: TransitionDef,
  contractId: string = DEBUG_CONTRACT_ID,
  store: Store = useGameStore,
): ScreenPayload {
  const state = store.getState();
  switch (def.id) {
    case 'T4': {
      const mission = createDebugMission(contractId, true);
      store.setState({
        mission: { ...state.mission, pending: [...state.mission.pending, mission] },
      });
      return { missionId: mission.id, inField: false };
    }
    case 'T6': {
      const progress = state.contracts[contractId];
      const playable = progress?.status === 'AVAILABLE' || progress?.status === 'COMPLETED';
      store.setState({
        contracts: {
          ...state.contracts,
          [contractId]: playable ? progress : { status: 'AVAILABLE', completions: 0, bestScore: 0 },
        },
        mission: {
          ...state.mission,
          pending: state.mission.pending.filter((m) => m.contractId !== contractId),
        },
      });
      // Como o Aceitar do briefing: a missão nasce em planejamento.
      store.getState().startMission(contractId, 1);
      return { contractId, rivalAdjustment: 1 };
    }
    case 'T8':
    case 'T16':
      return { missionId: ensureActiveMission(store, contractId, false).id };
    case 'T9': {
      const mission = ensureActiveMission(store, contractId, true);
      const { inventory } = store.getState();
      if (!inventory.vehicles.includes('LAB_VAN')) {
        store.setState({
          inventory: { ...inventory, vehicles: [...inventory.vehicles, 'LAB_VAN'] },
        });
      }
      return { missionId: mission.id, inField: true };
    }
    case 'T10':
      return { outcome: 'ABORTED' };
    case 'T11': {
      if (!Object.hasOwn(state.museum.sectors, contractId)) {
        store.setState({
          museum: {
            ...state.museum,
            sectors: { ...state.museum.sectors, [contractId]: debugSector(contractId) },
          },
        });
      }
      return { focusSectorId: contractId };
    }
    default:
      return undefined;
  }
}

/** Payload de teste para abrir uma tela diretamente (`?debug=1&screen=X`). */
export function debugScreenPayload(
  screen: ScreenId,
  contractId: string = DEBUG_CONTRACT_ID,
  store: Store = useGameStore,
): ScreenPayload {
  switch (screen) {
    case 'FIELD_SETUP':
    case 'SURVEY_FLIGHT':
      return { missionId: ensureActiveMission(store, contractId, false).id };
    case 'PROCESSING_RESULTS': {
      const def = findTransition('OFFICE', 'PROCESSING_RESULTS');
      return def ? prepareDebugTransition(def, contractId, store) : undefined;
    }
    default:
      return undefined;
  }
}

/** Aplica as flags de depuração ao estado, uma vez, no boot. */
export function applyDebugFlags(flags: DebugFlags, store: Store = useGameStore): void {
  if (!flags.debug) return;
  const patch: Partial<GameStore> = {};
  const state = store.getState();
  if (flags.money !== null) {
    patch.player = { ...state.player, money: Math.max(0, Math.round(flags.money * 100)) };
  }
  if (flags.skipIntro) patch.flags = { ...state.flags, introSeen: true };
  if (flags.unlockAll) {
    // Todos os itens possuídos e todos os contratos disponíveis.
    patch.contracts = Object.fromEntries(
      CONTRACTS.map((c) => [
        c.id,
        state.contracts[c.id]?.status === 'COMPLETED'
          ? (state.contracts[c.id] as ContractProgress)
          : {
              completions: 0,
              bestScore: 0,
              ...state.contracts[c.id],
              status: 'AVAILABLE' as const,
            },
      ]),
    );
    patch.inventory = {
      ...state.inventory,
      aircraft: AIRCRAFT.map((a) => a.id),
      sensors: [...new Set([...state.inventory.sensors, ...SENSORS.map((s) => s.id)])],
      lenses: LENSES.map((l) => l.id),
      payloads: PAYLOADS.map((p) => p.id),
      vehicles: VEHICLES.map((v) => v.id),
      fieldEquipment: FIELD_EQUIPMENT.map((f) => f.id),
      hardware: 'CLOUD',
      cosmetics: COSMETICS.map((c) => c.id),
    };
  }
  if (Object.keys(patch).length > 0) store.setState(patch);

  if (flags.screen !== null && flags.screen !== 'UIKIT' && flags.screen !== 'SOUNDBOARD') {
    const screen = flags.screen;
    const payload = debugScreenPayload(screen, flags.contract ?? DEBUG_CONTRACT_ID, store);
    // Abertura direta de depuração: contorna a máquina de estados de propósito.
    store.setState((s) => ({ session: { ...s.session, screen, payload } }));
  }
}
