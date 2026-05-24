import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UserPlus, Upload, CheckCircle, Download, Clock } from 'lucide-react';
import html2canvas from 'html2canvas';

const MemberRegistration = () => {
  const [userType, setUserType] = useState('MEMBER'); // MEMBER | OLD_MEMBER | STAFF
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    whatsapp: '',
    role: '',
    joiningDate: '',
    memberCategory: 'General',
    packageType: '1 Month',
    gender: 'Male'
  });
  const [settings, setSettings] = useState(null);

  React.useEffect(() => {
    axios.get('/api/admin/settings')
      .then(res => setSettings(res.data))
      .catch(err => console.error(err));
  }, []);

  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const cardRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));
    if (photo) data.append('photo', photo);

    try {
      let endpoint;
      if (userType === 'STAFF') {
        endpoint = '/api/staff/register';
      } else if (userType === 'OLD_MEMBER') {
        endpoint = '/api/members/register-old';
      } else {
        // New MEMBER — append fees
        endpoint = '/api/members/register';
        if (settings) {
          let admissionFee = 0;
          let packageFee = 0;
          const catObj = settings.pricing.find(c => c.category === formData.memberCategory);
          if (catObj) {
            admissionFee = catObj.admissionFee;
            const pkgObj = catObj.packages.find(p => p.name === formData.packageType) || catObj.packages[0];
            if (pkgObj) packageFee = pkgObj.price;
          }
          data.append('admissionFeePaid', admissionFee);
          data.append('packageFeePaid', packageFee);
        }
      }

      const response = await axios.post(endpoint, data);
      const successPayload = userType === 'STAFF' ? response.data.staff : response.data.member;

      setSuccessData({
        member: successPayload,
        qrCode: response.data.qrCode,
        isStaff: userType === 'STAFF'
      });
      setFormData({ fullName: '', email: '', phone: '', whatsapp: '', role: '', joiningDate: '', memberCategory: 'General', packageType: '1 Month', gender: 'Male' });
      setPhoto(null);
    } catch (err) {
      alert('Registration failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
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
          link.download = `${successData.member.fullName}_QR_Card.png`;
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

  if (successData) {
    const photoUrl = successData.member.photo
      ? (successData.member.photo.startsWith('http') ? successData.member.photo : successData.member.photo)
      : 'https://via.placeholder.com/150';

    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center">
          <CheckCircle size={60} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
          <p className="text-slate-500 mb-8">Member ID Card has been generated below.</p>

          <div className="flex justify-center mb-8">
            <div
              ref={cardRef}
              className="w-72 rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff'
              }}
            >
              <div
                className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-lg"
                style={{ border: '4px solid #e0e7ff' }}
              >
                <img src={photoUrl} crossOrigin={successData.member.photo ? "anonymous" : undefined} alt="Member" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: '#0f172a' }}>{successData.member.fullName}</h3>
              <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: '#4f46e5' }}>
                {successData.isStaff ? successData.member.role || 'STAFF' : 'GYM MEMBER'}
              </p>

              <div className="p-3 rounded-2xl shadow-inner mb-4" style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9' }}>
                <img src={successData.qrCode} alt="QR Code" className="w-40 h-40" />
              </div>

              <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>Scan for Entry/Exit</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={downloadQRCard}
              className="flex items-center justify-center space-x-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
            >
              <Download size={20} />
              <span>Download QR Card</span>
            </button>
            <button
              onClick={() => setSuccessData(null)}
              className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition"
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-8">
        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
          <UserPlus size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">New Registration</h1>
          <p className="text-slate-500">Enter member details to create a new profile.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Registration Type */}
        <div className="md:col-span-2 space-y-2 mb-2">
          <label className="text-sm font-bold text-slate-700">Registration Type</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'MEMBER', label: '🆕 New Member', desc: 'Pays admission + package fee' },
              { value: 'OLD_MEMBER', label: '🕐 Old Member', desc: 'Already paid, set joining date' },
              { value: 'STAFF', label: '👔 Gym Staff', desc: 'Register staff member' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setUserType(opt.value)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${userType === opt.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
              >
                <p className="font-black text-slate-900 text-sm">{opt.label}</p>
                <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* NEW MEMBER — Category + Package + Fees */}
        {userType === 'MEMBER' && settings && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <div className="space-y-2">
              <label className="text-sm font-bold text-indigo-900">Member Category</label>
              <select
                className="w-full p-4 rounded-xl bg-white border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.memberCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  const catObj = settings.pricing.find(c => c.category === newCat);
                  setFormData({ ...formData, memberCategory: newCat, packageType: catObj?.packages[0]?.name || '' });
                }}
              >
                {settings.pricing.map(cat => (
                  <option key={cat.category} value={cat.category}>{cat.category}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-indigo-900">Package Details</label>
              <select
                className="w-full p-4 rounded-xl bg-white border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.packageType}
                onChange={(e) => setFormData({ ...formData, packageType: e.target.value })}
              >
                {settings.pricing.find(c => c.category === formData.memberCategory)?.packages.map(pkg => (
                  <option key={pkg.name} value={pkg.name}>{pkg.name} (₹{pkg.price})</option>
                ))}
              </select>
            </div>

            {(() => {
              const catObj = settings.pricing.find(c => c.category === formData.memberCategory);
              const admissionFee = catObj?.admissionFee || 0;
              const pkgObj = catObj?.packages.find(p => p.name === formData.packageType) || catObj?.packages[0];
              const packageFee = pkgObj?.price || 0;
              const total = admissionFee + packageFee;
              return (
                <div className="md:col-span-2 flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Admission Fee: ₹{admissionFee}</p>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Package Fee: ₹{packageFee}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-500">Total Payable Now</p>
                    <p className="text-2xl font-black text-indigo-600">₹{total}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* OLD MEMBER — Category + Package (no fees) + Joining Date */}
        {userType === 'OLD_MEMBER' && settings && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50 p-6 rounded-2xl border border-amber-200">
            <div className="md:col-span-2 flex items-center gap-3 p-3 bg-amber-100 rounded-xl border border-amber-200">
              <Clock size={20} className="text-amber-700 shrink-0" />
              <p className="text-sm font-bold text-amber-800">Old member — no fees recorded. Expiry = Joining Date + Package Duration.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-amber-900">Member Category</label>
              <select
                className="w-full p-4 rounded-xl bg-white border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none"
                value={formData.memberCategory}
                onChange={(e) => {
                  const newCat = e.target.value;
                  const catObj = settings.pricing.find(c => c.category === newCat);
                  setFormData({ ...formData, memberCategory: newCat, packageType: catObj?.packages[0]?.name || '' });
                }}
              >
                {settings.pricing.map(cat => (
                  <option key={cat.category} value={cat.category}>{cat.category}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-amber-900">Package Details</label>
              <select
                className="w-full p-4 rounded-xl bg-white border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none"
                value={formData.packageType}
                onChange={(e) => setFormData({ ...formData, packageType: e.target.value })}
              >
                {settings.pricing.find(c => c.category === formData.memberCategory)?.packages.map(pkg => (
                  <option key={pkg.name} value={pkg.name}>{pkg.name} ({pkg.durationDays} days)</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-amber-900">Joining Date <span className="text-amber-600">(when they originally joined)</span></label>
              <input
                required
                type="date"
                className="w-full p-4 rounded-xl bg-white border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none"
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
              />
              {formData.joiningDate && (() => {
                const catObj = settings.pricing.find(c => c.category === formData.memberCategory);
                const pkgObj = catObj?.packages.find(p => p.name === formData.packageType) || catObj?.packages[0];
                const days = pkgObj?.durationDays || 30;
                const joinDate = new Date(formData.joiningDate);
                const expiry = new Date(joinDate);
                expiry.setDate(expiry.getDate() + days);
                const isValid = expiry > new Date();
                return (
                  <div className={`mt-2 p-3 rounded-xl text-sm font-bold ${isValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    Expiry Date: {expiry.toLocaleDateString('en-GB')} — {isValid ? '✅ Valid' : '❌ Already Expired'}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* STAFF extra fields */}
        {userType === 'STAFF' && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Role / Designation</label>
              <input
                required
                type="text"
                className="w-full p-4 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Trainer, Cleaner, Manager..."
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Joining Date</label>
              <input
                required
                type="date"
                className="w-full p-4 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Common Fields */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Full Name</label>
          <input
            required
            type="text"
            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="John Doe"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>

        {/* Gender selection */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Gender</label>
          <select
            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Email Address</label>
          <input
            type="email"
            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Mobile Number (Unique ID)</label>
          <input
            required
            type="text"
            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="+91 00000 00000"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">WhatsApp Number</label>
          <input
            type="text"
            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="+91 00000 00000"
            value={formData.whatsapp}
            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
          />
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="text-sm font-bold text-slate-700">Member Photo</label>
          <div className="relative group cursor-pointer">
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => setPhoto(e.target.files[0])}
            />
            <div className="w-full p-8 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center group-hover:border-indigo-400 transition-colors">
              <Upload className="text-slate-400 mb-2 group-hover:text-indigo-500" size={32} />
              <p className="text-slate-500 font-medium">{photo ? photo.name : 'Choose File or Drag & Drop'}</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 pt-4">
          <button
            disabled={loading}
            className={`w-full p-5 text-white rounded-2xl font-black text-xl shadow-lg transition-all disabled:opacity-50 ${
              userType === 'OLD_MEMBER'
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
            }`}
          >
            {loading ? 'Registering...' : userType === 'OLD_MEMBER' ? 'REGISTER OLD MEMBER' : userType === 'STAFF' ? 'REGISTER STAFF' : 'REGISTER MEMBER'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MemberRegistration;
