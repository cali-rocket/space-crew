import { render, screen, fireEvent } from '@testing-library/react';
import { Lobby } from './Lobby';
import { describe, test, expect, vi } from 'vitest';

describe('Lobby mission selection', () => {
  test('host picks a mission and creates with it', () => {
    const onCreate = vi.fn();
    render(<Lobby onCreate={onCreate} onStart={() => {}} />);
    fireEvent.change(screen.getByTestId('mission-select'), { target: { value: '9' } });
    fireEvent.click(screen.getByText(/방 만들기/));
    expect(onCreate).toHaveBeenCalledWith(9);
  });
});
