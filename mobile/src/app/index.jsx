import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../lib/auth';
import { isConfigured } from '../lib/supabase';
import { H1, Spinner, T } from '../components/ui';
import { C } from '../theme';

/** Entry: send people to login, the client app, or the coach app. */
export default function Index() {
  const { loading, session, isAdmin, profile } = useAuth();
  if (!isConfigured) return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 10, backgroundColor: C.paper }}>
      <H1>Setup needed</H1>
      <T>Copy mobile/.env.example to mobile/.env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.</T>
    </View>
  );
  if (loading || (session && !profile)) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.paper }}><Spinner /></View>;
  if (!session) return <Redirect href="/login" />;
  return <Redirect href={isAdmin ? '/coach' : '/today'} />;
}
