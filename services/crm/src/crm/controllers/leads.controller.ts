import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { DateRangeQueryDto } from '../../common/dto/date-range-query.dto';
import { LeadsService } from '../services/leads.service';
import { LeadsByUtmSourceItemDto } from '../dto/leads-by-source-item.dto';

@Controller('api/crm/v1/leads')
@UseGuards(ApiKeyGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('by-source')
  async byUtmSource(@Query() { since, until }: DateRangeQueryDto): Promise<LeadsByUtmSourceItemDto[]> {
    return this.leadsService.getByUtmSource(since, until);
  }
}
