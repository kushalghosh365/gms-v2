import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Calendar, Search, RefreshCcw, Download, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const AttendanceHistory = () => {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/attendance-history');
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async (e) => {
    e.preventDefault();
    if (!adminPassword) return alert('Please enter password');
    setDeleteLoading(true);
    try {
      await axios.post('/api/admin/clear-member-attendance', { password: adminPassword });
      alert('All Member attendance history has been deleted successfully!');
      setAdminPassword('');
      setShowDeleteModal(false);
      fetchHistory();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete history');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredHistory = (history || []).filter(log => 
    log.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || log.phone?.includes(searchTerm)
  );

  const handleDownloadExcel = () => {
    const data = filteredHistory.map(log => ({
      'Date': log.date ? new Date(log.date).toLocaleDateString('en-GB') : 'N/A',
      'Member Name': log.fullName,
      'Mobile': log.phone,
      'IN Time': log.inTime || '--:--',
      'OUT Time': log.outTime || '--:--',
      'Status': log.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, "Members_Attendance_History.xlsx");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Attendance History</h1>
          <p className="text-slate-500">View complete logs of member entries and exits.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchHistory}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search Member..."
              className="pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Member</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4">IN Time</th>
                <th className="px-6 py-4">OUT Time</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400">Loading history...</td></tr>
              ) : filteredHistory.length > 0 ? filteredHistory.map((log, index) => (
                <tr key={index} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-600">
                    {log.date ? new Date(log.date).toLocaleDateString('en-GB') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 flex items-center space-x-3">
                    <img 
                      src={log.photo ? log.photo : 'https://via.placeholder.com/35'} 
                      className="w-8 h-8 rounded-full object-cover"
                      alt=""
                    />
                    <span className="font-bold text-slate-800">{log.fullName}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{log.phone}</td>
                  <td className="px-6 py-4 text-emerald-600 font-bold">{log.inTime || '--:--'}</td>
                  <td className="px-6 py-4 text-orange-600 font-bold">{log.outTime || '--:--'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                      log.status === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">No attendance records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full border border-slate-200 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Attendance</h3>
            <p className="text-slate-500 mb-6 text-sm font-medium">This will permanently delete all member attendance history. Enter Admin Password to confirm.</p>
            <form onSubmit={handleClearHistory} className="space-y-4">
              <input
                type="password"
                placeholder="Admin Password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-rose-500 outline-none text-center font-bold tracking-widest text-lg"
                required
              />
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setAdminPassword(''); }}
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

export default AttendanceHistory;
