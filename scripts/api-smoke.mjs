import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const root = process.cwd();
const server = readFileSync(join(root, 'server.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const requiredRoutes = [
  'app.post("/api/auth/login"',
  'app.post("/api/auth/refresh"',
  'app.get("/api/dashboard/summary"',
  'app.get("/api/mobile/bootstrap"',
  'app.get("/api/siac"',
  'app.get("/api/audit"',
  'app.get("/api/document-files"',
  'app.get("/api/channels/messages"',
  'app.get("/api/vision/status"',
  'app.get("/api/enterprise/health"',
];

for (const route of requiredRoutes) {
  assert(server.includes(route), `Missing route contract: ${route}`);
}

assert(server.includes('createApp()'), 'server.ts should use the shared Express app factory');
assert(server.includes('parseLimit('), 'server.ts should use bounded API limits');
assert(packageJson.scripts?.lint, 'Missing lint script');
assert(packageJson.scripts?.build, 'Missing build script');
assert(packageJson.scripts?.['enterprise:check'], 'Missing enterprise:check script');

console.log('API smoke contract');
console.log(`OK: ${requiredRoutes.length} critical routes and backend guardrails are present.`);
