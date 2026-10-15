import { app } from '../core/app';
import { CHARACTER_LIST } from '../data/characters';
import { MoveListPanel } from '../ui/movelistPanel';
import * as flow from './flow';
import { drawMenuBg } from './menuBg';
import { Scene } from './scene';

/** Full-screen move list (from the main menu). */
export class MoveListScene extends Scene {
  readonly id = 'MoveListScene';
  private panel = new MoveListPanel(CHARACTER_LIST[0].id, false);

  constructor() {
    super();
    this.panel.onClose = () => flow.toMainMenu();
  }

  update(): void {
    this.panel.update(app().input.menuEvents());
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawMenuBg(ctx, this.time, CHARACTER_LIST[this.panel.charIndex].themeColor, '技');
    this.panel.render(ctx);
  }
}
