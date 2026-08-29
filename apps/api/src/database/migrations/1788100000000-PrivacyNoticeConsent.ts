import { MigrationInterface, QueryRunner } from 'typeorm';

// ADR-099: consent columns for the privacy notice (LFPDPPP), written only on
// new registrations from here on. Both nullable, no default, no backfill —
// existing accounts stay NULL permanently (out of scope, confirmed with the
// human), new accounts always set both in the same INSERT/UPDATE that creates
// or reuses their `users` row.
export class PrivacyNoticeConsent1788100000000 implements MigrationInterface {
  name = 'PrivacyNoticeConsent1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "privacy_accepted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "privacy_notice_version" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "privacy_notice_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "privacy_accepted_at"`);
  }
}
