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
  gate_timeout_seconds: 300
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
async function pollUntilApproved(series_id, config, pollIntervalMs = 3e3) {
  if (!config.enabled) return { approved: false, reason: "disabled" };
  const deadline = Date.now() + config.gate_timeout_seconds * 1e3;
  while (true) {
    try {
      const response = await fetch(`${config.server}/api/plans/${series_id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.approved) return { approved: true, content: data.content };
      }
    } catch {
    }
    if (Date.now() >= deadline) return { approved: false, reason: "timeout" };
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
  if (result.approved) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: `[PACT] Plan approved by reviewer. Proceed with this reviewed plan:

${result.content}`
      }
    }));
  } else if (result.reason === "timeout") {
    process.stderr.write("[PACT] Review timed out, proceeding.\n");
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
