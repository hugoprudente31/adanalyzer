import { Injectable } from '@nestjs/common';
import { DateRange, VendasRepository } from '../repositories/vendas.repository';
import { AdSpendRepository } from '../repositories/ad-spend.repository';
import { ComparativoDto } from '../dto/comparativo.dto';

/**
 * Receita real e gasto real de anúncio, lado a lado. NUNCA subtrai um do
 * outro — não existe custo real (folha, aluguel, CMV) neste sistema, então
 * qualquer "lucro" calculado a partir só disso seria enganoso. Ver
 * README.md, "Fora de escopo".
 */
@Injectable()
export class ComparativoService {
  constructor(
    private readonly vendasRepository: VendasRepository,
    private readonly adSpendRepository: AdSpendRepository,
  ) {}

  async receitaVsAnuncios(range: DateRange): Promise<ComparativoDto> {
    const [{ receita: receitaDecimal }, google, facebook] = await Promise.all([
      this.vendasRepository.resumo(range),
      this.adSpendRepository.googleAdsSpend(range),
      this.adSpendRepository.facebookAdsSpend(range),
    ]);

    return {
      receita: receitaDecimal?.toNumber() ?? 0,
      gastoAnuncios: { google, facebook, total: google + facebook },
    };
  }
}
