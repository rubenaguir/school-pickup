import { SetMetadata } from '@nestjs/common';
import type { EntityTarget, ObjectLiteral } from 'typeorm';

export const INSTITUTION_RESOURCE_KEY = 'institution_resource';

export interface InstitutionResourceOptions {
  entity: EntityTarget<ObjectLiteral>;
  idParam?: string;
  institutionColumn?: string;
}

export const InstitutionResource = (options: InstitutionResourceOptions) =>
  SetMetadata(INSTITUTION_RESOURCE_KEY, options);
