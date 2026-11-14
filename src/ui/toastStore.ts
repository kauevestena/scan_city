import { createStore } from 'zustand/vanilla';
import type { ToastData } from './Toast';

interface ToastState {
  toasts: ToastData[];
  pushToast: (toast: Omit<ToastData, 'id'>) => string;
  dismissToast: (id: string) => void;
}

let nextId = 1;

/** Fila local de toasts do kit de UI. */
export const toastStore = createStore<ToastState>()((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = `toast-${nextId++}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
