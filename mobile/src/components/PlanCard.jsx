import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { WEB_URL } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAiQuota, useTiers, requestTier, inr } from '../lib/aiQuota';
import { fmt } from '../shared/dates';
import { Btn, Card, Row, T } from './ui';
import { C } from '../theme';

/** Your pricing plan: AI allowance today and a request to upgrade (the super admin switches it on). */
export default function PlanCard() {
  const { user, profile, refresh } = useAuth();
  const [q] = useAiQuota();
  const [tiers] = useTiers();
  const [busy, setBusy] = useState(false);
  if (!q || !tiers) return null;
  if (q.unlimited) return <Card title="Your plan"><T><T bold>Super admin</T> · unlimited AI</T></Card>;
  const cur = tiers.find((t) => t.key === q.tier);
  const ask = async (key) => { setBusy(true); await requestTier(user.id, key); await refresh?.(); setBusy(false); };
  const pct = q.limit ? Math.min(100, Math.round((q.used / q.limit) * 100)) : 0;
  const wanted = profile?.tier_requested && tiers.find((t) => t.key === profile.tier_requested);
  return (
    <Card title="Your plan" action={<Btn small variant="ghost" title="Compare" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/#pricing`)} />}>
      <T><T bold>{cur?.name || q.tier_name}</T>{cur?.price_inr ? ` · ${inr(profile?.tier_price ?? cur.price_inr)}/month` : ' · ₹0'}{q.until && !q.expired ? ` · until ${fmt(q.until)}` : ''}</T>
      {profile?.tier_note ? <T small muted>{profile.tier_note}</T> : null}
      {q.expired ? <T small style={{ color: C.red }}>Your offer ended, so you’re back on Free. Ask us to renew it.</T> : null}
      <View accessibilityRole="progressbar" accessibilityLabel={`${q.used} of ${q.limit} AI chats used today`} style={{ height: 10, borderWidth: 2, borderColor: C.ink, borderRadius: 99, overflow: 'hidden', backgroundColor: '#fff' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.lime }} />
      </View>
      <T small>{q.used} of {q.limit} AI chats used today{q.can_ask ? ' · Ask AI included' : ''}. Resets at midnight.</T>
      <T small muted>Every feature is on every plan. Plans only change how much AI you get.</T>
      {wanted ? (
        <Row wrap><T small style={{ flex: 1 }}>Upgrade to <T small bold>{wanted.name}</T> requested. We’ll confirm payment and switch it on.</T><Btn small variant="ghost" title="Cancel request" disabled={busy} onPress={() => ask(null)} /></Row>
      ) : (
        <Row wrap>{tiers.filter((t) => t.active && t.key !== q.tier && t.price_inr > (cur?.price_inr || 0)).map((t) => (
          <Btn key={t.key} small variant="pop" title={`Get ${t.name} · ${inr(t.price_inr)}/mo`} disabled={busy} onPress={() => ask(t.key)} />
        ))}</Row>
      )}
    </Card>
  );
}
