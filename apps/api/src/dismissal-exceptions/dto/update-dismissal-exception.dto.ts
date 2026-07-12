import { IsDateString, IsMilitaryTime, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDismissalExceptionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  level?: string | null;

  @IsOptional()
  @IsMilitaryTime()
  time?: string;
}
