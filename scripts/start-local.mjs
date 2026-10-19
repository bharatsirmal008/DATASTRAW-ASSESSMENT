import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, 'server/dist/server.js')) || !existsSync(resolve(root, 'client/dist/index.html'))) {
  console.error('Run npm run build before npm start.');
  process.exit(1);
}
const processes = [
  spawn(process.execPath, ['dist/server.js'], { cwd: resolve(root, 'server'), stdio: 'inherit', windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', PORT: process.env.PORT || '5173' } }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  processes.forEach(child => child.kill());
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
processes.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code || 0));
});
console.log(`Aura application and API: http://127.0.0.1:${process.env.PORT || '5173'}`);
