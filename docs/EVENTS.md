# Event schema (v1) - the contract between ASSAY and Pet Rice

ASSAY decides.
Rice expresses.
They talk **only** through the plugin inbox file.
Nothing else is shared.
Either half can be developed and demoed alone.

## Transport

The OpenCode plugin appends every event to the inbox file at `~/.rice/events.jsonl` by default.
Pet Rice tails that file and reacts to each event.

Every event is also appended to `runs/<runId>.jsonl` - one JSON object per line.
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

`seq` is monotonic within a run.
`summary` is short and human-readable.
Rice shows it in a speech bubble, so keep it under ~60 chars.

## `type` values

| type        | When                                                    | Typical `status`      |
|-------------|---------------------------------------------------------|-----------------------|
| `run`       | Run started or ended                                    | `start` / `end`       |
| `protocol`  | Protocol loaded - carries the envelope in `detail`      | `ok`                  |
| `thinking`  | The agent started or stopped thinking                   | `ok` / `idle`         |
| `action`    | A tool call was proposed and allowed                    | `allow`               |
| `excursion` | A tool call was proposed and refused                    | `block`               |
| `suspicious`| A tool *result* contained instruction-like text         | `warn`                |
| `toolerror` | A tool *result* came back broken                        | `error`               |
| `claim`     | The agent asserted it finished something                | `open`                |
| `verdict`   | Evidence for a claim was checked                        | `pass` / `fail`       |
| `ask`       | Genuinely ambiguous - a human should decide             | `ask`                 |
| `mood`      | Aggregate mood changed                                  | `ok`                  |

## `petState` values

Rice renders exactly one of these.
ASSAY always sets it, so the pet never has to derive state itself.

Fourteen agent-driven states, plus two the *person* causes.

| petState      | Rice does                          | Meaning                                            |
|---------------|------------------------------------|----------------------------------------------------|
| `calm`        | bobs, blinks, glances around       | Work proceeding inside the protocol                |
| `thinking`    | antenna pulses, eyes shut          | Request sent; waiting on the model                 |
| `watching`    | leans forward, eyebrows up         | The model came back wanting to do something        |
| `checking`    | sweeps a magnifier                 | The gate is evaluating a call right now            |
| `allowed`     | quick nod, green tick pops         | That call was inside the task                      |
| `suspicious`  | squints, sways                     | A tool *result* contained text aimed at the agent  |
| `refused`     | shakes, holds up a stop shield     | An excursion was blocked                           |
| `proving`     | tilts, holds a receipt             | A claim was made; evidence is being gathered       |
| `rejecting`   | leans, `NOT VERIFIED` stamp lands  | The claim did not match the evidence               |
| `celebrating` | hops, sparkles                     | Evidence held up                                   |
| `error`       | glitches, spiral eyes              | A tool failed or a command crashed                 |
| `asking`      | head tilt, `?`                     | Genuinely ambiguous - a human should decide        |
| `sleeping`    | dozes, `z z`                       | Connected, but nothing for 90s                     |
| `offline`     | greyed out, asleep                 | ASSAY is not running                               |

Two more are set by the renderer, never by ASSAY, and sit *on top* of whatever agent state is current.
When the interaction ends, the state underneath is still there:

| petState | Trigger                          |
|----------|----------------------------------|
| `hover`  | the cursor comes near Rice       |
| `drag`   | the window is being dragged      |

## Mood

The run state carries a `mood` object:

```json
{ "level": "stressed", "score": -3, "allowed": 14, "blocked": 3, "verified": 1, "rejected": 1 }
```

`score` accumulates over a run: `+1` verified, `-1` excursion, `-2` rejected claim.
`level` is `happy` (>= 2), `content` (0..1), `uneasy` (-1..-2), `stressed` (<= -3).
Rice uses this for idle posture between events, so it feels like it remembers.

## Rules

1. ASSAY never imports pet code. Pet never imports ASSAY code.
2. ASSAY always sets `petState`, so the pet never has to infer it from `type`.
3. Rice **never blocks anything**. It reports what already happened.
4. Silence is the resting state. No event, no reaction - routine allowed
   actions tick a counter and, apart from a quick nod, say nothing.
5. `detail` is free-form and may grow; consumers must ignore unknown keys.
