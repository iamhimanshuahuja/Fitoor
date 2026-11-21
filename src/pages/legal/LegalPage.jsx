import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/PublicShell';

export function Sec({ id, title, children }) {
  return <section id={id} className="legal-sec"><h2>{title}</h2>{children}</section>;
}

/** Shared layout for /terms and /privacy. */
export function LegalPage({ title, updated, intro, toc, children }) {
  useEffect(() => {
    document.title = `${title} | Fitoor`;
    if (window.location.hash) setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView(), 50);
    else window.scrollTo(0, 0);
  }, [title]);
  return (
    <PublicShell>
      <article className="legal">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        <p className="legal-intro">{intro}</p>
        <nav className="legal-toc no-print" aria-label="On this page">
          {toc.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        {children}
        <p className="legal-foot no-print"><Link to="/terms">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link> · <button className="linkish" onClick={() => window.print()}>Print</button></p>
      </article>
    </PublicShell>
  );
}
