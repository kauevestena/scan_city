import { ArrowLeft, Check, Landmark, Layers } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import type { LoopHandle } from '@/audio/sfx';
import { getContract } from '@/data/contracts';
import { STRINGS } from '@/data/strings';
import { processingSpeed } from '@/domain/processing';
import { CATALOG, getAircraft, getHardware, getVehicle } from '@/data/catalog';
import { drawPipelineStage, cloudSamples, type PipelineAssets } from '@/engines/raster/pipelineViz';
import { rasterCanvas } from '@/engines/raster/orthoPreview';
import { useGameLoop } from '@/engines/useGameLoop';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { useInputContext } from '@/input/useInputContext';
import { formatNumber } from '@/lib/format';
import { hashString, mulberry32 } from '@/lib/rng';
import { useGameStore } from '@/state/store';
import type { MissionData, QualityReport } from '@/types';
import { Button, nextEnabledTab, Tabs, type TabDef } from '@/ui';
import { createTerrain } from '@/world/terrain/createTerrain';
import { evaluateForState, findMissionToProcess } from './evaluate';
import { Pipeline } from './Pipeline';
import { pipelineShares } from '@/domain/processing';
import { pipelineAt, planStages, type PipelineProgress } from './pipelineModel';
import { ReportAccuracy } from './ReportAccuracy';
import { ReportCoverage } from './ReportCoverage';
import { ReportPayment } from './ReportPayment';
import { drawLidarStage } from '@/engines/raster/lidarViz';
import { ProductViewer } from './ProductViewer';
import { ReportSummary } from './ReportSummary';
import { completeTutorialStep, TutorialHint } from '../common/TutorialHint';
import { resolveRuleEffects } from '@/domain/specialRules';

const P = STRINGS.processing;
type ReportTab = 'SUMMARY' | 'ACCURACY' | 'COVERAGE' | 'PRODUCTS' | 'PAYMENT';
const TABS: ReadonlyArray<TabDef<ReportTab>> = (
  ['SUMMARY', 'ACCURACY', 'COVERAGE', 'PRODUCTS', 'PAYMENT'] as const
).map((id) => ({
  id,
  label: P.tabs[id],
}));

interface Job {
  mission: MissionData;
  report: QualityReport;
  inField: boolean;
  withStaff: boolean;
  speed: number;
}

/** LOADING: lê o payload e avalia a missão uma vez, na montagem. */
function loadJob(): Job | null {
  const state = useGameStore.getState();
  const payload = state.session.payload as { missionId?: unknown; inField?: unknown } | undefined;
  if (typeof payload?.missionId !== 'string') return null;
  const mission = findMissionToProcess(state, payload.missionId);
  if (!mission) return null;
  const inField = payload.inField === true;
  const ownsVan = state.inventory.vehicles.includes('LAB_VAN');
  const speed = processingSpeed(
    getHardware(state.inventory.hardware),
    state.staff,
    CATALOG.staff,
    inField,
    ownsVan ? getVehicle('LAB_VAN') : undefined,
  );
  const withStaff = Object.values(state.staff).some((n) => n > 0);
  return { mission, report: evaluateForState(state, mission, inField), inField, withStaff, speed };
}

/** Processamento e relatório (processing-results §3–§5). */
export function ProcessingResultsScreen() {
  const [job] = useState(loadJob);
  if (!job) return <NotFound />;
  return <Processing job={job} />;
}

function NotFound() {
  return (
    <main
      className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950"
      data-testid="processing-screen"
    >
      <p className="text-slate-300">{P.notFound}</p>
      <Button icon={ArrowLeft} onClick={() => useGameStore.getState().goTo('OFFICE')}>
        {P.finishOffice}
      </Button>
    </main>
  );
}

