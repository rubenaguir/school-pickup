import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeliveryPointDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  operatorUserId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedGroups?: string[];
}
