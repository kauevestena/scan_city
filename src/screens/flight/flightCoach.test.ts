import { STRINGS } from '@/data/strings';
import { snap } from '@/test/hudSnap';
import { COACH_HOLD_MS, nextCoachBeat, stepCoach, type CoachBeat } from './flightCoach';

const quiet = { corridorDeltaM: 0, corridorTolM: 3, lastGrade: null, gust: null } as const;
const report = {
  lineNumber: 1,
  pass: 1,
  score: 0.3,
  letter: 'D',
  counts: [0, 1, 2, 5] as [number, number, number, number],
  accepted: false,
};

describe('dicas do primeiro voo (tutorial do C00)', () => {
  it('uma dica para cada coisa nova que o voo mostra, cada uma com texto', () => {
    const beats: CoachBeat[] = ['ENTRY', 'GUST', 'RELIEF', 'GRADE', 'CRUISE', 'REPORT'];
    for (const b of beats) expect(STRINGS.tutorial.flightCoach[b].length).toBeGreaterThan(20);
  });

  it('a primeira, no começo da linha, é alinhar na entrada', () => {
    expect(nextCoachBeat(snap(quiet), new Set())).toBe('ENTRY');
    // Fora da linha (decolagem, curva) nada de dica de pilotagem.
    expect(nextCoachBeat(snap({ ...quiet, phase: 'TAKEOFF' }), new Set())).toBeNull();
  });

  it('cada coisa só puxa a sua dica quando acontece, e uma vez só', () => {
    const seen = new Set<CoachBeat>(['ENTRY']);
    expect(nextCoachBeat(snap(quiet), seen)).toBeNull();
    expect(nextCoachBeat(snap({ ...quiet, corridorDeltaM: 4 }), seen)).toBe('RELIEF');
    expect(nextCoachBeat(snap({ ...quiet, corridorDeltaM: -4 }), seen)).toBe('RELIEF');
    const graded = { ...quiet, lastGrade: { grade: 'GOOD' as const, axis: null, seq: 1 } };
    expect(nextCoachBeat(snap(graded), seen)).toBe('GRADE');
    expect(nextCoachBeat(snap({ ...quiet, cruise: { on: true, factor: 1.2 } }), seen)).toBeNull();
    expect(nextCoachBeat(snap({ ...quiet, cruise: { on: true, factor: 3 } }), seen)).toBe('CRUISE');
    seen.add('RELIEF').add('GRADE').add('CRUISE');
    expect(nextCoachBeat(snap({ ...graded, corridorDeltaM: 4 }), seen)).toBeNull();
  });

  it('a rajada avisada e o boletim valem também fora da reta', () => {
    const seen = new Set<CoachBeat>(['ENTRY']);
    const warned = {
      ...quiet,
      gust: { side: 1 as const, axis: 'LATERAL' as const, inS: 1.2, active: false },
    };
    expect(nextCoachBeat(snap(warned), seen)).toBe('GUST');
    // Só o aviso: a rajada que já sopra não é mais hora de antecipar.
    const blowing = {
      ...quiet,
      gust: { side: 1 as const, axis: 'LATERAL' as const, inS: 0, active: true },
    };
    expect(nextCoachBeat(snap(blowing), seen)).toBeNull();
    expect(nextCoachBeat(snap({ ...quiet, phase: 'TURN', lineReport: report }), seen)).toBe(
      'REPORT',
    );
  });

  it('a dica fica na tela pelo tempo dela; a da rajada não espera', () => {
    const seen = new Set<CoachBeat>();
    let shown = stepCoach(null, snap(quiet), seen, 0);
    expect(shown?.beat).toBe('ENTRY');
    // O relevo aparece logo depois: espera a dica da entrada sair.
    const relief = snap({ ...quiet, corridorDeltaM: 5 });
    shown = stepCoach(shown, relief, seen, 1000);
    expect(shown?.beat).toBe('ENTRY');
    shown = stepCoach(shown, relief, seen, COACH_HOLD_MS + 1);
    expect(shown).toMatchObject({ beat: 'RELIEF', at: COACH_HOLD_MS + 1 });
    // A rajada avisada substitui a dica na hora.
    const warned = snap({ ...quiet, gust: { side: -1, axis: 'LATERAL', inS: 1.4, active: false } });
    shown = stepCoach(shown, warned, seen, COACH_HOLD_MS + 500);
    expect(shown?.beat).toBe('GUST');
    // Passado o tempo e sem nada novo, a caixa fica só com a dica da etapa.
    expect(stepCoach(shown, snap(quiet), seen, 3 * COACH_HOLD_MS)).toBeNull();
    expect([...seen]).toEqual(['ENTRY', 'RELIEF', 'GUST']);
  });
});
