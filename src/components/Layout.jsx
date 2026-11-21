import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarRange, TrendingUp, Scale, Dumbbell, FlaskConical, ClipboardList, User, LayoutDashboard, Users, Layers, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo } from './ui';

export function AppLayout() {
  const { has, isAdmin, signOut, profile } = useAuth();
  const nav = useNavigate();
  const items = [
    { to: '/app', label: 'Today', icon: CalendarDays, end: true, show: true },
    { to: '/app/calendar', label: 'Calendar', icon: CalendarRange, show: true },
    { to: '/app/progress', label: 'Progress', icon: TrendingUp, show: true },
    { to: '/app/weight', label: 'Weight', icon: Scale, show: has('weight'), desktopOnly: true },
    { to: '/app/gym', label: 'Gym', icon: Dumbbell, show: has('gym') },
    { to: '/app/labs', label: 'Labs', icon: FlaskConical, show: has('labs') },
    { to: '/app/plan', label: 'Plan', icon: ClipboardList, show: has('diet') },
    { to: '/app/profile', label: 'Me', icon: User, show: true },
  ].filter((i) => i.show);
  return (
    <Shell items={items} subtitle={profile?.full_name} extra={isAdmin && (
      <NavLink to="/admin" className="side-link admin-link"><Shield size={18} /> Admin panel</NavLink>
    )} onSignOut={async () => { await signOut(); nav('/'); }} />
  );
}

export function AdminLayout() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const items = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/plans', label: 'Plans & library', icon: Layers },
  ];
  return <Shell items={items} subtitle="Admin" admin onSignOut={async () => { await signOut(); nav('/'); }} />;
}

function Shell({ items, subtitle, extra, onSignOut, admin }) {
  return (
    <div className={`shell ${admin ? 'is-admin' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand"><Logo height={34} /></div>
        {subtitle && <div className="sidebar-sub">{subtitle}</div>}
        <nav>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="side-link"><Icon size={18} /> {label}</NavLink>
          ))}
          {extra}
        </nav>
        <button className="side-link signout" onClick={onSignOut}><LogOut size={18} /> Sign out</button>
      </aside>
      <header className="topbar">
        <img src="/logo-inline.svg" alt="Fitoor" height={30} />
        <span className="topbar-title">{admin ? 'Coach' : ''}</span>
        {!admin && <NavLink to="/app/profile" className="icon-btn topbar-me" aria-label="My profile"><User size={19} /></NavLink>}
        <button className="icon-btn" onClick={onSignOut} aria-label="Sign out"><LogOut size={18} /></button>
      </header>
      <main className="main"><Outlet /></main>
      <nav className="bottomnav">
        {items.filter((i) => i.to !== '/app/profile' && !i.desktopOnly).slice(0, 6).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}><Icon size={21} /><span>{label}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}
