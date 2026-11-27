import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AudioEngine } from '@/audio/AudioEngine';
import { CONTRACTS } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { SouvenirScene, type SceneInsets } from '@/engines/souvenir/scene';
import { viewLabel, viewText, visibleFaces } from '@/engines/souvenir/views';
import { useCanvas } from '@/engines/useCanvas';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';
import type { Souvenir } from '@/types';
import { Button } from '@/ui';
import { useDialogFocus } from '@/ui/useDialogFocus';

const V = STRINGS.souvenirViewer;

/** Espaço do título em cima e da legenda e dos botões embaixo (px de CSS). */
export const VIEWER_INSETS: SceneInsets = { top: 84, bottom: 138, side: 24 };

/** `prefers-reduced-motion`: a página esmaece em vez de girar e o objeto não flutua. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const nowS = () => performance.now() / 1000;

/**
 * Exame de um souvenir em tela cheia (office §5.1, REQ-OFF-008, ADR-036): a cena em Canvas com
 * o objeto ou o caderno, as faces que se viram por teclado, mouse e controle, e o texto da vista
 * para o leitor de tela. Fechar devolve o foco a quem abriu.
 */
export function SouvenirViewer({ souvenir, onClose }: { souvenir: Souvenir; onClose: () => void }) {
  const finaleSeen = useGameStore((s) => s.flags.finaleSeen);
  const faces = useMemo(() => visibleFaces(souvenir, finaleSeen), [souvenir, finaleSeen]);
  const scene = useMemo(
    () =>
      new SouvenirScene(souvenir, faces, {
        reducedMotion: prefersReducedMotion(),
        insets: VIEWER_INSETS,
        onFlipStart: () => AudioEngine.get().play('PAGE_TURN'),
      }),
    [souvenir, faces],
  );
  const [view, setView] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleId = useId();
  const surface = useCanvas(canvasRef);
  const onKeyDown = useDialogFocus(dialogRef, true);
  const total = scene.views.length;
  const current = scene.views[view] ?? scene.views[0];
  const label = current ? viewLabel(faces, current) : '';
  const contract = CONTRACTS.find((c) => c.id === souvenir.contractId);

  const go = (delta: number) => {
    // Fecha a virada que já acabou, mesmo sem quadro desenhado (aba em segundo plano).
    const now = nowS();
    scene.update(now);
    const to = scene.target + delta;
    if (scene.request(to, now)) setView(to);
  };
  const goRef = useRef(go);
  const closeRef = useRef(onClose);
  useEffect(() => {
    goRef.current = go;
    closeRef.current = onClose;
  });

  // Camada modal: as setas, Q/E e LB/RB viram; UI_BACK fecha; UI_CONFIRM fora de um botão avança.
  useEffect(
    () =>
      InputManager.get().pushLayer({
        context: 'UI',
        modal: true,
        handler: (event) => {
          switch (event.action) {
            case 'UI_LEFT':
            case 'UI_TAB_PREV':
              goRef.current(-1);
              return true;
            case 'UI_RIGHT':
            case 'UI_TAB_NEXT':
              goRef.current(1);
              return true;
            case 'UI_BACK':
              closeRef.current();
              return true;
            case 'UI_CONFIRM': {
              const focused = document.activeElement;
              const onButton =
                focused instanceof HTMLButtonElement &&
                dialogRef.current?.contains(focused) === true;
              // No botão, o teclado já ativa sozinho (Enter, Espaço); o controle clica.
              if (onButton && event.device !== 'KEYBOARD') focused.click();
              else if (!onButton) goRef.current(1);
              return true;
            }
            case 'UI_UP':
            case 'UI_DOWN':
              return true;
            default:
              return false;
          }
        },
      }),
    [],
  );

  // O desenho: a cada quadro enquanto algo se mexe; parado, um quadro e o preparo das vizinhas.
  useEffect(() => {
    if (!surface) return;
    let handle = 0;
    let drawn = '';
    let moving = true;
    const frame = () => {
      const key = `${surface.width}x${surface.height}@${surface.dpr}`;
      if (scene.animating || moving || key !== drawn) {
        moving = scene.animating;
        scene.render(surface.ctx, surface.width, surface.height, surface.dpr, nowS());
        drawn = key;
      } else {
        scene.idle(surface.width, surface.height, surface.dpr);
      }
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [surface, scene]);

  // Nas pontas, o botão focado fica desabilitado (e o foco se perde): ele passa para o outro.
  useEffect(() => {
    const focused = document.activeElement;
    const lost =
      focused === null ||
      focused === document.body ||
      (focused instanceof HTMLButtonElement && focused.disabled);
    if (!lost) return;
    dialogRef.current
      ?.querySelector<HTMLButtonElement>('[data-souvenir-nav]:not([disabled])')
      ?.focus();
  }, [view]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="souvenir-viewer"
      data-souvenir={souvenir.id}
      data-view={view}
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950 outline-none"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={V.drawing(label)}
        title={V.flipHint}
        data-testid="souvenir-canvas"
        className="absolute inset-0 block h-full w-full cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          go(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
        }}
      />
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-slate-950/75 px-6 py-3">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-xl font-semibold text-amber-100">
            {souvenir.name}
          </h2>
          {contract && (
            <p className="truncate text-sm text-slate-300">
              {V.origin(contract.client.name, contract.title)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          icon={X}
          glyph="UI_BACK"
          data-modal-close
          className="pointer-events-auto"
          onClick={onClose}
        >
          {V.close}
        </Button>
      </header>
      <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-slate-950/80 px-6 pt-3 pb-4">
        <p className="mx-auto max-w-3xl text-center text-sm text-slate-300 italic">
          {souvenir.story}
        </p>
        <div className="flex items-center justify-between gap-4">
          <p
            className="min-w-0 truncate font-mono text-sm text-cyan-300"
            data-testid="souvenir-view-label"
          >
            <span aria-hidden>{V.counter(view + 1, total)}</span>
            <span className="sr-only">{V.counterLabel(view + 1, total)}</span>
            <span aria-hidden> · </span>
            {label}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              icon={ChevronLeft}
              glyph="UI_TAB_PREV"
              data-souvenir-nav="prev"
              disabled={view === 0}
              onClick={() => go(-1)}
            >
              {V.prev}
            </Button>
            <Button
              variant="primary"
              icon={ChevronRight}
              glyph="UI_TAB_NEXT"
              data-souvenir-nav="next"
              data-dialog-initial
              disabled={view === total - 1}
              onClick={() => go(1)}
            >
              {V.next}
            </Button>
          </div>
        </div>
      </footer>
      <div className="sr-only" aria-live="polite" data-testid="souvenir-face-text">
        {current ? viewText(faces, current) : ''}
      </div>
    </div>,
    document.body,
  );
}
