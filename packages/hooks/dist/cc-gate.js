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

// src/cc-gate.ts
var cc_gate_exports = {};
__export(cc_gate_exports, {
  runGate: () => runGate
});
module.exports = __toCommonJS(cc_gate_exports);

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
function readState(series_key, homeDir) {
  const filePath = stateFilePath(series_key, homeDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
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
        if (data.approved) {
          const comments = await fetchComments(config.server, series_id);
          const content = weaveComments(data.content, comments);
          return { approved: true, content };
        }
        if (data.rejected) {
          const comments = await fetchComments(config.server, series_id);
          const content = weaveComments(data.content, comments);
          return { approved: false, reason: "rejected", content };
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

// src/cc-gate.ts
async function runGate(input, env, cwd, homeDir, pollIntervalMs, gateSecs) {
  let envelope;
  try {
    envelope = JSON.parse(input);
  } catch {
    return;
  }
  if (envelope.tool_name !== "ExitPlanMode") return;
  const series_key = getCCSeriesKey(env);
  const state = readState(series_key, homeDir);
  if (!state) return;
  const config = loadConfig(cwd, homeDir);
  if (gateSecs !== void 0) config.gate_timeout_seconds = gateSecs;
  const result = await pollUntilApproved(state.series_id, config, pollIntervalMs);
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
  } else if (result.reason === "rejected") {
    const state2 = readState(series_key, homeDir);
    const url = state2?.share_url ?? config.server;
    deny(`[PACT] Plan rejected. Do not proceed. Review feedback at: ${url}

${result.content}`);
  } else if (result.reason === "timeout") {
    const state2 = readState(series_key, homeDir);
    const url = state2?.share_url ?? config.server;
    deny(`[PACT] Plan not approved \u2014 review timed out. Approve at: ${url}

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
    await runGate(input, process.env, process.cwd());
    process.exit(0);
  }
  main().catch(() => process.exit(0));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runGate
});
