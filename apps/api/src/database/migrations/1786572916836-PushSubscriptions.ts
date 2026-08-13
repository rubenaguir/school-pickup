import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushSubscriptions1786572916836 implements MigrationInterface {
  name = 'PushSubscriptions1786572916836';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "endpoint" text NOT NULL, "p256dh_key" character varying(255) NOT NULL, "auth_key" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_757fc8f00c34f66832668dc2e53" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6771f119f1c06d2ccf38f23866" ON "push_subscriptions"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_push_subscriptions_user_endpoint" ON "push_subscriptions"  ("user_id", "endpoint") `,
    );
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" ADD CONSTRAINT "FK_6771f119f1c06d2ccf38f238664" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_6771f119f1c06d2ccf38f238664"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_push_subscriptions_user_endpoint"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6771f119f1c06d2ccf38f23866"`);
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
