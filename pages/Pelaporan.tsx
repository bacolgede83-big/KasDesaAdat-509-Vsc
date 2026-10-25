
import React, { useState, useMemo } from 'react';
import { Sparkles, FileText, Send, UserCheck, LayoutList, ChevronRight, Loader2, MessageSquareQuote, ShieldCheck, Info, Printer, Zap, CheckCircle2 } from 'lucide-react';
import type { JuDisplayRow, BudgetItem } from '../types';
import { formatCurrency } from '../utils/formatter';
import { useNotification } from '../context/NotificationContext';
import { ExportPdfButton } from '../components/shared/ExportPdfButton';
import { getGeminiClient, GEMINI_MODEL_TEXT, testGeminiConnection } from '../utils/geminiClient';

interface PelaporanProps {
  entries: JuDisplayRow[];
  budgetItems: BudgetItem[];
}

const Pelaporan: React.FC<PelaporanProps> = ({ entries, budgetItems }) => {
  const { showNotification } = useNotification();
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Summarize data for AI context
  const financialSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalExpense = 0;
    let cashBalance = 0;

    entries.forEach(e => {
        const code = e.kodeRekening || '';
        if (code.startsWith('4')) totalRevenue += (Number(e.kredit) || 0) - (Number(e.debet) || 0);
        if (code.startsWith('5')) totalExpense += (Number(e.debet) || 0) - (Number(e.kredit) || 0);
        if (code.startsWith('1.1')) cashBalance += (Number(e.debet) || 0) - (Number(e.kredit) || 0);
    });

    return {
        totalRevenue,
        totalExpense,
        cashBalance,
        entryCount: entries.length,
        budgetCount: budgetItems.length
    };
  }, [entries, budgetItems]);

  const generateAIReport = async () => {
    setIsGenerating(true);
    setAiResponse('');
    showNotification('Memproses analisis keuangan & menggenerasikan strategi AI...', 'info');
    
    try {
      const ai = getGeminiClient();
      
      const prompt = `
        DATA KEUANGAN SAAT INI:
        - Total Pendapatan: ${formatCurrency(financialSummary.totalRevenue)}
        - Total Belanja/Realisasi: ${formatCurrency(financialSummary.totalExpense)}
        - Saldo Kas Tersedia: ${formatCurrency(financialSummary.cashBalance)}
        - Jumlah Transaksi Jurnal: ${financialSummary.entryCount} baris.
        
        TUGAS ANDA:
        1. Buatkan daftar "Persiapan Pelaporan" (dokumen fisik & digital apa saja yang wajib disiapkan bendahara/juru raksa).
        2. Buatkan panduan "Cara Pelaporan ke Masyarakat" secara transparan dan akuntabel mulai dari tahap awal (persiapan data) hingga tahap akhir (paruman desa).
        3. Buatkan narasi ringkas (Executive Summary) yang bisa dibacakan saat rapat desa berdasarkan angka-angka di atas untuk menunjukkan kinerja keuangan desa.
      `;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_TEXT,
        contents: prompt,
        config: {
          systemInstruction: "Tolong bertindak sebagai Konsultan Keuangan Desa Adat yang ahli. Aplikasi ini bernama BACOL ENTERPRISE. Gunakan gaya bahasa yang formal namun mudah dimengerti masyarakat desa adat. Gunakan Markdown (bold, list, headings) agar rapi."
        }
      });

      if (response.text) {
        setAiResponse(response.text);
        showNotification('Analisis & strategi transparansi publik berhasil digenerasikan!', 'success');
      } else {
        setAiResponse('Gagal menghasilkan laporan.');
        showNotification('Gagal menggenerasikan strategi AI.', 'error');
      }
    } catch (error: any) {
        console.error("AI Error:", error);
        const errMsg = error?.message || 'Pastikan koneksi internet aktif dan API Key valid.';
        setAiResponse(`Terjadi kesalahan saat menghubungi Gemini AI: ${errMsg}`);
        showNotification(`Gagal AI: ${errMsg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintAnalysis = () => {
    showNotification('Membuka jendela cetak untuk hasil analisis...', 'info');
    setTimeout(() => {
      window.print();
    }, 300);
  };

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

  return (
    <div id="pelaporan-main-area" className="space-y-6 animate-slide-up-enter bg-white p-2 rounded-xl">
      {/* Falling Particles */}
      {particles.map((p) => (
        <div 
          key={p.id}
          className="absolute bg-slate-400 rounded-full animate-falling pointer-events-none"
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

      {/* Header */}
      <div className="bg-white p-4 border-b-4 border-teal-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
          <MessageSquareQuote size={200} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-teal-500/20 rounded-2xl border border-teal-500/30 shrink-0">
              <Sparkles className="h-10 w-10 text-teal-600 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter uppercase">Pelaporan Digital AI</h2>
              <p className="text-teal-600 text-xs sm:text-sm font-bold tracking-widest uppercase">Analisis & Strategi Transparansi Publik</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 no-print w-full md:w-auto justify-start md:justify-end">
            <ExportPdfButton
              elementId="pelaporan-main-area"
              filename={`Laporan_Pelaporan_Digital_${new Date().toISOString().split('T')[0]}.pdf`}
              buttonText="Unduh PDF Laporan"
              variant="compact"
              defaultOrientation="portrait"
              options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
            />
            <button 
              onClick={generateAIReport}
              disabled={isGenerating}
              className="flex items-center gap-3 bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 text-white font-black py-3 px-8 rounded-2xl shadow-xl transition-all active:scale-95 group text-sm cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Menganalisis Data...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                  <span>GENERASIKAN STRATEGI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Current Status Summary */}
        <div className="space-y-6">
          <div className="bg-slate-100 p-6 rounded-2xl border border-gray-500 shadow-xl">
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <LayoutList size={16} className="text-gray-900" /> Ringkasan Data Aktif
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-emerald-100 rounded-xl border border-emerald-300">
                <span className="text-emerald-900 text-xs font-bold uppercase">Total Pendapatan</span>
                <span className="text-emerald-700 font-black">{formatCurrency(financialSummary.totalRevenue)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-rose-100 rounded-xl border border-rose-300">
                <span className="text-rose-900 text-xs font-bold uppercase">Total Belanja</span>
                <span className="text-rose-700 font-black">{formatCurrency(financialSummary.totalExpense)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-teal-100 rounded-xl border border-teal-300">
                <span className="text-teal-900 text-xs font-black uppercase">Saldo Kas</span>
                <span className="text-teal-700 font-black">{formatCurrency(financialSummary.cashBalance)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 p-6 rounded-2xl border border-blue-600/30 shadow-xl">
            <h4 className="flex items-center gap-2 text-gray-900 text-xs font-black uppercase tracking-widest mb-3">
              <ShieldCheck size={16} /> Keamanan AI
            </h4>
            <p className="text-[11px] text-gray-800 italic leading-relaxed">
              Analisis ini diproses secara aman menggunakan Gemini AI. Data yang dikirimkan hanya berupa ringkasan angka global untuk menjaga privasi detail transaksi spesifik desa.
            </p>
          </div>
        </div>

        {/* Right Column: AI Output */}
        <div className="lg:col-span-2">
          {aiResponse ? (
            <div className="bg-white rounded-2xl border border-gray-500 shadow-2xl overflow-hidden animate-fade-in-up">
              <div className="bg-slate-900 p-4 px-6 border-b border-gray-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-teal-400" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Hasil Analisis Kecerdasan Buatan</span>
                </div>
                <div className="flex items-center gap-2">
                  <ExportPdfButton
                    elementId="ai-analysis-container"
                    filename={`Analisis_Strategi_Pelaporan_${new Date().toISOString().split('T')[0]}.pdf`}
                    buttonText="Unduh PDF Analisis"
                    variant="compact"
                    defaultOrientation="portrait"
                    options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                  />
                  <button 
                    onClick={handlePrintAnalysis} 
                    className="flex items-center gap-1.5 text-xs font-black text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-2 rounded-xl transition-all uppercase tracking-widest active:scale-95 cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Cetak Hasil</span>
                  </button>
                </div>
              </div>

              {/* Printable & Exportable Analysis Box */}
              <div id="ai-analysis-container" className="p-8 md:p-12 bg-white text-gray-900 leading-relaxed overflow-y-auto max-h-[700px] print:max-h-none print:overflow-visible custom-scrollbar">
                <div className="border-b-2 border-slate-800 pb-4 mb-6 hidden print:block">
                  <h1 className="text-xl font-black uppercase text-slate-900">Laporan Analisis & Strategi Transparansi Keuangan</h1>
                  <p className="text-xs font-semibold text-slate-600">Desa Adat Basangalas • Bacol Enterprise System</p>
                  <p className="text-[10px] text-slate-500 mt-1">Tanggal Analisis: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="whitespace-pre-wrap font-sans text-sm md:text-base leading-relaxed text-slate-800">
                  {aiResponse}
                </div>

                {/* Formal Footer Layout */}
                <div className="mt-12 pt-6 border-t border-slate-300 flex justify-between items-center text-slate-900">
                  <div>
                    <p className="font-semibold text-xs">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                    <p className="text-[10px] text-slate-500">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                  </div>
                  <div className="text-right font-mono text-[9px] text-slate-500">
                    <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-100 border-t border-gray-500 flex items-center gap-3 no-print">
                <Info size={16} className="text-gray-800 shrink-0" />
                <p className="text-[10px] text-gray-900 font-bold uppercase italic tracking-tighter">
                  Catatan: Hasil analisis ini adalah saran pendukung. Keputusan akhir tetap berada pada paruman desa.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center py-32 px-10 text-center">
              <div className="p-6 bg-gray-300 rounded-full mb-6">
                <FileText size={48} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Belum Ada Analisis</h3>
              <p className="text-gray-600 text-sm max-w-md">Klik tombol "GENERASIKAN STRATEGI" di atas untuk memproses data keuangan desa Anda dengan bantuan AI.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pelaporan;
