#!/usr/bin/env node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

interface HookEntry {
  type: string;
  command: string;
}

interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

function readSettings(): Settings {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) as Settings;
  } catch {
    return {};
  }
}

function writeSettings(settings: Settings): void {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function hasHook(list: HookMatcher[], command: string): boolean {
  return list.some((m) => m.hooks.some((h) => h.command === command));
}

function install(): void {
  const settings = readSettings();
  settings.hooks ??= {};

  // Both hooks in one matcher entry so capture runs before gate in the same event.
  // PermissionRequest fires when CC wants to exit plan mode — capture posts the plan
  // first (writing state), then gate polls until a human approves in the browser.
  settings.hooks['PermissionRequest'] ??= [];
  if (!hasHook(settings.hooks['PermissionRequest'], 'pact-capture')) {
    settings.hooks['PermissionRequest'].push({
      matcher: 'ExitPlanMode',
      hooks: [
        { type: 'command', command: 'pact-capture' },
        { type: 'command', command: 'pact-gate' },
      ],
    });
    console.log('✓ Registered pact-capture + pact-gate (PermissionRequest/ExitPlanMode)');
  } else {
    console.log('  pact-capture + pact-gate already registered');
  }

  settings.hooks['UserPromptSubmit'] ??= [];
  if (!hasHook(settings.hooks['UserPromptSubmit'], 'pact-nudge')) {
    settings.hooks['UserPromptSubmit'].push({
      hooks: [{ type: 'command', command: 'pact-nudge' }],
    });
    console.log('✓ Registered pact-nudge (UserPromptSubmit)');
  } else {
    console.log('  pact-nudge already registered');
  }

  writeSettings(settings);
  console.log(`\nHooks written to ${SETTINGS_PATH}`);
  console.log('Restart Claude Code for changes to take effect.');
}

function uninstall(): void {
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log('No settings file found.');
    return;
  }
  const settings = readSettings();
  if (!settings.hooks) {
    console.log('No hooks configured.');
    return;
  }

  for (const event of ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'PermissionRequest']) {
    if (!settings.hooks[event]) continue;
    settings.hooks[event] = settings.hooks[event].filter(
      (m) => !m.hooks.some((h) =>
        h.command === 'pact-capture' || h.command === 'pact-gate' || h.command === 'pact-nudge'
      )
    );
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }

  writeSettings(settings);
  console.log('PACT hooks removed from settings.');
}

const cmd = process.argv[2];
if (cmd === 'uninstall') {
  uninstall();
} else if (cmd === 'install' || !cmd) {
  install();
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: pact-hooks [install|uninstall]');
  process.exit(1);
}
