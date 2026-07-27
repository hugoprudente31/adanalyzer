import { Prisma } from '@prisma/client';
import { FunnelService } from '../../src/crm/services/funnel.service';
import { FunnelSummaryRow, KommoLeadRepository } from '../../src/crm/repositories/kommo-lead.repository';

describe('FunnelService — shape e mapeamento (repositório mockado)', () => {
  function buildService(rows: FunnelSummaryRow[]) {
    const getFunnelSummary = jest.fn().mockResolvedValue(rows);
    const leadRepository = { getFunnelSummary } as unknown as KommoLeadRepository;
    return { service: new FunnelService(leadRepository), getFunnelSummary };
  }

  it('mapeia pipeline_name/status_name/leads/total_price (snake_case do banco) para camelCase da API', async () => {
    const rows: FunnelSummaryRow[] = [
      { pipeline_name: 'TGT Gonzaga', status_name: 'Venda ganha', leads: 12n, total_price: new Prisma.Decimal(4500.5) },
    ];
    const { service } = buildService(rows);

    const result = await service.getSummary();

    expect(result).toEqual([{ pipeline: 'TGT Gonzaga', status: 'Venda ganha', leads: 12, totalPrice: 4500.5 }]);
  });

  it('trata total_price nulo (SUM sem linhas) como 0', async () => {
    const rows: FunnelSummaryRow[] = [{ pipeline_name: 'TGT Enseada', status_name: 'Novo', leads: 0n, total_price: null }];
    const { service } = buildService(rows);

    const [result] = await service.getSummary();

    expect(result.totalPrice).toBe(0);
  });

  it('repassa since/until pro repositório sem alterar', async () => {
    const { service, getFunnelSummary } = buildService([]);
    await service.getSummary('2026-01-01', '2026-01-31');
    expect(getFunnelSummary).toHaveBeenCalledWith('2026-01-01', '2026-01-31');
  });
});
