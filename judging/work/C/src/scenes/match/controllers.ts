/**
 * Input sources for a fighter. Every controller produces raw input bits per frame that go
 * through the exact same simulation input system (CPU included - no frame-perfect shortcuts).
 */
import { app } from '../../core/app';
import type { MatchState } from '../../sim/types';

export interface Controller {
  /** Input bits for this frame. Called once per simulation step. */
  next(s: MatchState, idx: number): number;
  readonly kind: 'human' | 'cpu' | 'replay' | 'dummy';
}

export class HumanController implements Controller {
  readonly kind = 'human';
  constructor(private player: 0 | 1) {}
  next(): number { return app().input.playerBits(this.player); }
}

export class ReplayController implements Controller {
  readonly kind = 'replay';
  private i = 0;
  constructor(private inputs: number[], private idx: number) {}
  next(): number {
    const v = this.inputs[this.i * 2 + this.idx] ?? 0;
    this.i++;
    return v;
  }
  reset(): void { this.i = 0; }
}
