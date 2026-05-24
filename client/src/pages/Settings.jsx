import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Save, Plus, Trash2 } from 'lucide-react';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [pricing, setPricing] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/admin/settings');
      setUpiId(res.data.upiId || '');
      setPricing(res.data.pricing || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await axios.put('/api/admin/settings', {
        upiId,
        pricing
      });
      alert('Settings saved successfully!');
      fetchSettings();
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCategory = () => {
    setPricing([...pricing, { category: 'New Category', admissionFee: 0, packages: [] }]);
  };

  const removeCategory = (catIndex) => {
    const updated = [...pricing];
    updated.splice(catIndex, 1);
    setPricing(updated);
  };

  const updateCategory = (catIndex, field, value) => {
    const updated = [...pricing];
    updated[catIndex][field] = value;
    setPricing(updated);
  };

  const addPackage = (catIndex) => {
    const updated = [...pricing];
    updated[catIndex].packages.push({ name: 'New Package', durationDays: 30, price: 0 });
    setPricing(updated);
  };

  const removePackage = (catIndex, pkgIndex) => {
    const updated = [...pricing];
    updated[catIndex].packages.splice(pkgIndex, 1);
    setPricing(updated);
  };

  const updatePackage = (catIndex, pkgIndex, field, value) => {
    const updated = [...pricing];
    if (field === 'durationDays' || field === 'price') value = Number(value);
    updated[catIndex].packages[pkgIndex][field] = value;
    setPricing(updated);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-slate-800 text-white rounded-2xl shadow-lg">
            <SettingsIcon size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">System Settings</h1>
            <p className="text-slate-500">Manage Pricing, Packages, and Payment UPI ID.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={20} /> {loading ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Payment Details</h2>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Gym UPI ID (For Kiosk & QR Payments)</label>
          <input
            type="text"
            className="w-full max-w-md p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            placeholder="your-upi-id@ybl"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 space-y-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-800">Membership Categories & Packages</h2>
          <button 
            onClick={addCategory}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Category
          </button>
        </div>

        <div className="space-y-6">
          {pricing.map((cat, catIndex) => (
            <div key={catIndex} className="p-6 rounded-2xl border-2 border-slate-100 bg-slate-50 relative">
              <button 
                onClick={() => removeCategory(catIndex)}
                className="absolute top-4 right-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete Category"
              >
                <Trash2 size={20} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pr-12">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category Name</label>
                  <input
                    type="text"
                    value={cat.category}
                    onChange={(e) => updateCategory(catIndex, 'category', e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Admission Fee (₹)</label>
                  <input
                    type="number"
                    value={cat.admissionFee}
                    onChange={(e) => updateCategory(catIndex, 'admissionFee', Number(e.target.value))}
                    className="w-full p-3 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-700">Available Packages</h3>
                  <button 
                    onClick={() => addPackage(catIndex)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition flex items-center gap-1 text-xs"
                  >
                    <Plus size={14} /> Add Package
                  </button>
                </div>

                {cat.packages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No packages added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {cat.packages.map((pkg, pkgIndex) => (
                      <div key={pkgIndex} className="flex items-center gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Package Name"
                            value={pkg.name}
                            onChange={(e) => updatePackage(catIndex, pkgIndex, 'name', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            placeholder="Days"
                            title="Duration in Days"
                            value={pkg.durationDays}
                            onChange={(e) => updatePackage(catIndex, pkgIndex, 'durationDays', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            placeholder="Price (₹)"
                            title="Price in Rupees"
                            value={pkg.price}
                            onChange={(e) => updatePackage(catIndex, pkgIndex, 'price', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 outline-none font-bold text-indigo-700"
                          />
                        </div>
                        <button 
                          onClick={() => removePackage(catIndex, pkgIndex)}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
