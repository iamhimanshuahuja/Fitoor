import { useAuth } from '../../../lib/auth';
import { Screen } from '../../../components/ui';
import GymPanel from '../../../components/GymPanel';
export default function GymTab() { const { user } = useAuth(); return <Screen><GymPanel userId={user.id} /></Screen>; }
