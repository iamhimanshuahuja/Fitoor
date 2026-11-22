import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import AskAI from '../../components/AskAI';
import ProgressDashboard from '../../components/ProgressDashboard';

export default function Progress() {
  const { user, profile, has } = useAuth();
  return (
    <div className="page">
      <div className="page-head">
        <h1>My progress</h1>
        {has('weight') && <Link className="btn btn-ghost btn-sm" to="/app/weight">Weight, inches & photos</Link>}
      </div>
      <ProgressDashboard userId={user.id} profile={profile} />
      <AskAI userId={user.id} about="self" />
    </div>
  );
}
