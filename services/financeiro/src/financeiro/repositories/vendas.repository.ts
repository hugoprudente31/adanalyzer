import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface DateRange {
  since?: string;
  until?: string;
}

function dateFilter({ since, until }: DateRange): Prisma.FinanceiroVendaWhereInput['dataAgendamento'] {
  if (!since && !until) return undefined;
  return {
    ...(since ? { gte: new Date(since) } : {}),
    ...(until ? { lte: new Date(until) } : {}),
  };
}

/**
 * Só vendas com valor real registrado — um agendamento sem venda_venda
 * preenchido não é uma venda, é só um agendamento que não converteu.
 */
function comVendaWhere(range: DateRange): Prisma.FinanceiroVendaWhereInput {
  return { valorVenda: { gt: 0 }, dataAgendamento: dateFilter(range) };
}

@Injectable()
export class VendasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(range: DateRange): Promise<{ totalVendas: number; receita: Prisma.Decimal | null }> {
    const agg = await this.prisma.financeiroVenda.aggregate({
      where: comVendaWhere(range),
      _sum: { valorVenda: true },
      _count: { _all: true },
    });
    return { totalVendas: agg._count._all, receita: agg._sum.valorVenda };
  }

  async porLoja(range: DateRange) {
    return this.prisma.financeiroVenda.groupBy({
      by: ['loja'],
      where: comVendaWhere(range),
      _sum: { valorVenda: true },
      _count: { _all: true },
      orderBy: { _sum: { valorVenda: 'desc' } },
    });
  }

  async porVendedor(range: DateRange) {
    return this.prisma.financeiroVenda.groupBy({
      by: ['vendedorNome'],
      where: comVendaWhere(range),
      _sum: { valorVenda: true },
      _count: { _all: true },
      orderBy: { _sum: { valorVenda: 'desc' } },
    });
  }

  async porConsultor(range: DateRange) {
    return this.prisma.financeiroVenda.groupBy({
      by: ['consultorResponsavel'],
      where: comVendaWhere(range),
      _sum: { valorVenda: true },
      _count: { _all: true },
      orderBy: { _sum: { valorVenda: 'desc' } },
    });
  }

  async descontos(range: DateRange): Promise<{ qtd: number; total: Prisma.Decimal | null }> {
    const agg = await this.prisma.financeiroVenda.aggregate({
      where: { ...comVendaWhere(range), desconto: { gt: 0 } },
      _sum: { desconto: true },
      _count: { _all: true },
    });
    return { qtd: agg._count._all, total: agg._sum.desconto };
  }

  async listar(range: DateRange, page: number, limit: number) {
    const where = comVendaWhere(range);
    const [total, itens] = await Promise.all([
      this.prisma.financeiroVenda.count({ where }),
      this.prisma.financeiroVenda.findMany({
        where,
        orderBy: { dataAgendamento: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, itens };
  }
}
