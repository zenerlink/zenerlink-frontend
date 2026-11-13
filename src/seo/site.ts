// Search and sharing data for the public site. Used by the app (page titles
// while navigating) and by scripts/prerender.ts (static HTML per page, the
// sitemap and structured data), so both always agree.

export const SITE_URL = 'https://www.zenerlink.com';
export const SITE_NAME = 'Zenerlink';
export const COMPANY = 'Zieon Energies Ltd';
export const COMPANY_RC = '9519634';
export const SUPPORT_EMAIL = 'support@zieonenergies.com';

export type DiscoSeo = {
  code: string; // provider code used by the API
  slug: string; // /electricity/<slug>
  name: string; // common name
  legal: string; // full company name
  areas: string; // states and areas served
};

export const DISCOS: DiscoSeo[] = [
  { code: 'IKEDC', slug: 'ikeja-electric', name: 'Ikeja Electric (IKEDC)', legal: 'Ikeja Electricity Distribution Company', areas: 'Lagos (Ikeja, Ikorodu, Alimosho, Oshodi and the mainland north)' },
  { code: 'EKEDC', slug: 'eko-electricity', name: 'Eko Electricity (EKEDC)', legal: 'Eko Electricity Distribution Company', areas: 'Lagos (Lagos Island, Lekki, Ajah, Ojo, Festac and the south) and parts of Ogun' },
  { code: 'AEDC', slug: 'abuja-electricity', name: 'Abuja Electricity (AEDC)', legal: 'Abuja Electricity Distribution Company', areas: 'FCT Abuja, Niger, Kogi and Nasarawa' },
  { code: 'IBEDC', slug: 'ibadan-electricity', name: 'Ibadan Electricity (IBEDC)', legal: 'Ibadan Electricity Distribution Company', areas: 'Oyo, Ogun, Osun, Kwara and parts of Niger, Ekiti and Kogi' },
  { code: 'EEDC', slug: 'enugu-electricity', name: 'Enugu Electricity (EEDC)', legal: 'Enugu Electricity Distribution Company', areas: 'Enugu, Anambra, Imo, Ebonyi and Abia' },
  { code: 'PHED', slug: 'port-harcourt-electricity', name: 'Port Harcourt Electricity (PHED)', legal: 'Port Harcourt Electricity Distribution Company', areas: 'Rivers, Bayelsa, Cross River and Akwa Ibom' },
  { code: 'KEDCO', slug: 'kano-electricity', name: 'Kano Electricity (KEDCO)', legal: 'Kano Electricity Distribution Company', areas: 'Kano, Katsina and Jigawa' },
  { code: 'KEDC', slug: 'kaduna-electric', name: 'Kaduna Electric (KAEDCO)', legal: 'Kaduna Electricity Distribution Company', areas: 'Kaduna, Kebbi, Sokoto and Zamfara' },
  { code: 'JED', slug: 'jos-electricity', name: 'Jos Electricity (JED)', legal: 'Jos Electricity Distribution Company', areas: 'Plateau, Bauchi, Benue and Gombe' },
  { code: 'BEDC', slug: 'benin-electricity', name: 'Benin Electricity (BEDC)', legal: 'Benin Electricity Distribution Company', areas: 'Edo, Delta, Ondo and Ekiti' },
  { code: 'YEDC', slug: 'yola-electricity', name: 'Yola Electricity (YEDC)', legal: 'Yola Electricity Distribution Company', areas: 'Adamawa, Taraba, Borno and Yobe' },
  { code: 'ABA', slug: 'aba-power', name: 'Aba Power', legal: 'Aba Power Limited Electric', areas: 'Aba and surrounding areas in Abia' },
];

export const discoBySlug = (slug: string) => DISCOS.find((d) => d.slug === slug);
export const discoByCode = (code: string) => DISCOS.find((d) => d.code === code);

export type PageSeo = { path: string; title: string; description: string };

export const HOME: PageSeo = {
  path: '/',
  title: 'Zenerlink | Buy Electricity Online in Nigeria, Instant Prepaid Tokens',
  description:
    'Buy prepaid electricity tokens for IKEDC, EKEDC, AEDC, IBEDC, PHED and every Nigerian DisCo in seconds. Pay by card, bank transfer or USSD, save your meters and get your token instantly.',
};

export const ELECTRICITY: PageSeo = {
  path: '/electricity',
  title: 'Buy Electricity for Any DisCo in Nigeria | Zenerlink',
  description:
    'Choose your electricity distribution company and recharge your prepaid meter online: Ikeja, Eko, Abuja, Ibadan, Enugu, Port Harcourt, Kano, Kaduna, Jos, Benin, Yola and Aba.',
};

export const LOGIN: PageSeo = {
  path: '/login',
  title: 'Sign in | Zenerlink',
  description: 'Sign in to Zenerlink to buy electricity, fund your wallet, see your saved meters and find every token you have bought.',
};

export const discoPage = (d: DiscoSeo): PageSeo => {
  const short = d.name.match(/\(([^)]+)\)/)?.[1] ?? d.name;
  return {
    path: `/electricity/${d.slug}`,
    title: `Buy ${short} Prepaid Electricity Token Online | Zenerlink`,
    description: `Recharge your ${d.name} prepaid meter in seconds. Pay by card, transfer or USSD and get your ${short} token instantly. Serving ${d.areas}.`,
  };
};

export const FAQS: [string, string][] = [
  ['Which meters can I recharge?', 'Any prepaid (and postpaid) meter on the DisCos listed on this page. Enter the meter number and we confirm the name on it with your DisCo before you pay.'],
  ['How fast is my token?', 'Usually seconds after payment. If your DisCo is slow the order shows as delayed and we keep trying. You are never charged twice, and failed purchases are refunded.'],
  ['How do I pay?', 'By card, bank transfer or USSD through a secure checkout, or from your Zenerlink wallet in one tap.'],
  ['Why are my units different from the estimate?', 'Your DisCo calculates the final units from your tariff band. The units on your receipt are the DisCo’s own figure.'],
  ['Can I pay for someone else’s meter?', 'Yes. Enter their meter number, or scan the QR sticker on their meter. We show the name on the meter before you pay.'],
];

// Sets the tab title and description while the app navigates.
export function applyPageSeo(p: PageSeo) {
  if (typeof document === 'undefined') return;
  document.title = p.title;
  const set = (sel: string, attr: string, value: string) => document.querySelector(sel)?.setAttribute(attr, value);
  set('meta[name="description"]', 'content', p.description);
  set('link[rel="canonical"]', 'href', SITE_URL + p.path);
  set('meta[property="og:title"]', 'content', p.title);
  set('meta[property="og:description"]', 'content', p.description);
  set('meta[property="og:url"]', 'content', SITE_URL + p.path);
}
