import { Prisma } from '@prisma/client';
import { DashboardService } from '../../src/crm/services/dashboard.service';
import { DashboardSummarySourceRow, KommoLeadRepository } from '../../src/crm/repositories/kommo-lead.repository';

const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const days = (n: number) => new Date(NOW - n * 86_400_000);

function buildService(rows: DashboardSummarySourceRow[]): DashboardService {
  const leadRepository = {
    getDashboardSummarySourceRows: jest.fn().mockResolvedValue(rows),
  } as unknown as KommoLeadRepository;
  return new DashboardService(leadRepository);
}

describe('DashboardService — limites hot(≤3d)/at-risk(>14d), com relógio injetado (não Date.now() real)', () => {
  it('soma receita e contagem de negócios ganhos, separado dos ativos', async () => {
    const rows: DashboardSummarySourceRow[] = [
      { status_name: 'Venda ganha', price: new Prisma.Decimal(1000), updated_at: days(1) },
      { status_name: 'Venda perdida', price: new Prisma.Decimal(500), updated_at: days(1) },
      { status_name: 'Em contato', price: new Prisma.Decimal(300), updated_at: days(1) },
    ];
    const summary = await buildService(rows).getSummary(NOW);

    expect(summary.wonRevenue).toBe(1000);
    expect(summary.wonDeals).toBe(1);
    // "Venda perdida" não conta nem como ganho nem como ativo
    expect(summary.activePipelineValue).toBe(300);
    expect(summary.activeDeals).toBe(1);
  });

  it('marca como "quente" um lead ativo atualizado exatamente há 3 dias (limite inclusivo)', async () => {
    const rows: DashboardSummarySourceRow[] = [
      { status_name: 'Em contato', price: new Prisma.Decimal(100), updated_at: days(3) },
    ];
    const summary = await buildService(rows).getSummary(NOW);
    expect(summary.hotLeads).toBe(1);
    expect(summary.atRiskLeads).toBe(0);
  });

  it('não marca como "quente" um lead ativo atualizado há 3 dias e 1 minuto', async () => {
    const rows: DashboardSummarySourceRow[] = [
      { status_name: 'Em contato', price: new Prisma.Decimal(100), updated_at: new Date(NOW - (3 * 86_400_000 + 60_000)) },
    ];
    const summary = await buildService(rows).getSummary(NOW);
    expect(summary.hotLeads).toBe(0);
  });

  it('marca como "em risco" um lead ativo atualizado há mais de 14 dias', async () => {
    const rows: DashboardSummarySourceRow[] = [
      { status_name: 'Em contato', price: new Prisma.Decimal(100), updated_at: days(15) },
    ];
    const summary = await buildService(rows).getSummary(NOW);
    expect(summary.atRiskLeads).toBe(1);
    expect(summary.hotLeads).toBe(0);
  });

  it('leads ganhos/perdidos nunca contam para quente/em risco', async () => {
    const rows: DashboardSummarySourceRow[] = [
      { status_name: 'Venda ganha', price: new Prisma.Decimal(100), updated_at: days(20) },
      { status_name: 'Venda perdida', price: new Prisma.Decimal(100), updated_at: days(20) },
    ];
    const summary = await buildService(rows).getSummary(NOW);
    expect(summary.hotLeads).toBe(0);
    expect(summary.atRiskLeads).toBe(0);
  });
});
