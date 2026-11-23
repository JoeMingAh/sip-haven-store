#!/usr/bin/env node
/**
 * Verification-only browser harness for the Sip Haven storefront.
 * Not product code. Drives the Vite server launch.sh started.
 *
 * Invocation (from the repo root, after launch.sh):
 *   node .cursor/skills/verify-sip-haven/harness.mjs goto /quiz
 *   node .cursor/skills/verify-sip-haven/harness.mjs click --role button --name "Tea" --exact --wait-heading "How do you want to feel?"
 *   node .cursor/skills/verify-sip-haven/harness.mjs expect --role heading --name "Find your cup"
 *   node .cursor/skills/verify-sip-haven/harness.mjs expect --role button --name "Back" --exact --absent
 *   node .cursor/skills/verify-sip-haven/harness.mjs expect-current --role button --name "Tea" --exact
 *   node .cursor/skills/verify-sip-haven/harness.mjs expect-text --text "Your cart is empty." --exact
 *   node .cursor/skills/verify-sip-haven/harness.mjs expect-main --absent --text "$"
 *   node .cursor/skills/verify-sip-haven/harness.mjs screenshot --path quiz/result.png --full-page
 *   node .cursor/skills/verify-sip-haven/harness.mjs snapshot --path quiz/result.aria.txt
 *   node .cursor/skills/verify-sip-haven/harness.mjs expect-api --url /api/quiz-notes --method POST --status 404
 *   node .cursor/skills/verify-sip-haven/harness.mjs api-log --path quiz/api-responses.jsonl
 *   node .cursor/skills/verify-sip-haven/harness.mjs console-log --path quiz/console.log
 *   node .cursor/skills/verify-sip-haven/harness.mjs session-stop
 *
 * The first command starts Chrome. cleanup.sh stops it. Relative --path values
 * are written under /tmp/sip-haven-verify/evidence/<run-id>/.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { openSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const BASE = '/tmp/sip-haven-verify';
const TOOLS = path.join(BASE, 'tools');
const PLAYWRIGHT_VERSION = '1.65.1';

function fail(message) {
  process.stderr.write(`harness: ${message}\n`);
  process.exit(1);
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid(file) {
  if (!existsSync(file)) return null;
  const pid = Number(readFileSync(file, 'utf8').trim());
  return Number.isInteger(pid) ? pid : null;
}

function liveRunIds() {
  const stateRoot = path.join(BASE, 'state');
  if (!existsSync(stateRoot)) return [];
  return readdirSync(stateRoot).filter((id) => pidAlive(readPid(path.join(stateRoot, id, 'pid'))));
}

function resolveRun() {
  const explicit = process.env.SIP_HAVEN_VERIFY_RUN;
  if (explicit) {
    const state = path.join(BASE, 'state', explicit);
    if (!existsSync(path.join(state, 'pid'))) {
      fail(`SIP_HAVEN_VERIFY_RUN=${explicit} has no state. Run launch.sh first.`);
    }
    return { id: explicit, state, evidence: path.join(BASE, 'evidence', explicit) };
  }
  const live = liveRunIds();
  if (live.length === 1) {
    const id = live[0];
    return { id, state: path.join(BASE, 'state', id), evidence: path.join(BASE, 'evidence', id) };
  }
  if (live.length === 0) fail('No Sip Haven verification server is running. Run launch.sh.');
  fail(`More than one live verification server (${live.join(', ')}). Set SIP_HAVEN_VERIFY_RUN.`);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { positional, flags };
}

function evidencePath(run, value) {
  if (!value || typeof value !== 'string') fail('a --path is required');
  if (path.isAbsolute(value)) return value;
  return path.join(run.evidence, value);
}

function ensurePlaywright() {
  const entry = path.join(TOOLS, 'node_modules', 'playwright', 'index.js');
  if (!existsSync(entry)) {
    mkdirSync(TOOLS, { recursive: true });
    const install = spawnSync(
      'npm',
      ['install', '--prefix', TOOLS, '--no-fund', '--no-audit', `playwright@${PLAYWRIGHT_VERSION}`],
      { stdio: 'inherit' },
    );
    if (install.status !== 0) {
      fail(`could not install playwright@${PLAYWRIGHT_VERSION} into ${TOOLS}`);
    }
  }
  const require = createRequire(path.join(TOOLS, 'package.json'));
  return require('playwright');
}

function scopeRoot(page, cmd) {
  if (!cmd.withinRole) return page;
  const options = {};
  if (cmd.withinName) {
    options.name = cmd.withinName;
    options.exact = true;
  }
  return page.getByRole(cmd.withinRole, options);
}

function roleLocator(page, cmd) {
  if (!cmd.role) throw new Error('missing --role');
  const options = {};
  if (cmd.name) options.name = cmd.name;
  if (cmd.exact) options.exact = true;
  return scopeRoot(page, cmd).getByRole(cmd.role, options);
}

async function dispatch(page, run, cmd) {
  if (cmd.op === 'goto') {
    const base = readFileSync(path.join(run.state, 'url'), 'utf8').trim();
    const target = new URL(cmd.path, `${base}/`).href;
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 30000 });
    return { ok: true, url: page.url(), title: await page.title() };
  }

  if (cmd.op === 'click') {
    const loc = roleLocator(page, cmd);
    const count = await loc.count();
    if (count !== 1) {
      throw new Error(`expected 1 ${cmd.role} named ${JSON.stringify(cmd.name)}, found ${count}`);
    }
    await loc.click();
    if (cmd.waitHeading) {
      await page.getByRole('heading', { name: cmd.waitHeading }).first().waitFor({
        state: 'visible',
        timeout: 10000,
      });
    }
    mkdirSync(run.evidence, { recursive: true });
    appendFileSync(
      path.join(run.evidence, 'actions.log'),
      `${JSON.stringify({ op: 'click', role: cmd.role, name: cmd.name, exact: Boolean(cmd.exact), url: page.url() })}\n`,
    );
    return { ok: true, url: page.url() };
  }

  if (cmd.op === 'expect') {
    const loc = roleLocator(page, cmd);
    if (cmd.absent) {
      const deadline = Date.now() + 2000;
      let count = await loc.count();
      while (count !== 0 && Date.now() < deadline) {
        await delay(50);
        count = await loc.count();
      }
      if (count !== 0) {
        throw new Error(`expected no ${cmd.role} named ${JSON.stringify(cmd.name)}, found ${count}`);
      }
      return { ok: true, count: 0 };
    }
    await loc.first().waitFor({ state: 'visible', timeout: 10000 });
    return { ok: true, count: await loc.count() };
  }

  if (cmd.op === 'expect-current') {
    const loc = roleLocator(page, cmd);
    await loc.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await loc.count();
    if (count !== 1) {
      throw new Error(`expected 1 ${cmd.role} named ${JSON.stringify(cmd.name)}, found ${count}`);
    }
    const current = await loc.getAttribute('aria-current');
    if (current !== 'true') throw new Error(`aria-current is ${JSON.stringify(current)}`);
    return { ok: true, current };
  }

  if (cmd.op === 'expect-text') {
    const loc = page.getByText(cmd.text, { exact: Boolean(cmd.exact) });
    const count = await loc.count();
    if (count < 1) throw new Error(`missing text ${JSON.stringify(cmd.text)}`);
    await loc.first().waitFor({ state: 'visible', timeout: 5000 });
    return { ok: true, count };
  }

  if (cmd.op === 'expect-main') {
    const text = await page.getByRole('main').innerText();
    const has = text.includes(cmd.text);
    if (cmd.absent && has) throw new Error(`main contains ${JSON.stringify(cmd.text)}`);
    if (!cmd.absent && !has) throw new Error(`main does not contain ${JSON.stringify(cmd.text)}`);
    return { ok: true };
  }

  if (cmd.op === 'screenshot') {
    const dest = evidencePath(run, cmd.path);
    mkdirSync(path.dirname(dest), { recursive: true });
    await page.screenshot({ path: dest, fullPage: Boolean(cmd.fullPage) });
    return { ok: true, path: dest };
  }

  if (cmd.op === 'snapshot') {
    const dest = evidencePath(run, cmd.path);
    mkdirSync(path.dirname(dest), { recursive: true });
    const snap = await page.locator('body').ariaSnapshot();
    writeFileSync(dest, `${snap}\n`);
    return { ok: true, path: dest };
  }

  if (cmd.op === 'expect-api') {
    const src = path.join(run.state, 'api-responses.jsonl');
    const deadline = Date.now() + Number(cmd.waitMs || 3000);
    let match = null;
    while (Date.now() <= deadline) {
      const rows = existsSync(src)
        ? readFileSync(src, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
        : [];
      match = rows.find((row) => {
        if (cmd.url && !row.url.includes(cmd.url)) return false;
        if (cmd.method && row.method !== cmd.method) return false;
        if (cmd.status && row.status !== Number(cmd.status)) return false;
        return true;
      });
      if (match) break;
      await delay(100);
    }
    if (!match) {
      throw new Error(
        `no API response matched url=${cmd.url || '*'} method=${cmd.method || '*'} status=${cmd.status || '*'}`,
      );
    }
    return { ok: true, match };
  }

  if (cmd.op === 'api-log' || cmd.op === 'console-log') {
    const srcName = cmd.op === 'api-log' ? 'api-responses.jsonl' : 'console.log';
    const src = path.join(run.state, srcName);
    const dest = evidencePath(run, cmd.path);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, existsSync(src) ? readFileSync(src) : '');
    return { ok: true, path: dest };
  }

  if (cmd.op === 'url') return { ok: true, url: page.url(), title: await page.title() };

  if (cmd.op === 'shutdown') return { ok: true, shutdown: true };

  throw new Error(`unknown command ${cmd.op}`);
}

async function serve(run) {
  const { chromium } = ensurePlaywright();
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const apiLog = path.join(run.state, 'api-responses.jsonl');
  const consoleLog = path.join(run.state, 'console.log');

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '';
    }
    appendFileSync(
      apiLog,
      `${JSON.stringify({
        url,
        status: response.status(),
        method: response.request().method(),
        body: body.slice(0, 500),
      })}\n`,
    );
  });
  page.on('console', (msg) => {
    appendFileSync(consoleLog, `[${msg.type()}] ${msg.text()}\n`);
  });
  page.on('pageerror', (error) => {
    appendFileSync(consoleLog, `[pageerror] ${error.message}\n`);
  });

  const sock = path.join(run.state, 'harness.sock');
  rmSync(sock, { force: true });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close();
    rmSync(path.join(run.state, 'harness.ready'), { force: true });
    await browser.close();
    process.exit(0);
  };

  const server = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString();
      const idx = buf.indexOf('\n');
      if (idx === -1) return;
      const line = buf.slice(0, idx);
      buf = '';
      Promise.resolve()
        .then(async () => {
          const cmd = JSON.parse(line);
          const result = await dispatch(page, run, cmd);
          socket.end(`${JSON.stringify(result)}\n`);
          if (result.shutdown) setTimeout(() => shutdown(), 50);
        })
        .catch((error) => {
          socket.end(`${JSON.stringify({ ok: false, error: error.message })}\n`);
        });
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(sock, () => resolve());
  });
  writeFileSync(path.join(run.state, 'harness.ready'), '1');
  process.on('SIGTERM', () => {
    shutdown().catch(() => process.exit(1));
  });
  process.on('SIGINT', () => {
    shutdown().catch(() => process.exit(1));
  });
}

function serveIsUp(run) {
  return pidAlive(readPid(path.join(run.state, 'harness.pid'))) && existsSync(path.join(run.state, 'harness.ready'));
}

async function ensureServe(run) {
  if (serveIsUp(run)) return;
  rmSync(path.join(run.state, 'harness.ready'), { force: true });
  rmSync(path.join(run.state, 'harness.sock'), { force: true });
  const logFd = openSync(path.join(run.state, 'harness.log'), 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve'], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, SIP_HAVEN_VERIFY_RUN: run.id },
  });
  child.unref();
  writeFileSync(path.join(run.state, 'harness.pid'), `${child.pid}\n`);
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (existsSync(path.join(run.state, 'harness.ready'))) return;
    if (!pidAlive(child.pid)) {
      fail(`browser harness exited. See ${path.join(run.state, 'harness.log')}`);
    }
    await delay(250);
  }
  fail(`browser harness did not become ready. See ${path.join(run.state, 'harness.log')}`);
}

function call(run, cmd) {
  const sock = path.join(run.state, 'harness.sock');
  return new Promise((resolve, reject) => {
    const socket = net.connect(sock);
    let buf = '';
    socket.setTimeout(60000);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('harness command timed out'));
    });
    socket.on('connect', () => socket.write(`${JSON.stringify(cmd)}\n`));
    socket.on('data', (chunk) => {
      buf += chunk.toString();
    });
    socket.on('end', () => {
      try {
        resolve(JSON.parse(buf));
      } catch {
        reject(new Error(`bad harness response: ${buf}`));
      }
    });
    socket.on('error', reject);
  });
}

function commandFromArgs(parsed) {
  const [op, maybePath] = parsed.positional;
  const flags = parsed.flags;
  if (!op || op === '--help' || op === 'help') {
    process.stdout.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 22).join('\n'));
    process.stdout.write('\n');
    process.exit(0);
  }
  if (op === 'goto') {
    if (!maybePath) fail('goto needs a path, for example /quiz');
    return { op, path: maybePath };
  }
  if (op === 'click' || op === 'expect' || op === 'expect-current') {
    return {
      op,
      role: flags.role,
      name: flags.name,
      exact: Boolean(flags.exact),
      absent: Boolean(flags.absent),
      waitHeading: flags['wait-heading'],
      withinRole: flags['within-role'],
      withinName: flags['within-name'],
    };
  }
  if (op === 'expect-text') return { op, text: flags.text, exact: Boolean(flags.exact) };
  if (op === 'expect-main') return { op, text: flags.text, absent: Boolean(flags.absent) };
  if (op === 'screenshot') return { op, path: flags.path, fullPage: Boolean(flags['full-page']) };
  if (op === 'snapshot' || op === 'api-log' || op === 'console-log') return { op, path: flags.path };
  if (op === 'expect-api') {
    return { op, url: flags.url, method: flags.method, status: flags.status, waitMs: flags['wait-ms'] };
  }
  if (op === 'url' || op === 'session-stop') return { op: op === 'session-stop' ? 'shutdown' : op };
  fail(`unknown command ${op}`);
}

async function main() {
  if (process.argv.includes('--serve')) {
    await serve(resolveRun());
    return;
  }
  const parsed = parseArgs(process.argv.slice(2));
  const cmd = commandFromArgs(parsed);
  const run = resolveRun();
  mkdirSync(run.evidence, { recursive: true });
  await ensureServe(run);
  const result = await call(run, cmd);
  appendFileSync(path.join(run.evidence, 'commands.log'), `${JSON.stringify({ cmd, result })}\n`);
  if (!result.ok) fail(result.error || 'command failed');
  if (result.shutdown) {
    const pid = readPid(path.join(run.state, 'harness.pid'));
    for (let attempt = 0; attempt < 50 && pidAlive(pid); attempt += 1) {
      await delay(50);
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => fail(error.message));
