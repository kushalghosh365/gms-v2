import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, UserCheck, Calendar, Clock, AlertTriangle, X, Wallet, MessageCircle, QrCode, LogOut } from 'lucide-react';

const OwnerDashboard = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  
  // WhatsApp States
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [waQR, setWaQR] = useState(null);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [isLoggingOutWa, setIsLoggingOutWa] = useState(false);
  const [waMessage, setWaMessage] = useState('');



  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/members');
      setMembers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const checkWaStatus = async () => {
    try {
      const res = await axios.get('/api/admin/whatsapp/status');
      setWaStatus(res.data.status);
      setWaQR(res.data.qr);
    } catch (err) {
      console.error('Failed to get WA status', err);
    }
  };

  // Check WA status every few seconds if modal is open and not connected
  useEffect(() => {
    let interval;
    if (showExpiryModal && waStatus !== 'CONNECTED') {
      checkWaStatus();
      interval = setInterval(checkWaStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [showExpiryModal, waStatus]);

  const handleSendReminders = async () => {
    if (waStatus !== 'CONNECTED') {
      alert("WhatsApp is not connected! Please scan the QR code first.");
      return;
    }
    if (expiringMembers.length === 0) return;

    setIsSendingWa(true);
    setWaMessage('Sending...');
    try {
      const res = await axios.post('/api/admin/whatsapp/send-reminders', {
        members: expiringMembers
      });
      setWaMessage(res.data.message);
      setTimeout(() => setWaMessage(''), 5000);
    } catch (err) {
      console.error(err);
      setWaMessage('Failed to send messages.');
      setTimeout(() => setWaMessage(''), 5000);
    } finally {
      setIsSendingWa(false);
    }
  };

  const handleWaLogout = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp? All session data will be removed.')) return;
    setIsLoggingOutWa(true);
    setWaMessage('');
    try {
      const res = await axios.post('/api/admin/whatsapp/logout');
      setWaStatus('DISCONNECTED');
      setWaQR(null);
      setWaMessage(res.data.message);
      setTimeout(() => setWaMessage(''), 5000);
    } catch (err) {
      console.error(err);
      setWaMessage('Failed to disconnect WhatsApp.');
      setTimeout(() => setWaMessage(''), 5000);
    } finally {
      setIsLoggingOutWa(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  
  // Stats
  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.membershipStatus === 'Valid').length;
  
  const expiringMembers = members.filter(m => {
    if (!m.expiryDate) return false;
    const diff = new Date(m.expiryDate) - new Date();
    return diff > 0 && diff < (5 * 24 * 60 * 60 * 1000); // 5 Days
  });

  const expiringSoonCount = expiringMembers.length;

  // Live Attendance (People who are currently IN)
  const liveAttendance = members.filter(m => {
    const todayLog = m.attendance?.find(a => a.date === today);
    return todayLog && todayLog.status === 'IN';
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900">Owner Control Tower</h1>
        <p className="text-slate-500">Real-time overview of your gym operations.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Users size={24} /></div>
            <span className="text-xs font-bold text-slate-400">TOTAL</span>
          </div>
          <p className="text-3xl font-black">{totalMembers}</p>
          <p className="text-sm text-slate-500 mt-1">Registered Members</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><UserCheck size={24} /></div>
            <span className="text-xs font-bold text-slate-400">ACTIVE</span>
          </div>
          <p className="text-3xl font-black text-emerald-600">{activeMembers}</p>
          <p className="text-sm text-slate-500 mt-1">Valid Subscriptions</p>
        </div>

        {/* CLICKABLE EXPIRY CARD */}
        <div 
          onClick={() => setShowExpiryModal(true)}
          className="bg-white p-6 rounded-2xl shadow-sm border border-orange-200 cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><AlertTriangle size={24} /></div>
            <span className="text-xs font-bold text-orange-400 underline">CLICK FOR LIST</span>
          </div>
          <p className="text-3xl font-black text-orange-600">{expiringSoonCount}</p>
          <p className="text-sm text-slate-500 mt-1">Expiring within 5 Days</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Clock size={24} /></div>
            <span className="text-xs font-bold text-slate-400">LIVE</span>
          </div>
          <p className="text-3xl font-black text-blue-600">{liveAttendance.length}</p>
          <p className="text-sm text-slate-500 mt-1">Currently Inside</p>
        </div>


      </div>

      {/* MODAL FOR EXPIRY LIST */}
      {showExpiryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50 rounded-t-3xl">
              <div>
                <h2 className="text-2xl font-black text-orange-800">Expiring within 5 Days</h2>
                <p className="text-orange-600 text-sm font-bold mt-1">{expiringSoonCount} Members</p>
              </div>
              <button onClick={() => setShowExpiryModal(false)} className="p-2 hover:bg-orange-200 rounded-full transition">
                <X size={24} className="text-orange-800" />
              </button>
            </div>
            
            {/* WhatsApp Integration Panel */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-xl text-white shadow-md ${waStatus === 'CONNECTED' ? 'bg-green-500' : 'bg-slate-700'}`}>
                  {waStatus === 'CONNECTED' ? <MessageCircle size={24} /> : <QrCode size={24} />}
                </div>
                <div>
                  <h3 className="font-black text-slate-800">WhatsApp Automation</h3>
                  <p className="text-xs text-slate-500 font-bold">
                    Status: <span className={waStatus === 'CONNECTED' ? 'text-green-600' : 'text-orange-600'}>{waStatus}</span>
                  </p>
                </div>
              </div>
              
              {waStatus === 'QR_READY' && waQR && (
                <div className="flex items-center space-x-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                  <img src={waQR} alt="WhatsApp QR" className="w-20 h-20" />
                  <p className="text-xs font-bold text-slate-600 max-w-[150px]">Scan this QR with your Gym's WhatsApp to link.</p>
                </div>
              )}

              <div className="flex flex-col items-end gap-2">
                <button 
                  onClick={handleSendReminders}
                  disabled={waStatus !== 'CONNECTED' || isSendingWa || expiringMembers.length === 0}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-black transition-all shadow-md ${
                    waStatus === 'CONNECTED' && !isSendingWa && expiringMembers.length > 0
                    ? 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg transform hover:-translate-y-1' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <MessageCircle size={18} />
                  <span>{isSendingWa ? 'Sending...' : 'All members to send msg'}</span>
                </button>

                {/* WhatsApp Disconnect / Logout Button */}
                {waStatus === 'CONNECTED' && (
                  <button
                    onClick={handleWaLogout}
                    disabled={isLoggingOutWa}
                    className="flex items-center space-x-2 px-6 py-3 rounded-xl font-black transition-all shadow-md bg-red-500 hover:bg-red-600 text-white hover:shadow-lg transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut size={18} />
                    <span>{isLoggingOutWa ? 'Disconnecting...' : 'Disconnect WhatsApp'}</span>
                  </button>
                )}

                {waMessage && <p className="text-xs font-bold text-green-600 mt-2">{waMessage}</p>}
              </div>
            </div>

            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              {expiringMembers.length > 0 ? expiringMembers.map(m => {
                const daysLeft = Math.ceil((new Date(m.expiryDate) - new Date()) / (24 * 60 * 60 * 1000));
                return (
                  <div key={m._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={m.photo ? `/${m.photo}` : 'https://via.placeholder.com/50'} 
                        className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm"
                        alt=""
                      />
                      <div>
                        <p className="font-bold text-slate-900">{m.fullName}</p>
                        <p className="text-sm text-slate-500 flex items-center space-x-1 mt-1">
                          <MessageCircle size={14} className="text-green-500" />
                          <span>{m.whatsapp ? m.whatsapp : 'No WhatsApp added'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">{daysLeft} Days Left</p>
                      <p className="text-xs text-slate-400">{new Date(m.expiryDate).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                )
              }) : (
                <p className="text-center text-slate-400 italic py-10">No members expiring within 5 days.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Live Attendance Table */}
        <div className="md:col-span-3 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h2 className="text-xl font-black flex items-center space-x-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              <span>Today's Live Attendance</span>
            </h2>
            <button onClick={fetchMembers} className="text-sm font-bold text-indigo-600 hover:underline">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Mobile</th>
                  <th className="px-6 py-4">In Time</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liveAttendance.length > 0 ? liveAttendance.map(m => (
                  <tr key={m._id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 flex items-center space-x-3">
                      <img 
                        src={m.photo ? `/${m.photo}` : 'https://via.placeholder.com/40'} 
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                        alt=""
                      />
                      <span className="font-bold text-slate-800">{m.fullName}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{m.phone}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {m.attendance.find(a => a.date === today)?.inTime}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full">IN GYM</span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">No one is currently in the gym.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
