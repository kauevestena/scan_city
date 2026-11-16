/** Eventos de campo (catalog §12): efeitos, custos e durações. O sorteio está em `domain/fieldEvents`. */
import type { CentsBRL } from '@/types';
import { brl } from './catalog/money';

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
