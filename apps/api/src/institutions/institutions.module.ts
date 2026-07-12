import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution } from '../database/entities/institution.entity';
import { AuthModule } from '../auth/auth.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Institution]), AuthModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
