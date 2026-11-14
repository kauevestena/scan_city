import { Play } from 'lucide-react';
import { useEffect } from 'react';
import { STRINGS } from '@/data/strings';
import { useGameStore } from '@/state/store';
import { Button, Modal } from '@/ui';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

/** A pausa não é uma tela: é `session.paused` com este overlay por cima da tela atual. */
export function PauseOverlay() {
  const paused = useGameStore((s) => s.session.paused);
  const setPaused = useGameStore((s) => s.setPaused);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTyping(e.target)) return;
      // Um modal aberto trata o próprio Esc (e interrompe a propagação).
      if (e.key !== 'Escape' && e.key.toLowerCase() !== 'm') return;
      const { session } = useGameStore.getState();
      if (!session.paused && document.querySelector('[role="dialog"]')) return;
      useGameStore.getState().setPaused(!session.paused);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Modal open={paused} title={STRINGS.pause.title} size="sm" onClose={() => setPaused(false)}>
      <div className="flex flex-col gap-2">
        <Button variant="primary" icon={Play} onClick={() => setPaused(false)}>
          {STRINGS.pause.resume}
        </Button>
        <p className="mt-2 text-center font-mono text-xs text-slate-400" data-testid="app-version">
          {STRINGS.app.title} · {STRINGS.app.version(__APP_VERSION__)}
        </p>
      </div>
    </Modal>
  );
}
