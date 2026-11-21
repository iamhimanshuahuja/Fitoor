import { Tabs, router } from 'expo-router';
import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../../lib/auth';
import { C } from '../../../theme';

const icon = (name) => ({ color, size }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const { has } = useAuth();
  const MeBtn = () => (
    <Pressable onPress={() => router.push('/me')} accessibilityRole="button" accessibilityLabel="Me" hitSlop={10} style={{ marginRight: 14, padding: 6, borderWidth: 2, borderColor: C.ink, borderRadius: 12, backgroundColor: '#fff' }}>
      <Ionicons name="person-outline" size={20} color={C.ink} />
    </Pressable>
  );
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: C.paper }, headerShadowVisible: false, headerTitleStyle: { fontWeight: '800', fontSize: 20, color: C.ink }, headerRight: MeBtn,
      tabBarActiveTintColor: C.ink, tabBarInactiveTintColor: '#6F8075', tabBarActiveBackgroundColor: C.lime,
      tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 2, borderTopColor: C.ink }, tabBarItemStyle: { borderRadius: 12, marginHorizontal: 3, marginTop: 4 },
      tabBarLabelStyle: { fontWeight: '700', fontSize: 11 }, sceneStyle: { backgroundColor: C.paper },
    }}>
      <Tabs.Screen name="today" options={{ title: 'Today', headerTitle: 'fitoor', tabBarIcon: icon('today-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('trending-up-outline') }} />
      <Tabs.Screen name="gym" options={{ title: 'Gym', tabBarIcon: icon('barbell-outline'), href: has('gym') ? undefined : null }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('clipboard-outline'), href: has('diet') ? undefined : null }} />
    </Tabs>
  );
}
