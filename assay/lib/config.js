'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  upstream: 'https://openai.rc.asu.edu/v1',
  port: 4141,
  eventsPort: 4599,
  host: '127.0.0.1',
  workdir: process.cwd(),
  protocol: null,
  apiKey: null,
  verbose: true,
};

/**
 * Read a .env beside the repo if there is one. Teammates keep hitting this:
 * the key lives in .env (already gitignored), and nothing was reading it.
 * Real environment variables always win over the file.
 */
function loadDotEnv(dir) {
  const file = path.join(dir, '.env');
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return {}; }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;                                    // blank, or a comment
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { throw new Error(`could not read ${p}: ${e.message}`); }
}

function fromArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    const key = (eq > 0 ? a.slice(2, eq) : a.slice(2)).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const val = eq > 0 ? a.slice(eq + 1) : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
    out[key] = val === 'true' ? true : val === 'false' ? false : val;
  }
  return out;
}

function load(argv = process.argv.slice(2)) {
  const args = fromArgs(argv);
  const cfg = { ...DEFAULTS };

  const configFile = args.config || process.env.ASSAY_CONFIG;
  if (configFile) Object.assign(cfg, loadJson(path.resolve(configFile)));

  // .env, then real environment variables, then command-line flags — each
  // layer overrides the one before it.
  const dotenv = { ...loadDotEnv(process.cwd()), ...loadDotEnv(path.resolve(__dirname, '..', '..')) };
  for (const [k, v] of Object.entries(dotenv)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  if (process.env.ASSAY_UPSTREAM) cfg.upstream = process.env.ASSAY_UPSTREAM;
  if (process.env.ASSAY_API_KEY) cfg.apiKey = process.env.ASSAY_API_KEY;
  if (process.env.ASSAY_PORT) cfg.port = Number(process.env.ASSAY_PORT);
  if (process.env.ASSAY_EVENTS_PORT) cfg.eventsPort = Number(process.env.ASSAY_EVENTS_PORT);
  if (process.env.ASSAY_WORKDIR) cfg.workdir = process.env.ASSAY_WORKDIR;
  if (process.env.ASSAY_PROTOCOL) cfg.protocol = process.env.ASSAY_PROTOCOL;

  Object.assign(cfg, args);
  if (cfg.port) cfg.port = Number(cfg.port);
  if (cfg.eventsPort) cfg.eventsPort = Number(cfg.eventsPort);
  cfg.upstream = String(cfg.upstream).replace(/\/+$/, '');
  cfg.workdir = path.resolve(String(cfg.workdir));
  if (cfg.protocol) cfg.protocol = path.resolve(String(cfg.protocol));
  cfg.runsDir = cfg.runsDir ? path.resolve(String(cfg.runsDir)) : path.join(process.cwd(), 'runs');

  return cfg;
}

module.exports = { load, loadJson, loadDotEnv, DEFAULTS };
