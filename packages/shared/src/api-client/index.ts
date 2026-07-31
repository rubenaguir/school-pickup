/**
 * HTTP client shared by the three frontends (ADR-042 point 2).
 *
 * No TypeORM and no browser globals, so it lives in the root barrel rather
 * than behind a subpath like the entities do (ADR-033).
 */
export * from './api-error';
export * from './token-storage';
export * from './api-client';
export * from './auth-api';
