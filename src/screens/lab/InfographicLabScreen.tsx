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
import { CanopyPanel } from './CanopyPanel';
import { equipmentValues } from './equipment';
import { LabSimulation, type LabPanelId, type LabTargets } from './LabSimulation';
import { OPTICS_RANGES, OpticsPanel } from './OpticsPanel';
import type { CanopyInput, OpticsInput, ShutterInput, StereoInput } from './readings';
import { SHUTTER_RANGES, ShutterPanel } from './ShutterPanel';
import { STEREO_RANGES, StereoPanel, withHeight } from './StereoPanel';
import { CANOPY_RANGES } from './CanopyPanel';

const L = STRINGS.lab;

/** Os painéis implementados, na ordem das abas. */
export const LAB_PANELS: readonly LabPanelId[] = ['OPTICS', 'STEREO', 'CANOPY', 'SHUTTER'];

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

export const DEFAULT_CANOPY: CanopyInput = {
  canopyPct: 70,
  maxReturns: 3,
  prrKHz: 240,
  heightM: 100,
  speedMs: 12,
};
/** G11: v 8 m/s, leitura de 30 ms e GSD de 2,74 cm dão 8,76 px de skew. */
export const DEFAULT_SHUTTER: ShutterInput = {
  speedMs: 8,
  readoutMs: 30,
  spinDegS: 0,
  gsdCm: 2.74,
  global: false,
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
  const [canopy, setCanopy] = useState<CanopyInput>(DEFAULT_CANOPY);
  const [shutter, setShutter] = useState<ShutterInput>(DEFAULT_SHUTTER);
  const [equipmentNote, setEquipmentNote] = useState<string | null>(null);

  // Os alvos mais recentes chegam ao laço (criado uma vez por canvas) por uma ref.
  const targets = useRef<LabTargets>({ panel, optics, stereo, canopy, shutter });
  useEffect(() => {
    targets.current = { panel, optics, stereo, canopy, shutter };
  }, [panel, optics, stereo, canopy, shutter]);

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
    const used = (what: string) => L.equipmentUsed(what, eq.aircraftName);
    if (panel === 'OPTICS') {
      const r = OPTICS_RANGES;
      setEquipmentNote(used(eq.cameraLabel));
      setOptics({
        heightM: snap(eq.optics.heightM, r.heightM),
        focalMm: snap(eq.optics.focalMm, r.focalMm),
        pixelUm: snap(eq.optics.pixelUm, r.pixelUm),
        sensorWidthMm: snap(eq.optics.sensorWidthMm, r.sensorWidthMm),
      });
    } else if (panel === 'STEREO') {
      const r = STEREO_RANGES;
      setEquipmentNote(used(eq.cameraLabel));
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
    } else if (panel === 'CANOPY') {
      const r = CANOPY_RANGES;
      setEquipmentNote(used(eq.payloadName ?? L.canopy.noPod));
      setCanopy((c) => ({
        ...c,
        heightM: snap(eq.canopy.heightM, r.heightM),
        speedMs: snap(eq.canopy.speedMs, r.speedMs),
        ...(eq.canopy.prrKHz !== undefined ? { prrKHz: snap(eq.canopy.prrKHz, r.prrKHz) } : {}),
        ...(eq.canopy.maxReturns !== undefined
          ? { maxReturns: snap(eq.canopy.maxReturns, r.maxReturns) }
          : {}),
      }));
    } else {
      const r = SHUTTER_RANGES;
      setEquipmentNote(used(eq.cameraLabel));
      setShutter((sh) => ({
        ...sh,
        speedMs: snap(eq.shutter.speedMs, r.speedMs),
        gsdCm: snap(eq.shutter.gsdCm, r.gsdCm),
        global: eq.shutter.global,
        ...(eq.shutter.readoutMs !== undefined
          ? { readoutMs: snap(eq.shutter.readoutMs, r.readoutMs) }
          : {}),
      }));
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
          {panel === 'OPTICS' && (
            <OpticsPanel
              value={optics}
              onChange={setOptics}
              onUseEquipment={useEquipment}
              equipmentNote={equipmentNote}
            />
          )}
          {panel === 'STEREO' && (
            <StereoPanel
              value={stereo}
              onChange={setStereo}
              onUseEquipment={useEquipment}
              equipmentNote={equipmentNote}
            />
          )}
          {panel === 'CANOPY' && (
            <CanopyPanel
              value={canopy}
              onChange={setCanopy}
              onUseEquipment={useEquipment}
              equipmentNote={equipmentNote}
            />
          )}
          {panel === 'SHUTTER' && (
            <ShutterPanel
              value={shutter}
              onChange={setShutter}
              onUseEquipment={useEquipment}
              equipmentNote={equipmentNote}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
