import { startServer } from './wsServer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Production entry: serve the built client and the WebSocket game on one port.
const port = Number(process.env.PORT ?? 8787);
const clientDir = process.env.CLIENT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), 'public');

startServer(port, { clientDir, host: '0.0.0.0' });
// eslint-disable-next-line no-console
console.log(`Space Crew listening on :${port} (client: ${clientDir})`);
