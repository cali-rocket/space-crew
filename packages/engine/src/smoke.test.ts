import { ENGINE_VERSION } from './index';

test('engine package builds and tests run', () => {
  expect(ENGINE_VERSION).toBe('0.0.0');
});
