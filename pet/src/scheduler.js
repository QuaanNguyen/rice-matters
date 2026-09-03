'use strict';
(function () {

const HIGH = new Set(['refused', 'rejecting', 'error', 'asking', 'celebrating']);

const MIN_DWELL = {
  refused: 2200,
  rejecting: 2200,
  error: 2200,
  asking: 2200,
  celebrating: 2200,
  suspicious: 1400,
  proving: 1400,
  watching: 1000,
  checking: 1000,
  allowed: 900,
  thinking: 0,
  calm: 0,
  sleeping: 0,
  offline: 0,
};

const HOLD = {
  allowed: 900,
  watching: 1400,
  checking: 1600,
  thinking: 0,
  suspicious: 5200,
  refused: 6000,
  proving: 2600,
  rejecting: 6500,
  celebrating: 4200,
  error: 4000,
  asking: 8000,
  calm: 0,
  sleeping: 0,
  offline: 0,
};

function actionIdOf(e) {
  return e && e.detail && e.detail.actionId != null ? e.detail.actionId : null;
}

function createReactionScheduler(opts = {}) {
  const now = opts.now || (() => Date.now());
  const setTimeoutFn = opts.setTimeout || setTimeout;
  const clearTimeoutFn = opts.clearTimeout || clearTimeout;
  const onShow = opts.onShow || (() => {});
  const onSettle = opts.onSettle || (() => {});

  const queue = [];
  let dwellTimer = null;
  let holdTimer = null;
  let current = null;

  function clearDwell() {
    if (dwellTimer != null) {
      clearTimeoutFn(dwellTimer);
      dwellTimer = null;
    }
  }

  function clearHold() {
    if (holdTimer != null) {
      clearTimeoutFn(holdTimer);
      holdTimer = null;
    }
  }

  function coalescePush(e) {
    const state = e.petState;
    const id = actionIdOf(e);

    if (queue.length) {
      const last = queue[queue.length - 1];
      if (last.petState === state) {
        queue[queue.length - 1] = e;
        return;
      }
    }

    if (id != null) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].petState === state && actionIdOf(queue[i]) === id) {
          if (!HIGH.has(state) || queue[i].petState === state) {
            queue[i] = e;
            return;
          }
        }
      }
    }

    queue.push(e);
  }

  function startHold(state) {
    clearHold();
    const hold = HOLD[state] == null ? 2500 : HOLD[state];
    if (hold <= 0) {
      current = null;
      onSettle();
      return;
    }
    holdTimer = setTimeoutFn(() => {
      holdTimer = null;
      current = null;
      onSettle();
    }, hold);
  }

  function advance() {
    clearDwell();
    if (queue.length) {
      const e = queue.shift();
      current = e;
      onShow(e);
      const dwell = MIN_DWELL[e.petState] == null ? 900 : MIN_DWELL[e.petState];
      dwellTimer = setTimeoutFn(() => {
        dwellTimer = null;
        if (queue.length) advance();
        else startHold(e.petState);
      }, Math.max(0, dwell));
      return;
    }
    if (current) startHold(current.petState);
    else onSettle();
  }

  function enqueue(e) {
    if (!e || !e.petState) return;
    coalescePush(e);
    if (holdTimer != null) {
      clearHold();
      current = null;
    }
    if (dwellTimer == null) advance();
  }

  function reset() {
    clearDwell();
    clearHold();
    queue.length = 0;
    current = null;
  }

  function showingImportant() {
    return !!(current && HIGH.has(current.petState));
  }

  return {
    enqueue,
    reset,
    showingImportant,
    queueSnapshot() { return queue.map((e) => e.petState); },
    currentState() { return current ? current.petState : null; },
    HIGH,
    MIN_DWELL,
    HOLD,
  };
}

const api = { createReactionScheduler, HIGH, MIN_DWELL, HOLD };

if (typeof window !== 'undefined') window.RiceScheduler = api;
if (typeof module !== 'undefined') module.exports = api;
})();
