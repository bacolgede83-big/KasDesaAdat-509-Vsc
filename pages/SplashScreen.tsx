
import React, { useState, useEffect, useMemo } from 'react';
import Spinner from '../components/shared/Spinner';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { ArrowLeft, Sparkles, Droplets, Shield, Printer, LogIn as LogInIcon, Star } from 'lucide-react';

interface SplashScreenProps {
  onLogin: (email: string, password: string) => Promise<any>;
  onRegister: (email: string, password: string) => Promise<any>;
  isLoading: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onLogin, onRegister, isLoading }) => {
  const [authView, setAuthView] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [isAnimating, setIsAnimating] = useState(false);

  // Generate random particles
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      duration: `${10 + Math.random() * 15}s`,
      delay: `${Math.random() * 10}s`,
      size: `${2 + Math.random() * 4}px`,
      opacity: 0.1 + Math.random() * 0.3
    }));
  }, []);

  useEffect(() => {
    let transitionTimeout: ReturnType<typeof setTimeout>;

    if (isAnimating) {
      transitionTimeout = setTimeout(() => {
        setAuthView('login');
        setIsAnimating(false);
      }, 3000); // 3 detik animasi
    }
    
    return () => {
      clearTimeout(transitionTimeout);
    };
  }, [isAnimating]);

  const handleStartAnimation = () => {
    setIsAnimating(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
      return (
        <div className="relative flex flex-col items-center justify-center h-screen w-screen  bg-gradient-to-br from-gray-900 via-teal-900 to-gray-800 animate-gradient-slow">
             <Spinner text="Menyiapkan Data Bacol Enterprise System..." />
        </div>
      );
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-screen overflow-hidden  bg-gradient-to-br from-gray-900 via-teal-900 to-gray-800 animate-gradient-slow" id="splash-printable">
      
      {/* Background Ornaments */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none no-print">
          <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[100px]"></div>
          <div className="absolute top-[50%] -right-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-slate-950 to-transparent"></div>
          
          {/* Falling Particles */}
          {particles.map((p) => (
            <div 
              key={p.id}
              className="absolute bg-yellow-600 rounded-full animate-falling"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animationDuration: p.duration,
                animationDelay: p.delay,
                top: '-5vh'
              }}
            />
          ))}

          {/* Floating Stars for Luxury effect */}
          <Star className="absolute top-1/4 left-1/4 text-amber-200/20 w-4 h-4 animate-pulse" />
          <Star className="absolute top-1/3 right-1/4 text-emerald-200/20 w-3 h-3 animate-pulse delay-700" />
          <Star className="absolute bottom-1/4 left-1/2 text-amber-200/20 w-5 h-5 animate-pulse delay-300" />
      </div>

      <style>{`
        @keyframes shine {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
        }
        @keyframes falling {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(110vh) translateX(20px); opacity: 0; }
        }
        .animate-falling {
            animation: falling linear infinite;
        }
        @keyframes spin-clockwise {
            0% {
                transform: rotate(0deg) scale(1);
                opacity: 1;
            }
            100% {
                transform: rotate(360deg) scale(0);
                opacity: 0;
            }
        }
        .animate-spin-clockwise {
            animation: spin-clockwise 3s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
            transform-origin: center center;
        }
        .text-luxury-gold {
            background: linear-gradient(to right, #fbbf24 20%, #fffbeb 40%, #fbbf24 60%, #d97706 80%);
            background-size: 200% auto;
            color: transparent;
            background-clip: text;
            -webkit-background-clip: text;
            animation: shine 4s linear infinite;
        }
        .gold-glow {
            box-shadow: 0 0 50px rgba(251, 191, 36, 0.4);
        }
        .inner-glow {
            box-shadow: inset 0 0 20px rgba(251, 191, 36, 0.3);
        }
        
        @media print {
            body * { visibility: hidden; }
            #splash-printable, #splash-printable * { visibility: visible; }
            #splash-printable {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100vh;
                background-color: #0f172a !important;
                -webkit-print-color-adjust: exact;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
            }
            .no-print { display: none !important; }
            .text-luxury-gold {
                color: #fbbf24 !important;
                background: none !important;
                -webkit-background-clip: initial !important;
            }
        }
      `}</style>

      {/* Top Left Navigation (Back & Print) */}
      <div className="absolute top-6 left-6 flex gap-3 z-20 no-print">
          {authView !== 'welcome' && (
            <button 
                onClick={() => setAuthView('welcome')} 
                className="text-slate-300 hover:text-white flex items-center gap-2 transition-all hover:-translate-x-1 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700 shadow-xl"
            >
                <ArrowLeft size={18} /> 
                <span className="text-xs font-bold tracking-wide uppercase">Kembali</span>
            </button>
          )}
          {authView === 'welcome' && (
            <button 
                onClick={handlePrint} 
                className="text-slate-300 hover:text-amber-400 flex items-center gap-2 transition-all bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700 shadow-xl"
                title="Cetak Halaman Depan"
            >
                <Printer size={18} /><span>VSC</span>
                <span className="text-xs font-bold tracking-wide uppercase"></span>
            </button>
          )}
      </div>

      {/* Top Right "Log In" Button (Only on welcome screen) */}
      {authView === 'welcome' && (
        <div className="absolute top-6 right-6 z-20 no-print">
            <button
                onClick={handleStartAnimation}
                disabled={isAnimating}
                className="group relative px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 rounded-full shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 overflow-hidden flex items-center gap-2"
            >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                <LogInIcon size={18} className="text-slate-950" />
                <span className="relative font-black text-slate-950 tracking-widest text-sm">
                    Log In
                </span>
            </button>
        </div>
      )}

      {authView === 'welcome' && (
        <div className={`flex flex-col items-center z-10 mt-0 ${isAnimating ? 'animate-spin-clockwise' : ''}`}>
            
            {/* Beautiful Luxury Icon Container */}
            <div className="relative mb-10 group cursor-pointer" onClick={handleStartAnimation}>
                <div className="absolute inset-0 bg-amber-500/30 blur-[100px] rounded-full group-hover:bg-amber-400/40 transition-all duration-700 animate-pulse no-print"></div>
                
                {/* Outer Luxury Ring */}
                <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-amber-800 via-amber-200 to-amber-800 shadow-2xl gold-glow transform transition-transform group-hover:scale-105 duration-500">
                    {/* Middle Luxury Ring */}
                    <div className="p-1 rounded-full bg-slate-900">
                        <div className="p-1.5 rounded-full bg-gradient-to-bl from-amber-300 via-amber-600 to-amber-900">
                             {/* Inner Circle */}
                            <div className="bg-slate-900 p-8 rounded-full border-4 border-slate-800 relative overflow-hidden flex items-center justify-center inner-glow">
                                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/15 via-transparent to-emerald-500/10"></div>
                                <Droplets size={84} className="text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)] relative z-10" />
                            </div>
                        </div>
                    </div>
                </div>

                <Sparkles className="absolute -top-4 -right-4 text-amber-200 w-8 h-8 animate-pulse no-print" />
                <Sparkles className="absolute bottom-2 -left-6 text-emerald-400 w-6 h-6 animate-pulse no-print" style={{ animationDelay: '1s' }} />
                <Shield className="absolute -bottom-2 -right-4 text-emerald-400 w-5 h-5 opacity-40 no-print" />
            </div>

            {/* Main Title */}
            <div className="text-center space-y-2 mb-2 px-6">
                <h1 className="text-3xl md:text-7xl font-black tracking-normal text-white drop-shadow-2xl">
                    <span className="text-luxury-gold block mb-0 leading-tight">BACOL ENTERPRISE</span>
                    <span className="text-white text-2xl md:text-6xl opacity-90 tracking-normal font-semibold font-light">
                    Tata Kelola Keuangan Desa Adat</span>
                </h1>           
                <p className="text-slate-400 text-base md:text-lg font-light tracking-[0.2em] mt-8 flex items-center justify-center gap-3">
                     <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping no-print italic"></span>
                     Membangun Transparansi & Akuntabilitas Digital
                </p>
            </div>
        </div>
      )}

      {/* LOGIN VIEW */}
      {authView === 'login' && (
          <div className="z-10 w-full max-w-4xl px-4 py-6 no-print">
             <div className="bg-bg-gradient-to-br from-emerald-300/20 to-[#e6f4ea] backdrop-blur-2xl p-8 md:p-12 rounded-3xl shadow-2xl border border-amber-600 animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                <LoginForm onLogin={onLogin} onSwitchToRegister={() => setAuthView('register')} />
             </div>
          </div>
      )}

       {/* REGISTER VIEW */}
       {authView === 'register' && (
          <div className="z-10 w-full max-w-4xl px-4 py-6 no-print">
             <div className="bg-bg-gradient-to-br from-emerald-300/20 to-[#e6f4ea] backdrop-blur-2xl p-8 md:p-12 rounded-3xl shadow-2xl border border-amber-600 animate-fade-in-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                <RegisterForm onRegister={onRegister} onSwitchToLogin={() => setAuthView('login')} />
             </div>
          </div>
       )}
        {/* Footer Left: Copyright added as requested */}
      <div className="absolute bottom-4 left-4 z-10 text-white/50 text-sm font-light italic">
        Copyright : Bacol Enterprise management 2025
      </div>

      {/* Footer Right */}
      <div className="absolute bottom-4 right-4 z-10 text-white/50 text-sm font-light italic">
        Aplikasi Bacol Enterprise ( Desa Adat V.5.0.9.BG.Admin )
      </div>

      {isAnimating && <Spinner text="Mempersiapkan Bacol Enterprise System..." />}
    </div>
  );
};

export default SplashScreen;
