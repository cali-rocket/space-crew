import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from './App';
import type { ServerToClient } from '@space-crew/shared';

class FakeWS {
  static last: FakeWS | null = null;
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

test('App shows Lobby after room message', async () => {
  (globalThis as any).WebSocket = FakeWS;
  render(<App serverUrl="ws://localhost:0" />);

  // Simulate server sending a room message
  const roomMsg: ServerToClient = {
    t: 'room',
    code: 'ABC123',
    seats: [
      { player: 'p0', isBot: false, connected: true },
      { player: 'p1', isBot: true, connected: true },
      { player: 'p2', isBot: true, connected: true },
    ],
    started: false,
  };

  FakeWS.last?.onopen?.();
  FakeWS.last?.onmessage?.({ data: JSON.stringify(roomMsg) });

  await waitFor(() => {
    expect(screen.queryByText(/방 만들기|시작/i)).toBeInTheDocument();
  });
});

test('App shows GameTable after view message', async () => {
  (globalThis as any).WebSocket = FakeWS;
  render(<App serverUrl="ws://localhost:0" />);

  const viewMsg: ServerToClient = {
    t: 'view',
    view: {
      me: 'p0',
      myHand: [{ suit: 'blue', value: 7 }],
      seats: [
        { player: 'p0', isBot: false, connected: true, handCount: 1, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
        { player: 'p1', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
        { player: 'p2', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
      ],
      missionId: 1,
      attemptNumber: 1,
      phase: 'trick-in-progress',
      currentTrick: { leader: 'p0', plays: [], leadSuit: undefined },
      objectives: [],
      communicationPolicy: 'normal',
      distressActive: false,
      outcome: 'in-progress',
      legalMoves: [{ suit: 'blue', value: 7 }],
    },
  };

  FakeWS.last?.onopen?.();
  FakeWS.last?.onmessage?.({ data: JSON.stringify(viewMsg) });

  await waitFor(() => {
    expect(screen.queryByText(/Mission/i)).toBeInTheDocument();
  });
});

test('App sends create on onCreate button click', async () => {
  (globalThis as any).WebSocket = FakeWS;
  render(<App serverUrl="ws://localhost:0" />);

  // Trigger onopen so the connection is considered open and sends go through
  FakeWS.last?.onopen?.();

  // No room message sent — Lobby renders "방 만들기" by default when room is undefined
  // Wait for the button to be present, then click it unconditionally
  await waitFor(() => {
    expect(screen.getByText(/방 만들기/i)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText(/방 만들기/i));

  // Assert unconditionally that the create message was sent with default mission id (1)
  const lastSent = FakeWS.last!.sent[FakeWS.last!.sent.length - 1] as string;
  expect(lastSent).toBeDefined();
  expect(JSON.parse(lastSent)).toEqual({ t: 'create', missionId: 1 });
});

test('App sends start on onStart button click', async () => {
  (globalThis as any).WebSocket = FakeWS;
  render(<App serverUrl="ws://localhost:0" />);

  FakeWS.last?.onopen?.();

  // Show Lobby with started: false (so start button is visible)
  const roomMsg: ServerToClient = {
    t: 'room',
    code: 'ABC123',
    seats: [
      { player: 'p0', isBot: false, connected: true },
      { player: 'p1', isBot: true, connected: true },
      { player: 'p2', isBot: true, connected: true },
    ],
    started: false,
  };
  FakeWS.last?.onmessage?.({ data: JSON.stringify(roomMsg) });

  await waitFor(() => {
    expect(screen.queryByText(/시작/i)).toBeInTheDocument();
  });

  const startBtn = screen.getByText(/시작/i);
  fireEvent.click(startBtn);

  // Assert unconditionally that the start message was sent
  const lastSent = FakeWS.last!.sent[FakeWS.last!.sent.length - 1] as string;
  expect(lastSent).toBeDefined();
  expect(JSON.parse(lastSent)).toEqual({ t: 'start' });
});

test('App shows error message on nack', async () => {
  (globalThis as any).WebSocket = FakeWS;
  render(<App serverUrl="ws://localhost:0" />);

  FakeWS.last?.onopen?.();

  const nackMsg: ServerToClient = {
    t: 'nack',
    reason: 'Invalid action',
  };

  FakeWS.last?.onmessage?.({ data: JSON.stringify(nackMsg) });

  await waitFor(() => {
    expect(screen.queryByText(/Invalid action|Error/i)).toBeInTheDocument();
  });
});
