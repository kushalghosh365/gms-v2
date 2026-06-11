import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Search, Phone, Calendar, CheckCircle, XCircle, LogIn, LogOut, DollarSign, X, Download, Monitor, User, Trash2, Send, Pencil, Save, ChevronDown } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';

const MemberList = () => {
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({});
  const [settings, setSettings] = useState(null);

  const [paymentModal, setPaymentModal] = useState({ show: false, phone: '', name: '', memberCategory: 'General' });
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const [qrModal, setQrModal] = useState({ show: false, member: null });
  const [detailsModal, setDetailsModal] = useState({ show: false, member: null });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const cardRef = useRef(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ show: false, member: null });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);



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

  useEffect(() => {
    fetchMembers();
    axios.get('/api/admin/settings').then(res => setSettings(res.data)).catch(console.error);
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

  const getPackagesForMember = (memberCategory) => {
    if (!settings) return [];
    const cat = settings.pricing?.find(c => c.category === (memberCategory || 'General'));
    return cat ? cat.packages : [];
  };

  const handleManualAttendance = async (phone, action, memberId) => {
    const member = members.find(m => m._id === memberId);
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = member?.attendance?.find(a => a.date === today);

    if (todayRecord && todayRecord.status === action) {
      setStatusMessage(prev => ({ ...prev, [memberId]: `Already ${action}` }));
      setTimeout(() => {
        setStatusMessage(prev => { const { [memberId]: _, ...rest } = prev; return rest; });
      }, 3000);
      return;
    }

    try {
      await axios.post('/api/admin/manual-attendance', { phone, action });
      setStatusMessage(prev => ({ ...prev, [memberId]: `${action} Success!` }));
      setTimeout(() => {
        setStatusMessage(prev => { const { [memberId]: _, ...rest } = prev; return rest; });
      }, 3000);
      fetchMembers();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const submitManualPayment = async () => {
    if (!selectedPlan) { alert('Please select a plan'); return; }
    try {
      await axios.post('/api/admin/manual-payment', {
        phone: paymentModal.phone,
        packageType: selectedPlan.name,
        durationDays: selectedPlan.durationDays,
        amount: paymentAmount
      });
      setPaymentModal({ show: false, phone: '', name: '', memberCategory: 'General' });
      setSelectedPlan(null);
      fetchMembers();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteMember = async () => {
    if (!deletePassword.trim()) { alert('Please enter admin password'); return; }
    setDeleteLoading(true);
    try {
      await axios.delete(`/api/members/${deleteModal.member._id}`, { data: { password: deletePassword } });
      setDeleteModal({ show: false, member: null });
      setDeletePassword('');
      fetchMembers();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleteLoading(false);
    }
  };


  const openDetails = (member) => {
    setDetailsModal({ show: true, member });
    setIsEditMode(false);
    setEditForm({});
  };

  const startEdit = (member) => {
    setIsEditMode(true);
    setEditForm({
      fullName: member.fullName || '',
      gender: member.gender || 'Male',
      phone: member.phone || '',
      whatsapp: member.whatsapp || '',
      memberCategory: member.memberCategory || 'General',
      packageType: member.packageType || '',
      registrationDate: member.registrationDate
        ? new Date(member.registrationDate).toISOString().split('T')[0]
        : new Date(member.createdAt).toISOString().split('T')[0],
    });
  };

  const calcPreviewExpiry = () => {
    if (!settings || !editForm.registrationDate || !editForm.packageType) return null;
    const cat = settings.pricing?.find(c => c.category === (editForm.memberCategory || 'General'));
    if (!cat) return null;
    const pkg = cat.packages?.find(p => p.name === editForm.packageType);
    if (!pkg) return null;
    const base = new Date(editForm.registrationDate);
    base.setDate(base.getDate() + pkg.durationDays);
    return base.toLocaleDateString('en-GB');
  };

  const handleEditMember = async () => {
    setEditLoading(true);
    try {
      const original = detailsModal.member;
      const payload = {};
      if (editForm.fullName !== original.fullName) payload.fullName = editForm.fullName;
      if (editForm.gender !== (original.gender || 'Male')) payload.gender = editForm.gender;
      if (editForm.whatsapp !== (original.whatsapp || '')) payload.whatsapp = editForm.whatsapp;
      if (editForm.memberCategory !== (original.memberCategory || 'General')) payload.memberCategory = editForm.memberCategory;
      if (editForm.packageType !== (original.packageType || '')) payload.packageType = editForm.packageType;
      const origRegDate = original.registrationDate
        ? new Date(original.registrationDate).toISOString().split('T')[0]
        : new Date(original.createdAt).toISOString().split('T')[0];
      if (editForm.registrationDate !== origRegDate) payload.registrationDate = editForm.registrationDate;

      if (Object.keys(payload).length === 0) {
        setIsEditMode(false);
        setEditLoading(false);
        return;
      }

      const res = await axios.put(`/api/members/${original._id}`, payload);
      const updatedMember = res.data.member;
      setDetailsModal({ show: true, member: updatedMember });
      setIsEditMode(false);
      fetchMembers();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setEditLoading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm);
    if (filter === 'All') return matchesSearch;
    return matchesSearch && m.membershipStatus === filter;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Member Directory</h1>
          <p className="text-slate-500">Manage and track all registered gym members.</p>
        </div>
        <div className="flex items-center space-x-2">
          {['All', 'Valid', 'Expired'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

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
        {filteredMembers.map(m => (
          <div key={m._id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
            {/* Status Badge */}
            <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${m.membershipStatus === 'Valid' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {m.membershipStatus}
            </div>

            {/* Delete Button — top left */}
            <button
              onClick={() => { setDeleteModal({ show: true, member: m }); setDeletePassword(''); }}
              className="absolute top-3 left-3 p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition opacity-0 group-hover:opacity-100 z-10"
              title="Delete Member"
            >
              <Trash2 size={13} />
            </button>

            {statusMessage[m._id] && (
              <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center z-10 animate-in fade-in duration-300">
                <div className="bg-white px-4 py-2 rounded-2xl shadow-xl border border-slate-100 animate-in zoom-in slide-in-from-bottom-2 duration-300">
                  <p className="text-sm font-black text-slate-900 flex items-center space-x-2">
                    {statusMessage[m._id].includes('Already') ? (
                      <XCircle size={16} className="text-orange-500" />
                    ) : (
                      <CheckCircle size={16} className="text-emerald-500" />
                    )}
                    <span>{statusMessage[m._id]}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-4 mb-6 mt-2">
              <img
                src={m.photo ? (m.photo.startsWith('http') ? m.photo : m.photo) : 'https://via.placeholder.com/60'}
                crossOrigin={m.photo ? "anonymous" : undefined}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 group-hover:scale-105 transition-transform"
                alt={m.fullName}
              />
              <div>
                <h3 className="font-black text-xl text-slate-900 leading-tight flex items-center flex-wrap gap-2">
                  {m.fullName}
                  <button
                    onClick={() => openDetails(m)}
                    className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition flex items-center gap-1 uppercase tracking-wider font-bold"
                  >
                    <User size={10} /> Details
                  </button>
                </h3>
                <p className="text-slate-400 text-sm flex items-center space-x-1 mt-1">
                  <Phone size={12} />
                  <span>{m.phone}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold flex items-center space-x-2">
                  <Calendar size={16} />
                  <span>Expiry Date</span>
                </span>
                <span className="font-black text-slate-800">
                  {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString('en-GB') : 'N/A'}
                </span>
              </div>
            </div>

            {/* Admin Controls */}
            <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-4 gap-1.5">
              <button
                onClick={() => handleManualAttendance(m.phone, 'IN', m._id)}
                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 active:scale-95 flex flex-col items-center justify-center transition-all"
              >
                <LogIn size={15} />
                <span className="text-[9px] font-bold mt-1">IN</span>
              </button>
              <button
                onClick={() => handleManualAttendance(m.phone, 'OUT', m._id)}
                className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 active:scale-95 flex flex-col items-center justify-center transition-all"
              >
                <LogOut size={15} />
                <span className="text-[9px] font-bold mt-1">OUT</span>
              </button>
              <button
                onClick={() => {
                  const pkgs = getPackagesForMember(m.memberCategory);
                  const firstPlan = pkgs.length > 0 ? pkgs[0] : null;
                  setPaymentModal({ show: true, phone: m.phone, name: m.fullName, memberCategory: m.memberCategory || 'General' });
                  setSelectedPlan(firstPlan);
                  setPaymentAmount(firstPlan ? firstPlan.price : 0);
                }}
                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 active:scale-95 flex flex-col items-center justify-center transition-all"
              >
                <DollarSign size={15} />
                <span className="text-[9px] font-bold mt-1">PAID</span>
              </button>
              <button
                onClick={() => setQrModal({ show: true, member: m })}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 active:scale-95 flex flex-col items-center justify-center transition-all"
              >
                <Monitor size={15} />
                <span className="text-[9px] font-bold mt-1">QR</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* QR Card Modal */}
      {qrModal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setQrModal({ show: false, member: null })} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-6 text-center">Member QR Card</h2>
            <div className="flex justify-center mb-8">
              <div ref={cardRef} className="w-full rounded-3xl p-6 flex flex-col items-center text-center shadow-lg" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                <div className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-md" style={{ border: '4px solid #e0e7ff' }}>
                  <img
                    src={qrModal.member.photo ? (qrModal.member.photo.startsWith('http') ? qrModal.member.photo : qrModal.member.photo) : 'https://via.placeholder.com/150'}
                    crossOrigin={qrModal.member.photo ? "anonymous" : undefined}
                    alt="Member"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: '#0f172a' }}>{qrModal.member.fullName}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-6" style={{ color: '#4f46e5' }}>GYM MEMBER</p>
                <div className="p-3 rounded-2xl shadow-inner mb-4" style={{ backgroundColor: '#ffffff', border: '1px solid #f8fafc' }}>
                  <QRCodeCanvas value={qrModal.member.phone} size={160} level="H" includeMargin={false} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Scan for Attendance</p>
              </div>
            </div>
            <button onClick={downloadQRCard} className="w-full flex items-center justify-center space-x-2 p-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
              <Download size={20} />
              <span>Download Image</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {paymentModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-xl font-bold">Manual Payment</h2>
                <p className="text-sm text-indigo-600 font-semibold">{paymentModal.name} · <span className="text-slate-500">{paymentModal.memberCategory}</span></p>
              </div>
              <button onClick={() => { setPaymentModal({ show: false, phone: '', name: '', memberCategory: 'General' }); setSelectedPlan(null); }}><X size={22} /></button>
            </div>

            {/* Plan Packages from Settings */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Select Plan:</p>
              {getPackagesForMember(paymentModal.memberCategory).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {getPackagesForMember(paymentModal.memberCategory).map(pkg => (
                    <button
                      key={pkg.name}
                      onClick={() => { setSelectedPlan(pkg); setPaymentAmount(pkg.price); }}
                      className={`p-3 rounded-xl border-2 font-bold text-sm transition-all text-left ${selectedPlan?.name === pkg.name
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-100 hover:border-indigo-200 text-slate-700'
                        }`}
                    >
                      <div className="font-black">{pkg.name}</div>
                      <div className="text-xs text-slate-400 font-semibold">₹{pkg.price}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No packages found for this category. Loading settings...</p>
              )}
            </div>

            {/* Amount — editable but pre-filled from plan */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Amount (₹):</p>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full p-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-lg"
              />
            </div>

            <button
              onClick={submitManualPayment}
              disabled={!selectedPlan}
              className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-black text-base shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CONFIRM PAYMENT
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModal.show && detailsModal.member && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300 max-h-[90vh]">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <User size={20} />
                {isEditMode ? 'Edit Member' : 'Member Profile'}
              </h2>
              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <button
                    onClick={() => startEdit(detailsModal.member)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                )}
                <button onClick={() => { setDetailsModal({ show: false, member: null }); setIsEditMode(false); }} className="p-1 hover:bg-slate-700 rounded-full transition">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Photo + Status */}
              <div className="flex items-center gap-5 mb-6 pb-6 border-b border-slate-100">
                <img
                  src={detailsModal.member.photo || 'https://via.placeholder.com/100'}
                  crossOrigin={detailsModal.member.photo ? "anonymous" : undefined}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-slate-50 shadow-sm"
                  alt="Profile"
                />
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {isEditMode ? editForm.fullName : detailsModal.member.fullName}
                  </h3>
                  <span className={`inline-block px-3 py-1 mt-1 text-xs font-bold uppercase tracking-widest rounded-full ${detailsModal.member.membershipStatus === 'Valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {detailsModal.member.membershipStatus}
                  </span>
                </div>
              </div>

              {!isEditMode ? (
                /* ─── VIEW MODE ─── */
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Phone Number', value: detailsModal.member.phone },
                    { label: 'Gender', value: detailsModal.member.gender || 'Male' },
                    { label: 'WhatsApp', value: detailsModal.member.whatsapp || 'N/A' },
                    { label: 'Email Address', value: detailsModal.member.email || 'N/A' },
                    { label: 'Category', value: detailsModal.member.memberCategory || 'General' },
                    { label: 'Package Type', value: detailsModal.member.packageType || 'N/A' },
                    { label: 'Expiry Date', value: detailsModal.member.expiryDate ? new Date(detailsModal.member.expiryDate).toLocaleDateString('en-GB') : 'N/A' },
                    { label: 'Registered On', value: detailsModal.member.registrationDate ? new Date(detailsModal.member.registrationDate).toLocaleDateString('en-GB') : new Date(detailsModal.member.createdAt).toLocaleDateString('en-GB') },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                      <p className="font-bold text-slate-800 truncate text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                /* ─── EDIT MODE ─── */
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))}
                      className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Gender</label>
                    <div className="relative">
                      <select
                        value={editForm.gender}
                        onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}
                        className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800 appearance-none bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Phone (read-only) */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Phone Number <span className="text-slate-300">(cannot change)</span></label>
                    <input
                      type="text"
                      value={editForm.phone}
                      disabled
                      className="w-full p-3 rounded-xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">WhatsApp Number</label>
                    <input
                      type="text"
                      value={editForm.whatsapp}
                      onChange={e => setEditForm(p => ({ ...p, whatsapp: e.target.value }))}
                      className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Category</label>
                    <div className="relative">
                      <select
                        value={editForm.memberCategory}
                        onChange={e => setEditForm(p => ({ ...p, memberCategory: e.target.value, packageType: '' }))}
                        className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800 appearance-none bg-white"
                      >
                        {(settings?.pricing || []).map(c => (
                          <option key={c.category} value={c.category}>{c.category}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Package Type */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Package Type</label>
                    <div className="relative">
                      <select
                        value={editForm.packageType}
                        onChange={e => setEditForm(p => ({ ...p, packageType: e.target.value }))}
                        className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800 appearance-none bg-white"
                      >
                        {getPackagesForMember(editForm.memberCategory).map(pkg => (
                          <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Registered On */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Registered On</label>
                    <input
                      type="date"
                      value={editForm.registrationDate}
                      onChange={e => setEditForm(p => ({ ...p, registrationDate: e.target.value }))}
                      className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800"
                    />
                  </div>

                  {/* Expiry Preview (auto) */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Expiry Date (Auto-Calculated)</p>
                    <p className="font-black text-amber-800 text-sm mt-0.5">
                      {calcPreviewExpiry() || '— Select package & date —'}
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsEditMode(false)}
                      className="flex-1 p-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditMember}
                      disabled={editLoading}
                      className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Save size={16} />
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && deleteModal.member && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-2xl"><Trash2 size={24} className="text-red-600" /></div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Delete Member</h2>
                <p className="text-sm text-slate-500">This will hide the registration only</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <p className="text-sm font-bold text-red-800">⚠️ <span className="font-black">{deleteModal.member.fullName}</span> will be removed from the system.</p>
              <p className="text-xs text-red-600 mt-1">Payment history & attendance records will be preserved.</p>
            </div>
            <div className="space-y-2 mb-6">
              <label className="text-sm font-bold text-slate-700">Enter Admin Password to confirm</label>
              <input
                type="password"
                placeholder="Admin Password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-red-400 outline-none font-bold"
                onKeyDown={(e) => e.key === 'Enter' && handleDeleteMember()}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteModal({ show: false, member: null }); setDeletePassword(''); }} className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleDeleteMember} disabled={deleteLoading} className="flex-1 p-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberList;
