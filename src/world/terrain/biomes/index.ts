import type { BiomeId } from '@/types';
import type { BiomeRecipe } from '../TerrainSampler';
import { AGRI_PLATEAU } from './agriPlateau';
import { AMAZON } from './amazon';
import { COASTAL_ESTUARY } from './coastalEstuary';
import { COLONIAL_CENTER } from './colonialCenter';
import { OPEN_PIT_MINE } from './openPitMine';
import { RIFT_GREEN_HILLS } from './riftGreenHills';
import { RIFT_PIPES } from './riftPipes';
import { RIFT_SANTOS_HOOD } from './riftSantosHood';
import { RURAL_TUTORIAL } from './ruralTutorial';
import { URBAN_VERTICAL } from './urbanVertical';

/** Receitas disponíveis. Cada tarefa de contrato (F7) acrescenta a receita do seu bioma. */
export const BIOMES: Partial<Record<BiomeId, BiomeRecipe>> = {
  RURAL_TUTORIAL,
  URBAN_VERTICAL,
  COLONIAL_CENTER,
  COASTAL_ESTUARY,
  AGRI_PLATEAU,
  OPEN_PIT_MINE,
  AMAZON,
  RIFT_GREEN_HILLS,
  RIFT_PIPES,
  RIFT_SANTOS_HOOD,
};
