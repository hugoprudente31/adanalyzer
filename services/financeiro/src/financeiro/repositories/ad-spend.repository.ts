import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateRange } from './vendas.repository';

/**
 * Lê as tabelas de marketing (Google Ads / Facebook Ads, replicadas pelo
 * Kondado) que vivem no MESMO Postgres mas pertencem a outro domínio — por
 * isso não são modeladas no prisma/schema.prisma deste serviço (mesma
 * decisão já tomada no módulo CRM). Mesmas colunas/queries já usadas e
 * verificadas em src/services/marketingDb.service.js na raiz do repositório.
 *
 * Datas em formato YYYY-MM-DD; se ausentes, usa os últimos 30 dias — mesmo
 * default do marketingDb.service.js original.
 */
function resolveRange({ since, until }: DateRange): { since: string; until: string } {
  if (since && until) return { since, until };
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 30);
  return { since: fmt(start), until: fmt(today) };
}

@Injectable()
export class AdSpendRepository {
  constructor(private readonly prisma: PrismaService) {}

  async googleAdsSpend(range: DateRange): Promise<number> {
    const { since, until } = resolveRange(range);
    // metrics_cost é double precision no Postgres — Prisma mapeia pra number, não Decimal.
    const [row] = await this.prisma.$queryRaw<{ total: number | null }[]>`
      SELECT SUM(metrics_cost) AS total
      FROM googleads_custom_report_banco_de_dados
      WHERE segments_date BETWEEN ${since}::date AND ${until}::date
    `;
    return row?.total ?? 0;
  }

  async facebookAdsSpend(range: DateRange): Promise<number> {
    const { since, until } = resolveRange(range);
    // spend também é double precision — mesmo motivo do Google Ads acima.
    const [row] = await this.prisma.$queryRaw<{ total: number | null }[]>`
      SELECT SUM(spend) AS total
      FROM facebook_campaign_insights
      WHERE metric_date BETWEEN ${since}::date AND ${until}::date
    `;
    return row?.total ?? 0;
  }
}
