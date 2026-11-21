import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { DIETS, TAGS, imageUrl, totalMin, coverStyle, coverEmoji } from '../lib/recipes';

/** Header + footer for public pages (recipes). Works logged in or out. */
export default function PublicShell({ children }) {
  const { user, isAdmin } = useAuth() || {};
  return (
    <div className="pub">
      <header className="pub-head">
        <Link to="/" className="pub-logo"><img src="/logo-inline.svg" alt="Fitoor home" height={32} /></Link>
        <nav>
          <NavLink to="/recipes" end className="pub-link">Recipes</NavLink>
          {user ? <Link to={isAdmin ? '/admin' : '/app'} className="btn btn-pop btn-sm">Open app</Link>
            : <><Link to="/login" className="pub-link">Log in</Link><Link to="/signup" className="btn btn-pop btn-sm">Start free</Link></>}
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot no-print">
        <img src="/logo-inline-dark.svg" alt="Fitoor" height={28} />
        <p>Fitoor tracks your thali, gym sets and blood reports with a coach who actually checks in. <b>Plate se PR tak.</b></p>
        <nav>
          <Link to="/recipes">All recipes</Link>
          <Link to="/recipes?diet=veg">Veg recipes</Link>
          <Link to="/recipes?tag=weight_loss">Weight-loss recipes</Link>
          <Link to="/recipes?tag=high_protein">High-protein recipes</Link>
          <Link to="/recipes?tag=pcos_friendly">PCOS-friendly recipes</Link>
          <Link to="/signup">Join Fitoor</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <small>Recipes are for general healthy eating, not medical advice. Nutrition values are estimates.</small>
      </footer>
    </div>
  );
}

export function DietDot({ diet, label = false }) {
  const d = DIETS[diet] || DIETS.veg;
  return <span className={`diet-dot ${diet}`} title={d.label}><i />{label && d.label}</span>;
}

export function RecipeCover({ r, className = '' }) {
  const src = imageUrl(r.image_path);
  return src
    ? <img className={`rc-img ${className}`} src={src} alt={r.title} loading="lazy" />
    : <div className={`rc-img rc-cover ${className}`} style={coverStyle(r)} aria-hidden><span>{coverEmoji(r)}</span></div>;
}

export function RecipeCard({ r, to }) {
  const mins = totalMin(r);
  return (
    <Link to={to || `/recipes/${r.slug}`} className="recipe-card">
      <RecipeCover r={r} />
      <div className="rc-body">
        <div className="rc-top"><DietDot diet={r.diet} />{r.status && r.status !== 'public' && <span className={`tag rc-status ${r.status}`}>{r.status === 'pending' ? 'In review' : r.status === 'rejected' ? 'Needs changes' : 'Private'}</span>}</div>
        <h3>{r.title}</h3>
        <p className="rc-meta">{mins ? `${mins} min` : ''}{r.kcal ? ` · ~${r.kcal} kcal` : ''}{r.protein_g ? ` · ${Math.round(r.protein_g)} g protein` : ''}</p>
        <div className="rc-tags">{(r.tags || []).slice(0, 2).map((t) => <span key={t} className="chip sm">{TAGS[t] || t}</span>)}</div>
      </div>
    </Link>
  );
}
