/**
 * Degraus de detalhe do voo (survey-flight §5.18, ADR-034): os efeitos que custam caro por pixel
 * no raster sem GPU saem primeiro, sozinhos, quando o FPS cai; depois o relevo perde um nível de
 * qualidade. É o mesmo governador da resolução adaptativa (ADR-033: janela de 1,5 s, desce abaixo
 * de 54 FPS, sobe depois de folga seguida, desfaz a descida que não ajudou), com os degraus no
 * lugar das escalas.
 *
 * | Degrau | Inclinação da câmera | Nuvens baixas e vinheta | Relevo |
 * | :-: | :-: | :-: | :-- |
 * | 3 | sim | sim | a qualidade escolhida |
 * | 2 | não | sim | a qualidade escolhida |
 * | 1 | não | não | a qualidade escolhida |
 * | 0 | não | não | um nível abaixo |
 *
 * O teto é a qualidade escolhida: Alta começa no 3, Média no 2 e Baixa no 1.
 */
import { clamp } from '@/lib/math';
import { RenderScaleGovernor, SCALE_STEP } from '../renderScale';
import type { Quality } from './projection';

export const MAX_DETAIL = 3;

export interface DetailFx {
  /** A câmera inclina nas curvas (cara no raster sem GPU: tudo vira polígono girado). */
  roll: boolean;
  /** Nuvens baixas que passam por cima e a vinheta (camadas grandes e translúcidas). */
  wisps: boolean;
  vignette: boolean;
  /** Quantos níveis o relevo desce abaixo da qualidade escolhida. */
  qualityDrop: number;
}

export function detailFx(level: number): DetailFx {
  const l = clamp(Math.round(level), 0, MAX_DETAIL);
  return { roll: l >= 3, wisps: l >= 2, vignette: l >= 2, qualityDrop: l === 0 ? 1 : 0 };
}

/** O degrau mais alto que a qualidade escolhida permite. */
export function detailCap(quality: Quality): number {
  return quality === 'HIGH' ? 3 : quality === 'MEDIUM' ? 2 : 1;
}

const ORDER: readonly Quality[] = ['LOW', 'MEDIUM', 'HIGH'];

/** A qualidade `steps` níveis abaixo (a Baixa é o piso). */
export function lowerQuality(quality: Quality, steps: number): Quality {
  const i = Math.max(0, ORDER.indexOf(quality) - Math.max(0, Math.round(steps)));
  return ORDER[i] as Quality;
}

const toScale = (level: number) => SCALE_STEP ** (MAX_DETAIL - level);
const toLevel = (scale: number) =>
  clamp(MAX_DETAIL - Math.round(Math.log(scale) / Math.log(SCALE_STEP)), 0, MAX_DETAIL);

/** O degrau que se segurou nesta sessão (a próxima surtida começa nele). */
let remembered: number | null = null;

/** O degrau em uso (ou o último), para o painel F9; `null` antes do primeiro voo. */
export function flightDetailLevel(): number | null {
  return remembered;
}

/** Só para testes: esquece o degrau lembrado. */
export function resetRememberedDetail(): void {
  remembered = null;
}

export class DetailGovernor {
  private governor: RenderScaleGovernor;
  private cap: number;

  constructor(quality: Quality) {
    this.cap = detailCap(quality);
    const start = Math.min(this.cap, remembered ?? this.cap);
    this.governor = new RenderScaleGovernor(toScale(this.cap), toScale(0), toScale(start));
    remembered = this.level;
  }

  get level(): number {
    return toLevel(this.governor.scale);
  }

  /** A qualidade escolhida mudou: o teto muda (subir a qualidade leva o degrau ao teto novo). */
  setQuality(quality: Quality): void {
    const cap = detailCap(quality);
    if (cap === this.cap) return;
    this.cap = cap;
    this.governor.setLimits(toScale(cap), toScale(0));
    remembered = this.level;
  }

  /** Conta o intervalo entre dois quadros (ms); devolve o degrau novo quando muda, ou `null`. */
  sample(intervalMs: number): number | null {
    const next = this.governor.sample(intervalMs);
    if (next === null) return null;
    remembered = toLevel(next);
    return remembered;
  }
}
