import { Injectable } from '@nestjs/common';
import { KommoLeadRepository } from '../repositories/kommo-lead.repository';
import { KommoPipelineRepository } from '../repositories/kommo-pipeline.repository';
import { KommoPipelineStatusEntity } from '../entities/kommo-pipeline-status.entity';
import { PipelineWithStagesDto } from '../dto/pipeline-with-stages.dto';
import { PipelineBoardDto } from '../dto/pipeline-board.dto';

/**
 * Porta de src/services/kommoDb.service.js → getPipelinesWithStages() e
 * getPipelineBoard(). O quadro Kanban mostra totais reais por estágio +
 * uma amostra dos leads mais recentes (a lista completa pode ter milhares
 * de linhas — mesmo limite de 400/sampleSize do serviço original).
 */
@Injectable()
export class PipelinesService {
  constructor(
    private readonly pipelineRepository: KommoPipelineRepository,
    private readonly leadRepository: KommoLeadRepository,
  ) {}

  async getPipelinesWithStages(): Promise<PipelineWithStagesDto[]> {
    const [pipelines, statuses] = await Promise.all([
      this.pipelineRepository.findAllPipelines(),
      this.pipelineRepository.findAllStatuses(),
    ]);

    return pipelines.map((p) => ({
      id: p.id.toString(),
      name: p.name,
      statuses: statuses
        .filter((s) => s.pipelineId === p.id)
        .map((s) => {
          const entity = new KommoPipelineStatusEntity(s.id, s.pipelineId, s.name, s.sort, s.color);
          return {
            id: entity.id.toString(),
            name: entity.name,
            color: entity.color,
            isWon: entity.isWon(),
            isLost: entity.isLost(),
          };
        }),
    }));
  }

  async getBoard(pipelineId: bigint, sampleSize = 25): Promise<PipelineBoardDto> {
    const [totals, sample] = await Promise.all([
      this.leadRepository.getPipelineBoardTotals(pipelineId),
      this.leadRepository.getPipelineBoardSample(pipelineId),
    ]);

    const leadsByStatus: PipelineBoardDto['leadsByStatus'] = {};
    for (const row of sample) {
      const key = row.status_id?.toString() ?? 'null';
      (leadsByStatus[key] ??= []).push({
        id: row.id.toString(),
        name: row.contact_name || row.name,
        phone: row.contact_phone,
        price: row.price?.toNumber() ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closedAt: row.closed_at,
      });
    }
    for (const key of Object.keys(leadsByStatus)) {
      leadsByStatus[key] = leadsByStatus[key].slice(0, sampleSize);
    }

    const totalsByStatus: PipelineBoardDto['totalsByStatus'] = {};
    for (const t of totals) {
      const key = t.status_id?.toString() ?? 'null';
      totalsByStatus[key] = { leads: Number(t.leads), totalPrice: t.total_price?.toNumber() ?? 0 };
    }

    return { totalsByStatus, leadsByStatus };
  }
}
