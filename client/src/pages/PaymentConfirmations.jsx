import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle2, XCircle, Search, Clock } from 'lucide-react';

const PaymentConfirmations = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/admin/payment-requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    if (!window.confirm("Are you sure you want to confirm this payment? The expiry date will be updated from today.")) return;
    try {
      await axios.post(`/api/admin/payment-requests/${id}/confirm`);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Error confirming');
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Are you sure you want to reject this payment request?")) return;
    try {
      await axios.post(`/api/admin/payment-requests/${id}/reject`);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting');
    }
  };

  if (loading) return <div className="p-8 font-bold text-slate-400">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Payment Confirmations</h1>
          <p className="text-slate-500 font-medium mt-1">Verify member transaction IDs to activate their membership</p>
        </div>
        <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center">
            <Clock className="text-indigo-500 mr-2" size={18} />
            <span className="font-bold text-indigo-700">{requests.length} Pending</span>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white p-12 rounded-[32px] text-center border-2 border-slate-100 shadow-sm">
            <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">No Pending Requests</h3>
            <p className="text-slate-500">All member payment requests have been resolved.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((req) => (
            <div key={req._id} className="bg-white rounded-[32px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                        Pending
                    </span>
                </div>
                
                <div className="flex items-center space-x-4 mb-6 mt-2">
                    <div className="w-16 h-16 rounded-[20px] bg-slate-100 overflow-hidden shrink-0">
                        <img 
                          src={req.memberId?.photo ? `/${req.memberId.photo}` : 'https://via.placeholder.com/150'} 
                          alt="Member" 
                          className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900">{req.memberId?.fullName}</h3>
                        <p className="text-sm font-bold text-slate-400">{req.memberId?.phone}</p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3 flex-1 border border-slate-100">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Plan</span>
                        <span className="font-black text-slate-700">{req.months} Month{req.months > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Amount Paid</span>
                        <span className="font-black text-emerald-600">₹{req.amount}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                        <span className="text-[10px] font-black text-indigo-400 uppercase block mb-1">Transaction ID</span>
                        <span className="font-mono text-sm font-bold text-slate-800 break-all bg-indigo-50 px-2 py-1 rounded-md block">
                            {req.transactionId}
                        </span>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button 
                      onClick={() => handleConfirm(req._id)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-2xl transition flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-95"
                    >
                      <CheckCircle2 size={18} className="mr-2" /> Confirm
                    </button>
                    <button 
                      onClick={() => handleReject(req._id)}
                      className="flex-1 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-bold py-3 rounded-2xl transition flex items-center justify-center active:scale-95"
                    >
                      <XCircle size={18} className="mr-2" /> Cancel
                    </button>
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentConfirmations;
