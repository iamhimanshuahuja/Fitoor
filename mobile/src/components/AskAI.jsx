import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { WEB_URL } from '../lib/supabase';
import { runAI } from '../lib/ai';
import { useAuth } from '../lib/auth';
import { buildAskData } from '../shared/askData';
import { useAiQuota, aiUsed, requestTier } from '../lib/aiQuota';
import { Btn, Card, Chip, Chips, Field, Row, T } from './ui';
import { C } from '../theme';

const SELF = ['How was my protein this week?', 'Which lifts have improved most?', 'What should I fix in my diet first?', 'Am I on track for my goal weight?'];
const CLIENT = ['How did they do this week?', 'Where are they slipping on the plan?', 'Which lifts improved?', 'Anything in the labs to discuss with their doctor?'];

/** Ask AI about logged data (client about self, or coach about a client). Needs Ask AI on the caller's plan. */
export default function AskAI({ userId, about = 'self', name }) {
  const { user, profile } = useAuth();
  const [quota] = useAiQuota();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]);
  const [asked, setAsked] = useState(false);
  const client = about === 'client';
  const title = client ? `Ask AI about ${name?.split(' ')[0] || 'this client'}` : 'Ask AI about your progress';

  const ask = async (question) => {
    const text = (question ?? q).trim();
    if (!text || busy) return;
    setBusy(true); setQ('');
    try {
      const data = await buildAskData(userId);
      const r = await runAI('ask', { question: text, about, data });
      setThread((t) => [{ q: text, a: r.answer, follow_ups: r.follow_ups || [] }, ...t]);
    } catch (e) { setThread((t) => [{ q: text, error: e.message }, ...t]); }
    aiUsed(); setBusy(false);
  };

  if (!quota) return null;
  if (!quota.can_ask) {
    return (
      <Card title={`🔒 ${title}`}>
        <T small>Ask anything about {client ? 'your client’s' : 'your'} meals, workouts, weight and labs, and get an answer from {client ? 'their' : 'your'} own logs. Part of the <T small bold>Pro</T> plan.</T>
        <Row wrap>
          {profile?.tier_requested ? <T small muted>Upgrade requested. We’ll switch it on soon.</T>
            : <Btn small variant="pop" title={asked ? 'Requested ✓' : 'Ask for Pro'} disabled={asked} onPress={async () => { await requestTier(user.id, 'pro'); setAsked(true); }} />}
          <Btn small variant="ghost" title="See plans" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/#pricing`)} />
        </Row>
      </Card>
    );
  }
  const out = !quota.unlimited && quota.remaining <= 0;
  return (
    <Card title={`✨ ${title}`}>
      {!quota.unlimited ? <T small muted>{quota.remaining} of {quota.limit} AI chats left today</T> : null}
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field value={q} onChangeText={setQ} placeholder={client ? 'e.g. How was their protein this week?' : 'e.g. How was my protein this week?'} maxLength={500} accessibilityLabel="Your question" /></View>
        <Btn small title={busy ? '…' : 'Ask'} busy={busy} disabled={busy || out || !q.trim()} onPress={() => ask()} />
      </Row>
      {!thread.length ? <Chips>{(client ? CLIENT : SELF).map((s) => <Chip key={s} small label={s} onPress={() => !out && ask(s)} />)}</Chips> : null}
      {out ? <T small style={{ color: C.red }}>You’ve used today’s AI chats. They reset at midnight.</T> : null}
      {thread.map((t, i) => (
        <View key={i} style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 4 }}>
          <T bold>{t.q}</T>
          {t.error ? <T small style={{ color: C.red }}>{t.error}</T> : <T>{t.a}</T>}
          {i === 0 && t.follow_ups?.length ? <Chips>{t.follow_ups.map((f) => <Chip key={f} small label={f} onPress={() => !busy && !out && ask(f)} />)}</Chips> : null}
        </View>
      ))}
      <T small muted>AI answers from {client ? 'the client’s' : 'your'} logs and can be wrong. Not medical advice.</T>
    </Card>
  );
}
