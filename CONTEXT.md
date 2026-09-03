# Domain

**ASSAY** — deterministic gate and evidence checks. No model in the loop.

**Rice plugin** — OpenCode adapter. Source is `plugin/rice.js` in this clone. The load path for people is only `~/.config/opencode/plugins`.

**Global bind** — copy the plugin source to `~/.config/opencode/plugins` with `RICE_ROOT` pointing at this clone. That is how OpenCode finds Rice on a real project.

**Protocol** — task envelope in the opened directory (`protocol.json`). Missing file means the conservative default, not the Spark demo envelope.

**Demo world** — fabricated poisoned tree under `demo/work/`. It carries `protocol.json`. It does not carry the plugin.
