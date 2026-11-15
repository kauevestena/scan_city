import { useEffect, useRef, type DependencyList, type RefObject } from 'react';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';
import { GameLoop, type GameLoopOptions, type Simulation } from './loop';

/**
 * Cria um `GameLoop` para a simulação devolvida por `simFactory` e o destrói com a tela.
 * O loop congela enquanto `session.paused` for verdadeiro (REQ-CORE-003).
 * `simFactory` pode devolver `null` enquanto a simulação não puder ser criada
 * (por exemplo, antes de o canvas ser medido).
 */
export function useGameLoop(
  simFactory: () => Simulation | null,
  deps: DependencyList,
  options?: GameLoopOptions,
): RefObject<GameLoop | null> {
  const loopRef = useRef<GameLoop | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const sim = simFactory();
    if (!sim) return;
    // Ordem por frame (architecture §4): input → sub-passos → render.
    const loop = new GameLoop(sim, {
      beforeFrame: (timeMs) => InputManager.get().poll(timeMs),
      ...optionsRef.current,
    });
    loopRef.current = loop;
    loop.setPaused(useGameStore.getState().session.paused);
    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.session.paused !== prev.session.paused) loop.setPaused(state.session.paused);
    });
    loop.start();
    return () => {
      unsubscribe();
      loop.stop();
      loopRef.current = null;
    };
    // As dependências são as do chamador, como em `useEffect`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return loopRef;
}
