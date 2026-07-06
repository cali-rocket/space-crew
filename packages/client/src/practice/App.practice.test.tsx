import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';

test('practice flow: lobby → selector → shell with counting HUD + reveal', () => {
  render(<App serverUrl="ws://localhost:0" />);

  // Lobby offers the practice entry.
  fireEvent.click(screen.getByTestId('practice-enter'));
  expect(screen.getByTestId('practice-selector')).toBeInTheDocument();

  // Pick a supported free-practice mission → drops into the practice shell.
  fireEvent.click(screen.getByTestId('practice-mission-1'));
  expect(screen.getByTestId('practice-shell')).toBeInTheDocument();
  expect(screen.getByTestId('counting-hud')).toBeInTheDocument();

  // Reveal drawer opens on demand and shows the practice watermark.
  fireEvent.click(screen.getByTestId('reveal-open'));
  expect(screen.getByTestId('reveal-drawer')).toBeInTheDocument();
});

test('unaided scaffolding hides the HUD and locks reveal', () => {
  render(<App serverUrl="ws://localhost:0" />);
  fireEvent.click(screen.getByTestId('practice-enter'));
  fireEvent.click(screen.getByTestId('practice-mission-1'));

  fireEvent.click(screen.getByTestId('level-unaided'));
  expect(screen.queryByTestId('counting-hud')).toBeNull();
  expect(screen.queryByTestId('reveal-open')).toBeNull(); // reveal locked at L3
});
