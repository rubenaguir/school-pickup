import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;
}
