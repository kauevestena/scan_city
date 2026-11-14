import {
  BUBBLE_LOCK_MIN_SCORE,
  BUBBLE_TARGET_R,
  BUBBLE_WINDOW_S,
  bubbleWeight,
  scoreBubble,
  type BubbleSample,
} from './minigameScoring';

const flat = (d: number, seconds: number, dtS = 1 / 60): BubbleSample[] =>
  Array.from({ length: Math.round(seconds / dtS) }, () => ({ d, dtS }));

describe('bubbleWeight', () => {
  it('1 dentro do alvo, decaimento linear e 0 a 60 px além', () => {
    expect(bubbleWeight(0)).toBe(1);
    expect(bubbleWeight(BUBBLE_TARGET_R)).toBe(1);
    expect(bubbleWeight(BUBBLE_TARGET_R + 30)).toBeCloseTo(0.5, 10);
    expect(bubbleWeight(BUBBLE_TARGET_R + 60)).toBe(0);
    expect(bubbleWeight(200)).toBe(0);
  });
});

describe('scoreBubble', () => {
  it('janela cheia no centro dá 1; longe do alvo dá 0', () => {
    expect(scoreBubble(flat(0, BUBBLE_WINDOW_S))).toBeCloseTo(1, 6);
    expect(scoreBubble(flat(150, BUBBLE_WINDOW_S))).toBe(0);
  });

  it('integra o peso ao longo da janela: metade dentro, metade fora dá 0,5', () => {
    const samples = [...flat(5, 4), ...flat(150, 4)];
    expect(scoreBubble(samples)).toBeCloseTo(0.5, 6);
  });

  it('é independente do tamanho do passo', () => {
    const a = scoreBubble([...flat(30, 8, 1 / 60)]);
    const b = scoreBubble([...flat(30, 8, 1 / 120)]);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeCloseTo(1 - (30 - BUBBLE_TARGET_R) / 60, 6);
  });

  it('travou antes do fim: extrapola e nunca fica abaixo de 0,9', () => {
    expect(scoreBubble(flat(0, 3))).toBe(1);
    // Média parcial de 0,7 sobe para o piso.
    const early = [...flat(150, 1), ...flat(0, 3)];
    expect(scoreBubble(early)).toBe(BUBBLE_LOCK_MIN_SCORE);
  });

  it('sem amostras: 0', () => {
    expect(scoreBubble([])).toBe(0);
  });
});
