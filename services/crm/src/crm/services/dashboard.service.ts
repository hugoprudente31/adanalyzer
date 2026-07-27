import { Injectable } from '@nestjs/common';
import { KommoLeadRepository } from '../repositories/kommo-lead.repository';
import { KommoLeadSummaryEntity } from '../entities/kommo-lead-summary.entity';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';

/**
 * Porta de src/services/kommoDb.service.js → getDashboardSummary().
 * `now` é injetável (default Date.now()) para o teste unitário poder fixar
 * um relógio determinístico — ver test/unit/dashboard.service.spec.ts.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly leadRepository: KommoLeadRepository) {}

  async getSummary(now: number = Date.now()): Promise<DashboardSummaryDto> {
    const rows = await this.leadRepository.getDashboardSummarySourceRows();

    const summary: DashboardSummaryDto = {
      activePipelineValue: 0,
      activeDeals: 0,
      wonRevenue: 0,
      wonDeals: 0,
      hotLeads: 0,
      atRiskLeads: 0,
    };

    for (const row of rows) {
      const lead = new KommoLeadSummaryEntity(row.status_name, row.price?.toNumber() ?? 0, row.updated_at);

      if (lead.isWon()) {
        summary.wonRevenue += lead.price;
        summary.wonDeals++;
      } else if (!lead.isLost()) {
        summary.activePipelineValue += lead.price;
        summary.activeDeals++;
        if (lead.isHot(now)) summary.hotLeads++;
        if (lead.isAtRisk(now)) summary.atRiskLeads++;
      }
    }

    return summary;
  }
}
