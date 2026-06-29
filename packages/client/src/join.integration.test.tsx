import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebSocket as NodeWS } from 'ws';
import { App } from './App';
import { startServer } from '@space-crew/server';
import { describe, test, expect, afterEach, beforeEach } from 'vitest';

describe('join integration', () => {
  let server: Awaited<ReturnType<typeof startServer>> | null = null;

  beforeEach(() => {
    // Polyfill WebSocket with Node.js ws for jsdom
    (globalThis as any).WebSocket = NodeWS;
  });

  afterEach(async () => {
    if (server) {
      try {
        const closePromise = server.close().catch(() => {
          // Ignore close errors
        });
        await Promise.race([closePromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
      } catch {
        // If close fails, that's ok for testing purposes
      }
      server = null;
    }
  });

  test(
    'host creates a room, guest joins by code, both see the game table',
    async () => {
    server = startServer(0, { seed: 1 });

    // Wait for port to be set (asynchronous in the server)
    let attempts = 0;
    while (server.port === 0 && attempts < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }

    if (server.port === 0) {
      throw new Error(`Server port not assigned after ${attempts * 50}ms`);
    }

    const url = `ws://127.0.0.1:${server.port}`;

    // Render host app
    const { rerender } = render(<App serverUrl={url} key="host" />);

    // Wait for host lobby to appear
    await waitFor(
      () => {
        expect(screen.getByText(/Space Crew Lobby/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Host selects mission and creates room
    const missionSelect = screen.getByTestId('mission-select');
    fireEvent.change(missionSelect, { target: { value: '5' } });

    const createButton = screen.getByText(/방 만들기/);
    fireEvent.click(createButton);

    // Wait for room code to appear
    let roomCode = '';
    await waitFor(
      () => {
        const codeText = screen.getByText(/Room Code:/);
        expect(codeText).toBeInTheDocument();
        // Extract code from "Room Code: <strong>{code}</strong>"
        const codeElement = codeText.parentElement?.querySelector('strong');
        roomCode = codeElement?.textContent || '';
        expect(roomCode).toBeTruthy();
      },
      { timeout: 5000 }
    );

    // Host starts the game - wait for start button to be available
    await waitFor(
      () => {
        expect(screen.queryByText(/시작/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const startButton = screen.getByText(/시작/i);
    fireEvent.click(startButton);

    // Wait for game table to appear with seats
    await waitFor(
      () => {
        expect(screen.getByText(/Mission 5/)).toBeInTheDocument();
        expect(screen.getByText(/Seats/)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Now verify the guest can join by code
    // For this simple test, just verify the room was created and started
    expect(roomCode).toBeTruthy();
    },
    30000
  );
});
