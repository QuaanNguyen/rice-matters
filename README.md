# Rice Matters

Rice is a small desktop companion for OpenCode.
It watches what your AI agent is doing, blocks actions that fall outside the task, and checks whether important finish claims are actually true.

![Rice, calm](docs/rice-calm.png)

## What It Does

Rice has two parts:

- ASSAY checks agent tool calls before they run.
- Pet Rice shows what is happening on screen.

When an action is allowed, Rice stays quiet.
When something looks suspicious, blocked, failed, or unverified, Rice changes state and writes it to a replayable run record.

![Rice's states](docs/rice-states.png)

## Requirements

- Node.js and npm.
- OpenCode.
- Git.

## Install

### macOS / Linux

```sh
node scripts/install-plugin.js
```

Or:

```sh
bash scripts/install-plugin.sh
```

Then open any project with OpenCode:

```sh
opencode <path>
```

### Windows

From Command Prompt:

```bat
scripts\win\install-plugin.bat
```

Or:

```bat
node scripts\install-plugin.js
```

Then open any project with OpenCode:

```bat
opencode <path>
```

## Run the Pet by Itself

Use this when you want to see Rice without running OpenCode.

### macOS / Linux

```sh
cd pet
npm install
npm run start:demo
```

### Windows

```bat
cd pet
npm install
npm run start:demo
```

## Work on the Pet UI

### macOS / Linux

```sh
cd pet
npm install
npm run start:dev
```

### Windows

```bat
cd pet
npm install
npm run start:dev
```

## Controls

| Action | What it does |
|---|---|
| `Ctrl+Alt+R` | Show or hide Rice |
| `Ctrl+Alt+=` | Make Rice bigger |
| `Ctrl+Alt+-` | Make Rice smaller |
| `Ctrl+Alt+0` | Reset Rice to normal size |
| `Ctrl` + scroll over Rice | Resize Rice |
| Drag Rice | Move Rice |
| `log` | Show the live run record |
| `×` | Hide Rice |

Rice remembers its size and position between runs.
If another app already uses `Ctrl+Alt+R`, start Rice with another shortcut:

```sh
npm run start -- --shortcut="Ctrl+Alt+K"
```

## Demo

Reset the demo workspace:

```sh
node demo/reset.js
```

Run the pet demo:

```sh
cd pet
npm run start:demo
```

The demo uses fake data, a fake API key, and a documentation-only network address.
It does not touch anything outside `demo/work/`.

## Files

```text
assay/          ASSAY checks and run records
plugin/         OpenCode plugin entry point
pet/            Electron desktop pet
demo/           Local fake demo workspace
docs/           Event schema and art notes
scripts/        macOS, Linux, and Windows installers
test/           Automated and visual tests
```

## Logs

The live event inbox defaults to:

```text
~/.rice/events.jsonl
```

Replayable run records default to:

```text
~/.rice/runs/
```

You can override them with `RICE_EVENTS` and `RICE_RUNS`.

## Tests

```sh
node test/run-tests.js
```

This checks the gate, evidence checks, injection signal, sizing logic, tool failure detection, and plugin lifecycle behavior.

```sh
node test/visual.js
```

This renders the pet states to `test/shots/`.
It skips if Playwright is not installed.

## Team

Rice Matters - India, Korea, Vietnam.
One staple, three countries.
