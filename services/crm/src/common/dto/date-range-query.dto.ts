import { IsDateString, IsOptional } from 'class-validator';

/**
 * Espelha os parâmetros ?since=&until= já usados em
 * src/routes/kommoDb.routes.js (formato ISO, ex.: 2026-01-01).
 */
export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  since?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
