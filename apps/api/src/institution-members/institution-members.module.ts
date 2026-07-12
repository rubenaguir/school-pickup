import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionMember } from '../database/entities/institution-member.entity';
import { Institution } from '../database/entities/institution.entity';
import { User } from '../database/entities/user.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
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
