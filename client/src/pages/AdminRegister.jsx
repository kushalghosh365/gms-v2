import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Mail, Phone, Lock, User, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminRegister = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        ownerControlPassword: '',
        confirmOwnerControlPassword: '',
        otp: ''
    });
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkSetup = async () => {
            try {
                const res = await axios.get('/api/admin/setup-status');
                if (res.data.isSetup) {
                    navigate('/admin-login');
                }
            } catch (err) {
                console.error(err);
            }
        };
        checkSetup();
    }, [navigate]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSendOtp = async () => {
        if (!formData.phone) {
            setError('Please enter your phone number to receive OTP.');
            return;
        }
        try {
            setLoading(true);
            setError('');
            await axios.post('/api/admin/send-otp', { phone: formData.phone });
            setOtpSent(true);
            alert('OTP sent! Check your WhatsApp or server console.');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (formData.ownerControlPassword !== formData.confirmOwnerControlPassword) {
            setError('Owner Control passwords do not match');
            return;
        }
        if (!formData.otp) {
            setError('Please enter the OTP');
            return;
        }

        try {
            setLoading(true);
            setError('');
            await axios.post('/api/admin/register', formData);
            alert('Registration Successful! Please login.');
            navigate('/admin-login');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3 shadow-inner">
                        <ShieldCheck size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">System Initialization</h1>
                    <p className="text-slate-500 mt-2 font-medium">Create the master admin account. This can only be done once.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-start space-x-3">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <span className="font-medium text-sm">{error}</span>
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Column 1 */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="text" name="username" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="admin" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="email" name="email" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="admin@gym.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                                <div className="flex space-x-2">
                                    <div className="relative flex-1">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input type="text" name="phone" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="10-digit number" />
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={handleSendOtp} 
                                        disabled={loading || otpSent}
                                        className="px-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50"
                                    >
                                        {otpSent ? 'Sent' : 'Send OTP'}
                                    </button>
                                </div>
                            </div>
                            {otpSent && (
                                <div>
                                    <label className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Enter OTP</label>
                                    <input type="text" name="otp" required onChange={handleChange} className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-bold tracking-widest text-center" placeholder="------" />
                                </div>
                            )}
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Login Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="password" name="password" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="••••••••" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Login Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input type="password" name="confirmPassword" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="••••••••" />
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-xs font-black text-rose-500 uppercase tracking-wider mb-2">Owner Control Password</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" size={18} />
                                    <input type="password" name="ownerControlPassword" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-rose-50 border border-rose-200 rounded-xl outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium" placeholder="••••••••" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-rose-500 uppercase tracking-wider mb-2">Confirm Owner Control Password</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" size={18} />
                                    <input type="password" name="confirmOwnerControlPassword" required onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-rose-50 border border-rose-200 rounded-xl outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium" placeholder="••••••••" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6">
                        <button 
                            type="submit" 
                            disabled={loading || !otpSent}
                            className="w-full flex items-center justify-center space-x-2 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                        >
                            <span>Complete Registration</span>
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminRegister;
