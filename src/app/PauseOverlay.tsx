import { Play } from 'lucide-react';
import { useEffect } from 'react';
import { STRINGS } from '@/data/strings';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';
import { Button, Modal } from '@/ui';

/**
 * A pausa não é uma tela: é `session.paused` com este overlay por cima da tela atual.
 * A ação `PAUSE` (Esc/M, Menu/Options) alterna a pausa, mas não abre por cima de outro modal.
 */
export function PauseOverlay() {
  const paused = useGameStore((s) => s.session.paused);
  const setPaused = useGameStore((s) => s.setPaused);

  useEffect(() => {
    const manager = InputManager.get();
    return manager.onAction((event) => {
      if (event.action !== 'PAUSE') return;
      const { session } = useGameStore.getState();
      if (session.paused) useGameStore.getState().setPaused(false);
      else if (!manager.hasModalLayer) useGameStore.getState().setPaused(true);
    });
  }, []);

  return (
    <Modal open={paused} title={STRINGS.pause.title} size="sm" onClose={() => setPaused(false)}>
      <div className="flex flex-col gap-2">
        <Button variant="primary" icon={Play} glyph="UI_CONFIRM" onClick={() => setPaused(false)}>
          {STRINGS.pause.resume}
        </Button>
        <p className="mt-2 text-center font-mono text-xs text-slate-400" data-testid="app-version">
          {STRINGS.app.title} · {STRINGS.app.version(__APP_VERSION__)}
        </p>
      </div>
    </Modal>
  );
}
