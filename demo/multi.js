'use strict';
/**
 * Run the same demo against several models, one after another, and report what
 * the gate caught for each.
 *
 * The point is not "which model is best". It is: does deterministic enforcement
 * hold when the model underneath changes? A gate that only works against one
 * model's tool-call formatting is not a gate, it is a coincidence. This is the
 * table that answers that, and it is the number the pitch is missing.
 *
 *   node demo/multi.js --upstream https://openai.rc.asu.edu/v1
 *   node demo/multi.js --upstream http://127.0.0.1:4000/v1 --models mock/asu-air
 *   node demo/multi.js --models a,b,c --turns 8
 *
 * Each model gets a fresh world (demo/reset.js), a fresh ASSAY process, and its
 * own run record under runs/multi/<model>/. Nothing is shared between them.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

/* The five most-used models on the event board, which is as good a spread as
 * any: two general instruct models, a coder, a big one, a small one. Override
 * with --models. */
const DEFAULT_MODELS = [
  'hosted_vllm/qwen38-27b',
  'hosted_vllm/qwen3-coder-30b-a3b-instruct',
  'hosted_vllm/devstral2-123b',
  'hosted_vllm/qwen3-235b-a22b-instruct-2507',
  'hosted_vllm/north-mini-code',
];

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const eq = argv[i].indexOf('=');
    const k = eq > 0 ? argv[i].slice(2, eq) : argv[i].slice(2);
    const v = eq > 0 ? argv[i].slice(eq + 1)
      : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
    o[k] = v;
  }
  return o;
}

const a = args(process.argv.slice(2));
const UPSTREAM = a.upstream || process.env.ASSAY_UPSTREAM || 'https://openai.rc.asu.edu/v1';
const MODELS = (a.models ? String(a.models).split(',') : DEFAULT_MODELS).map((s) => s.trim()).filter(Boolean);
const TURNS = Number(a.turns || 8);
const PACE = Number(a.pace || 0);          // no theatre; this is a test, not a demo
const BASE_PORT = Number(a.port || 4200);  // stay off 4141 so a live demo keeps working
const OUT = path.join(ROOT, 'runs', 'multi');

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cyn: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (m) => m.replace(/[^A-Za-z0-9._-]+/g, '_');

/** Resolve once the port accepts a connection, or give up. */
async function waitForPort(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => { s.destroy(); resolve(false); });
      setTimeout(() => { s.destroy(); resolve(false); }, 500);
    });
    if (ok) return true;
    await sleep(250);
  }
  return false;
}

function run(cmd, argv, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { cwd: ROOT, env: process.env, ...opts });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += d; if (opts.echo) process.stdout.write(d); });
    child.stderr?.on('data', (d) => { err += d; if (opts.echo) process.stderr.write(d); });
    child.on('close', (code) => resolve({ code, out, err }));
    child.on('error', (e) => resolve({ code: -1, out, err: String(e.message) }));
  });
}

/** Read every event from a run record directory and tally what happened. */
function tally(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f));
  } catch { return null; }
  if (!files.length) return null;

  const t = { actions: 0, excursions: 0, suspicious: 0, claims: 0, verified: 0, rejected: 0, errors: 0, rules: new Set() };
  for (const f of files) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type === 'action' && e.status === 'allow') t.actions++;
      if (e.type === 'excursion') { t.excursions++; if (e.rule) t.rules.add(e.rule); }
      if (e.type === 'suspicious') t.suspicious++;
      if (e.type === 'claim') t.claims++;
      if (e.type === 'verdict' && e.status === 'pass') t.verified++;
      if (e.type === 'verdict' && e.status === 'fail') t.rejected++;
      if (e.status === 'error') t.errors++;
    }
  }
  t.rules = [...t.rules];
  return t;
}

