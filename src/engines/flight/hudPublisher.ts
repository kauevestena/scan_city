/**
 * Snapshot do HUD (survey-flight §6), publicado a 10 Hz para o React, e os alertas com
 * prioridade (§5.17): no máximo 2 visíveis.
 */
import type { GradeAxis } from '@/domain/execution';
import type { CounterResult } from '@/domain/gusts';
import type { TurnResult, TurnWindow } from '@/domain/turnManeuver';
import type { AoiPoint, FlightDifficulty, GradeCounts, RtkStatus, ShotGrade } from '@/types';

/**
 * `GO_AROUND`: a arremetida, quando a curva para a próxima faixa não saiu na janela; a aeronave
 * dá a volta e se aproxima de novo do portal da curva (survey-flight §5.7, ADR-035).
 */
export type FlightPhase =
  'TAKEOFF' | 'RUN' | 'TURN' | 'GO_AROUND' | 'LANDING' | 'RETURNING' | 'CRASHED' | 'POST_FLIGHT';

export type FlightAlertId =
  | 'CRASH_IMMINENT'
  | 'RTH'
  | 'DETECTED'
  | 'WIND_LIMIT'
  | 'OFF_ALTITUDE'
  | 'SPEED_LIMITED'
  | 'OVERLAP'
  | 'MOTION_BLUR'
  | 'LOW_LIGHT'
  | 'OUT_OF_LANE'
  | 'MIN_SPEED'
  | 'RTK_FLOAT'
  | 'ATLAS_DISTRACTED';

export interface FlightAlert {
  id: FlightAlertId;
  /** 1 = mais urgente. */
  priority: number;
  level: 'critical' | 'warn' | 'info';
  /**
   * Valor exibido: o overlap em %; na altura, quanto falta subir (positivo) ou descer; na
   * velocidade limitada, o sinal do vento (negativo de proa, positivo de cauda).
   */
  value?: number;
}

/** Prioridades de survey-flight §5.17: o que pede ação agora vem antes do que é só estado. */
const PRIORITY: Readonly<Record<FlightAlertId, [number, FlightAlert['level']]>> = {
  CRASH_IMMINENT: [1, 'critical'],
  RTH: [2, 'critical'],
  DETECTED: [3, 'critical'],
  ATLAS_DISTRACTED: [4, 'info'],
  WIND_LIMIT: [5, 'warn'],
  OUT_OF_LANE: [6, 'warn'],
  OFF_ALTITUDE: [7, 'warn'],
  OVERLAP: [8, 'warn'],
  MOTION_BLUR: [9, 'warn'],
  LOW_LIGHT: [9, 'warn'],
  SPEED_LIMITED: [10, 'info'],
  MIN_SPEED: [10, 'warn'],
  RTK_FLOAT: [11, 'info'],
};

export const MAX_ALERTS = 2;

export function makeAlert(id: FlightAlertId, value?: number): FlightAlert {
  const [priority, level] = PRIORITY[id];
  return { id, priority, level, ...(value === undefined ? {} : { value }) };
}

/** Os alertas mais urgentes, no máximo 2. */
export function topAlerts(alerts: readonly FlightAlert[]): FlightAlert[] {
  return [...alerts].sort((a, b) => a.priority - b.priority).slice(0, MAX_ALERTS);
}

