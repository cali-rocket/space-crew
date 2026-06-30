// Builds a single deployable artifact in deploy/ : server.mjs (bundled) + public/ (client).
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const root = process.cwd();
console.log('[build-deploy] cleaning deploy/');
rmSync('deploy', { recursive: true, force: true });
mkdirSync('deploy', { recursive: true });

console.log('[build-deploy] building client (vite)…');
execSync('npm run build --workspace @space-crew/client', { stdio: 'inherit', cwd: root });

console.log('[build-deploy] bundling server (esbuild)…');
await build({
  entryPoints: ['packages/server/src/prod.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'deploy/server.mjs',
  banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" },
});

const clientDist = 'packages/client/dist';
if (!existsSync(clientDist)) throw new Error('client build missing: ' + clientDist);
console.log('[build-deploy] copying client → deploy/public');
cpSync(clientDist, 'deploy/public', { recursive: true });

console.log('[build-deploy] done. Run: PORT=8787 node deploy/server.mjs');
