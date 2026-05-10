import { PartialType } from '@nestjs/mapped-types';
import { CreateResultPatternDto } from './create-result-pattern.dto';

export class UpdateResultPatternDto extends PartialType(CreateResultPatternDto) {}
