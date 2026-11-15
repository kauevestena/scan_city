import { AudioLines, Music, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioEngine, type LoopHandle, type LoopId, type MotorVariant } from '@/audio/AudioEngine';
import { LOOP_IDS, SFX_IDS } from '@/audio/sfx';
import { STRINGS } from '@/data/strings';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useGameStore } from '@/state/store';
import { Button, Panel, Slider, Tabs } from '@/ui';

const VARIANTS: MotorVariant[] = ['MULTIROTOR', 'FIXED_WING', 'BIRD'];
const T = STRINGS.soundBoard;

function useAudioReady(): boolean {
  const engine = AudioEngine.get();
  return useSyncExternalStore(
    (notify) => engine.subscribe(notify),
    () => engine.ready,
  );
}

/** Mesa de som de depuração (`?debug=1&screen=SOUNDBOARD`): um botão por efeito e um toggle por loop. */
export function SoundBoard() {
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusNavigation(rootRef);
  const ready = useAudioReady();
  const settings = useGameStore((s) => s.settings);
  const setSetting = useGameStore((s) => s.setSetting);

  const loops = useRef(new Map<LoopId, LoopHandle>());
  const [playing, setPlaying] = useState<LoopId[]>([]);
  const [variant, setVariant] = useState<MotorVariant>('MULTIROTOR');
  const [rate, setRate] = useState(10);
  const [intensity, setIntensity] = useState(1);

  useEffect(() => {
    const active = loops.current;
    return () => {
      active.forEach((loop) => loop.stop(0));
      active.clear();
    };
  }, []);

  useEffect(() => {
    loops.current.forEach((loop) => {
      loop.setParam('rate', rate);
      loop.setParam('gain', intensity);
    });
  }, [rate, intensity, playing]);

  const toggleLoop = (id: LoopId) => {
    const engine = AudioEngine.get();
    engine.unlock();
    const current = loops.current.get(id);
    if (current) {
      current.stop();
      loops.current.delete(id);
      setPlaying((p) => p.filter((x) => x !== id));
      return;
    }
    loops.current.set(id, engine.startLoop(id, { variant }));
    setPlaying((p) => [...p, id]);
  };

  return (
    <div
      ref={rootRef}
      className="h-screen w-screen overflow-y-auto bg-slate-950 p-6 text-slate-100"
      data-testid="sound-board"
    >
      <h1 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-wide uppercase">
        <AudioLines size={24} strokeWidth={1.75} className="text-cyan-400" aria-hidden />
        {T.title}
      </h1>
      {!ready && <p className="mb-4 text-sm text-amber-400">{T.locked}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={T.effects} icon={Music} className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {SFX_IDS.map((id) => (
              <Button
                key={id}
                data-sfx={id}
                onClick={() => {
                  AudioEngine.get().unlock();
                  AudioEngine.get().play(id);
                }}
              >
                {id}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel title={T.mixer} icon={SlidersHorizontal}>
          <div className="flex flex-col gap-4">
            <Slider
              label={T.master}
              value={settings.masterVolume}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => setSetting('masterVolume', v)}
            />
            <Slider
              label={T.sfx}
              value={settings.sfxVolume}
              min={0}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(v) => setSetting('sfxVolume', v)}
            />
            <Button
              icon={settings.muted ? VolumeX : Volume2}
              variant={settings.muted ? 'danger' : 'secondary'}
              aria-pressed={settings.muted}
              onClick={() => setSetting('muted', !settings.muted)}
            >
              {settings.muted ? T.muted : T.unmuted}
            </Button>
          </div>
        </Panel>

        <Panel title={T.loops} icon={AudioLines} className="xl:col-span-3">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {LOOP_IDS.map((id) => {
                const on = playing.includes(id);
                return (
                  <Button
                    key={id}
                    data-loop={id}
                    aria-pressed={on}
                    variant={on ? 'primary' : 'secondary'}
                    onClick={() => toggleLoop(id)}
                  >
                    {id}
                  </Button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="mb-1 text-xs text-slate-400">{T.motorVariant}</p>
                <Tabs
                  tabs={VARIANTS.map((v) => ({ id: v, label: T.variants[v] }))}
                  value={variant}
                  onChange={setVariant}
                  ariaLabel={T.motorVariant}
                />
              </div>
              <Slider
                label={T.loopRate}
                value={rate}
                min={0}
                max={30}
                step={1}
                onChange={setRate}
              />
              <Slider
                label={T.loopGain}
                value={intensity}
                min={0}
                max={1}
                step={0.05}
                onChange={setIntensity}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
