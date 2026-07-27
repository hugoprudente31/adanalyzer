import { Injectable } from '@nestjs/common';
import { KommoLeadRepository } from '../repositories/kommo-lead.repository';
import { KommoContactRepository } from '../repositories/kommo-contact.repository';
import { SyncStatusDto } from '../dto/sync-status.dto';

/**
 * Porta de src/services/kommoDb.service.js → getSyncStatus().
 */
@Injectable()
export class StatusService {
  constructor(
    private readonly leadRepository: KommoLeadRepository,
    private readonly contactRepository: KommoContactRepository,
  ) {}

  async getSyncStatus(): Promise<SyncStatusDto> {
    const [leadRow, contactsCount] = await Promise.all([
      this.leadRepository.getSyncStatus(),
      this.contactRepository.count(),
    ]);

    return {
      synced: true,
      leads: Number(leadRow.n),
      contacts: contactsCount,
      lastSyncAt: leadRow.last,
    };
  }
}
