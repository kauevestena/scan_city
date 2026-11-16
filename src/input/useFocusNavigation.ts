import { useEffect, useRef, type RefObject } from 'react';
import type { ButtonAction, InputContext } from './actions';
import { InputManager, type ActionEvent } from './InputManager';
import { pickNeighbor, type NavDirection } from './spatial';

export interface FocusNavigationOptions {
  /** `data-focus-id` do elemento focado quando a navegação começa sem foco no container. */
  initialFocus?: string;
  /** `UI_BACK`; sem ele, o voltar segue adiante (o `Esc` então pausa). */
  onBack?: () => void;
  onTabPrev?: () => void;
  onTabNext?: () => void;
  /** Ao chegar na borda, volta pelo outro lado. */
  wrap?: boolean;
  /** Modais ficam acima das demais camadas e bloqueiam a pausa. */
  modal?: boolean;
  context?: InputContext;
  /** Permite desligar a camada sem desmontar (ex.: modal fechado). */
  active?: boolean;
  /**
   * Ao montar, o foco entra no container (no `initialFocus` ou no primeiro controle) e, ao
   * desmontar, volta a quem o tinha: para painéis que o jogador abre e fecha (REQ-NFR-007). Só
   * vale na montagem, então reativar a camada (uma confirmação que fecha) não rouba o foco.
   */
  autoFocus?: boolean;
}

export const FOCUSABLE_SELECTOR =
  '[data-focusable]:not([disabled]):not([aria-disabled="true"]):not([tabindex="-1"])';

const NAV: Partial<Record<ButtonAction, NavDirection>> = {
  UI_UP: 'UP',
  UI_DOWN: 'DOWN',
  UI_LEFT: 'LEFT',
  UI_RIGHT: 'RIGHT',
};

const SLIDER_KEYS: Partial<Record<NavDirection, string>> = {
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
};

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function focusInitial(container: HTMLElement, initialFocus?: string): void {
  const items = focusables(container);
  const preferred = initialFocus
    ? items.find((el) => el.dataset.focusId === initialFocus)
    : undefined;
  (preferred ?? items[0])?.focus();
}

/**
 * Navegação espacial de UI (input §5): `UI_*` move o foco ao vizinho mais próximo,
 * `UI_CONFIRM` clica no elemento focado (o teclado usa a ativação nativa),
 * `UI_BACK` chama `onBack`. Sliders focados recebem `UI_LEFT/RIGHT` como ajuste de valor.
 */
export function useFocusNavigation(
  containerRef: RefObject<HTMLElement | null>,
  options: FocusNavigationOptions = {},
): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const { modal = false, context = 'UI', active = true, autoFocus = false } = options;

  useEffect(() => {
    if (!autoFocus) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      focusInitial(container, optionsRef.current.initialFocus);
    }
    return () => {
      // Só devolve o foco se ele ficou solto (o painel saiu do DOM com o foco dentro): quem fecha o
      // painel e já focou outro controle, como o hotspot da sala, não é atropelado.
      const active = document.activeElement;
      const loose = active === null || active === document.body || container?.contains(active);
      if (loose && previous && previous !== document.body && previous.isConnected) {
        previous.focus();
      }
    };
  }, [autoFocus, containerRef]);

  useEffect(() => {
    if (!active) return;
    const handler = (event: ActionEvent): boolean => {
      const container = containerRef.current;
      if (!container) return false;
      const opts = optionsRef.current;
      const focused =
        document.activeElement instanceof HTMLElement && container.contains(document.activeElement)
          ? document.activeElement
          : null;

      const dir = NAV[event.action];
      if (dir) {
        if (!focused) {
          focusInitial(container, opts.initialFocus);
          return true;
        }
        const sliderKey = SLIDER_KEYS[dir];
        if (sliderKey && focused.hasAttribute('data-slider')) {
          focused.dispatchEvent(
            new KeyboardEvent('keydown', { key: sliderKey, repeat: event.repeat, bubbles: true }),
          );
          return true;
        }
        const items = focusables(container).filter((el) => el !== focused);
        const index = pickNeighbor(
          focused.getBoundingClientRect(),
          items.map((el) => el.getBoundingClientRect()),
          dir,
          opts.wrap ?? false,
        );
        items[index]?.focus();
        return true;
      }

      switch (event.action) {
        case 'UI_CONFIRM':
          if (!focused) focusInitial(container, opts.initialFocus);
          else if (event.device !== 'KEYBOARD') focused.click();
          return true;
        case 'UI_BACK':
          if (!opts.onBack) return false;
          opts.onBack();
          return true;
        case 'UI_TAB_PREV':
          if (!opts.onTabPrev) return false;
          opts.onTabPrev();
          return true;
        case 'UI_TAB_NEXT':
          if (!opts.onTabNext) return false;
          opts.onTabNext();
          return true;
        default:
          return false;
      }
    };
    return InputManager.get().pushLayer({ context, modal, handler });
  }, [containerRef, modal, context, active]);
}
