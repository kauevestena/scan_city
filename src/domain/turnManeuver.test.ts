import {
  initialManeuver,
  judgeTurn,
  MANEUVER_INPUT,
  SEQUENCE_GAP_S,
  stepManeuver,
  turnSideTo,
  windowCenterS,
  type ManeuverInput,
  type ManeuverState,
} from './turnManeuver';

const NONE: ManeuverInput = { forward: 0, lateral: 0, turnLeft: 0, turnRight: 0 };

/** Aplica uma sequência de comandos (um por passo, a cada `dt` s) e devolve os completados. */
function run(inputs: ManeuverInput[], dt = 0.05, start: ManeuverState = initialManeuver()) {
  let st = start;
  const done: Array<{ at: number; side: unknown }> = [];
  inputs.forEach((input, k) => {
    const r = stepManeuver(st, input, k * dt);
    st = r.state;
    if (r.done !== null) done.push({ at: k, side: r.done });
  });
  return { st, done };
}

const W = { forward: 1 };
const D = { lateral: 1 };
const A = { lateral: -1 };
const E = { turnRight: 1 };
const Q = { turnLeft: 1 };
const keys = (...parts: Array<Partial<ManeuverInput>>): ManeuverInput =>
  Object.assign({ ...NONE }, ...parts);

describe('manobra da curva: o acorde', () => {
  it('direita: W, E e D segurados juntos completam no toque que fecha o acorde', () => {
    const { done } = run([keys(W), keys(W, E), keys(W, E, D), keys(W, E, D)]);
    expect(done).toEqual([{ at: 2, side: 1 }]);
  });

  it('esquerda: W, A e Q, em qualquer ordem', () => {
    const { done } = run([keys(Q), keys(Q, A), keys(Q, A, W)]);
    expect(done).toEqual([{ at: 2, side: -1 }]);
  });

  it('segurar o acorde desde antes não é um começo novo; soltar e apertar de novo vale', () => {
    const held = run([keys(W, E, D)]).st;
    expect(run([keys(W, E, D), keys(W, E, D)], 0.05, held).done).toEqual([]);
    expect(run([keys(W, D), keys(W, E, D)], 0.05, held).done).toEqual([{ at: 1, side: 1 }]);
  });

  it('o analógico na diagonal (~0,7) conta; abaixo do limiar, não', () => {
    expect(MANEUVER_INPUT).toBe(0.5);
    const diagonal = { forward: 0.7, lateral: 0.7, turnLeft: 0, turnRight: 0.8 };
    expect(run([NONE, diagonal]).done).toEqual([{ at: 1, side: 1 }]);
    const weak = { forward: 0.4, lateral: 0.7, turnLeft: 0, turnRight: 1 };
    expect(run([NONE, weak]).done).toEqual([]);
  });

  it('apertar tudo dos dois lados de uma vez não escolhe lado', () => {
    const all = { forward: 1, lateral: 0, turnLeft: 1, turnRight: 1 };
    // Sem lado (MOVE_X = 0) nenhum acorde fecha.
    expect(run([NONE, all]).done).toEqual([]);
    // As duas sequências fechando no mesmo toque: os dois lados.
    const seq = run([keys(D), keys(A), keys(E), keys(Q), NONE, keys(W)]);
    expect(seq.done).toEqual([{ at: 5, side: 'BOTH' }]);
  });
});

describe('manobra da curva: a sequência', () => {
  it('D → E → W (soltando entre os toques) completa à direita no W', () => {
    const { done } = run([keys(D), NONE, keys(E), NONE, keys(W)]);
    expect(done).toEqual([{ at: 4, side: 1 }]);
  });

  it('A → Q → W completa à esquerda', () => {
    expect(run([keys(A), NONE, keys(Q), NONE, keys(W)]).done).toEqual([{ at: 4, side: -1 }]);
  });

  it('fora de ordem não completa; um toque fora de ordem no meio é ignorado', () => {
    expect(run([keys(E), NONE, keys(D), NONE, keys(W)]).done).toEqual([]);
    expect(run([keys(D), NONE, keys(W), NONE, keys(E), NONE, keys(W)]).done).toEqual([
      { at: 6, side: 1 },
    ]);
  });

  it('cada toque precisa vir em até 0,6 s do anterior', () => {
    expect(SEQUENCE_GAP_S).toBe(0.6);
    const slow: ManeuverInput[] = [keys(D), ...Array<ManeuverInput>(14).fill(NONE), keys(E)];
    // 15 passos de 0,05 s = 0,75 s entre D e E: a sequência recomeça e o W não fecha.
    expect(run([...slow, NONE, keys(W)]).done).toEqual([]);
    // Recomeçar pelo lado vale.
    expect(run([...slow, NONE, keys(D), NONE, keys(E), NONE, keys(W)]).done).toEqual([
      { at: 21, side: 1 },
    ]);
  });
});

describe('julgamento e lado da curva', () => {
  const window = { earlyS: 0.45, lateS: 0.3 };

  it('no tempo dentro da janela; cedo antes dela, tarde depois; o outro lado é lado errado', () => {
    expect(judgeTurn(1, 1, 0.45, window)).toBe('ON_TIME');
    expect(judgeTurn(1, 1, 0, window)).toBe('ON_TIME');
    expect(judgeTurn(1, 1, -0.3, window)).toBe('ON_TIME');
    expect(judgeTurn(1, 1, 0.46, window)).toBe('EARLY');
    expect(judgeTurn(1, 1, -0.31, window)).toBe('LATE');
    expect(judgeTurn(-1, 1, 0, window)).toBe('WRONG_SIDE');
    expect(judgeTurn('BOTH', -1, 0, window)).toBe('WRONG_SIDE');
  });

  it('o centro da janela fica um pouco antes do portal', () => {
    expect(windowCenterS(window)).toBeCloseTo(0.075, 9);
    expect(windowCenterS({ earlyS: 0.25, lateS: 0.15 })).toBeCloseTo(0.05, 9);
  });

  it('o lado é o da próxima faixa em relação ao fim da linha', () => {
    // Linha para +u (direita = +v): a próxima em v maior fica à direita.
    const end = { u: 300, v: 0 };
    const right = { u: 0, v: 1 };
    expect(turnSideTo(end, right, { u: 300, v: 30 })).toBe(1);
    expect(turnSideTo(end, right, { u: 300, v: -30 })).toBe(-1);
    // Logo atrás, na mesma reta: à direita.
    expect(turnSideTo(end, right, { u: 0, v: 0 })).toBe(1);
  });
});
