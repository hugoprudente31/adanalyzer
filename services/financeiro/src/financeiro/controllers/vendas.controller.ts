import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { VendasService } from '../services/vendas.service';
import { VendasResumoDto } from '../dto/vendas-resumo.dto';
import { VendasAgrupadasItemDto } from '../dto/vendas-agrupadas-item.dto';
import { DescontosDto } from '../dto/descontos.dto';
import { VendaListagemDto } from '../dto/venda-listagem.dto';

@Controller('api/financeiro/v1/vendas')
@UseGuards(ApiKeyGuard)
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Get('resumo')
  async resumo(@Query() { since, until }: DateRangeQueryDto): Promise<VendasResumoDto> {
    return this.vendasService.resumo({ since, until });
  }

  @Get('por-loja')
  async porLoja(@Query() { since, until }: DateRangeQueryDto): Promise<VendasAgrupadasItemDto[]> {
    return this.vendasService.porLoja({ since, until });
  }

  @Get('por-vendedor')
  async porVendedor(
    @Query() { since, until }: DateRangeQueryDto,
    @Query('agrupar') agrupar?: string,
  ): Promise<VendasAgrupadasItemDto[]> {
    return agrupar === 'consultor'
      ? this.vendasService.porConsultor({ since, until })
      : this.vendasService.porVendedor({ since, until });
  }

  @Get('descontos')
  async descontos(@Query() { since, until }: DateRangeQueryDto): Promise<DescontosDto> {
    return this.vendasService.descontos({ since, until });
  }

  @Get()
  async listar(
    @Query() { since, until }: DateRangeQueryDto,
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<VendaListagemDto> {
    return this.vendasService.listar({ since, until }, page, limit);
  }
}
