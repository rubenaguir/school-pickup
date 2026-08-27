import { MigrationInterface, QueryRunner } from 'typeorm';

// ADR-093: adds the 'approaching' value to the pickup_request status enums
// (pickup_requests_status_enum and pickup_request_status_history_status_enum).
//
// Both types are recreated (CREATE TYPE _new / ALTER COLUMN / DROP / RENAME)
// rather than extended with `ALTER TYPE ... ADD VALUE`: Postgres forbids using a
// value added that way within the same transaction, and this migration needs
// the new label immediately — the two partial unique indexes on pickup_requests
// are dropped and recreated with the widened active-status set
// ('en_route','approaching','arriving','arrived'), so that a pickup that moves
// en_route -> approaching stays inside the "one active pickup per enrollment"
// and the "unique delivery_code among active pickups" scopes (see
// specs/entities/pickup_request.md). Same type-recreation shape as every enum
// down() migration already in this repo.
//
// The plain btree index on pickup_requests.status is left untouched — Postgres
// rebuilds it automatically on the column type change; only the two partial
// indexes carry a `status IN (...)` predicate that must be rewritten.
export class PickupRequestApproachingStatus1787900000000 implements MigrationInterface {
  name = 'PickupRequestApproachingStatus1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- pickup_request_status_history.status ---
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_request_status_history_status_enum_new" AS ENUM('en_route', 'approaching', 'arriving', 'arrived', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_request_status_history" ALTER COLUMN "status" TYPE "public"."pickup_request_status_history_status_enum_new" USING "status"::"text"::"public"."pickup_request_status_history_status_enum_new"`,
    );
    await queryRunner.query(`DROP TYPE "public"."pickup_request_status_history_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pickup_request_status_history_status_enum_new" RENAME TO "pickup_request_status_history_status_enum"`,
    );

    // --- pickup_requests.status ---
    await queryRunner.query(`DROP INDEX "public"."IDX_pickup_requests_active_per_enrollment"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pickup_requests_active_delivery_code_per_institution"`,
    );
    await queryRunner.query(`ALTER TABLE "pickup_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_requests_status_enum_new" AS ENUM('en_route', 'approaching', 'arriving', 'arrived', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ALTER COLUMN "status" TYPE "public"."pickup_requests_status_enum_new" USING "status"::"text"::"public"."pickup_requests_status_enum_new"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ALTER COLUMN "status" SET DEFAULT 'en_route'`,
    );
    await queryRunner.query(`DROP TYPE "public"."pickup_requests_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pickup_requests_status_enum_new" RENAME TO "pickup_requests_status_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pickup_requests_active_per_enrollment" ON "pickup_requests" ("enrollment_id") WHERE "status" IN ('en_route', 'approaching', 'arriving', 'arrived')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pickup_requests_active_delivery_code_per_institution" ON "pickup_requests" ("institution_id", "delivery_code") WHERE "status" IN ('en_route', 'approaching', 'arriving', 'arrived')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- pickup_requests.status ---
    await queryRunner.query(
      `DROP INDEX "public"."IDX_pickup_requests_active_delivery_code_per_institution"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pickup_requests_active_per_enrollment"`);
    await queryRunner.query(`ALTER TABLE "pickup_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_requests_status_enum_old" AS ENUM('en_route', 'arriving', 'arrived', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ALTER COLUMN "status" TYPE "public"."pickup_requests_status_enum_old" USING "status"::"text"::"public"."pickup_requests_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ALTER COLUMN "status" SET DEFAULT 'en_route'`,
    );
    await queryRunner.query(`DROP TYPE "public"."pickup_requests_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pickup_requests_status_enum_old" RENAME TO "pickup_requests_status_enum"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pickup_requests_active_per_enrollment" ON "pickup_requests" ("enrollment_id") WHERE "status" IN ('en_route', 'arriving', 'arrived')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pickup_requests_active_delivery_code_per_institution" ON "pickup_requests" ("institution_id", "delivery_code") WHERE "status" IN ('en_route', 'arriving', 'arrived')`,
    );

    // --- pickup_request_status_history.status ---
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_request_status_history_status_enum_old" AS ENUM('en_route', 'arriving', 'arrived', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_request_status_history" ALTER COLUMN "status" TYPE "public"."pickup_request_status_history_status_enum_old" USING "status"::"text"::"public"."pickup_request_status_history_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."pickup_request_status_history_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."pickup_request_status_history_status_enum_old" RENAME TO "pickup_request_status_history_status_enum"`,
    );
  }
}
