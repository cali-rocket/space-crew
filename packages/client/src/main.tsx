import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
const url = `ws://${location.hostname}:8787`;
createRoot(document.getElementById('root')!).render(<App serverUrl={url} />);
