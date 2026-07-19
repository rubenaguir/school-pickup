import { MigrationInterface, QueryRunner } from 'typeorm';

// 7 partial/GIN indexes. This raw SQL is the real source of truth in
// Postgres. They are also mirrored declaratively as @Index decorators on the
// entities (vehicle.entity.ts, student-guardian.entity.ts, enrollment.entity.ts,
// pickup-request.entity.ts, delivery-point.entity.ts) so TypeORM is aware of
// them and `migration:generate` doesn't propose recreating them — see each
// entity's own comment. Documented in each spec's "Índices" section;
// ADR-018, ADR-024, ADR-025, ADR-026.
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
