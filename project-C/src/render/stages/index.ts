/**
 * Stage registry.
 */
import { RooftopStage } from './rooftop';
import { PitStage } from './pit';
import { ShrineStage } from './shrine';
import type { Stage, StageInfo, StageOptions } from './types';

const FACTORIES: Record<string, (o: StageOptions) => Stage> = {
  rooftop: (o) => new RooftopStage(o),
  shrine: (o) => new ShrineStage(o),
  pit: (o) => new PitStage(o),
};

export const STAGE_INFOS: StageInfo[] = Object.keys(FACTORIES).map((id) => FACTORIES[id]({ flashReduction: false }).info);

export function createStage(id: string, opts: StageOptions): Stage {
  const f = FACTORIES[id] ?? FACTORIES.rooftop;
  return f(opts);
}
