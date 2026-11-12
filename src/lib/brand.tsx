import { createContext, useContext } from 'react';
import type { Branding } from './api';

export const fallbackBranding: Branding = {
  tenant: 'zenerlink',
  display_name: 'Zenerlink',
  logo_url: '',
  logo_dark_url: '',
  theme: {},
  font_family: 'Satoshi',
  support_email: '',
  support_phone: '',
  support_url: '',
  currency: 'NGN',
  locale: 'en-NG',
  features: {},
  sandbox: false,
};

export const BrandContext = createContext<Branding>(fallbackBranding);
export const useBrand = () => useContext(BrandContext);
