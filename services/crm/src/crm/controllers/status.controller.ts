import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { StatusService } from '../services/status.service';
import { SyncStatusDto } from '../dto/sync-status.dto';

@Controller('api/crm/v1/status')
@UseGuards(ApiKeyGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  async get(): Promise<SyncStatusDto> {
    return this.statusService.getSyncStatus();
  }
}
