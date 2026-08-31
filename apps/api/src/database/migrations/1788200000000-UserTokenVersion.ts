import { MigrationInterface, QueryRunner } from 'typeorm';

// ADR-103: token_version invalidates every refresh token already issued for a
// user the moment it is incremented. Today the only trigger is a successful
// password change (UsersService.changePassword). NOT NULL with a default of 0,
// no backfill — the default already covers every existing account.
export class UserTokenVersion1788200000000 implements MigrationInterface {
  name = 'UserTokenVersion1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
  }
}
