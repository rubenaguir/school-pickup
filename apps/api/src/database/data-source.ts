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
  entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});

export default AppDataSource;
