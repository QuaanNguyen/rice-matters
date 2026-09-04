'use strict';

function parseOwnerPid(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function isProcessAlive(pid, killFn = process.kill) {
  try {
    killFn(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'EPERM') return true;
    if (err && err.code === 'ESRCH') return false;
    return false;
  }
}

function createOwnerRegistry(opts = {}) {
  const pollIntervalMs = opts.pollIntervalMs == null ? 2000 : opts.pollIntervalMs;
  const setIntervalFn = opts.setInterval || setInterval;
  const clearIntervalFn = opts.clearInterval || clearInterval;
  const killFn = opts.killFn || process.kill;
  const onBecameEmpty = opts.onBecameEmpty || (() => {});

  const owners = new Set();
  let everOwned = false;
  let timer = null;

  function stopPolling() {
    if (timer != null) {
      clearIntervalFn(timer);
      timer = null;
    }
  }

  function tick() {
    for (const pid of [...owners]) {
      if (!isProcessAlive(pid, killFn)) owners.delete(pid);
    }
    if (owners.size === 0) {
      stopPolling();
      if (everOwned) onBecameEmpty();
    }
  }

  function ensurePolling() {
    if (timer != null || owners.size === 0) return;
    timer = setIntervalFn(tick, pollIntervalMs);
  }

  function add(raw) {
    const pid = parseOwnerPid(raw);
    if (pid == null) return false;
    owners.add(pid);
    everOwned = true;
    ensurePolling();
    return true;
  }

  return {
    add,
    tick,
    stopPolling,
    size() { return owners.size; },
    hasOwned() { return everOwned; },
    list() { return [...owners]; },
  };
}

module.exports = { parseOwnerPid, isProcessAlive, createOwnerRegistry };
