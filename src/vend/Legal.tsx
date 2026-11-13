import { useEffect } from 'react';
import { useBrand } from '../lib/brand';
import { applyPageSeo } from '../seo/site';
import { LEGAL_DOCS, LEGAL_UPDATED } from '../seo/legal';
import type { LegalDoc } from '../seo/legal';
import { href } from './links';
import type { Nav } from './links';

// Terms, privacy and refund pages: plain reading layout, same header and
// footer links as the rest of the public site.
export function LegalPage({ doc, nav }: { doc: LegalDoc; nav: Nav }) {
  const brand = useBrand();
  useEffect(() => applyPageSeo(doc), [doc]);

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <a
            href={href('/')}
            onClick={(e) => {
              e.preventDefault();
              nav('/');
            }}
            className="text-[15px] font-black tracking-[0.34em]"
          >
            {brand.display_name.toUpperCase()}
          </a>
          <LegalLinks nav={nav} current={doc.path} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{doc.heading}</h1>
        <p className="mt-2 text-[13px] text-white/40">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-8 text-[15px] leading-7 text-white/75">{doc.intro}</p>
        {doc.sections.map(([heading, paras]) => (
          <section key={heading} className="mt-10">
            <h2 className="text-lg font-semibold">{heading}</h2>
            {paras.map((p) => (
              <p key={p.slice(0, 40)} className="mt-3 text-[15px] leading-7 text-white/65">{p}</p>
            ))}
          </section>
        ))}
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-3 px-5 py-8 text-[12px] text-white/35 sm:px-8">
          <span>&copy; {new Date().getFullYear()} {brand.display_name}. A product of Zieon Energies Ltd, RC 9519634.</span>
          <LegalLinks nav={nav} current={doc.path} />
        </div>
      </footer>
    </div>
  );
}

const SHORT: Record<string, string> = { '/terms': 'Terms', '/privacy': 'Privacy', '/refunds': 'Refunds' };

// Links to the three policies, used in every public footer.
export function LegalLinks({ nav, current, className = '' }: { nav: Nav; current?: string; className?: string }) {
  return (
    <span className={`flex gap-5 text-[13px] ${className}`}>
      {LEGAL_DOCS.map((d) => (
        <a
          key={d.path}
          href={href(d.path)}
          onClick={(e) => {
            e.preventDefault();
            nav(d.path);
          }}
          className={d.path === current ? 'text-white' : 'text-white/45 hover:text-white'}
        >
          {SHORT[d.path]}
        </a>
      ))}
    </span>
  );
}
