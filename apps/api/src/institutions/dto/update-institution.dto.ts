import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class LocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class UpdateInstitutionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @IsInt()
  geofenceRadiusMeters?: number;

  @IsOptional()
  @IsInt()
  activationRadiusMeters?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsString()
  cctCode?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levels?: string[];

  @IsOptional()
  @IsInt()
  arrivalToleranceMinutes?: number;

  @IsOptional()
  @IsInt()
  advanceNoticeMinutes?: number;

  @IsOptional()
  @IsInt()
  arrivingLeadMinutes?: number;
}
