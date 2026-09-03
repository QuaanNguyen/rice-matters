import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

function findRepo(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "assay/lib/session.js"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveRoot(start) {
  if (process.env.RICE_ROOT) return process.env.RICE_ROOT;
  const bundled = path.join(start, "rice");
  if (fs.existsSync(path.join(bundled, "assay/lib/session.js"))) return bundled;
  return findRepo(start);
}

const repoRoot = resolveRoot(here);
if (!repoRoot) {
  throw new Error(
    "Rice cannot find assay/lib/session.js. Run scripts/install-plugin (copies assay + pet next to the plugin), or set RICE_ROOT.",
  );
}

const { createSession } = require(path.join(repoRoot, "assay/lib/session.js"));
const { EventBus, defaultInboxPath } = require(path.join(repoRoot, "assay/lib/events.js"));

const TOOL_ACTION = {
  read: "read",
  glob: "glob",
  grep: "grep",
  edit: "edit",
  write: "edit",
  patch: "edit",
  bash: "shell",
  shell: "shell",
  webfetch: "webfetch",
  websearch: "webfetch",
};

function loadProtocol(workdir) {
  const local = path.join(workdir, "protocol.json");
  if (!fs.existsSync(local)) return null;
  return JSON.parse(fs.readFileSync(local, "utf8"));
}

function resourcesFromArgs(tool, args) {
  const a = args || {};
  if (tool === "bash" || tool === "shell") return [a.command || a.cmd].filter(Boolean);
  if (tool === "webfetch" || tool === "websearch") return [a.url || a.query].filter(Boolean);
  return [a.filePath || a.path || a.pattern || a.glob].filter(Boolean);
}

function resultText(output) {
  if (!output) return "";
  if (typeof output.output === "string") return output.output;
  if (typeof output.content === "string") return output.content;
  if (output.error) return String(output.error.message || output.error);
  return typeof output === "string" ? output : JSON.stringify(output);
}

function lastAssistantText(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.data || payload?.messages || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    const info = item.info || item;
    const role = info.role;
    if (role !== "assistant") continue;
    const parts = item.parts || info.parts || [];
    const text = parts.map((p) => p.text || p.content || "").join("");
    if (text.trim()) return text;
    if (typeof item.content === "string") return item.content;
  }
  return "";
}

function sessionIDOf(event) {
  const props = event.properties || event;
  return props.sessionID || props.session?.id || event.sessionID;
}

function isBusy(event) {
  const props = event.properties || event;
  const status = props.status;
  return status === "busy" || status?.type === "busy";
}

function isIdle(event) {
  if (event.type === "session.idle") return true;
  const props = event.properties || event;
  const status = props.status;
  return status === "idle" || status?.type === "idle";
}

function electronBinary(petDir) {
  const pkg = path.join(petDir, "node_modules/electron");
  if (!fs.existsSync(pkg)) return null;
  try {
    const bin = require(pkg);
    if (typeof bin === "string" && fs.existsSync(bin)) return bin;
  } catch {
    return null;
  }
  return null;
}

function launchPet(inboxPath) {
  const petDir = path.join(repoRoot, "pet");
  const bin = electronBinary(petDir);
  if (!bin) {
    console.error(
      "[rice] Pet Rice not launched: Electron binary missing under " + petDir +
      ". Re-run: bash scripts/install-plugin.sh",
    );
    return;
  }
  const env = { ...process.env, RICE_EVENTS: inboxPath };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  const child = spawn(bin, ["."], {
    cwd: petDir,
    detached: true,
    stdio: "ignore",
    env,
  });
  child.on("error", (err) => {
    console.error("[rice] failed to launch Pet Rice:", err.message);
  });
  child.unref();
}

export const Rice = async ({ client, directory }) => {
  const workdir = directory || process.cwd();
  const protocol = loadProtocol(workdir);
  const inboxPath = process.env.RICE_EVENTS || defaultInboxPath();
  const runsDir = path.join(os.homedir(), ".rice", "runs");
  const session = createSession({ protocol, workdir });
  const bus = new EventBus({ inboxPath, runsDir });
  const claimed = new Set();

  function publish(out) {
    if (!out || !out.events) return;
    for (const e of out.events) bus.emit(e);
  }

  publish(session.handle({ kind: "session.start" }));
  launchPet(inboxPath);

  async function reviewClaims(sessionID) {
    if (!sessionID || !client?.session?.messages) return;
    let payload;
    try { payload = await client.session.messages({ path: { id: sessionID } }); }
    catch { return; }
    const text = lastAssistantText(payload);
    if (!text || claimed.has(text)) return;
    const out = session.handle({ kind: "assistant", text });
    publish(out);
    if (out.events.some((e) => e.type === "claim" || e.type === "ask" || e.type === "verdict")) {
      claimed.add(text);
    }
    if (out.inject && client?.session?.prompt) {
      await client.session.prompt({
        path: { id: sessionID },
        body: { parts: [{ type: "text", text: out.inject }] },
      });
    }
  }

  return {
    "tool.execute.before": async (input, output) => {
      const tool = input.tool || "";
      const args = output?.args || input.args || {};
      const resources = resourcesFromArgs(tool, args);
      const out = session.handle({
        kind: "permission",
        action: TOOL_ACTION[tool] || tool,
        resources: resources.length ? resources : [tool],
      });
      publish(out);
      if (out.deny) throw new Error(out.deny.message);
    },

    "tool.execute.after": async (input, output) => {
      publish(session.handle({
        kind: "tool.after",
        tool: input.tool,
        status: output?.error ? "error" : "completed",
        result: resultText(output),
        error: output?.error,
      }));
    },

    event: async ({ event }) => {
      if (!event) return;
      if (event.type === "session.status" && isBusy(event)) {
        publish(session.handle({ kind: "thinking" }));
      }
      if (event.type === "session.idle" || event.type === "message.updated" || isIdle(event)) {
        await reviewClaims(sessionIDOf(event));
      }
    },
  };
};
