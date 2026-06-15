#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cc-hook.ts
var cc_hook_exports = {};
__export(cc_hook_exports, {
  runHook: () => runHook
});
module.exports = __toCommonJS(cc_hook_exports);
var import_crypto = __toESM(require("crypto"));

// src/config.ts
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var defaultConfig = {
  enabled: true,
  server: "http://localhost:3000",
  redact: [],
  nudge: true,
  gate_timeout_seconds: 86400
};
function loadConfig(cwd, homeDir) {
  const dir = cwd ?? process.cwd();
  const home = homeDir ?? os.homedir();
  let config = { ...defaultConfig };
  const globalPath = path.join(home, ".pact", "config.json");
  if (fs.existsSync(globalPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(globalPath, "utf8"));
      config = { ...config, ...parsed };
    } catch {
    }
  }
  const localPath = path.join(dir, ".pact.json");
  if (fs.existsSync(localPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localPath, "utf8"));
      config = { ...config, ...parsed };
    } catch {
    }
  }
  return config;
}
function redactContent(content, patterns) {
  let result = content;
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, "g");
    result = result.replace(regex, "[REDACTED]");
  }
  return result;
}
function getCCSeriesKey(env) {
  const sessionId = env["CLAUDE_SESSION_ID"] ?? "";
  const pwd = env["PWD"] ?? "";
  const branch = env["GIT_BRANCH"] ?? "";
  return `${sessionId}:${pwd}:${branch}`;
}
function stateFilePath(series_key, homeDir) {
  const hash = crypto.createHash("sha256").update(series_key).digest("hex");
  return path.join(homeDir ?? os.homedir(), ".pact", "state", `${hash}.json`);
}
function planSimilarity(a, b) {
  const words = (s) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wa = words(a);
  const wb = words(b);
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = (/* @__PURE__ */ new Set([...wa, ...wb])).size;
  return union === 0 ? 1 : intersection / union;
}
var SIMILARITY_THRESHOLD = 0.3;
function readState(series_key, homeDir) {
  const filePath = stateFilePath(series_key, homeDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
function writeState(series_key, state, homeDir) {
  const filePath = stateFilePath(series_key, homeDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

// src/gate-core.ts
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchComments(server, series_id) {
  try {
    const res = await fetch(`${server}/api/plans/${series_id}/comments`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
function weaveComments(content, comments) {
  const open = comments.filter((c) => !c.resolved);
  if (open.length === 0) return content;
  const byLine = /* @__PURE__ */ new Map();
  const unanchored = [];
  for (const c of open) {
    if (!c.anchor) {
      unanchored.push(c);
      continue;
    }
    const anchorPart = c.anchor.split("#")[0];
    const linePart = anchorPart.includes("..") ? anchorPart.split("..")[1] : anchorPart;
    const line = parseInt(linePart.slice(2));
    if (!isNaN(line)) {
      (byLine.get(line) ?? byLine.set(line, []).get(line)).push(c);
    } else {
      unanchored.push(c);
    }
  }
  const lines = content.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const thread = byLine.get(i + 1);
    if (thread) {
      for (const c of thread) {
        out.push(`> [reviewer] ${c.body}`);
      }
    }
  }
  if (unanchored.length > 0) {
    out.push("", "---", "**General comments:**");
    for (const c of unanchored) {
      out.push(`- ${c.body}`);
    }
  }
  return out.join("\n");
}
async function pollUntilApproved(series_id, config, pollIntervalMs = 3e3) {
  if (!config.enabled) return { approved: false, reason: "disabled" };
  const deadline = Date.now() + config.gate_timeout_seconds * 1e3;
  while (true) {
    try {
      const response = await fetch(`${config.server}/api/plans/${series_id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "approved") {
          const comments = await fetchComments(config.server, series_id);
          const content = weaveComments(data.content, comments);
          return { approved: true, content };
        }
        if (data.status === "building_consensus") {
          const comments = await fetchComments(config.server, series_id);
          const content = weaveComments(data.content, comments);
          return { approved: false, reason: "building_consensus", content };
        }
      }
    } catch {
    }
    if (Date.now() >= deadline) {
      let timedOutContent = "";
      try {
        const r = await fetch(`${config.server}/api/plans/${series_id}`);
        if (r.ok) {
          const d = await r.json();
          const comments = await fetchComments(config.server, series_id);
          timedOutContent = weaveComments(d.content, comments);
        }
      } catch {
      }
      return { approved: false, reason: "timeout", content: timedOutContent };
    }
    await sleep(pollIntervalMs);
  }
}

// src/cc-hook.ts
async function runHook(input, env, cwd, homeDir, pollIntervalMs, gateSecs) {
  let envelope;
  try {
    envelope = JSON.parse(input);
  } catch {
    return;
  }
  if (envelope.tool_name !== "ExitPlanMode") return;
  const plan = envelope.tool_input?.plan ?? "";
  if (!plan.trim()) return;
  const model_id = envelope.model ?? env.CLAUDE_MODEL ?? env.ANTHROPIC_MODEL ?? void 0;
  const config = loadConfig(cwd, homeDir);
  if (gateSecs !== void 0) config.gate_timeout_seconds = gateSecs;
  if (!config.enabled) return;
  const redacted = redactContent(plan, config.redact);
  const series_key = getCCSeriesKey(env);
  const existingState = readState(series_key, homeDir);
  let lastContent = null;
  let isSameFeature = true;
  if (existingState) {
    try {
      const res = await fetch(`${config.server}/api/plans/${existingState.series_id}`);
      if (res.ok) {
        const data = await res.json();
        lastContent = data.content ?? null;
      }
    } catch {
    }
    if (lastContent !== null) {
      isSameFeature = planSimilarity(redacted, lastContent) >= SIMILARITY_THRESHOLD;
    }
  }
  const postKey = isSameFeature ? existingState?.series_key ?? series_key : import_crypto.default.randomUUID();
  let series_id;
  let share_url;
  try {
    const response = await fetch(`${config.server}/api/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        series_key: postKey,
        content: redacted,
        author_kind: "agent",
        source_tool: "claude-code",
        ...model_id ? { model_id } : {}
      })
    });
    if (!response.ok) {
      process.stderr.write(`[PACT] Failed to submit plan: ${response.status}
`);
      return;
    }
    const data = await response.json();
    series_id = data.series_id;
    share_url = `${config.server}/viewer/${data.share_token}`;
    writeState(series_key, { series_id, series_key: postKey, share_url }, homeDir);
  } catch (e) {
    process.stderr.write(`[PACT] Error submitting plan: ${e}
`);
    return;
  }
  const logMsg = !existingState || !isSameFeature ? `[PACT] New plan: ${share_url}` : lastContent !== null && redacted === lastContent ? `[PACT] Re-reviewing unchanged plan: ${share_url}` : `[PACT] Updated plan: ${share_url}`;
  process.stderr.write(`
${logMsg}
`);
  const result = await pollUntilApproved(series_id, config, pollIntervalMs);
  const deny = (message) => process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "deny", message }
    }
  }));
  if (result.approved) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: { behavior: "allow" },
        additionalContext: `[PACT] Plan approved. Proceed with this reviewed plan:

${result.content}`.slice(0, 1e4)
      }
    }));
  } else if (result.reason === "building_consensus") {
    deny(`[PACT] Plan is building consensus. Do not proceed. Review feedback at: ${share_url}

${result.content}`);
  } else if (result.reason === "timeout") {
    deny(`[PACT] Plan not approved \u2014 review timed out. Approve at: ${share_url}

${result.content}`);
  }
}
if (require.main === module) {
  async function main() {
    const input = await new Promise((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        data += chunk;
      });
      process.stdin.on("end", () => resolve(data));
    });
    const env = process.env;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await runHook(input, env, process.cwd());
        process.exit(0);
      } catch (e) {
        process.stderr.write(`[PACT] Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e}
`);
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1e3 * attempt));
      }
    }
    process.exit(0);
  }
  main().catch(() => process.exit(0));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runHook
});
