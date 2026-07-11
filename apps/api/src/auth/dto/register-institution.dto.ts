import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { InstitutionType } from '@casillego/shared';

const INSTITUTION_TYPE_VALUES: readonly InstitutionType[] = ['school', 'extracurricular'];

class LocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

class InstitutionPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(INSTITUTION_TYPE_VALUES)
  type!: InstitutionType;

  @IsOptional()
  @IsString()
  category!: string | null;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;

  @IsString()
  @IsNotEmpty()
  timezone!: string;
}

class AdminPayloadDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone!: string | null;
}

export class RegisterInstitutionDto {
  @ValidateNested()
  @Type(() => InstitutionPayloadDto)
  institution!: InstitutionPayloadDto;

  @ValidateNested()
  @Type(() => AdminPayloadDto)
  admin!: AdminPayloadDto;
}
