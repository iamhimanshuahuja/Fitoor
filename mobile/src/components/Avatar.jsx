import { useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useSignedUrl, pickAvatar, removeAvatar } from '../lib/media';
import { cheer } from '../shared/cheer';
import { Btn, Row, Spinner, T } from './ui';
import { C } from '../theme';

const TONES = [C.lime, C.lav, C.sky, C.haldi, '#FFD0DC'];
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '🙂';
const toneOf = (name = '') => TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

/** Round profile photo, or coloured initials when there's none. */
export default function Avatar({ path, name, size = 40, ring }) {
  const url = useSignedUrl(path, 'avatars');
  return (
    <View accessibilityRole="image" accessibilityLabel={name ? `${name}’s photo` : 'Profile photo'}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: C.ink, backgroundColor: url ? '#fff' : toneOf(name), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...(ring ? { borderColor: C.lime, borderWidth: 3 } : null) }}>
      {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: Math.round(size * 0.4), fontWeight: '800', color: C.ink }}>{initials(name)}</Text>}
    </View>
  );
}

/** Your own photo with Take / Choose / Remove. */
export function AvatarEditor({ note }) {
  const { user, profile, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); const ok = await fn(); setBusy(false); if (ok) { await refresh(); cheer('profile'); } };
  const choose = (source) => run(() => pickAvatar(user.id, profile?.avatar_path, source));
  const remove = () => Alert.alert('Remove your photo?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => removeAvatar(user.id, profile?.avatar_path)) }]);
  const open = () => {
    const opts = ['Take a photo', 'Choose from gallery', ...(profile?.avatar_path ? ['Remove photo'] : []), 'Cancel'];
    const act = (i) => { if (i === 0) choose('camera'); else if (i === 1) choose('library'); else if (i === 2 && profile?.avatar_path) remove(); };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: opts.length - 1, destructiveButtonIndex: profile?.avatar_path ? 2 : undefined }, act);
    else Alert.alert('Profile photo', '', opts.slice(0, -1).map((t, i) => ({ text: t, onPress: () => act(i), style: t.startsWith('Remove') ? 'destructive' : 'default' })).concat({ text: 'Cancel', style: 'cancel' }));
  };
  return (
    <Row gap={14}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Change profile photo" disabled={busy}>
        <Avatar path={profile?.avatar_path} name={profile?.full_name} size={84} />
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.lime, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <Spinner style={{ padding: 0 }} /> : <Text style={{ fontSize: 14 }}>📷</Text>}
        </View>
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <T bold>Profile photo</T>
        <T small muted>{note || 'Shown next to your name. Only people you work with can see it.'}</T>
        <Btn small variant="pop" title={profile?.avatar_path ? 'Change photo' : 'Add photo'} onPress={open} disabled={busy} style={{ alignSelf: 'flex-start' }} />
      </View>
    </Row>
  );
}
