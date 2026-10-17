// Standard Gauge back office: start-up. Picks the mode, prepares the data, then shows the screens.
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { makeDataProvider } from './config.js';
import './styles.css';

// the site's fonts (same Google Fonts link as index.html)
for (const [rel, href, cross] of [
  ['preconnect', 'https://fonts.googleapis.com'],
  ['preconnect', 'https://fonts.gstatic.com', true],
  ['stylesheet', 'https://fonts.googleapis.com/css2?family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=Shippori+Mincho:wght@400;600;800&display=swap'],
]) {
  const l = document.createElement('link');
  l.rel = rel; l.href = href;
  if (cross) l.crossOrigin = '';
  document.head.appendChild(l);
}

const root = createRoot(document.getElementById('root'));
makeDataProvider()
  .then(({ provider, persistent }) => root.render(<App provider={provider} persistent={persistent} />))
  .catch(e => root.render(<p className="fatal">Could not load: {String(e && e.message || e)}</p>));
