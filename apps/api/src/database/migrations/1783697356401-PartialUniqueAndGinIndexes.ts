import { MigrationInterface, QueryRunner } from 'typeorm';

// 7 indexes deliberately absent from the entity decorators (see the comments in
// vehicle.entity.ts, student-guardian.entity.ts, enrollment.entity.ts,
// pickup-request.entity.ts, delivery-point.entity.ts) because TypeORM's @Index
// decorator cannot express a partial (WHERE) or GIN index. Documented in each
// spec's "Índices" section; ADR-018, ADR-024 point 2 and ADR-026 point 1.
export class PartialUniqueAndGinIndexes1783697356401 implements MigrationInterface {
  name = 'PartialUniqueAndGinIndexes1783697356401';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_vehicles_primary_per_guardian" ON "vehicles" ("guardian_user_id") WHERE "is_primary" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_student_guardians_primary_per_student" ON "student_guardians" ("student_id") WHERE "is_primary" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_student_guardians_active_link" ON "student_guardians" ("student_id", "guardian_user_id") WHERE "status" IN ('invited', 'active')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_enrollments_active_per_student_institution" ON "enrollments" ("student_id", "institution_id") WHERE "status" IN ('pending', 'approved')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pickup_requests_active_per_enrollment" ON "pickup_requests" ("enrollment_id") WHERE "status" IN ('en_route', 'arriving', 'arrived')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pickup_requests_active_delivery_code_per_institution" ON "pickup_requests" ("institution_id", "delivery_code") WHERE "status" IN ('en_route', 'arriving', 'arrived')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_points_assigned_groups" ON "delivery_points" USING GIN ("assigned_groups")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_delivery_points_assigned_groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pickup_requests_active_delivery_code_per_institution"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pickup_requests_active_per_enrollment"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_enrollments_active_per_student_institution"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_student_guardians_active_link"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_student_guardians_primary_per_student"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_vehicles_primary_per_guardian"`);
  }
}
