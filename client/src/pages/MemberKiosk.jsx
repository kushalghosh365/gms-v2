import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LogIn, LogOut, CreditCard, Scan, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';

const MemberKiosk = () => {
  const [step, setStep] = useState('idle'); // idle, scanning, processing, profile, success, error
  const [member, setMember] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState('qr'); // 'qr' or 'transactionInput'
  const [transactionId, setTransactionId] = useState('');
  const [settings, setSettings] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  useEffect(() => {
    axios.get('/api/admin/settings')
      .then(res => setSettings(res.data))
      .catch(console.error);
  }, []);
  
  const UPI_ID = "kushalghosh7363071664@okaxis";
  const PAYEE_NAME = "Gpay";

  // Initialize Scanner
  useEffect(() => {
    let scanner = null;
    if (step === 'scanning') {
      scanner = new Html5QrcodeScanner("reader", { 
        fps: 60, 
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.0,
        disableFlip: false,
        rememberLastUsedCamera: true
      });

      scanner.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      }
    };
  }, [step]);

  async function onScanSuccess(decodedText) {
    if (step !== 'scanning') return; // Prevent multiple rapid fires
    setStep('processing'); // Immediately stop scanner to free resources
    try {
      setLoading(true);
      const res = await axios.get(`/api/kiosk/profile/${decodedText}`);
      
      const beep = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
      beep.play().catch(e => console.log('Audio play failed:', e));

      const fetchedMember = res.data;
      setMember(fetchedMember);
      setStep('profile');

      if (fetchedMember.userType !== 'STAFF' && fetchedMember.expiryDate) {
        const today = new Date();
        const expDate = new Date(fetchedMember.expiryDate);
        // Calculate diff in time then in days
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0 && diffDays <= 5) {
          setIsSpeaking(true);
          const msg = new SpeechSynthesisUtterance(`Your plan expires within ${diffDays} days, so please purchase your plan.`);
          
          // Set to a female voice
          const voices = window.speechSynthesis.getVoices();
          const femaleVoice = voices.find(v => 
            v.name.includes('Female') || 
            v.name.includes('Zira') || 
            v.name.includes('Samantha') || 
            v.name.includes('Victoria') ||
            v.name.includes('Google UK English Female')
          );
          if (femaleVoice) {
            msg.voice = femaleVoice;
          }

          msg.onend = () => {
            setIsSpeaking(false);
          };
          msg.onerror = () => {
            setIsSpeaking(false);
          };
          window.speechSynthesis.speak(msg);
        }
      }

    } catch (err) {
      const buzzer = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
      buzzer.play().catch(e => console.log('Audio play failed:', e));

      setMessage(err.response?.data?.message || 'Member not found');
      setStep('error');
      setTimeout(() => setStep('idle'), 3000);
    } finally {
      setLoading(false);
    }
  }

  function onScanFailure(error) {
    // Handle scan failure, usually silent
  }

  const [localError, setLocalError] = useState('');

  const playTickSound = (action) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (action === 'IN') {
        // Professional IN: Double quick high-pitch beep (similar to biometric machine)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        
        // Beep 1
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
        
        // Beep 2
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.22);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      } else {
        // Professional OUT: Single smooth lower-pitch chime
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.35);
      }
    } catch(e) {
      console.log('Audio API error:', e);
    }
  };

  const handleAction = async (action) => {
    try {
      playTickSound(action);

      setLocalError('');
      setLoading(true);
      const res = await axios.post('/api/kiosk/attendance', { 
        phone: member.phone, 
        action 
      });
      
      const successBeep = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
      successBeep.play().catch(e => console.log('Audio play failed:', e));

      setMessage(res.data.message);
      setStep('success');
      
      setTimeout(() => {
        setStep('idle');
        setMember(null);
        setMessage('');
      }, 3000);

    } catch (err) {
      const buzzer = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');
      buzzer.play().catch(e => console.log('Audio play failed:', e));

      const errMsg = err.response?.data?.message || 'Something went wrong';
      setLocalError(errMsg);
      setTimeout(() => setLocalError(''), 4000); 
    } finally {
      setLoading(false);
    }
  };

  const submitPaymentRequest = async () => {
    if (!transactionId.trim()) {
      alert("Please enter your Transaction ID");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post('/api/kiosk/payment-request', { 
        phone: member.phone, 
        packageType: selectedPlan.name,
        durationDays: selectedPlan.durationDays,
        amount: selectedPlan.price,
        transactionId 
      });
      setMessage("Our team will verify your transaction, then your subscription will start.");
      setShowPaymentModal(false);
      setPaymentStep('qr');
      setTransactionId('');
      setStep('success');
      
      setTimeout(() => {
        setStep('idle');
        setMember(null);
      }, 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-white overflow-hidden">
      
      {/* 1. IDLE STATE */}
      {step === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 animate-in fade-in zoom-in duration-500 w-full">
          <div className="text-center space-y-3 flex flex-col items-center -mt-16">
            <img src="/logo.png" alt="Fitness Fanatic Logo" className="h-48 w-auto object-contain mb-6 drop-shadow-md" />
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
              Fitness Fanatic
            </h1>
            <p className="text-slate-400 text-lg font-medium">Scan your QR to begin</p>
          </div>
          
          <button 
            onClick={() => setStep('scanning')}
            className="group relative flex flex-col items-center justify-center w-72 h-72 bg-white rounded-[60px] shadow-2xl shadow-indigo-100 border-2 border-slate-50 hover:border-indigo-500 transition-all duration-150 overflow-hidden"
          >
            <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="p-8 bg-indigo-600 text-white rounded-[40px] shadow-2xl shadow-indigo-200 group-hover:scale-105 transition-transform duration-150 mb-6">
                <Scan size={64} />
              </div>
              <span className="text-lg font-black text-slate-800 uppercase tracking-[0.2em]">Touch to Scan</span>
            </div>
          </button>
        </div>
      )}

      {/* 2. SCANNING STATE */}
      {step === 'scanning' && (
        <div className="flex-1 w-full flex flex-col animate-in zoom-in fade-in duration-300">
          <div className="p-8 flex justify-between items-center border-b border-slate-50">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Scanner</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Awaiting code...</p>
            </div>
            <button onClick={() => setStep('idle')} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-3xl transition duration-150">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
             <div id="reader" className="w-full max-w-sm overflow-hidden rounded-[50px] border-[12px] border-slate-50 shadow-2xl" />
             <p className="mt-8 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Align QR within the frame</p>
          </div>
        </div>
      )}

      {/* 2.5 PROCESSING STATE */}
      {step === 'processing' && (
        <div className="flex-1 w-full flex flex-col items-center justify-center animate-in zoom-in duration-300">
           <div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Processing QR...</h2>
           <p className="text-slate-400 font-medium mt-2">Please wait a moment</p>
        </div>
      )}

      {/* 3. PROFILE STATE */}
      {step === 'profile' && member && (
        <div className="flex-1 w-full flex flex-col p-6 animate-in slide-in-from-bottom duration-500">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative mb-8">
              <div className="w-44 h-44 rounded-[50px] border-[8px] border-slate-50 overflow-hidden shadow-2xl">
                <img 
                  src={member.photo ? (member.photo.startsWith("http") ? member.photo : `/${member.photo}`) : 'https://via.placeholder.com/150'} 
                  alt="Member" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-4 rounded-3xl border-4 border-white shadow-xl">
                 <CheckCircle2 size={24} />
              </div>
            </div>

            <div className="text-center space-y-2 mb-10">
              <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] inline-block">
                {member.userType === 'STAFF' ? (member.role || 'STAFF') : `${member.membershipStatus} Membership`}
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">{member.fullName}</h2>
              {member.userType !== 'STAFF' && (
                <div className="flex flex-col items-center">
                  <p className={`text-sm font-bold ${
                    member.expiryDate && (Math.ceil((new Date(member.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 5)
                      ? 'text-red-500 animate-pulse text-lg'
                      : 'text-slate-400'
                  }`}>
                    Expiry Date: {member.expiryDate ? new Date(member.expiryDate).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                  {member.paymentNotification === 'Confirmed' && (
                    <p className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl mt-3 animate-in fade-in slide-in-from-top-2 duration-500 shadow-sm border border-emerald-100">
                      Your payment is confirmed and your expiry date is increased as per your payment.
                    </p>
                  )}
                  {member.paymentNotification === 'Rejected' && (
                    <p className="text-[11px] font-black text-rose-600 bg-rose-50 px-4 py-2 rounded-xl mt-3 animate-in fade-in slide-in-from-top-2 duration-500 shadow-sm border border-rose-100">
                      Your payment request was cancelled. Please contact staff.
                    </p>
                  )}
                </div>
              )}
              {localError && (
                <p className="text-sm font-black text-red-500 animate-bounce mt-4 uppercase tracking-wide">
                  {localError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 w-full max-w-md mx-auto">
              <button 
                onClick={() => handleAction('IN')}
                disabled={loading || isSpeaking}
                className={`group flex flex-col items-center justify-center p-5 bg-emerald-50 text-emerald-600 rounded-[32px] hover:bg-emerald-600 hover:text-white transition-all duration-150 shadow-sm border-2 border-emerald-100 active:scale-95 ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <LogIn size={28} className="mb-2" />
                <span className="text-[10px] font-black uppercase">IN</span>
              </button>

              <button 
                onClick={() => handleAction('OUT')}
                disabled={loading || isSpeaking}
                className={`group flex flex-col items-center justify-center p-5 bg-amber-50 text-amber-600 rounded-[32px] hover:bg-amber-500 hover:text-white transition-all duration-150 shadow-sm border-2 border-amber-100 active:scale-95 ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <LogOut size={28} className="mb-2" />
                <span className="text-[10px] font-black uppercase">OUT</span>
              </button>

              {member.userType !== 'STAFF' && settings && (
                <button 
                  onClick={() => {
                    const cat = settings.pricing.find(c => c.category === member.memberCategory);
                    if (cat && cat.packages.length > 0) setSelectedPlan(cat.packages[0]);
                    setShowPaymentModal(true);
                  }}
                  disabled={loading || isSpeaking}
                  className={`group flex flex-col items-center justify-center p-5 bg-indigo-50 text-indigo-600 rounded-[32px] hover:bg-indigo-600 hover:text-white transition-all duration-150 shadow-sm border-2 border-indigo-100 active:scale-95 ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <CreditCard size={28} className="mb-2" />
                  <span className="text-[10px] font-black uppercase">Pay</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="py-8 text-center">
            <button 
              onClick={() => setStep('idle')}
              className="px-8 py-3 bg-slate-50 text-slate-400 font-black hover:text-red-500 rounded-2xl transition-all duration-150 uppercase tracking-widest text-[10px]"
            >
              End Session
            </button>
          </div>
        </div>
      )}

      {/* 4. SUCCESS STATE */}
      {step === 'success' && (
        <div className="text-center animate-in zoom-in duration-500">
          <div className="w-48 h-48 bg-emerald-100 text-emerald-600 rounded-[50px] flex items-center justify-center mx-auto mb-8 border-[10px] border-emerald-50 shadow-2xl shadow-emerald-100">
             <CheckCircle2 size={100} />
          </div>
          <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Success!</h2>
          <p className="text-2xl text-slate-500 font-medium max-w-xs mx-auto">{message}</p>
        </div>
      )}

      {/* 5. ERROR STATE */}
      {step === 'error' && (
        <div className="text-center animate-in shake duration-500">
           <div className="w-48 h-48 bg-rose-100 text-rose-600 rounded-[50px] flex items-center justify-center mx-auto mb-8 border-[10px] border-rose-50 shadow-2xl shadow-rose-100">
             <AlertCircle size={100} />
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Attention</h2>
          <p className="text-xl text-rose-500 font-bold max-w-xs mx-auto">{message}</p>
        </div>
      )}

      {/* Payment Modal for Kiosk */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl my-auto animate-in zoom-in duration-300">
              <div className="text-center mb-8">
                <h2 className="text-xl font-black text-slate-800">Renew Membership</h2>
                <p className="text-indigo-600 font-bold">for {member.fullName}</p>
              </div>

              {paymentStep === 'qr' && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {(() => {
                      const cat = settings?.pricing?.find(c => c.category === member.memberCategory);
                      if (!cat) return null;
                      return cat.packages.map(pkg => (
                        <button 
                          key={pkg.name}
                          onClick={() => setSelectedPlan(pkg)}
                          className={`relative p-3 rounded-[20px] border-[3px] transition-all duration-200 flex flex-col items-center justify-center ${
                            selectedPlan?.name === pkg.name 
                              ? 'border-indigo-600 bg-white shadow-lg' 
                              : 'border-slate-100 bg-white hover:border-slate-200'
                          }`}
                        >
                          <span className="text-xl font-black text-slate-800 leading-none">{pkg.name}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            ₹{pkg.price}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[32px] mb-8 flex flex-col items-center border border-slate-100">
                    <div className="bg-white p-4 rounded-[24px] shadow-2xl shadow-slate-200 mb-6">
                        <QRCodeCanvas
                          value={`upi://pay?pa=${settings?.upiId || UPI_ID}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${selectedPlan?.price}&cu=INR`}
                          size={160}
                          level="H"
                          includeMargin={false}
                        />
                    </div>
                    
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Amount</p>
                      <div className="flex items-center justify-center leading-none">
                        <span className="text-2xl font-black text-slate-600 self-start mt-1 mr-1">₹</span>
                        <span className="text-5xl font-black text-slate-900 tracking-tighter">{selectedPlan?.price}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                     <button 
                      onClick={() => setPaymentStep('transactionInput')} 
                      className="w-full p-5 rounded-2xl bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition active:scale-95"
                    >
                      I HAVE PAID
                    </button>
                    <button 
                      onClick={() => { setShowPaymentModal(false); setPaymentStep('qr'); }} 
                      className="w-full p-4 rounded-2xl font-bold text-slate-400 hover:text-slate-600 transition text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {paymentStep === 'transactionInput' && (
                <div className="animate-in slide-in-from-right duration-300">
                  <div className="bg-indigo-50 p-6 rounded-[32px] mb-8 text-center border border-indigo-100">
                    <div className="w-16 h-16 bg-white text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                        <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Payment Marked Done</h3>
                    <p className="text-xs font-bold text-slate-500">Please provide the transaction ID to confirm your payment of ₹{selectedPlan?.price}.</p>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Enter Transaction ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. T234567890"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-bold focus:border-indigo-500 focus:bg-white outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                     <button 
                      onClick={submitPaymentRequest} 
                      disabled={loading}
                      className="w-full p-5 rounded-2xl bg-emerald-500 text-white font-black text-xl shadow-xl shadow-emerald-200 hover:bg-emerald-600 transition active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Submitting...' : 'Done'}
                    </button>
                    <button 
                      onClick={() => { setPaymentStep('qr'); setTransactionId(''); }} 
                      disabled={loading}
                      className="w-full p-4 rounded-2xl font-bold text-slate-400 hover:text-slate-600 transition text-sm"
                    >
                      Back to QR
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        
        #reader { border: none !important; }
        #reader__dashboard_section_csr button {
          background-color: #4f46e5 !important;
          color: white !important;
          border-radius: 12px !important;
          padding: 8px 16px !important;
          border: none !important;
          font-weight: bold !important;
          margin-top: 10px !important;
        }
      `}} />
    </div>
  );
};

export default MemberKiosk;
