import type { ComponentType } from 'react';
import { useGameStore } from '@/state/store';
import type { ScreenId } from '@/types';
import { FieldSetupScreen } from '@/screens/field/FieldSetupScreen';
import { OfficeScreen } from '@/screens/office/OfficeScreen';
import { WorldMapScreen } from '@/screens/world/WorldMapScreen';
import { DebugScreenShell } from './DebugScreenShell';

/** Telas implementadas. As ausentes são servidas pelo `DebugScreenShell` (constitution §4.3). */
export const SCREEN_COMPONENTS: Partial<Record<ScreenId, ComponentType>> = {
  OFFICE: OfficeScreen,
  WORLD_MAP: WorldMapScreen,
  FIELD_SETUP: FieldSetupScreen,
};

export function ScreenRouter() {
  const screen = useGameStore((s) => s.session.screen);
  const Screen = SCREEN_COMPONENTS[screen] ?? DebugScreenShell;
  return <Screen />;
}
