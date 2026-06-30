import { startServer } from './wsServer';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { get } from 'http';

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

test('server serves the client index over HTTP, with SPA fallback, when clientDir is set', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-static-'));
  writeFileSync(join(dir, 'index.html'), '<html><body>SPACE CREW DEPLOY OK</body></html>');
  const srv = startServer(0, { seed: 1, clientDir: dir });
  await new Promise((r) => setTimeout(r, 100));

  const root = await fetchText(`http://127.0.0.1:${srv.port}/`);
  expect(root).toContain('SPACE CREW DEPLOY OK');

  // unknown path falls back to index.html (single-page app)
  const spa = await fetchText(`http://127.0.0.1:${srv.port}/lobby/whatever`);
  expect(spa).toContain('SPACE CREW DEPLOY OK');

  // path traversal must not leak files outside the client dir. Use URL-encoded
  // dots so the HTTP client doesn't normalize the `..` away before sending —
  // this exercises the server's decode + boundary guard for real.
  writeFileSync(join(dir, '..', 'secret.txt'), 'TOP SECRET');
  const escape = await fetchText(`http://127.0.0.1:${srv.port}/%2e%2e/secret.txt`);
  expect(escape).not.toContain('TOP SECRET');

  await srv.close();
}, 10000);