function Processing({ job }: { job: Job }) {
  useInputContext('UI');
  const { mission, report, inField } = job;
  const contract = getContract(mission.contractId);
  const hardware = useGameStore((s) => getHardware(s.inventory.hardware));
  // Esteira SfM, LiDAR ou as duas em sequência, com o tempo dividido pelos dados (§5.1).
  const stages = useMemo(() => {
    const pulses = mission.lidar?.grid.pulses.reduce((sum, p) => sum + p, 0) ?? 0;
    return planStages(
      report.processingTimeS,
      pipelineShares(mission.shots.length, pulses),
      job.withStaff,
    );
  }, [report.processingTimeS, job.withStaff, mission]);
  const durations = useMemo(() => stages.map((st) => st.durationS), [stages]);
  const [progress, setProgress] = useState<PipelineProgress>(() => pipelineAt(0, durations));
  const [tab, setTab] = useState<ReportTab>('SUMMARY');
  // A falha crítica (fora do replay) pode ter levado o contrato para a MegaMap.
  const stolen =
    useGameStore((s) => s.contracts[contract.id]?.status === 'STOLEN') &&
    report.critical &&
    !mission.isReplay;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const done = progress.done;
  const changeTab = (next: ReportTab) => {
    setTab(next);
    if (next === 'COVERAGE') completeTutorialStep(4);
  };
  // Com o relatório na tela, as setas e o D-pad andam pelos controles e Q/E (LB/RB) trocam de aba.
  useFocusNavigation(mainRef, {
    active: done,
    onTabPrev: () => changeTab(nextEnabledTab(TABS, tab, -1)),
    onTabNext: () => changeTab(nextEnabledTab(TABS, tab, 1)),
  });

  const assets = useMemo<PipelineAssets>(() => {
    const terrain = createTerrain(contract);
    const ortho = rasterCanvas(terrain, 'ORTHO');
    const assetsSeed = hashString(mission.id);
    const result: PipelineAssets = {
      ortho,
      hypso: rasterCanvas(terrain, 'HYPSO'),
      orthoW: ortho.width,
      orthoH: ortho.height,
      aoi: contract.aoi,
      shots: mission.shots.filter(
        (_, k) => k % Math.max(1, Math.floor(mission.shots.length / 24)) === 0,
      ),
      lines: mission.plan.lines,
      cloud: cloudSamples(terrain, mulberry32(assetsSeed)),
      objects: terrain.objects,
      roads: terrain.roads,
      homogeneous: resolveRuleEffects(contract.specialRules).accuracy.homogeneousTexture !== null,
      seed: assetsSeed,
    };
    if (report.lens) result.lens = report.lens;
    if (mission.lidar) {
      const samples = mission.lidar.samples;
      const stride = Math.max(1, Math.ceil(samples.length / 1500));
      const state = useGameStore.getState();
      const rtk =
        getAircraft(mission.plan.params.aircraftId).rtk &&
        state.inventory.fieldEquipment.includes('GNSS_RTK_KIT');
      result.lidar = {
        samples: samples.filter((_, k) => k % stride === 0),
        // σ da trajetória: o RTK fixo e a IMU calibrada a reduzem.
        sigmaCm: (rtk ? 2.5 : 6) * (1 - 0.12 * (mission.minigames.imuScore ?? 0)),
        pulses: mission.lidar.grid.pulses.reduce((sum, p) => sum + p, 0),
      };
    }
    return result;
  }, [contract, mission, report.lens]);

  // Esteira: avança com o loop (congela na pausa); cada etapa concluída toca STAGE_DONE.
  useGameLoop(() => {
    if (done) return null;
    let elapsed = 0;
    let lastStage = 0;
    let timeS = 0;
    return {
      update: (dt) => {
        elapsed += dt;
        timeS += dt;
      },
      render: () => {
        const now = pipelineAt(elapsed, durations);
        if (now.stage > lastStage) {
          for (let k = lastStage; k < now.stage; k++) AudioEngine.get().play('STAGE_DONE');
          lastStage = now.stage;
        }
        const ctx = canvasRef.current?.getContext('2d');
        const stage = stages[now.stage];
        if (ctx && stage && !now.done) {
          if (stage.track === 'LIDAR') {
            drawLidarStage(ctx, assets, stage.index, now.progress, P.lidarViz);
          } else {
            drawPipelineStage(ctx, assets, stage.index, now.progress, timeS, P.viz);
          }
        }
        setProgress(now);
      },
    };
  }, [done, durations, stages, assets]);

  // Ventilador da Workstation durante a esteira, proporcional ao fator de velocidade.
  useEffect(() => {
    if (done) return;
    const loop: LoopHandle = AudioEngine.get().startLoop('PROCESSING');
    loop.setParam('rate', job.speed);
    return () => loop.stop(0.3);
  }, [done, job.speed]);

  // REPORT: as recompensas são aplicadas uma vez (a ação é idempotente).
  useEffect(() => {
    if (done) useGameStore.getState().applyMissionResult(report);
  }, [done, report]);

  const sendToMuseum = () =>
    useGameStore.getState().goTo('HOLO_TABLE_VIEW', { focusSectorId: contract.id });
  const finish = () => useGameStore.getState().goTo(inField ? 'WORLD_MAP' : 'OFFICE');

  return (
    <main
      ref={mainRef}
      data-testid="processing-screen"
      aria-label={P.title}
      className="flex h-full w-full flex-col overflow-y-auto bg-slate-950 p-6"
    >
      <header className="mb-6 text-sm text-slate-300" data-testid="processing-header">
        {P.header(contract.title, hardware.name, formatNumber(job.speed, 1))}
        {job.withStaff && ` ${P.withStaff}`}
      </header>
      {!done && <Pipeline progress={progress} stages={stages} canvasRef={canvasRef} />}
      {done && (
        <div className="flex flex-col gap-5" data-testid="report">
          <Tabs tabs={TABS} value={tab} onChange={changeTab} ariaLabel={P.title} />
          <TutorialHint step={4} className="w-fit" />
          {tab === 'SUMMARY' && <ReportSummary report={report} mission={mission} />}
          {tab === 'ACCURACY' && <ReportAccuracy report={report} mission={mission} />}
          {tab === 'COVERAGE' && <ReportCoverage report={report} mission={mission} />}
          {tab === 'PRODUCTS' && <ProductViewer report={report} mission={mission} />}
          {tab === 'PAYMENT' && <ReportPayment report={report} stolen={stolen} />}
          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            {tab !== 'PRODUCTS' && (
              <Button variant="ghost" icon={Layers} onClick={() => setTab('PRODUCTS')}>
                {P.viewProducts}
              </Button>
            )}
            <Button variant="ghost" icon={inField ? ArrowLeft : Check} onClick={finish}>
              {inField ? P.finishField : P.finishOffice}
            </Button>
            <Button
              variant="primary"
              icon={Landmark}
              disabled={!report.approved}
              title={report.approved ? undefined : P.museumOnlyApproved}
              onClick={sendToMuseum}
              data-testid="send-museum"
            >
              {P.sendToMuseum}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
