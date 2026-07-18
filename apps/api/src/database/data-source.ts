import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import * as entities from '@casillego/shared/entities';

try {
  process.loadEnvFile(join(__dirname, '../../../../.env'));
} catch {
  // No .env file present (e.g. CI/prod inject env vars directly) — ignore.
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  // pgcrypto's gen_random_uuid() is the extension powering uuid PKs — enabled
  // out-of-band by a superuser (external Postgres prerequisite, same as
  // PostGIS; see infra/README.md). Set explicitly so behavior doesn't depend
  // on TypeORM's silent uuid-ossp fallback.
  uuidExtension: 'pgcrypto',
  // Explicit list, never a glob: the entities live in @casillego/shared/entities
  // (ADR-033) and TypeORM does not error on a glob that matches nothing — it
  // would silently treat the schema as empty and make migration:generate emit a
  // migration dropping every table.
  entities: Object.values(entities),
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
