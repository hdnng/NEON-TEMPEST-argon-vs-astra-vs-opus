import { app } from '../core/app';
import { SettingsPanel } from '../ui/settingsPanel';
import { C } from '../ui/theme';
import * as flow from './flow';
import { drawMenuBg } from './menuBg';
import { Scene } from './scene';

/** Full-screen settings (from the main menu). */
export class SettingsScene extends Scene {
  readonly id = 'SettingsScene';
  private panel = new SettingsPanel();

  constructor() {
    super();
    this.panel.onClose = () => flow.toMainMenu();
  }

  update(): void {
    this.panel.update(app().input.menuEventsTagged());
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBg(ctx, this.time, C.cyan, '設');
    this.panel.render(ctx);
  }
}
