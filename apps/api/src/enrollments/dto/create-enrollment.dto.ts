import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsUUID,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';

// class-validator has no built-in "exactly one of these two fields" check.
// @IsOptional() on institutionId/joinCode would skip a @Validate on either of
// them whenever that particular field is absent — exactly the "neither
// present" case this needs to catch. Attaching the constraint to studentId
// (always required, never skipped) makes it run unconditionally instead.
@ValidatorConstraint({ name: 'exactlyOneOfInstitutionIdOrJoinCode', async: false })
class ExactlyOneOfInstitutionIdOrJoinCodeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateEnrollmentDto;
    return (dto.institutionId !== undefined) !== (dto.joinCode !== undefined);
  }

  defaultMessage(): string {
    return 'Exactly one of institutionId or joinCode must be provided.';
  }
}

export class CreateEnrollmentDto {
  @IsUUID()
  @Validate(ExactlyOneOfInstitutionIdOrJoinCodeConstraint)
  studentId!: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  joinCode?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;
}
