import { gradeTone, PENTATONIC } from './gradeScale';

describe('gradeTone (audio §4)', () => {
  it('Perfeitas seguidas sobem a pentatônica até a oitava e param lá', () => {
    let degree = -1;
    const pitches: number[] = [];
    for (let i = 0; i < 8; i++) {
      const t = gradeTone(degree, 'PERFECT');
      expect(t.sfx).toBe('GRADE');
      pitches.push(t.pitch);
      degree = t.degree;
    }
    expect(pitches.slice(0, 6)).toEqual(PENTATONIC.map((g) => 2 ** (g / 12)));
    expect(pitches[6]).toBe(2);
    expect(pitches[7]).toBe(2);
  });

  it('a Boa repete o grau; a Fraca e a Rejeitada quebram a sequência', () => {
    const up = gradeTone(gradeTone(-1, 'PERFECT').degree, 'PERFECT');
    expect(up.degree).toBe(1);
    const good = gradeTone(up.degree, 'GOOD');
    expect(good).toEqual({ sfx: 'GRADE', pitch: up.pitch, degree: 1 });
    expect(gradeTone(-1, 'GOOD')).toEqual({ sfx: 'GRADE', pitch: 1, degree: 0 });
    for (const miss of ['WEAK', 'REJECTED'] as const) {
      expect(gradeTone(4, miss)).toEqual({ sfx: 'GRADE_MISS', pitch: 1, degree: -1 });
    }
  });
});
