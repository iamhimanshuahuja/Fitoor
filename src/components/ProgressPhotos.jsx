import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadMedia } from '../lib/media';
import { fmt, toISO } from '../lib/dates';
import { Card, PhotoInput, SignedImg, Lightbox, Empty } from './ui';

/** Progress (body) photos kept in storage under <userId>/progress — no table needed. */
export default function ProgressPhotos({ userId }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lb, setLb] = useState(null);
  const load = async () => {
    const { data } = await supabase.storage.from('media').list(`${userId}/progress`, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
    setFiles((data || []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({
      path: `${userId}/progress/${f.name}`,
      date: toISO(new Date(Number(f.name.split('-')[0]) || f.created_at)),
    })));
  };
  useEffect(() => { load(); }, [userId]);
  const add = async (file) => { setBusy(true); try { await uploadMedia(userId, 'progress', file); await load(); } finally { setBusy(false); } };
  const del = async (p) => { if (!confirm('Delete this progress photo?')) return; await supabase.storage.from('media').remove([p.path]); load(); };
  const first = files[0], last = files.at(-1);
  return (
    <Card title="Progress photos" action={<PhotoInput onFile={add} busy={busy} label="Upload" />}>
      {files.length >= 2 && (
        <div className="compare">
          {[first, last].map((p, i) => (
            <figure key={p.path}>
              <SignedImg path={p.path} className="compare-img" onClick={() => setLb(p.path)} />
              <figcaption><b>{i ? 'Now' : 'Day 1'}</b> · {fmt(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {files.length ? (
        <div className="photo-strip">
          {files.map((p) => (
            <figure key={p.path}>
              <SignedImg path={p.path} className="photo" onClick={() => setLb(p.path)} />
              <figcaption>{fmt(p.date)} <button className="icon-btn sm" onClick={() => del(p)} aria-label="Delete photo"><Trash2 size={13} /></button></figcaption>
            </figure>
          ))}
        </div>
      ) : <Empty>Take a front or side photo every week or two, in the same spot and light. Only you and your coach can see them.</Empty>}
      <Lightbox path={lb} onClose={() => setLb(null)} />
    </Card>
  );
}
