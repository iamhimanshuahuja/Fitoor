import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { loadBests, prList, fmtSet } from '../lib/workouts';
import { fmt, today } from '../lib/dates';
import { Card, Empty, Spinner } from './ui';

/** Personal records up front: heaviest set per exercise, newest first, with estimated 1-rep max. */
export default function PRBoard({ userId, refreshKey, limit = 8, title = 'Your PRs' }) {
  const [list, setList] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => loadBests(userId).then((b) => live && setList(prList(b, today())));
    load();
    window.addEventListener('ft:data-changed', load);
    return () => { live = false; window.removeEventListener('ft:data-changed', load); };
  }, [userId, refreshKey]);
  const shown = all ? list : list?.slice(0, limit);
  return (
    <Card title={<span className="row gap-sm"><Trophy size={18} /> {title}</span>}
      action={list?.length > limit && <button type="button" className="link-btn" onClick={() => setAll(!all)}>{all ? 'Show less' : `All ${list.length}`}</button>}>
      {!list ? <Spinner /> : !list.length ? <Empty>Log a weighted set and your best lifts show up here.</Empty> : (
        <div className="pr-board">
          {shown.map((p) => (
            <div key={p.exercise_id} className={`pr-item ${p.isNew ? 'new' : ''}`}>
              <div className="pr-name">{p.name}{p.isNew && <span className="tag pr-tag">New</span>}</div>
              <div className="pr-best">{fmtSet({ reps: p.reps, weight_kg: p.kg })}</div>
              <div className="pr-meta small muted">{fmt(p.date)}{p.e1rm && p.reps ? ` · est. 1RM ${p.e1rm} kg` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
