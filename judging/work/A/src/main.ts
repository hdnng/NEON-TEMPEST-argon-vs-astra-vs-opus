import { GameApp } from './scenes/gameApp';
import { stepMatch } from './core/simulation';
import { buildMotionSequence, buildRawInputFromNumpad } from './ai/cpuController';

declare global {
  interface Window {
    __NEON_TEMPEST__: {
      app: GameApp;
      stepMatch: typeof stepMatch;
      buildMotionSequence: typeof buildMotionSequence;
      buildRawInputFromNumpad: typeof buildRawInputFromNumpad;
    };
  }
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Missing #game-canvas element');
}

const app = new GameApp(canvas);
window.__NEON_TEMPEST__ = {
  app,
  stepMatch,
  buildMotionSequence,
  buildRawInputFromNumpad
};

app.start();
