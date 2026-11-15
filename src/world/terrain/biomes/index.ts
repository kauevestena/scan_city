import type { BiomeId } from '@/types';
import type { BiomeRecipe } from '../TerrainSampler';
import { RURAL_TUTORIAL } from './ruralTutorial';
import { URBAN_VERTICAL } from './urbanVertical';

/** Receitas disponíveis. Cada tarefa de contrato (F7) acrescenta a receita do seu bioma. */
export const BIOMES: Partial<Record<BiomeId, BiomeRecipe>> = {
  RURAL_TUTORIAL,
  URBAN_VERTICAL,
};
