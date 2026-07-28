import { Injectable } from '@nestjs/common';
import { DateRange, VendasRepository } from '../repositories/vendas.repository';
import { VendasResumoDto } from '../dto/vendas-resumo.dto';
import { VendasAgrupadasItemDto } from '../dto/vendas-agrupadas-item.dto';
import { DescontosDto } from '../dto/descontos.dto';
import { VendaListagemDto } from '../dto/venda-listagem.dto';

const NAO_INFORMADO = 'Não informado';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

/** Divisão segura — 0 vendas devolve 0, nunca NaN/Infinity. */
function safeDivide(total: number, qtd: number): number {
  return qtd > 0 ? total / qtd : 0;
}

@Injectable()
export class VendasService {
  constructor(private readonly vendasRepository: VendasRepository) {}

  async resumo(range: DateRange): Promise<VendasResumoDto> {
    const { totalVendas, receita: receitaDecimal } = await this.vendasRepository.resumo(range);
    const receita = receitaDecimal?.toNumber() ?? 0;
    return { totalVendas, receita, ticketMedio: safeDivide(receita, totalVendas) };
  }

  async porLoja(range: DateRange): Promise<VendasAgrupadasItemDto[]> {
    const rows = await this.vendasRepository.porLoja(range);
    return rows.map((r) => ({
      chave: r.loja?.trim() || NAO_INFORMADO,
      totalVendas: r._count._all,
      receita: r._sum.valorVenda?.toNumber() ?? 0,
    }));
  }

  async porVendedor(range: DateRange): Promise<VendasAgrupadasItemDto[]> {
    const rows = await this.vendasRepository.porVendedor(range);
    return rows.map((r) => ({
      chave: r.vendedorNome?.trim() || NAO_INFORMADO,
      totalVendas: r._count._all,
      receita: r._sum.valorVenda?.toNumber() ?? 0,
    }));
  }

  async porConsultor(range: DateRange): Promise<VendasAgrupadasItemDto[]> {
    const rows = await this.vendasRepository.porConsultor(range);
    return rows.map((r) => ({
      chave: r.consultorResponsavel?.trim() || NAO_INFORMADO,
      totalVendas: r._count._all,
      receita: r._sum.valorVenda?.toNumber() ?? 0,
    }));
  }

  async descontos(range: DateRange): Promise<DescontosDto> {
    const { qtd, total: totalDecimal } = await this.vendasRepository.descontos(range);
    const totalDesconto = totalDecimal?.toNumber() ?? 0;
    return { qtdVendasComDesconto: qtd, totalDesconto, descontoMedio: safeDivide(totalDesconto, qtd) };
  }

  async listar(range: DateRange, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT): Promise<VendaListagemDto> {
    const { total, itens } = await this.vendasRepository.listar(range, page, limit);
    return {
      total,
      page,
      limit,
      itens: itens.map((v) => ({
        id: v.id,
        clienteNome: v.clienteNome,
        loja: v.loja,
        vendedorNome: v.vendedorNome,
        consultorResponsavel: v.consultorResponsavel,
        valorVenda: v.valorVenda?.toNumber() ?? 0,
        desconto: v.desconto?.toNumber() ?? 0,
        statusOs: v.statusOs,
        numeroOs: v.numeroOs,
        dataAgendamento: v.dataAgendamento,
      })),
    };
  }
}
