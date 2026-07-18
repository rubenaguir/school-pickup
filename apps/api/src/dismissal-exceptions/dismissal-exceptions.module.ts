import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DismissalException } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { DismissalExceptionsController } from './dismissal-exceptions.controller';
import { DismissalExceptionsDetailController } from './dismissal-exception-detail.controller';
import { DismissalExceptionsService } from './dismissal-exceptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([DismissalException]), AuthModule],
  controllers: [DismissalExceptionsController, DismissalExceptionsDetailController],
  providers: [DismissalExceptionsService],
})
export class DismissalExceptionsModule {}
