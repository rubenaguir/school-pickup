import { Equals, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterGuardianDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone!: string | null;

  // ADR-099: must be exactly `true`, not merely truthy — absent or `false`
  // falls into the existing 400 INVALID_PAYLOAD, no new error code.
  @Equals(true)
  acceptedPrivacyNotice!: true;
}
