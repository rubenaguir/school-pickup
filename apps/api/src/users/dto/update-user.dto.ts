import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  notifyEnrollmentApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDismissalReminder?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDeliveryConfirmed?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyProductNews?: boolean;
}
