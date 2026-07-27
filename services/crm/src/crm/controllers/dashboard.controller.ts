import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { DashboardService } from '../services/dashboard.service';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';

@Controller('api/crm/v1/dashboard')
@UseGuards(ApiKeyGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async summary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }
}
