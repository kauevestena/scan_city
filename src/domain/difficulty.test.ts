import { mulberry32 } from '@/lib/rng';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY,
  difficultyParams,
  missionDifficulty,
} from './difficulty';
import { planDrafts, planGusts } from './gusts';

describe('dificuldade do voo (ADR-035)', () => {
  it('três níveis, a média por padrão (save antigo e missão sintética)', () => {
    expect(DIFFICULTIES).toEqual(['EASY', 'MEDIUM', 'HARD']);
    expect(DEFAULT_DIFFICULTY).toBe('MEDIUM');
    expect(missionDifficulty({})).toBe('MEDIUM');
    expect(missionDifficulty({ difficulty: 'HARD' })).toBe('HARD');
    expect(difficultyParams({ difficulty: 'EASY' })).toBe(DIFFICULTY.EASY);
  });

  it('a fácil é mais lenta e paga menos; a difícil, mais rápida e paga mais; a média é o voo de antes', () => {
    expect(DIFFICULTY.MEDIUM.tempo).toBe(1.75);
    expect(DIFFICULTY.EASY.tempo).toBeLessThan(DIFFICULTY.MEDIUM.tempo);
    expect(DIFFICULTY.HARD.tempo).toBeGreaterThan(DIFFICULTY.MEDIUM.tempo);
    expect(DIFFICULTY.MEDIUM.paymentFactor).toBe(1);
    expect(DIFFICULTY.EASY.paymentFactor).toBeLessThan(1);
    expect(DIFFICULTY.HARD.paymentFactor).toBeGreaterThan(1);
  });

  it('a fácil só tem vento horizontal; a difícil tem rajadas e correntes verticais mais frequentes', () => {
    expect(DIFFICULTY.EASY.verticalGustShare).toBe(0);
    expect(DIFFICULTY.EASY.draftPeriodS).toBeNull();
    expect(DIFFICULTY.MEDIUM.verticalGustShare).toBeGreaterThan(0);
    expect(DIFFICULTY.HARD.verticalGustShare).toBeGreaterThan(DIFFICULTY.MEDIUM.verticalGustShare);
    expect(DIFFICULTY.HARD.gustPeriodS).toBeLessThan(DIFFICULTY.MEDIUM.gustPeriodS);
    expect(DIFFICULTY.HARD.draftPeriodS ?? Infinity).toBeLessThan(
      DIFFICULTY.MEDIUM.draftPeriodS ?? Infinity,
    );
    // Numa linha de 60 s, as agendas de cada nível, somadas em 200 sementes.
    const count = (d: keyof typeof DIFFICULTY) => {
      const p = DIFFICULTY[d];
      let vertical = 0;
      let drafts = 0;
      for (let k = 0; k < 200; k++) {
        const ds = planDrafts(mulberry32(k), 60, 3, p.draftPeriodS);
        drafts += ds.length;
        const wind = { meanMs: 3, gustMs: 2, directionDeg: 90 };
        vertical += planGusts(mulberry32(1000 + k), wind, 0.5, 60, 3, {
          periodS: p.gustPeriodS,
          verticalShare: p.verticalGustShare,
          drafts: ds,
        }).filter((g) => g.vertical !== undefined).length;
      }
      return { vertical, drafts };
    };
    const easy = count('EASY');
    const medium = count('MEDIUM');
    const hard = count('HARD');
    expect(easy).toEqual({ vertical: 0, drafts: 0 });
    expect(medium.vertical).toBeGreaterThan(0);
    expect(medium.drafts).toBeGreaterThan(0);
    expect(hard.vertical).toBeGreaterThan(medium.vertical);
    expect(hard.drafts).toBeGreaterThan(medium.drafts);
  });

  it('a janela da curva aperta com a dificuldade', () => {
    const width = (d: keyof typeof DIFFICULTY) =>
      DIFFICULTY[d].turnWindow.earlyS + DIFFICULTY[d].turnWindow.lateS;
    expect(width('EASY')).toBeGreaterThan(width('MEDIUM'));
    expect(width('MEDIUM')).toBeGreaterThan(width('HARD'));
    for (const d of DIFFICULTIES) {
      // O centro fica antes do portal: o piloto bom completa um pouco antes da passagem.
      expect(DIFFICULTY[d].turnWindow.earlyS).toBeGreaterThan(DIFFICULTY[d].turnWindow.lateS);
    }
  });
});
