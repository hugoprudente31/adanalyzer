import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PipelineRow {
  id: bigint;
  name: string | null;
  sort: number | null;
}

export interface PipelineStatusRow {
  id: bigint;
  pipelineId: bigint | null;
  name: string | null;
  sort: number | null;
  color: string | null;
}

/**
 * Porta de src/services/kommoDb.service.js → getPipelinesWithStages().
 * Usa os modelos Prisma direto (findMany), sem SQL cru — não há join/agregação aqui.
 */
@Injectable()
export class KommoPipelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPipelines(): Promise<PipelineRow[]> {
    return this.prisma.kommoPipeline.findMany({
      select: { id: true, name: true, sort: true },
      orderBy: { sort: 'asc' },
    });
  }

  async findAllStatuses(): Promise<PipelineStatusRow[]> {
    return this.prisma.kommoPipelineStatus.findMany({
      select: { id: true, pipelineId: true, name: true, sort: true, color: true },
      orderBy: [{ pipelineId: 'asc' }, { sort: 'asc' }],
    });
  }
}
