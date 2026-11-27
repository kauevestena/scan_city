import {
  AUTOPILOT_COUNTER_AT_S,
  AUTOPILOT_COUNTER_UNTIL_S,
  autopilotCounter,
  autopilotInput,
} from './autopilot';

const IDLE = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };
const BASE = {
  x: 0,
  vLat: 0,
  driftMs: 0,
  alt: 60,
  targetAlt: 60,
  lateralMaxMs: 6,
  obstacleAhead: false,
  groundSpeedMs: 10,
  planSpeedMs: 10,
};

describe('autopilot: contragolpe nos dois eixos (ADR-035)', () => {
  it('de lado: abaixo do limiar antes da hora e comando cheio na janela', () => {
    const before = autopilotCounter({ ...IDLE, moveX: 1 }, -0.5, 'LATERAL', 1, 1.5, 0.5);
    expect(before.moveX).toBeCloseTo(0.4, 9);
    expect(autopilotCounter(IDLE, AUTOPILOT_COUNTER_AT_S, 'LATERAL', -1, 1.5, 0.5).moveX).toBe(-1);
    // Fora do aviso e depois da janela, o comando fica como estava.
    expect(autopilotCounter(IDLE, AUTOPILOT_COUNTER_UNTIL_S, 'LATERAL', 1, 1.5, 0.5)).toEqual(IDLE);
    expect(autopilotCounter(IDLE, -2, 'LATERAL', 1, 1.5, 0.5)).toEqual(IDLE);
  });

  it('na vertical: sobe (Q) contra a que desce e desce (E) contra a que sobe', () => {
    const climbing = { ...IDLE, altUp: 1 };
    expect(autopilotCounter(climbing, -0.5, 'VERTICAL', 1, 1.5, 0.5).altUp).toBeCloseTo(0.4, 9);
    expect(autopilotCounter(IDLE, 0, 'VERTICAL', 1, 1.5, 0.5)).toMatchObject({
      altUp: 1,
      altDown: 0,
    });
    const sinking = { ...IDLE, altDown: 1 };
    expect(autopilotCounter(sinking, -0.5, 'VERTICAL', -1, 1.5, 0.5).altDown).toBeCloseTo(0.4, 9);
    expect(autopilotCounter(IDLE, 0, 'VERTICAL', -1, 1.5, 0.5)).toMatchObject({
      altUp: 0,
      altDown: 1,
    });
  });

  it('sem TF, compensa o empurrão vertical que vê (o de agora e o que vem)', () => {
    const level = autopilotInput(BASE);
    expect(level.altUp).toBeCloseTo(0, 12);
    expect(level.altDown).toBeCloseTo(0, 12);
    // Descendente de 2,5 m/s com subida máxima de 5 m/s: meio comando para cima.
    const down = autopilotInput({ ...BASE, verticalDriftMs: -2.5, climbRateMs: 5 });
    expect(down.altUp).toBeCloseTo(0.5, 9);
    const coming = autopilotInput({ ...BASE, verticalPushChangeMs: 2, climbRateMs: 5 });
    expect(coming.altDown).toBeCloseTo(0.4, 9);
  });
});
