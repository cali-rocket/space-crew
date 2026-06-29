import type { ClientToServer, ServerToClient } from '@space-crew/shared';

export interface Conn {
  send(msg: ClientToServer): void;
  close(): void;
}

export function connect(
  url: string,
  handlers: { onMessage(msg: ServerToClient): void; onOpen?(): void; onClose?(): void },
): Conn {
  const WS = globalThis.WebSocket;
  const ws = new WS(url);
  let open = false;
  const queue: ClientToServer[] = [];
  (ws as unknown as { onopen: () => void }).onopen = () => {
    open = true;
    handlers.onOpen?.();
    for (const m of queue) {
      ws.send(JSON.stringify(m));
    }
    queue.length = 0;
  };
  (ws as unknown as { onmessage: (e: { data: string }) => void }).onmessage = (e) => {
    handlers.onMessage(JSON.parse(e.data) as ServerToClient);
  };
  (ws as unknown as { onclose: () => void }).onclose = () => {
    handlers.onClose?.();
  };
  return {
    send(msg) {
      if (open) {
        ws.send(JSON.stringify(msg));
      } else {
        queue.push(msg);
      }
    },
    close() {
      ws.close();
    },
  };
}
