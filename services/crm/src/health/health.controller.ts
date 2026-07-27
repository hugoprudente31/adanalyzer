import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Alvo de healthcheck do Railway (services/crm/railway.toml). Fica público
 * de propósito — o Railway não envia headers customizados nesse check —
 * igual ao /health e /api/status do app Express (PUBLIC_PATHS em security.js).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      return { status: 'degraded', database: 'unreachable' };
    }
  }
}
