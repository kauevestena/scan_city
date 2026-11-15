/** `requestAnimationFrame` controlável: `frame(ms)` executa os callbacks agendados. */
export function createFakeRaf() {
  let nextHandle = 1;
  const callbacks = new Map<number, (timeMs: number) => void>();
  return {
    raf: (cb: (timeMs: number) => void): number => {
      const handle = nextHandle++;
      callbacks.set(handle, cb);
      return handle;
    },
    caf: (handle: number): void => {
      callbacks.delete(handle);
    },
    /** Dispara um frame no instante `timeMs`. */
    frame: (timeMs: number): void => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const cb of pending) cb(timeMs);
    },
    get pending(): number {
      return callbacks.size;
    },
  };
}
