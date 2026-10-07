// Starts the web dev server in Busuu local walkthrough mode (development only; see lib/busuu/local-walkthrough.ts).
// Usage (from anywhere): node apps/web/scripts/busuu-walkthrough.mjs [port]   (default 3100)
//
// - Sets BUSUU_LOCAL_WALKTHROUGH=1 for the server process (cross-platform, no shell syntax, no dependencies).
// - Binds to 127.0.0.1 only, so the synthetic owner is never reachable from the network.
// - Replaces the hosted Supabase settings for this process with inert values, so even a code path that tried to
//   reach Supabase could not contact the hosted project. Values already present in process.env win over .env.local.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.argv[2] ?? '3100';
if (!/^\d{2,5}$/.test(port)) { console.error(`Invalid port: ${port}`); process.exit(2); }
const next = createRequire(path.join(webRoot, 'package.json')).resolve('next/dist/bin/next');

const child = spawn(process.execPath, [next, 'dev', '-p', port, '-H', '127.0.0.1'], {
  cwd: webRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    BUSUU_LOCAL_WALKTHROUGH: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'busuu-local-walkthrough-unused',
    SUPABASE_SERVICE_ROLE_KEY: '',
  },
});
const stop = signal => () => child.kill(signal);
process.on('SIGINT', stop('SIGINT'));
process.on('SIGTERM', stop('SIGTERM'));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
