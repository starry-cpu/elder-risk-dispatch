#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_URL =
  process.env.OPENAPI_URL || 'http://localhost:3000/api-json';

const bin = resolve(__dirname, 'node_modules', '.bin', 'openapi-typescript');

console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

try {
  execSync(
    `"${bin}" "${OPENAPI_URL}" -o index.ts`,
    { stdio: 'inherit', cwd: __dirname }
  );
  console.log('Types generated successfully to packages/shared-types/index.ts');
} catch (err) {
  console.error(`Primary generation failed: ${err.message}`);
  console.error('Trying fallback with local file...');

  try {
    execSync(
      `"${bin}" ../../apps/api/openapi.json -o index.ts`,
      { stdio: 'inherit', cwd: __dirname }
    );
    console.log('Types generated from local spec.');
  } catch (fallbackErr) {
    console.error(`Fallback generation also failed: ${fallbackErr.message}`);
    console.error('Ensure the API server is running or apps/api/openapi.json exists.');
    process.exitCode = 1;
  }
}
