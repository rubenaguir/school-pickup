import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  // Same rule as registration (ADR-059 point 3) — no extra complexity policy
  // invented just for this endpoint.
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
