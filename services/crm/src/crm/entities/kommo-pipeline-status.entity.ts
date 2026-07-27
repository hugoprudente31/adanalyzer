import { LOST_PATTERN, WON_PATTERN } from '../constants/funnel-stage-patterns';

/**
 * Entidade de domínio para um estágio de funil. A classificação won/lost é a
 * única lógica de negócio real deste módulo — mora aqui, não espalhada pelo
 * service, para poder ser testada isoladamente (ver test/unit/pipelines.service.spec.ts).
 */
export class KommoPipelineStatusEntity {
  constructor(
    public readonly id: bigint,
    public readonly pipelineId: bigint | null,
    public readonly name: string | null,
    public readonly sort: number | null,
    public readonly color: string | null,
  ) {}

  isWon(): boolean {
    return WON_PATTERN.test(this.name ?? '');
  }

  isLost(): boolean {
    return LOST_PATTERN.test(this.name ?? '');
  }
}
