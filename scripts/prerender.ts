// After `vite build`: write a real HTML page for each public route (title,
// description, canonical, social tags, structured data and readable content
// inside #root, which React replaces on load), plus sitemap.xml and
// robots.txt. Search engines get the content without running JavaScript.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  COMPANY, COMPANY_RC, DISCOS, ELECTRICITY, FAQS, HOME, LOGIN, SITE_NAME, SITE_URL, SUPPORT_EMAIL, discoPage,
} from '../src/seo/site.ts';
import type { DiscoSeo, PageSeo } from '../src/seo/site.ts';
import { LEGAL_DOCS, LEGAL_UPDATED } from '../src/seo/legal.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const url = (path: string) => SITE_URL + path;

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': url('/#organization'),
  name: SITE_NAME,
  legalName: COMPANY,
  url: url('/'),
  logo: url('/icon-512.png'),
  email: SUPPORT_EMAIL,
  identifier: `RC ${COMPANY_RC}`,
  areaServed: { '@type': 'Country', name: 'Nigeria' },
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SUPPORT_EMAIL, areaServed: 'NG', availableLanguage: 'English' },
};
const website = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': url('/#website'), name: SITE_NAME, url: url('/'), publisher: { '@id': url('/#organization') } };
const faqPage = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};
const breadcrumbs = (items: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url(path) })),
});
const service = (d: DiscoSeo, p: PageSeo) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: `${d.name} prepaid electricity tokens`,
  serviceType: 'Prepaid electricity token purchase',
  description: p.description,
  provider: { '@id': url('/#organization') },
  areaServed: d.areas,
  url: url(p.path),
});

const discoLinks = () =>
  `<ul>${DISCOS.map((d) => `<li><a href="/electricity/${d.slug}">Buy ${esc(d.name)} electricity</a></li>`).join('')}</ul>`;
const faqHtml = () => `<h2>Questions</h2>${FAQS.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}`;
const nav = `<nav><a href="/">${SITE_NAME}</a> <a href="/electricity">Buy electricity</a> <a href="/login">Sign in</a></nav>`;
const footer = `<footer><p>&copy; ${new Date().getFullYear()} ${SITE_NAME}. A product of ${COMPANY}, RC ${COMPANY_RC}. Support: ${SUPPORT_EMAIL}</p><p><a href="/terms">Terms of Service</a> <a href="/privacy">Privacy Policy</a> <a href="/refunds">Refund Policy</a></p></footer>`;

type Page = { seo: PageSeo; body: string; data: object[]; priority: string };

const pages: Page[] = [
  {
    seo: HOME,
    priority: '1.0',
    data: [organization, website, faqPage],
    body: `${nav}<main><h1>Power, on demand.</h1><p>Recharge any prepaid meter on any DisCo in Nigeria. Pay by card, transfer or USSD. Your token arrives in seconds.</p>
<h2>How it works</h2><ol><li>Enter your meter: choose your DisCo and type the meter number. We check the name on the meter with the DisCo before you pay.</li><li>Pay by card, bank transfer or USSD, or from your wallet.</li><li>Load the 20-digit token on your meter keypad.</li></ol>
<h2>Buy electricity for your DisCo</h2>${discoLinks()}${faqHtml()}</main>${footer}`,
  },
  {
    seo: ELECTRICITY,
    priority: '0.9',
    data: [organization, breadcrumbs([['Home', '/'], ['Buy electricity', '/electricity']])],
    body: `${nav}<main><h1>Buy electricity for any DisCo in Nigeria</h1><p>${esc(ELECTRICITY.description)}</p>${DISCOS.map((d) => `<section><h2><a href="/electricity/${d.slug}">${esc(d.name)}</a></h2><p>${esc(d.legal)}. Serving ${esc(d.areas)}.</p></section>`).join('')}</main>${footer}`,
  },
  {
    seo: LOGIN,
    priority: '0.5',
    data: [organization],
    body: `${nav}<main><h1>Sign in to ${SITE_NAME}</h1><p>${esc(LOGIN.description)}</p></main>${footer}`,
  },
  ...DISCOS.map((d): Page => {
    const p = discoPage(d);
    const short = d.name.match(/\(([^)]+)\)/)?.[1] ?? d.name;
    return {
      seo: p,
      priority: '0.8',
      data: [organization, service(d, p), breadcrumbs([['Home', '/'], ['Buy electricity', '/electricity'], [d.name, p.path]]), faqPage],
      body: `${nav}<main><h1>Buy ${esc(short)} prepaid electricity online</h1><p>${esc(p.description)}</p>
<h2>How to buy ${esc(short)} token on ${SITE_NAME}</h2><ol><li>Choose ${esc(d.name)} and enter your meter number. We confirm the account name with ${esc(short)} before you pay.</li><li>Enter the amount and pay by card, bank transfer or USSD, or from your wallet.</li><li>Your 20-digit ${esc(short)} token appears in seconds. Type it on your meter keypad.</li></ol>
<p>${esc(d.legal)} serves ${esc(d.areas)}.</p><h2>Other DisCos</h2>${discoLinks()}${faqHtml()}</main>${footer}`,
    };
  }),
  ...LEGAL_DOCS.map((d): Page => ({
    seo: d,
    priority: '0.3',
    data: [organization, breadcrumbs([['Home', '/'], [d.heading, d.path]])],
    body: `${nav}<main><h1>${esc(d.heading)}</h1><p>Last updated ${LEGAL_UPDATED}</p><p>${esc(d.intro)}</p>${d.sections
      .map(([h, ps]) => `<h2>${esc(h)}</h2>${ps.map((t) => `<p>${esc(t)}</p>`).join('')}`)
      .join('')}</main>${footer}`,
  })),
];

function render(p: Page) {
  const { title, description, path } = p.seo;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url(path)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url(path)}" />`);
  html = html.replace('<!--seo-head-->', p.data.map(ld).join('\n    '));
  html = html.replace('<!--seo-body-->', `<div class="seo-static">${p.body}</div>`);
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path.slice(1), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

pages.forEach(render);

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${url(p.seo.path)}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /order/\nDisallow: /buy\nDisallow: /transactions\nDisallow: /meters\nDisallow: /wallet\nDisallow: /profile\nDisallow: /password\nDisallow: /help\n\nSitemap: ${url('/sitemap.xml')}\n`,
);
console.log(`prerendered ${pages.length} pages, sitemap.xml and robots.txt`);
