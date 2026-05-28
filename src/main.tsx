import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const splash = document.getElementById('splash');

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Hide splash after first paint
requestAnimationFrame(() => {
  setTimeout(() => {
    splash?.classList.add('hide');
    setTimeout(() => splash?.remove(), 500);
  }, 250);
});
