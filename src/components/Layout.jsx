import ChatLog from './ChatLog';
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
    )} name={profile?.full_name} fab={<ChatLog />} onSignOut={async () => { await signOut(); nav('/'); }} />
  );
}

export function AdminLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const items = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/plans', label: 'Plans & library', icon: Layers },
  ];
  return <Shell items={items} subtitle="Admin" admin name={profile?.full_name} onSignOut={async () => { await signOut(); nav('/'); }} />;
}

const TIPS = [
  'Protein first, then the rest.', 'Water before chai.', 'Half the plate veggies.', 'Walk 10 minutes after meals.',
  'Sleep is part of the plan.', 'Small wins, every day.', 'Snap it before you eat it.', 'Plate se PR tak.',
];
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Laptop/desktop header (≥900px): greeting row + menu tabs. Phones use the top bar + bottom nav instead. */
function DeskBar({ items, extra, onSignOut, admin, name }) {
  const first = (name || '').trim().split(/\s+/)[0];
  const now = new Date();
  const tip = TIPS[(now.getDate() + now.getMonth()) % TIPS.length];
  return (
    <header className="deskbar">
      <div className="deskbar-inner">
        <div className="deskbar-top">
          <img src={admin ? '/logo-inline-dark.svg' : '/logo-inline.svg'} alt="Fitoor" height={34} />
          <div className="deskbar-greet">
            <b>{greeting()}{first ? `, ${first}` : ''} 👋</b>
            <span>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {admin ? 'Coach panel' : tip}</span>
          </div>
          {!admin && <NavLink to="/app/profile" className="deskbar-btn" aria-label="My profile"><User size={18} /> Me</NavLink>}
          <button className="deskbar-btn ghost" onClick={onSignOut}><LogOut size={17} /> Sign out</button>
        </div>
        <nav className="deskbar-nav" aria-label="Main menu">
          {items.filter((i) => i.to !== '/app/profile').map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon size={17} /> {label}</NavLink>
          ))}
          {extra}
        </nav>
      </div>
    </header>
  );
}

function Shell({ items, subtitle, extra, onSignOut, admin, fab, name }) {
  return (
    <div className={`shell ${admin ? 'is-admin' : ''}`}>
      <DeskBar items={items} extra={extra} onSignOut={onSignOut} admin={admin} name={name} />
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
      {fab}
      <nav className="bottomnav">
        {items.filter((i) => i.to !== '/app/profile' && !i.desktopOnly).slice(0, 6).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}><Icon size={21} /><span>{label}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}
