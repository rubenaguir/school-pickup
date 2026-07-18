import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

// The contract's only documented invalid vehicle combination is vehicleId
// together with vehicleDescription/vehiclePlate (catalog vs. free-capture are
// mutually exclusive). Attaching to vehicleId (always optional, so @IsOptional
// alone wouldn't skip this check when vehicleId is absent) mirrors the
// exactlyOneOf pattern in create-enrollment.dto.ts.
@ValidatorConstraint({ name: 'notVehicleIdWithFreeCaptureFields', async: false })
class NotVehicleIdWithFreeCaptureFieldsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreatePickupRequestDto;
    return !(
      dto.vehicleId !== undefined &&
      (dto.vehicleDescription !== undefined || dto.vehiclePlate !== undefined)
    );
  }

  defaultMessage(): string {
    return 'vehicleId cannot be combined with vehicleDescription or vehiclePlate.';
  }
}

// arrivalMode, vehicleId, vehicleDescription and vehiclePlate are all
// @IsOptional(), so a constraint attached to any one of them is skipped by
// class-validator whenever that specific field is undefined — exactly the
// case this needs to catch (walking + vehicleDescription/vehiclePlate,
// without vehicleId). Attaching to enrollmentId (never optional, so never
// skipped) is the same workaround NotVehicleIdWithFreeCaptureFieldsConstraint
// and create-enrollment.dto.ts's exactlyOneOf constraint already use.
@ValidatorConstraint({ name: 'noVehicleFieldsWhenWalking', async: false })
class NoVehicleFieldsWhenWalkingConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreatePickupRequestDto;
    if (dto.arrivalMode !== 'walking') {
      return true;
    }
    return (
      dto.vehicleId === undefined &&
      dto.vehicleDescription === undefined &&
      dto.vehiclePlate === undefined
    );
  }

  defaultMessage(): string {
    return 'arrivalMode "walking" cannot be combined with vehicleId, vehicleDescription, or vehiclePlate.';
  }
}

export class CreatePickupRequestDto {
  @IsUUID()
  @Validate(NoVehicleFieldsWhenWalkingConstraint)
  enrollmentId!: string;

  @IsOptional()
  @IsIn(['vehicle', 'walking'])
  arrivalMode?: 'vehicle' | 'walking' | null;

  @IsOptional()
  @IsUUID()
  @Validate(NotVehicleIdWithFreeCaptureFieldsConstraint)
  vehicleId?: string;

  @IsOptional()
  @IsString()
  vehicleDescription?: string;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;
}
