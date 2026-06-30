import { render, screen, fireEvent } from '@testing-library/react';
import { Lobby } from './Lobby';

test('distress off: create passes mission id only', () => {
  const onCreate = vi.fn();
  render(<Lobby onCreate={onCreate} onStart={() => {}} onJoin={() => {}} />);
  fireEvent.click(screen.getByText(/방 만들기/));
  expect(onCreate).toHaveBeenCalledWith(1);
});

test('distress on: create passes the distress option with direction', () => {
  const onCreate = vi.fn();
  render(<Lobby onCreate={onCreate} onStart={() => {}} onJoin={() => {}} />);
  fireEvent.click(screen.getByTestId('distress-toggle'));
  fireEvent.change(screen.getByTestId('distress-direction'), { target: { value: 'left' } });
  fireEvent.click(screen.getByText(/방 만들기/));
  expect(onCreate).toHaveBeenCalledWith(1, { active: true, direction: 'left' });
});
