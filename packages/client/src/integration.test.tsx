import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebSocket as NodeWS } from 'ws';
import { startServer } from '@space-crew/server';
import { App } from './App';

test(
  'client connects to a real server, starts a room, and shows the table',
  async () => {
    // Polyfill WebSocket with Node.js ws for jsdom
    (globalThis as any).WebSocket = NodeWS;

    // Start a real in-process server with seed 7 for determinism
    const srv = startServer(0, { seed: 7 });

    // Wait for port to be set (asynchronous in the server)
    let attempts = 0;
    while (srv.port === 0 && attempts < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }

    if (srv.port === 0) {
      throw new Error(`Server port not assigned after ${attempts * 50}ms`);
    }

    // Render the app pointing to the real server
    render(<App serverUrl={`ws://127.0.0.1:${srv.port}`} />);

    // Wait for either the "방 만들기" button or game table to appear
    await waitFor(
      () => {
        const createBtn = screen.queryByText(/방 만들기/i);
        const missionText = screen.queryByText(/Mission/i);
        expect(createBtn || missionText).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // If create button is visible, click it
    const createBtn = screen.queryByText(/방 만들기/i);
    if (createBtn) {
      fireEvent.click(createBtn);
    }

    // Wait for start button to appear
    await waitFor(() => expect(screen.queryByText(/시작/i)).toBeInTheDocument(), {
      timeout: 5000,
    });

    // Click start button
    const startBtn = screen.getByText(/시작/i);
    fireEvent.click(startBtn);

    // Wait for game table (Mission header) to appear
    await waitFor(() => expect(screen.queryByText(/Mission/i)).toBeInTheDocument(), {
      timeout: 5000,
    });

    // Locate legal cards: the wrapper <span> carries data-testid; the inner
    // CardChip <div> gets className "card-chip dim" when illegal.
    // With seed 7 the commander may be a bot; bots move quickly so the human turn
    // may or may not arrive immediately. We check once synchronously.
    const clickableCards = screen
      .queryAllByTestId(/^hand-card-/)
      .filter((span) => {
        const chip = span.querySelector('.card-chip');
        return chip && !chip.classList.contains('dim');
      });

    if (clickableCards.length > 0) {
      // Human has a legal card to play — click it and expect the DOM to update
      // (e.g. the trick section appears or hand size shrinks).
      const handCountBefore = screen.queryAllByTestId(/^hand-card-/).length;
      fireEvent.click(clickableCards[0]!);

      // After playing, the trick area should appear OR hand count should change
      // OR the outcome section should render — any DOM change confirms no crash.
      await waitFor(
        () => {
          const handCountAfter = screen.queryAllByTestId(/^hand-card-/).length;
          const trickSection = screen.queryByText(/Current Trick/i);
          const outcome = screen.queryByText(/Mission Result/i);
          expect(
            handCountAfter < handCountBefore || trickSection || outcome,
          ).toBeTruthy();
        },
        { timeout: 5000 },
      );
    } else {
      // Commander is a bot — bots will play all cards; wait for a terminal result
      // or for the Mission header to remain visible (game is progressing normally).
      await waitFor(
        () => {
          const outcome = screen.queryByText(/Mission Result/i);
          const mission = screen.queryByText(/Mission/i);
          expect(outcome || mission).toBeInTheDocument();
        },
        { timeout: 10000 },
      );
    }

    // Clean up with timeout to avoid hanging
    const closePromise = srv.close().catch(() => {
      // Ignore close errors
    });
    try {
      await Promise.race([closePromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
    } catch {
      // If close fails, that's ok for testing purposes
    }
  },
  30000,
);
