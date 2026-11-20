import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { APP_MODE } from './lib/api';
import VendRoot from './vend/VendApp';
import './styles/index.css';

// Links people open from payments, emails and QR codes always use the
// buy-only view: order pages (Paystack return), password resets, token shares,
// payment requests and meter QR stickers. The buy app's own pages are listed
// too, so refreshing one of them (on staging, where "/" is the full
// dashboard) stays in the buy app instead of dropping to the dashboard.
const VEND_PATHS = [
  '/order/', '/reset-password', '/t/', '/pay/', '/buy', '/staff', '/gift/', '/units',
  '/home', '/electricity', '/transactions', '/meters', '/wallet', '/profile', '/password', '/help', '/airtime', '/tv',
];
const vend = APP_MODE === 'vend' || VEND_PATHS.some((p) => window.location.pathname.startsWith(p));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{vend ? <VendRoot /> : <App />}</React.StrictMode>,
);
