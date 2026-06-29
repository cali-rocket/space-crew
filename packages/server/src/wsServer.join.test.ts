import { startServer } from './index';
import { WebSocket } from 'ws';

function open(url: string) {
  return new Promise<WebSocket>((res, rej) => {
    const w = new WebSocket(url);
    w.on('open', () => res(w));
    w.on('error', (err) => rej(err));
    setTimeout(() => rej(new Error('WebSocket open timeout')), 5000);
  });
}

const next = (w: WebSocket, pred: (m: any) => boolean) =>
  new Promise<any>((res, rej) => {
    const h = (d: any) => {
      const m = JSON.parse(d.toString());
      if (pred(m)) {
        w.off('message', h);
        res(m);
      }
    };
    w.on('message', h);
    setTimeout(() => rej(new Error('next timeout')), 5000);
  });

test('host creates a room, a second client joins by code, both receive a view on start', async () => {
  const srv = startServer(0, { seed: 1 });

  // Wait for port assignment
  await new Promise((r) => setTimeout(r, 50));

  const url = `ws://127.0.0.1:${srv.port}`;
  const host = await open(url);
  host.send(JSON.stringify({ t: 'create', missionId: 1 }));
  const room = await next(host, (m) => m.t === 'room');
  expect(room.code).toBeTruthy();

  const guest = await open(url);
  guest.send(JSON.stringify({ t: 'join', code: room.code }));
  await next(guest, (m) => m.t === 'room');

  host.send(JSON.stringify({ t: 'start' }));
  const hv = await next(host, (m) => m.t === 'view');
  const gv = await next(guest, (m) => m.t === 'view');

  expect(hv.view.me).not.toBe(gv.view.me); // each sees their own seat
  host.close();
  guest.close();
  await srv.close();
}, 15000);
