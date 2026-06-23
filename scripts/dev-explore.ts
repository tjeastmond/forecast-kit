#!/usr/bin/env bun
import { execSync, spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

interface ManagedProcess {
  readonly label: string;
  readonly child: ChildProcess;
}

const ROOT = path.resolve(import.meta.dirname, '..');
const UI_DIR = path.join(ROOT, 'apps/ui');
const NEXT_DIR = path.join(UI_DIR, '.next');
const children: ManagedProcess[] = [];
let shuttingDown = false;

function cleanNextDir(): void {
  if (!existsSync(NEXT_DIR)) {
    return;
  }

  rmSync(NEXT_DIR, { recursive: true, force: true });
  console.log('Removed apps/ui/.next');
}

function listChildPids(pid: number): number[] {
  if (process.platform === 'win32') {
    return [];
  }

  try {
    const output = execSync(`pgrep -P ${pid}`, { encoding: 'utf8' }).trim();
    if (!output) {
      return [];
    }

    return output
      .split('\n')
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isFinite);
  } catch {
    return [];
  }
}

function killProcessTree(pid: number, signal: NodeJS.Signals): void {
  for (const childPid of listChildPids(pid)) {
    killProcessTree(childPid, signal);
  }

  try {
    process.kill(pid, signal);
  } catch {
    // process already exited
  }
}

function spawnChild(label: string, command: string, args: string[], cwd = ROOT): ChildProcess {
  console.log(`[${label}] starting`);

  const child = nodeSpawn(command, args, {
    cwd,
    stdio: 'inherit',
  });

  children.push({ label, child });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = code ?? (signal ? 1 : 0);
    console.log(`[${label}] exited (${signal ?? exitCode})`);
    void shutdown(exitCode);
  });

  return child;
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return true;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);

    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log('Shutting down API and UI...');

  for (const { child } of children) {
    if (child.pid) {
      killProcessTree(child.pid, 'SIGTERM');
      continue;
    }

    child.kill('SIGTERM');
  }

  await Promise.all(
    children.map(async ({ child }) => {
      const exited = await waitForChildExit(child, 5000);
      if (!exited && child.pid) {
        killProcessTree(child.pid, 'SIGKILL');
        await waitForChildExit(child, 1000);
      }
    }),
  );

  process.exit(exitCode);
}

function onSignal(signal: NodeJS.Signals): void {
  console.log(`\nReceived ${signal}, shutting down API and UI...`);
  void shutdown(0);
}

process.on('SIGTERM', () => onSignal('SIGTERM'));
process.on('SIGINT', () => onSignal('SIGINT'));

cleanNextDir();

spawnChild('api', process.execPath, ['apps/api/src/index.ts']);
spawnChild('ui', process.execPath, ['run', 'dev'], UI_DIR);

await Promise.all(
  children.map(
    ({ child }) =>
      new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
      }),
  ),
);

if (!shuttingDown) {
  const failed = children.some(({ child }) => (child.exitCode ?? 0) !== 0);
  process.exit(failed ? 1 : 0);
}
