import { useAuth } from '../../lib/auth';
import CalendarView from '../../components/CalendarView';

export default function Calendar() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="page-head"><h1>My calendar</h1></div>
      <CalendarView userId={user.id} mode="user" />
    </div>
  );
}
