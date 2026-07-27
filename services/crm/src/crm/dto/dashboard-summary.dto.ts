/**
 * hotLeads/atRiskLeads são heurísticas de recência real sobre updated_at
 * (≤3 dias / >14 dias) — não é pontuação de engajamento nem dado fabricado.
 * Ver src/services/kommoDb.service.js, getDashboardSummary().
 */
export class DashboardSummaryDto {
  activePipelineValue!: number;
  activeDeals!: number;
  wonRevenue!: number;
  wonDeals!: number;
  hotLeads!: number;
  atRiskLeads!: number;
}
