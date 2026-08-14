import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { DeliveryPointsModule } from './delivery-points/delivery-points.module';
import { DismissalWindowsModule } from './dismissal-windows/dismissal-windows.module';
import { DismissalExceptionsModule } from './dismissal-exceptions/dismissal-exceptions.module';
import { StudentsModule } from './students/students.module';
import { StudentGuardiansModule } from './student-guardians/student-guardians.module';
import { InvitationsModule } from './invitations/invitations.module';
import { InstitutionMembersModule } from './institution-members/institution-members.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PickupsModule } from './pickups/pickups.module';
import { DeliveryPointQueueModule } from './delivery-point-queue/delivery-point-queue.module';
import { PickupRequestTrackingModule } from './pickup-request-tracking/pickup-request-tracking.module';
import { BoardModule } from './board/board.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { InstitutionReportsModule } from './institution-reports/institution-reports.module';
import { PushSubscriptionsModule } from './push-subscriptions/push-subscriptions.module';

/**
 * Root module. Domain modules beyond auth/institutions/delivery-points/
 * dismissal-windows/dismissal-exceptions/students/student-guardians/
 * invitations/institution-members/vehicles/enrollments/pickups/
 * delivery-point-queue/pickup-request-tracking/board/admin/users/
 * institution-reports/push-subscriptions are added in later phases.
 */
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    InstitutionsModule,
    DeliveryPointsModule,
    DismissalWindowsModule,
    DismissalExceptionsModule,
    StudentsModule,
    StudentGuardiansModule,
    InvitationsModule,
    InstitutionMembersModule,
    VehiclesModule,
    EnrollmentsModule,
    PickupsModule,
    DeliveryPointQueueModule,
    PickupRequestTrackingModule,
    BoardModule,
    AdminModule,
    UsersModule,
    InstitutionReportsModule,
    PushSubscriptionsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
