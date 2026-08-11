import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class SendLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number | null;

  @IsDateString()
  recordedAt!: string;
}
