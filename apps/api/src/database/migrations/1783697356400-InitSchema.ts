import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1783697356400 implements MigrationInterface {
  name = 'InitSchema1783697356400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."student_guardians_relationship_enum" AS ENUM('mother', 'father', 'grandparent', 'driver', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."student_guardians_status_enum" AS ENUM('active', 'invited', 'revoked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "student_guardians" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "relationship" "public"."student_guardians_relationship_enum" NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "status" "public"."student_guardians_status_enum" NOT NULL DEFAULT 'invited', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "student_id" uuid, "guardian_user_id" uuid, CONSTRAINT "PK_11ef78f5131711d8da1b14e3332" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1d37c30aec3fae80ca41891c7e" ON "student_guardians"  ("guardian_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a5bacc7e469f150cad96edc3a" ON "student_guardians"  ("student_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "students" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "full_name" character varying(255) NOT NULL, "birth_date" date, "photo_url" character varying(1000), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by_user_id" uuid, CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b03e0395920f1059d31254b275" ON "students"  ("created_by_user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."enrollments_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "enrollments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "status" "public"."enrollments_status_enum" NOT NULL DEFAULT 'pending', "grade_or_group" character varying(100), "enrollment_code" character varying(50) NOT NULL, "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reviewed_at" TIMESTAMP WITH TIME ZONE, "student_id" uuid, "institution_id" uuid, "requested_by_user_id" uuid, "reviewed_by_user_id" uuid, CONSTRAINT "UQ_8249d102366603ad1debc133241" UNIQUE ("enrollment_code"), CONSTRAINT "PK_7c0f752f9fb68bf6ed7367ab00f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0108872f07b7d47a81bbdd4940" ON "enrollments"  ("institution_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "description" character varying(255) NOT NULL, "plate" character varying(20) NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "guardian_user_id" uuid, CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ef5b60dbbab9389c50933ecff" ON "vehicles"  ("guardian_user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_request_status_history_status_enum" AS ENUM('en_route', 'arriving', 'arrived', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pickup_request_status_history" ("id" BIGSERIAL NOT NULL, "status" "public"."pickup_request_status_history_status_enum" NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "pickup_request_id" uuid, "changed_by_user_id" uuid, CONSTRAINT "PK_a3cfa5db32180aa0b47ece0c105" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5664ff0f681a6c047aa2212eb1" ON "pickup_request_status_history"  ("pickup_request_id", "changed_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "location_updates" ("id" BIGSERIAL NOT NULL, "location" geography(Point,4326) NOT NULL, "accuracy_meters" double precision, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "pickup_request_id" uuid, CONSTRAINT "PK_fb8762f200a070d3c0ce2a82c3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_772a0f744a54965a726e3ee959" ON "location_updates"  ("pickup_request_id", "recorded_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_requests_status_enum" AS ENUM('en_route', 'arriving', 'arrived', 'delivered', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pickup_requests_arrival_mode_enum" AS ENUM('vehicle', 'walking')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pickup_requests" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "status" "public"."pickup_requests_status_enum" NOT NULL DEFAULT 'en_route', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "estimated_arrival_at" TIMESTAMP WITH TIME ZONE, "eta_seconds" integer, "last_location" geography(Point,4326), "delivery_code" character varying(4) NOT NULL, "arrival_mode" "public"."pickup_requests_arrival_mode_enum", "vehicle_description" character varying(255), "vehicle_plate" character varying(20), "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "enrollment_id" uuid, "institution_id" uuid, "guardian_user_id" uuid, "delivery_point_id" uuid, "vehicle_id" uuid, CONSTRAINT "PK_4a347837d7b9ff0c32e41951a6a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_363af868a948f5a6ad0e0f302d" ON "pickup_requests"  ("delivery_point_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ed8344a391afb7463ffcf07d65" ON "pickup_requests"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d11147dc92b836a9d753c19bc" ON "pickup_requests"  ("institution_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."delivery_points_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_points" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(255) NOT NULL, "description" character varying(500), "assigned_groups" character varying(100) array, "status" "public"."delivery_points_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "institution_id" uuid, "operator_user_id" uuid, CONSTRAINT "PK_ee6d715a5812180cd569684ac06" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4dcd3ec0eae8a34167710788cd" ON "delivery_points"  ("institution_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."dismissal_windows_status_enum" AS ENUM('active', 'paused')`,
    );
    await queryRunner.query(
      `CREATE TABLE "dismissal_windows" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "weekday" smallint NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "label" character varying(255) NOT NULL, "level" character varying(100), "status" "public"."dismissal_windows_status_enum" NOT NULL DEFAULT 'active', "institution_id" uuid, CONSTRAINT "PK_6e5ed143d280216e7b9da52ed58" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_236df3f75f78e4d68e4e9fbc76" ON "dismissal_windows"  ("institution_id", "weekday", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dismissal_exceptions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "date" date NOT NULL, "name" character varying(255) NOT NULL, "level" character varying(100), "time" TIME NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "institution_id" uuid, CONSTRAINT "PK_2bdd3377df8339c1352cd4bd63a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e3b6178cb50e77d5b0c17fc66c" ON "dismissal_exceptions"  ("institution_id", "date", "level") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."institutions_type_enum" AS ENUM('school', 'extracurricular')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."institutions_status_enum" AS ENUM('pending', 'approved', 'suspended')`,
    );
    await queryRunner.query(
      `CREATE TABLE "institutions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(255) NOT NULL, "type" "public"."institutions_type_enum" NOT NULL, "category" character varying(100), "address" character varying(500) NOT NULL, "location" geography(Point,4326) NOT NULL, "geofence_radius_meters" integer NOT NULL DEFAULT '100', "activation_radius_meters" integer NOT NULL DEFAULT '3000', "timezone" character varying(50) NOT NULL, "cct_code" character varying(20), "levels" character varying(50) array NOT NULL DEFAULT '{}', "arrival_tolerance_minutes" integer NOT NULL DEFAULT '10', "advance_notice_minutes" integer NOT NULL DEFAULT '15', "arriving_lead_minutes" integer NOT NULL DEFAULT '5', "join_code" character varying(20) NOT NULL, "status" "public"."institutions_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a3864fa01fff6262b8b690d7291" UNIQUE ("join_code"), CONSTRAINT "PK_0be7539dcdba335470dc05e9690" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_77249c5477cfb397eceed635fa" ON "institutions" USING gist ("location") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9bf15c234266fd3c914a610c41" ON "institutions"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."institution_members_role_enum" AS ENUM('admin', 'gate_operator', 'coordinator', 'teacher')`,
    );
    await queryRunner.query(
      `CREATE TABLE "institution_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "role" "public"."institution_members_role_enum" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "institution_id" uuid, "user_id" uuid, CONSTRAINT "PK_2692ee8a0b3daf541ebfb370019" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65b07a8b043c4fa8347aab1abd" ON "institution_members"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5a2b9b326dc225259b98f2a09c" ON "institution_members"  ("institution_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'invited', 'suspended')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(255) NOT NULL, "password_hash" character varying(255), "full_name" character varying(255) NOT NULL, "phone" character varying(30), "status" "public"."users_status_enum" NOT NULL DEFAULT 'invited', "is_super_admin" boolean NOT NULL DEFAULT false, "notify_enrollment_approved" boolean NOT NULL DEFAULT true, "notify_dismissal_reminder" boolean NOT NULL DEFAULT true, "notify_delivery_confirmed" boolean NOT NULL DEFAULT true, "notify_product_news" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_log" ("id" BIGSERIAL NOT NULL, "action" character varying(100) NOT NULL, "entity_type" character varying(100) NOT NULL, "entity_id" character varying(100) NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor_user_id" uuid, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c4c8c76598008ea972a84e783" ON "audit_log"  ("actor_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ad7930a7c2af80585c8c1b770" ON "audit_log"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_43fef0ec7f613c19c612fffe62" ON "audit_log"  ("entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_8194052bdd62204f061dd44e0c9" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" ADD CONSTRAINT "FK_1d37c30aec3fae80ca41891c7e1" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_b03e0395920f1059d31254b2752" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_307813fe255896d6ebf3e6cd55c" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_73f727a7a6a89153fe392f90f7e" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_ed93d9a63fd05b10124583c80aa" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_7c3b4313cddacb99a3304a4eebb" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" ADD CONSTRAINT "FK_3ef5b60dbbab9389c50933ecff7" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_request_status_history" ADD CONSTRAINT "FK_0c02d1f723a65330b19a276a27a" FOREIGN KEY ("pickup_request_id") REFERENCES "pickup_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_request_status_history" ADD CONSTRAINT "FK_a546552e09d60f03deac7f66916" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "location_updates" ADD CONSTRAINT "FK_7453806778dd61703f2ac7b1c65" FOREIGN KEY ("pickup_request_id") REFERENCES "pickup_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ADD CONSTRAINT "FK_4a34e8526b1110cbb1a43cfc29a" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ADD CONSTRAINT "FK_63a84c8b8f9fab8a72372915600" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ADD CONSTRAINT "FK_3c5e365b1d654461a4b426be7bd" FOREIGN KEY ("guardian_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ADD CONSTRAINT "FK_363af868a948f5a6ad0e0f302da" FOREIGN KEY ("delivery_point_id") REFERENCES "delivery_points"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ADD CONSTRAINT "FK_7c7a2e0bbd462e00a61687ed5fc" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_points" ADD CONSTRAINT "FK_4dcd3ec0eae8a34167710788cd7" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_points" ADD CONSTRAINT "FK_af10e3ba8bb2104ea90c7bddaa6" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dismissal_windows" ADD CONSTRAINT "FK_05e6f6b054e448ca16d06fc6b89" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dismissal_exceptions" ADD CONSTRAINT "FK_9db89134a028bbdb24baff5ad27" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "institution_members" ADD CONSTRAINT "FK_157b9603d8b8db24ca45ef080df" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "institution_members" ADD CONSTRAINT "FK_65b07a8b043c4fa8347aab1abd3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "FK_1c4c8c76598008ea972a84e7834" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_log" DROP CONSTRAINT "FK_1c4c8c76598008ea972a84e7834"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institution_members" DROP CONSTRAINT "FK_65b07a8b043c4fa8347aab1abd3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "institution_members" DROP CONSTRAINT "FK_157b9603d8b8db24ca45ef080df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dismissal_exceptions" DROP CONSTRAINT "FK_9db89134a028bbdb24baff5ad27"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dismissal_windows" DROP CONSTRAINT "FK_05e6f6b054e448ca16d06fc6b89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_points" DROP CONSTRAINT "FK_af10e3ba8bb2104ea90c7bddaa6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_points" DROP CONSTRAINT "FK_4dcd3ec0eae8a34167710788cd7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" DROP CONSTRAINT "FK_7c7a2e0bbd462e00a61687ed5fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" DROP CONSTRAINT "FK_363af868a948f5a6ad0e0f302da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" DROP CONSTRAINT "FK_3c5e365b1d654461a4b426be7bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" DROP CONSTRAINT "FK_63a84c8b8f9fab8a72372915600"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" DROP CONSTRAINT "FK_4a34e8526b1110cbb1a43cfc29a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "location_updates" DROP CONSTRAINT "FK_7453806778dd61703f2ac7b1c65"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_request_status_history" DROP CONSTRAINT "FK_a546552e09d60f03deac7f66916"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pickup_request_status_history" DROP CONSTRAINT "FK_0c02d1f723a65330b19a276a27a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vehicles" DROP CONSTRAINT "FK_3ef5b60dbbab9389c50933ecff7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_7c3b4313cddacb99a3304a4eebb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_ed93d9a63fd05b10124583c80aa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_73f727a7a6a89153fe392f90f7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_307813fe255896d6ebf3e6cd55c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_b03e0395920f1059d31254b2752"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_1d37c30aec3fae80ca41891c7e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_guardians" DROP CONSTRAINT "FK_8194052bdd62204f061dd44e0c9"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_43fef0ec7f613c19c612fffe62"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2ad7930a7c2af80585c8c1b770"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1c4c8c76598008ea972a84e783"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5a2b9b326dc225259b98f2a09c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_65b07a8b043c4fa8347aab1abd"`);
    await queryRunner.query(`DROP TABLE "institution_members"`);
    await queryRunner.query(`DROP TYPE "public"."institution_members_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9bf15c234266fd3c914a610c41"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77249c5477cfb397eceed635fa"`);
    await queryRunner.query(`DROP TABLE "institutions"`);
    await queryRunner.query(`DROP TYPE "public"."institutions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."institutions_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e3b6178cb50e77d5b0c17fc66c"`);
    await queryRunner.query(`DROP TABLE "dismissal_exceptions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_236df3f75f78e4d68e4e9fbc76"`);
    await queryRunner.query(`DROP TABLE "dismissal_windows"`);
    await queryRunner.query(`DROP TYPE "public"."dismissal_windows_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4dcd3ec0eae8a34167710788cd"`);
    await queryRunner.query(`DROP TABLE "delivery_points"`);
    await queryRunner.query(`DROP TYPE "public"."delivery_points_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8d11147dc92b836a9d753c19bc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ed8344a391afb7463ffcf07d65"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_363af868a948f5a6ad0e0f302d"`);
    await queryRunner.query(`DROP TABLE "pickup_requests"`);
    await queryRunner.query(`DROP TYPE "public"."pickup_requests_arrival_mode_enum"`);
    await queryRunner.query(`DROP TYPE "public"."pickup_requests_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_772a0f744a54965a726e3ee959"`);
    await queryRunner.query(`DROP TABLE "location_updates"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5664ff0f681a6c047aa2212eb1"`);
    await queryRunner.query(`DROP TABLE "pickup_request_status_history"`);
    await queryRunner.query(`DROP TYPE "public"."pickup_request_status_history_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3ef5b60dbbab9389c50933ecff"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0108872f07b7d47a81bbdd4940"`);
    await queryRunner.query(`DROP TABLE "enrollments"`);
    await queryRunner.query(`DROP TYPE "public"."enrollments_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b03e0395920f1059d31254b275"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9a5bacc7e469f150cad96edc3a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1d37c30aec3fae80ca41891c7e"`);
    await queryRunner.query(`DROP TABLE "student_guardians"`);
    await queryRunner.query(`DROP TYPE "public"."student_guardians_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."student_guardians_relationship_enum"`);
  }
}
