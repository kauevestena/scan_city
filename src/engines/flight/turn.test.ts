/**
 * A troca de faixa no motor (survey-flight §5.7, ADR-035): o portal da curva no fim de cada
 * linha, a manobra julgada na janela, a arremetida e o retorno automático.
 */
import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { DIFFICULTY } from '@/domain/difficulty';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { FlightDifficulty, MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import {
  FlightEngine,
  GO_AROUND_S,
  TURN_FAILSAFE_MISSES,
  type FlightEngineOptions,
  type FlightInputSource,
  type SortieResult,
  type TurnEvent,
} from './FlightEngine';
import type { FlightPhase } from './hudPublisher';

const terrain = createTerrain(C00);

function mission(difficulty?: FlightDifficulty): MissionData {
  return {
    id: 'T1',
    contractId: 'C00',
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    ...(difficulty ? { difficulty } : {}),
    plan: buildFlightPlan(referenceParams(C00), C00, CATALOG),
    groundPoints: [],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    shots: [],
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'IN_FLIGHT',
  };
}

type Axis = Parameters<FlightInputSource['axis']>[0];
type Keys = Partial<Record<Axis, number>>;

/**
 * Piloto de teste: sem comando na linha (calma: sem rajadas nem erro de entrada) e, na curva, a
 * manobra pedida quando o portal fica a `atS` segundos (reais), segurando por alguns passos.
 */
function setup(
  maneuver: (side: -1 | 1) => Keys[] | null,
  atS: number,
  over: Partial<FlightEngineOptions> = {},
) {
  const turns: TurnEvent[] = [];
  const phases: FlightPhase[] = [];
  const results: SortieResult[] = [];
  const hints: string[] = [];
  let script: Keys[] = [];
  const input: FlightInputSource = {
    axis: (a) => script[0]?.[a] ?? 0,
  };
  const engine = new FlightEngine({
    mission: mission(),
    contract: C00,
    terrain,
    catalog: CATALOG,
    input,
    mods: neutralModifiers(),
    ownsRtkKit: false,
    autopilot: false,
    calm: true,
    quality: () => 'LOW',
    reduceFlashes: () => true,
    colors: { primary: '#fff', secondary: '#000' },
    sortie: 0,
    shotOffset: 0,
    onTurn: (t) => turns.push(t),
    onPhase: (p) => phases.push(p),
    onSortieEnd: (r) => results.push(r),
    onHint: (h) => hints.push(h),
    ...over,
  });
  let armed = true;
  const step = () => {
    const t = engine.turnAhead();
    if (t && t.judged === null && armed && t.toGateS <= atS) {
      script = maneuver(t.side) ?? [];
      armed = false;
    }
    if (!t || t.judged !== null) armed = true;
    engine.update(1 / 60);
    script.shift();
  };
  return { e: engine, turns, phases, results, hints, step };
}

/** O acorde do lado (frente, lado e a tecla da curva), segurado por 6 passos. */
const chord = (side: -1 | 1): Keys[] =>
  Array<Keys>(6).fill({
    MOVE_Y: 1,
    MOVE_X: side,
    ...(side > 0 ? { TURN_RIGHT: 1 } : { TURN_LEFT: 1 }),
  });

/** A sequência lado → tecla → frente, soltando entre os toques. */
const sequence = (side: -1 | 1): Keys[] => [
  { MOVE_X: side },
  {},
  side > 0 ? { TURN_RIGHT: 1 } : { TURN_LEFT: 1 },
  {},
  { MOVE_Y: 1 },
];

function untilPhase(s: ReturnType<typeof setup>, phase: FlightPhase, maxS = 120) {
  for (let t = 0; t < maxS && s.e.phase !== phase && s.e.phase !== 'POST_FLIGHT'; t += 1 / 60)
    s.step();
}

describe('troca de faixa: a manobra na janela do portal da curva', () => {
  it('o acorde no tempo começa a curva para o lado da próxima faixa (direita, depois esquerda)', () => {
    const s = setup(chord, 0.1);
    untilPhase(s, 'TURN');
    expect(s.turns).toEqual([{ result: 'ON_TIME', side: 1 }]);
    untilPhase(s, 'RUN');
    untilPhase(s, 'TURN');
    expect(s.turns.at(-1)).toEqual({ result: 'ON_TIME', side: -1 });
    expect(s.phases).not.toContain('GO_AROUND');
  });

  it('a sequência (lado → tecla da curva → frente) também vale', () => {
    const s = setup(sequence, 0.25);
    untilPhase(s, 'TURN');
    expect(s.turns).toEqual([{ result: 'ON_TIME', side: 1 }]);
  });

  it('o piloto bom (autopilot) faz todas as curvas no tempo e a surtida termina', () => {
    const turns: TurnEvent[] = [];
    const s = setup(() => null, 0, { autopilot: true, onTurn: (t) => turns.push(t) });
    for (let t = 0; t < 900 && s.e.phase !== 'POST_FLIGHT'; t += 1 / 60) s.e.update(1 / 60);
    expect(turns.map((t) => t.result)).toEqual(Array(5).fill('ON_TIME'));
    expect(turns.map((t) => t.side)).toEqual([1, -1, 1, -1, 1]);
  });

  it('cedo demais: julgada na hora, e no portal a aeronave arremete e volta a ele', () => {
    const s = setup(chord, DIFFICULTY.MEDIUM.turnWindow.earlyS + 0.3);
    untilPhase(s, 'GO_AROUND');
    expect(s.turns[0]).toEqual({ result: 'EARLY', side: 1 });
    const energy = s.e.energy;
    expect(s.e.snapshot().turnMisses).toBe(1);
    expect(s.e.snapshot().lineReport).not.toBeNull();
    for (let t = 0; t < GO_AROUND_S + 0.1; t += 1 / 60) s.step();
    // De volta à mesma linha, alinhada, antes do portal: a volta custou energia.
    expect(s.e.phase).toBe('RUN');
    expect(s.e.line?.index).toBe(0);
    expect(s.e.ac.x).toBe(0);
    expect(s.e.turnNow()?.judged).toBeNull();
    expect(s.e.turnNow()?.toGateS).toBeGreaterThan(1);
    expect(s.e.energy).toBeLessThan(energy);
  });

  it('o lado errado não faz a curva', () => {
    const s = setup((side) => chord(side > 0 ? -1 : 1), 0.1);
    untilPhase(s, 'GO_AROUND');
    expect(s.turns[0]).toEqual({ result: 'WRONG_SIDE', side: 1 });
  });

  it('sem manobra: curva perdida (tarde), duas arremetidas e o retorno automático na terceira', () => {
    const s = setup(() => null, 0);
    for (let t = 0; t < 200 && s.e.phase !== 'POST_FLIGHT'; t += 1 / 60) s.step();
    expect(s.turns.map((t) => t.result)).toEqual(Array(TURN_FAILSAFE_MISSES).fill('LATE'));
    expect(s.phases.filter((p) => p === 'GO_AROUND')).toHaveLength(TURN_FAILSAFE_MISSES - 1);
    expect(s.phases).toContain('RETURNING');
    expect(s.results[0]?.outcome).toBe('RTH');
    expect(s.hints).toEqual(['Atlas cansou de rodar sem comando e voltou ao pombal.']);
  });

  it('na difícil a janela é mais curta: o mesmo acorde que vale na média sai cedo', () => {
    const atS = 0.35;
    expect(atS).toBeLessThan(DIFFICULTY.MEDIUM.turnWindow.earlyS);
    expect(atS).toBeGreaterThan(DIFFICULTY.HARD.turnWindow.earlyS);
    const medium = setup(chord, atS);
    untilPhase(medium, 'TURN');
    expect(medium.turns[0]?.result).toBe('ON_TIME');
    const hard = setup(chord, atS, { difficulty: 'HARD' });
    untilPhase(hard, 'GO_AROUND');
    expect(hard.turns[0]?.result).toBe('EARLY');
    expect(hard.e.difficulty).toBe('HARD');
  });

  it('o cruzeiro já está em ×1 quando o aviso da curva aparece', () => {
    const s = setup(chord, 0.1, { calm: true });
    let seen = false;
    for (let t = 0; t < 120 && s.e.phase !== 'TURN'; t += 1 / 60) {
      s.step();
      const turn = s.e.turnAhead();
      if (turn && turn.toGateS <= 3) {
        seen = true;
        expect(s.e.timeWarp).toBe(1);
      }
    }
    expect(seen).toBe(true);
  });

  it('a dificuldade vem da missão quando o motor não recebe outra', () => {
    const s = setup(() => null, 0, { mission: mission('EASY') });
    expect(s.e.difficulty).toBe('EASY');
    expect(s.e.timeScale).toBeCloseTo(DIFFICULTY.EASY.tempo, 9);
  });
});
