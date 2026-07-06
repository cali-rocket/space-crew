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

test('guided lesson: selector → fixed-deal shell with a goal banner', () => {
  render(<App serverUrl="ws://localhost:0" />);
  fireEvent.click(screen.getByTestId('practice-enter'));

  // Guided lessons listed; starting one drops into the shell with its goal.
  fireEvent.click(screen.getByTestId('lesson-win-low-card'));
  expect(screen.getByTestId('practice-shell')).toBeInTheDocument();
  expect(screen.getByTestId('lesson-goal').textContent).toContain('노랑2');
  // The pre-assigned task is on the table.
  expect(screen.getByTestId('counting-hud')).toBeInTheDocument();
});

test('L2 test mode quizzes the learner and records mastery; drill + mastery rails present', () => {
  render(<App serverUrl="ws://localhost:0" />);
  fireEvent.click(screen.getByTestId('practice-enter'));
  fireEvent.click(screen.getByTestId('practice-mission-1'));

  // Left-rail drill + mastery always present.
  expect(screen.getByTestId('drill-controls')).toBeInTheDocument();
  expect(screen.getByTestId('mastery-meter')).toBeInTheDocument();

  // Switch to L2 → HUD replaced by the quiz.
  fireEvent.click(screen.getByTestId('level-test'));
  expect(screen.queryByTestId('counting-hud')).toBeNull();
  expect(screen.getByTestId('quiz-panel')).toBeInTheDocument();
  expect(screen.getByTestId('quiz-rockets')).toBeInTheDocument();

  // Grade → per-quiz result appears and mastery rolls up.
  fireEvent.click(screen.getByTestId('quiz-submit'));
  expect(screen.getByTestId('quiz-result-rockets')).toBeInTheDocument();
  expect(screen.getByTestId('mastery-rockets')).toBeInTheDocument();
});
