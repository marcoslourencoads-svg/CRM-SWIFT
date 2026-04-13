import { PartialType } from '@nestjs/mapped-types';
import { CreateScoringRuleDto } from './create-scoring-rule.dto';

export class UpdateScoringRuleDto extends PartialType(CreateScoringRuleDto) {}
