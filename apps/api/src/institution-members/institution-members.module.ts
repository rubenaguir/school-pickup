import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionMember, Institution, User, AuditLog } from '@casillego/shared/entities';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { InstitutionMembersController } from './institution-members.controller';
import { InstitutionMemberDetailController } from './institution-member-detail.controller';
import { InstitutionMembersService } from './institution-members.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InstitutionMember, Institution, User, AuditLog]),
    AuthModule,
    EmailModule,
  ],
  controllers: [InstitutionMembersController, InstitutionMemberDetailController],
  providers: [InstitutionMembersService],
  exports: [InstitutionMembersService],
})
export class InstitutionMembersModule {}
