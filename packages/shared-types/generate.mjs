import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const OPENAPI_URL =
  process.env.OPENAPI_URL || 'http://localhost:3000/api-json';

console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

try {
  execSync(
    `npx openapi-typescript "${OPENAPI_URL}" -o index.ts`,
    { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname }
  );
  console.log('Types generated successfully to packages/shared-types/index.ts');
} catch (err) {
  // Fallback: try local file
  console.log('Remote fetch failed, trying local file...');
  execSync(
    'npx openapi-typescript ../../apps/api/openapi.json -o index.ts',
    { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname }
  );
}
