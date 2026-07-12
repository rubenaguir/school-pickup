import { IsInt, IsMilitaryTime, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateDismissalWindowDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsMilitaryTime()
  startTime!: string;

  @IsMilitaryTime()
  endTime!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsOptional()
  @IsString()
  level?: string | null;
}
