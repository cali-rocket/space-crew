import type { ClientToServer, ServerToClient } from './protocol';

test('protocol message unions are well-typed', () => {
  const a: ClientToServer = { t: 'play-card', card: { suit: 'pink', value: 3 } };
  const b: ServerToClient = { t: 'nack', reason: 'illegal' };
  expect(a.t).toBe('play-card');
  expect(b.t).toBe('nack');
});
