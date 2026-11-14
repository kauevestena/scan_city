import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';
import { InputManager } from '@/input/InputManager';

// Cada teste começa com um InputManager limpo, ligado à janela (como o InputDriver faz no app).
beforeEach(() => {
  InputManager.resetForTests().attach(window);
});
