import { Injectable } from '@nestjs/common';
import { KommoLeadRepository } from '../repositories/kommo-lead.repository';
import { FunnelSummaryItemDto } from '../dto/funnel-summary-item.dto';

/**
 * Porta de src/services/kommoDb.service.js → getFunnelSummary().
 */
@Injectable()
export class FunnelService {
  constructor(private readonly leadRepository: KommoLeadRepository) {}

  async getSummary(since?: string, until?: string): Promise<FunnelSummaryItemDto[]> {
    const rows = await this.leadRepository.getFunnelSummary(since, until);
    return rows.map((r) => ({
      pipeline: r.pipeline_name,
      status: r.status_name,
      leads: Number(r.leads),
      totalPrice: r.total_price?.toNumber() ?? 0,
    }));
  }
}
