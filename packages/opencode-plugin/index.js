import { Plugin } from "@opencode-ai/plugin";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const { createSession } = require(path.join(repoRoot, "assay/lib/session.js"));
const { EventBus, defaultInboxPath } = require(path.join(repoRoot, "assay/lib/events.js"));

function loadProtocol(protocolPath, workdir) {
  if (protocolPath && fs.existsSync(protocolPath)) {
    return JSON.parse(fs.readFileSync(protocolPath, "utf8"));
  }
  const fallback = path.join(workdir, "protocol.json");
  if (fs.existsSync(fallback)) return JSON.parse(fs.readFileSync(fallback, "utf8"));
  const demo = path.join(repoRoot, "demo/protocol.json");
  if (fs.existsSync(demo)) return JSON.parse(fs.readFileSync(demo, "utf8"));
  return null;
}

function resultText(event) {
  if (event.status === "error") {
    return (event.error && (event.error.message || event.error)) || String(event.result || "");
  }
  const r = event.result;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    if (typeof r.output === "string") return r.output;
    if (typeof r.content === "string") return r.content;
    if (typeof r.text === "string") return r.text;
  }
  return r == null ? "" : JSON.stringify(r);
}

function lastAssistantText(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.messages || payload?.info || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    const role = m.role || m.info?.role;
    if (role !== "assistant") continue;
    if (typeof m.content === "string") return m.content;
    const parts = m.parts || (Array.isArray(m.content) ? m.content : []);
    if (Array.isArray(parts) && parts.length) {
      return parts.map((p) => p.text || p.content || "").join("");
    }
  }
  return "";
}

function launchPet(inboxPath) {
  const petDir = path.join(repoRoot, "pet");
  const electronCli = path.join(petDir, "node_modules/electron/cli.js");
  if (!fs.existsSync(electronCli)) return;
  const child = spawn(process.execPath, [electronCli, petDir], {
    cwd: petDir,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, RICE_EVENTS: inboxPath },
  });
  child.unref();
}

export default Plugin.define({
  id: "rice",
  async setup(ctx) {
    const workdir = ctx.location?.directory || process.cwd();
    const options = ctx.options || {};
    const protocolPath = options.protocol
      ? path.resolve(workdir, options.protocol)
      : undefined;
    const protocol = loadProtocol(protocolPath, workdir);
    const inboxPath = options.inbox || process.env.RICE_EVENTS || defaultInboxPath();
    const runsDir = options.runsDir
      ? path.resolve(workdir, options.runsDir)
      : path.join(os.homedir(), ".rice", "runs");

    const session = createSession({ protocol, workdir });
    const bus = new EventBus({ inboxPath, runsDir });

    function publish(out) {
      if (!out || !out.events) return;
      for (const e of out.events) bus.emit(e);
    }

    publish(session.handle({ kind: "session.start" }));
    launchPet(inboxPath);

    const claimed = new Set();

    await ctx.permission.hook("evaluate", async (event) => {
      const out = session.handle({
        kind: "permission",
        action: event.action,
        resources: [...(event.resources || [])],
      });
      publish(out);
      if (out.deny) {
        event.effect = "deny";
        event.message = out.deny.message;
      }
    });

    await ctx.tool.hook("execute.after", (event) => {
      publish(session.handle({
        kind: "tool.after",
        id: event.id || event.tool,
        tool: event.tool,
        status: event.status,
        result: resultText(event),
        error: event.error,
        input: event.input,
      }));
    });

    await ctx.session.hook("context", () => {
      publish(session.handle({ kind: "thinking" }));
    });

    const controller = new AbortController();
    void (async () => {
      for await (const raw of ctx.event.subscribe({ signal: controller.signal })) {
        const type = raw.type || raw.event?.type;
        const props = raw.properties || raw.event?.properties || raw;
        const sessionID = props.sessionID || props.session?.id || raw.sessionID;
        if (type === "session.status" && (props.status === "idle" || props.status?.type === "idle")) {
          await reviewClaims(sessionID);
        }
        if (type === "session.idle" || type === "message.updated") {
          await reviewClaims(sessionID);
        }
      }
    })();

    async function reviewClaims(sessionID) {
      if (!sessionID) return;
      let payload;
      try { payload = await ctx.session.context({ sessionID }); }
      catch { return; }
      const text = lastAssistantText(payload);
      if (!text || claimed.has(text)) return;
      const out = session.handle({ kind: "assistant", text });
      publish(out);
      if (out.events.some((e) => e.type === "claim" || e.type === "ask" || e.type === "verdict")) {
        claimed.add(text);
      }
      if (out.inject) {
        await ctx.session.synthetic({ sessionID, text: out.inject });
      }
    }

    return () => {
      controller.abort();
      publish(session.handle({ kind: "session.end" }));
      bus.close();
    };
  },
});
