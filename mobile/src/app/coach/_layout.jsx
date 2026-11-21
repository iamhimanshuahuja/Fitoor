import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import TermsGate from '../../components/TermsGate';
import { C } from '../../theme';

/** Coach / super admin area. */
export default function CoachLayout() {
  const { session, loading, isAdmin } = useAuth();
  if (!loading && !session) return <Redirect href="/login" />;
  if (!loading && !isAdmin) return <Redirect href="/today" />;
  return (
    <>
      <Stack screenOptions={{ headerStyle: { backgroundColor: C.ink }, headerTintColor: C.lime, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: C.paper }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ title: 'Fitoor coach' }} />
        <Stack.Screen name="client/[id]" options={{ title: 'Client' }} />
        <Stack.Screen name="recipes" options={{ title: 'Recipe reviews' }} />
        <Stack.Screen name="recipe/[slug]" options={{ title: 'Recipe' }} />
      </Stack>
      <TermsGate />
    </>
  );
}
