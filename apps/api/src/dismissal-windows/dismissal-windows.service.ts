import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DismissalWindowStatus } from '@casillego/shared';
import { DismissalWindow, type Institution } from '@casillego/shared/entities';
import { CreateDismissalWindowDto } from './dto/create-dismissal-window.dto';
import { UpdateDismissalWindowDto } from './dto/update-dismissal-window.dto';
import type { DismissalWindowResponse, ListDismissalWindowsResponse } from './dto/responses';

@Injectable()
export class DismissalWindowsService {
  constructor(
    @InjectRepository(DismissalWindow)
    private readonly dismissalWindowsRepository: Repository<DismissalWindow>,
  ) {}

  async list(
    institutionId: string,
    status?: DismissalWindowStatus,
  ): Promise<ListDismissalWindowsResponse> {
    const dismissalWindows = await this.dismissalWindowsRepository.find({
      where: { institution: { id: institutionId }, ...(status ? { status } : {}) },
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
    return {
      dismissalWindows: dismissalWindows.map((dismissalWindow) => this.toResponse(dismissalWindow)),
    };
  }

  async create(
    institutionId: string,
    dto: CreateDismissalWindowDto,
  ): Promise<DismissalWindowResponse> {
    const entity = this.dismissalWindowsRepository.create({
      institution: { id: institutionId } as Institution,
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      label: dto.label,
      level: dto.level ?? null,
      status: 'active',
    });
    const saved = await this.dismissalWindowsRepository.save(entity);

    // institutionId is an insert:false companion column (ADR-029): it isn't
    // populated on the object returned by save() for a fresh insert. Patch it
    // in from the already-known route param instead of trusting saved.institutionId.
    return { ...this.toResponse(saved), institutionId };
  }

  async update(id: string, dto: UpdateDismissalWindowDto): Promise<DismissalWindowResponse> {
    const dismissalWindow = await this.findOrFail(id);

    if (dto.weekday !== undefined) dismissalWindow.weekday = dto.weekday;
    if (dto.startTime !== undefined) dismissalWindow.startTime = dto.startTime;
    if (dto.endTime !== undefined) dismissalWindow.endTime = dto.endTime;
    if (dto.label !== undefined) dismissalWindow.label = dto.label;
    if (dto.level !== undefined) dismissalWindow.level = dto.level;
    if (dto.status !== undefined) dismissalWindow.status = dto.status;

    const saved = await this.dismissalWindowsRepository.save(dismissalWindow);
    return this.toResponse(saved);
  }

  private async findOrFail(id: string): Promise<DismissalWindow> {
    const dismissalWindow = await this.dismissalWindowsRepository.findOne({ where: { id } });
    if (!dismissalWindow) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource does not exist.',
      });
    }
    return dismissalWindow;
  }

  private toResponse(entity: DismissalWindow): DismissalWindowResponse {
    return {
      id: entity.id,
      institutionId: entity.institutionId,
      weekday: entity.weekday,
      startTime: entity.startTime,
      endTime: entity.endTime,
      label: entity.label,
      level: entity.level,
      status: entity.status,
    };
  }
}
