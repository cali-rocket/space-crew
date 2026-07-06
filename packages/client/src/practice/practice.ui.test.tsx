import { describe, it, expect } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { Advice, CountingState, PlayerView } from '@space-crew/engine';
import { usePracticeState } from './usePracticeState';
import { CountingHUD } from './CountingHUD';
import { CoachPanel } from './CoachPanel';

const baseView: PlayerView = {
  me: 'me',
  myHand: [{ suit: 'pink', value: 7 }],
  seats: [
    { player: 'me', isBot: false, connected: true, handCount: 1, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
    { player: 'bot-1', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    { player: 'bot-2', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
  ],
  missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
  currentTrick: { leader: 'bot-1', plays: [] },
  objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
};

describe('usePracticeState', () => {
  it('derives counting from the view', () => {
    const { result } = renderHook(() => usePracticeState(baseView));
    expect(result.current.counting.remaining.pink).not.toContain(7); // my own card excluded
    expect(result.current.counting.rockets.remaining).toBe(4);
  });
});

const cs: CountingState = {
  remaining: { pink: [1, 2, 3], blue: [1, 2, 3, 4, 5, 6, 7, 8, 9], green: [], yellow: [5] },
  rockets: { played: [1, 2], remaining: 2 },
  voids: { me: [], 'bot-1': ['blue'], 'bot-2': [] },
  masters: [{ suit: 'pink', value: 3 }],
  reconstructed: {},
  perfectInfo: false,
};

describe('CountingHUD', () => {
  it('shows outstanding rockets and live/seen cells', () => {
    const { getByTestId } = render(<CountingHUD counting={cs} showMasters showVoids />);
    expect(getByTestId('hud-rockets').textContent).toContain('2');
    expect(getByTestId('hud-cell-pink-3').className).toContain('live');
    expect(getByTestId('hud-cell-pink-3').className).toContain('master');
    expect(getByTestId('hud-cell-green-1').className).toContain('seen');
    expect(getByTestId('hud-voids').textContent).toContain('bot-1');
  });

  it('hides masters and voids when scaffolding withholds them', () => {
    const { getByTestId, queryByTestId } = render(<CountingHUD counting={cs} showMasters={false} showVoids={false} />);
    expect(getByTestId('hud-cell-pink-3').className).not.toContain('master');
    expect(queryByTestId('hud-voids')).toBeNull();
  });
});

describe('CoachPanel', () => {
  it('renders each advice with its principle tag and message', () => {
    const advice: Advice[] = [
      { principle: 'low-task', severity: 'danger', message: '네 태스크 노랑2는 …' },
      { principle: 'master', severity: 'info', message: '초록7는 마스터 …' },
    ];
    const { getByTestId } = render(<CoachPanel advice={advice} />);
    expect(getByTestId('advice-low-task').className).toContain('danger');
    expect(getByTestId('advice-low-task').textContent).toContain('저카드 태스크');
    expect(getByTestId('advice-master').textContent).toContain('마스터');
  });
});
