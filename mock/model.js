'use strict';
/**
 * A scripted, OpenAI-compatible stand-in for ASU AIR.
 *
 * Lets the entire system be built, tested and demoed with no VPN and no API
 * key. Point ASSAY's --upstream at this and everything behaves exactly as it
 * will against the real gateway, deterministically, every time.
 *
 *   node mock/model.js --port 4000 --scenario hijack
 */
const http = require('node:http');
const { SCENARIOS } = require('./scenarios');

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    o[k] = v;
  }
  return o;
}

const a = args(process.argv.slice(2));
const PORT = Number(a.port || process.env.MOCK_PORT || 4000);
const SCENARIO = a.scenario || 'hijack';

function toolCall(id, name, argObj) {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(argObj) } };
}

function completion(turn, model) {
  const msg = { role: 'assistant', content: turn.content || null };
  if (turn.tools && turn.tools.length) {
    msg.tool_calls = turn.tools.map((t, i) => toolCall(t.id || `call_${Date.now()}_${i}`, t.name, t.args));
  }
  return {
    id: `chatcmpl-mock-${Math.random().toString(36).slice(2, 10)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || 'mock/asu-air',
    choices: [{
      index: 0,
      message: msg,
      finish_reason: msg.tool_calls ? 'tool_calls' : 'stop',
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (req.url.includes('/models')) {
      const body = JSON.stringify({ object: 'list', data: [{ id: 'mock/asu-air', object: 'model' }] });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(body);
    }

    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {}

    const script = SCENARIOS[SCENARIO];
    if (!script) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: `unknown scenario '${SCENARIO}'` } }));
    }

    // Which turn are we on? Count assistant messages already in the transcript.
    const assistantTurns = (body.messages || []).filter((m) => m.role === 'assistant').length;
    const turn = script.turns[Math.min(assistantTurns, script.turns.length - 1)];

    const out = completion(turn, body.model);
    const s = JSON.stringify(out);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) });
    res.end(s);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] scenario '${SCENARIO}' on http://127.0.0.1:${PORT}  (${SCENARIOS[SCENARIO]?.turns.length ?? 0} turns)`);
});

module.exports = { server };
