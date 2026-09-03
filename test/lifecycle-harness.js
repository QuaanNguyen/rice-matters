'use strict';
/**
 * Process harness for Rice ownership / single-instance behaviour.
 * Spawns real Electron (no OpenCode). Usage: node test/lifecycle-harness.js
 */
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PET = path.join(ROOT, 'pet');
const electron = require(path.join(PET, 'node_modules/electron'));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

function killStale() {
  try {
    spawn('pkill', ['-f', 'rice-matters/pet/node_modules/electron'], { stdio: 'ignore' });
  } catch { }
}

function spawnOwner() {
  const owner = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
    detached: true,
  });
  owner.unref();
  const inbox = path.join(os.tmpdir(), `rice-harness-${owner.pid}.jsonl`);
  const env = {
    ...process.env,
    RICE_OWNER_PID: String(owner.pid),
    RICE_EVENTS: inbox,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  const rice = spawn(electron, ['.'], {
    cwd: PET,
    env,
    stdio: 'ignore',
    detached: true,
  });
  rice.unref();
  return { owner, rice };
}

(async () => {
  console.log('lifecycle harness');
  killStale();
  await sleep(800);

  const first = spawnOwner();
  await sleep(3000);
  assert.ok(alive(first.rice.pid), 'primary Rice should be running');
  assert.ok(alive(first.owner.pid), 'owner should be running');

  const second = spawnOwner();
  await sleep(2500);
  assert.ok(!alive(second.rice.pid), 'secondary Rice must exit without a window');
  assert.ok(alive(first.rice.pid), 'primary Rice must keep running');

  process.kill(second.owner.pid, 'SIGTERM');
  process.kill(first.owner.pid, 'SIGTERM');
  await sleep(4000);
  assert.ok(!alive(first.rice.pid), 'Rice must quit after every owner dies');

  console.log('  ok  single-instance + owner death');
  console.log('done');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
