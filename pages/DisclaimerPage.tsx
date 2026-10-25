
import React, { useState, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, FileText, CheckCircle, ArrowRight, Info, LoaderCircle } from 'lucide-react';

interface DisclaimerPageProps {
  onContinue: () => void;
}

const DisclaimerPage: React.FC<DisclaimerPageProps> = ({ onContinue }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleContinueClick = () => {
    setIsLoading(true);
    // Simulate loading delay for animation
    setTimeout(() => {
        onContinue();
    }, 1500);
  };

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

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex items-center justify-center overflow-y-auto">
      {/* Falling Particles Wrapper */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg" style={{ zIndex: 0 }}>
        {particles.map((p) => (
          <div 
            key={p.id}
            className="absolute bg-slate-400 rounded-full animate-falling"
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
      </div>
      <style>{`
        @keyframes falling {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(110vh) translateX(20px); opacity: 0; }
        }
        .animate-falling {
            animation: falling linear infinite;
        }
      `}</style>
      <div className="max-w-5xl w-full mx-auto animate-fade-in relative z-10">
        
        {/* Header Section */}
        <div className="relative overflow-hidden bg-slate-800/40 rounded-2xl p-2 md:p-8 mb-4 border border-slate-700/50 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
            <ShieldAlert size={200} className="text-amber-500" />
          </div>
          
          <div className="flex items-center gap-4 mb-1">
              <div className="p-2 bg-amber-500/20 rounded-2xl border border-amber-500/30">
                  <AlertTriangle className="text-amber-400" size={30} />
              </div>
              <h1 className="text-xl md:text-4xl font-black tracking-tighter uppercase">
                <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">Disclaimer</span>
                <span className="text-slate-400 ml-3 font-light">& Penafian</span>
              </h1>
          </div>
          
          <p className="text-slate-300 text-[15px] max-w-2xl leading-relaxed italic">
            Harap membaca dan memahami ketentuan berikut terkait penggunaan data dan informasi dalam 
            <span className="text-emerald-400 font-bold"> Bacol Enterprise System</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1 */}
          <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800/50 hover:border-royal-gold/10 transition-all duration-300 hover:bg-slate-800/50 group">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <FileText className="text-blue-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Sifat Informasi</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Seluruh data keuangan, grafik, dan laporan yang disajikan dalam aplikasi ini ditujukan untuk kepentingan transparansi dan pengelolaan internal. Laporan dihasilkan secara otomatis berdasarkan input pengguna.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800/50 hover:border-royal-gold/30 transition-all duration-300 hover:bg-slate-800/50 group">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <AlertTriangle className="text-amber-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Akurasi & Integritas</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Keakuratan laporan bergantung sepenuhnya pada data yang diinput. Pengguna bertanggung jawab atas validitas transaksi yang dicatat ke dalam Jurnal Umum. Lakukan audit berkala untuk memastikan konsistensi saldo.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800/50 hover:border-royal-gold/30 transition-all duration-300 hover:bg-slate-800/50 md:col-span-2 group">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg shrink-0 group-hover:bg-green-500/20 transition-colors">
                <CheckCircle className="text-green-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Pernyataan Tanggung Jawab</h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Pihak pengembang sistem Bacol Enterprise tidak bertanggung jawab atas kesalahan pembukuan, kehilangan data akibat kerusakan perangkat keras, atau penyalahgunaan akun. Segala keputusan finansial yang diambil berdasarkan data aplikasi adalah risiko pengguna.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-10 flex justify-center">
            <button
                onClick={handleContinueClick}
                disabled={isLoading}
                className={`group relative inline-flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-royal-gold via-amber-600 to-royal-gold hover:from-amber-500 hover:to-royal-gold text-royal-900 font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all duration-300 transform ${isLoading ? 'opacity-90 cursor-wait' : 'hover:-translate-y-1 active:scale-95'}`}
            >
                {isLoading ? (
                    <>
                        <LoaderCircle className="animate-spin" size={24} />
                        <span className="tracking-wide">Menyiapkan Sistem...</span>
                    </>
                ) : (
                    <>
                        <span className="tracking-wide">Setuju & Lanjutkan</span>
                        <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
                    </>
                )}
            </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center border-t border-slate-800/80 pt-5">
          <p className="text-slate-500 text-xs md:text-sm">
            Desa Adat Basangalas (Bacol Enterprise System) • Sistem Akuntansi & Manajemen Kas Adat • {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerPage;
