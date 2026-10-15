// Installs dependencies on first run so `npm start` is the only command needed.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync(new URL('../node_modules/vite', import.meta.url))) {
  console.log('[neon-tempest] Installing dependencies (first run only)...');
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit' });
}
