import { loadConfig, parseFocusList } from '@forecast-kit/core';
import type { QueryServices } from '@forecast-kit/db/query';
import { getFlagString, type ParsedArgs } from '../args.js';
import type { CommandResult } from './index.js';

function parseLimitFlag(limitFlag: string | undefined): number {
  if (!limitFlag) {
    return 50;
  }
  const parsed = Number.parseInt(limitFlag, 10);
  return Number.isFinite(parsed) ? parsed : 50;
}

export function formatMarketList(
  markets: readonly {
    ticker: string;
    status: string;
    focusTags: readonly string[];
    title: string;
  }[],
): string {
  if (markets.length === 0) {
    return 'No markets found.';
  }

  const lines = markets.map(
    (market) =>
      `${market.ticker.padEnd(24)} ${market.status.padEnd(8)} ${market.focusTags.join(',') || '-'}  ${market.title}`,
  );

  return [`TICKER                   STATUS   FOCUS     TITLE`, ...lines].join('\n');
}

export function parseTickersFromListOutput(output: string): string[] {
  const lines = output.split('\n').slice(1);
  return lines.map((line) => line.slice(0, 24).trim()).filter((ticker) => ticker.length > 0);
}

export async function listMarketsWithQuery(query: QueryServices, args: ParsedArgs): Promise<CommandResult> {
  const focus = parseFocusList(getFlagString(args.flags, 'focus'));
  const exclude = parseFocusList(getFlagString(args.flags, 'exclude'));
  const status = getFlagString(args.flags, 'status');
  const category = getFlagString(args.flags, 'category');
  const tag = getFlagString(args.flags, 'tag');
  const limit = parseLimitFlag(getFlagString(args.flags, 'limit'));

  const { markets } = await query.markets.listMarkets({
    ...(focus.length > 0 ? { focus } : {}),
    ...(exclude.length > 0 ? { exclude } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(tag !== undefined ? { tag } : {}),
    limit,
  });

  return { exitCode: 0, message: formatMarketList(markets) };
}

export async function runListCommand(args: ParsedArgs): Promise<CommandResult> {
  const config = loadConfig();
  const { createDatabase } = await import('@forecast-kit/db');
  const { createQueryServices } = await import('@forecast-kit/db/query');
  const db = createDatabase(config.FORECAST_KIT_DB_PATH);
  const query = createQueryServices(db);
  return listMarketsWithQuery(query, args);
}

export async function runInspectCommand(args: ParsedArgs): Promise<CommandResult> {
  const ticker = args.subcommand ?? args.positional[0];
  if (!ticker) {
    return { exitCode: 1, message: 'inspect: missing ticker argument' };
  }

  const config = loadConfig();
  const { createDatabase } = await import('@forecast-kit/db');
  const { createQueryServices } = await import('@forecast-kit/db/query');
  const db = createDatabase(config.FORECAST_KIT_DB_PATH);
  const query = createQueryServices(db);

  const market = await query.markets.getMarketByTicker(ticker);
  if (!market) {
    return { exitCode: 1, message: `Market not found: ${ticker}` };
  }

  const lines = [
    `Ticker:     ${market.ticker}`,
    `Title:      ${market.title}`,
    `Status:     ${market.status}`,
    `Focus:      ${market.focusTags.join(', ') || '(none)'}`,
    `Close:      ${market.closeTime}`,
    `Volume:     ${String(market.volume)}`,
    `Last price: ${market.lastPrice !== null ? String(market.lastPrice) : 'n/a'}`,
    `Rules:      ${market.rulesPrimary ?? '(none)'}`,
  ];

  if (market.sides.length > 0) {
    lines.push('Sides:');
    for (const side of market.sides) {
      lines.push(
        `  ${side.side}: bid=${side.bid !== null ? String(side.bid) : 'n/a'} ask=${side.ask !== null ? String(side.ask) : 'n/a'}`,
      );
    }
  }

  return { exitCode: 0, message: lines.join('\n') };
}
