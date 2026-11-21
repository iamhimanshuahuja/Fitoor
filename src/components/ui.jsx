import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSignedUrl } from '../lib/media';
import { addDays, fmtLong, today } from '../lib/dates';

/** full = icon + Fitoor + "Plate se PR tak." tagline; default = compact icon + Fitoor for nav bars */
export const Logo = ({ dark, full = false, height = 36 }) => (
  <img src={`/${full ? 'logo' : 'logo-inline'}${dark ? '-dark' : ''}.svg`} alt="Fitoor — Plate se PR tak" style={{ height }} />
);

export const Spinner = ({ size = 18 }) => <Loader2 size={size} className="spin" />;

export const Card = ({ title, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && (
      <header className="card-head">
        {title && <h3>{title}</h3>}
        {action}
      </header>
    )}
    {children}
  </section>
);

export const Empty = ({ children }) => <p className="empty">{children}</p>;

export const Stat = ({ label, value, sub, tone }) => (
  <div className={`stat ${tone || ''}`}>
    <span className="stat-label">{label}</span>
    <strong className="stat-value">{value ?? '—'}</strong>
    {sub && <span className="stat-sub">{sub}</span>}
  </div>
);

export function DateStrip({ value, onChange }) {
  const isToday = value === today();
  return (
    <div className="datestrip">
      <button className="icon-btn" onClick={() => onChange(addDays(value, -1))} aria-label="Previous day"><ChevronLeft size={20} /></button>
      <label className="datestrip-label">
        <span>{isToday ? 'Today' : fmtLong(value)}</span>
        <input type="date" value={value} max={today()} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
      <button className="icon-btn" disabled={isToday} onClick={() => onChange(addDays(value, 1))} aria-label="Next day"><ChevronRight size={20} /></button>
    </div>
  );
}

/** Camera / gallery picker. On phones "Camera" opens the rear camera directly. */
export function PhotoInput({ onFile, busy, label = 'Add photo', accept = 'image/*' }) {
  const cam = useRef(null);
  const gal = useRef(null);
  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); };
  return (
    <div className="photo-input">
      <button type="button" className="btn btn-soft" disabled={busy} onClick={() => cam.current.click()}>
        {busy ? <Spinner /> : <Camera size={18} />} Camera
      </button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => gal.current.click()}>
        <ImagePlus size={18} /> {label}
      </button>
      <input ref={cam} type="file" accept={accept} capture="environment" hidden onChange={pick} />
      <input ref={gal} type="file" accept={accept} hidden onChange={pick} />
    </div>
  );
}

export function SignedImg({ path, alt = '', className = 'thumb', onClick }) {
  const url = useSignedUrl(path);
  if (!path) return null;
  return url ? <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" /> : <div className={`${className} thumb-loading`} />;
}

export function Lightbox({ path, onClose }) {
  const url = useSignedUrl(path);
  if (!path) return null;
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="icon-btn lightbox-close" aria-label="Close"><X /></button>
      {url && <img src={url} alt="" />}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" className={value === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className="toggle-row">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" className="switch" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const show = (text, tone = 'ok') => { setMsg({ text, tone }); setTimeout(() => setMsg(null), 3000); };
  const node = msg ? <div className={`toast ${msg.tone}`}>{msg.text}</div> : null;
  return [node, show];
}
