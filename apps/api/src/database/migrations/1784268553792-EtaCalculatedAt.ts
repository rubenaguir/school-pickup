import { MigrationInterface, QueryRunner } from 'typeorm';

export class EtaCalculatedAt1784268553792 implements MigrationInterface {
  name = 'EtaCalculatedAt1784268553792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ADD "eta_calculated_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pickup_requests" DROP COLUMN "eta_calculated_at"`);
  }
}
