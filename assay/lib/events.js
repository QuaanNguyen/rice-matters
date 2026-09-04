'use strict';
/**
 * Event bus + plugin inbox + run-record writer.
 * Zero dependencies. This is the only thing Pet Rice talks to.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SCHEMA_VERSION = 1;

/**
 * The OpenCode plugin runs inside the harness, so it appends events here and
 * Pet Rice tails the file.
 */
/**
 * Follow an inbox file and hand each new event to onEvent. Polls rather than
 * fs.watch: the writer may be a different process on a different drive, and a
 * truncated or replaced file has to reset cleanly. Dedupes on runId:seq so a
 * re-read never double-fires.
 */
function watchInbox(inboxPath, onEvent, opts = {}) {
  const interval = opts.interval || 200;
  let offset = 0;
  let carry = '';
  const seen = new Set();

  function drain() {
    if (!fs.existsSync(inboxPath)) {
      offset = 0;
      carry = '';
      seen.clear();
      return;
    }
    const stat = fs.statSync(inboxPath);
    if (stat.size < offset) {
      offset = 0;
      carry = '';
      seen.clear();
    }
    if (stat.size === offset) return;
    const fd = fs.openSync(inboxPath, 'r');
    const buf = Buffer.alloc(stat.size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);
    offset = stat.size;
    const chunk = carry + buf.toString('utf8');
    const pieces = chunk.split('\n');
    carry = pieces.pop() || '';
    for (const line of pieces) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      const key = e.runId + ':' + e.seq;
      if (seen.has(key)) continue;
      seen.add(key);
      onEvent(e);
    }
  }

  drain();
  const timer = setInterval(drain, interval);
  return { close() { clearInterval(timer); } };
}

function defaultInboxPath() {
  return path.join(os.homedir(), '.rice', 'events.jsonl');
}

const MOOD_DELTA = { verified: 1, excursion: -1, rejected: -2 };

function moodLevel(score) {
  if (score >= 2) return 'happy';
  if (score >= 0) return 'content';
  if (score >= -2) return 'uneasy';
  return 'stressed';
}

class EventBus {
  constructor(opts = {}) {
    this.runId = opts.runId || `run-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
    this.runsDir = opts.runsDir || path.join(process.cwd(), 'runs');
    this.seq = 0;
    this.buffer = [];
    this.protocol = null;
    this.petState = 'calm';
    this.counters = { allowed: 0, blocked: 0, verified: 0, rejected: 0, suspicious: 0 };
    this.moodScore = 0;
    this.openClaims = [];

    fs.mkdirSync(this.runsDir, { recursive: true });
    this.recordPath = path.join(this.runsDir, `${this.runId}.jsonl`);
    this.stream = fs.createWriteStream(this.recordPath, { flags: 'a' });

    // Optional tail-able inbox. The run record above is per-run and archival;
    // this is one rolling file a reader can follow without knowing the run id.
    this.inboxPath = opts.inboxPath || null;
    if (this.inboxPath) {
      fs.mkdirSync(path.dirname(this.inboxPath), { recursive: true });
      this.inbox = fs.createWriteStream(this.inboxPath, { flags: 'a' });
    }
  }

  /** Emit an event. Returns the finished event object. */
  emit(evt) {
    const e = {
      v: SCHEMA_VERSION,
      seq: ++this.seq,
      ts: new Date().toISOString(),
      runId: this.runId,
      type: evt.type,
      status: evt.status || 'ok',
      petState: evt.petState || this.petState,
      tool: evt.tool || null,
      summary: evt.summary || '',
      reason: evt.reason || null,
      rule: evt.rule || null,
      detail: evt.detail || {},
    };

    // counters + mood
    if (e.type === 'action' && e.status === 'allow') this.counters.allowed++;
    if (e.type === 'excursion') { this.counters.blocked++; this.moodScore += MOOD_DELTA.excursion; }
    if (e.type === 'suspicious') this.counters.suspicious++;
    if (e.type === 'verdict' && e.status === 'pass') { this.counters.verified++; this.moodScore += MOOD_DELTA.verified; }
    if (e.type === 'verdict' && e.status === 'fail') { this.counters.rejected++; this.moodScore += MOOD_DELTA.rejected; }
    if (e.type === 'protocol') this.protocol = e.detail;

    this.petState = e.petState;

    this.buffer.push(e);
    if (this.buffer.length > 500) this.buffer.shift();
    this.stream.write(JSON.stringify(e) + '\n');
    if (this.inbox) this.inbox.write(JSON.stringify(e) + '\n');
    return e;
  }

  state() {
    return {
      runId: this.runId,
      petState: this.petState,
      mood: {
        level: moodLevel(this.moodScore),
        score: this.moodScore,
        ...this.counters,
      },
      openClaims: this.openClaims.length,
      protocol: this.protocol,
      seq: this.seq,
    };
  }

  close() {
    this.stream.end();
  }
}

module.exports = { EventBus, SCHEMA_VERSION, moodLevel, defaultInboxPath, watchInbox };
