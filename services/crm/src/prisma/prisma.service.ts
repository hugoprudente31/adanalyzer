import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Conexão única com o mesmo Postgres já usado pelo app Express (src/services/db.js).
 * Este serviço é somente leitura — nenhum método de escrita é chamado em lugar
 * nenhum do módulo CRM (ver README.md, seção "Fora de escopo").
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao Postgres.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
