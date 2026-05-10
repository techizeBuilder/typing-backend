import { PartialType } from '@nestjs/mapped-types';
import { CreateFlashBannerDto } from './create-flash-banner.dto';

export class UpdateFlashBannerDto extends PartialType(CreateFlashBannerDto) {}
