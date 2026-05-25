import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Wallet, History, Users, Settings as SettingsIcon, Clock, Briefcase, Download, Trash2, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import StaffList from './StaffList';
import Settings from './Settings';
import WhatsAppLogin from './WhatsAppLogin';

const PaymentSummary = () => {
    const [paymentStats, setPaymentStats] = useState({ 
        monthly: { admission: 0, renewal: 0, total: 0, monthName: '' }, 
        yearlyTotal: 0 
    });

    useEffect(() => {
        const fetchPaymentStats = async () => {
            try {
                const res = await axios.get('/api/admin/payment-stats');
                setPaymentStats(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchPaymentStats();
    }, []);

    return (
        <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 text-white w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-xl"><Wallet size={24} /></div>
                    <h3 className="text-xl font-black">{paymentStats.monthly.monthName ? paymentStats.monthly.monthName.toUpperCase() : 'MONTHLY'} SUMMARY</h3>
                </div>
                <div className="px-4 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">{paymentStats.monthly.monthName || 'THIS MONTH'}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">New Admission Fee</p>
                    <p className="text-3xl font-black">₹{paymentStats.monthly.admission || 0}</p>
                </div>
                <div>
                    <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Renewal Fee (Internal/Kiosk/Manual)</p>
                    <p className="text-3xl font-black">₹{paymentStats.monthly.renewal || 0}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
                    <p className="text-white text-[10px] font-black uppercase tracking-widest mb-1">Total {paymentStats.monthly.monthName}</p>
                    <p className="text-4xl font-black">₹{paymentStats.monthly.total}</p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-[10px] font-bold text-indigo-200 uppercase">Yearly Total: ₹{paymentStats.yearlyTotal}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PaymentHistory = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const res = await axios.get('/api/admin/payments');
                setPayments(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchPayments();
    }, []);

    if (loading) return <div className="p-8 text-slate-400 font-bold">Loading payments...</div>;

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-5xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-black flex items-center space-x-2 text-slate-800">
                    <History size={20} className="text-indigo-500" />
                    <span>All Payment History</span>
                </h2>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-white sticky top-0 shadow-sm">
                        <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Member</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {payments.length > 0 ? payments.map(p => (
                            <tr key={p._id} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                    {new Date(p.date).toLocaleString('en-GB')}
                                </td>
                                <td className="px-6 py-4 flex items-center space-x-3">
                                    <img 
                                        src={p.memberId?.photo ? p.memberId.photo : 'https://via.placeholder.com/40'} 
                                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                        alt=""
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800">{p.memberId?.fullName || 'Unknown'}</p>
                                        <p className="text-xs text-slate-400">{p.memberId?.phone || 'N/A'}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${p.type === 'Admission' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {p.type}
                                    </span>
                                    {p.packageType && <span className="block text-[10px] text-slate-400 mt-1 font-bold">{p.packageType}</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{p.method}</span>
                                </td>
                                <td className="px-6 py-4 text-right font-black text-emerald-600">
                                    ₹{p.amount}
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 italic">No payments found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const StaffAttendanceHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [ownerPassword, setOwnerPassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get('/api/admin/staff-attendance-history');
                setHistory(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const handleClearHistory = async (e) => {
        e.preventDefault();
        if (!ownerPassword) return alert('Please enter password');
        setDeleteLoading(true);
        try {
            await axios.post('/api/admin/clear-staff-attendance', { password: ownerPassword });
            alert('All Staff attendance history has been deleted successfully!');
            setOwnerPassword('');
            setShowDeleteModal(false);
            
            // Reload history
            const res = await axios.get('/api/admin/staff-attendance-history');
            setHistory(res.data);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete history');
        } finally {
            setDeleteLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-slate-400 font-bold">Loading history...</div>;

    const handleDownloadExcel = () => {
        const data = history.map(record => ({
            'Date': new Date(record.date).toLocaleDateString('en-GB'),
            'Staff Name': record.fullName,
            'Mobile': record.phone,
            'Role': record.role,
            'In Time': record.inTime || '-',
            'Out Time': record.outTime || '-',
            'Day Type': record.dayType ? record.dayType.replace(/_/g, ' ') : '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Attendance");
        XLSX.writeFile(workbook, "Staffs_Attendance_History.xlsx");
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-5xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-black flex items-center space-x-2 text-slate-800">
                    <Clock size={20} className="text-orange-500" />
                    <span>Staff Attendance History</span>
                </h2>
                <div className="flex items-center space-x-3">
                    <button 
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition shadow-lg shadow-rose-200"
                        title="Delete All History"
                    >
                        <Trash2 size={18} />
                        <span className="hidden sm:inline">Delete All</span>
                    </button>
                    <button 
                        onClick={handleDownloadExcel}
                        className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition shadow-lg shadow-emerald-200"
                        title="Download Excel"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-white sticky top-0 shadow-sm">
                        <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Staff Name</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">In Time</th>
                            <th className="px-6 py-4">Out Time</th>
                            <th className="px-6 py-4">Day Type</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {history.length > 0 ? history.map((record, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition">
                                <td className="px-6 py-4 text-sm font-bold text-slate-600">{new Date(record.date).toLocaleDateString('en-GB')}</td>
                                <td className="px-6 py-4 flex items-center space-x-3">
                                    <img 
                                        src={record.photo ? record.photo : 'https://via.placeholder.com/40'} 
                                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                        alt=""
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800">{record.fullName}</p>
                                        <p className="text-xs text-slate-400">{record.phone}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-indigo-600 uppercase tracking-wider">{record.role}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">{record.inTime || '-'}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">{record.outTime || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                                        {record.dayType ? record.dayType.replace(/_/g, ' ') : '-'}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">No attendance records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showDeleteModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full border border-slate-200 shadow-2xl text-center">
                        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-rose-900 mb-2">Delete Staff History</h3>
                        <p className="text-slate-500 mb-6 text-sm font-medium">This will permanently delete all staff attendance history. Enter Owner Control Password to confirm.</p>
                        <form onSubmit={handleClearHistory} className="space-y-4">
                            <input
                                type="password"
                                placeholder="Owner Control Password"
                                value={ownerPassword}
                                onChange={(e) => setOwnerPassword(e.target.value)}
                                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-center font-bold tracking-widest text-lg"
                                required
                            />
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowDeleteModal(false); setOwnerPassword(''); }}
                                    className="flex-1 p-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
                                    disabled={deleteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 p-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition disabled:opacity-50"
                                    disabled={deleteLoading}
                                >
                                    {deleteLoading ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const EditRegister = () => {
    const [formData, setFormData] = useState({
        phone: '', password: '', confirmPassword: '', ownerControlPassword: '', confirmOwnerControlPassword: '', otp: ''
    });
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSendOtp = async () => {
        if (!formData.phone) return alert('Enter phone number');
        try {
            setLoading(true);
            await axios.post('/api/admin/send-otp', { phone: formData.phone });
            setOtpSent(true);
            alert('OTP sent!');
        } catch (err) {
            alert(err.response?.data?.message || 'Error sending OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axios.put('/api/admin/edit-register', formData);
            alert('Details updated successfully!');
            setFormData({ phone: '', password: '', confirmPassword: '', ownerControlPassword: '', confirmOwnerControlPassword: '', otp: '' });
            setOtpSent(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl">
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center space-x-2">
                <Users size={20} className="text-indigo-500" />
                <span>Edit Registration Details</span>
            </h2>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div className="flex space-x-2">
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="New Phone Number" required className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium" />
                    <button type="button" onClick={handleSendOtp} disabled={loading || otpSent} className="px-4 bg-slate-900 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-slate-800">{otpSent ? 'Sent' : 'Send OTP'}</button>
                </div>
                {otpSent && <input type="text" name="otp" value={formData.otp} onChange={handleChange} placeholder="Enter OTP" required className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-bold tracking-widest text-center outline-none focus:border-emerald-500" />}
                
                <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="New Login Password" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium" />
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm Login Password" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium" />
                
                <div className="pt-2 border-t border-slate-100">
                    <input type="password" name="ownerControlPassword" value={formData.ownerControlPassword} onChange={handleChange} placeholder="New Owner Control Password" required className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl outline-none focus:border-rose-500 font-medium mb-4" />
                    <input type="password" name="confirmOwnerControlPassword" value={formData.confirmOwnerControlPassword} onChange={handleChange} placeholder="Confirm Owner Control Password" required className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl outline-none focus:border-rose-500 font-medium" />
                </div>
                
                <button type="submit" disabled={loading || !otpSent} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 mt-4 shadow-lg shadow-indigo-200">Update Details</button>
            </form>
        </div>
    );
};

const OwnerControl = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('summary');

    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await axios.post('/api/admin/verify-owner-password', { ownerControlPassword: password });
            if (res.data.success) {
                setIsAuthenticated(true);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Incorrect Password');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center border border-slate-200">
                    <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Lock size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Owner Control</h2>
                    <p className="text-slate-500 mb-8 text-sm font-medium">Restricted area. Please enter owner password to proceed.</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="Enter Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-center font-bold tracking-widest text-lg"
                        />
                        <button disabled={loading} className="w-full p-4 bg-rose-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-rose-200 hover:bg-rose-700 transition active:scale-95 disabled:opacity-50">
                            {loading ? 'Verifying...' : 'Unlock Controls'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'summary', label: 'Payment Summary', icon: Wallet },
        { id: 'history', label: 'Payment History', icon: History },
        { id: 'staff', label: 'Staff Sections', icon: Briefcase },
        { id: 'staff-attendance', label: 'Staff Attendance', icon: Clock },
        { id: 'edit-register', label: 'Edit Register', icon: Users },
        { id: 'whatsapp', label: 'WhatsApp Login', icon: MessageCircle },
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                    <Lock size={28} className="text-rose-500" />
                    Owner Control
                </h1>
                <p className="text-slate-500 mt-1">Manage finances, staff, and system settings securely.</p>
            </div>

            <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-rose-50 text-rose-700 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="pt-4">
                {activeTab === 'summary' && <PaymentSummary />}
                {activeTab === 'history' && <PaymentHistory />}
                {activeTab === 'staff' && <StaffList />}
                {activeTab === 'staff-attendance' && <StaffAttendanceHistory />}
                {activeTab === 'edit-register' && <EditRegister />}
                {activeTab === 'whatsapp' && <WhatsAppLogin />}
                {activeTab === 'settings' && <Settings />}
            </div>
        </div>
    );
};

export default OwnerControl;
