/**
 * Match camera. The camera looks at world point (x, y), which maps to screen (W/2, GROUND_Y);
 * zoom scales around that point. World coordinates are stage pixels with +y up (y = 0 is the floor).
 *
 *   screenX = W/2 + (worldX - cam.x) * zoom + shakeX
 *   screenY = GROUND_Y - (worldY - cam.y) * zoom + shakeY
 *
 * Parallax layers at depth factor p (0 = infinitely far, 1 = fighter plane) use
 *   zoomP = 1 + (zoom - 1) * p,  screenX = W/2 + (worldX - cam.x * p) * zoomP
 */
import { W } from '../core/view';
import { STAGE_HALF } from '../sim/types';

export const GROUND_Y = 636;
export const ZOOM_NEAR = 1.24;
export const ZOOM_FAR = 1.0;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
}

export function makeCamera(): Camera {
  return { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
}

export function sx(cam: Camera, wx: number): number {
  return W / 2 + (wx - cam.x) * cam.zoom + cam.shakeX;
}

export function sy(cam: Camera, wy: number): number {
  return GROUND_Y - (wy - cam.y) * cam.zoom + cam.shakeY;
}

export function parallaxZoom(cam: Camera, p: number): number {
  return 1 + (cam.zoom - 1) * p;
}

/** Screen x of a world x on a parallax layer with depth factor p. */
export function psx(cam: Camera, wx: number, p: number): number {
  return W / 2 + (wx - cam.x * p) * parallaxZoom(cam, p) + cam.shakeX * p;
}

/** Screen y of a world y on a parallax layer with depth factor p. */
export function psy(cam: Camera, wy: number, p: number): number {
  return GROUND_Y - (wy - cam.y * p) * parallaxZoom(cam, p) + cam.shakeY * p;
}

/** Clamps the camera so the view never shows beyond the stage walls (plus a small margin). */
export function clampCamera(cam: Camera): void {
  const half = W / 2 / cam.zoom;
  const lim = Math.max(0, STAGE_HALF + 40 - half);
  if (cam.x > lim) cam.x = lim;
  if (cam.x < -lim) cam.x = -lim;
  if (cam.y < 0) cam.y = 0;
}

/** Visible world x range for culling. */
export function viewRange(cam: Camera): [number, number] {
  const half = W / 2 / cam.zoom;
  return [cam.x - half - 40, cam.x + half + 40];
}
