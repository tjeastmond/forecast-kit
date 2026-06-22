import type { DatabaseClient } from '../client.js';

/** Repository stubs — implemented in Phase 2. */
export class EventRepository {
  constructor(private readonly _db: DatabaseClient) {}

  upsert(_event: unknown): Promise<number> {
    return Promise.reject(new Error('EventRepository.upsert not implemented'));
  }
}

export class MarketRepository {
  constructor(private readonly _db: DatabaseClient) {}

  upsert(_market: unknown): Promise<number> {
    return Promise.reject(new Error('MarketRepository.upsert not implemented'));
  }
}

export class SyncRunRepository {
  constructor(private readonly _db: DatabaseClient) {}

  create(_provider: string): Promise<number> {
    return Promise.reject(new Error('SyncRunRepository.create not implemented'));
  }
}

export function createRepositories(db: DatabaseClient) {
  return {
    events: new EventRepository(db),
    markets: new MarketRepository(db),
    syncRuns: new SyncRunRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
