import { IsEnum, IsOptional } from 'class-validator';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week_mon_today'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d';

export class GenerateReportDto {
  @IsOptional()
  @IsEnum([
    'today',
    'yesterday',
    'this_week_mon_today',
    'last_7d',
    'last_14d',
    'last_30d',
  ])
  datePreset?: DatePreset;
}
