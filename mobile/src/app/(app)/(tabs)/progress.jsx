import { useAuth } from '../../../lib/auth';
import { Screen } from '../../../components/ui';
import ProgressPanel from '../../../components/ProgressPanel';
import AskAI from '../../../components/AskAI';
export default function ProgressTab() {
  const { user, profile } = useAuth();
  return <Screen><ProgressPanel userId={user.id} profile={profile} /><AskAI userId={user.id} /></Screen>;
}
