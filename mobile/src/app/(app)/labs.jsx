import { useAuth } from '../../lib/auth';
import { Screen } from '../../components/ui';
import LabsPanel from '../../components/LabsPanel';
export default function Labs() { const { user } = useAuth(); return <Screen><LabsPanel userId={user.id} /></Screen>; }
