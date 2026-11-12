import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { APP_MODE } from './lib/api';
import VendRoot from './vend/VendApp';
import './styles/index.css';

// Order pages (the Paystack return URL) always use the buy-only view.
const vend = APP_MODE === 'vend' || window.location.pathname.startsWith('/order/');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{vend ? <VendRoot /> : <App />}</React.StrictMode>,
);
