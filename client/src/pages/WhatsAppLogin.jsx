import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageCircle, QrCode, LogOut, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const WhatsAppLogin = () => {
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [waQR, setWaQR] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const checkWaStatus = async () => {
    try {
      const res = await axios.get('/api/admin/whatsapp/status');
      setWaStatus(res.data.status);
      setWaQR(res.data.qr);
    } catch (err) {
      console.error('Failed to get WA status', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll status every 4 seconds to get real-time connection state & QR updates
  useEffect(() => {
    checkWaStatus();
    const interval = setInterval(checkWaStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp? This will log you out of all sessions and clear cache.')) return;
    setIsLoggingOut(true);
    setMessage('');
    try {
      const res = await axios.post('/api/admin/whatsapp/logout');
      setWaStatus('DISCONNECTED');
      setWaQR(null);
      setMessage(res.data.message);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to disconnect WhatsApp. Please try again.');
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-3xl w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl text-white shadow-lg transition-all duration-300 ${
            waStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-emerald-100' : 'bg-slate-800 shadow-slate-200'
          }`}>
            {waStatus === 'CONNECTED' ? <MessageCircle size={28} /> : <QrCode size={28} />}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">WhatsApp Gateway</h2>
            <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5 mt-1">
              Connection Status: 
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                waStatus === 'CONNECTED' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : waStatus === 'QR_READY' 
                    ? 'bg-amber-100 text-amber-700 animate-pulse' 
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {waStatus === 'QR_READY' ? 'Ready to Scan' : waStatus}
              </span>
            </p>
          </div>
        </div>

        {waStatus === 'CONNECTED' && (
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-100 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            <LogOut size={18} />
            <span>{isLoggingOut ? 'Disconnecting...' : 'Disconnect'}</span>
          </button>
        )}
      </div>

      {/* Body Content */}
      <div className="py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw size={36} className="text-indigo-600 animate-spin mb-4" />
            <p className="font-bold text-slate-500">Checking WhatsApp connection status...</p>
          </div>
        )}

        {!loading && waStatus === 'CONNECTED' && (
          <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-emerald-50/50 border border-emerald-200/60 rounded-3xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner flex-shrink-0">
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-emerald-800">WhatsApp is Connected ✅</h3>
              <p className="text-slate-600 font-medium mt-1 leading-relaxed">
                Your system is successfully paired with WhatsApp. Automated messages, membership renewal reminders, and Member/Staff QR codes can now be sent seamlessly.
              </p>
            </div>
          </div>
        )}

        {!loading && waStatus === 'QR_READY' && waQR && (
          <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <div className="p-4 bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200/80 flex-shrink-0 animate-in zoom-in duration-300">
              <img src={waQR} alt="WhatsApp QR Code" className="w-48 h-48 block" />
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-800">Link Your WhatsApp Account</h3>
              <ol className="list-decimal list-inside text-sm text-slate-600 font-medium space-y-2.5 leading-relaxed">
                <li>Open <span className="font-bold text-slate-800">WhatsApp</span> on your mobile device.</li>
                <li>Tap <span className="font-bold text-slate-800">Menu</span> or <span className="font-bold text-slate-800">Settings</span> (the gear icon).</li>
                <li>Select <span className="font-bold text-slate-800">Linked Devices</span>.</li>
                <li>Tap <span className="font-bold text-slate-800">Link a Device</span> and point your camera to this QR code.</li>
              </ol>
              <div className="pt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
                <RefreshCw size={12} className="animate-spin" />
                <span>The QR code refreshes automatically to keep the connection secure.</span>
              </div>
            </div>
          </div>
        )}

        {!loading && waStatus === 'DISCONNECTED' && (
          <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50 border border-slate-200 rounded-3xl">
            <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center shadow-inner flex-shrink-0">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-700">Waiting for Gateway</h3>
              <p className="text-slate-500 text-sm font-medium mt-1 leading-relaxed">
                The WhatsApp service is initializing. Please wait a few moments for the QR code to generate.
              </p>
            </div>
          </div>
        )}

        {message && (
          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded-2xl text-sm flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
            <CheckCircle size={16} className="text-indigo-500" />
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppLogin;
