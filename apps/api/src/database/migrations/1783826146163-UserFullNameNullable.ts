import { MigrationInterface, QueryRunner } from 'typeorm';

// users.full_name relaxed to nullable: same pattern as password_hash
// (ADR-022 point 2). A user invited as a student_guardian (feature 015,
// email-not-found branch) is created before their real name is known — NULL
// is the honest representation of "not provided yet" instead of a fake
// placeholder. See ADR-030.
export class UserFullNameNullable1783826146163 implements MigrationInterface {
  name = 'UserFullNameNullable1783826146163';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL`);
  }
}
