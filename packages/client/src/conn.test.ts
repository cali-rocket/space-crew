import { connect } from './conn';
import type { ServerToClient } from '@space-crew/shared';

class FakeWS {
  static last: FakeWS;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) {
    FakeWS.last = this;
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.onclose?.();
  }
}

test('connect sends JSON and parses incoming messages', () => {
  (globalThis as any).WebSocket = FakeWS;
  const got: ServerToClient[] = [];
  const c = connect('ws://x', { onMessage: (m) => got.push(m) });
  FakeWS.last.onopen?.();
  c.send({ t: 'create', missionId: 1 });
  expect(JSON.parse(FakeWS.last.sent[0]!)).toEqual({ t: 'create', missionId: 1 });
  FakeWS.last.onmessage?.({ data: JSON.stringify({ t: 'nack', reason: 'x' }) });
  expect(got).toEqual([{ t: 'nack', reason: 'x' }]);
});
