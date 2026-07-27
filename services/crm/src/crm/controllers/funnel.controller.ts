import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { FunnelService } from '../services/funnel.service';
import { FunnelSummaryItemDto } from '../dto/funnel-summary-item.dto';

@Controller('api/crm/v1/funnel')
@UseGuards(ApiKeyGuard)
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  @Get()
  async get(@Query() { since, until }: DateRangeQueryDto): Promise<FunnelSummaryItemDto[]> {
    return this.funnelService.getSummary(since, until);
  }
}
