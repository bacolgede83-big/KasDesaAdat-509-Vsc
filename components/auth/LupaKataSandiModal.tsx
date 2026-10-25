import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  KeyRound, 
  Mail, 
  Phone, 
  Send, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink,
  LogIn,
  RefreshCw
} from 'lucide-react';
import { playSaveSuccessSound, playErrorSound } from '../../utils/soundEffects';

interface LupaKataSandiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCredentials?: (email: string, pass: string) => void;
}

const TARGET_EMAIL = 'Pakdebacolwarung@gmail.com';
const TARGET_WA_RAW = '085237025068';
const APP_EMAIL_CREDENTIAL = 'admin@bacol.dev';
const APP_PASSWORD_CREDENTIAL = 'admin1234';

export const LupaKataSandiModal: React.FC<LupaKataSandiModalProps> = ({
  isOpen,
  onClose,
  onApplyCredentials
}) => {
  const [method, setMethod] = useState<'email' | 'wa'>('email');
  
  // Inputs
  const [inputEmail, setInputEmail] = useState('');
  const [inputWa, setInputWa] = useState('');

  // Status state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    detail?: string;
  } | null>(null);

  const [recoveredCredentials, setRecoveredCredentials] = useState<{
    email: string;
    password: string;
    sentTo: string;
    channel: 'email' | 'wa';
    waUrl?: string;
    mailtoUrl?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset states when opening/closing or switching methods
  useEffect(() => {
    if (isOpen) {
      setNotification(null);
      setRecoveredCredentials(null);
      setCopied(false);
      setInputEmail('');
      setInputWa('');
    }
  }, [isOpen]);

  useEffect(() => {
    setNotification(null);
    setRecoveredCredentials(null);
    setCopied(false);
  }, [method]);

  if (!isOpen) return null;

  // Clean and format phone number for WhatsApp
  const formatWaNumber = (phoneStr: string): { clean: string; intl: string; isValid: boolean } => {
    const clean = phoneStr.replace(/\D/g, '');
    let intl = clean;

    if (intl.startsWith('0')) {
      intl = '62' + intl.slice(1);
    } else if (intl.startsWith('8')) {
      intl = '62' + intl;
    }

    const isValid = clean.length >= 9 && clean.length <= 16;
    return { clean, intl, isValid };
  };

  const handleCopyCredentials = () => {
    const text = `Alamat email : ${APP_EMAIL_CREDENTIAL}\nKata sandi : ${APP_PASSWORD_CREDENTIAL}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
    });
  };

  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setRecoveredCredentials(null);

    const trimmed = inputEmail.trim();
    if (!trimmed) {
      setNotification({
        type: 'error',
        message: 'Silakan masukkan alamat email Anda.'
      });
      playErrorSound();
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      // Case-insensitive check for Pakdebacolwarung@gmail.com
      if (trimmed.toLowerCase() !== TARGET_EMAIL.toLowerCase()) {
        setNotification({
          type: 'error',
          message: 'Email tidak terdaftar!'
        });
        playErrorSound();
        return;
      }

      // Email is verified!
      const subject = encodeURIComponent('Kata Sandi Aplikasi Bacol Sistem');
      const body = encodeURIComponent(
        `Halo,\n\nBerikut adalah informasi akun kredensial Aplikasi Kas Desa Adat Bacol Sistem:\n\nAlamat email : ${APP_EMAIL_CREDENTIAL}\nKata sandi : ${APP_PASSWORD_CREDENTIAL}\n\nSilakan gunakan kredensial ini untuk login ke sistem.`
      );
      const mailtoUrl = `mailto:${TARGET_EMAIL}?subject=${subject}&body=${body}`;

      // Open mail client safely
      try {
        window.location.href = mailtoUrl;
      } catch (err) {
        console.warn('Could not launch mailto automatically:', err);
      }

      playSaveSuccessSound();
      setNotification({
        type: 'success',
        message: `Kredensial berhasil dikirim ke ${TARGET_EMAIL}!`,
        detail: `Alamat email : "${APP_EMAIL_CREDENTIAL}" dan kata sandi "${APP_PASSWORD_CREDENTIAL}" telah dikirimkan ke email tersebut.`
      });

      setRecoveredCredentials({
        email: APP_EMAIL_CREDENTIAL,
        password: APP_PASSWORD_CREDENTIAL,
        sentTo: TARGET_EMAIL,
        channel: 'email',
        mailtoUrl
      });
    }, 400);
  };

  const handleSubmitWa = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setRecoveredCredentials(null);

    const { clean, intl, isValid } = formatWaNumber(inputWa);

    if (!inputWa.trim() || !isValid) {
      setNotification({
        type: 'error',
        message: 'Nomor WhatsApp tidak valid!',
        detail: 'Masukkan nomor WhatsApp lengkap (contoh: 085237025068).'
      });
      playErrorSound();
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);

      // Check if number is 085237025068 (or international 6285237025068)
      const isTarget = clean === TARGET_WA_RAW || clean === '6285237025068';

      if (isTarget) {
        // Target number matches! Send credentials to 085237025068
        const waText = encodeURIComponent(
          `*Pemberitahuan Kata Sandi Aplikasi Bacol Sistem*\n\nAlamat email : ${APP_EMAIL_CREDENTIAL}\nkata sandi : ${APP_PASSWORD_CREDENTIAL}\n\nSilakan simpan dan gunakan kredensial ini untuk login ke aplikasi.`
        );
        const waUrl = `https://api.whatsapp.com/send?phone=6285237025068&text=${waText}`;

        // Attempt to open WhatsApp in a new tab
        window.open(waUrl, '_blank', 'noopener,noreferrer');

        playSaveSuccessSound();
        setNotification({
          type: 'success',
          message: 'Kredensial berhasil dikirim ke WhatsApp 085237025068!',
          detail: `Alamat email : "${APP_EMAIL_CREDENTIAL}" dan kata sandi "${APP_PASSWORD_CREDENTIAL}" telah dikirimkan ke WhatsApp nomor tersebut.`
        });

        setRecoveredCredentials({
          email: APP_EMAIL_CREDENTIAL,
          password: APP_PASSWORD_CREDENTIAL,
          sentTo: '085237025068',
          channel: 'wa',
          waUrl
        });
      } else {
        // Number does not match 085237025068
        // Send "No ini tidak terdaftar di Sistem" to the entered WhatsApp number!
        const rejectMsg = 'No ini tidak terdaftar di Sistem';
        const waText = encodeURIComponent(rejectMsg);
        const waUrl = `https://api.whatsapp.com/send?phone=${intl}&text=${waText}`;

        // Send via WhatsApp to that entered number
        window.open(waUrl, '_blank', 'noopener,noreferrer');

        playErrorSound();
        setNotification({
          type: 'error',
          message: 'No ini tidak terdaftar di Sistem',
          detail: `Pesan "No ini tidak terdaftar di Sistem" dikirimkan ke WhatsApp nomor ${inputWa.trim()}.`
        });
      }
    }, 400);
  };

  const handleApply = () => {
    if (onApplyCredentials) {
      onApplyCredentials(APP_EMAIL_CREDENTIAL, APP_PASSWORD_CREDENTIAL);
    }
    onClose();
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-slate-950/80 z-[99999] flex justify-center items-center backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl shadow-2xl w-full max-w-lg border border-teal-500/30 animate-fade-in-up flex flex-col overflow-hidden text-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glowing ambient highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-amber-400 to-emerald-500"></div>
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-32 bg-teal-500/20 blur-3xl pointer-events-none rounded-full"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-600/30 border border-teal-400/30 text-teal-400 shadow-inner">
              <KeyRound size={22} className="text-teal-400 drop-shadow" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase font-document-title">
                Mengambil Kata Sandi Aplikasi
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Pilih metode pemulihan data akses akun Anda
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
            title="Tutup Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar relative z-10">
          
          {/* Method Selection Tabs */}
          <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950/60 rounded-2xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => setMethod('email')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                method === 'email'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-900/40 border border-teal-400/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Mail size={16} />
              <span>1. Melalui Email</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('wa')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                method === 'wa'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <Phone size={16} />
              <span>2. Melalui No. WA</span>
            </button>
          </div>

          {/* Alert / Notification Feedback */}
          {notification && (
            <div 
              className={`p-4 rounded-2xl border flex items-start gap-3 animate-fade-in ${
                notification.type === 'error'
                  ? 'bg-red-500/15 border-red-500/40 text-red-200'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              }`}
            >
              {notification.type === 'error' ? (
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <p className="font-bold text-sm tracking-wide">
                  {notification.message}
                </p>
                {notification.detail && (
                  <p className="text-slate-300 opacity-90 leading-relaxed font-sans">
                    {notification.detail}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form Method: Email */}
          {method === 'email' && (
            <form onSubmit={handleSubmitEmail} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">
                  Masukkan Email
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="Contoh: bacol@enterprise.com"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-2xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all placeholder:text-slate-600 shadow-inner"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 ml-1">
                  Masukkan email terdaftar untuk menerima kredensial akun login.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-teal-950/60 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Memverifikasi Email...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Kirim Kata Sandi ke Email</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Form Method: WhatsApp */}
          {method === 'wa' && (
            <form onSubmit={handleSubmitWa} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest ml-1">
                  Masukkan No. WA
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                    <Phone size={18} />
                  </div>
                  <input
                    type="text"
                    value={inputWa}
                    onChange={(e) => setInputWa(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-2xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600 shadow-inner"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 ml-1">
                  Masukkan nomor WhatsApp tujuan (contoh: 085237025068).
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-emerald-950/60 transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    <span>Memverifikasi No. WA...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Kirim Kata Sandi ke WhatsApp</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Recovered Credentials Card */}
          {recoveredCredentials && (
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-teal-500/30 space-y-3 animate-fade-in shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-teal-400 font-black">
                  Kredensial Login Aplikasi
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Tujuan: {recoveredCredentials.sentTo}
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Alamat email :</span>
                  <span className="text-white font-bold tracking-wider">{recoveredCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-slate-400">Kata sandi :</span>
                  <span className="text-amber-400 font-bold tracking-wider">{recoveredCredentials.password}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Tersalin!' : 'Salin Kredensial'}</span>
                </button>

                {recoveredCredentials.channel === 'wa' && recoveredCredentials.waUrl && (
                  <a
                    href={recoveredCredentials.waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md"
                  >
                    <ExternalLink size={14} />
                    <span>Buka WhatsApp</span>
                  </a>
                )}

                {recoveredCredentials.channel === 'email' && recoveredCredentials.mailtoUrl && (
                  <a
                    href={recoveredCredentials.mailtoUrl}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-all shadow-md"
                  >
                    <ExternalLink size={14} />
                    <span>Buka Email</span>
                  </a>
                )}
              </div>

              {onApplyCredentials && (
                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-900/40"
                >
                  <LogIn size={15} />
                  <span>Gunakan Kredensial & Masuk</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
          <span>Bacol Enterprise Security Desk</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors uppercase font-bold tracking-wider"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LupaKataSandiModal;
