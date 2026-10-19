import { createRequire } from 'node:module';
import { readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Compile with the backend's declared esbuild dependency; no npx downloads or
// OS user-info lookup are needed. Both application dependencies must be installed.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'server/package.json'));
const { build } = require('esbuild');
const target = process.argv[2];
if (!['server', 'client'].includes(target)) throw new Error('Expected server or client');
const directory = resolve(root, target);
const tests = (await readdir(resolve(directory, 'tests'))).filter(name => name.endsWith('.test.ts'));
const outputs = [];
await mkdir(resolve(directory, '.test-build'), { recursive: true });
for (const test of tests) {
  const outfile = resolve(directory, '.test-build', test.replace(/\.ts$/, '.cjs'));
  await build({ entryPoints: [resolve(directory, 'tests', test)], outfile,
    bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    packages: 'external', sourcemap: 'inline', logLevel: 'warning',
    define: target === 'client' ? { 'import.meta.env.VITE_API_URL': '""' } : {} });
  outputs.push(outfile);
}
const result = spawnSync(process.execPath, ['--test', ...outputs], { cwd: directory, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', AI_PROVIDER: 'demo', SUMMARY_PROVIDER: 'demo' } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
