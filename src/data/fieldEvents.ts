/** Eventos de campo (catalog §12): efeitos, custos e durações. O sorteio está em `domain/fieldEvents`. */
import type { FieldEventId } from '@/domain/fieldEvents';
import type { CentsBRL } from '@/types';
import { brl } from './catalog/money';

/** Como o evento se apresenta: modal com escolha, diálogo curto, bloqueio com banner ou só toast. */
export type FieldEventMode = 'MODAL' | 'DIALOG' | 'BLOCK' | 'PASSIVE';

export interface FieldEventDef {
  id: FieldEventId;
  mode: FieldEventMode;
}

export const FIELD_EVENTS: Readonly<Record<FieldEventId, FieldEventDef>> = {
  FLAT_TIRE: { id: 'FLAT_TIRE', mode: 'MODAL' },
  CATTLE: { id: 'CATTLE', mode: 'BLOCK' },
  LOST_BENCHMARK: { id: 'LOST_BENCHMARK', mode: 'DIALOG' },
  SUSPICIOUS_OWNER: { id: 'SUSPICIOUS_OWNER', mode: 'MODAL' },
  SUDDEN_RAIN: { id: 'SUDDEN_RAIN', mode: 'PASSIVE' },
  ATLAS_FINDS_CORN: { id: 'ATLAS_FINDS_CORN', mode: 'PASSIVE' },
};

/** Pneu furado: toques de `INTERACT` para trocar, ou o guincho. */
export const TIRE_REPAIR_TAPS = 10;
export const TOW_COST: CentsBRL = brl(150);

/** Gado na pista: bloqueio de 3 s; cada buzina tira 1 s. */
export const CATTLE_BLOCK_S = 3;
export const HONK_RELIEF_S = 1;

/** Marco geodésico perdido. */
export const BENCHMARK_XP = 50;
export const BENCHMARK_REWARD: CentsBRL = brl(100);

/** Proprietário desconfiado: com reputação a partir do limiar, a autorização convence. */
export const OWNER_REPUTATION_THRESHOLD = 40;
export const OWNER_COFFEE_COST: CentsBRL = brl(50);

/** Chuva repentina: −30 % de velocidade por 15 s. */
export const RAIN_SPEED_FACTOR = 0.7;
export const RAIN_DURATION_S = 15;

/** Atlas acha milho. */
export const FOUND_CORN = 3;
