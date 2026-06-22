import { loadConfig, parseFocusList } from '@forcast-kit/core';
import { createDatabase, createQueryServices } from '@forcast-kit/db';
import { getFlagString, type ParsedArgs } from '../args.js';
import type { CommandResult } from './index.js';

export async function runListCommand(args: ParsedArgs): Promise<CommandResult> {
  const config = loadConfig();
  const db = createDatabase(config.FORCAST_KIT_DB_PATH);
  const query = createQueryServices(db);

  const focus = parseFocusList(getFlagString(args.flags, 'focus'));
  const exclude = parseFocusList(getFlagString(args.flags, 'exclude'));
  const status = getFlagString(args.flags, 'status');
  const limitFlag = getFlagString(args.flags, 'limit');
  const limit = limitFlag ? Number.parseInt(limitFlag, 10) : 50;

  const { markets } = await query.markets.listMarkets({
    ...(focus.length > 0 ? { focus } : {}),
    ...(exclude.length > 0 ? { exclude } : {}),
    ...(status !== undefined ? { status } : {}),
    limit: Number.isFinite(limit) ? limit : 50,
  });

  if (markets.length === 0) {
    return { exitCode: 0, message: 'No markets found.' };
  }

  const lines = markets.map(
    (market) =>
      `${market.ticker.padEnd(24)} ${market.status.padEnd(8)} ${market.focusTags.join(',') || '-'}  ${market.title}`,
  );

  return {
    exitCode: 0,
    message: [`TICKER                   STATUS   FOCUS     TITLE`, ...lines].join('\n'),
  };
}

export async function runInspectCommand(args: ParsedArgs): Promise<CommandResult> {
  const ticker = args.subcommand ?? args.positional[0];
  if (!ticker) {
    return { exitCode: 1, message: 'inspect: missing ticker argument' };
  }

  const config = loadConfig();
  const db = createDatabase(config.FORCAST_KIT_DB_PATH);
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
