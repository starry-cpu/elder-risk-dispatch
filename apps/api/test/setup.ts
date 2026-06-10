import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup() {
  console.log('Starting PostgreSQL test container...');
  const pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('care_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = pgContainer.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.DEVICE_HMAC_SECRET = 'e2e-test-hmac-secret';
  globalThis.__PG_CONTAINER__ = pgContainer;

  const apiDir = path.join(__dirname, '..');
  execSync(`npx prisma migrate deploy`, {
    cwd: apiDir,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });

  console.log('Test database ready');
}
