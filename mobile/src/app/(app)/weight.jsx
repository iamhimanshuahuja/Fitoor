import { useAuth } from '../../lib/auth';
import { Screen } from '../../components/ui';
import WeightPanel from '../../components/WeightPanel';
export default function Weight() { const { user, profile } = useAuth(); return <Screen><WeightPanel userId={user.id} profile={profile} /></Screen>; }
