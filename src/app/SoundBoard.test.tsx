import { fireEvent, render, screen, within } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { LOOP_IDS, SFX_IDS } from '@/audio/sfx';
import { useGameStore } from '@/state/store';
import { FakeAudioContext, type FakeGain, type FakeOscillator } from '@/test/fakeAudio';
import { resetGameStore } from '@/test/resetStore';
import { AudioDriver } from './AudioDriver';
import { SoundBoard } from './SoundBoard';

const audioCtx = () => AudioEngine.get().context as unknown as FakeAudioContext;

beforeEach(() => {
  resetGameStore();
  FakeAudioContext.instances = [];
});

describe('SoundBoard', () => {
  it('tem um botão por efeito e um toggle por loop', () => {
    render(<SoundBoard />);
    for (const id of SFX_IDS) expect(screen.getByRole('button', { name: id })).toBeInTheDocument();
    for (const id of LOOP_IDS) {
      expect(screen.getByRole('button', { name: id })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(
      screen.getByText('Clique ou aperte uma tecla para liberar o áudio.'),
    ).toBeInTheDocument();
  });

  it('cada efeito toca (libera o áudio no clique)', () => {
    render(<SoundBoard />);
    fireEvent.pointerDown(window);
    fireEvent.click(screen.getByRole('button', { name: 'SHUTTER' }));
    expect(
      audioCtx()
        .created('biquad')
        .some((f) => (f as unknown as { type: string }).type === 'highpass'),
    ).toBe(true);
    for (const id of SFX_IDS) {
      audioCtx().currentTime += 1;
      const before = audioCtx().nodes.length;
      fireEvent.click(screen.getByRole('button', { name: id }));
      expect(audioCtx().nodes.length, id).toBeGreaterThan(before);
    }
    expect(
      screen.queryByText('Clique ou aperte uma tecla para liberar o áudio.'),
    ).not.toBeInTheDocument();
  });

  it('liga e desliga os loops, com variante do motor e parâmetros', () => {
    const { unmount } = render(<SoundBoard />);
    fireEvent.click(screen.getByRole('tab', { name: 'Asa fixa' }));
    const motor = screen.getByRole('button', { name: 'MOTOR' });
    fireEvent.click(motor);
    expect(motor).toHaveAttribute('aria-pressed', 'true');
    const saw = audioCtx().created('oscillator')[0] as unknown as FakeOscillator;
    // Asa fixa a 10 m/s: 50 + 3 · 10 Hz.
    expect(saw.frequency.value).toBe(80);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Taxa / velocidade' }), {
      key: 'ArrowRight',
    });
    expect(saw.frequency.value).toBe(83);

    fireEvent.click(screen.getByRole('button', { name: 'WIND' }));
    fireEvent.click(motor);
    expect(motor).toHaveAttribute('aria-pressed', 'false');
    expect((saw as unknown as { stopped: number | null }).stopped).not.toBeNull();

    unmount();
    const noise = audioCtx().created('bufferSource').at(-1) as unknown as {
      stopped: number | null;
    };
    expect(noise.stopped).not.toBeNull();
  });

  it('os volumes e o mudo alteram as configurações', () => {
    render(<SoundBoard />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume geral' }), { key: 'ArrowLeft' });
    expect(useGameStore.getState().settings.masterVolume).toBeCloseTo(0.75, 12);
    const mute = screen.getByRole('button', { name: 'Som ligado' });
    fireEvent.click(mute);
    expect(useGameStore.getState().settings.muted).toBe(true);
    expect(
      within(screen.getByTestId('sound-board')).getByRole('button', { name: 'Mudo' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('AudioDriver', () => {
  it('só cria o AudioContext no primeiro gesto (REQ-AUD-001)', () => {
    render(<AudioDriver />);
    expect(FakeAudioContext.instances).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'a' });
    expect(FakeAudioContext.instances).toHaveLength(1);
    fireEvent.pointerDown(window);
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('aplica os volumes das configurações ao master (REQ-AUD-003)', () => {
    render(<AudioDriver />);
    fireEvent.pointerDown(window);
    const master = () => (AudioEngine.get().masterGain as unknown as FakeGain).gain.value;
    expect(master()).toBeCloseTo(0.64, 12);
    useGameStore.getState().setSetting('masterVolume', 0.5);
    expect(master()).toBe(0.25);
    useGameStore.getState().setSetting('muted', true);
    expect(master()).toBe(0);
  });

  it('um botão do controle também libera o áudio', async () => {
    const { InputManager } = await import('@/input/InputManager');
    const { createPad, installGamepads, setButton, XBOX_ID } = await import('@/test/fakeGamepad');
    render(<AudioDriver />);
    const pad = createPad(XBOX_ID);
    const uninstall = installGamepads([pad]);
    setButton(pad, 0, true);
    InputManager.get().poll(1);
    expect(FakeAudioContext.instances).toHaveLength(1);
    uninstall();
  });
});

describe('integrações', () => {
  it('Button toca UI_CLICK e spend negado toca DENIED', () => {
    AudioEngine.get().unlock();
    const play = vi.spyOn(AudioEngine.get(), 'play');
    render(<SoundBoard />);
    fireEvent.click(screen.getByRole('button', { name: 'Som ligado' }));
    expect(play).toHaveBeenCalledWith('UI_CLICK');
    useGameStore.getState().spend(99_999_999, 'teste');
    expect(play).toHaveBeenCalledWith('DENIED');
  });
});
