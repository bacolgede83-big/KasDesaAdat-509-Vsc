import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatter';
import { 
  getStoredSignatures, 
  getSignatureSettings, 
  getEffectiveStamp, 
  DigitalSignatures, 
  SignatureSettings 
} from '../../utils/signatureStorage';
import { 
  Calculator, 
  Coins, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  SlidersHorizontal, 
  RotateCcw, 
  HelpCircle,
  TrendingUp,
  Wallet,
  AlertCircle,
  Receipt,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
  FileDown
} from 'lucide-react';

export interface OpsiPerhitunganData {
  totalHutang: number;
  hasHutang: boolean;
  totalPendapatan: number;
  pendapatanTerpakai: number;
  saldoKasPendapatan: number;
  totalBelanja: number;
  totalSumberDana: number;
  saldoKasJuruRaksa: number;
  estimasiSumberDana: number;
  kewajibanList?: Array<{ code: string; name: string; saldo: number }>;
}

interface OpsiPerhitunganNeracaProps {
  data: OpsiPerhitunganData;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  onDownloadPdf?: () => void;
  onPrint?: () => void;
  onPrintOpsi?: () => void;
  reportDate?: string;
  customPlace?: string;
  signatureDate?: string;
  keliangName?: string;
  juruRaksaName?: string;
}

