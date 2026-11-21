import { View } from 'react-native';
import { useAuth } from '../lib/auth';
import { Btn, H1, T } from '../components/ui';
import { C } from '../theme';
export default function Paused() {
  const { signOut } = useAuth();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: C.paper }}>
      <H1>Account paused</H1>
      <T>Your coach has paused this account. Message them to switch it back on.</T>
      <Btn title="Sign out" variant="ghost" onPress={signOut} />
    </View>
  );
}
