export class SyncStatusDto {
  synced!: boolean;
  leads!: number;
  contacts!: number;
  lastSyncAt!: Date | null;
}
