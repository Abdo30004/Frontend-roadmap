import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import { App } from './App';

// No StrictMode on purpose: the live demos should behave exactly like production
// (StrictMode double-runs effects in dev, which would change what some bugs look like).
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
