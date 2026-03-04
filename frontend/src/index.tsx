// index.tsx
// The very first file that runs in the browser.
// It mounts the React app into the <div id="root"> element in public/index.html.
// React.StrictMode wraps the app during development to surface potential problems early.

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
