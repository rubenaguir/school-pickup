import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  isUUID,
  Min,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import type { PickupRequestStatus } from '@casillego/shared';

const PICKUP_REQUEST_STATUS_VALUES: readonly PickupRequestStatus[] = [
  'en_route',
  'approaching',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];

// Transform (not Type) on purpose: Type registers design-type metadata via
// Reflect.getMetadata, which requires the app-wide `reflect-metadata`
// polyfill (imported once in main.ts) to already be loaded — not the case
// when this DTO is unit-tested directly with plainToInstance, outside a
// booted Nest app. Transform does its own value coercion without touching
// Reflect, so it works in both contexts.
function toOptionalNumber({ value }: { value: unknown }): number | undefined {
  return value === undefined ? undefined : Number(value);
}

// "Exactly one of enrollmentId, deliveryPointId or institutionId" (ADR-050
// pt.6, ADR-068 pt.2) has no built-in equivalent in class-validator, and
// unlike create-enrollment.dto.ts there is no always-required field to anchor
// the check on: all three filters are optional in isolation.
// @IsOptional()/@ValidateIf() skip *every* decorator on their property,
// including a @Validate, which would silently let the "none provided" case
// through — so enrollmentId carries no @IsOptional at all, and its
// optionality is expressed by the constraint below instead.
@ValidatorConstraint({
  name: 'exactlyOneOfEnrollmentIdDeliveryPointIdOrInstitutionId',
  async: false,
})
class ExactlyOneOfEnrollmentIdDeliveryPointIdOrInstitutionIdConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ListPickupRequestsQueryDto;
    const providedCount = [dto.enrollmentId, dto.deliveryPointId, dto.institutionId].filter(
      (value) => value !== undefined,
    ).length;
    return providedCount === 1;
  }

  defaultMessage(): string {
    return 'Exactly one of enrollmentId, deliveryPointId or institutionId must be provided.';
  }
}

@ValidatorConstraint({ name: 'optionalUuid', async: false })
class OptionalUuidConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return value === undefined || (typeof value === 'string' && isUUID(value));
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a UUID.`;
  }
}

export class ListPickupRequestsQueryDto {
  @Validate(ExactlyOneOfEnrollmentIdDeliveryPointIdOrInstitutionIdConstraint)
  @Validate(OptionalUuidConstraint)
  enrollmentId?: string;

  @IsOptional()
  @IsUUID()
  deliveryPointId?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsIn(PICKUP_REQUEST_STATUS_VALUES)
  status?: PickupRequestStatus;

  // A shape modifier of an institutionId-scoped request (ADR-071 pt.2, pt.5),
  // not a fourth mutually-exclusive filter — deliberately NOT wired into
  // ExactlyOneOfEnrollmentIdDeliveryPointIdOrInstitutionIdConstraint above.
  // `view` present without `institutionId` still gets rejected: that
  // constraint already requires exactly one of the three filters.
  @IsOptional()
  @IsIn(['board', 'monitor'])
  view?: 'board' | 'monitor';

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(0)
  offset?: number;
}
