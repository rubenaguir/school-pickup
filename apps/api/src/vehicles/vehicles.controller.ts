import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { DeleteVehicleDto } from './dto/delete-vehicle.dto';
import type { ListVehiclesResponse, VehicleResponse } from './dto/responses';

interface AuthenticatedRequest {
  user: { sub: string };
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ListVehiclesResponse> {
    return this.vehiclesService.list(request.user.sub);
  }

  @Post()
  create(
    @Body() dto: CreateVehicleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.create(request.user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<VehicleResponse> {
    return this.vehiclesService.update(id, request.user.sub, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() dto: DeleteVehicleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.vehiclesService.remove(id, request.user.sub, dto);
  }
}
