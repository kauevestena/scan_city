import type { ComponentType } from 'react';
import { useGameStore } from '@/state/store';
import type { ScreenId } from '@/types';
import { FieldSetupScreen } from '@/screens/field/FieldSetupScreen';
import { SurveyFlightScreen } from '@/screens/flight/SurveyFlightScreen';
import { HoloTableScreen } from '@/screens/holo/HoloTableScreen';
import { InfographicLabScreen } from '@/screens/lab/InfographicLabScreen';
import { OfficeScreen } from '@/screens/office/OfficeScreen';
import { ProcessingResultsScreen } from '@/screens/processing/ProcessingResultsScreen';
import { WorldMapScreen } from '@/screens/world/WorldMapScreen';

/**
 * Uma tela real para cada `ScreenId`: o tipo é total, então um id novo sem tela não compila (o
 * shell provisório de depuração, constitution §4.3, saiu na T079; REQ-NFR-005).
 */
export const SCREEN_COMPONENTS: Record<ScreenId, ComponentType> = {
  OFFICE: OfficeScreen,
  WORLD_MAP: WorldMapScreen,
  FIELD_SETUP: FieldSetupScreen,
  SURVEY_FLIGHT: SurveyFlightScreen,
  PROCESSING_RESULTS: ProcessingResultsScreen,
  HOLO_TABLE_VIEW: HoloTableScreen,
  INFOGRAPHIC_LAB: InfographicLabScreen,
};

export function ScreenRouter() {
  const screen = useGameStore((s) => s.session.screen);
  const Screen = SCREEN_COMPONENTS[screen];
  return <Screen />;
}
