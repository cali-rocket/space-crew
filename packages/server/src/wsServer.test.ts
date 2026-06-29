import { startServer } from './wsServer';
import { WebSocket } from 'ws';

test('client can connect, create a room, and receive a view', async () => {
  const srv = startServer(0, { seed: 1 });

  // Wait for the port to be assigned
  await new Promise((r) => setTimeout(r, 50));

  const url = `ws://127.0.0.1:${srv.port}`;
  const ws = new WebSocket(url);
  const got: any[] = [];
  await new Promise<void>((res, rej) => {
    ws.on('open', () => res());
    ws.on('error', (err) => rej(err));
    setTimeout(() => rej(new Error('WebSocket open timeout')), 5000);
  });
  ws.on('message', (d) => got.push(JSON.parse(d.toString())));
  ws.send(JSON.stringify({ t: 'create', missionId: 1 }));
  ws.send(JSON.stringify({ t: 'start' }));
  await new Promise((r) => setTimeout(r, 300));
  expect(got.some((m) => m.t === 'room' || m.t === 'view')).toBe(true);
  ws.close(); await srv.close();
}, 10000);
