'use strict';
/**
 * Window sizing, with no Electron in it — so it can be tested.
 *
 * Rice lives in a screen corner, so growing has to keep the bottom-right
 * corner still. Growing from the top-left would walk the pet off the screen.
 */

const BASE_W = 340;
const BASE_H = 380;
const BASE_H_LOG = 590;

const SCALES = [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6, 2];
const DEFAULT_SCALE = 1;

function clampScale(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return DEFAULT_SCALE;
  return Math.min(SCALES[SCALES.length - 1], Math.max(SCALES[0], n));
}

/** Index of the step nearest to the current scale. */
function nearestStep(scale) {
  let best = 0;
  for (let i = 1; i < SCALES.length; i++) {
    if (Math.abs(SCALES[i] - scale) < Math.abs(SCALES[best] - scale)) best = i;
  }
  return best;
}

/** One notch bigger (+1) or smaller (-1), stopping at the ends. */
function stepScale(scale, dir) {
  const i = nearestStep(clampScale(scale));
  return SCALES[Math.min(SCALES.length - 1, Math.max(0, i + (dir > 0 ? 1 : -1)))];
}

/** New size at this scale, anchored on the current bottom-right corner. */
function boundsFor(prev, scale, logOpen) {
  const width = Math.round(BASE_W * scale);
  const height = Math.round((logOpen ? BASE_H_LOG : BASE_H) * scale);
  return {
    width,
    height,
    x: Math.round(prev.x + prev.width - width),
    y: Math.round(prev.y + prev.height - height),
  };
}

/**
 * Never let it end up off the edge of the display it is on.
 * The outer Math.max matters: if the window is bigger than the work area — a
 * small laptop at 2x with the log open — the inner clamp alone produces a
 * negative coordinate and pushes Rice off the top of the screen.
 */
function keepOnScreen(bounds, area) {
  return {
    width: bounds.width,
    height: bounds.height,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height)),
  };
}

/**
 * The largest step that actually fits on this display, so scaling up stops at
 * the screen rather than at an arbitrary number. Always returns something.
 */
function fitScale(scale, area, logOpen) {
  const baseH = logOpen ? BASE_H_LOG : BASE_H;
  const fits = (s) => BASE_W * s <= area.width && baseH * s <= area.height;
  if (fits(scale)) return scale;
  for (let i = SCALES.length - 1; i >= 0; i--) {
    if (SCALES[i] <= scale && fits(SCALES[i])) return SCALES[i];
  }
  return SCALES[0];
}

module.exports = { BASE_W, BASE_H, BASE_H_LOG, SCALES, DEFAULT_SCALE,
  clampScale, nearestStep, stepScale, boundsFor, keepOnScreen, fitScale };
