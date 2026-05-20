import { getDb } from '../database';
import { LocalPreferences } from '@yt-noter-pro/shared-types';

export async function readPreferences(): Promise<LocalPreferences> {
  const db = getDb();
  const prefs = await db.preferences.get('global');
  if (prefs) return prefs;
  return {
    key: 'global',
    storageUsagePercent: null,
    lastQuotaCheckTimestamp: null,
    syncErrorCount: 0,
    autoSnapEnabled: false,
    compactModeEnabled: false
  };
}

export async function writePreference<K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.preferences], async () => {
    const prefs = await readPreferences();
    prefs[key] = value as never;
    await db.preferences.put(prefs);
  });
}
