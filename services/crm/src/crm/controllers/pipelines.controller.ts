import { BadRequestException, Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PipelinesService } from '../services/pipelines.service';
import { PipelineWithStagesDto } from '../dto/pipeline-with-stages.dto';
import { PipelineBoardDto } from '../dto/pipeline-board.dto';

const DEFAULT_SAMPLE_SIZE = 25;

function parsePipelineId(idParam: string): bigint {
  try {
    return BigInt(idParam);
  } catch {
    throw new BadRequestException(`Id de pipeline inválido: "${idParam}".`);
  }
}

function parseSampleSize(sampleSizeParam?: string): number {
  if (!sampleSizeParam) return DEFAULT_SAMPLE_SIZE;
  const parsed = Number(sampleSizeParam);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`sampleSize inválido: "${sampleSizeParam}".`);
  }
  return parsed;
}

@Controller('api/crm/v1/pipelines')
@UseGuards(ApiKeyGuard)
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  async list(): Promise<PipelineWithStagesDto[]> {
    return this.pipelinesService.getPipelinesWithStages();
  }

  @Get(':id/board')
  async board(@Param('id') id: string, @Query('sampleSize') sampleSizeParam?: string): Promise<PipelineBoardDto> {
    const board = await this.pipelinesService.getBoard(parsePipelineId(id), parseSampleSize(sampleSizeParam));
    if (Object.keys(board.totalsByStatus).length === 0 && Object.keys(board.leadsByStatus).length === 0) {
      throw new NotFoundException('Funil não encontrado ou ainda não sincronizado.');
    }
    return board;
  }
}
