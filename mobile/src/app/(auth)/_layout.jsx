import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { C } from '../../theme';
export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper } }} />;
}
