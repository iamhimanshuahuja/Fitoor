import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { today } from '../../../shared/dates';
import { JUICE_GROUPS } from '../../../shared/juices';
import { isFemale, cycleStats, PCOS, PREGNANCY } from '../../../shared/cycle';
import { Btn, Card, Chip, Chips, Row, Screen, Seg, Spinner, T } from '../../../components/ui';
import DayView from '../../../components/DayView';
import DateStrip from '../../../components/DateStrip';
import ProgressPanel from '../../../components/ProgressPanel';
import WeightPanel from '../../../components/WeightPanel';
import GymPanel from '../../../components/GymPanel';
import LabsPanel from '../../../components/LabsPanel';
import Notes from '../../../components/Notes';
import MonthCalendar from '../../../components/MonthCalendar';
import DietPlan from '../../../components/DietPlan';
import { C } from '../../../theme';

const TABS = [['day', 'Day'], ['cal', 'Calendar'], ['progress', 'Progress'], ['weight', 'Weight'], ['gym', 'Gym'], ['labs', 'Labs'], ['plan', 'Plan'], ['notes', 'Notes']];

export default function ClientDetail() {
  const { id } = useLocalSearchParams();
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('day');
  const [date, setDate] = useState(today());
  const load = () => supabase.from('profiles').select('*').eq('id', id).single().then(({ data }) => setP(data));
  useEffect(() => { load(); }, [id]);
  if (!p) return <Spinner />;
  const setJuice = async (g) => { await supabase.from('profiles').update({ juice_group: g }).eq('id', id); load(); };
  return (
    <Screen>
      <Stack.Screen options={{ title: p.full_name || p.email }} />
      <View style={{ gap: 4 }}>
        <T style={{ fontSize: 20, fontWeight: '800' }}>{p.full_name || p.email}</T>
        <T small muted>{p.email}{p.goal ? ` · ${p.goal}` : ''}</T>
        <Row wrap gap={6}>
          {['pregnant', 'breastfeeding'].includes(p.pregnancy) && <Chip small label={p.pregnancy === 'pregnant' ? '🤰 Pregnant' : 'Breastfeeding'} on tone={C.pink} />}
          {p.pcos === 'yes' && <Chip small label="PCOS/PCOD" on tone={C.lav} />}
          {p.phone ? <Btn small variant="ghost" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${p.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`)} /> : null}
        </Row>
      </View>
      <Chips>{TABS.map(([k, l]) => <Chip key={k} label={l} on={tab === k} onPress={() => setTab(k)} />)}</Chips>
      {tab === 'day' && <><DateStrip value={date} onChange={setDate} /><DayView userId={id} date={date} mode="admin" /></>}
      {tab === 'cal' && <MonthCalendar userId={id} onOpen={(d) => { setDate(d); setTab('day'); }} />}
      {tab === 'progress' && <ProgressPanel userId={id} profile={p} />}
      {tab === 'weight' && <WeightPanel userId={id} profile={p} />}
      {tab === 'gym' && <GymPanel userId={id} />}
      {tab === 'labs' && <LabsPanel userId={id} />}
      {tab === 'notes' && <Notes userId={id} title="Health notes & feedback" />}
      {tab === 'plan' && (
        <>
          <Card title="🧃 Juice amounts (eGFR group)">
            <Seg items={[{ key: null, label: 'Not set' }, ...Object.entries(JUICE_GROUPS).map(([k, g]) => ({ key: k, label: k === '90' ? '>90' : k === '60' ? '60–90' : '30–60' }))]} value={p.juice_group || null} onChange={setJuice} />
            <T small muted>{JUICE_GROUPS[p.juice_group]?.total || 'Pick the group from the latest eGFR.'} Book juice days and edit the diet chart in the web panel.</T>
          </Card>
          {isFemale(p) && (p.pcos || p.pregnancy || p.track_cycle) && <WhCard p={p} />}
          <DietPlan userId={id} />
        </>
      )}
    </Screen>
  );
}

function WhCard({ p }) {
  const [s, setS] = useState(null);
  useEffect(() => { supabase.from('period_logs').select('*').eq('user_id', p.id).order('start_date', { ascending: false }).limit(36).then(({ data }) => setS(cycleStats(data || []))); }, [p.id]);
  return (
    <Card title="🌸 Women’s health">
      {p.pcos ? <T small>PCOS/PCOD: {PCOS[p.pcos]}</T> : null}
      {p.pregnancy ? <T small>Pregnancy: {PREGNANCY[p.pregnancy]}{p.due_date ? ` · due ${p.due_date}` : ''}</T> : null}
      {s?.cycleDay ? <T small>Cycle day {s.cycleDay}{s.avg ? ` · avg ${s.avg} d (${s.regular ? 'regular' : 'irregular'})` : ''}{s.lateBy ? ` · late by ${s.lateBy} d` : ''}</T> : null}
    </Card>
  );
}