export interface FlightHudSnapshot {
  phase: FlightPhase;
  aircraftName: string;
  sensorName: string;
  lineIndex: number;
  nLines: number;
  lineProgress: number;
  crossTrackM: number;
  outOfLane: boolean;
  altM: number;
  aglM: number;
  speedMs: number;
  windCrossMs: number;
  crabDeg: number;
  timeScale: number;
  energy: number;
  energyUnit: 'BATTERY' | 'CORN';
  cornLeft?: number;
  timeLeftS: number;
  rthAlert: boolean;
  /** Confirmação do RTH aberta (3 s). */
  rthConfirm: boolean;
  /** Interferência EM: glitch de scanlines no HUD. */
  emGlitch: boolean;
  hull: number;
  hullMax: number;
  rtk: RtkStatus;
  activeSensor: 'RGB' | 'LIDAR';
  gsdCm: number;
  gsdOk: boolean;
  pRealPct: number | null;
  qEstPct: number;
  photos: number;
  photosPlanned: number;
  /** Flashes do obturador mostrados na tela (0 com "Reduzir flashes e tremores", REQ-NFR-007). */
  flashes: number;
  blurPx: number;
  lidarDensity?: number;
  groundDensity?: number;
  alerts: FlightAlert[];
  /** Tempo seguido num cone de holofote, de 0 a 1 do limite. */
  detectedProgress?: number;
  /** Anéis coletados (regra `COLLECTIBLE_RINGS`). */
  rings?: number;
  /** Velocidade no solo de fato e a do plano (survey-flight §4). */
  groundSpeedMs: number;
  planSpeedMs: number;
  /** Altitude do corredor menos a da aeronave: positivo, falta subir. */
  corridorDeltaM: number;
  /** Abaixo desta diferença a seta de altura some (a zona da nota Perfeita, 5 % de H). */
  corridorTolM: number;
  /** Nota do instante (faixa, altura e avanço pela velocidade no solo). */
  grade: ShotGrade;
  /** A última amostra com nota; `seq` muda a cada amostra, para a marca na tela. */
  lastGrade: { grade: ShotGrade; axis: GradeAxis | null; seq: number } | null;
  /** Amostras seguidas com nota Boa ou Perfeita. */
  streak: number;
  /** Nota e letra da passada em curso; `null` antes da primeira amostra. */
  passScore: number | null;
  passLetter: string | null;
  /** A passada em curso é um revoo. */
  refly: boolean;
  /** Dificuldade do voo (ADR-035). */
  difficulty: FlightDifficulty;
  /**
   * Rajada avisada (`inS` > 0: a frente de vento está na cena) ou em curso: o eixo e para onde
   * empurra nele (de lado, +1 direita; na vertical, +1 para cima). O HUD não escreve o aviso
   * (ADR-034): a biruta só reage ao sopro.
   */
  gust: { side: -1 | 1; axis: 'LATERAL' | 'VERTICAL'; inS: number; active: boolean } | null;
  /** Corrente vertical avisada (`inS` > 0) ou em curso: +1 sobe, −1 desce. */
  draft: { dir: -1 | 1; inS: number; active: boolean } | null;
  /** O último contragolpe julgado; `seq` muda a cada um, para a marca na tela. */
  counter: {
    result: CounterResult;
    side: -1 | 1;
    axis: 'LATERAL' | 'VERTICAL';
    seq: number;
  } | null;
  /** Para a biruta: para onde o vento sopra, em relação à aeronave (0 = de cauda, 90 = para a direita). */
  windRelDeg: number;
  /** Empurrão vertical das rajadas e correntes em curso na aeronave (m/s, positivo para cima). */
  windVerticalMs: number;
  /**
   * A curva para a próxima linha (survey-flight §5.7): o lado, quanto falta até o portal da curva
   * (segundos reais; negativo depois dele), a janela e o julgamento.
   */
  turn: {
    side: -1 | 1;
    toGateS: number;
    window: TurnWindow;
    judged: TurnResult | null;
  } | null;
  /** A última manobra julgada; `seq` muda a cada uma, para a marca na tela. */
  lastTurn: { result: TurnResult; side: -1 | 1; seq: number } | null;
  /** Curvas perdidas seguidas (o retorno automático vem na terceira). */
  turnMisses: number;
  /** Cruzeiro automático: ligado pelo jogador e o fator de tempo do momento. */
  cruise: { on: boolean; factor: number };
  /** Boletim da passada que acabou de fechar (durante a curva, o retorno e o pouso). */
  lineReport: {
    lineNumber: number;
    pass: number;
    score: number;
    letter: string;
    counts: GradeCounts;
    accepted: boolean;
  } | null;
  minimap: {
    lines: Array<[AoiPoint, AoiPoint]>;
    shots: AoiPoint[];
    pos: AoiPoint;
    heading: number;
  };
}

export const HUD_INTERVAL_MS = 100;

/** Limita a publicação a 10 Hz de tempo real (com aceleração, a simulação corre mais). */
export class HudThrottle {
  private last = -Infinity;

  shouldPublish(nowMs: number, force = false): boolean {
    if (!force && nowMs - this.last < HUD_INTERVAL_MS) return false;
    this.last = nowMs;
    return true;
  }
}
