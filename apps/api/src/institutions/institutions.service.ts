import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '../database/entities/institution.entity';
import { generateUniqueJoinCode, randomJoinCodeSuffix } from '../auth/join-code.util';
import { isUniqueViolation } from '../common/db-errors.util';
import { geoPointToLatLng, latLngToGeoPoint } from './geo-point.mapper';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import type {
  GetInstitutionResponse,
  RegenerateJoinCodeResponse,
  UpdateInstitutionResponse,
} from './dto/responses';

const MAX_JOIN_CODE_SAVE_ATTEMPTS = 5;

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
  ) {}

  async get(id: string): Promise<GetInstitutionResponse> {
    const institution = await this.findOrFail(id);
    return {
      id: institution.id,
      name: institution.name,
      type: institution.type,
      category: institution.category,
      address: institution.address,
      location: geoPointToLatLng(institution.location),
      geofenceRadiusMeters: institution.geofenceRadiusMeters,
      activationRadiusMeters: institution.activationRadiusMeters,
      timezone: institution.timezone,
      cctCode: institution.cctCode,
      levels: institution.levels,
      arrivalToleranceMinutes: institution.arrivalToleranceMinutes,
      advanceNoticeMinutes: institution.advanceNoticeMinutes,
      arrivingLeadMinutes: institution.arrivingLeadMinutes,
      joinCode: institution.joinCode,
      status: institution.status,
    };
  }

  async update(id: string, dto: UpdateInstitutionDto): Promise<UpdateInstitutionResponse> {
    const institution = await this.findOrFail(id);

    if (institution.status !== 'approved') {
      throw new ConflictException({
        code: 'INSTITUTION_NOT_APPROVED',
        message: 'The institution profile can only be edited while its status is approved.',
      });
    }

    const nextCategory = dto.category !== undefined ? dto.category : institution.category;
    if (nextCategory && institution.type === 'school') {
      throw new ConflictException({
        code: 'CATEGORY_NOT_ALLOWED_FOR_TYPE',
        message: 'category can only be set on institutions with type = extracurricular.',
      });
    }

    if (dto.name !== undefined) institution.name = dto.name;
    if (dto.category !== undefined) institution.category = dto.category;
    if (dto.address !== undefined) institution.address = dto.address;
    if (dto.location !== undefined) institution.location = latLngToGeoPoint(dto.location);
    if (dto.geofenceRadiusMeters !== undefined) {
      institution.geofenceRadiusMeters = dto.geofenceRadiusMeters;
    }
    if (dto.activationRadiusMeters !== undefined) {
      institution.activationRadiusMeters = dto.activationRadiusMeters;
    }
    if (dto.timezone !== undefined) institution.timezone = dto.timezone;
    if (dto.cctCode !== undefined) institution.cctCode = dto.cctCode;
    if (dto.levels !== undefined) institution.levels = dto.levels;
    if (dto.arrivalToleranceMinutes !== undefined) {
      institution.arrivalToleranceMinutes = dto.arrivalToleranceMinutes;
    }
    if (dto.advanceNoticeMinutes !== undefined) {
      institution.advanceNoticeMinutes = dto.advanceNoticeMinutes;
    }
    if (dto.arrivingLeadMinutes !== undefined) {
      institution.arrivingLeadMinutes = dto.arrivingLeadMinutes;
    }

    const saved = await this.institutionsRepository.save(institution);

    return {
      id: saved.id,
      name: saved.name,
      category: saved.category,
      address: saved.address,
      location: geoPointToLatLng(saved.location),
      geofenceRadiusMeters: saved.geofenceRadiusMeters,
      activationRadiusMeters: saved.activationRadiusMeters,
      timezone: saved.timezone,
      cctCode: saved.cctCode,
      levels: saved.levels,
      arrivalToleranceMinutes: saved.arrivalToleranceMinutes,
      advanceNoticeMinutes: saved.advanceNoticeMinutes,
      arrivingLeadMinutes: saved.arrivingLeadMinutes,
      status: saved.status,
    };
  }

  async regenerateJoinCode(id: string): Promise<RegenerateJoinCodeResponse> {
    const institution = await this.findOrFail(id);

    const baseJoinCode = await generateUniqueJoinCode(institution.name, (candidate) =>
      this.institutionsRepository.exists({ where: { joinCode: candidate } }),
    );

    let candidate = baseJoinCode;
    for (let attempt = 0; attempt <= MAX_JOIN_CODE_SAVE_ATTEMPTS; attempt++) {
      try {
        institution.joinCode = candidate;
        await this.institutionsRepository.save(institution);
        return { id: institution.id, joinCode: institution.joinCode };
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_JOIN_CODE_SAVE_ATTEMPTS) {
          candidate = `${baseJoinCode}-${randomJoinCodeSuffix()}`;
          continue;
        }
        throw error;
      }
    }
    /* istanbul ignore next -- loop above always returns or throws */
    throw new Error('Could not regenerate join_code: retries exhausted.');
  }

  private async findOrFail(id: string): Promise<Institution> {
    const institution = await this.institutionsRepository.findOne({ where: { id } });
    if (!institution) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource does not exist.',
      });
    }
    return institution;
  }
}
