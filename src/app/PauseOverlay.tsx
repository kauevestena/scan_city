import {
  ArrowLeft,
  Building2,
  Gamepad2,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STRINGS } from '@/data/strings';
import { InputManager } from '@/input/InputManager';
import { canTransition } from '@/state/machine';
import { flushSave, newGame, useGameStore } from '@/state/store';
import { Button, ConfirmDialog, Modal } from '@/ui';
import { ControlsPanel } from './ControlsPanel';
import { SettingsPanel } from './SettingsPanel';

const P = STRINGS.pause;

type View = 'MENU' | 'SETTINGS' | 'CONTROLS';
type Confirming = 'NEW_GAME' | 'ABANDON';

const TITLES: Record<View, string> = {
  MENU: P.title,
  SETTINGS: P.settingsTitle,
  CONTROLS: P.controlsTitle,
};

/**
 * A pausa não é uma tela: é `session.paused` com este overlay por cima da tela atual (REQ-CORE-003).
 * A ação `PAUSE` (Esc/M, Menu/Options) alterna a pausa, mas não abre por cima de outro modal.
 */
export function PauseOverlay() {
  const paused = useGameStore((s) => s.session.paused);

  useEffect(() => {
    const manager = InputManager.get();
    return manager.onAction((event) => {
      if (event.action !== 'PAUSE') return;
      const { session } = useGameStore.getState();
      if (session.paused) useGameStore.getState().setPaused(false);
      else if (!manager.hasModalLayer) useGameStore.getState().setPaused(true);
    });
  }, []);

  // O menu monta ao pausar e desmonta ao retomar: a aba e as confirmações voltam ao começo.
  return paused ? <PauseMenu /> : null;
}

const resume = () => useGameStore.getState().setPaused(false);

/** "Salvar agora": grava já o que estiver pendente (a falha avisa por conta própria). */
function saveNow(): void {
  if (flushSave()) {
    useGameStore.getState().pushToast({ type: 'success', title: P.saved });
  }
}

function exitToOffice(): void {
  resume();
  useGameStore.getState().goTo('OFFICE');
}

/** Abandono (T7 no planejamento; T10 no voo): descarta a missão e volta ao mapa. */
function abandonMission(): void {
  const { session, discardActive, goTo, setPaused } = useGameStore.getState();
  const inFlight = session.screen === 'SURVEY_FLIGHT';
  setPaused(false);
  goTo('WORLD_MAP', inFlight ? { outcome: 'ABORTED' } : undefined);
  discardActive();
}

function PauseMenu() {
  const screen = useGameStore((s) => s.session.screen);
  const canExit = useGameStore((s) =>
    canTransition(s.session.screen, 'OFFICE', s, s.session.payload),
  );
  const [view, setView] = useState<View>('MENU');
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const canAbandon = screen === 'FIELD_SETUP' || screen === 'SURVEY_FLIGHT';
  const inFlight = screen === 'SURVEY_FLIGHT';

  // Ao trocar de aba, o foco vai ao primeiro controle dela (o anterior saiu da tela).
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>('[data-focusable]')?.focus();
  }, [view]);

  return (
    <>
      <Modal
        open
        title={TITLES[view]}
        size={view === 'MENU' ? 'sm' : 'md'}
        onClose={view === 'MENU' ? resume : () => setView('MENU')}
      >
        <div ref={bodyRef} className="flex flex-col gap-2">
          {view === 'MENU' && (
            <div className="flex flex-col gap-2" data-testid="pause-menu">
              <Button variant="primary" icon={Play} glyph="UI_CONFIRM" onClick={resume}>
                {P.resume}
              </Button>
              <Button icon={SlidersHorizontal} onClick={() => setView('SETTINGS')}>
                {P.settings}
              </Button>
              <Button icon={Gamepad2} onClick={() => setView('CONTROLS')}>
                {P.controls}
              </Button>
              <Button icon={Save} onClick={saveNow} data-testid="pause-save">
                {P.saveNow}
              </Button>
              {canAbandon && (
                <Button icon={Trash2} onClick={() => setConfirming('ABANDON')}>
                  {P.abandonMission}
                </Button>
              )}
              {canExit && (
                <Button icon={Building2} onClick={exitToOffice} data-testid="pause-exit-office">
                  {P.exitOffice}
                </Button>
              )}
              <Button
                variant="ghost"
                icon={RotateCcw}
                onClick={() => setConfirming('NEW_GAME')}
                data-testid="pause-new-game"
              >
                {P.newGame}
              </Button>
            </div>
          )}
          {view !== 'MENU' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={ArrowLeft}
                className="w-fit"
                onClick={() => setView('MENU')}
                data-testid="pause-back"
              >
                {P.back}
              </Button>
              {view === 'SETTINGS' ? <SettingsPanel /> : <ControlsPanel />}
            </>
          )}
          <p
            className="mt-2 text-center font-mono text-xs text-slate-400"
            data-testid="app-version"
          >
            {STRINGS.app.title} · {STRINGS.app.version(__APP_VERSION__)}
          </p>
        </div>
      </Modal>
      {confirming === 'NEW_GAME' && (
        <ConfirmDialog
          title={P.newGameTitle}
          message={P.newGameMessage}
          confirmLabel={P.newGameConfirm}
          danger
          onConfirm={() => newGame()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'ABANDON' && (
        <ConfirmDialog
          title={inFlight ? P.abandonFlightTitle : P.abandonFieldTitle}
          message={inFlight ? P.abandonFlightMessage : P.abandonFieldMessage}
          confirmLabel={P.abandonConfirm}
          danger
          onConfirm={abandonMission}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}
