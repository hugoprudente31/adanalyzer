import { Injectable } from '@nestjs/common';
import { KommoLeadRepository } from '../repositories/kommo-lead.repository';
import { LeadsByUtmSourceItemDto } from '../dto/leads-by-source-item.dto';

/**
 * Porta de src/services/kommoDb.service.js → getLeadsByUtmSource().
 */
@Injectable()
export class LeadsService {
  constructor(private readonly leadRepository: KommoLeadRepository) {}

  async getByUtmSource(since?: string, until?: string): Promise<LeadsByUtmSourceItemDto[]> {
    const rows = await this.leadRepository.getLeadsByUtmSource(since, until);
    return rows.map((r) => ({
      utmSource: r.utm_source,
      utmCampaign: r.utm_campaign,
      leads: Number(r.leads),
      totalPrice: r.total_price?.toNumber() ?? 0,
    }));
  }
}
