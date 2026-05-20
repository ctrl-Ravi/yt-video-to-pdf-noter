export interface LocalPreferences {
  key: string; // The primary key (always 'global')
  storageUsagePercent: number | null;
  lastQuotaCheckTimestamp: number | null;
  syncErrorCount: number;
  autoSnapEnabled: boolean;
  compactModeEnabled: boolean;
}