export const OpsiPerhitunganNeraca: React.FC<OpsiPerhitunganNeracaProps> = ({ 
  data, 
  isVisible: controlledIsVisible, 
  onToggleVisibility,
  onDownloadPdf,
  onPrint,
  onPrintOpsi,
  reportDate,
  customPlace,
  signatureDate,
  keliangName,
  juruRaksaName
}) => {
  const [localIsVisible, setLocalIsVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('neraca_show_opsi_perhitungan');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const isVisible = controlledIsVisible !== undefined ? controlledIsVisible : localIsVisible;

  // Digital Signatures & Official Stamp from global settings
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [sigSettings, setSigSettings] = useState<SignatureSettings>(() => getSignatureSettings());

  useEffect(() => {
    const handleSigUpdate = () => {
      setSignatures(getStoredSignatures());
      setSigSettings(getSignatureSettings());
    };
    window.addEventListener('signatures-updated', handleSigUpdate);
    window.addEventListener('storage', handleSigUpdate);
    return () => {
      window.removeEventListener('signatures-updated', handleSigUpdate);
      window.removeEventListener('storage', handleSigUpdate);
    };
  }, []);

  const embedSignatures = sigSettings.autoEmbed !== false;
  const showStamp = sigSettings.showStampOverlay !== false;
  const effectiveStamp = getEffectiveStamp(signatures, 'DESA ADAT BASANGALAS');

  const toggleVisibility = () => {
    if (onToggleVisibility) {
      onToggleVisibility();
    } else {
      setLocalIsVisible(prev => {
        const next = !prev;
        try {
          localStorage.setItem('neraca_show_opsi_perhitungan', JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    }
  };

  const [activeTab, setActiveTab] = useState<'all' | 'opsi1' | 'opsi2' | 'opsi3'>('all');
  const [isCustomMode, setIsCustomMode] = useState(false);
  
  // Custom interactive simulation values
  const [customHutang, setCustomHutang] = useState<number>(data.totalHutang);
  const [customPendapatanTerpakai, setCustomPendapatanTerpakai] = useState<number>(data.pendapatanTerpakai);
  const [customPendapatanTersedia, setCustomPendapatanTersedia] = useState<number>(
    data.saldoKasPendapatan > 0 ? data.saldoKasPendapatan : data.totalPendapatan
  );
  const [customEstimasiSumberDana, setCustomEstimasiSumberDana] = useState<number>(data.estimasiSumberDana);

  // Sync or use custom
  const hutang = isCustomMode ? customHutang : data.totalHutang;
  const pendapatanTerpakai = isCustomMode ? customPendapatanTerpakai : data.pendapatanTerpakai;
  const pendapatanTersedia = isCustomMode ? customPendapatanTersedia : (data.saldoKasPendapatan > 0 ? data.saldoKasPendapatan : data.totalPendapatan);
  const estimasiSumberDana = isCustomMode ? customEstimasiSumberDana : data.estimasiSumberDana;

  const hasHutang = hutang > 0;

  const handleResetSimulasi = () => {
    setCustomHutang(data.totalHutang);
    setCustomPendapatanTerpakai(data.pendapatanTerpakai);
    setCustomPendapatanTersedia(data.saldoKasPendapatan > 0 ? data.saldoKasPendapatan : data.totalPendapatan);
    setCustomEstimasiSumberDana(data.estimasiSumberDana);
    setIsCustomMode(false);
    setActiveTab('all');
  };

  // --- 1. OPSI 1: Hutang + Pendapatan yang Terpakai ---
  const opsi1TotalDibutuhkan = hutang + pendapatanTerpakai;

  // --- 2. OPSI 2: Pelunasan Hutang via Hasil Pendapatan + Estimasi Sumber Dana ---
  const opsi2AlokasiPendapatan = Math.min(pendapatanTersedia, hutang);
  const opsi2EstimasiSumberDana = Math.max(0, hutang - opsi2AlokasiPendapatan);
  const opsi2TotalPelunasan = hutang;

  // --- 3. OPSI 3: Tanpa Hutang - Pendapatan Utuh (Estimasi Sumber Dana) ---
  const opsi3EstimasiSumberDana = estimasiSumberDana > 0 ? estimasiSumberDana : (pendapatanTerpakai > 0 ? pendapatanTerpakai : data.totalBelanja);
  const opsi3TotalDibutuhkan = opsi3EstimasiSumberDana;

  if (!isVisible) {
    return (
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 mt-6 no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all hover:border-slate-400">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl border border-slate-300 shadow-sm">
            <Calculator size={20} className="text-slate-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-slate-800 tracking-tight">
                {hasHutang 
                  ? 'Opsi Perhitungan Rekonsiliasi Pelunasan Hutang' 
                  : 'Opsi Perhitungan Estimasi Sumber Dana (Tanpa Hutang)'}
              </h4>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-300">
                Disembunyikan
              </span>
              {hasHutang ? (
                <span className="bg-rose-50 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                  Ada Hutang: {formatCurrency(hutang)}
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Hutang Nihil (Rp 0)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Kartu analisis dan opsi perhitungan disembunyikan. Klik tombol di samping untuk menampilkan bantuan perhitungan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-rose-300 font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 border border-slate-700"
              title="Unduh Laporan Neraca & Ringkasan Perhitungan dalam format PDF"
            >
              <FileDown size={14} />
              <span>Download PDF</span>
            </button>
          )}

          <button
            onClick={toggleVisibility}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 shrink-0"
            title="Tampilkan kartu opsi perhitungan"
          >
            <Eye size={14} />
            <span>Tampilkan Opsi Perhitungan</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="opsi-perhitungan-container bg-white rounded-2xl border border-slate-400 shadow-md p-5 sm:p-6 space-y-6 mt-6 print:border-none print:shadow-none print:p-2 print:px-3">
      {/* Header Kop Surat Formal Khusus saat Cetak Opsi (Hanya tampil saat mode Cetak Opsi) */}
      <div className="opsi-standalone-header hidden print:block text-slate-900 mb-6">
        <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
            DESA ADAT BASANGALAS
          </h2>
          <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
            LAPORAN KAS DESA ADAT
          </p>
          <p className="text-xs font-semibold text-slate-700 font-serif m-0">
            Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
          </p>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-base font-black uppercase tracking-widest text-slate-900 underline font-serif">
            {hasHutang 
              ? 'LAPORAN OPSI PERHITUNGAN REKONSILIASI PELUNASAN HUTANG' 
              : 'LAPORAN OPSI PERHITUNGAN ESTIMASI SUMBER DANA'}
          </h3>
          <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
            Per Tanggal: {reportDate ? new Date(reportDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
          </p>
        </div>
      </div>

      {/* Header Bagian Opsi Perhitungan */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-slate-400 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300 shadow-sm print:bg-slate-100 print:text-black">
            <Calculator size={22} className="text-emerald-700 print:text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight print:text-black">
                {hasHutang 
                  ? 'Opsi Perhitungan Rekonsiliasi Pelunasan Hutang' 
                  : 'Opsi Perhitungan Estimasi Sumber Dana (Tanpa Hutang)'}
              </h3>
              {hasHutang ? (
                <span className="bg-rose-50 text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider print:border-slate-600 print:text-black">
                  Ada Hutang ({formatCurrency(hutang)})
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider print:border-slate-600 print:text-black">
                  Hutang Nihil (Rp 0)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5 print:text-slate-700">
              {hasHutang 
                ? 'Analisis kebutuhan dana pelunasan kewajiban/hutang dan skenario perlindungan keutuhan pendapatan lainnya.'
                : 'Analisis kebutuhan dana pembiayaan belanja dari Sumber Dana dengan menjaga hasil pendapatan tetap utuh 100%.'}
            </p>
          </div>
        </div>

        {/* Action buttons: Mode Simulasi, Cetak Opsi/PDF & Sembunyikan Opsi */}
        <div className="flex items-center gap-2 self-end sm:self-center no-print flex-wrap">
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/90 hover:bg-rose-800 text-rose-100 font-bold rounded-lg text-xs transition-all border border-rose-700 shadow-sm active:scale-95"
              title="Unduh PDF Dokumen Neraca & Rekonsiliasi"
            >
              <FileDown size={13} />
              <span>Download PDF</span>
            </button>
          )}

          {(onPrintOpsi || onPrint) && (
            <button
              onClick={onPrintOpsi || onPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-lg text-xs transition-all border border-teal-600 shadow-sm active:scale-95"
              title="Cetak Khusus Dokumen Opsi Perhitungan & Rekonsiliasi"
            >
              <Printer size={13} />
              <span>Cetak Opsi</span>
            </button>
          )}

          {isCustomMode ? (
            <button
              onClick={handleResetSimulasi}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all border border-slate-300"
              title="Reset ke nilai riil neraca"
            >
              <RotateCcw size={13} />
              <span>Reset Data Riil</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCustomMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-emerald-300 font-bold rounded-lg text-xs transition-all border border-slate-700 shadow-sm"
              title="Aktifkan mode simulasi angka bebas"
            >
              <SlidersHorizontal size={13} />
              <span>Mode Simulasi</span>
            </button>
          )}

          <button
            onClick={toggleVisibility}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all border border-slate-300 shadow-sm"
            title="Sembunyikan kartu opsi perhitungan"
          >
            <EyeOff size={13} />
            <span>Sembunyikan</span>
            <ChevronUp size={13} />
          </button>
        </div>
      </div>

      {/* Mode Simulasi Alert / Editor Form */}
      {isCustomMode && (
        <div className="no-print bg-amber-50/80 border border-amber-300 rounded-xl p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-amber-700" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                Panel Parameter Simulasi Dinamis
              </span>
            </div>
            <span className="text-[11px] text-amber-800 font-medium italic">
              Ubah angka di bawah untuk melihat kalkulasi skenario
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                1. Total Hutang / Kewajiban (Rp)
              </label>
              <input
                type="number"
                value={customHutang}
                onChange={(e) => setCustomHutang(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                2. Pendapatan yang Terpakai (Rp)
              </label>
              <input
                type="number"
                value={customPendapatanTerpakai}
                onChange={(e) => setCustomPendapatanTerpakai(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                3. Saldo Kas Pendapatan Tersedia (Rp)
              </label>
              <input
                type="number"
                value={customPendapatanTersedia}
                onChange={(e) => setCustomPendapatanTersedia(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                4. Estimasi Sumber Dana (Rp)
              </label>
              <input
                type="number"
                value={customEstimasiSumberDana}
                onChange={(e) => setCustomEstimasiSumberDana(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Tabs Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-print">
        {hasHutang ? (
          <>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                activeTab === 'all' || activeTab === 'opsi3'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua Opsi (Opsi 1 & 2)
            </button>
            <button
              onClick={() => setActiveTab('opsi1')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'opsi1'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span>Opsi 1 (Hutang + Pendapatan Terpakai)</span>
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            </button>
            <button
              onClick={() => setActiveTab('opsi2')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'opsi2'
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>Opsi 2 (Hutang: Pendapatan + Sumber Dana)</span>
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setActiveTab('opsi3')}
            className="px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 bg-emerald-700 text-white shadow-sm"
          >
            <span>Opsi 3 (Tanpa Hutang — Pendapatan Utuh)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
          </button>
        )}
      </div>

      {/* Grid Opsi Perhitungan (Kondisional: Opsi 1 & 2 jika Ada Hutang, Opsi 3 jika Hutang = 0) */}
      {hasHutang ? (
        <div className={`grid grid-cols-1 ${(activeTab === 'all' || activeTab === 'opsi3') ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-5`}>
          
          {/* ========================================================================= */}
          {/* OPSI 1: PELUNASAN HUTANG & PENGEMBALIAN PENDAPATAN DARI SUMBER DANA */}
          {/* ========================================================================= */}
          {(activeTab === 'all' || activeTab === 'opsi1' || activeTab === 'opsi3') && (
            <div className="bg-slate-50 border-2 border-gray-500 rounded-2xl p-8 flex flex-col justify-between shadow-sm relative overflow-hidden print:border-none print:bg-white">
              <div className="space-y-3.5">
                {/* Badge Top Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-rose-100 text-rose-900 border border-rose-500 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wide print:border-none print:text-black">
                    Opsi 1 • Ada Hutang
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-400 print:hidden">
                    <Sparkles size={11} className="text-rose-800" />
                    Pelunasan Penuh
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="text-sm font-black text-slate-900 leading-snug print:text-black">
                    Pelunasan Hutang & Pengembalian Utuh Pendapatan dari Sumber Dana
                  </h4>
                  <p className="text-[12px] text-slate-700 mt-1 leading-relaxed print:text-slate-700">
                    Untuk melunasi hutang sekaligus mengembalikan hasil pendapatan lainnya yang sempat terpakai ke pos aslinya melalui suntikan Sumber Dana.
                  </p>
                </div>

                {/* Formula Visualizer Box */}
                <div className="bg-white p-3 rounded-xl border border-slate-400 shadow-inner space-y-2 print:border-slate-400">
                  <div className="text-[12px] uppercase font-mono font-black text-slate-800 tracking-wider">
                    Rumus Kebutuhan Dana:
                  </div>
                  <div className="font-mono text-xs font-black text-slate-900 bg-rose-50/60 p-2 rounded-lg border border-slate-300">
                    Kebutuhan Dana = Hutang + Pendapatan yang Terpakai
                  </div>

                  {/* Step Breakdown */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-[12px]">1. Total Hutang / Kewajiban</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(hutang)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-[12px]">2. Pendapatan Terpakai (Mutasi Kas)</span>
                      <span className="font-mono font-bold text-amber-900">{formatCurrency(pendapatanTerpakai)}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-1.5 flex justify-between items-center text-slate-900 font-bold">
                      <span className="text-[12px] uppercase">Dibutuhkan Dana Sebesar</span>
                      <span className="font-mono text-slate-900 font-black text-[12px]">{formatCurrency(opsi1TotalDibutuhkan)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Total Callout */}
              <div className="mt-4 pt-3 p-8 border-t border-gray-400 bg-rose-100/60 -mx-4.5 -mb-4.5 sm:-mx-5 sm:-mb-5 p-4 rounded-b-2xl print:border-none print:bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-rose-900 block">
                      Total Dana yang Dibutuhkan
                    </span>
                    <span className="text-[12px] text-slate-700 italic">
                      (Sumber Dana Pokok / Urunan)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-base font-black text-rose-900">
                      {formatCurrency(opsi1TotalDibutuhkan)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-[15px] text-slate-900 bg-white/80 p-2 rounded-lg border border-slate-400 flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-rose-800 shrink-0 mt-0.5" />
                  <span>
                    <strong>Hasil:</strong> Seluruh hutang terselesaikan lunas dan seluruh pendapatan (Punia/Sasah Abu) kembali utuh 100%.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPSI 2: PELUNASAN HUTANG DARI HASIL PENDAPATAN + ESTIMASI SUMBER DANA */}
          {/* ========================================================================= */}
          {(activeTab === 'all' || activeTab === 'opsi2' || activeTab === 'opsi3') && (
            <div className="bg-slate-50 border-2 border-gray-400 rounded-2xl p-8 flex flex-col justify-between shadow-sm relative overflow-hidden print:border-none print:bg-white">
              <div className="space-y-3.5">
                {/* Badge Top Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wide print:border-slate-700 print:text-black">
                    Opsi 2 • Ada Hutang
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 print:hidden">
                    <Sparkles size={11} className="text-amber-600" />
                    Kombinasi Kas
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="text-sm font-black text-slate-900 leading-snug print:text-black">
                    Pelunasan Hutang dari Hasil Pendapatan + Estimasi Sumber Dana
                  </h4>
                  <p className="text-[12px] text-slate-700 mt-1 leading-relaxed print:text-slate-700">
                    Untuk melunasi hutang dengan memanfaatkan terlebih dahulu hasil pendapatan yang tersedia, lalu sisa kekurangannya dipenuhi dari Estimasi Sumber Dana.
                  </p>
                </div>

                {/* Formula Visualizer Box */}
                <div className="bg-white p-3 rounded-xl border border-gray-400 shadow-inner space-y-2 print:border-none">
                  <div className="text-[12px] uppercase font-mono font-black text-slate-800 tracking-wider">
                    Rumus Alokasi Pelunasan:
                  </div>
                  <div className="font-mono text-xs font-black text-slate-900 bg-amber-50/60 p-2 rounded-lg border border-slate-300">
                    Pelunasan = Hasil Pendapatan + Estimasi Sumber Dana
                  </div>

                  {/* Step Breakdown */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex justify-between items-center text-slate-900">
                      <span className="text-[12px]">1. Total Hutang yang Harus Dilunasi</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(hutang)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-900">
                      <span className="text-[12px]">2. Alokasi dari Hasil Pendapatan</span>
                      <span className="font-mono font-bold text-emerald-900">{formatCurrency(opsi2AlokasiPendapatan)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-900">
                      <span className="text-[12px]">3. Estimasi Tambahan dari Sumber Dana</span>
                      <span className="font-mono font-bold text-amber-900">{formatCurrency(opsi2EstimasiSumberDana)}</span>
                    </div>
                    <div className="border-t border-dashed border-slate-400 pt-1.5 flex justify-between items-center text-slate-900 font-bold">
                      <span className="text-[12px] uppercase">Total Pelunasan Hutang</span>
                      <span className="font-mono text-amber-900 font-black text-xs">{formatCurrency(opsi2TotalPelunasan)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Total Callout */}
              <div className="mt-4 pt-3 p-8 border-t border-gray-400 bg-amber-100/60 -mx-4.5 -mb-4.5 sm:-mx-5 sm:-mb-5 p-4 rounded-b-2xl print:bg-white print:border-none">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[12px] uppercase font-black tracking-wider text-amber-900 block">
                      Kebutuhan Tambahan Sumber Dana
                    </span>
                    <span className="text-[12px] text-amber-900 italic">
                      (Kekurangan setelah pendapatan)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-base font-black text-amber-900">
                      {formatCurrency(opsi2EstimasiSumberDana)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-[15px] text-slate-900 bg-white/80 p-2 rounded-lg border border-slate-400 flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Hasil:</strong> Hutang lunas menggunakan {formatCurrency(opsi2AlokasiPendapatan)} dari pendapatan + {formatCurrency(opsi2EstimasiSumberDana)} dari sumber dana.
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* ========================================================================= */
        /* OPSI 3: TANPA HUTANG — HASIL PENDAPATAN UTUH (HANYA DITAMPILKAN JIKA HUTANG = 0) */
        /* ========================================================================= */
        <div className="grid grid-cols-1 gap-5">
          <div className="bg-slate-50 border-2 border-gray-500 rounded-2xl p-8 flex flex-col justify-between shadow-sm relative overflow-hidden print:border-none print:bg-white">
            <div className="space-y-3.5">
              {/* Badge Top Header */}
              <div className="flex items-center justify-between gap-2">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-500 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wide print:border-slate-700 print:text-black">
                  Opsi 3 • Tanpa Hutang (Hutang Rp 0)
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-400 print:hidden">
                  <Sparkles size={11} className="text-emerald-700" />
                  Kondisi Ideal
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h4 className="text-sm font-black text-slate-900 leading-snug print:text-black">
                  Tanpa Hutang — Hasil Pendapatan Utuh (Estimasi Sumber Dana)
                </h4>
                <p className="text-[12px] text-slate-700 mt-1 leading-relaxed print:text-slate-700">
                  Apabila tidak ada hutang (Kewajiban Rp 0), dan hasil pendapatan harus dijaga tetap utuh (tidak dipakai atau dikembalikan penuh jika sempat termutasi ke kas juru raksa).
                </p>
              </div>

              {/* Formula Visualizer Box */}
              <div className="bg-white p-3 rounded-xl border border-slate-400 shadow-inner space-y-2 print:border-slate-400">
                <div className="text-[12px] uppercase font-mono font-black text-slate-800 tracking-wider">
                  Rumus Kebutuhan Pembiayaan:
                </div>
                <div className="font-mono text-xs font-black text-slate-900 bg-emerald-50/60 p-2 rounded-lg border border-slate-300">
                  Kebutuhan Dana = Estimasi Sumber Dana
                </div>

                {/* Step Breakdown */}
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex justify-between items-center text-slate-900">
                    <span className="text-[12px]">1. Posisi Hutang / Kewajiban</span>
                    <span className="font-mono font-bold text-emerald-800">
                      Rp 0 (Nihil / Lunas)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900">
                    <span className="text-[12px]">2. Pendapatan Dijaga Utuh / Dipulihkan</span>
                    <span className="font-mono font-bold text-emerald-800">
                      {formatCurrency(pendapatanTerpakai > 0 ? pendapatanTerpakai : data.totalPendapatan)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900">
                    <span className="text-[12px]">3. Estimasi Kebutuhan Pokok Sumber Dana</span>
                    <span className="font-mono font-bold text-emerald-800">{formatCurrency(opsi3EstimasiSumberDana)}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-1.5 flex justify-between items-center text-slate-900 font-bold">
                    <span className="text-[12px] uppercase">Dibutuhkan Dana Sebesar</span>
                    <span className="font-mono text-slate-900 font-black text-[12px]">{formatCurrency(opsi3TotalDibutuhkan)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Total Callout */}
            <div className="mt-4 pt-3 p-8 border-t border-emerald-400 bg-emerald-100/60 -mx-4.5 -mb-4.5 sm:-mx-5 sm:-mb-5 p-4 rounded-b-2xl print:bg-slate-100 print:border-none">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-900 block">
                    Dibutuhkan Dana Sebesar
                  </span>
                  <span className="text-[12px] text-slate-700 italic">
                    (= Estimasi Sumber Dana)
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-black text-emerald-900">
                    {formatCurrency(opsi3TotalDibutuhkan)}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-[15px] text-slate-900 bg-white/80 p-2 rounded-lg border border-emerald-400 flex items-start gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Hasil:</strong> Pendapatan tetap utuh 100% dan seluruh belanja terdanai murni dari Sumber Dana Pokok Aci.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matriks Ringkasan Dinamis (Hanya menampilkan opsi yang relevan dengan status hutang) */}
      <div className="bg-slate-100 rounded-xl p-3 border border-slate-400 space-y-2 no-print">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider">
          <Receipt size={14} className="text-slate-700" />
          <span>
            {hasHutang ? 'Matriks Ringkasan Opsi Pelunasan Hutang' : 'Matriks Ringkasan Pembiayaan Sumber Dana (Hutang Nihil)'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse bg-white rounded-lg overflow-hidden border border-slate-200 print:border-slate-800">
            <thead className="bg-slate-900 text-white text-[11px] uppercase font-bold print:bg-slate-900 print:text-white">
              <tr>
                <th className="p-2 border-r border-slate-700 print:border-slate-700">Skenario Kebijakan</th>
                <th className="p-2 border-r border-slate-700 print:border-slate-700">Kondisi Hutang</th>
                <th className="p-2 border-r border-slate-700 print:border-slate-700">Status Pendapatan Lainnya</th>
                <th className="p-2 text-right">Formula Dana yang Dibutuhkan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[12px] font-medium text-slate-800">
              {hasHutang ? (
                <>
                  <tr className="hover:bg-rose-50/50">
                    <td className="p-2 font-bold text-slate-900 border-r border-slate-200">
                      Opsi 1 (Hutang + Pulihkan Pendapatan)
                    </td>
                    <td className="p-2 border-r border-slate-200 text-gray-900 font-mono font-bold">
                      {formatCurrency(hutang)}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-slate-700">
                      Dipulihkan Utuh 100% ({formatCurrency(pendapatanTerpakai)})
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-gray-900">
                      = Hutang + Pendapatan Terpakai ({formatCurrency(opsi1TotalDibutuhkan)})
                    </td>
                  </tr>
                  <tr className="hover:bg-amber-50/50">
                    <td className="p-2 font-bold text-gray-900 border-r border-slate-200">
                      Opsi 2 (Hutang: Pendapatan + Sumber Dana)
                    </td>
                    <td className="p-2 border-r border-slate-200 text-gray-900 font-mono font-bold">
                      {formatCurrency(hutang)}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-slate-700">
                      Dimanfaatkan {formatCurrency(opsi2AlokasiPendapatan)} untuk pelunasan
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      = Pendapatan ({formatCurrency(opsi2AlokasiPendapatan)}) + Sumber Dana ({formatCurrency(opsi2EstimasiSumberDana)})
                    </td>
                  </tr>
                </>
              ) : (
                <tr className="hover:bg-emerald-50/50">
                  <td className="p-2 font-bold text-emerald-900 border-r border-slate-200">
                    Opsi 3 (Tanpa Hutang: Pendapatan Utuh)
                  </td>
                  <td className="p-2 border-r border-slate-200 text-emerald-700 font-mono">
                    Rp 0 (Nihil / Lunas)
                  </td>
                  <td className="p-2 border-r border-slate-200 text-slate-700">
                    Dijaga Tetap Utuh 100% (Tidak Dipakai)
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-emerald-900">
                    = Estimasi Sumber Dana ({formatCurrency(opsi3TotalDibutuhkan)})
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standalone Signature Section saat Cetak Opsi */}
      <div className="opsi-standalone-signature hidden print:flex justify-between items-start mt-8 print:mt-4 pt-4 print:pt-2 px-8 print:px-2 text-slate-900 text-xs font-serif w-full break-inside-avoid">
        {/* Sisi Kiri: Mengetahui Keliang Adat */}
        <div className="text-center w-64 space-y-1">
          <p className="not-italic leading-relaxed text-slate-700">
            Mengetahui,<br/>
            <span className="font-bold text-slate-950">Keliang Adat Basangalas</span>
          </p>
          <div className="h-16 sm:h-20 print:h-16 flex items-center justify-center relative my-1">
            {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, bukan di Juru Raksa, mengambil tempat setengah nama Keliang Adat ke kiri, ukuran standar mengenai tanda tangan dan label pejabat */}
            {embedSignatures && showStamp && effectiveStamp && (
              <div 
                className="absolute pointer-events-none select-none z-0"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-68%, -46%)',
                  opacity: 0.92,
                  filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                }}
              >
                <img 
                  src={effectiveStamp} 
                  alt="Stempel Resmi Desa Adat" 
                  className="w-24 h-24 sm:w-28 sm:h-28 print:w-24 print:h-24 object-contain max-w-none mix-blend-multiply" 
                  style={{
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact'
                  }}
                />
              </div>
            )}
            {embedSignatures && signatures?.keliang ? (
              <img 
                src={signatures.keliang} 
                alt="TTD Keliang Adat" 
                className="max-h-16 sm:max-h-20 print:max-h-16 object-contain relative z-10" 
                style={{
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                }}
              />
            ) : (
              <div className="h-16 print:h-12" />
            )}
          </div>
          <p className="font-bold border-b border-slate-900 uppercase pb-0.5 inline-block min-w-[180px] not-italic relative z-10">
            {keliangName || 'I Wayan Sudiarta'}
          </p>
        </div>

        {/* Sisi Kanan: Juru Raksa */}
        <div className="text-center w-64 space-y-1">
          <p className="not-italic leading-relaxed text-slate-700">
            {customPlace || 'Basangalas'}, {signatureDate ? new Date(signatureDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : (reportDate ? new Date(reportDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}))}<br/>
            <span className="font-bold text-slate-950">Juru Raksa</span>
          </p>
          <div className="h-16 sm:h-20 print:h-16 flex items-center justify-center relative my-1">
            {embedSignatures && signatures?.juruRaksa ? (
              <img 
                src={signatures.juruRaksa} 
                alt="TTD Juru Raksa" 
                className="max-h-16 sm:max-h-20 print:max-h-16 object-contain relative z-10" 
                style={{
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                }}
              />
            ) : (
              <div className="h-16 print:h-12" />
            )}
          </div>
          <p className="font-bold border-b border-slate-900 uppercase pb-0.5 inline-block min-w-[180px] not-italic relative z-10">
            {juruRaksaName || 'I Nengah Kertiasih'}
          </p>
        </div>
      </div>

      {/* Standalone Footer saat Cetak Opsi */}
      <div className="opsi-standalone-footer hidden print:flex justify-between items-center mt-6 print:mt-3 px-8 print:px-2 text-slate-900 text-xs break-inside-avoid border-t border-slate-300 pt-2">
        <div>
          <p className="font-semibold text-[11px]">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
          <p className="text-[9px] text-slate-500">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
        </div>
        <div className="text-right font-mono text-[8px] text-slate-500">
          <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
};

export default OpsiPerhitunganNeraca;
