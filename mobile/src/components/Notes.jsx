import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Btn, Card, Empty, Field, Row, T } from './ui';
import Avatar from './Avatar';
import { C } from '../theme';

function authorLabel(c, me) {
  if (c.author_id === c.user_id) return c.author_id === me ? 'You' : c.author?.full_name || 'Client';
  if (c.author_id === me) return 'You (coach)';
  if (!c.author) return 'Previous coach';
  return `Coach · ${c.author.full_name}`;
}

/** Notes thread (same table + rules as the web Comments). date = null → all notes, newest first. */
export default function Notes({ userId, date = null, title = 'Notes' }) {
  const { user, isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const load = useCallback(async () => {
    let q = supabase.from('comments').select('*, author:author_id(full_name, role, avatar_path)').eq('user_id', userId).order('created_at', { ascending: !!date });
    if (date) q = q.eq('log_date', date);
    const { data } = await q.limit(100);
    setList(data || []);
  }, [userId, date]);
  useEffect(() => { load(); }, [load]);
  const send = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from('comments').insert({ user_id: userId, author_id: user.id, log_date: date, context: 'general', body: text.trim() });
    if (error) return Alert.alert('Not sent', error.message);
    setText(''); load();
  };
  return (
    <Card title={title}>
      {list.length ? list.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Avatar path={c.author?.avatar_path} name={c.author?.full_name || 'Coach'} size={32} />
          <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: c.author_id === c.user_id ? C.sky : C.lav, paddingLeft: 10, gap: 2 }}>
            <T small muted>{authorLabel(c, user.id)} · {new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</T>
            <T>{c.body}</T>
          </View>
        </View>
      )) : <Empty>No notes yet.</Empty>}
      <Row style={{ alignItems: 'flex-end' }}>
        <Field value={text} onChangeText={setText} placeholder={isAdmin ? 'Add a health note or feedback…' : 'Reply to your coach…'} maxLength={2000} />
        <Btn small title="Send" onPress={send} disabled={!text.trim()} />
      </Row>
    </Card>
  );
}
