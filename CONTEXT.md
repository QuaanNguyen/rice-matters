# Domain

**ASSAY** — deterministic gate and evidence checks. No model in the loop.

**Rice plugin** — OpenCode adapter. Source is `plugin/rice.js` in this clone.

**Rice package** — what install materializes under `~/.config/opencode/plugins/`:
entry `rice.js` plus folder `rice/` (assay + pet). Self-contained; moving this
clone after install does not break a completed install.

**Global bind** — one command (`scripts/install-plugin`) copies the package and
runs `npm install` for the pet. OpenCode loads the entry from the global plugins
directory.

**Protocol** — task envelope in the opened directory (`protocol.json`): allowed
reads/writes, commands, egress, and done criteria. Missing file means the
conservative default, not the Spark demo envelope.

**Demo world** — fabricated poisoned tree under `demo/work/`. Built by
`demo/reset.js`. Carries `protocol.json`. Does not carry the plugin.
