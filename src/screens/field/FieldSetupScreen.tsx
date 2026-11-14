import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { STRINGS } from '@/data/strings';
import { accessMask } from '@/engines/field/satellite';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useInputContext } from '@/input/useInputContext';
import { useGameStore } from '@/state/store';
import type { MissionData } from '@/types';
import { Button, ConfirmDialog, Tabs, type TabDef } from '@/ui';
import { CalibrationTab } from './CalibrationTab';
import { ChecklistTab } from './ChecklistTab';
import { movePoint, placePoint, removePoint, type PointTool } from './fieldModel';
import { FlightPlanTab } from './FlightPlanTab';
import { GroundPointsTab } from './GroundPointsTab';
import { SatelliteView } from './SatelliteView';
import { useFieldContext } from './useFieldContext';
import { TutorialHint } from '../common/TutorialHint';

const F = STRINGS.field;

export type FieldTab = 'POINTS' | 'PLAN' | 'CALIBRATION' | 'CHECKLIST';
const TAB_ORDER: readonly FieldTab[] = ['POINTS', 'PLAN', 'CALIBRATION', 'CHECKLIST'];
const TABS: ReadonlyArray<TabDef<FieldTab>> = TAB_ORDER.map((id) => ({ id, label: F.tabs[id] }));

const TOOL_KEYS: Readonly<Record<string, PointTool>> = { KeyG: 'GCP', KeyC: 'CP', KeyX: 'ERASER' };

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Planejamento técnico (field-setup §3–§5): wizard em abas sobre a vista de satélite. */
export function FieldSetupScreen() {
  const mission = useGameStore((s) => s.mission.active);
  if (!mission) return <NoMission />;
  return <FieldSetup mission={mission} />;
}

function NoMission() {
  return (
    <main
      className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950"
      data-testid="field-setup-screen"
    >
      <p className="text-slate-300">{F.noMission}</p>
      <Button icon={ArrowLeft} onClick={() => useGameStore.getState().goTo('WORLD_MAP')}>
        {F.backToMap}
      </Button>
    </main>
  );
}

function FieldSetup({ mission }: { mission: MissionData }) {
  useInputContext('FIELD');
  const field = useFieldContext(mission);
  const { contract, terrain, vehicles, rules, equipment } = field;
  const areaRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<FieldTab>('POINTS');
  const [tool, setTool] = useState<PointTool>('GCP');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const mask = useMemo(
    () => accessMask(terrain, vehicles, rules),
    // `rules` é recriado a cada render; o que importa é a regra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrain, vehicles, rules.paintMarkers],
  );

  useFocusNavigation(areaRef, {
    context: 'FIELD',
    active: !confirmCancel,
    onBack: () => {
      const i = TAB_ORDER.indexOf(tab);
      if (i <= 0) setConfirmCancel(true);
      else setTab(TAB_ORDER[i - 1] as FieldTab);
    },
  });

  useEffect(() => {
    if (tab !== 'POINTS' || confirmCancel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const next = TOOL_KEYS[e.code];
      if (!next || e.repeat || isTyping(e.target)) return;
      setTool(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tab, confirmCancel]);

  const points = mission.groundPoints;
  const setPoints = useGameStore.getState().setGroundPoints;

  const onPlace = (u: number, v: number): string | null => {
    const kind = tool === 'CP' ? 'CP' : 'GCP';
    const result = placePoint(points, kind, { u, v }, terrain, vehicles, rules, equipment);
    if (!result.ok) return result.reason;
    setPoints(result.points);
    return null;
  };
  const onMove = (id: string, u: number, v: number): string | null => {
    const result = movePoint(points, id, { u, v }, terrain, vehicles, rules);
    if (!result.ok) return result.reason;
    setPoints(result.points);
    return null;
  };

  const takeoff = () => {
    const { launchMission, goTo } = useGameStore.getState();
    const launched = launchMission();
    if (launched) goTo('SURVEY_FLIGHT', { missionId: launched.id });
  };

  const cancel = () => {
    const { discardActive, goTo } = useGameStore.getState();
    setConfirmCancel(false);
    goTo('WORLD_MAP');
    discardActive();
  };

  return (
    <main
      ref={areaRef}
      data-testid="field-setup-screen"
      aria-label={F.title}
      className="flex h-full w-full flex-col bg-slate-950"
    >
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-slate-800 bg-slate-900/95 px-4">
        <div className="flex min-w-0 flex-col leading-tight">
          <span
            className="truncate text-sm font-semibold text-slate-100"
            data-testid="field-contract"
          >
            {contract.title}
          </span>
          <span className="truncate text-xs text-slate-400">{contract.client.name}</span>
        </div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel={F.title} />
        <Button variant="ghost" icon={X} className="ml-auto" onClick={() => setConfirmCancel(true)}>
          {F.cancel}
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute top-3 left-3 z-10">
            {tab === 'POINTS' && <TutorialHint step={1} />}
            {tab === 'PLAN' && <TutorialHint step={2} />}
          </div>
          <SatelliteView
            contract={contract}
            terrain={terrain}
            plan={mission.plan}
            points={points}
            lighting={mission.plan.params.lighting}
            mask={mask}
            tool={tab === 'POINTS' ? tool : null}
            onPlace={onPlace}
            onMove={onMove}
            onRemove={(id) => setPoints(removePoint(points, id))}
          />
        </section>
        <aside
          className="w-[380px] shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900/80 p-4"
          data-testid="field-panel"
        >
          {tab === 'POINTS' && <GroundPointsTab field={field} tool={tool} onTool={setTool} />}
          {tab === 'PLAN' && <FlightPlanTab field={field} />}
          {tab === 'CALIBRATION' && <CalibrationTab field={field} />}
          {tab === 'CHECKLIST' && <ChecklistTab field={field} onTakeoff={takeoff} />}
        </aside>
      </div>
      {confirmCancel && (
        <ConfirmDialog
          title={F.cancelTitle}
          message={F.cancelMessage}
          confirmLabel={F.cancelConfirm}
          cancelLabel={F.keepPlanning}
          danger
          onConfirm={cancel}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </main>
  );
}
