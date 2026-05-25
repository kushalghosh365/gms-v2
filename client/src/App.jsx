import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Monitor, ArrowRightLeft, Briefcase, CheckSquare, Lock, LogOut } from 'lucide-react';
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

  const handleLogin = () => setIsAuthenticated(true);
  const handleLogout = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUsername');
    setIsAuthenticated(false);
  };

  const getLinkClass = (path, type = 'normal') => {
    const isActive = location.pathname === path;
    const base = "flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ";
    if (type === 'owner') {
      return base + (isActive 
        ? "border-2 border-rose-500 bg-rose-500/20 text-rose-400 font-black shadow-[0_0_15px_rgba(244,63,94,0.15)] mt-2" 
        : "hover:bg-slate-800 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 mt-2");
    }
    if (type === 'indigo') {
      return base + (isActive 
        ? "border border-indigo-500 bg-indigo-500/20 text-indigo-300 font-bold" 
        : "hover:bg-slate-800 text-indigo-300 border border-indigo-500/10 hover:border-indigo-500/30");
    }
    return base + (isActive ? "bg-slate-800 text-indigo-400 font-bold" : "hover:bg-slate-800 text-slate-300");
  };

  if (!isKiosk && isSetup === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 font-bold text-slate-500">Loading...</div>;
  }

  const renderSidebar = !isKiosk && !isAuthPage && isAuthenticated;

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar - Hidden on Kiosk and Auth Pages */}
      {renderSidebar && (
        <aside className="w-64 bg-slate-900 text-white flex flex-col sticky top-0 h-screen">
          <div className="p-4 flex items-center space-x-3 border-b border-slate-800">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-white tracking-wide">Fitness Fanatic</span>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/" className={getLinkClass('/')}>
              <LayoutDashboard size={20} />
              <span>Owner Dashboard</span>
            </Link>
            <Link to="/members" className={getLinkClass('/members')}>
              <Users size={20} />
              <span>Member List</span>
            </Link>
            <Link to="/attendance" className={getLinkClass('/attendance')}>
              <ArrowRightLeft size={20} />
              <span>Attendance History</span>
            </Link>
            <Link to="/register" className={getLinkClass('/register')}>
              <UserPlus size={20} />
              <span>New Registration</span>
            </Link>
            <Link to="/confirmations" className={getLinkClass('/confirmations', 'indigo')}>
              <CheckSquare size={20} />
              <span>Payment Confirmations</span>
            </Link>
            <Link to="/owner-control" className={getLinkClass('/owner-control', 'owner')}>
              <Lock size={20} />
              <span>Owner Control</span>
            </Link>
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
              <Link to="/kiosk" className="flex items-center space-x-3 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition">
                <Monitor size={20} />
                <span>Member Kiosk</span>
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-800 transition text-rose-400 border border-rose-500/20">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 min-w-0 ${isKiosk || isAuthPage ? 'p-0' : 'p-8'}`}>
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
             <Route path="*" element={<Navigate to={isSetup ? "/admin-login" : "/admin-register"} />} />
          ) : null}
        </Routes>
      </main>
    </div>
  );
}

export default App;
