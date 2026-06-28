import { orderViolated } from './order';
import { TaskAssignment } from './state';
import { Card } from './cards';

const t = (card: Card, fulfilled: boolean, order?: TaskAssignment['order']): TaskAssignment =>
  ({ card, owner: 'p0', fulfilled, order });
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });

test('absolute: ok when fulfilled in ascending position order', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'absolute', position: 1 }), t(C('blue', 1), false, { kind: 'absolute', position: 2 })];
  expect(orderViolated(tasks)).toBe(false);
});

test('absolute: violated when a later position is fulfilled before an earlier one', () => {
  const tasks = [t(C('pink', 1), false, { kind: 'absolute', position: 1 }), t(C('blue', 1), true, { kind: 'absolute', position: 2 })];
  expect(orderViolated(tasks)).toBe(true);
});

test('absolute: consecutive positions fulfilled together is ok', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'absolute', position: 1 }), t(C('blue', 1), true, { kind: 'absolute', position: 2 })];
  expect(orderViolated(tasks)).toBe(false);
});

test('last (Ω): violated when fulfilled while another task pending', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'last' }), t(C('blue', 1), false)];
  expect(orderViolated(tasks)).toBe(true);
});

test('last (Ω): ok when fulfilled after all others', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'last' }), t(C('blue', 1), true)];
  expect(orderViolated(tasks)).toBe(false);
});

test('relative: violated when higher chevron fulfilled before lower', () => {
  const tasks = [t(C('pink', 1), false, { kind: 'relative', chevrons: 1 }), t(C('blue', 1), true, { kind: 'relative', chevrons: 2 })];
  expect(orderViolated(tasks)).toBe(true);
});

test('no order tokens → never violated', () => {
  const tasks = [t(C('pink', 1), true), t(C('blue', 1), false)];
  expect(orderViolated(tasks)).toBe(false);
});
