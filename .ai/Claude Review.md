# Claude Code Review — forecast-kit

**Date:** 2026-06-23  
**Scope:** Full codebase review — no code changes made.  
**Focus:** DRY violations, complexity, performance, security, maintainability for AI agent use.

---

## 1. Duplicate Code

### 1a. `parseLimit` defined in two API route files

`apps/api/src/routes/markets.ts:6-11` and `apps/api/src/routes/taxonomy.ts:4-9` both contain identical implementations:

```ts
function parseLimit(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
```

**Fix:** Move to `apps/api/src/utils.ts` and import in both route files.

---

### 1b. `TaxonomySeriesRow` interface defined in two packages

`packages/db/src/taxonomy/service.ts` and `packages/providers/kalshi/src/client.ts` both export a `TaxonomySeriesRow` with the same shape. The provider-level one is used to communicate through the `TaxonomyFetcher` interface, so there's a coupling point where the definitions could diverge silently.

**Fix:** The `TaxonomyFetcher` interface in `taxonomy/service.ts` owns the contract. Either remove the one in `client.ts` and import from `service.ts`, or move `TaxonomySeriesRow` to `@forecast-kit/core`.

---

### 1c. `parseTags` JSON parsing pattern duplicated inside `TaxonomyRepository`

`packages/db/src/repositories/index.ts` — the same try/catch JSON-parse-and-filter-strings block appears twice:

- `loadSeriesMap` (lines ~399–406)
- `listSeries` (lines ~464–471)

**Fix:** Extract to a private helper: `function parseTagsJson(json: string): string[]`.

---

### 1d. Conditional spread pattern repeated 30+ times

Throughout `packages/db/src/sync/service.ts`, `apps/api/src/routes/markets.ts`, `packages/db/src/query/index.ts`, and `apps/api/src/routes/admin.ts`, almost every optional field is spread like:

```ts
...(options?.focus !== undefined ? { focus: options.focus } : {}),
...(options?.exclude !== undefined ? { exclude: options.exclude } : {}),
```

This pattern appears at least 30 times across the codebase. It's verbose, adds visual noise, and is easy to get wrong.

**Fix:** A small helper resolves this everywhere:

```ts
function pickDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
```

---

### 1e. `FOCUS_VALUES` and `MarketExportV1` duplicated between core and UI

`packages/core/src/types/index.ts` defines `Focus` and `FOCUS_VALUES`.  
`packages/core/src/export/schema.ts` defines `MarketExportV1` via Zod.  
`apps/ui/src/lib/constants.ts` manually re-defines both.

This is a known constraint of the Next.js client/server boundary. However, any change to `FOCUS_VALUES` in `core` requires a matching manual update in `apps/ui/src/lib/constants.ts`. This will eventually bite.

**Fix:** Extract a `@forecast-kit/types` package with zero runtime dependencies, shareable across the boundary.

---

## 2. Overcomplicated Code

### 2a. `TaxonomySyncService.loadSeriesMetadataMap` is a no-op wrapper

`packages/db/src/taxonomy/service.ts`:

```ts
async loadSeriesMetadataMap(provider = 'kalshi'): Promise<Map<string, SeriesMetadata>> {
  const raw = await this.repos.taxonomy.loadSeriesMap(provider);
  const map = new Map<string, SeriesMetadata>();
  for (const [ticker, metadata] of raw) {
    map.set(ticker, { category: metadata.category, tags: metadata.tags });
  }
  return map;
}
```

`TaxonomyRepository.loadSeriesMap` already returns `Map<string, { category: string; tags: string[] }>`. The re-mapping is structurally a no-op — `SeriesMetadata` is `{ category: string | null; tags: readonly string[] }`, which is compatible. The loop just copies the map.

**Fix:** Have `loadSeriesMap` return `Map<string, SeriesMetadata>` directly. Eliminate the wrapper loop.

---

### 2b. `sports` focus rule has a redundant special-case branch

`packages/core/src/focus/rules.ts:75-78`:

```ts
if (focus === 'sports' && category?.toLowerCase().includes('sport')) {
  tags.push('sports');
  continue;
}
```

The `sports` rule in `rules.json` already has `"kalshiCategories": ["Sports"]`. The `matchesCategory` helper uses `textIncludesKeyword` which does a case-insensitive substring match — identical behavior. The special-case branch produces the same result as the standard path and should be removed.

**Fix:** Remove the special-case branch. The standard rules evaluation handles it.

---

### 2c. `MarketRepository.updatePartial` does an extra SELECT

`packages/db/src/repositories/index.ts`:

```ts
const [existing] = await this._db.select({ id: markets.id }).from(markets)
  .where(eq(markets.ticker, ticker)).limit(1);
if (!existing) return null;

await this._db.update(markets).set({...}).where(eq(markets.id, existing.id));
```

This SELECT-then-UPDATE fetches the ID just to use it in the next WHERE clause. The UPDATE can filter on `ticker` directly and return the ID via `RETURNING`.

