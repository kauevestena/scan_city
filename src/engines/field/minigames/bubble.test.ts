import { BUBBLE_LOCK_MIN_SCORE, BUBBLE_TARGET_R, BUBBLE_WINDOW_S } from '@/domain/minigameScoring';
import { BUBBLE_LIMIT_PX, BubbleSim, INPUT_ACCEL } from './bubble';

const DT = 1 / 60;

/** Jogador simulado: controle PD que empurra a bolha para o centro. */
function playPd(sim: BubbleSim, kp = 60, kd = 14): void {
  while (sim.phase === 'RUNNING') {
    const fx = (-kp * sim.pos.x - kd * sim.vel.x) / INPUT_ACCEL;
    const fy = (-kp * sim.pos.y - kd * sim.vel.y) / INPUT_ACCEL;
    sim.setInput({
      moveX: Math.max(-1, Math.min(1, fx)),
      moveY: Math.max(-1, Math.min(1, fy)),
    });
    sim.update(DT);
  }
}

describe('BubbleSim', () => {
  it('critério 5: com a bolha mantida no centro, levelScore ≥ 0,9', () => {
    for (const seed of [1, 7, 42, 1234, 99999]) {
      const sim = new BubbleSim(seed);
      playPd(sim);
      expect(sim.score, `seed ${seed}`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('travar por 3 s seguidos encerra antes dos 8 s', () => {
    const sim = new BubbleSim(7);
    playPd(sim);
    expect(sim.locked).toBe(true);
    expect(sim.elapsedS).toBeLessThan(BUBBLE_WINDOW_S);
    expect(sim.score).toBeGreaterThanOrEqual(BUBBLE_LOCK_MIN_SCORE);
  });

  it('sem entrada a deriva tira a bolha do alvo: o score médio fica bem abaixo do jogado', () => {
    const scores = [1, 2, 3, 4, 5, 6, 7, 42, 99, 1234].map((seed) => {
      const sim = new BubbleSim(seed);
      while (sim.phase === 'RUNNING') sim.update(DT);
      return sim.score;
    });
    expect(scores.reduce((s, v) => s + v, 0) / scores.length).toBeLessThan(0.5);
  });

  it('é determinística pela seed e a bolha nunca passa do raio de 150 px', () => {
    const run = (seed: number) => {
      const sim = new BubbleSim(seed);
      let maxD = 0;
      while (sim.phase === 'RUNNING') {
        sim.update(DT);
        maxD = Math.max(maxD, sim.distance);
      }
      return { score: sim.score, pos: sim.pos, maxD };
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5).pos).not.toEqual(run(6).pos);
    expect(run(5).maxD).toBeLessThanOrEqual(BUBBLE_LIMIT_PX + 1e-9);
  });

  it('o ponteiro arrastado puxa a bolha em direção a ele', () => {
    const sim = new BubbleSim(3);
    for (let i = 0; i < 90; i++) {
      sim.setInput({ moveX: 0, moveY: 0, pointer: { x: 0, y: 0 } });
      sim.update(DT);
    }
    expect(sim.distance).toBeLessThan(BUBBLE_LIMIT_PX / 3);
  });

  it('passos menores dão o mesmo tempo de janela e amostras cobrindo 8 s', () => {
    const sim = new BubbleSim(9);
    while (sim.phase === 'RUNNING') sim.update(1 / 120);
    expect(sim.samples.reduce((s, x) => s + x.dtS, 0)).toBeCloseTo(BUBBLE_WINDOW_S, 3);
    expect(BUBBLE_TARGET_R).toBe(18);
  });
});
