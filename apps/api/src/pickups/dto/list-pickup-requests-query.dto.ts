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

// "Exactly one of enrollmentId or deliveryPointId" (ADR-050 pt.6) has no
// built-in equivalent in class-validator, and unlike create-enrollment.dto.ts
// there is no always-required field to anchor the check on: both filters are
// optional in isolation. @IsOptional()/@ValidateIf() skip *every* decorator on
// their property, including a @Validate, which would silently let the "neither
// provided" case through — so enrollmentId carries no @IsOptional at all, and
// its optionality is expressed by the constraint below instead.
@ValidatorConstraint({ name: 'exactlyOneOfEnrollmentIdOrDeliveryPointId', async: false })
class ExactlyOneOfEnrollmentIdOrDeliveryPointIdConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ListPickupRequestsQueryDto;
    return (dto.enrollmentId !== undefined) !== (dto.deliveryPointId !== undefined);
  }

  defaultMessage(): string {
    return 'Exactly one of enrollmentId or deliveryPointId must be provided.';
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
  @Validate(ExactlyOneOfEnrollmentIdOrDeliveryPointIdConstraint)
  @Validate(OptionalUuidConstraint)
  enrollmentId?: string;

  @IsOptional()
  @IsUUID()
  deliveryPointId?: string;

  @IsOptional()
  @IsIn(PICKUP_REQUEST_STATUS_VALUES)
  status?: PickupRequestStatus;

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
