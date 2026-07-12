import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/db-errors.util';
import { DismissalException } from '../database/entities/dismissal-exception.entity';
import type { Institution } from '../database/entities/institution.entity';
import { CreateDismissalExceptionDto } from './dto/create-dismissal-exception.dto';
import { UpdateDismissalExceptionDto } from './dto/update-dismissal-exception.dto';
import type { DismissalExceptionResponse, ListDismissalExceptionsResponse } from './dto/responses';

const CONFLICTING_DISMISSAL_EXCEPTION = {
  code: 'CONFLICTING_DISMISSAL_EXCEPTION',
  message:
    'level = null ("all levels") cannot coexist with any other dismissal exception on the same institution and date.',
} as const;

const DUPLICATE_DISMISSAL_EXCEPTION = {
  code: 'DUPLICATE_DISMISSAL_EXCEPTION',
  message: 'A dismissal exception already exists for this institution, date and level.',
} as const;

@Injectable()
export class DismissalExceptionsService {
  constructor(
    @InjectRepository(DismissalException)
    private readonly dismissalExceptionsRepository: Repository<DismissalException>,
  ) {}

  async list(
    institutionId: string,
    from?: string,
    to?: string,
  ): Promise<ListDismissalExceptionsResponse> {
    const dateFilter =
      from && to
        ? Between(from, to)
        : from
          ? MoreThanOrEqual(from)
          : to
            ? LessThanOrEqual(to)
            : undefined;

    const dismissalExceptions = await this.dismissalExceptionsRepository.find({
      where: { institution: { id: institutionId }, ...(dateFilter ? { date: dateFilter } : {}) },
      order: { date: 'ASC' },
    });
    return {
      dismissalExceptions: dismissalExceptions.map((dismissalException) =>
        this.toResponse(dismissalException),
      ),
    };
  }

  async create(
    institutionId: string,
    dto: CreateDismissalExceptionDto,
  ): Promise<DismissalExceptionResponse> {
    const level = dto.level ?? null;
    await this.assertNoConflict(institutionId, dto.date, level);

    const entity = this.dismissalExceptionsRepository.create({
      institution: { id: institutionId } as Institution,
      date: dto.date,
      name: dto.name,
      level,
      time: dto.time,
    });
    const saved = await this.save(entity);

    // institutionId is an insert:false companion column (ADR-029): it isn't
    // populated on the object returned by save() for a fresh insert. Patch it
    // in from the already-known route param instead of trusting saved.institutionId.
    return { ...this.toResponse(saved), institutionId };
  }

  async update(id: string, dto: UpdateDismissalExceptionDto): Promise<DismissalExceptionResponse> {
    const dismissalException = await this.findOrFail(id);

    const mergedDate = dto.date !== undefined ? dto.date : dismissalException.date;
    const mergedLevel = dto.level !== undefined ? dto.level : dismissalException.level;
    await this.assertNoConflict(dismissalException.institutionId, mergedDate, mergedLevel, id);

    if (dto.date !== undefined) dismissalException.date = dto.date;
    if (dto.name !== undefined) dismissalException.name = dto.name;
    if (dto.level !== undefined) dismissalException.level = dto.level;
    if (dto.time !== undefined) dismissalException.time = dto.time;

    const saved = await this.save(dismissalException);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const dismissalException = await this.findOrFail(id);
    await this.dismissalExceptionsRepository.remove(dismissalException);
  }

  private async save(entity: DismissalException): Promise<DismissalException> {
    try {
      return await this.dismissalExceptionsRepository.save(entity);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_DISMISSAL_EXCEPTION);
      }
      throw error;
    }
  }

  // ADR-018 punto 10: the unique index on (institution, date, level) does not
  // catch a level = null ("all levels") row coexisting with any other row on
  // the same date, because Postgres treats NULL <> NULL for uniqueness — that
  // includes two level = null rows on the same date, which the index also
  // misses. Both directions of that collision are checked here; the trivial
  // case of two rows sharing the same non-null level is left to the unique
  // index (see `save`).
  private async assertNoConflict(
    institutionId: string,
    date: string,
    level: string | null,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.dismissalExceptionsRepository.exists({
      where: {
        institution: { id: institutionId },
        date,
        ...(level === null ? {} : { level: IsNull() }),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (conflict) {
      throw new UnprocessableEntityException(CONFLICTING_DISMISSAL_EXCEPTION);
    }
  }

  private async findOrFail(id: string): Promise<DismissalException> {
    const dismissalException = await this.dismissalExceptionsRepository.findOne({
      where: { id },
    });
    if (!dismissalException) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource does not exist.',
      });
    }
    return dismissalException;
  }

  private toResponse(entity: DismissalException): DismissalExceptionResponse {
    return {
      id: entity.id,
      institutionId: entity.institutionId,
      date: entity.date,
      name: entity.name,
      level: entity.level,
      time: entity.time,
    };
  }
}