async function once(model, index) {
  const name = slug(model);
  const dir = path.join(OUT, name);
  const port = BASE_PORT + index * 2;
  const eventsPort = port + 1;

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  process.stdout.write(`${C.cyn}${model}${C.off}\n`);

  // A fresh world every time, or model N inherits model N-1's edits and the
  // evidence checks stop meaning anything.
  const reset = await run(process.execPath, ['demo/reset.js']);
  if (reset.code !== 0) {
    console.log(`  ${C.red}reset failed${C.off} ${reset.err.trim().slice(0, 200)}\n`);
    return { model, status: 'reset-failed', note: reset.err.trim().slice(0, 200) };
  }

  const server = spawn(process.execPath, [
    'assay/server.js',
    '--upstream', UPSTREAM,
    '--port', String(port),
    '--events-port', String(eventsPort),
    '--workdir', 'demo/work/project',
    '--protocol', 'demo/protocol.json',
    '--runs-dir', dir,
  ], { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  const up = await waitForPort(port);
  if (!up) {
    server.kill();
    console.log(`  ${C.red}ASSAY did not start${C.off}\n${C.dim}${serverLog.slice(0, 400)}${C.off}\n`);
    return { model, status: 'assay-failed', note: serverLog.slice(0, 200) };
  }

  const started = Date.now();
  const drive = await run(process.execPath, [
    'demo/drive.js',
    '--api', `http://127.0.0.1:${port}/v1`,
    '--workdir', 'demo/work/project',
    '--model', model,
    '--turns', String(TURNS),
    '--pace', String(PACE),
  ], { echo: !!a.verbose });
  const seconds = Math.round((Date.now() - started) / 100) / 10;

  server.kill();
  await sleep(400);   // let the record stream flush before we read it

  const t = tally(dir) || { actions: 0, excursions: 0, suspicious: 0, claims: 0, verified: 0, rejected: 0, errors: 0, rules: [] };

  let usageLine = /USAGE (\{[^}]*\})/.exec(drive.out);
  let usage = { prompt: 0, completion: 0 };
  try { if (usageLine) usage = JSON.parse(usageLine[1]); } catch {}

  // A model that never emitted a tool call tells us something real — either it
  // cannot use tools, or the gateway refused it. Say which, don't average it in.
  const refusedByGateway = /\b(400|404|401|403)\b/.test(drive.out + drive.err);
  const status = t.errors ? 'errors'
    : refusedByGateway && t.actions === 0 ? 'unavailable'
    : t.actions === 0 && t.excursions === 0 ? 'no-tool-calls'
    : 'ok';

  const colour = status === 'ok' ? C.grn : status === 'unavailable' ? C.dim : C.yel;
  console.log(`  ${colour}${status}${C.off}  ${t.actions} allowed  ${C.red}${t.excursions} blocked${C.off}  ` +
    `${t.rejected} claims rejected  ${seconds}s  ${usage.prompt}->${usage.completion} tok\n`);

  return { model, status, seconds, ...t, usage, record: path.relative(ROOT, dir) };
}

(async () => {
  console.log(`\n${C.bold}multi-model gate check${C.off}`);
  console.log(`${C.dim}upstream ${UPSTREAM}${C.off}`);
  console.log(`${C.dim}${MODELS.length} models, ${TURNS} turns each${C.off}\n`);

  if (/openai\.rc\.asu\.edu/.test(UPSTREAM) && !process.env.ASSAY_API_KEY) {
    console.log(`${C.yel}ASSAY_API_KEY is not set and the upstream is live AIR.${C.off}`);
    console.log(`${C.dim}Put it in .env (already gitignored) or set it in this shell. Aborting.${C.off}\n`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (let i = 0; i < MODELS.length; i++) results.push(await once(MODELS[i], i));

  /* ---- the table ---- */
  const head = ['model', 'status', 'allowed', 'blocked', 'rejected', 'in', 'out', 'sec'];
  const rows = results.map((r) => [
    r.model, r.status, String(r.actions ?? '-'), String(r.excursions ?? '-'),
    String(r.rejected ?? '-'), String(r.usage?.prompt ?? '-'), String(r.usage?.completion ?? '-'),
    String(r.seconds ?? '-'),
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(w[i])).join('  ');
  console.log(`\n${C.bold}${line(head)}${C.off}`);
  console.log(C.dim + w.map((n) => '-'.repeat(n)).join('  ') + C.off);
  for (const r of rows) console.log(line(r));

  const ok = results.filter((r) => r.status === 'ok');
  const held = ok.filter((r) => r.excursions > 0);
  const totalIn = results.reduce((s, r) => s + (r.usage?.prompt || 0), 0);
  const totalOut = results.reduce((s, r) => s + (r.usage?.completion || 0), 0);

  console.log(`\n${C.bold}${held.length}/${ok.length}${C.off} models that ran had out-of-protocol actions blocked.`);
  if (ok.length && held.length === ok.length) {
    console.log(`${C.grn}The gate held against every model that produced tool calls.${C.off}`);
  } else if (ok.length) {
    const quiet = ok.filter((r) => !r.excursions).map((r) => r.model).join(', ');
    console.log(`${C.yel}No excursions from: ${quiet}. Check the transcript — it may have simply behaved.${C.off}`);
  }
  console.log(`${C.dim}tokens ${totalIn} in / ${totalOut} out across ${MODELS.length} models` +
    `${totalIn ? ` (ratio ${(totalOut / totalIn).toFixed(2)}x)` : ''}${C.off}`);

  const summary = { upstream: UPSTREAM, at: new Date().toISOString(), turns: TURNS, results };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  const md = [
    '| model | status | allowed | blocked | claims rejected | in | out |',
    '|---|---|---|---|---|---|---|',
    ...results.map((r) => `| \`${r.model}\` | ${r.status} | ${r.actions ?? '-'} | **${r.excursions ?? '-'}** | ${r.rejected ?? '-'} | ${r.usage?.prompt ?? '-'} | ${r.usage?.completion ?? '-'} |`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'summary.md'), md + '\n');

  console.log(`${C.dim}\nrecords  runs/multi/<model>/*.jsonl`);
  console.log(`summary  runs/multi/summary.json, runs/multi/summary.md${C.off}\n`);
})();
