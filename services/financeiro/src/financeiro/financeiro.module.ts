import { Module } from '@nestjs/common';
import { VendasController } from './controllers/vendas.controller';
import { ComparativoController } from './controllers/comparativo.controller';
import { VendasService } from './services/vendas.service';
import { ComparativoService } from './services/comparativo.service';
import { VendasRepository } from './repositories/vendas.repository';
import { AdSpendRepository } from './repositories/ad-spend.repository';

@Module({
  controllers: [VendasController, ComparativoController],
  providers: [VendasService, ComparativoService, VendasRepository, AdSpendRepository],
})
export class FinanceiroModule {}