**Fix:**

```ts
const [row] = await this._db
  .update(markets)
  .set({ ...patch, updatedAt: now })
  .where(eq(markets.ticker, ticker))
  .returning({ id: markets.id });
return row?.id ?? null;
```

---

### 2d. Two `MarketQueryService` instances in `EventQueryService.listEvents`

`packages/db/src/query/index.ts` — when filters are active AND `includeMarkets` is true, two separate `new MarketQueryService(this._db)` instances are created in the same method call. Both wrap the same `_db` reference. Only one instance is needed.

---

### 2e. Admin `PUT /focus-tags` fetches the market twice

`apps/api/src/routes/admin.ts`:

```ts
const market = await app.query.markets.getMarketByTicker(ticker);   // 1st: get ID
await app.repos.marketFocusTags.replaceTags(market.id, ...);
const updated = await app.query.markets.getMarketByTicker(ticker);  // 2nd: return value
```

Two full `getMarketByTicker` calls in a single request handler.

**Fix:** Do one lightweight ID lookup, call `replaceTags`, then one full fetch for the response.

---

## 3. Performance Concerns

### 3a. `textMatchesKeyword` compiles a new `RegExp` on every call — HOT PATH

`packages/core/src/focus/rules.ts:27-30`:

```ts
function textMatchesKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
  return pattern.test(text);
}
```

Called for every market × every focus category × every keyword during sync. With 200 markets per page across multiple pages, hundreds of identical RegExp objects are compiled per sync run for the same static keyword list.

**Fix:** Pre-compile at module load time since `rules.json` is static:

```ts
const COMPILED_KEYWORD_PATTERNS: Map<Focus, RegExp[]> = new Map(
  (Object.entries(RULES) as [Focus, FocusRule][]).map(([focus, rule]) => [
    focus,
    rule.keywords.map((kw) => new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i')),
  ]),
);
```

Then `matchesKeywords` iterates `COMPILED_KEYWORD_PATTERNS.get(focus)` instead of calling `textMatchesKeyword` per keyword.

---

### 3b. N+1 query pattern in `EventQueryService.listEvents` with `includeMarkets`

`packages/db/src/query/index.ts` fires one `listMarkets` call per event on the current page:

```ts
for (const event of pageRows) {
  if (options.includeMarkets) {
    const { markets } = await marketQuery.listMarkets({ eventTicker: event.eventTicker });
  }
}
```

For a page of 20 events, that's 20+ round-trips to SQLite.

**Fix:** Collect all event tickers from `pageRows`, fetch all markets in one `inArray(markets.eventTicker, tickers)` query, group by event ticker in memory before assembling the response.

---

### 3c. `TaxonomyRepository.upsertSeries` loops individual DB operations

`packages/db/src/repositories/index.ts` issues one `INSERT ... ON CONFLICT DO UPDATE` per series row. With potentially hundreds of series, this means hundreds of individual statements in sequence.

**Fix:** Drizzle's `insert().values([...]).onConflictDoUpdate(...)` accepts an array. Batch the entire operation into one statement.

---

### 3d. `MarketFilters` fetches taxonomy on every mount with no caching

`apps/ui/src/components/MarketFilters.tsx` fires `fetchTaxonomy()` in a `useEffect` with no caching. Every time the component mounts (e.g. navigating back to the events page), the API is hit again.

**Fix:** Module-level promise cache:

```ts
let taxonomyCache: Promise<TaxonomyResponse> | null = null;
function fetchTaxonomyCached() {
  taxonomyCache ??= fetchTaxonomy().catch((err) => {
    taxonomyCache = null;
    throw err;
  });
  return taxonomyCache;
}
```

---

### 3e. `MarketDetailSheet` re-fetches on every open with no caching

`apps/ui/src/components/MarketDetailSheet.tsx` calls `Promise.all([fetchMarketDetail, fetchMarketExport])` each time the sheet opens, even for the same ticker.

**Fix:** Add a `Map<string, { detail: MarketDetail; exportData: MarketExportV1 }>` module-level cache.

---

### 3f. `eventsListCache` is unbounded

`apps/ui/src/lib/eventsListCache.ts` uses an unbounded `Map`. Every unique filter + cursor combination adds an entry that never expires or gets evicted.

**Fix:** Simple FIFO with a max size (e.g. 50 entries), or clear the cache on filter change.

---

### 3g. `KalshiClient` exponential backoff has no jitter

`packages/providers/kalshi/src/client.ts`:

```ts
const backoffMs = retryAfterMs ?? BASE_BACKOFF_MS * 2 ** attempt;
```

At `MAX_RETRIES = 5` and `BASE_BACKOFF_MS = 500`, the last backoff is 16 seconds with no jitter. Low-priority for local use, but worth noting for long sync runs under a flaky network.

---

## 4. Code Quality / Maintainability

