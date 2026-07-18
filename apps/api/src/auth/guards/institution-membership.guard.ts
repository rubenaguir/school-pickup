import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InstitutionMember } from '@casillego/shared/entities';
import {
  INSTITUTION_RESOURCE_KEY,
  InstitutionResourceOptions,
} from './institution-resource.decorator';

interface AuthenticatedUser {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
}

interface InstitutionScopedRequest {
  user?: AuthenticatedUser;
  params: Record<string, string>;
  institutionMembership?: InstitutionMember;
}

function readDotPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

@Injectable()
export class InstitutionMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<InstitutionScopedRequest>();
    const user = request.user;
    if (!user) {
      throw new Error(
        'InstitutionMembershipGuard: request.user is missing. This guard must run after the JWT auth guard.',
      );
    }

    const resourceOptions = this.reflector.get<InstitutionResourceOptions | undefined>(
      INSTITUTION_RESOURCE_KEY,
      context.getHandler(),
    );

    const institutionId = resourceOptions
      ? await this.resolveInstitutionIdFromResource(request, resourceOptions)
      : this.resolveInstitutionIdFromRoute(request);

    const membership = await this.institutionMembersRepository.findOne({
      where: { institution: { id: institutionId }, user: { id: user.sub } },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_INSTITUTION_MEMBER',
        message: 'The authenticated user is not a member of this institution.',
      });
    }

    request.institutionMembership = membership;
    return true;
  }

  private resolveInstitutionIdFromRoute(request: InstitutionScopedRequest): string {
    const institutionId = request.params.institutionId;
    if (!institutionId) {
      throw new Error(
        'InstitutionMembershipGuard: no @InstitutionResource metadata and no ' +
          '":institutionId" route param. Misconfigured route.',
      );
    }
    return institutionId;
  }

  private async resolveInstitutionIdFromResource(
    request: InstitutionScopedRequest,
    options: InstitutionResourceOptions,
  ): Promise<string> {
    const idParam = options.idParam ?? 'id';
    const institutionColumn = options.institutionColumn ?? 'institutionId';
    const resourceId = request.params[idParam];
    if (!resourceId) {
      throw new Error(
        `InstitutionMembershipGuard: no ":${idParam}" route param found for @InstitutionResource.`,
      );
    }

    const repository = this.dataSource.getRepository(options.entity);
    const resource = await repository.findOne({ where: { id: resourceId } });
    if (!resource) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource does not exist.',
      });
    }

    const institutionId = readDotPath(resource, institutionColumn);
    if (typeof institutionId !== 'string' || !institutionId) {
      throw new Error(
        `InstitutionMembershipGuard: could not resolve an institution id from resource ` +
          `property "${institutionColumn}".`,
      );
    }
    return institutionId;
  }
}
