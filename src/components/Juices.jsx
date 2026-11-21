import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { JUICES, TANGY, PREP_RULES, JUICE_GROUPS } from '../lib/juices';
import { Card } from './ui';

/** Today: tick each juice. value = habits.juices object; onChange(next) saves. */
export function JuiceTracker({ group, value = {}, editable = true, onChange, title = '🥤 Juice plan' }) {
  const [open, setOpen] = useState(null);
  if (!group) {
    return (
      <Card title={title}>
        <p className="muted small">Your coach hasn't set your juice amounts yet. Follow the juice times in Plan → Juices.</p>
      </Card>
    );
  }
  const done = JUICES.filter((j) => value[j.key] || (j.alt && value[j.alt])).length;
  return (
    <Card title={`${title} · ${done}/${JUICES.length}`} action={<span className="tag">{JUICE_GROUPS[group].label}</span>}>
      <div className="juice-progress" aria-hidden><span style={{ width: `${(done / JUICES.length) * 100}%` }} /></div>
      <ul className="juices">
        {JUICES.map((j) => {
          const on = !!value[j.key] || (j.alt && !!value[j.alt]);
          return (
            <li key={j.key} className={on ? 'done' : ''}>
              <label className="juice-row">
                <input type="checkbox" disabled={!editable} checked={on}
                  onChange={(e) => onChange({ ...value, [j.key]: e.target.checked, ...(j.alt && !e.target.checked ? { [j.alt]: false } : {}) })} />
                <span className="juice-emoji" aria-hidden>{j.emoji}</span>
                <span className="grow"><b>{j.name}</b><small className="muted"> · {j.window}</small></span>
                <b className="juice-ml">{j.ml[group]} ml</b>
              </label>
              {j.alt && editable && !value[j.key] && (
                <button className={`chip juice-alt ${value[j.alt] ? 'on ok' : ''}`} onClick={() => onChange({ ...value, [j.alt]: !value[j.alt] })}>
                  {TANGY.emoji} Had tangy juice instead
                </button>
              )}
              <button className="link small" onClick={() => setOpen(open === j.key ? null : j.key)}>{open === j.key ? 'Hide recipe' : 'Recipe'}</button>
              {open === j.key && <ul className="recipe">{j.ingredients.map((x) => <li key={x}>{x}</li>)}</ul>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Full program page: schedule table, recipes, prep rules. */
export function JuiceProgram({ group }) {
  return (
    <>
      <Card title="Your juice day">
        {group ? <p className="small">Amounts for <b>{JUICE_GROUPS[group].label}</b>: {JUICE_GROUPS[group].total}, set by your coach.</p>
          : <p className="small muted">Your coach will set your amounts (they depend on your eGFR kidney value).</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Juice</th>{Object.keys(JUICE_GROUPS).sort((a, b) => b - a).map((g) => <th key={g} className={g === group ? 'col-on' : ''}>{JUICE_GROUPS[g].label.replace('eGFR ', '')}</th>)}</tr></thead>
            <tbody>
              {JUICES.map((j) => (
                <tr key={j.key}>
                  <td>{j.window}</td><td>{j.emoji} {j.name}</td>
                  {Object.keys(JUICE_GROUPS).sort((a, b) => b - a).map((g) => <td key={g} className={g === group ? 'col-on' : ''}>{j.ml[g]} ml</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="plan-grid">
        {[...JUICES.filter((j) => j.key !== 'smoothie_pm'), TANGY].map((j) => (
          <details key={j.key} className="card recipe-card" open={j.key === 'red'}>
            <summary><span aria-hidden>{j.emoji}</span> <b>{j.name}</b> <small className="muted">{j.window}</small> <ChevronDown size={16} /></summary>
            <ul>{j.ingredients.map((x) => <li key={x}>{x}</li>)}</ul>
          </details>
        ))}
      </div>
      <Card title="How to make them">
        <ol className="guidelines">{PREP_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
      </Card>
    </>
  );
}
