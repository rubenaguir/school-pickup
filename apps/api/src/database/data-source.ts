import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

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
  entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
