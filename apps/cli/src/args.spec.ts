import { describe, expect, it } from 'vitest';
import { hasFlag, parseArgs } from './args.js';
import { runCommand } from './commands/index.js';

describe('parseArgs', () => {
  it('parses command and subcommand', () => {
    expect(parseArgs(['sync', 'kalshi'])).toEqual({
      command: 'sync',
      subcommand: 'kalshi',
      positional: [],
      flags: {},
    });
  });

  it('parses string and boolean flags', () => {
    const args = parseArgs(['list', '--focus', 'politics,weather', '--no-ui']);
    expect(args.flags['focus']).toBe('politics,weather');
    expect(args.flags['no-ui']).toBe(true);
  });

  it('parses exclude flag', () => {
    const args = parseArgs(['sync', 'kalshi', '--exclude', 'sports']);
    expect(args.flags['exclude']).toBe('sports');
  });

  it('parses inspect ticker as subcommand', () => {
    const args = parseArgs(['inspect', 'KXPRES-24-DEM']);
    expect(args.command).toBe('inspect');
    expect(args.subcommand).toBe('KXPRES-24-DEM');
  });

  it('parses short help flag', () => {
    const args = parseArgs(['-h']);
    expect(hasFlag(args.flags, 'h')).toBe(true);
  });

  it('parses full sync flag', () => {
    const args = parseArgs(['sync', 'kalshi', '--full']);
    expect(args.flags['full']).toBe(true);
  });
});

describe('runCommand', () => {
  it('returns help for unknown commands', async () => {
    const result = await runCommand(parseArgs(['not-a-command']));
    expect(result.exitCode).toBe(1);
    expect(result.message).toContain('Unknown command: not-a-command');
    expect(result.message).toContain('forecast-kit sync kalshi');
  });

  it('returns help text for --help', async () => {
    const result = await runCommand(parseArgs(['--help']));
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('forecast-kit events');
  });
});
