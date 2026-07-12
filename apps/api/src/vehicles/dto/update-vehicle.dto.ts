import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  plate?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
