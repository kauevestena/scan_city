/**
 * Dicas do primeiro voo do C00 (contracts-real, C00, tutorial dirigido, etapa 4): o que o voo
 * pede, na hora em que pede. A dica fixa da etapa fala dos portais; estas aparecem embaixo
 * dela, uma de cada vez e uma vez só, quando o voo mostra o que cada uma explica.
 */
import { useEffect, useRef, useState } from 'react';
import type { FlightHudSnapshot } from '@/engines/flight/hudPublisher';

export type CoachBeat = 'ENTRY' | 'GUST' | 'TURN' | 'RELIEF' | 'GRADE' | 'CRUISE' | 'REPORT';

/** Cada dica fica na tela por este tempo, a não ser que uma urgente a substitua. */
export const COACH_HOLD_MS = 6000;
/** O aviso da rajada e o da curva não esperam: substituem a dica que estiver na tela. */
export const URGENT_BEATS: ReadonlySet<CoachBeat> = new Set(['GUST', 'TURN']);
/** O cruzeiro só vale a dica quando acelera de verdade. */
export const COACH_CRUISE_FACTOR = 1.5;

/** A próxima dica que o voo pede agora, ou `null`; cada uma só uma vez (`seen`). */
export function nextCoachBeat(
  snap: FlightHudSnapshot,
  seen: ReadonlySet<CoachBeat>,
): CoachBeat | null {
  const fresh = (b: CoachBeat) => !seen.has(b);
  if (fresh('GUST') && snap.gust !== null && snap.gust.inS > 0) return 'GUST';
  // A primeira curva armada (ADR-035): a troca de faixa é do jogador.
  if (fresh('TURN') && snap.phase === 'RUN' && snap.turn !== null && snap.turn.judged === null)
    return 'TURN';
  if (fresh('REPORT') && snap.lineReport !== null) return 'REPORT';
  if (snap.phase !== 'RUN') return null;
  if (fresh('ENTRY')) return 'ENTRY';
  if (fresh('RELIEF') && Math.abs(snap.corridorDeltaM) > snap.corridorTolM) return 'RELIEF';
  if (fresh('GRADE') && snap.lastGrade !== null) return 'GRADE';
  if (fresh('CRUISE') && snap.cruise.factor >= COACH_CRUISE_FACTOR) return 'CRUISE';
  return null;
}

interface Shown {
  beat: CoachBeat;
  at: number;
}

/**
 * Decide a dica a mostrar a cada snapshot: a atual fica `COACH_HOLD_MS`, então a próxima
 * entra; uma urgente entra na hora. Puro, para o teste: `now` vem de fora.
 */
export function stepCoach(
  shown: Shown | null,
  snap: FlightHudSnapshot,
  seen: Set<CoachBeat>,
  now: number,
): Shown | null {
  const next = nextCoachBeat(snap, seen);
  const held = shown !== null && now - shown.at < COACH_HOLD_MS;
  if (next !== null && (!held || URGENT_BEATS.has(next))) {
    seen.add(next);
    return { beat: next, at: now };
  }
  return held ? shown : null;
}

/** A dica do momento para o HUD, ou `null`; `active` falso desliga tudo (fora do tutorial). */
export function useFlightCoach(snap: FlightHudSnapshot | null, active: boolean): CoachBeat | null {
  const seen = useRef(new Set<CoachBeat>());
  const shown = useRef<Shown | null>(null);
  const [beat, setBeat] = useState<CoachBeat | null>(null);
  useEffect(() => {
    if (!active || !snap) return;
    shown.current = stepCoach(shown.current, snap, seen.current, performance.now());
    setBeat(shown.current?.beat ?? null);
  }, [snap, active]);
  return active ? beat : null;
}