### 4a. `useEventListParams` exposes `setCursorStack` that no consumer uses

`apps/ui/src/hooks/useEventListParams.ts` returns `setCursorStack` in its public API. The only consumer (`EventsPageClient.tsx`) does not destructure it. Dead API surface that could mislead an AI agent.

**Fix:** Remove from the return type, or add a comment if intentional for future use.

---

### 4b. `createDatabase` does not enable `PRAGMA foreign_keys`

`packages/db/src/client.ts`:

```ts
sqlite.run('PRAGMA journal_mode = WAL;');
// missing: sqlite.run('PRAGMA foreign_keys = ON;');
```

SQLite disables FK enforcement by default. The schema defines FK constraints (e.g. `market_sides.market_id → markets.id`), but they are silently ignored at runtime. Orphaned `market_sides` rows can accumulate without error.

**Fix:** Add `sqlite.run('PRAGMA foreign_keys = ON;');` directly after the WAL pragma.

---

### 4c. `SyncAdminDialog.handleSync` is not wrapped in `useCallback`

`apps/ui/src/components/SyncAdminDialog.tsx` declares `handleSync` as a plain `async function` inside the component body, inconsistent with the rest of the file's patterns. Currently harmless (state values are read fresh on each call), but could confuse AI agents making targeted edits.

---

### 4d. `MarketStatus` type leaks Kalshi-specific `'active'` into core

`packages/core/src/types/index.ts`:

```ts
export type MarketStatus = 'open' | 'closed' | 'settled' | 'unopened' | 'active';
```

`'active'` is Kalshi-specific. When Polymarket is implemented, its status vocabulary will differ and the core domain type will need revisiting.

---

### 4e. `buildMarketExport` Zod-parses after a `satisfies` compile-time check

`packages/core/src/export/build.ts`:

```ts
const doc = { ... } satisfies MarketExportV1;
return marketExportV1Schema.parse(doc);
```

`satisfies` guarantees correctness at compile time; the runtime `parse` is redundant unless the TS types and Zod schema drift apart. Either remove the runtime parse, or add a comment marking it as intentional defense-in-depth.

---

## 5. Security Notes (local-only context)

These are noted for completeness; none are blockers for local use.

- **No auth on admin routes** (`PATCH /admin/markets`, `PUT /admin/markets/*/focus-tags`): Intentional for local. Add HTTP basic auth before any remote exposure.
- **`rawJson` returned verbatim**: Rendered in a `<pre>` block as text nodes — safe as-is.
- **`window.open` with `noopener,noreferrer`**: `MarketDetailSheet.tsx` handles this correctly. ✓
- **Drizzle parameterizes all queries**: The raw `sql\`EXISTS ...\``in`query/index.ts` uses Drizzle's template literal (auto-parameterized). ✓
- **Missing `PRAGMA foreign_keys = ON`**: Not a security issue but a data integrity issue (see §4b above).

---

## 6. Priority Table for AI Agent Edits

| Priority   | Issue                                              | Primary File(s)                            |
| ---------- | -------------------------------------------------- | ------------------------------------------ |
| **High**   | Pre-compile `textMatchesKeyword` RegExp patterns   | `core/src/focus/rules.ts`                  |
| **High**   | Extract `parseLimit` duplication                   | `api/src/routes/markets.ts`, `taxonomy.ts` |
| **High**   | Extract `parseTags` JSON parse helper              | `db/src/repositories/index.ts`             |
| **High**   | Enable `PRAGMA foreign_keys = ON`                  | `db/src/client.ts`                         |
| **Medium** | Eliminate no-op `loadSeriesMetadataMap` wrapper    | `db/src/taxonomy/service.ts`               |
| **Medium** | Fix `updatePartial` extra SELECT                   | `db/src/repositories/index.ts`             |
| **Medium** | Batch `upsertSeries` loop                          | `db/src/repositories/index.ts`             |
| **Medium** | Fix N+1 in `listEvents` with `includeMarkets`      | `db/src/query/index.ts`                    |
| **Medium** | Cache taxonomy in `MarketFilters`                  | `ui/src/components/MarketFilters.tsx`      |
| **Medium** | Remove redundant `sports` special-case branch      | `core/src/focus/rules.ts`                  |
| **Low**    | Cap `eventsListCache` size                         | `ui/src/lib/eventsListCache.ts`            |
| **Low**    | Cache market detail/export in `MarketDetailSheet`  | `ui/src/components/MarketDetailSheet.tsx`  |
| **Low**    | Remove dead `setCursorStack` from hook return      | `ui/src/hooks/useEventListParams.ts`       |
| **Low**    | Fix double-fetch in `PUT /focus-tags`              | `api/src/routes/admin.ts`                  |
| **Low**    | Consolidate conditional spread pattern with helper | Throughout sync/query/routes               |
| **Low**    | Plan dedup of `FOCUS_VALUES` / `MarketExportV1`    | `core`, `ui/src/lib/constants.ts`          |
