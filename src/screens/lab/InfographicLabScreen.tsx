import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { STRINGS } from '@/data/strings';
import { useCanvas } from '@/engines/useCanvas';
import { useGameLoop } from '@/engines/useGameLoop';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useInputContext } from '@/input/useInputContext';
import { useGameStore } from '@/state/store';
import { Button, Tabs, type TabDef } from '@/ui';
import { snapToStep } from '@/ui/Slider';
import { equipmentValues } from './equipment';
import { LabSimulation, type LabPanelId, type LabTargets } from './LabSimulation';
import { OPTICS_RANGES, OpticsPanel } from './OpticsPanel';
import type { OpticsInput, StereoInput } from './readings';
import { STEREO_RANGES, StereoPanel, withHeight } from './StereoPanel';

const L = STRINGS.lab;

/** Os painéis implementados, na ordem das abas. */
export const LAB_PANELS: readonly LabPanelId[] = ['OPTICS', 'STEREO'];

const TABS: ReadonlyArray<TabDef<LabPanelId>> = LAB_PANELS.map((id, k) => ({
  id,
  label: `${k + 1} ${L.tabs[id]}`,
}));

/** Valores de abertura: os dos golden values G2 (óptica) e G14/G15 (estereoscopia). */
export const DEFAULT_OPTICS: OpticsInput = {
  heightM: 100,
  focalMm: 35,
  pixelUm: 4.38,
  sensorWidthMm: 36,
};
export const DEFAULT_STEREO: StereoInput = {
  baseM: 30,
  heightM: 100,
  objectM: 20,
  focalMm: 35,
  sigmaPx: 0.5,
};

const isPanel = (id: unknown): id is LabPanelId => LAB_PANELS.some((p) => p === id);

/** O payload `panel` abre direto um painel; sem ele (ou desconhecido), o primeiro. */
function initialPanel(): LabPanelId {
  const payload = useGameStore.getState().session.payload as { panel?: unknown } | undefined;
  return isPanel(payload?.panel) ? payload.panel : (LAB_PANELS[0] as LabPanelId);
}

const snap = (v: number, r: { min: number; max: number; step: number }) =>
  snapToStep(v, r.min, r.max, r.step);

const goBack = () => useGameStore.getState().goTo('OFFICE');

/**
 * Laboratório de Infográficos (infographic-lab, REQ-LAB-001, REQ-LAB-002): abas com os painéis, o
 * diagrama animado à esquerda e, à direita, sliders, leituras, fórmulas ao vivo e a dica. Os
 * valores dos sliders são locais à tela (não são salvos) e todos os números vêm de `@/domain`.
 */
export function InfographicLabScreen() {
  useInputContext('UI');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const surface = useCanvas(canvasRef);
  const [panel, setPanel] = useState<LabPanelId>(initialPanel);
  const [optics, setOptics] = useState<OpticsInput>(DEFAULT_OPTICS);
  const [stereo, setStereo] = useState<StereoInput>(DEFAULT_STEREO);
  const [equipmentNote, setEquipmentNote] = useState<string | null>(null);

  // Os alvos mais recentes chegam ao laço (criado uma vez por canvas) por uma ref.
  const targets = useRef<LabTargets>({ panel, optics, stereo });
  useEffect(() => {
    targets.current = { panel, optics, stereo };
  }, [panel, optics, stereo]);

  useGameLoop(() => {
    if (!surface) return null;
    return new LabSimulation(surface, () => targets.current);
  }, [surface]);

  const cycleTab = (dir: 1 | -1) => {
    const next =
      LAB_PANELS[(LAB_PANELS.indexOf(panel) + dir + LAB_PANELS.length) % LAB_PANELS.length];
    if (next) setPanel(next);
  };
  useFocusNavigation(mainRef, {
    onBack: goBack,
    onTabPrev: () => cycleTab(-1),
    onTabNext: () => cycleTab(1),
  });

  const useEquipment = () => {
    const eq = equipmentValues(useGameStore.getState().inventory);
    setEquipmentNote(L.equipmentUsed(eq.cameraLabel, eq.aircraftName));
    if (panel === 'OPTICS') {
      const r = OPTICS_RANGES;
      setOptics({
        heightM: snap(eq.optics.heightM, r.heightM),
        focalMm: snap(eq.optics.focalMm, r.focalMm),
        pixelUm: snap(eq.optics.pixelUm, r.pixelUm),
        sensorWidthMm: snap(eq.optics.sensorWidthMm, r.sensorWidthMm),
      });
    } else {
      const r = STEREO_RANGES;
      setStereo((s) =>
        withHeight(
          {
            ...s,
            baseM: snap(eq.stereo.baseM, r.baseM),
            focalMm: snap(eq.stereo.focalMm, r.focalMm),
          },
          snap(eq.stereo.heightM, r.heightM),
        ),
      );
    }
  };

  return (
    <main
      ref={mainRef}
      data-testid="lab-screen"
      data-panel={panel}
      aria-label={L.title}
      className="flex h-full w-full flex-col overflow-hidden bg-slate-950"
    >
      <div className="flex items-end justify-between gap-3 border-b border-slate-800 px-3 pt-2">
        <Tabs
          tabs={TABS}
          value={panel}
          onChange={(id) => {
            setPanel(id);
            setEquipmentNote(null);
          }}
          ariaLabel={L.tabsLabel}
        />
        <Button icon={ArrowLeft} glyph="UI_BACK" size="sm" className="mb-1" onClick={goBack}>
          {L.back}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={L.diagram[panel]}
            className="absolute inset-0 block h-full w-full"
            data-testid="lab-canvas"
          />
        </div>
        <aside
          data-testid="lab-sidebar"
          className="w-[24rem] shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/80 p-4"
        >
          {panel === 'OPTICS' ? (
            <OpticsPanel
              value={optics}
              onChange={setOptics}
              onUseEquipment={useEquipment}
              equipmentNote={equipmentNote}
            />
          ) : (
            <StereoPanel
              value={stereo}
              onChange={setStereo}
              onUseEquipment={useEquipment}
              equipmentNote={equipmentNote}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
