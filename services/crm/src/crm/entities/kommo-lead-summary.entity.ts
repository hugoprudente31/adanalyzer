import { LOST_PATTERN, WON_PATTERN } from '../constants/funnel-stage-patterns';

const THREE_DAYS_MS = 3 * 86_400_000;
const FOURTEEN_DAYS_MS = 14 * 86_400_000;

/**
 * Entidade de domínio usada só pelo cálculo do dashboard (getDashboardSummary
 * original). "Quente"/"Em risco" são heurísticas de recência real sobre
 * updated_at, não pontuação de engajamento — ver README.md.
 *
 * O parâmetro `now` é injetado (não usa Date.now() internamente) para o
 * cálculo ser testável de forma determinística — ver
 * test/unit/dashboard.service.spec.ts.
 */
export class KommoLeadSummaryEntity {
  constructor(
    public readonly statusName: string | null,
    public readonly price: number,
    public readonly updatedAt: Date | null,
  ) {}

  isWon(): boolean {
    return WON_PATTERN.test(this.statusName ?? '');
  }

  isLost(): boolean {
    return LOST_PATTERN.test(this.statusName ?? '');
  }

  private ageMs(now: number): number {
    return this.updatedAt ? now - this.updatedAt.getTime() : Infinity;
  }

  isHot(now: number): boolean {
    return this.ageMs(now) <= THREE_DAYS_MS;
  }

  isAtRisk(now: number): boolean {
    return this.ageMs(now) > FOURTEEN_DAYS_MS;
  }
}
