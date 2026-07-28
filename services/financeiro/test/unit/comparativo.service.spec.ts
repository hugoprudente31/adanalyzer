import { Prisma } from '@prisma/client';
import { ComparativoService } from '../../src/financeiro/services/comparativo.service';
import { VendasRepository } from '../../src/financeiro/repositories/vendas.repository';
import { AdSpendRepository } from '../../src/financeiro/repositories/ad-spend.repository';

function buildService(receita: number, google: number, facebook: number) {
  const vendasRepository = {
    resumo: jest.fn().mockResolvedValue({ totalVendas: 10, receita: new Prisma.Decimal(receita) }),
  } as unknown as VendasRepository;
  const adSpendRepository = {
    googleAdsSpend: jest.fn().mockResolvedValue(google),
    facebookAdsSpend: jest.fn().mockResolvedValue(facebook),
  } as unknown as AdSpendRepository;
  return new ComparativoService(vendasRepository, adSpendRepository);
}

describe('ComparativoService — receita vs. gasto de anúncios', () => {
  it('devolve receita e gasto de anúncio como números reais separados, com o total somado corretamente', async () => {
    const service = buildService(79210, 8160.44, 1200.5);
    const result = await service.receitaVsAnuncios({});

    expect(result.receita).toBe(79210);
    expect(result.gastoAnuncios.google).toBe(8160.44);
    expect(result.gastoAnuncios.facebook).toBe(1200.5);
    expect(result.gastoAnuncios.total).toBeCloseTo(9360.94, 2);
  });

  it('trava de regressão: a resposta NUNCA tem campo lucro/margem/profit — não existe custo real neste sistema', async () => {
    const service = buildService(79210, 8160.44, 1200.5);
    const result = await service.receitaVsAnuncios({});

    const chaves = JSON.stringify(result).toLowerCase();
    expect(chaves).not.toMatch(/lucro|margem|profit|margin/);
  });
});
