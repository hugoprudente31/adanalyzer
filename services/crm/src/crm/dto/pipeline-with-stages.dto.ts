export class PipelineStageDto {
  id!: string;
  name!: string | null;
  color!: string | null;
  isWon!: boolean;
  isLost!: boolean;
}

export class PipelineWithStagesDto {
  id!: string;
  name!: string | null;
  statuses!: PipelineStageDto[];
}
