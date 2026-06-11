import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import * as path from 'path';

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
  var __REDIS_CONTAINER__: StartedRedisContainer | undefined;
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

  console.log('Starting Redis test container...');
  const redisContainer = await new RedisContainer('redis:7-alpine').start();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();
  globalThis.__REDIS_CONTAINER__ = redisContainer;

  console.log('Redis test container ready');
}
