import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminLogin = ({ onLogin }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkSetup = async () => {
            try {
                const res = await axios.get('/api/admin/setup-status');
                if (!res.data.isSetup) {
                    navigate('/admin-register');
                }
            } catch (err) {
                console.error(err);
            }
        };
        checkSetup();
    }, [navigate]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError('');
            const res = await axios.post('/api/admin/login', formData);
            sessionStorage.setItem('adminToken', res.data.admin.id);
            sessionStorage.setItem('adminUsername', res.data.admin.username);
            onLogin();
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <ShieldAlert size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">Admin Login</h1>
                    <p className="text-slate-500 mt-2 font-medium">Enter your credentials to access the dashboard.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-center font-medium text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="text" 
                                name="username" 
                                required 
                                onChange={handleChange} 
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium text-lg transition" 
                                placeholder="Enter username" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="password" 
                                name="password" 
                                required 
                                onChange={handleChange} 
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium text-lg transition" 
                                placeholder="••••••••" 
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full flex items-center justify-center space-x-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
                        >
                            <span>Sign In</span>
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
