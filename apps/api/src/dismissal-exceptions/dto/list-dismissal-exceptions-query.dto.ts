import { IsDateString, IsOptional } from 'class-validator';

export class ListDismissalExceptionsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
