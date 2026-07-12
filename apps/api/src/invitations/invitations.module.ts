import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentGuardiansModule } from '../student-guardians/student-guardians.module';
import { InstitutionMembersModule } from '../institution-members/institution-members.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuthModule, StudentGuardiansModule, InstitutionMembersModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
