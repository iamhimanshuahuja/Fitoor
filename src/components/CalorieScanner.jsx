import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ImagePlus, X, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { runAI } from '../lib/ai';
import { compressImage, uploadMedia, toBase64 } from '../lib/media';
import { SLOTS } from '../lib/constants';
import { today } from '../lib/dates';
import { cheer } from '../lib/cheer';
import { notifyDataChanged } from '../lib/chatLog';
import { Spinner } from './ui';

/** Slot that fits the current time of day. */
export function slotForNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 7 ? 'early_morning' : h < 8.5 ? 'before_breakfast' : h < 11.5 ? 'breakfast' : h < 15.5 ? 'lunch' : h < 19 ? 'evening' : h < 22 ? 'dinner' : 'bedtime';
}
const PORTIONS = [[0.5, '½'], [1, '1×'], [1.5, '1½'], [2, '2×']];
const r0 = (v) => Math.round(Number(v) || 0);

/**
 * 📸 Guess calories from a photo. Shows an AI estimate (items, portions, kcal, macros, confidence)
 * and lets the user log it as a meal — or just close it. Nothing is saved without a tap.
 */
export default function CalorieScanner({ onClose, date = today() }) {
  const { user, has } = useAuth();
  const [file, setFile] = useState(null);       // compressed image
  const [preview, setPreview] = useState(null);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mult, setMult] = useState(1);
  const [slot, setSlot] = useState(slotForNow());
  const [cheat, setCheat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nutr, setNutr] = useState({ kcal: '', protein_g: '', carbs_g: '', fat_g: '' });
  // AI guess × portion fills the boxes; the user can then type over any of them
  useEffect(() => {
    if (!res) return;
    const f = (v) => (v == null ? '' : String(Math.round(Number(v) * mult * 10) / 10));
    setNutr({ kcal: f(res.kcal), protein_g: f(res.protein_g), carbs_g: f(res.carbs_g), fat_g: f(res.fat_g) });
  }, [res, mult]);
  const setN = (k) => (e) => setNutr({ ...nutr, [k]: e.target.value });

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr(''); setRes(null); setMult(1); setBusy(true);
    try {
      const small = await compressImage(f);
      setFile(small); setPreview(URL.createObjectURL(small));
      const ai = await runAI('meal', { image: await toBase64(small), mime: small.type, slot: SLOTS.find((s) => s.key === slot)?.label, scanner: true });
      setRes(ai);
    } catch (e2) { setErr(e2.message || 'Could not read the photo. Try again.'); }
    setBusy(false);
  };

  const noFood = res && (!res.items?.length || !res.kcal);
  const total = r0(nutr.kcal);

  const log = async () => {
    setSaving(true); setErr('');
    try {
      const up = await uploadMedia(user.id, 'meals', file, { compress: false });
      const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));
      const edited = ['kcal', 'protein_g', 'carbs_g', 'fat_g'].some((k) => num(nutr[k]) !== (res[k] == null ? null : Math.round(Number(res[k]) * mult * 10) / 10));
      const followed = cheat ? null : res.plan_check ? res.plan_check === 'on_plan' : null;
      const { error } = await supabase.from('meal_logs').insert({
        user_id: user.id, log_date: date, slot, photo_path: up.path, followed, cheat,
        description: (res.items || []).join(', ') || null,
        kcal: num(nutr.kcal), protein_g: num(nutr.protein_g), carbs_g: num(nutr.carbs_g), fat_g: num(nutr.fat_g),
        ai: { ...res, source: 'scanner', portion_multiplier: mult, edited_by_user: edited || undefined },
      });
      if (error) throw error;
      notifyDataChanged();
      cheer(cheat ? 'cheat' : followed === true ? 'on_plan' : 'meal');
      onClose();
    } catch (e2) { setErr(e2.message); }
    setSaving(false);
  };

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Guess calories from a photo">
      <div className="scan-backdrop" onClick={onClose} />
      <div className="scan-panel">
        <div className="scan-head">
          <h2>📸 Guess calories</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {!preview && (
          <div className="scan-pick">
            <p>Snap your plate. AI names each item, guesses the portion and adds up the calories and protein.</p>
            <div className="scan-btns">
              <label className="btn btn-pop btn-lg"><Camera size={20} /> Take photo<input type="file" accept="image/*" capture="environment" hidden onChange={pick} /></label>
              <label className="btn btn-ghost btn-lg"><ImagePlus size={20} /> From gallery<input type="file" accept="image/*" hidden onChange={pick} /></label>
            </div>
            <p className="small muted">Tip: shoot from above in good light, with the whole plate in frame.</p>
          </div>
        )}

        {preview && (
          <div className="scan-result">
            <img src={preview} alt="Your meal" className="scan-img" />
            {busy && <p className="scan-busy"><Spinner /> Looking at your plate…</p>}
            {res && noFood && <p className="scan-nofood">{res.plan_note || 'No food found in this photo.'} Try another photo.</p>}
            {res && !noFood && (
              <>
                <div className="scan-total">
                  <b>~{total}<small> kcal</small></b>
                  <span className={`scan-conf ${res.confidence || 'medium'}`}>{res.confidence === 'high' ? 'Good guess' : res.confidence === 'low' ? 'Rough guess' : 'Fair guess'}</span>
                </div>
                <div className="nutr-row scan-nutr" role="group" aria-label="Nutrition (you can edit)">
                  <label>kcal<input type="number" inputMode="decimal" min="0" value={nutr.kcal} onChange={setN('kcal')} /></label>
                  <label>Protein g<input type="number" inputMode="decimal" min="0" step="0.1" value={nutr.protein_g} onChange={setN('protein_g')} /></label>
                  <label>Carbs g<input type="number" inputMode="decimal" min="0" step="0.1" value={nutr.carbs_g} onChange={setN('carbs_g')} /></label>
                  <label>Fat g<input type="number" inputMode="decimal" min="0" step="0.1" value={nutr.fat_g} onChange={setN('fat_g')} /></label>
                </div>
                <p className="small muted">Numbers look off? Type over them before you log.</p>
                <div className="scan-portion" role="group" aria-label="How much did you eat?">
                  <span className="small">How much did you eat?</span>
                  <div className="seg">{PORTIONS.map(([v, l]) => <button key={v} type="button" className={mult === v ? 'on' : ''} aria-pressed={mult === v} onClick={() => setMult(v)}>{l}</button>)}</div>
                </div>
                {res.breakdown?.length > 0 && (
                  <ul className="scan-items">
                    {res.breakdown.map((b, i) => (
                      <li key={i}><span><b>{b.item}</b>{b.portion && <small> · {b.portion}</small>}</span><em>~{r0(b.kcal * mult)} kcal</em></li>
                    ))}
                  </ul>
                )}
                {res.plan_note && <p className={`ai-note ${res.plan_check}`}>{res.plan_note}</p>}
                {res.swap_tip && <p className="scan-tip">💡 {res.swap_tip}</p>}
                <p className="small muted">AI estimate. Real numbers can be 20–30% off, more with oily or hidden food.</p>

                {has('meals') && (
                  <div className="scan-log">
                    <label>Log as<select value={slot} onChange={(e) => setSlot(e.target.value)}>{SLOTS.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select></label>
                    <label className="check"><input type="checkbox" checked={cheat} onChange={(e) => setCheat(e.target.checked)} /> 🍕 Cheat meal</label>
                    <button className="btn btn-primary" disabled={saving} onClick={log}>{saving ? <Spinner /> : `Log this meal${date !== today() ? ` (${date})` : ''}`}</button>
                  </div>
                )}
              </>
            )}
            {err && <p className="error small">{err}</p>}
            {!busy && (
              <div className="row gap wrap">
                <label className="btn btn-ghost btn-sm"><RotateCcw size={15} /> Scan another<input type="file" accept="image/*" capture="environment" hidden onChange={pick} /></label>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>{res && !noFood ? 'Just checking, close' : 'Close'}</button>
              </div>
            )}
          </div>
        )}
        <p className="scan-legal small muted">Your photo is sent to our AI provider only to make this estimate. Not medical or dietary advice. <Link to="/privacy#ai" onClick={onClose}>How we use AI</Link></p>
      </div>
    </div>
  );
}
