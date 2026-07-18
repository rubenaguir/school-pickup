import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Vehicle, User } from '@casillego/shared/entities';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { DeleteVehicleDto } from './dto/delete-vehicle.dto';
import type { ListVehiclesResponse, VehicleResponse } from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const NOT_VEHICLE_OWNER = {
  code: 'NOT_VEHICLE_OWNER',
  message: 'This vehicle belongs to another guardian.',
} as const;

const NEW_PRIMARY_VEHICLE_REQUIRED = {
  code: 'NEW_PRIMARY_VEHICLE_REQUIRED',
  message:
    'newPrimaryVehicleId is required when deleting the primary vehicle while other vehicles exist.',
} as const;

const NEW_PRIMARY_VEHICLE_INVALID = {
  code: 'NEW_PRIMARY_VEHICLE_INVALID',
  message: 'newPrimaryVehicleId must refer to another vehicle owned by the same guardian.',
} as const;

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    private readonly dataSource: DataSource,
  ) {}

  async list(userId: string): Promise<ListVehiclesResponse> {
    const vehicles = await this.vehiclesRepository.find({
      where: { guardian: { id: userId } },
      order: { createdAt: 'ASC' },
    });
    return { vehicles: vehicles.map((vehicle) => this.toResponse(vehicle)) };
  }

  async create(userId: string, dto: CreateVehicleDto): Promise<VehicleResponse> {
    if (dto.isPrimary === true) {
      const saved = await this.dataSource.transaction(async (manager) => {
        const vehiclesRepo = manager.getRepository(Vehicle);
        await this.unmarkCurrentPrimary(vehiclesRepo, userId);
        return vehiclesRepo.save(
          vehiclesRepo.create({
            guardian: { id: userId } as User,
            description: dto.description,
            plate: dto.plate,
            isPrimary: true,
          }),
        );
      });
      return this.toResponse(saved);
    }

    const saved = await this.vehiclesRepository.save(
      this.vehiclesRepository.create({
        guardian: { id: userId } as User,
        description: dto.description,
        plate: dto.plate,
        isPrimary: false,
      }),
    );
    return this.toResponse(saved);
  }

  async update(id: string, userId: string, dto: UpdateVehicleDto): Promise<VehicleResponse> {
    const vehicle = await this.findOwnedOrFail(id, userId);

    if (dto.isPrimary === true && !vehicle.isPrimary) {
      const saved = await this.dataSource.transaction(async (manager) => {
        const vehiclesRepo = manager.getRepository(Vehicle);
        await this.unmarkCurrentPrimary(vehiclesRepo, userId, id);
        if (dto.description !== undefined) vehicle.description = dto.description;
        if (dto.plate !== undefined) vehicle.plate = dto.plate;
        vehicle.isPrimary = true;
        return vehiclesRepo.save(vehicle);
      });
      return this.toResponse(saved);
    }

    if (dto.description !== undefined) vehicle.description = dto.description;
    if (dto.plate !== undefined) vehicle.plate = dto.plate;
    if (dto.isPrimary !== undefined) vehicle.isPrimary = dto.isPrimary;
    const saved = await this.vehiclesRepository.save(vehicle);
    return this.toResponse(saved);
  }

  async remove(id: string, userId: string, dto: DeleteVehicleDto): Promise<void> {
    const vehicle = await this.findOwnedOrFail(id, userId);

    if (!vehicle.isPrimary) {
      await this.vehiclesRepository.remove(vehicle);
      return;
    }

    const otherVehiclesCount = await this.vehiclesRepository.count({
      where: { guardian: { id: userId }, id: Not(id) },
    });

    if (otherVehiclesCount === 0) {
      await this.vehiclesRepository.remove(vehicle);
      return;
    }

    if (!dto.newPrimaryVehicleId) {
      throw new UnprocessableEntityException(NEW_PRIMARY_VEHICLE_REQUIRED);
    }
    if (dto.newPrimaryVehicleId === id) {
      throw new UnprocessableEntityException(NEW_PRIMARY_VEHICLE_INVALID);
    }

    const newPrimary = await this.vehiclesRepository.findOne({
      where: { id: dto.newPrimaryVehicleId, guardian: { id: userId } },
    });
    if (!newPrimary) {
      throw new UnprocessableEntityException(NEW_PRIMARY_VEHICLE_INVALID);
    }

    await this.dataSource.transaction(async (manager) => {
      const vehiclesRepo = manager.getRepository(Vehicle);
      // The unique partial index on is_primary is checked per statement, not
      // deferred: the old primary must be removed before the new one is
      // marked, otherwise both rows would briefly have is_primary = true.
      await vehiclesRepo.remove(vehicle);
      newPrimary.isPrimary = true;
      await vehiclesRepo.save(newPrimary);
    });
  }

  private async unmarkCurrentPrimary(
    vehiclesRepo: Repository<Vehicle>,
    userId: string,
    excludeId?: string,
  ): Promise<void> {
    const currentPrimary = await vehiclesRepo.findOne({
      where: { guardian: { id: userId }, isPrimary: true },
    });
    if (currentPrimary && currentPrimary.id !== excludeId) {
      currentPrimary.isPrimary = false;
      await vehiclesRepo.save(currentPrimary);
    }
  }

  private async findOwnedOrFail(id: string, userId: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
      relations: { guardian: true },
    });
    if (!vehicle) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    if (vehicle.guardian.id !== userId) {
      throw new ForbiddenException(NOT_VEHICLE_OWNER);
    }
    return vehicle;
  }

  private toResponse(vehicle: Vehicle): VehicleResponse {
    return {
      id: vehicle.id,
      description: vehicle.description,
      plate: vehicle.plate,
      isPrimary: vehicle.isPrimary,
    };
  }
}
