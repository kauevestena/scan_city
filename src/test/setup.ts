import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';
import { AudioEngine } from '@/audio/AudioEngine';
import { InputManager } from '@/input/InputManager';
import { fakeContextFactory } from './fakeAudio';

// Cada teste começa com um InputManager limpo, ligado à janela (como o InputDriver faz no app),
// e um AudioEngine novo, com AudioContext falso e ainda bloqueado.
beforeEach(() => {
  InputManager.resetForTests().attach(window);
  AudioEngine.resetForTests(fakeContextFactory());
});
