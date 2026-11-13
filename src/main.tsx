import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { APP_MODE } from './lib/api';
import VendRoot from './vend/VendApp';
import './styles/index.css';

// Links people open from payments, emails and QR codes always use the
// buy-only view: order pages (Paystack return), password resets, token shares.
const VEND_PATHS = ['/order/', '/reset-password', '/t/'];
const vend = APP_MODE === 'vend' || VEND_PATHS.some((p) => window.location.pathname.startsWith(p));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{vend ? <VendRoot /> : <App />}</React.StrictMode>,
);
