'use strict';
/**
 * Normalise a provider tool_call into the small shape the policy engine checks.
 * Harnesses name their tools differently (OpenCode, Cline, Aider, VS Code chat),
 * so we classify by name family first and fall back to inspecting arguments.
 */

const READ_TOOLS = new Set(['read', 'readfile', 'read_file', 'view', 'cat', 'open', 'list', 'ls',
  'glob', 'grep', 'search', 'codesearch', 'find', 'list_dir', 'listdirectory']);
const WRITE_TOOLS = new Set(['write', 'writefile', 'write_file', 'edit', 'str_replace', 'patch',
  'apply_patch', 'create', 'createfile', 'multiedit', 'notebookedit']);
const EXEC_TOOLS = new Set(['bash', 'shell', 'sh', 'exec', 'run', 'run_command', 'terminal',
  'execute_command', 'powershell', 'cmd']);
const NET_TOOLS = new Set(['webfetch', 'web_fetch', 'fetch', 'http', 'httprequest', 'browser',
  'websearch', 'web_search', 'curl', 'download']);

const PATH_KEYS = ['path', 'file_path', 'filePath', 'filename', 'file', 'target', 'dir',
  'directory', 'notebook_path', 'pattern', 'glob'];
const CMD_KEYS = ['command', 'cmd', 'script', 'input', 'code'];
const URL_KEYS = ['url', 'uri', 'endpoint', 'href'];

const URL_RE = /\bhttps?:\/\/[^\s'"`)>\]}]+/gi;
// bare host:port or IP that a command might POST to
const HOSTISH_RE = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g;

function safeParse(s) {
  if (s == null) return {};
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return { _raw: String(s) }; }
}

function collect(obj, keys) {
  const out = [];
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
    else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && x.trim()) out.push(x.trim());
  }
  return out;
}

/** Pull anything that looks like a filesystem path out of a shell command. */
function pathsInCommand(cmd) {
  const out = [];
  const tokens = String(cmd).split(/\s+/);
  for (let t of tokens) {
    t = t.replace(/^["'`]|["'`;|&]+$/g, '');
    if (!t || t.startsWith('-')) continue;
    if (URL_RE.test(t)) { URL_RE.lastIndex = 0; continue; }
    URL_RE.lastIndex = 0;
    // absolute, home-relative, explicit-relative, or has a directory separator
    if (/^([~/]|\.\.?\/)/.test(t) || (t.includes('/') && !t.includes('://'))) out.push(t);
    else if (/^[A-Za-z]:[\\/]/.test(t)) out.push(t);
  }
  return out;
}

function urlsIn(text) {
  const s = String(text || '');
  const urls = s.match(URL_RE) || [];
  URL_RE.lastIndex = 0;
  const hosts = s.match(HOSTISH_RE) || [];
  HOSTISH_RE.lastIndex = 0;
  // only treat a bare IP as egress if it appears near a network verb
  const netty = /\b(curl|wget|nc|ncat|netcat|ssh|scp|rsync|ftp|telnet|invoke-webrequest|iwr)\b/i.test(s);
  return urls.concat(netty ? hosts : []);
}

/**
 * @returns {{id,name,kind,readPaths,writePaths,command,binary,urls,args,summary}}
 */
function normalise(toolCall) {
  const fn = toolCall.function || {};
  const rawName = String(fn.name || toolCall.name || 'unknown');
  const name = rawName.toLowerCase().replace(/[^a-z_]/g, '');
  const args = safeParse(fn.arguments ?? toolCall.arguments ?? toolCall.input);

  const out = {
    id: toolCall.id || null,
    name: rawName,
    kind: 'other',
    readPaths: [],
    writePaths: [],
    command: null,
    binary: null,
    urls: [],
    args,
    summary: rawName,
  };

  const declaredPaths = collect(args, PATH_KEYS);
  const declaredCmds = collect(args, CMD_KEYS);
  const declaredUrls = collect(args, URL_KEYS);

  if (EXEC_TOOLS.has(name) || (declaredCmds.length && !READ_TOOLS.has(name) && !WRITE_TOOLS.has(name))) {
    out.kind = 'exec';
    out.command = declaredCmds[0] || declaredPaths[0] || '';
    const first = String(out.command).trim().split(/\s+/)[0] || '';
    out.binary = first.replace(/^.*[\\/]/, '').replace(/^["']/, '');
    // a shell command can both read and write; treat every path as needing read,
    // and paths after a redirect or a writing binary as needing write.
    const p = pathsInCommand(out.command);
    out.readPaths = p;
    const redirect = String(out.command).match(/>>?\s*("[^"]+"|'[^']+'|\S+)/g) || [];
    for (const r of redirect) {
      const target = r.replace(/^>>?\s*/, '').replace(/^["']|["']$/g, '');
      if (target) out.writePaths.push(target);
    }
    if (/^(rm|mv|cp|touch|mkdir|sed|tee|chmod|chown|truncate)$/i.test(out.binary)) {
      out.writePaths.push(...p);
    }
    out.urls = urlsIn(out.command);
    out.summary = truncate(out.command, 70);
  } else if (WRITE_TOOLS.has(name)) {
    out.kind = 'write';
    out.writePaths = declaredPaths;
    out.readPaths = declaredPaths;
    out.summary = `${rawName} ${truncate(declaredPaths[0] || '', 50)}`.trim();
  } else if (NET_TOOLS.has(name)) {
    out.kind = 'net';
    out.urls = declaredUrls.concat(urlsIn(JSON.stringify(args)));
    out.summary = `${rawName} ${truncate(out.urls[0] || '', 50)}`.trim();
  } else if (READ_TOOLS.has(name)) {
    out.kind = 'read';
    out.readPaths = declaredPaths;
    out.summary = `${rawName} ${truncate(declaredPaths[0] || '', 50)}`.trim();
  } else {
    // Unknown tool: be conservative and inspect everything it declared.
    out.readPaths = declaredPaths;
    out.urls = declaredUrls.concat(urlsIn(JSON.stringify(args)));
    if (declaredCmds.length) { out.kind = 'exec'; out.command = declaredCmds[0]; }
    out.summary = `${rawName} ${truncate(declaredPaths[0] || declaredUrls[0] || '', 40)}`.trim();
  }

  return out;
}

function truncate(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

module.exports = { normalise, pathsInCommand, urlsIn, truncate,
  READ_TOOLS, WRITE_TOOLS, EXEC_TOOLS, NET_TOOLS };
