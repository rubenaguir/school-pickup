import { IsOptional, IsUUID } from 'class-validator';

export class DeleteVehicleDto {
  @IsOptional()
  @IsUUID()
  newPrimaryVehicleId?: string;
}
