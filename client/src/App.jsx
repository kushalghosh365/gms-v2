import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Monitor, ArrowRightLeft, CheckSquare, Lock, LogOut, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import OwnerDashboard from './pages/OwnerDashboard';
import MemberList from './pages/MemberList';
import MemberRegistration from './pages/MemberRegistration';
import MemberKiosk from './pages/MemberKiosk';
import AttendanceHistory from './pages/AttendanceHistory';
import StaffList from './pages/StaffList';
import PaymentConfirmations from './pages/PaymentConfirmations';
import OwnerControl from './pages/OwnerControl';
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const location = useLocation();
  const isKiosk = location.pathname === '/kiosk';
  const isAuthPage = location.pathname === '/admin-login' || location.pathname === '/admin-register';

  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('adminToken'));
  const [isSetup, setIsSetup] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isKiosk) {
      sessionStorage.removeItem('adminToken');
      sessionStorage.removeItem('adminUsername');
      setIsAuthenticated(false);
    } else {
      axios.get('/api/admin/setup-status')
        .then(res => setIsSetup(res.data.isSetup))
        .catch(err => console.error(err));
    }
  }, [isKiosk]);

  // Close sidebar whenever route changes (mobile link tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUsername');
    setIsAuthenticated(false);
    setSidebarOpen(false);
  };

  const getLinkClass = (path, type = 'normal') => {
    const isActive = location.pathname === path;
    const base = 'flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ';
    if (type === 'owner') {
      return base + (isActive
        ? 'border-2 border-rose-500 bg-rose-500/20 text-rose-400 font-black shadow-[0_0_15px_rgba(244,63,94,0.15)] mt-2'
        : 'hover:bg-slate-800 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 mt-2');
    }
    if (type === 'indigo') {
      return base + (isActive
        ? 'border border-indigo-500 bg-indigo-500/20 text-indigo-300 font-bold'
        : 'hover:bg-slate-800 text-indigo-300 border border-indigo-500/10 hover:border-indigo-500/30');
    }
    return base + (isActive ? 'bg-slate-800 text-indigo-400 font-bold' : 'hover:bg-slate-800 text-slate-300');
  };

  if (!isKiosk && isSetup === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 font-bold text-slate-500">Loading...</div>;
  }

  const renderSidebar = !isKiosk && !isAuthPage && isAuthenticated;

  // Shared nav links (used in both desktop & mobile sidebar)
  const NavLinks = () => (
    <>
      <div className="p-4 flex items-center space-x-3 border-b border-slate-800">
        <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
        <span className="text-xl font-bold text-white tracking-wide">Fitness Fanatic</span>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link to="/" className={getLinkClass('/')}>
          <LayoutDashboard size={20} /><span>Owner Dashboard</span>
        </Link>
        <Link to="/members" className={getLinkClass('/members')}>
          <Users size={20} /><span>Member List</span>
        </Link>
        <Link to="/attendance" className={getLinkClass('/attendance')}>
          <ArrowRightLeft size={20} /><span>Attendance History</span>
        </Link>
        <Link to="/register" className={getLinkClass('/register')}>
          <UserPlus size={20} /><span>New Registration</span>
        </Link>
        <Link to="/confirmations" className={getLinkClass('/confirmations', 'indigo')}>
          <CheckSquare size={20} /><span>Payment Confirmations</span>
        </Link>
        <Link to="/owner-control" className={getLinkClass('/owner-control', 'owner')}>
          <Lock size={20} /><span>Owner Control</span>
        </Link>
        <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
          <Link to="/kiosk" className="flex items-center space-x-3 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition">
            <Monitor size={20} /><span>Member Kiosk</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition text-rose-400 border border-rose-500/20"
          >
            <LogOut size={20} /><span>Logout</span>
          </button>
        </div>
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* ── DESKTOP Sidebar (md and above, unchanged) ── */}
      {renderSidebar && (
        <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col sticky top-0 h-screen">
          <NavLinks />
        </aside>
      )}

      {/* ── MOBILE Sidebar overlay ── */}
      {renderSidebar && (
        <>
          {/* Dark backdrop */}
          <div
            className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Slide-in drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            {/* Close (X) button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition z-10"
              aria-label="Close menu"
            >
              <X size={18} className="text-white" />
            </button>
            <NavLinks />
          </aside>
        </>
      )}

      {/* Main content wrapper */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* ── MOBILE Top Bar with Hamburger (hidden on desktop) ── */}
        {renderSidebar && (
          <header className="md:hidden sticky top-0 z-30 bg-slate-900 text-white flex items-center px-4 py-3 shadow-lg gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
              aria-label="Open menu"
            >
              <Menu size={20} className="text-white" />
            </button>
            <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold tracking-wide">Fitness Fanatic</span>
          </header>
        )}

        {/* Page content */}
        <main className={`flex-1 ${isKiosk || isAuthPage ? 'p-0' : 'p-4 md:p-8'}`}>
          <Routes>
            <Route path="/admin-login" element={<AdminLogin onLogin={handleLogin} />} />
            <Route path="/admin-register" element={<AdminRegister />} />
            <Route path="/kiosk" element={<MemberKiosk />} />

            {isAuthenticated ? (
              <>
                <Route path="/" element={<OwnerDashboard />} />
                <Route path="/members" element={<MemberList />} />
                <Route path="/register" element={<MemberRegistration />} />
                <Route path="/confirmations" element={<PaymentConfirmations />} />
                <Route path="/attendance" element={<AttendanceHistory />} />
                <Route path="/owner-control" element={<OwnerControl />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            ) : !isKiosk ? (
              <Route path="*" element={<Navigate to={isSetup ? '/admin-login' : '/admin-register'} />} />
            ) : null}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
