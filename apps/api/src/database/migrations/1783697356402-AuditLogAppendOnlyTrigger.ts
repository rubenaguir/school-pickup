import { MigrationInterface, QueryRunner } from 'typeorm';

// audit_log is a forensic/legal log (LFPDPPP) and must stay append-only even
// against the table owner, which a REVOKE UPDATE/DELETE cannot do (owners
// bypass ACLs) — see ADR-026 point 4 and its amendment.
//
// DELETE is rejected unconditionally. UPDATE is rejected unless it is exactly
// the shape produced by users.id ON DELETE SET NULL cascading into
// audit_log.actor_user_id (actor_user_id goes from non-null to null, no other
// column changes) — that FK behavior is spec'd (specs/entities/user.md) and
// must keep working.
export class AuditLogAppendOnlyTrigger1783697356402 implements MigrationInterface {
  name = 'AuditLogAppendOnlyTrigger1783697356402';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION audit_log_block_mutation() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD.actor_user_id IS NOT NULL
          AND NEW.actor_user_id IS NULL
          AND NEW.action = OLD.action
          AND NEW.entity_type = OLD.entity_type
          AND NEW.entity_id = OLD.entity_id
          AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
          AND NEW.created_at = OLD.created_at
        THEN
          RETURN NEW;
        END IF;

        RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER audit_log_append_only
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER audit_log_append_only ON audit_log`);
    await queryRunner.query(`DROP FUNCTION audit_log_block_mutation()`);
  }
}
