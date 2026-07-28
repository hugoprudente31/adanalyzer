import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { ComparativoService } from '../services/comparativo.service';
import { ComparativoDto } from '../dto/comparativo.dto';

@Controller('api/financeiro/v1/comparativo')
@UseGuards(ApiKeyGuard)
export class ComparativoController {
  constructor(private readonly comparativoService: ComparativoService) {}

  @Get('receita-vs-anuncios')
  async receitaVsAnuncios(@Query() { since, until }: DateRangeQueryDto): Promise<ComparativoDto> {
    return this.comparativoService.receitaVsAnuncios({ since, until });
  }
}
