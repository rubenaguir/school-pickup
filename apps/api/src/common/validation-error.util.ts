import type { ValidationError } from '@nestjs/common';

export interface InvalidPayloadDetail {
  property: string;
  constraints: string[];
}

// Only maps the top-level array — none of this project's DTOs validate
// nested objects, so ValidationError.children is never populated in practice.
export function toInvalidPayloadDetails(errors: ValidationError[]): InvalidPayloadDetail[] {
  return errors.map((error) => ({
    property: error.property,
    constraints: Object.values(error.constraints ?? {}),
  }));
}
