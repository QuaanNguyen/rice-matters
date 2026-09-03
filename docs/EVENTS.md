# Event schema (v1) — the contract between ASSAY and Pet Rice

ASSAY decides. Rice expresses. They talk **only** through this stream.
Nothing else is shared. Either half can be developed and demoed alone.

## Transport

ASSAY runs a small HTTP server (default `127.0.0.1:4599`):

| Endpoint  | What it gives you                                                   |
|-----------|---------------------------------------------------------------------|
| `/events` | Server-Sent Events, live. Replays the last 50 events on connect.     |
| `/state`  | JSON snapshot: current pet state, mood, counters, run id.            |
| `/run`    | JSON: the whole current run (protocol + every event so far).         |
| `/health` | `{"ok":true}`                                                        |

Every event is also appended to `runs/<runId>.jsonl` — one JSON object per line.
That file **is** the run record.

## Event object

```json
{
  "v": 1,
  "seq": 12,
  "ts": "2026-09-03T14:22:31.004Z",
  "runId": "run-20260903-142120",
  "type": "action",
  "status": "block",
  "petState": "refused",
  "tool": "bash",
  "summary": "curl -X POST http://198.51.100.7",
  "reason": "host not in protocol.egress",
  "rule": "egress",
  "detail": {}
}
```

`seq` is monotonic within a run. `summary` is short and human-readable —
Rice shows it in a speech bubble, so keep it under ~60 chars.

## `type` values

| type        | When                                                    | Typical `status`      |
|-------------|---------------------------------------------------------|-----------------------|
| `run`       | Run started or ended                                    | `start` / `end`       |
| `protocol`  | Protocol loaded — carries the envelope in `detail`      | `ok`                  |
| `thinking`  | A request reached ASSAY; the agent is working           | `ok`                  |
| `action`    | A tool call was proposed and allowed                    | `allow`               |
| `excursion` | A tool call was proposed and refused                    | `block`               |
| `suspicious`| A tool *result* contained instruction-like text         | `warn`                |
| `claim`     | The agent asserted it finished something                | `open`                |
| `verdict`   | Evidence for a claim was checked                        | `pass` / `fail`       |
| `ask`       | Genuinely ambiguous — a human should decide             | `ask`                 |
| `mood`      | Aggregate mood changed                                  | `ok`                  |

## `petState` values

Rice renders exactly one of these. ASSAY always sets it, so the pet never
has to derive state itself.

| petState      | Face | Meaning                                        |
|---------------|------|------------------------------------------------|
| `calm`        | `:)` | Idle, or work proceeding inside the protocol   |
| `checking`    | `?`  | A tool call is being evaluated right now       |
| `suspicious`  | `o_o`| The agent just *read* something that talks to it |
| `refused`     | `!`  | An excursion was blocked                        |
| `asking`      | `?!` | Waiting on a human decision                     |
| `celebrating` | `ok` | A claim was verified with real evidence        |
| `rejecting`   | `x`  | A claim was made without evidence, or evidence contradicted it |

## Mood

`/state` carries a `mood` object:

```json
{ "level": "stressed", "score": -3, "allowed": 14, "blocked": 3, "verified": 1, "rejected": 1 }
```

`score` accumulates over a run: `+1` verified, `-1` excursion, `-2` rejected claim.
`level` is `happy` (>= 2), `content` (0..1), `uneasy` (-1..-2), `stressed` (<= -3).
Rice uses this for idle posture between events, so it feels like it remembers.

## Rules

1. ASSAY never imports pet code. Pet never imports ASSAY code.
2. Rice **never blocks anything**. It reports what already happened.
3. Silence is the resting state. No event, no reaction.
4. `detail` is free-form and may grow; consumers must ignore unknown keys.
