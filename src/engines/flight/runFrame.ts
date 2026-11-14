/**
 * Frame do *run* (survey-flight §5.2): cada linha de voo vira uma corrida para a frente.
 * `s` é a distância ao longo da linha desde `L.start`; `x`, o deslocamento transversal,
 * positivo à direita do sentido de voo (frame da AOI com v para o sul).
 */
import type { AoiPoint, FlightLine } from '@/types';

export interface RunFrame {
  start: AoiPoint;
  /** Direção unitária da linha. */
  dir: AoiPoint;
  /** Direita do sentido de voo. */
  right: AoiPoint;
  /** Comprimento total (com lead-in e lead-out). */
  lengthM: number;
  aoiStartS: number;
  aoiEndS: number;
  /** Rumo da linha (rad), medido de +u em direção a +v. */
  headingRad: number;
}

export function runFrame(line: FlightLine): RunFrame {
  const du = line.end.u - line.start.u;
  const dv = line.end.v - line.start.v;
  const lengthM = Math.hypot(du, dv);
  const dir = lengthM > 0 ? { u: du / lengthM, v: dv / lengthM } : { u: 1, v: 0 };
  return {
    start: line.start,
    dir,
    right: { u: -dir.v, v: dir.u },
    lengthM,
    aoiStartS: line.aoiStartS,
    aoiEndS: line.aoiEndS,
    headingRad: Math.atan2(dir.v, dir.u),
  };
}

/** `aoiPoint(s, X) = L.start + s·dir + X·right`. */
export function aoiPoint(frame: RunFrame, s: number, x: number): AoiPoint {
  return {
    u: frame.start.u + s * frame.dir.u + x * frame.right.u,
    v: frame.start.v + s * frame.dir.v + x * frame.right.v,
  };
}

/** Inverso de `aoiPoint`. */
export function toRun(frame: RunFrame, p: AoiPoint): { s: number; x: number } {
  const du = p.u - frame.start.u;
  const dv = p.v - frame.start.v;
  return { s: du * frame.dir.u + dv * frame.dir.v, x: du * frame.right.u + dv * frame.right.v };
}
