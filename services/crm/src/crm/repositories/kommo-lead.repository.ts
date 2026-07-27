import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FunnelSummaryRow {
  pipeline_name: string | null;
  status_name: string | null;
  leads: bigint;
  total_price: Prisma.Decimal | null;
}

export interface LeadsByUtmSourceRow {
  utm_source: string | null;
  utm_campaign: string | null;
  leads: bigint;
  total_price: Prisma.Decimal | null;
}

export interface PipelineBoardTotalRow {
  status_id: bigint | null;
  leads: bigint;
  total_price: Prisma.Decimal | null;
}

export interface PipelineBoardSampleRow {
  id: bigint;
  name: string | null;
  price: Prisma.Decimal | null;
  status_id: bigint | null;
  created_at: Date | null;
  updated_at: Date | null;
  closed_at: Date | null;
  contact_name: string | null;
  contact_phone: string | null;
}

export interface DashboardSummarySourceRow {
  status_name: string | null;
  price: Prisma.Decimal | null;
  updated_at: Date | null;
}

export interface SyncStatusRow {
  n: bigint;
  last: Date | null;
}

/**
 * Porta 1:1 das queries em src/services/kommoDb.service.js. As agregações que
 * usam kommo_leads.pipeline_id/status_id/main_contact_id (colunas SEM foreign
 * key real no banco — ver prisma/schema.prisma) são feitas via $queryRaw com
 * o mesmo SQL do arquivo original, em vez de tentar recriar o join pela API
 * de relação do Prisma contra uma chave que o banco não garante.
 */
@Injectable()
export class KommoLeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  private dateRangeFilter(since?: string, until?: string): Prisma.Sql {
    return since && until ? Prisma.sql`AND l.created_at BETWEEN ${since}::date AND ${until}::date` : Prisma.empty;
  }

  async getFunnelSummary(since?: string, until?: string): Promise<FunnelSummaryRow[]> {
    return this.prisma.$queryRaw<FunnelSummaryRow[]>`
      SELECT
        p.name AS pipeline_name,
        s.name AS status_name,
        COUNT(*) AS leads,
        SUM(l.price) AS total_price
      FROM kommo_leads l
      LEFT JOIN kommo_pipelines p ON p.id = l.pipeline_id
      LEFT JOIN kommo_pipeline_statuses s ON s.id = l.status_id
      WHERE l.is_deleted = false ${this.dateRangeFilter(since, until)}
      GROUP BY p.name, s.name
      ORDER BY p.name, leads DESC
    `;
  }

  async getLeadsByUtmSource(since?: string, until?: string): Promise<LeadsByUtmSourceRow[]> {
    return this.prisma.$queryRaw<LeadsByUtmSourceRow[]>`
      SELECT l.utm_source, l.utm_campaign, COUNT(*) AS leads, SUM(l.price) AS total_price
      FROM kommo_leads l
      WHERE l.utm_source IS NOT NULL AND l.is_deleted = false ${this.dateRangeFilter(since, until)}
      GROUP BY l.utm_source, l.utm_campaign
      ORDER BY leads DESC
    `;
  }

  async getPipelineBoardTotals(pipelineId: bigint): Promise<PipelineBoardTotalRow[]> {
    return this.prisma.$queryRaw<PipelineBoardTotalRow[]>`
      SELECT status_id, COUNT(*) AS leads, SUM(price) AS total_price
      FROM kommo_leads
      WHERE pipeline_id = ${pipelineId} AND is_deleted = false
      GROUP BY status_id
    `;
  }

  async getPipelineBoardSample(pipelineId: bigint): Promise<PipelineBoardSampleRow[]> {
    return this.prisma.$queryRaw<PipelineBoardSampleRow[]>`
      SELECT l.id, l.name, l.price, l.status_id, l.created_at, l.updated_at, l.closed_at,
             c.name AS contact_name, c.phone AS contact_phone
      FROM kommo_leads l
      LEFT JOIN kommo_contacts c ON c.id = l.main_contact_id
      WHERE l.pipeline_id = ${pipelineId} AND l.is_deleted = false
      ORDER BY l.updated_at DESC
      LIMIT 400
    `;
  }

  async getDashboardSummarySourceRows(): Promise<DashboardSummarySourceRow[]> {
    return this.prisma.$queryRaw<DashboardSummarySourceRow[]>`
      SELECT s.name AS status_name, l.price, l.updated_at
      FROM kommo_leads l
      LEFT JOIN kommo_pipeline_statuses s ON s.id = l.status_id
      WHERE l.is_deleted = false
    `;
  }

  async getSyncStatus(): Promise<SyncStatusRow> {
    const [row] = await this.prisma.$queryRaw<SyncStatusRow[]>`
      SELECT COUNT(*) AS n, MAX(synced_at) AS last FROM kommo_leads
    `;
    return row;
  }
}
