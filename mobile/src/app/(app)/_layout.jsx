import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import TermsGate from '../../components/TermsGate';
import { C } from '../../theme';

/** Client area. Coaches/super admins are sent to /coach. */
export default function AppLayout() {
  const { session, loading, isAdmin, profile } = useAuth();
  if (!loading && !session) return <Redirect href="/login" />;
  if (isAdmin) return <Redirect href="/coach" />;
  if (profile && profile.active === false) return <Redirect href="/paused" />;
  return (
    <>
      <Stack screenOptions={{ headerStyle: { backgroundColor: C.paper }, headerShadowVisible: false, headerTintColor: C.ink, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: C.paper }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="me" options={{ title: 'Me' }} />
        <Stack.Screen name="weight" options={{ title: 'Weight & inches' }} />
        <Stack.Screen name="labs" options={{ title: 'Lab reports' }} />
        <Stack.Screen name="scan" options={{ title: '📸 Guess calories', presentation: 'modal' }} />
        <Stack.Screen name="chat" options={{ title: '✨ Log by chat', presentation: 'modal' }} />
        <Stack.Screen name="recipes" options={{ title: 'Recipes' }} />
        <Stack.Screen name="recipe/[slug]" options={{ title: 'Recipe' }} />
        <Stack.Screen name="recipe-new" options={{ title: 'Add a recipe' }} />
      </Stack>
      <TermsGate />
    </>
  );
}
