import { Module } from '@nestjs/common';
import { StatusController } from './controllers/status.controller';
import { FunnelController } from './controllers/funnel.controller';
import { LeadsController } from './controllers/leads.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { PipelinesController } from './controllers/pipelines.controller';
import { StatusService } from './services/status.service';
import { FunnelService } from './services/funnel.service';
import { LeadsService } from './services/leads.service';
import { DashboardService } from './services/dashboard.service';
import { PipelinesService } from './services/pipelines.service';
import { KommoLeadRepository } from './repositories/kommo-lead.repository';
import { KommoPipelineRepository } from './repositories/kommo-pipeline.repository';
import { KommoContactRepository } from './repositories/kommo-contact.repository';

@Module({
  controllers: [StatusController, FunnelController, LeadsController, DashboardController, PipelinesController],
  providers: [
    StatusService,
    FunnelService,
    LeadsService,
    DashboardService,
    PipelinesService,
    KommoLeadRepository,
    KommoPipelineRepository,
    KommoContactRepository,
  ],
})
export class CrmModule {}
