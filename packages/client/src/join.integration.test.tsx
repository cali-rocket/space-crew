import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebSocket as NodeWS } from 'ws';
import { App } from './App';
import { startServer } from '@space-crew/server';
import { describe, test, expect, afterEach, beforeEach } from 'vitest';

/** Wait for the next message from a NodeWS that satisfies `pred`. */
function nextMsg(w: InstanceType<typeof NodeWS>, pred: (m: unknown) => boolean): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('nextMsg timeout')), 8000);
    const handler = (data: Buffer | string) => {
      const m = JSON.parse(data.toString()) as unknown;
      if (pred(m)) {
        clearTimeout(timeout);
        w.off('message', handler);
        resolve(m);
      }
    };
    w.on('message', handler);
  });
}

function openWS(url: string): Promise<InstanceType<typeof NodeWS>> {
  return new Promise((resolve, reject) => {
    const ws = new NodeWS(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
    setTimeout(() => reject(new Error('WS open timeout')), 5000);
  });
}

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
      render(<App serverUrl={url} key="host" />);

      // Wait for host lobby to appear
      await waitFor(
        () => {
          expect(screen.getByText(/SPACE CREW/i)).toBeInTheDocument();
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
          const codeEl = screen.getByTestId('room-code');
          expect(codeEl).toBeInTheDocument();
          roomCode = codeEl.textContent || '';
          expect(roomCode).toBeTruthy();
        },
        { timeout: 5000 }
      );

      // Guest joins via raw WebSocket (one App + one ws guest per spec)
      const guestWS = await openWS(url);
      const guestRoomPromise = nextMsg(guestWS, (m) => (m as any).t === 'room');
      guestWS.send(JSON.stringify({ t: 'join', code: roomCode }));
      await guestRoomPromise;

      // Host starts the game - wait for start button to be available
      await waitFor(
        () => {
          expect(screen.queryByText(/시작/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Guest listens for view before host clicks start
      const guestViewPromise = nextMsg(guestWS, (m) => (m as any).t === 'view');

      const startButton = screen.getByText(/시작/i);
      fireEvent.click(startButton);

      // Host's App should transition to GameTable
      await waitFor(
        () => {
          expect(screen.getByText(/Mission 5/)).toBeInTheDocument();
          expect(screen.getByText(/크루/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Guest also receives a view with a different seat than the host
      const guestView = (await guestViewPromise) as { view: { me: string } };
      expect(guestView.view.me).toBeTruthy();
      // Guest seat is different from the host's (host is 'host-1' by server naming)
      expect(guestView.view.me).not.toBe('host-1');

      guestWS.close();
    },
    30000
  );

});
