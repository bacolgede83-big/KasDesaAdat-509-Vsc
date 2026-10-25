
import React, { useState } from 'react';
import { LogIn, LoaderCircle, Droplets, Mail, Lock } from 'lucide-react';
import LupaKataSandiModal from './LupaKataSandiModal';
import { userLogService } from '../../services/userLogService';

interface LoginFormProps {
    onLogin: (email: string, password: string) => Promise<any>;
    onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onSwitchToRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) {
            setError('Email dan kata sandi tidak boleh kosong.');
            return;
        }
        setIsLoading(true);
        
        // Catat langsung ke tabel log percobaan saat tombol "Masuk Sekarang" diklik dan sedang loading
        const attemptId = userLogService.recordLoginAttempt(email);

        try {
            await onLogin(email, password);
            // Update status berhasil dan catat ke 5 log in terakhir
            userLogService.updateLoginAttemptStatus(attemptId, 'Berhasil Masuk', 'Login sukses ke Bacol Enterprise System');
            userLogService.recordSuccessfulLogin(email);
        } catch (err: any) {
            userLogService.updateLoginAttemptStatus(attemptId, 'Gagal (Kredensial Salah)', err.message || 'Gagal login.');
            setError(err.message || 'Terjadi kesalahan saat login.');
        } finally {
            setIsLoading(false); 
        }
    };

    const handleApplyCredentials = (recoveredEmail: string, recoveredPassword: string) => {
        setEmail(recoveredEmail);
        setPassword(recoveredPassword);
        setError('');
    };

    return (
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16 animate-fade-in-up">
            {/* Branding Sidebar - Reduced width for wider form */}
            <div className="hidden md:flex flex-col items-center justify-center md:w-1/3 border-r border-white/5 pr-10">
                <div className="relative group">
                    <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full group-hover:bg-teal-400/30 transition-all duration-700"></div>
                    <div className="relative p-7 bg-gradient-to-br from-teal-600 to-emerald-800 rounded-[2rem] shadow-2xl mb-6 border border-teal-400/30 transform group-hover:scale-105 transition-transform duration-500">
                        <Droplets size={60} className="text-white drop-shadow-xl" />
                    </div>
                </div>
                <h3 className="text-2xl font-black text-white text-center tracking-tight font-luxury uppercase">Rahajeng Rauh</h3>
                <p className="text-xs text-teal-500/70 font-bold text-center mt-3 uppercase tracking-[0.3em]">Bacol Enterprise</p>
                <div className="h-px w-20 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent my-6"></div>
                <p className="text-lg font-document-title text-slate-300 text-center italic opacity-80">Desa Adat Basangalas</p>
            </div>

            {/* Form Section - Expanded Width */}
            <div className="flex-1 w-full space-y-8">
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white tracking-tighter">MASUK KE <span className="text-amber-500"> BACOL SISTEM</span></h2>
                    <p className="text-slate-500 text-sm font-medium tracking-widest">Silakan Login Untuk Mengelola Keuangan Desa Adat</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="text-sm text-red-400 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center gap-3 animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label htmlFor="email-login" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Alamat Email</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-500 transition-colors">
                                <Mail size={20} />
                            </div>
                            <input 
                                id="email-login"
                                type="email" 
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner placeholder:text-slate-700"
                                placeholder="bacol@enterprise.com"
                                required 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password-login" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kata Sandi</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-500 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input 
                                id="password-login"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner placeholder:text-slate-700"
                                placeholder="••••••••••••"
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full relative group overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 text-white font-black py-3 px-6 rounded-2xl shadow-[0_10px_25px_rgba(20,184,166,0.3)] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-95"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            <div className="flex items-center justify-center gap-3 relative z-10 uppercase tracking-[0.2em] text-sm">
                                {isLoading ? <LoaderCircle className="animate-spin" size={20} /> : <LogIn size={20} />}
                                <span>{isLoading ? 'MEMVERIFIKASI...' : 'MASUK SEKARANG'}</span>
                            </div>
                        </button>
                    </div>
                </form>

                <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-slate-500 font-medium">
                        Belum terdaftar?{' '}
                        <button type="button" onClick={onSwitchToRegister} className="text-amber-500 hover:text-amber-400 font-black uppercase tracking-wider text-xs ml-1 transition-colors">
                            Buat Akun
                        </button>
                    </p>
                    <button 
                        type="button" 
                        onClick={() => setIsForgotModalOpen(true)}
                        className="text-[10px] text-teal-400/80 hover:text-teal-300 font-bold uppercase tracking-widest transition-colors cursor-pointer hover:underline py-1 px-2 rounded-lg hover:bg-teal-500/10"
                    >
                        Lupa Kata Sandi?
                    </button>
                </div>

                <LupaKataSandiModal 
                    isOpen={isForgotModalOpen} 
                    onClose={() => setIsForgotModalOpen(false)} 
                    onApplyCredentials={handleApplyCredentials}
                />
            </div>
        </div>
    );
};

export default LoginForm;
