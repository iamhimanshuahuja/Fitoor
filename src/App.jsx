import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import { AppLayout, AdminLayout } from './components/Layout';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import { Login, Signup, ResetPassword } from './pages/Auth';
import Today from './pages/app/Today';
const Weight = lazy(() => import('./pages/app/Weight'));
const Calendar = lazy(() => import('./pages/app/Calendar'));
const Progress = lazy(() => import('./pages/app/Progress'));
const PrintPlan = lazy(() => import('./pages/PrintPlan'));
const Gym = lazy(() => import('./pages/app/Gym'));
const Labs = lazy(() => import('./pages/app/Labs'));
import Plan from './pages/app/Plan';
import Profile from './pages/app/Profile';
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const UserDetail = lazy(() => import('./pages/admin/UserDetail'));
const Plans = lazy(() => import('./pages/admin/Plans'));
const Coaches = lazy(() => import('./pages/admin/Coaches'));
const AdminRecipes = lazy(() => import('./pages/admin/Recipes'));
const AdminMe = lazy(() => import('./pages/admin/Me'));
const RecipeList = lazy(() => import('./pages/recipes/RecipeList'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const RecipeDetail = lazy(() => import('./pages/recipes/RecipeDetail'));
const RecipeEditor = lazy(() => import('./pages/recipes/RecipeEditor'));

function RequireAuth({ children, admin, feature, clientOnly, superOnly }) {
  const { user, loading, isAdmin, isSuper, has, profile, profileError, refresh } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center-screen"><Spinner size={28} /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!profile) return (
    <div className="center-screen">
      {profileError ? (
        <div className="stack-center">
          <p>We couldn't load your profile.<br /><small className="muted">{profileError}</small></p>
          <button className="btn btn-primary" onClick={refresh}>Try again</button>
        </div>
      ) : <Spinner size={28} />}
    </div>
  );
  if (profile && profile.active === false && !isAdmin) return <div className="center-screen"><p>Your account is paused. Please contact your coach.</p></div>;
  if (admin && !isAdmin) return <Navigate to="/app" replace />;
  if (clientOnly && isAdmin) return <Navigate to="/admin" replace />;
  if (superOnly && !isSuper) return <Navigate to="/admin" replace />;
  if (feature && !has(feature)) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="center-screen setup-note">
        <img src="/logo.svg" alt="Fitoor" height={64} />
        <h2>Connect Supabase to start</h2>
        <p>Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.</p>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="center-screen"><Spinner size={28} /></div>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/recipes" element={<RecipeList />} />
      <Route path="/recipes/new" element={<RequireAuth><RecipeEditor /></RequireAuth>} />
      <Route path="/recipes/edit/:id" element={<RequireAuth><RecipeEditor /></RequireAuth>} />
      <Route path="/recipes/:slug" element={<RecipeDetail />} />
      <Route path="/print/plan" element={<RequireAuth><PrintPlan /></RequireAuth>} />
      <Route path="/print/plan/:id" element={<RequireAuth admin><PrintPlan /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth clientOnly><AppLayout /></RequireAuth>}>
        <Route index element={<Today />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="progress" element={<Progress />} />
        <Route path="weight" element={<RequireAuth feature="weight"><Weight /></RequireAuth>} />
        <Route path="gym" element={<RequireAuth feature="gym"><Gym /></RequireAuth>} />
        <Route path="labs" element={<RequireAuth feature="labs"><Labs /></RequireAuth>} />
        <Route path="plan" element={<RequireAuth feature="diet"><Plan /></RequireAuth>} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/admin" element={<RequireAuth admin><AdminLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="plans" element={<Plans />} />
        <Route path="coaches" element={<RequireAuth superOnly><Coaches /></RequireAuth>} />
        <Route path="recipes" element={<AdminRecipes />} />
        <Route path="me" element={<AdminMe />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
