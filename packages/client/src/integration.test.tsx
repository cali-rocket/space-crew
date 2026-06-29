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
