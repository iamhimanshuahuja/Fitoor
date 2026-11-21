// AUTO-COPIED from src/lib/juiceDays.js by mobile/scripts/sync-shared.mjs — edit the web file, then run "npm run sync-shared".
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { today, addDays, daysAgo } from './dates';

/** All juice days for a user (oldest first) + a reload function. */
export function useJuiceDays(userId) {
  const [days, setDays] = useState(null);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('juice_days').select('*').eq('user_id', userId).order('day');
    setDays(data || []);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  return [days, load];
}

/** Days from today until `day` (0 = today, negative = past). */
export const daysUntil = (day) => -daysAgo(day);

export const isJuiceDay = (days, date) => (days || []).find((d) => d.day === date && d.status !== 'missed');

/** The next scheduled juice day from today on. */
export const nextJuiceDay = (days) => (days || []).find((d) => d.day >= today() && d.status === 'scheduled');

/** Show the "get ready" reminder this many days before. */
export const REMIND_DAYS = 2;

export async function requestChange(id, request_day, request_reason) {
  return supabase.from('juice_days').update({ request_day, request_reason: request_reason || null }).eq('id', id);
}
export async function cancelRequest(id) {
  return supabase.from('juice_days').update({ request_day: null, request_reason: null }).eq('id', id);
}

/** Coach: approve moves the day to the requested date. */
export async function decideRequest(jd, approve) {
  if (approve) {
    return supabase.from('juice_days').update({ day: jd.request_day, request_status: 'approved' }).eq('id', jd.id);
  }
  return supabase.from('juice_days').update({ request_status: 'declined' }).eq('id', jd.id);
}

/** .ics file for the phone calendar: all-day event with an alert 2 days before and one on the morning. */
export function juiceDayIcs(day, note = '') {
  const d = day.replace(/-/g, '');
  const end = addDays(day, 1).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fitoor//Juice day//EN', 'BEGIN:VEVENT',
    `UID:juice-${d}@fitoor`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`,
    'SUMMARY:🧃 Fitoor juice day — only juices today',
    `DESCRIPTION:Juice day set by your coach. No other food today.${note ? '\\n' + note.replace(/\n/g, '\\n') : ''}\\nBuy beetroot\\, carrot\\, amla\\, cucumber\\, ash gourd\\, greens and coconut water 1–2 days before.`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Juice day in 2 days — be ready', 'TRIGGER:-P2D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Juice day today — only juices', 'TRIGGER:PT7H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}

export function downloadIcs(day, note) {
  const url = URL.createObjectURL(juiceDayIcs(day, note));
  const a = document.createElement('a');
  a.href = url; a.download = `fitoor-juice-day-${day}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
