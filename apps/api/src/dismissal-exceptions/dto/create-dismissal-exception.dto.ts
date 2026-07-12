import { IsDateString, IsMilitaryTime, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDismissalExceptionDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  level?: string | null;

  @IsMilitaryTime()
  time!: string;
}
