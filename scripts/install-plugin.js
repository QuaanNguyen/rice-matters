'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function defaultPluginsDir() {
  return path.join(os.homedir(), '.config', 'opencode', 'plugins');
}

function installEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  return env;
}

function copyTree(src, dest, { skip } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip && skip.has(name)) continue;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyTree(from, to, { skip });
    else fs.copyFileSync(from, to);
  }
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: installEnv(),
    shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd),
  });
  if (result.status !== 0) {
    throw new Error(cmd + ' ' + args.join(' ') + ' failed in ' + cwd + ' (exit ' + result.status + ')');
  }
}

function electronReady(petDir) {
  const marker = path.join(petDir, 'node_modules', 'electron', 'path.txt');
  if (!fs.existsSync(marker)) return false;
  try {
    const bin = require(path.join(petDir, 'node_modules', 'electron'));
    return typeof bin === 'string' && fs.existsSync(bin);
  } catch {
    return false;
  }
}

function ensureElectron(petDir, repoRoot) {
  const electronDir = path.join(petDir, 'node_modules', 'electron');
  if (!fs.existsSync(electronDir)) {
    throw new Error('electron package missing under ' + petDir);
  }
  if (electronReady(petDir)) return;

  console.log('Downloading Electron binary…');
  try {
    run(process.execPath, [path.join(electronDir, 'install.js')], petDir);
  } catch (err) {
    console.warn(String(err.message || err));
  }
  if (electronReady(petDir)) return;

  const donor = path.join(repoRoot, 'pet', 'node_modules', 'electron');
  if (electronReady(path.join(repoRoot, 'pet'))) {
    console.log('Copying Electron binary from this clone’s pet install…');
    fs.rmSync(electronDir, { recursive: true, force: true });
    copyTree(donor, electronDir);
  }
  if (!electronReady(petDir)) {
    throw new Error(
      'Electron binary did not install. From the rice-matters clone run: cd pet && npm install\n' +
      'Then re-run scripts/install-plugin.',
    );
  }
}

function installPlugin(opts = {}) {
  const repoRoot = path.resolve(opts.repoRoot || path.join(__dirname, '..'));
  const pluginsDir = opts.destDir || defaultPluginsDir();
  const packageDir = path.join(pluginsDir, 'rice');
  const entry = path.join(pluginsDir, 'rice.js');
  const skipNpm = opts.skipNpm === true;

  const srcPlugin = path.join(repoRoot, 'plugin', 'rice.js');
  const srcAssay = path.join(repoRoot, 'assay');
  const srcPet = path.join(repoRoot, 'pet');

  if (!fs.existsSync(srcPlugin)) throw new Error('missing ' + srcPlugin);
  if (!fs.existsSync(path.join(srcAssay, 'lib', 'session.js'))) {
    throw new Error('missing assay/lib/session.js under ' + srcAssay);
  }
  if (!fs.existsSync(path.join(srcPet, 'package.json'))) {
    throw new Error('missing pet/package.json under ' + srcPet);
  }

  fs.mkdirSync(pluginsDir, { recursive: true });
  fs.rmSync(packageDir, { recursive: true, force: true });
  fs.mkdirSync(packageDir, { recursive: true });

  fs.copyFileSync(srcPlugin, entry);
  copyTree(srcAssay, path.join(packageDir, 'assay'));
  copyTree(srcPet, path.join(packageDir, 'pet'), {
    skip: new Set(['node_modules']),
  });

  const petDir = path.join(packageDir, 'pet');
  if (!skipNpm) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    console.log('Installing pet dependencies (includes Electron)…');
    run(npm, ['install'], petDir);
    ensureElectron(petDir, repoRoot);
  }

  return {
    repoRoot,
    pluginsDir,
    packageDir,
    dest: entry,
    petDir,
  };
}

if (require.main === module) {
  console.log('Installing Rice into OpenCode global plugins…');
  const { dest, packageDir, petDir } = installPlugin();
  console.log('Plugin entry:  ' + dest);
  console.log('Package:       ' + packageDir + '  (assay + pet)');
  console.log('Pet deps:      ' + petDir + '/node_modules');
  console.log('OpenCode loads ~/.config/opencode/plugins/*.js at startup.');
  console.log('Done. Open any project with: opencode <path>');
}

module.exports = { installPlugin, defaultPluginsDir, electronReady };
