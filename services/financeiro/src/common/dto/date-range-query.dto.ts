import { IsDateString, IsOptional } from 'class-validator';

/**
 * Espelha os parâmetros ?since=&until= já usados em services/crm.
 */
export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  since?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
