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

export function formatEventList(
  events: readonly { eventTicker: string; category: string | null; title: string }[],
): string {
  if (events.length === 0) {
    return 'No events found.';
  }

  const lines = events.map(
    (event) => `${event.eventTicker.padEnd(24)} ${(event.category ?? '-').padEnd(12)} ${event.title}`,
  );

  return [`EVENT_TICKER             CATEGORY     TITLE`, ...lines].join('\n');
}

export function parseEventTickersFromListOutput(output: string): string[] {
  const lines = output.split('\n').slice(1);
  return lines.map((line) => line.slice(0, 24).trim()).filter((eventTicker) => eventTicker.length > 0);
}

function formatEventDetail(event: {
  eventTicker: string;
  title: string;
  category: string | null;
  subtitle: string | null;
  markets: readonly {
    ticker: string;
    status: string;
    focusTags: readonly string[];
    title: string;
  }[];
}): string {
  const lines = [
    `Event:    ${event.eventTicker}`,
    `Title:    ${event.title}`,
    `Category: ${event.category ?? '(none)'}`,
  ];

  if (event.subtitle) {
    lines.push(`Subtitle: ${event.subtitle}`);
  }

  if (event.markets.length === 0) {
    lines.push('Markets:  (none matching filters)');
  } else {
    lines.push('Markets:');
    lines.push('  TICKER                   STATUS   FOCUS     TITLE');
    for (const market of event.markets) {
      lines.push(
        `  ${market.ticker.padEnd(24)} ${market.status.padEnd(8)} ${market.focusTags.join(',') || '-'}  ${market.title}`,
      );
    }
  }

  return lines.join('\n');
}

export async function listEventsWithQuery(query: QueryServices, args: ParsedArgs): Promise<CommandResult> {
  const eventTicker = args.subcommand ?? args.positional[0];
  const focus = parseFocusList(getFlagString(args.flags, 'focus'));
  const exclude = parseFocusList(getFlagString(args.flags, 'exclude'));
  const category = getFlagString(args.flags, 'category');
  const tag = getFlagString(args.flags, 'tag');
  const limit = parseLimitFlag(getFlagString(args.flags, 'limit'));

  if (eventTicker) {
    const event = await query.events.getEventByTicker(eventTicker, {
      ...(focus.length > 0 ? { focus } : {}),
      ...(exclude.length > 0 ? { exclude } : {}),
    });

    if (!event) {
      return { exitCode: 1, message: `Event not found: ${eventTicker}` };
    }

    return { exitCode: 0, message: formatEventDetail(event) };
  }

  const { events } = await query.events.listEvents({
    ...(focus.length > 0 ? { focus } : {}),
    ...(exclude.length > 0 ? { exclude } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(tag !== undefined ? { tag } : {}),
    limit,
  });

  const formattedEvents = events.map((event) => ({
    eventTicker: String(event['eventTicker']),
    category: typeof event['category'] === 'string' ? event['category'] : null,
    title: String(event['title']),
  }));

  return { exitCode: 0, message: formatEventList(formattedEvents) };
}

export async function runEventsCommand(args: ParsedArgs): Promise<CommandResult> {
  const config = loadConfig();
  const { createDatabase } = await import('@forecast-kit/db');
  const { createQueryServices } = await import('@forecast-kit/db/query');
  const db = createDatabase(config.FORECAST_KIT_DB_PATH);
  const query = createQueryServices(db);
  return listEventsWithQuery(query, args);
}
