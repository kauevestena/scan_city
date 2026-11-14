import { useEffect, useState } from 'react';
import { applyDebugFlags } from '@/app/debugFixtures';
import { getDebugFlags } from '@/app/debugFlags';
import { PauseOverlay } from '@/app/PauseOverlay';
import { ScreenRouter } from '@/app/ScreenRouter';
import { UiKitGallery } from '@/app/UiKitGallery';
import { startAutosave } from '@/state/autosave';
import { hydrateGame } from '@/state/store';
import { ToastHost } from '@/ui';

export function App() {
  // Boot, uma única vez e antes da primeira renderização: carrega o save e aplica as flags.
  const [flags] = useState(() => {
    hydrateGame();
    const parsed = getDebugFlags();
    applyDebugFlags(parsed);
    return parsed;
  });

  useEffect(() => startAutosave(), []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {flags.screen === 'UIKIT' ? (
        <UiKitGallery />
      ) : (
        <>
          <ScreenRouter />
          <PauseOverlay />
        </>
      )}
      <ToastHost />
    </div>
  );
}
