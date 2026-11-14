import { useState } from 'react';
import { applyDebugFlags } from '@/app/debugFixtures';
import { getDebugFlags } from '@/app/debugFlags';
import { PauseOverlay } from '@/app/PauseOverlay';
import { ScreenRouter } from '@/app/ScreenRouter';
import { UiKitGallery } from '@/app/UiKitGallery';
import { ToastHost } from '@/ui';

export function App() {
  // As flags de depuração são aplicadas uma única vez, antes da primeira renderização.
  const [flags] = useState(() => {
    const parsed = getDebugFlags();
    applyDebugFlags(parsed);
    return parsed;
  });

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
