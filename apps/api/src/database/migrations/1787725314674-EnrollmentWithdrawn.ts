import { MigrationInterface, QueryRunner } from 'typeorm';

// ADR-088: adds the 'withdrawn' status (approved -> withdrawn, tutor or
// institution) plus its audit columns, same pattern as reviewed_at /
// reviewed_by_user_id. No change to the partial unique index
// (student_id, institution_id) WHERE status IN ('pending', 'approved') —
// it already excludes any status outside that pair by construction.
//
// migration:generate against the live DB also proposed dropping/recreating
// "IDX_institution_groups_name_ci" and "IDX_0108872f07b7d47a81bbdd4940" —
// pre-existing drift unrelated to this change (the former is a functional
// index over lower(name) that TypeORM's introspection cannot represent, see
// InstitutionGroupsCatalog1787349827677; the latter is a column-order/
// formatting artifact). Both left untouched here on purpose.
export class EnrollmentWithdrawn1787725314674 implements MigrationInterface {
  name = 'EnrollmentWithdrawn1787725314674';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD "withdrawn_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "enrollments" ADD "withdrawn_by_user_id" uuid`);
    await queryRunner.query(`ALTER TYPE "public"."enrollments_status_enum" ADD VALUE 'withdrawn'`);
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_7b118569df69a5730e61830e1e6" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_7b118569df69a5730e61830e1e6"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."enrollments_status_enum_old" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ALTER COLUMN "status" TYPE "public"."enrollments_status_enum_old" USING "status"::"text"::"public"."enrollments_status_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."enrollments_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."enrollments_status_enum_old" RENAME TO "enrollments_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "enrollments" DROP COLUMN "withdrawn_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "enrollments" DROP COLUMN "withdrawn_at"`);
  }
}
