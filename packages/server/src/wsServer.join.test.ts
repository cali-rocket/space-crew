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

  // Each player sees their own seat
  expect(hv.view.me).not.toBe(gv.view.me);

  // Each view exposes only the viewer's own hand (hidden-info invariant)
  expect(hv.view.myHand).toBeDefined();
  expect(gv.view.myHand).toBeDefined();
  // Opponent hand contents must not appear in the viewer's myHand
  const hvHandSet = new Set(
    (hv.view.myHand as Array<{ suit: string; value: number }>).map((c) => `${c.suit}:${c.value}`)
  );
  for (const card of gv.view.myHand as Array<{ suit: string; value: number }>) {
    expect(hvHandSet.has(`${card.suit}:${card.value}`)).toBe(false);
  }

  host.close();
  guest.close();
  await srv.close();
}, 15000);

test('guest cannot start the game — only the host can', async () => {
  const srv = startServer(0, { seed: 2 });
  await new Promise((r) => setTimeout(r, 50));

  const url = `ws://127.0.0.1:${srv.port}`;
  const host = await open(url);
  host.send(JSON.stringify({ t: 'create', missionId: 1 }));
  const room = await next(host, (m) => m.t === 'room');

  const guest = await open(url);
  guest.send(JSON.stringify({ t: 'join', code: room.code }));
  await next(guest, (m) => m.t === 'room');

  // Guest tries to start — should receive nack
  guest.send(JSON.stringify({ t: 'start' }));
  const nack = await next(guest, (m) => m.t === 'nack');
  expect(nack.reason).toMatch(/host/i);

  host.close();
  guest.close();
  await srv.close();
}, 15000);

test('room is GC-ed after all human players disconnect', async () => {
  const srv = startServer(0, { seed: 3 });
  await new Promise((r) => setTimeout(r, 50));

  const url = `ws://127.0.0.1:${srv.port}`;
  const host = await open(url);
  host.send(JSON.stringify({ t: 'create', missionId: 1 }));
  const room = await next(host, (m) => m.t === 'room');
  const code: string = room.code;

  // Disconnect host — room should be GC-ed
  host.close();
  await new Promise((r) => setTimeout(r, 100));

  // A new client tries to join the (now-deleted) room and should get nack
  const stranger = await open(url);
  stranger.send(JSON.stringify({ t: 'join', code }));
  const nack = await next(stranger, (m) => m.t === 'nack');
  expect(nack.reason).toMatch(/room not found/i);

  stranger.close();
  await srv.close();
}, 15000);
