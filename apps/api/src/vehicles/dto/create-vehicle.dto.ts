import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  plate!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
