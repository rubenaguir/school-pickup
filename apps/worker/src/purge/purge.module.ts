import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationUpdate } from '@casillego/shared/entities';
import { PurgeService } from './purge.service';

@Module({
  imports: [TypeOrmModule.forFeature([LocationUpdate])],
  providers: [PurgeService],
})
export class PurgeModule {}
