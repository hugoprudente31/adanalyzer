import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { FinanceiroModule } from './financeiro/financeiro.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, FinanceiroModule],
  controllers: [HealthController],
})
export class AppModule {}
