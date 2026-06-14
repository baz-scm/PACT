#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/install.ts
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
}
function hasHook(list, command) {
  return list.some((m) => m.hooks.some((h) => h.command === command));
}
function install() {
  const settings = readSettings();
  settings.hooks ??= {};
  settings.hooks["PreToolUse"] ??= [];
  if (!hasHook(settings.hooks["PreToolUse"], "pact-capture")) {
    settings.hooks["PreToolUse"].push({
      matcher: "ExitPlanMode",
      hooks: [
        { type: "command", command: "pact-capture" },
        { type: "command", command: "pact-gate" }
      ]
    });
    console.log("\u2713 Registered pact-capture + pact-gate (PreToolUse/ExitPlanMode)");
  } else {
    console.log("  pact-capture already registered");
  }
  settings.hooks["UserPromptSubmit"] ??= [];
  if (!hasHook(settings.hooks["UserPromptSubmit"], "pact-nudge")) {
    settings.hooks["UserPromptSubmit"].push({
      hooks: [{ type: "command", command: "pact-nudge" }]
    });
    console.log("\u2713 Registered pact-nudge (UserPromptSubmit)");
  } else {
    console.log("  pact-nudge already registered");
  }
  writeSettings(settings);
  console.log(`
Hooks written to ${SETTINGS_PATH}`);
  console.log("Restart Claude Code for changes to take effect.");
}
function uninstall() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log("No settings file found.");
    return;
  }
  const settings = readSettings();
  if (!settings.hooks) {
    console.log("No hooks configured.");
    return;
  }
  for (const event of ["PreToolUse", "PostToolUse", "UserPromptSubmit"]) {
    if (!settings.hooks[event]) continue;
    settings.hooks[event] = settings.hooks[event].filter(
      (m) => !m.hooks.some(
        (h) => h.command === "pact-capture" || h.command === "pact-gate" || h.command === "pact-nudge"
      )
    );
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  writeSettings(settings);
  console.log("PACT hooks removed from settings.");
}
var cmd = process.argv[2];
if (cmd === "uninstall") {
  uninstall();
} else if (cmd === "install" || !cmd) {
  install();
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error("Usage: pact-hooks [install|uninstall]");
  process.exit(1);
}
