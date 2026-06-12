#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_URL =
  process.env.OPENAPI_URL || 'http://localhost:3000/api/docs-json';

const bin = resolve(__dirname, 'node_modules', '.bin', 'openapi-typescript');
const outputPath = resolve(__dirname, 'src', 'index.ts');

console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

try {
  execSync(
    `"${bin}" "${OPENAPI_URL}" -o "${outputPath}"`,
    { stdio: 'inherit', cwd: __dirname }
  );
  console.log(`Types generated successfully to ${outputPath}`);
} catch (err) {
  console.error(`Generation failed: ${err.message}`);
  console.error('Ensure the API server is running at http://localhost:3000/api/docs-json');
  process.exitCode = 1;
}
