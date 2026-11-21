import { View } from 'react-native';
import { useAuth } from '../lib/auth';
import { Btn, Spinner, T } from './ui';
import { C } from '../theme';

/** Shown while the session/profile load, or if the profile couldn't be loaded. */
export default function Booting() {
  const { profileError, refresh, signOut, session } = useAuth();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24, backgroundColor: C.paper }}>
      {session && profileError ? (
        <>
          <T bold style={{ textAlign: 'center' }}>Couldn’t load your profile</T>
          <T small muted style={{ textAlign: 'center' }}>{profileError}. Check your internet and try again.</T>
          <Btn title="Try again" onPress={refresh} />
          <Btn variant="ghost" title="Sign out" onPress={signOut} />
        </>
      ) : <Spinner />}
    </View>
  );
}
