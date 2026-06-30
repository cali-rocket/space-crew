/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// In production the client is served by the game server itself → connect to the same origin.
// In dev (vite), the ws server runs separately on :8787. Override with VITE_WS_URL if needed.
const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const url =
  (import.meta.env.VITE_WS_URL as string | undefined) ??
  (import.meta.env.PROD ? `${wsProto}://${location.host}` : `ws://${location.hostname}:8787`);

createRoot(document.getElementById('root')!).render(<App serverUrl={url} />);
