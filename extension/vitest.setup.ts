import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { getDb } from './src/db/database';

afterEach(async () => {
  const db = getDb();
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
});
