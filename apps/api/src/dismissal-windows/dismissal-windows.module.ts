import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DismissalWindow } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { DismissalWindowsController } from './dismissal-windows.controller';
import { DismissalWindowsDetailController } from './dismissal-window-detail.controller';
import { DismissalWindowsService } from './dismissal-windows.service';

@Module({
  imports: [TypeOrmModule.forFeature([DismissalWindow]), AuthModule],
  controllers: [DismissalWindowsController, DismissalWindowsDetailController],
  providers: [DismissalWindowsService],
})
export class DismissalWindowsModule {}
