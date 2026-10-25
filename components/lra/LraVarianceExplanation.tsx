import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Sparkles, 
  Pencil, 
  Check, 
  Copy, 
  RotateCcw, 
  ChevronDown,
  ChevronUp,
  Coins,
  Wallet,
  Scale
} from 'lucide-react';
import type { LraReportDataProps } from '../../utils/lraCalculator';
import { formatCurrency } from '../../utils/formatter';
import { generateContentWithFallback } from '../../utils/geminiClient';
import { useNotification } from '../../context/NotificationContext';
import { playSaveSuccessSound, playSyncSuccessSound, playErrorSound } from '../../utils/soundEffects';

interface LraVarianceExplanationProps {
  reportData: LraReportDataProps;
  periodLabel: string;
  selectedYear?: string;
  selectedMonth?: string;
  isMonthFilterActive?: boolean;
  className?: string;
}

export const LraVarianceExplanation: React.FC<LraVarianceExplanationProps> = ({
  reportData,
  periodLabel,
  selectedYear,
  selectedMonth,
  isMonthFilterActive = false,
  className = '',
}) => {
  const { showNotification } = useNotification();

  // Storage key per period
  const periodKey = useMemo(() => {
    return `${selectedYear || 'all'}_${selectedMonth || 'all'}`;
  }, [selectedYear, selectedMonth]);

  // Aggregate numbers
  const metrics = useMemo(() => {
    const sumberDanaAnggaran = reportData.sumberdana?.totalAnggaran || 0;
    const sumberDanaRealisasi = reportData.sumberdana?.totalRealisasi || 0;
    const sumberDanaSelisih = reportData.sumberdana?.totalSelisih ?? (sumberDanaRealisasi - sumberDanaAnggaran);

    const pendapatanAnggaran = reportData.pendapatan?.totalAnggaran || 0;
    const pendapatanRealisasi = reportData.pendapatan?.totalRealisasi || 0;
    const pendapatanSelisih = reportData.pendapatan?.totalSelisih ?? (pendapatanRealisasi - pendapatanAnggaran);

    const totalPenerimaanAnggaran = sumberDanaAnggaran + pendapatanAnggaran;
    const totalPenerimaanRealisasi = sumberDanaRealisasi + pendapatanRealisasi;
    const totalPenerimaanSelisih = totalPenerimaanRealisasi - totalPenerimaanAnggaran;
    const penerimaanPersen = totalPenerimaanAnggaran > 0 
      ? (totalPenerimaanRealisasi / totalPenerimaanAnggaran) * 100 
      : (totalPenerimaanRealisasi > 0 ? 100 : 0);

    const totalBelanjaAnggaran = reportData.totalBelanjaAnggaran || 0;
    const totalBelanjaRealisasi = reportData.totalBelanjaRealisasi || 0;
    const sisaPaguBelanja = totalBelanjaAnggaran - totalBelanjaRealisasi;
    const serapanPersen = totalBelanjaAnggaran > 0 
      ? (totalBelanjaRealisasi / totalBelanjaAnggaran) * 100 
      : (totalBelanjaRealisasi > 0 ? 100 : 0);

    // Major expense CoA groups
    const parhyanganAnggaran = (reportData.parhyanganadat?.totalAnggaran || 0) || (reportData.parhyangan?.totalAnggaran || 0);
    const parhyanganRealisasi = (reportData.parhyanganadat?.totalRealisasi || 0) || (reportData.parhyangan?.totalRealisasi || 0);
    const parhyanganSisa = parhyanganAnggaran - parhyanganRealisasi;

    const pawonganAnggaran = (reportData.pawonganadat?.totalAnggaran || 0) || (reportData.pawongan?.totalAnggaran || 0);
    const pawonganRealisasi = (reportData.pawonganadat?.totalRealisasi || 0) || (reportData.pawongan?.totalRealisasi || 0);
    const pawonganSisa = pawonganAnggaran - pawonganRealisasi;

    const operasionalAnggaran = (reportData.bebanadat?.totalAnggaran || 0) || (reportData.operasional?.totalAnggaran || 0);
    const operasionalRealisasi = (reportData.bebanadat?.totalRealisasi || 0) || (reportData.operasional?.totalRealisasi || 0);
    const operasionalSisa = operasionalAnggaran - operasionalRealisasi;

    const palemahanAnggaran = reportData.palemahan?.totalAnggaran || 0;
    const palemahanRealisasi = reportData.palemahan?.totalRealisasi || 0;
    const palemahanSisa = palemahanAnggaran - palemahanRealisasi;

    const surplusDefisitAnggaran = reportData.surplusDefisit?.anggaran || 0;
    const surplusDefisitRealisasi = reportData.surplusDefisit?.realisasi || 0;
    const variansSurplusDefisit = surplusDefisitRealisasi - surplusDefisitAnggaran;

    return {
      totalPenerimaanAnggaran,
      totalPenerimaanRealisasi,
      totalPenerimaanSelisih,
      penerimaanPersen,
      sumberDanaAnggaran,
      sumberDanaRealisasi,
      sumberDanaSelisih,
      pendapatanAnggaran,
      pendapatanRealisasi,
      pendapatanSelisih,
      totalBelanjaAnggaran,
      totalBelanjaRealisasi,
      sisaPaguBelanja,
      serapanPersen,
      parhyanganAnggaran,
      parhyanganRealisasi,
      parhyanganSisa,
      pawonganAnggaran,
      pawonganRealisasi,
      pawonganSisa,
      operasionalAnggaran,
      operasionalRealisasi,
      operasionalSisa,
      palemahanAnggaran,
      palemahanRealisasi,
      palemahanSisa,
      surplusDefisitAnggaran,
      surplusDefisitRealisasi,
      variansSurplusDefisit
    };
  }, [reportData]);

  // Standard Auto-generated Narrative Builder
  const defaultNarrative = useMemo(() => {
    const penerimaanStatus = metrics.totalPenerimaanSelisih >= 0
      ? `surplus sebesar ${formatCurrency(metrics.totalPenerimaanSelisih)} (${metrics.penerimaanPersen.toFixed(1)}% dari pagu)`
      : `kurang ${formatCurrency(Math.abs(metrics.totalPenerimaanSelisih))} dari pagu target (${metrics.penerimaanPersen.toFixed(1)}% tercapai)`;

    const belanjaStatus = metrics.sisaPaguBelanja >= 0
      ? `efisiensi penghematan pagu sebesar ${formatCurrency(metrics.sisaPaguBelanja)} (tingkat serapan belanja ${metrics.serapanPersen.toFixed(1)}%)`
      : `pengeluaran melampaui pagu sebesar ${formatCurrency(Math.abs(metrics.sisaPaguBelanja))} (${metrics.serapanPersen.toFixed(1)}%)`;

    const kasStatus = metrics.surplusDefisitRealisasi >= 0
      ? `surplus kas riil sebesar ${formatCurrency(metrics.surplusDefisitRealisasi)}`
      : `defisit kas riil sebesar ${formatCurrency(Math.abs(metrics.surplusDefisitRealisasi))}`;

    const items: string[] = [];

    // 1. Penerimaan
    items.push(
      `1. Sisi Penerimaan Kas: Total realisasi penerimaan membukukan ${formatCurrency(metrics.totalPenerimaanRealisasi)} dari rencana pagu ${formatCurrency(metrics.totalPenerimaanAnggaran)}, mencatatkan ${penerimaanStatus}. Pendapatan asli desa adat dan punia krama terealisasi sebesar ${formatCurrency(metrics.pendapatanRealisasi)}.`
    );

    // 2. Belanja & Efisiensi per Bidang
    const expenseParts: string[] = [];
    if (metrics.parhyanganAnggaran > 0 || metrics.parhyanganRealisasi > 0) {
      expenseParts.push(`Bidang Parhyangan terealisasi ${formatCurrency(metrics.parhyanganRealisasi)} (sisa pagu ${formatCurrency(metrics.parhyanganSisa)})`);
    }
    if (metrics.pawonganAnggaran > 0 || metrics.pawonganRealisasi > 0) {
      expenseParts.push(`Bidang Pawongan terealisasi ${formatCurrency(metrics.pawonganRealisasi)} (sisa ${formatCurrency(metrics.pawonganSisa)})`);
    }
    if (metrics.operasionalAnggaran > 0 || metrics.operasionalRealisasi > 0) {
      expenseParts.push(`Operasional/Beban Adat terealisasi ${formatCurrency(metrics.operasionalRealisasi)} (sisa ${formatCurrency(metrics.operasionalSisa)})`);
    }
    if (metrics.palemahanAnggaran > 0 || metrics.palemahanRealisasi > 0) {
      expenseParts.push(`Bidang Palemahan terealisasi ${formatCurrency(metrics.palemahanRealisasi)} (sisa ${formatCurrency(metrics.palemahanSisa)})`);
    }

    const expenseBreakdown = expenseParts.length > 0 
      ? ` Rincian serapan per bidang: ${expenseParts.join('; ')}.`
      : '';

    items.push(
      `2. Sisi Belanja Desa Adat: Total realisasi pengeluaran kas mencapai ${formatCurrency(metrics.totalBelanjaRealisasi)} dari alokasi pagu ${formatCurrency(metrics.totalBelanjaAnggaran)}, menghasilkan ${belanjaStatus}.${expenseBreakdown} Seluruh kegiatan upakara dan operasional diselenggarakan secara labda karya dan cermat.`
    );

    // 3. Posisi Akhir & Likuiditas
    items.push(
      `3. Posisi Akhir Kas & Ketahanan Likuiditas: LRA periode ini membukukan ${kasStatus}. Seluruh sisa dana tersimpan aman pada rekening kas/brankas Juru Raksa sebagai SILPA yang sah untuk kesinambungan program yadnya periode berikutnya.`
    );

    return items.join('\n\n');
  }, [metrics]);

  // Narrative text state
  const [narrativeText, setNarrativeText] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [includeInPrint, setIncludeInPrint] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Load saved narrative or fallback to auto
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lra_variance_narrative_${periodKey}`);
      if (saved && saved.trim() !== '') {
        setNarrativeText(saved);
      } else {
        setNarrativeText(defaultNarrative);
      }

      const savedPrint = localStorage.getItem('lra_variance_include_print');
      if (savedPrint !== null) {
        setIncludeInPrint(savedPrint === 'true');
      }
    } catch {
      setNarrativeText(defaultNarrative);
    }
  }, [periodKey, defaultNarrative]);

  const handleSaveNarrative = () => {
    try {
      localStorage.setItem(`lra_variance_narrative_${periodKey}`, narrativeText);
      setIsEditing(false);
      playSaveSuccessSound();
      showNotification('Catatan narasi penjelasan selisih LRA berhasil disimpan!', 'success');
    } catch {
      showNotification('Gagal menyimpan narasi ke penyimpanan lokal.', 'error');
    }
  };

  const handleResetToDefault = () => {
    setNarrativeText(defaultNarrative);
    try {
      localStorage.removeItem(`lra_variance_narrative_${periodKey}`);
    } catch {}
    setIsEditing(false);
    playSaveSuccessSound();
    showNotification('Narasi dikembalikan ke analisis rumus standar.', 'info');
  };

  const handleCopyNarrative = async () => {
    try {
      await navigator.clipboard.writeText(narrativeText);
      setIsCopied(true);
      playSyncSuccessSound();
      showNotification('Narasi penjelasan LRA berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showNotification('Gagal menyalin narasi.', 'error');
    }
  };

  const handleToggleIncludeInPrint = (checked: boolean) => {
    setIncludeInPrint(checked);
    try {
      localStorage.setItem('lra_variance_include_print', checked ? 'true' : 'false');
    } catch {}
  };

  // Generate / Enhance Narrative using Gemini AI
  const handleGenerateAiNarrative = async () => {
    setIsGeneratingAi(true);
    showNotification('Gemini AI sedang menelaah selisih anggaran & menyusun narasi informatif...', 'info');

    try {
      const prompt = `
ANALISIS SELISIH ANGGARAN DAN REALISASI LRA (LAPORAN REALISASI ANGGARAN)
Desa Adat Basangalas, Kec. Abang, Karangasem - Bali
Periode: ${periodLabel} (Tahun: ${selectedYear || 'Semua'})

DATA KEUANGAN & SELISIH:
1. PENERIMAAN DESA ADAT:
- Total Pagu: Rp ${metrics.totalPenerimaanAnggaran.toLocaleString('id-ID')}
- Total Realisasi: Rp ${metrics.totalPenerimaanRealisasi.toLocaleString('id-ID')}
- Selisih (+/-): Rp ${metrics.totalPenerimaanSelisih.toLocaleString('id-ID')} (${metrics.penerimaanPersen.toFixed(1)}% capaian)
- Rincian Sumber Dana: Pagu Rp ${metrics.sumberDanaAnggaran.toLocaleString('id-ID')} | Realisasi Rp ${metrics.sumberDanaRealisasi.toLocaleString('id-ID')}
- Rincian Pendapatan Asli Adat (Punia/Swadaya): Pagu Rp ${metrics.pendapatanAnggaran.toLocaleString('id-ID')} | Realisasi Rp ${metrics.pendapatanRealisasi.toLocaleString('id-ID')}

2. BELANJA DESA ADAT:
- Total Pagu: Rp ${metrics.totalBelanjaAnggaran.toLocaleString('id-ID')}
- Total Realisasi: Rp ${metrics.totalBelanjaRealisasi.toLocaleString('id-ID')}
- Sisa Efisiensi Pagu: Rp ${metrics.sisaPaguBelanja.toLocaleString('id-ID')} (${metrics.serapanPersen.toFixed(1)}% serapan)
- Bidang Parhyangan (Keagamaan/Pura): Pagu Rp ${metrics.parhyanganAnggaran.toLocaleString('id-ID')} | Realisasi Rp ${metrics.parhyanganRealisasi.toLocaleString('id-ID')} | Sisa Rp ${metrics.parhyanganSisa.toLocaleString('id-ID')}
- Bidang Pawongan (Sosial Krama): Pagu Rp ${metrics.pawonganAnggaran.toLocaleString('id-ID')} | Realisasi Rp ${metrics.pawonganRealisasi.toLocaleString('id-ID')} | Sisa Rp ${metrics.pawonganSisa.toLocaleString('id-ID')}
- Bidang Operasional/Beban Adat: Pagu Rp ${metrics.operasionalAnggaran.toLocaleString('id-ID')} | Realisasi Rp ${metrics.operasionalRealisasi.toLocaleString('id-ID')} | Sisa Rp ${metrics.operasionalSisa.toLocaleString('id-ID')}
- Bidang Palemahan: Pagu Rp ${metrics.palemahanAnggaran.toLocaleString('id-ID')} | Realisasi Rp ${metrics.palemahanRealisasi.toLocaleString('id-ID')} | Sisa Rp ${metrics.palemahanSisa.toLocaleString('id-ID')}

3. SURPLUS / (DEFISIT) KAS AKHIR:
- Rencana: Rp ${metrics.surplusDefisitAnggaran.toLocaleString('id-ID')}
- Realisasi Kas Bersih: Rp ${metrics.surplusDefisitRealisasi.toLocaleString('id-ID')}
- Varians: Rp ${metrics.variansSurplusDefisit.toLocaleString('id-ID')}
- Status: ${metrics.surplusDefisitRealisasi >= 0 ? 'Surplus Kas Bersih' : 'Defisit Kas Riil'}

INSTRUKSI:
Buatkan 3 paragraf narasi penjelasan singkat yang elegan, santun, dan sangat mudah dipahami oleh Krama Desa maupun pembaca laporan.
Fokus pada:
1. Penjelasan selisih sisi penerimaan (mengapa capaian punia/transfer terjadi demikian).
2. Penjelasan efisiensi sisa pagu belanja (bahwa penghematan didasari efisiensi tanpa mengurangi kesucian yadnya).
3. Penjelasan posisi akhir surplus/defisit dan kesiapan kas untuk periode berikutnya.

Hindari salam pembuka/penutup panjang, langsung berikan teks narasi 3 poin/paragraf bernomor (1., 2., 3.) siap cetak.
`;

      const result = await generateContentWithFallback({
        prompt,
        systemInstruction: 'Anda adalah akuntan dan penyarikan ahli sistem keuangan desa adat di Bali. Gunakan bahasa Indonesia formal bernada santun dan akuntabel.'
      });

      if (result && result.text) {
        setNarrativeText(result.text.trim());
        try {
          localStorage.setItem(`lra_variance_narrative_${periodKey}`, result.text.trim());
        } catch {}
        playSyncSuccessSound();
        showNotification(`Narasi penjelasan selisih berhasil disempurnakan dengan Gemini AI (${result.modelUsed})!`, 'success');
      }
    } catch (err: any) {
      playErrorSound();
      const msg = err?.message || 'Gagal memanggil Gemini AI.';
      showNotification(`Gagal membuat narasi AI: ${msg}`, 'error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-300 shadow-md p-4 sm:p-5 text-slate-900 transition-all ${
        includeInPrint ? 'lra-narrative-printable' : 'no-print'
      } ${className}`}
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-800 text-white rounded-xl shadow-xs shrink-0">
            <FileText size={18} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <span>Catatan Penjelasan Selisih Anggaran &amp; Realisasi</span>
              <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-300">
                LRA {selectedYear || 'Periode Berjalan'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
              Analisis naratif singkat selisih pagu vs realisasi kas guna memberikan transparansi informatif bagi pembaca laporan.
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS (NO-PRINT) */}
        <div className="flex flex-wrap items-center gap-1.5 no-print">
          <button
            type="button"
            onClick={handleGenerateAiNarrative}
            disabled={isGeneratingAi}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
              isGeneratingAi 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black active:scale-95 border border-amber-600'
            }`}
            title="Sempurnakan narasi penjelasan selisih menggunakan kecerdasan Gemini AI"
          >
            <Sparkles size={13} className={isGeneratingAi ? 'animate-spin text-amber-900' : 'text-slate-950'} />
            <span>{isGeneratingAi ? 'Menyusun Narasi...' : 'AI Sempurnakan'}</span>
          </button>

          {isEditing ? (
            <button
              type="button"
              onClick={handleSaveNarrative}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs active:scale-95"
              title="Simpan Perubahan Teks Narasi"
            >
              <Check size={13} />
              <span>Simpan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors border border-slate-300"
              title="Edit teks narasi penjelasan secara manual"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyNarrative}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors border border-slate-300"
            title="Salin teks narasi ke clipboard"
          >
            {isCopied ? <Check size={12} className="text-teal-600" /> : <Copy size={12} />}
            <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetToDefault}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition-colors border border-slate-300"
            title="Kembalikan narasi ke analisis rumus standar"
          >
            <RotateCcw size={13} />
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition-colors border border-slate-300"
            title={isCollapsed ? 'Buka Tampilan' : 'Tutup Tampilan'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* QUICK VARIANCE HIGHLIGHT CARDS (3 METRIC CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4 text-xs">
            {/* 1. Sisi Penerimaan */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Coins size={13} className="text-teal-700" />
                  Selisih Penerimaan
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  metrics.totalPenerimaanSelisih >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {metrics.totalPenerimaanSelisih >= 0 ? 'Surplus' : 'Defisit Pagu'}
                </span>
              </div>
              <p className={`text-sm sm:text-base font-black ${
                metrics.totalPenerimaanSelisih >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {metrics.totalPenerimaanSelisih > 0 ? `+${formatCurrency(metrics.totalPenerimaanSelisih)}` : formatCurrency(metrics.totalPenerimaanSelisih)}
              </p>
              <div className="text-[10px] text-slate-500 flex justify-between items-center mt-1 pt-1 border-t border-slate-200">
                <span>Capaian: <strong className="text-slate-800">{metrics.penerimaanPersen.toFixed(1)}%</strong></span>
                <span>Pagu: {formatCurrency(metrics.totalPenerimaanAnggaran)}</span>
              </div>
            </div>

            {/* 2. Sisi Belanja & Sisa Pagu */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Wallet size={13} className="text-indigo-700" />
                  Efisiensi Belanja (Sisa Pagu)
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  metrics.sisaPaguBelanja >= 0 ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {metrics.sisaPaguBelanja >= 0 ? 'Hemat' : 'Overbudget'}
                </span>
              </div>
              <p className={`text-sm sm:text-base font-black ${
                metrics.sisaPaguBelanja >= 0 ? 'text-teal-800' : 'text-rose-700'
              }`}>
                {metrics.sisaPaguBelanja >= 0 ? `+${formatCurrency(metrics.sisaPaguBelanja)}` : formatCurrency(metrics.sisaPaguBelanja)}
              </p>
              <div className="text-[10px] text-slate-500 flex justify-between items-center mt-1 pt-1 border-t border-slate-200">
                <span>Serapan: <strong className="text-slate-800">{metrics.serapanPersen.toFixed(1)}%</strong></span>
                <span>Realisasi: {formatCurrency(metrics.totalBelanjaRealisasi)}</span>
              </div>
            </div>

            {/* 3. Posisi Kas Akhir */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Scale size={13} className="text-emerald-700" />
                  Posisi Kas Bersih
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  metrics.surplusDefisitRealisasi >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {metrics.surplusDefisitRealisasi >= 0 ? 'SURPLUS' : 'DEFISIT'}
                </span>
              </div>
              <p className={`text-sm sm:text-base font-black ${
                metrics.surplusDefisitRealisasi >= 0 ? 'text-emerald-800' : 'text-rose-700'
              }`}>
                {formatCurrency(metrics.surplusDefisitRealisasi)}
              </p>
              <div className="text-[10px] text-slate-500 flex justify-between items-center mt-1 pt-1 border-t border-slate-200">
                <span>Varians: <strong className="text-slate-800">{metrics.variansSurplusDefisit >= 0 ? `+${formatCurrency(metrics.variansSurplusDefisit)}` : formatCurrency(metrics.variansSurplusDefisit)}</strong></span>
                <span>Status Kas: {metrics.surplusDefisitRealisasi >= 0 ? 'Likuid' : 'Perlu Cadangan'}</span>
              </div>
            </div>
          </div>

          {/* MAIN NARRATIVE CONTENT AREA */}
          <div className="space-y-3">
            {isEditing ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Edit Teks Narasi Penjelasan Selisih:</span>
                  <span className="text-[10px] text-slate-400 normal-case">Dapat disesuaikan dengan keterangan lokal</span>
                </label>
                <textarea
                  value={narrativeText}
                  onChange={(e) => setNarrativeText(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs leading-relaxed text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-sans"
                  placeholder="Ketik narasi penjelasan selisih di sini..."
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNarrative}
                    className="px-4 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3 sm:p-4 text-xs leading-relaxed text-slate-800 space-y-2.5 print:bg-white print:border-slate-400 print:text-black">
                {narrativeText.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-justify font-sans leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {/* PRINT & AUDIT FOOTNOTE (NO-PRINT TOGGLE) */}
            <div className="no-print pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 text-[11px] text-slate-500">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInPrint}
                  onChange={(e) => handleToggleIncludeInPrint(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-500 h-3.5 w-3.5"
                />
                <span className="font-semibold text-slate-700">
                  Sertakan bagian Catatan Penjelasan ini saat mencetak dokumen LRA / Ekspor PDF
                </span>
              </label>

              <span className="font-mono text-[10px] text-slate-400">
                Pembaruan Terakhir: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
