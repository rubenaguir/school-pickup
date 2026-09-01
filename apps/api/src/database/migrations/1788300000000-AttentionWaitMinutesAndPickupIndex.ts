import { MigrationInterface, QueryRunner } from 'typeorm';

// ADR-105: the Dashboard's "Requiere atención" panel.
//
//  - institutions.attention_wait_minutes: minutes a pickup may sit in
//    `arrived` before it counts as "waiting too long". NOT NULL, default 20;
//    no backfill — the default already covers every existing institution.
//  - IDX_pickup_requests_enrollment_guardian_status: covers the
//    "has this guardian ever completed a `delivered` for this enrollment?"
//    lookup behind the first_time_guardian condition. No existing index
//    covered `(enrollment_id, guardian_user_id, status)`.
export class AttentionWaitMinutesAndPickupIndex1788300000000 implements MigrationInterface {
  name = 'AttentionWaitMinutesAndPickupIndex1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "institutions" ADD "attention_wait_minutes" integer NOT NULL DEFAULT 20`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pickup_requests_enrollment_guardian_status" ON "pickup_requests" ("enrollment_id", "guardian_user_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_pickup_requests_enrollment_guardian_status"`);
    await queryRunner.query(`ALTER TABLE "institutions" DROP COLUMN "attention_wait_minutes"`);
  }
}
