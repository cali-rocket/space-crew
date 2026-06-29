import { render, screen } from '@testing-library/react';
import { App } from './App';
test('App renders', () => {
  render(<App serverUrl="ws://localhost:0" />);
  expect(screen.getByText(/Space Crew/i)).toBeInTheDocument();
});
