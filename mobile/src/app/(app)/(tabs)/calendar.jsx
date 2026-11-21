import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { Screen } from '../../../components/ui';
import MonthCalendar from '../../../components/MonthCalendar';

export default function CalendarTab() {
  const { user } = useAuth();
  return <Screen><MonthCalendar userId={user.id} onOpen={(d) => router.navigate({ pathname: '/today', params: { date: d } })} /></Screen>;
}
