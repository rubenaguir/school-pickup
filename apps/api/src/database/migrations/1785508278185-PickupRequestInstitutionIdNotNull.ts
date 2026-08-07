import { MigrationInterface, QueryRunner } from 'typeorm';

// pickup_requests.institution_id tightened to NOT NULL, aligning the real
// schema with what specs/entities/pickup_request.md and ADR-018 already
// declared: a denormalized, mandatory column fixed at creation and immutable
// afterwards (ADR-026).
//
// The divergence predates ADR-044 — the entity declared the field
// non-nullable in TypeScript while Postgres accepted NULL, and
// migration:generate proposed this SET NOT NULL on every run without it ever
// being applied. Replacing the companion column with @RelationId() (ADR-044)
// removed that recurring signal, so the drift would have become silent.
//
// This column is not incidental: InstitutionMembershipGuard authorizes
// PATCH /pickup-requests/:id/deliver with it, and it decides which
// per-institution MQTT topic each status update is published to — the
// multi-tenant isolation boundary (docs/arquitectura.md). See ADR-045.
export class PickupRequestInstitutionIdNotNull1785508278185 implements MigrationInterface {
  name = 'PickupRequestInstitutionIdNotNull1785508278185';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fails loudly if any row still holds NULL — that is the intended
    // behaviour: better to stop than to apply over inconsistent data
    // (ADR-045 point 2).
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ALTER COLUMN "institution_id" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pickup_requests" ALTER COLUMN "institution_id" DROP NOT NULL`,
    );
  }
}
