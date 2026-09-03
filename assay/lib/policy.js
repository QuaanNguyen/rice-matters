'use strict';
/**
 * The gate. Deterministic, no model in the loop — that is the whole point.
 *
 * A protocol describes what the delegated task is allowed to touch.
 * Every proposed tool call is checked against it by ordinary code.
 */
const path = require('node:path');
const { normalise } = require('./toolcalls');

/** Convert a glob to a RegExp. Supports ** , * and ? . */
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

/** Resolve a path against the workdir and return it relative to it (posix). */
function relToWorkdir(p, workdir) {
  const raw = toPosix(p).replace(/^["']|["']$/g, '');
  const expanded = raw.replace(/^~(?=\/|$)/, toPosix(process.env.HOME || process.env.USERPROFILE || '~'));
  const abs = path.posix.resolve(toPosix(workdir), expanded);
  const rel = path.posix.relative(toPosix(workdir), abs);
  return { abs, rel, escapes: rel.startsWith('..') || path.posix.isAbsolute(rel) };
}

class Protocol {
  constructor(spec, workdir) {
    this.task = spec.task || '(no task declared)';
    this.workdir = toPosix(workdir || spec.workdir || process.cwd());
    this.readPaths = (spec.read_paths || []).map(toPosix);
    this.writePaths = (spec.write_paths || []).map(toPosix);
    this.allowCommands = (spec.allow_commands || []).map((s) => s.toLowerCase());
    this.denyCommands = (spec.deny_commands || []).map((s) => s.toLowerCase());
    this.egress = spec.egress || [];
    this.doneCriteria = spec.done_criteria || [];
    this.raw = spec;

    this._read = this.readPaths.map(globToRe);
    this._write = this.writePaths.map(globToRe);
  }

  matchesRead(rel) { return this._read.some((r) => r.test(rel)); }
  matchesWrite(rel) { return this._write.some((r) => r.test(rel)); }

  egressAllowed(url) {
    if (!this.egress.length) return false;
    let host;
    try { host = new URL(/^[a-z]+:\/\//i.test(url) ? url : `http://${url}`).hostname; }
    catch { host = String(url); }
    return this.egress.some((allowed) => {
      const a = String(allowed).toLowerCase();
      if (a === '*') return true;
      if (a.startsWith('*.')) return host === a.slice(2) || host.endsWith(a.slice(1));
      return host === a;
    });
  }

  summary() {
    return {
      task: this.task,
      workdir: this.workdir,
      read_paths: this.readPaths,
      write_paths: this.writePaths,
      allow_commands: this.allowCommands,
      deny_commands: this.denyCommands,
      egress: this.egress,
      done_criteria: this.doneCriteria.map((d) => ({ id: d.id, describe: d.describe || d.id })),
    };
  }
}

/**
 * Check one tool call against the protocol.
 * @returns {{decision:'allow'|'block', rule:string|null, reason:string|null, call:object}}
 */
function check(toolCall, protocol) {
  const call = normalise(toolCall);

  // 1. network egress
  for (const url of call.urls) {
    if (!protocol.egressAllowed(url)) {
      return deny(call, 'egress', `network destination not declared in protocol (${shortHost(url)})`);
    }
  }

  // 2. command allow/deny
  if (call.kind === 'exec' && call.binary) {
    const bin = call.binary.toLowerCase();
    if (protocol.denyCommands.includes(bin)) {
      return deny(call, 'deny_commands', `'${bin}' is on the protocol's deny list`);
    }
    if (protocol.allowCommands.length && !protocol.allowCommands.includes(bin)) {
      return deny(call, 'allow_commands', `'${bin}' is not among the commands this task declared`);
    }
  }

  // 3. writes
  for (const p of call.writePaths) {
    const { rel, escapes } = relToWorkdir(p, protocol.workdir);
    if (escapes) return deny(call, 'write_paths', `writes outside the working directory (${p})`);
    if (!protocol.matchesWrite(rel)) {
      return deny(call, 'write_paths', `'${rel}' is not a path this task may write`);
    }
  }

  // 4. reads
  for (const p of call.readPaths) {
    const { rel, escapes } = relToWorkdir(p, protocol.workdir);
    if (escapes) return deny(call, 'read_paths', `reads outside the working directory (${p})`);
    if (!protocol.matchesRead(rel) && !protocol.matchesWrite(rel)) {
      return deny(call, 'read_paths', `'${rel}' is outside the scope of this task`);
    }
  }

  return { decision: 'allow', rule: null, reason: null, call };
}

function deny(call, rule, reason) {
  return { decision: 'block', rule, reason, call };
}

function shortHost(url) {
  try { return new URL(/^[a-z]+:\/\//i.test(url) ? url : `http://${url}`).host; }
  catch { return String(url).slice(0, 40); }
}

/**
 * Derive a starting protocol from a free-text task when none was supplied.
 * Deliberately conservative: the working tree is readable, nothing is writable
 * until the user says so, no network, no shell beyond inspection commands.
 */
function deriveDefault(task, workdir) {
  return new Protocol({
    task: task || '(no task declared)',
    read_paths: ['**'],
    write_paths: [],
    allow_commands: ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'git'],
    deny_commands: ['curl', 'wget', 'nc', 'ncat', 'netcat', 'ssh', 'scp', 'rm'],
    egress: [],
    done_criteria: [],
  }, workdir);
}

module.exports = { Protocol, check, deriveDefault, globToRe, relToWorkdir };
