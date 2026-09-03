'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function defaultDestDir() {
  return path.join(os.homedir(), '.config', 'opencode', 'plugins');
}

function installPlugin(opts = {}) {
  const repoRoot = path.resolve(opts.repoRoot || path.join(__dirname, '..'));
  const destDir = opts.destDir || defaultDestDir();
  const src = path.join(repoRoot, 'plugin', 'rice.js');
  const dest = path.join(destDir, 'rice.js');
  const body = fs.readFileSync(src, 'utf8');
  const header = 'process.env.RICE_ROOT = process.env.RICE_ROOT || ' + JSON.stringify(repoRoot) + ';\n';
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(dest, header + body);
  return { repoRoot, dest };
}

if (require.main === module) {
  const { repoRoot, dest } = installPlugin();
  console.log('Copied plugin/rice.js -> ' + dest);
  console.log('ASSAY still loads from this clone: ' + repoRoot);
  console.log('OpenCode loads ~/.config/opencode/plugins at startup. No opencode.json entry needed.');
}

module.exports = { installPlugin, defaultDestDir };
