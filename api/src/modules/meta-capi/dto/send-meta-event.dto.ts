import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class SendMetaEventDto {
  @IsIn(['Lead', 'Schedule', 'Purchase'])
  eventName: 'Lead' | 'Schedule' | 'Purchase';

  /** Reenvia mesmo que o evento já tenha sido disparado para este lead. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
