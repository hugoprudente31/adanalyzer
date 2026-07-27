export class PipelineBoardStatusTotalDto {
  leads!: number;
  totalPrice!: number;
}

export class PipelineBoardLeadDto {
  id!: string;
  name!: string | null;
  phone!: string | null;
  price!: number;
  createdAt!: Date | null;
  updatedAt!: Date | null;
  closedAt!: Date | null;
}

export class PipelineBoardDto {
  totalsByStatus!: Record<string, PipelineBoardStatusTotalDto>;
  leadsByStatus!: Record<string, PipelineBoardLeadDto[]>;
}
