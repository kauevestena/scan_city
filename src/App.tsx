import { useEffect, useState } from 'react';
import { AudioDriver } from '@/app/AudioDriver';
import { applyDebugFlags } from '@/app/debugFixtures';
import { getDebugFlags } from '@/app/debugFlags';
import { DebugOverlay } from '@/app/DebugOverlay';
import { FpsOverlay } from '@/app/FpsOverlay';
import { InputDriver } from '@/app/InputDriver';
import { PauseOverlay } from '@/app/PauseOverlay';
import { ScreenRouter } from '@/app/ScreenRouter';
import { SoundBoard } from '@/app/SoundBoard';
import { TopBar } from '@/app/TopBar';
import { UiKitGallery } from '@/app/UiKitGallery';
import { startAutosave } from '@/state/autosave';
import { startMuseumIncome } from '@/state/museumIncome';
import { hydrateGame, useGameStore } from '@/state/store';
import type { ScreenId } from '@/types';
import { ToastHost } from '@/ui';

/** Telas com a barra superior (REQ-UI-003). */
const TOP_BAR_SCREENS: ReadonlySet<ScreenId> = new Set([
  'OFFICE',
  'WORLD_MAP',
  'HOLO_TABLE_VIEW',
  'INFOGRAPHIC_LAB',
]);

function GameLayout() {
  const screen = useGameStore((s) => s.session.screen);
  return (
    <div className="flex h-full w-full flex-col">
      {TOP_BAR_SCREENS.has(screen) && <TopBar />}
      <div className="min-h-0 flex-1">
        <ScreenRouter />
      </div>
    </div>
  );
}

export function App() {
  // Boot, uma única vez e antes da primeira renderização: carrega o save e aplica as flags.
  const [flags] = useState(() => {
    hydrateGame();
    const parsed = getDebugFlags();
    applyDebugFlags(parsed);
    return parsed;
  });

  useEffect(() => startAutosave(), []);
  useEffect(() => startMuseumIncome(), []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {flags.screen === 'UIKIT' ? (
        <UiKitGallery />
      ) : flags.screen === 'SOUNDBOARD' ? (
        <SoundBoard />
      ) : (
        <>
          <GameLayout />
          <PauseOverlay />
          <DebugOverlay />
        </>
      )}
      <InputDriver />
      <AudioDriver />
      <FpsOverlay />
      <ToastHost />
    </div>
  );
}
