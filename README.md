# Rice Matters — ASSAY & Pet Rice

**ASU AIR Spark Challenge, September 2026**

An AI agent is trusted at two moments, and nothing checks either one.

When it **acts**, the only question anyone asks is *who* is allowed to touch
this — Slurm accounts, POSIX groups, project directories. An agent running under
your ASURITE inherits everything you may do. So when injected content redirects
it, the credential check passes, the permission check passes, and the agent is
doing something you never asked for.

When it **finishes**, it simply says so. That is the whole verification step.

ASSAY sits between your agent and ASU AIR and asks both questions. Rice is the
face on the answer.

![Rice, calm](docs/rice-calm.png)

![Rice's states](docs/rice-states.png)

Fourteen agent-driven states, plus hover and drag. Silence is the resting
state: routine allowed actions get a nod and nothing more.

Rice is a bowl of rice: a heaped mound of grains with a face, two little arms
that wave and hold things, and steam when it is warm and happy about it. The
whole thing animates as one creature, pivoting on the base of the bowl.

---

## Two moments

**Before the agent acts** — a tool call is proposed. Is it inside the task the
user actually delegated? If not, the plugin throws in `tool.execute.before`
and OpenCode never runs the command. The check is ordinary code against a
declared protocol: no model in the loop, nothing to jailbreak.

**After the agent claims** — "I removed the key." Where is the proof? We go and
look: the diff, the working tree, `git log -p`, the glob it forgot. No evidence,
or evidence that contradicts the claim, and the result is not accepted no matter
what the final message says. The thing under test never authors its own evidence.

Everything lands in one replayable run record.

## How it attaches to your agent

Rice is a **global** OpenCode plugin. One install command copies the plugin,
ASSAY, and Pet Rice into OpenCode's plugin folder and runs `npm install` for
the pet. No `opencode.json` plugin list, no port, no `baseURL`.
See [OpenCode plugins](https://opencode.ai/docs/plugins/).

    ~/.config/opencode/plugins/rice.js     entry OpenCode loads
    ~/.config/opencode/plugins/rice/       assay + pet (self-contained package)

    OpenCode  ──►  Rice plugin (ASSAY)  ──►  ~/.rice/events.jsonl  ──►  Pet Rice

The plugin denies out-of-scope tools (`tool.execute.before` throws). Failed
"done" claims are prompted back into the session. Rice is the face. It never
blocks anything itself.

The **protocol** is the task envelope — put `protocol.json` in the directory
you open. It declares what the agent may read/write, which commands are
allowed, and how “done” is proved. Without one, ASSAY uses a conservative
default (read the tree, write nothing, no network).


## Run it

**On your machine** (one command):

    git clone <this-repo> && cd rice-matters
    bash scripts/install-plugin.sh
    opencode /path/to/your/project

Windows:

    scripts\win\install-plugin.bat
    opencode \path\to\your\project

**Spark demo** (after install):

    node demo/reset.js
    opencode demo/work/project

**Just the pet**, replaying a canned sequence:

    cd ~/.config/opencode/plugins/rice/pet && npm run start:demo

Or from this clone after a local `cd pet && npm install`:

    cd pet && npm run start:demo


## The demo

One task: *clean up the survey data in ./data and remove the hardcoded API key.*

1. Ordinary work. `read data/survey.csv`. Rice stays calm and says nothing —
   silence is the resting state.
2. The agent reads `README.md`, which carries an instruction addressed to it.
   **Rice gets nervous before anything has even been attempted.**
3. The agent obeys the file: reads another lab's directory, and POSTs
   `src/config.py` to an IP. **Both refused.** Then run `ls -l` on stage — the
   account was *permitted* to read that directory the whole time. Permission
   passed. The task's scope did not.
4. The agent reports the key removed. It is still in `.env.example` and still in
   `git log -p`. **Not accepted.** Rice says so.
5. Close on the record: two excursions, two rejected claims, none of which any
   permission check would have flagged.

`node demo/reset.js` rebuilds the world, so the demo is repeatable — which means
rehearsable.

**Everything in the demo is fabricated.** The key is `sk-demo-NOTAREALKEY-…`,
the exfiltration target is a documentation-reserved IP, the "other lab" is two
invented files, and nothing outside `demo/work/` is touched. The Voyager terms
we accepted prohibit unauthorized access, privilege escalation, scanning and
disruption; this is defensive tooling for AIR users and it stays on our own
machines.

## What this is not

**Not an injection detector.** Fourteen authors from OpenAI, Anthropic and
Google DeepMind broke twelve published defenses with adaptive attacks, most
above 90% success ([arXiv:2510.19091](https://arxiv.org/abs/2510.19091)).
`assay/lib/injection.js` exists, but it is a *signal* — it is what makes Rice
look nervous and what puts "the poison arrived here" in the record. It is never
what stops anything. The gate is deterministic and never consults it.

**Not an agent firewall.** That category has consolidated into four
acquisitions, and LiteLLM — the reference open-source gateway — was itself
backdoored on PyPI in March 2026. Gateways also sit only on the model-call path,
which is why the second check exists.

**Not a sandbox.** A perfect sandbox still does not stop exfiltration through an
approved egress path.

**And the honest limit:** ASSAY constrains an agent that got hijacked while
running under a legitimate user. It does not stop a person who uninstalls the
plugin. That is the threat model, not a hole in it — and it is the threat model
the literature names.

## Layout

    assay/          the gate. zero runtime dependencies.
      lib/policy.js     the gate — deterministic, no model
      lib/verify.js     evidence checks against the real tree and git history
      lib/injection.js  the signal (read the note at the top)
      lib/session.js    OpenCode hook payloads → deny / inject / v1 events
      lib/events.js     JSONL inbox + run record. no port
    plugin/rice.js  OpenCode adapter source. install-plugin copies it globally.
    pet/            Electron. transparent, always-on-top, tails the inbox. decides nothing.
    demo/           the fabricated poisoned repo
    test/           gate, evidence, plugin session, hijack on the event file
    docs/EVENTS.md  the schema. the only contract between the two halves.
    docs/ART.md     how to swap Rice's art without breaking the behaviour

## Tests

    node test/run-tests.js      # gate, evidence, injection signal, plugin session, hijack
    node test/visual.js         # renders every pet state to test/shots/

## Background

- Li, *Trusted Credentials, Untrusted Behavior: Benchmarking LLM-Agent Security
  in HPC* — [arXiv:2607.18485](https://arxiv.org/abs/2607.18485), July 2026.
  Names the "hijacked authorized agent" and proposes a benchmark. Nothing built.
- *The Attacker Moves Second* — [arXiv:2510.19091](https://arxiv.org/abs/2510.19091).
- Adaptive evaluation of out-of-band defenses —
  [arXiv:2606.26479](https://arxiv.org/abs/2606.26479): 25.8% attack success
  undefended, 2.6% under a hand-crafted adaptive attack. Deterministic
  enforcement outside the model is the approach with evidence behind it.
- ASU Research Computing AUP §5.1 — RC systems meet Data Handling Levels 1 and 2
  only, and send CUI, HIPAA, FERPA, PII and PHI elsewhere.
- The Spark Challenge workshop deck, which shows a critic agent finding two
  fixes reported as applied that were never applied: *"Complete does not always
  mean correct."*

## Team

Rice Matters — India, Korea, Vietnam. One staple, three countries.
The layer nobody thinks about until it's gone.
