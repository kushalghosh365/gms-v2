import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Search, Phone, Briefcase, CheckCircle, XCircle, LogIn, LogOut, Clock, CalendarX2, Monitor, X, Download, Lock, User, Trash2, Send } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';

const StaffList = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [staff, setStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({});

  const [qrModal, setQrModal] = useState({ show: false, member: null });
  const [detailsModal, setDetailsModal] = useState({ show: false, staff: null });
  const cardRef = useRef(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ show: false, staff: null });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Send QR state
  const [sendQrStatus, setSendQrStatus] = useState({});

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('/api/staff');
      setStaff(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const handleManualAttendance = async (phone, action, memberId) => {
    try {
      await axios.post('/api/admin/staff-attendance', { phone, action });

      setStatusMessage(prev => ({ ...prev, [memberId]: `${action.replace('_', ' ')} Success!` }));
      setTimeout(() => {
        setStatusMessage(prev => {
          const { [memberId]: _, ...rest } = prev;
          return rest;
        });
      }, 3000);

      fetchStaff();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteStaff = async () => {
    if (!deletePassword.trim()) { alert('Please enter admin password'); return; }
    setDeleteLoading(true);
    try {
      await axios.delete(`/api/staff/${deleteModal.staff._id}`, { data: { password: deletePassword } });
      setDeleteModal({ show: false, staff: null });
      setDeletePassword('');
      fetchStaff();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSendQR = async (s) => {
    setSendQrStatus(prev => ({ ...prev, [s._id]: 'sending' }));
    try {
      await axios.post('/api/admin/whatsapp/send-qr', { phone: s.phone, name: s.fullName, whatsapp: s.whatsapp });
      setSendQrStatus(prev => ({ ...prev, [s._id]: 'sent' }));
      setTimeout(() => setSendQrStatus(prev => { const { [s._id]: _, ...rest } = prev; return rest; }), 3000);
    } catch (err) {
      setSendQrStatus(prev => ({ ...prev, [s._id]: 'error' }));
      setTimeout(() => setSendQrStatus(prev => { const { [s._id]: _, ...rest } = prev; return rest; }), 3000);
      alert(err.response?.data?.error || 'Failed to send QR');
    }
  };

  const downloadQRCard = () => {
    if (cardRef.current) {
      setTimeout(() => {
        html2canvas(cardRef.current, {
          useCORS: true,
          scale: 2,
          backgroundColor: "#ffffff",
          logging: true
        }).then(canvas => {
          const link = document.createElement('a');
          link.download = `${qrModal.member.fullName}_QR_Card.png`;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(err => {
          console.error('Error generating QR Card:', err);
          alert('Failed to download QR Card. Please try again.');
        });
      }, 500);
    }
  };

  const calculateStats = (attendance) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    let currentWorked = 0, currentLeave = 0;
    let prevWorked = 0, prevLeave = 0;

    if (attendance) {
      attendance.forEach(record => {
        const parts = record.date.split('-');
        if (parts.length === 3) {
          const rYear = parseInt(parts[0], 10);
          const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed month

          if (rMonth === currentMonth && rYear === currentYear) {
            if (record.dayType === 'FULL_DAY') currentWorked += 1;
            else if (record.dayType === 'HALF_DAY') currentWorked += 0.5;
            else if (record.dayType === 'FULL_LEAVE') currentLeave += 1;
            else if (record.dayType === 'HALF_LEAVE') currentLeave += 0.5;
            else if (record.dayType === 'HALF_WORK_HALF_LEAVE') {
              currentWorked += 0.5;
              currentLeave += 0.5;
            }
          } else if (rMonth === prevMonth && rYear === prevYear) {
            if (record.dayType === 'FULL_DAY') prevWorked += 1;
            else if (record.dayType === 'HALF_DAY') prevWorked += 0.5;
            else if (record.dayType === 'FULL_LEAVE') prevLeave += 1;
            else if (record.dayType === 'HALF_LEAVE') prevLeave += 0.5;
            else if (record.dayType === 'HALF_WORK_HALF_LEAVE') {
              prevWorked += 0.5;
              prevLeave += 0.5;
            }
          }
        }
      });
    }

    return {
      currentStr: `1/${monthNames[currentMonth]}/${currentYear} - Present`,
      currentWorked, currentLeave,
      prevStr: fullMonthNames[prevMonth],
      prevWorked, prevLeave
    };
  };

  const filteredStaff = staff.filter(s =>
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm)
  );



  const todayStr = new Date().toISOString().split('T')[0];
  const liveStaff = staff.filter(s => {
    const record = s.attendance.find(a => a.date === todayStr);
    return record && record.status === 'IN';
  });

  const todayAttendance = staff.filter(s => s.attendance.some(a => a.date === todayStr)).map(s => {
    return {
      staff: s,
      record: s.attendance.find(a => a.date === todayStr)
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Staff Sections</h1>
          <p className="text-slate-500">Manage gym employees and track attendance.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Staff List
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-600 text-white rounded-3xl p-6 shadow-lg shadow-indigo-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Briefcase size={24} />
                </div>
                <h3 className="font-bold text-lg opacity-90">Total Registered Staffs</h3>
              </div>
              <p className="text-4xl font-black">{staff.length}</p>
            </div>

            <div className="bg-emerald-500 text-white rounded-3xl p-6 shadow-lg shadow-emerald-200">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Monitor size={24} />
                </div>
                <h3 className="font-bold text-lg opacity-90">LIVE Currently Inside</h3>
              </div>
              <p className="text-4xl font-black">{liveStaff.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-black text-xl text-slate-900 mb-6">Today's Live Staffs Attendance</h3>
            {todayAttendance.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <p>No staff has marked attendance today.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-sm font-bold text-slate-400">
                      <th className="py-3 px-4">Staff Name</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">IN Time</th>
                      <th className="py-3 px-4">OUT Time</th>
                      <th className="py-3 px-4 text-right">Day Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendance.map(({ staff: s, record }, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition">
                        <td className="py-4 px-4 font-bold text-slate-900 flex items-center space-x-3">
                          <img src={s.photo ? (s.photo.startsWith("http") ? s.photo : s.photo) : 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full object-cover" crossOrigin={s.photo ? "anonymous" : undefined} />
                          <span>{s.fullName}</span>
                        </td>
                        <td className="py-4 px-4 text-indigo-600 font-bold text-xs uppercase tracking-wider">{s.role}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${record.status === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-600">{record.inTime || '-'}</td>
                        <td className="py-4 px-4 font-medium text-slate-600">{record.outTime || '-'}</td>
                        <td className="py-4 px-4 text-right">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                            {record.dayType.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'list' && (
        <>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition" />
            <input
              type="text"
              placeholder="Search by Name or Mobile Number..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map(s => {
              const stats = calculateStats(s.attendance);
              return (
                <div key={s._id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">

                  {statusMessage[s._id] && (
                    <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in duration-300">
                      <div className="bg-white px-4 py-2 rounded-2xl shadow-xl border border-slate-100 animate-in zoom-in slide-in-from-bottom-2 duration-300">
                        <p className="text-sm font-black text-slate-900 flex items-center space-x-2">
                          <CheckCircle size={16} className="text-emerald-500" />
                          <span>{statusMessage[s._id]}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => { setDeleteModal({ show: true, staff: s }); setDeletePassword(''); }}
                    className="absolute top-3 left-3 p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition opacity-0 group-hover:opacity-100 z-10"
                    title="Delete Staff"
                  >
                    <Trash2 size={13} />
                  </button>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4">
                      <img
                        src={s.photo ? (s.photo.startsWith("http") ? s.photo : s.photo) : 'https://via.placeholder.com/60'}
                        crossOrigin={s.photo ? "anonymous" : undefined}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 group-hover:scale-105 transition-transform"
                        alt={s.fullName}
                      />
                      <div>
                        <h3 className="font-black text-xl text-slate-900 leading-tight flex items-center flex-wrap gap-2">
                          {s.fullName}
                          <button
                            onClick={() => setDetailsModal({ show: true, staff: s })}
                            className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition flex items-center gap-1 uppercase tracking-wider font-bold"
                          >
                            <User size={10} /> Details
                          </button>
                        </h3>
                        <p className="text-indigo-600 font-bold text-xs uppercase tracking-wider mt-1">{s.role}</p>
                        <p className="text-slate-400 text-xs flex items-center space-x-1 mt-1">
                          <Phone size={10} />
                          <span>{s.phone}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Trackers */}
                  <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100">
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-600">{stats.currentStr}</span>
                        <span className="text-xs font-black text-emerald-600">{stats.currentWorked} Days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400">Leave day</span>
                        <span className="text-[10px] font-bold text-rose-500">{stats.currentLeave} Days</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-500">{stats.prevStr}</span>
                        <span className="text-[10px] font-black text-slate-700">{stats.prevWorked} Days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400">Leave day</span>
                        <span className="text-[10px] font-bold text-slate-400">{stats.prevLeave} Days</span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Controls */}
                  <div className="mt-auto pt-2 grid grid-cols-5 gap-1.5">
                    <button
                      onClick={() => handleManualAttendance(s.phone, 'IN', s._id)}
                      className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:scale-95 flex flex-col items-center justify-center transition-all shadow-sm"
                    >
                      <LogIn size={14} />
                      <span className="text-[8px] font-bold mt-1">IN</span>
                    </button>
                    <button
                      onClick={() => handleManualAttendance(s.phone, 'OUT', s._id)}
                      className="p-1.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 active:scale-95 flex flex-col items-center justify-center transition-all shadow-sm"
                    >
                      <LogOut size={14} />
                      <span className="text-[8px] font-bold mt-1">OUT</span>
                    </button>
                    <button
                      onClick={() => handleManualAttendance(s.phone, 'FULL_LEAVE', s._id)}
                      className="p-1.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 active:scale-95 flex flex-col items-center justify-center transition-all shadow-sm"
                    >
                      <CalendarX2 size={14} />
                      <span className="text-[8px] font-bold mt-1 text-center leading-tight">FULL<br />LV</span>
                    </button>
                    <button
                      onClick={() => handleManualAttendance(s.phone, 'HALF_LEAVE', s._id)}
                      className="p-1.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 active:scale-95 flex flex-col items-center justify-center transition-all shadow-sm"
                    >
                      <CalendarX2 size={14} />
                      <span className="text-[8px] font-bold mt-1 text-center leading-tight">HALF<br />LV</span>
                    </button>
                    <button
                      onClick={() => setQrModal({ show: true, member: s })}
                      className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 active:scale-95 flex flex-col items-center justify-center transition-all shadow-sm"
                    >
                      <Monitor size={14} />
                      <span className="text-[8px] font-bold mt-1">QR</span>
                    </button>
                    <button
                      onClick={() => handleSendQR(s)}
                      disabled={sendQrStatus[s._id] === 'sending'}
                      className={`p-1.5 rounded-xl active:scale-95 flex flex-col items-center justify-center transition-all shadow-sm ${
                        sendQrStatus[s._id] === 'sent' ? 'bg-green-100 text-green-600' :
                        sendQrStatus[s._id] === 'error' ? 'bg-red-100 text-red-600' :
                        'bg-teal-50 text-teal-600 hover:bg-teal-100'
                      }`}
                      title="Send QR to WhatsApp"
                    >
                      <Send size={14} />
                      <span className="text-[8px] font-bold mt-1">
                        {sendQrStatus[s._id] === 'sending' ? '...' : sendQrStatus[s._id] === 'sent' ? '✓' : sendQrStatus[s._id] === 'error' ? '✗' : 'WA'}
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && deleteModal.staff && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-2xl"><Trash2 size={24} className="text-red-600" /></div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Delete Staff</h2>
                <p className="text-sm text-slate-500">Registration only — history preserved</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <p className="text-sm font-bold text-red-800">⚠️ <span className="font-black">{deleteModal.staff.fullName}</span> will be removed.</p>
              <p className="text-xs text-red-600 mt-1">Attendance records will be preserved.</p>
            </div>
            <div className="space-y-2 mb-6">
              <label className="text-sm font-bold text-slate-700">Enter Admin Password</label>
              <input
                type="password"
                placeholder="Admin Password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-red-400 outline-none font-bold"
                onKeyDown={(e) => e.key === 'Enter' && handleDeleteStaff()}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteModal({ show: false, staff: null }); setDeletePassword(''); }} className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleDeleteStaff} disabled={deleteLoading} className="flex-1 p-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Card Modal */}
      {qrModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setQrModal({ show: false, member: null })}
              className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-6 text-center">Staff QR Card</h2>

            <div className="flex justify-center mb-8">
              <div
                ref={cardRef}
                className="w-full rounded-3xl p-6 flex flex-col items-center text-center shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #f1f5f9',
                  backgroundColor: '#ffffff'
                }}
              >
                <div
                  className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-md"
                  style={{ border: '4px solid #e0e7ff' }}
                >
                  <img
                    src={qrModal.member.photo ? (qrModal.member.photo.startsWith("http") ? qrModal.member.photo : qrModal.member.photo) : 'https://via.placeholder.com/150'}
                    crossOrigin={qrModal.member.photo ? "anonymous" : undefined}
                    alt="Staff"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: '#0f172a' }}>{qrModal.member.fullName}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-6" style={{ color: '#4f46e5' }}>{qrModal.member.role || 'GYM STAFF'}</p>

                <div className="p-3 rounded-2xl shadow-inner mb-4" style={{ backgroundColor: '#ffffff', border: '1px solid #f8fafc' }}>
                  <QRCodeCanvas
                    value={qrModal.member.phone}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Scan for Attendance</p>
              </div>
            </div>

            <button
              onClick={downloadQRCard}
              className="w-full flex items-center justify-center space-x-2 p-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
            >
              <Download size={20} />
              <span>Download Image</span>
            </button>
          </div>
        </div>
      )}

      {/* View Details Modal for Staff */}
      {detailsModal.show && detailsModal.staff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><User size={20} /> Staff Profile</h2>
              <button onClick={() => setDetailsModal({ show: false, staff: null })} className="p-1 hover:bg-slate-700 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div className="flex items-center gap-6 mb-6 pb-6 border-b border-slate-100">
                <img
                  src={detailsModal.staff.photo ? (detailsModal.staff.photo.startsWith("http") ? detailsModal.staff.photo : detailsModal.staff.photo) : 'https://via.placeholder.com/100'}
                  crossOrigin={detailsModal.staff.photo ? "anonymous" : undefined}
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-slate-50 shadow-sm"
                  alt="Profile"
                />
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{detailsModal.staff.fullName}</h3>
                  <span className="inline-block px-3 py-1 mt-2 text-xs font-bold uppercase tracking-widest rounded-full bg-indigo-100 text-indigo-700">
                    {detailsModal.staff.role}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</p>
                  <p className="font-bold text-slate-800">{detailsModal.staff.phone}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</p>
                  <p className="font-bold text-slate-800">{detailsModal.staff.gender || 'Male'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p>
                  <p className="font-bold text-slate-800">{detailsModal.staff.whatsapp || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</p>
                  <p className="font-bold text-slate-800 truncate">{detailsModal.staff.email || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Joining Date</p>
                  <p className="font-bold text-slate-800">{detailsModal.staff.joiningDate ? new Date(detailsModal.staff.joiningDate).toLocaleDateString('en-GB') : 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered On</p>
                  <p className="font-bold text-slate-800">{new Date(detailsModal.staff.createdAt).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffList;
