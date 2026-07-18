import { IsString, Matches } from 'class-validator';

export class DeliverPickupRequestDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'deliveryCode must be exactly 4 digits.' })
  deliveryCode!: string;
}
