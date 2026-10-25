import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  Loader2, 
  X, 
  Maximize2, 
  Minimize2, 
  ShieldCheck,
  Building2
} from 'lucide-react';
import type { MonthlyData } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { exportElementToPdf } from '../../utils/pdfExport';
import { 
  DigitalSignatures, 
  SignatureSettings, 
  getStoredSignatures, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  getSignatureScale, 
  getStampScale 
} from '../../utils/signatureStorage';

export interface MatrixSummaryPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrixYear: number | 'all';
  monthlyData: MonthlyData[];
  totalPenerimaan: number;
  totalRealisasi: number;
  surplusDefisit: number;
  silpaTahunLalu: number;
  saldoAkhir: number;
  signatures?: DigitalSignatures;
  signatureSettings?: SignatureSettings;
}

export const MatrixSummaryPrintModal: React.FC<MatrixSummaryPrintModalProps> = ({
  isOpen,
  onClose,
  matrixYear,
  monthlyData = [],
  totalPenerimaan,
  totalRealisasi,
  surplusDefisit,
  silpaTahunLalu,
  saldoAkhir,
  signatures = {} as DigitalSignatures,
  signatureSettings
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Status Otomatisasi Tanda Tangan & Stempel Resmi
  const [signaturesState, setSignaturesState] = useState<DigitalSignatures>(() => {
    if (signatures && Object.keys(signatures).length > 0) return signatures;
    return getStoredSignatures();
  });
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => {
    if (signatureSettings && typeof signatureSettings.autoEmbed === 'boolean') {
      return signatureSettings.autoEmbed;
    }
    return isAutoEmbedSignaturesEnabled();
  });
  const [showStamp, setShowStamp] = useState<boolean>(() => {
    if (signatureSettings && typeof signatureSettings.showStampOverlay === 'boolean') {
      return signatureSettings.showStampOverlay;
    }
    return isStampOverlayEnabled();
  });
  const [sigScale, setSigScale] = useState<number>(() => getSignatureScale());
  const [stampScaleVal, setStampScaleVal] = useState<number>(() => getStampScale());

  // Sinkronisasi otomatis saat ada pembaruan tanda tangan / stempel dari Pengaturan atau modul lain
  useEffect(() => {
    const handleSigsChanged = () => {
      setSignaturesState(getStoredSignatures());
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
      setSigScale(getSignatureScale());
      setStampScaleVal(getStampScale());
    };

    window.addEventListener('signatures-updated', handleSigsChanged);
    return () => window.removeEventListener('signatures-updated', handleSigsChanged);
  }, []);

  useEffect(() => {
    if (signatures && Object.keys(signatures).length > 0) {
      setSignaturesState(signatures);
    }
  }, [signatures]);

  useEffect(() => {
    if (signatureSettings) {
      if (typeof signatureSettings.autoEmbed === 'boolean') {
        setEmbedSignatures(signatureSettings.autoEmbed);
      }
      if (typeof signatureSettings.showStampOverlay === 'boolean') {
        setShowStamp(signatureSettings.showStampOverlay);
      }
    }
  }, [signatureSettings]);

  // Ambil profil desa dari localStorage
  const villageProfile = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        namaDesa: 'DESA ADAT BASANGALAS',
        alamat: 'Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852',
        namaKetua: 'I Made Mudita',
        namaBendahara: 'I Putu Gede Sutrana',
        namaSekretaris: ''
      };
    }
    const saved = localStorage.getItem('basangalas_profile') || localStorage.getItem('village_profile') || localStorage.getItem('tigalikur_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          namaDesa: parsed.namaDesa || 'DESA ADAT BASANGALAS',
          alamat: parsed.alamat || 'Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852',
          namaKetua: parsed.namaKetua || 'I Made Mudita',
          namaBendahara: parsed.namaBendahara || 'I Putu Gede Sutrana',
          namaSekretaris: parsed.namaSekretaris || ''
        };
      } catch (e) {
        console.error('Error parsing village profile:', e);
      }
    }
    return {
      namaDesa: 'DESA ADAT BASANGALAS',
      alamat: 'Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852',
      namaKetua: 'I Made Mudita',
      namaBendahara: 'I Putu Gede Sutrana',
      namaSekretaris: ''
    };
  }, []);

  // Handler cleanup setelah cetak
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-matrix-modal-mode');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-matrix-modal-mode');
    };
  }, []);

  // Cetak ke Printer / Kertas Fisik (atau Save as PDF sistem)
  const handlePrintToPaper = () => {
    document.body.classList.add('print-matrix-modal-mode');
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Unduh Berkas PDF Resmi
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    const yearLabel = matrixYear === 'all' ? 'Semua_Tahun' : `TA_${matrixYear}`;
    const filename = `Matriks_Realisasi_Finansial_Bulanan_${yearLabel}.pdf`;

    try {
      await exportElementToPdf('printable-matrix-modal-doc', {
        filename,
        orientation: 'landscape',
        format: 'a4',
        margin: [6, 6, 6, 6],
        scale: 2.5,
        enableWatermark: true,
        watermarkText: villageProfile.namaDesa || 'Desa Adat Basangalas'
      });
    } catch (err) {
      console.error('Failed to export matrix PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const effectiveStamp = useMemo(() => {
    return getEffectiveStamp(signaturesState, villageProfile.namaDesa);
  }, [signaturesState, villageProfile.namaDesa]);

  const scaleRatio = Math.max(0.5, Math.min(1.8, sigScale / 100));
  const stampRatio = Math.max(0.5, Math.min(1.8, stampScaleVal / 100));
  const sigImgHeight = Math.round(52 * scaleRatio);
  const sigImgMaxWidth = Math.round(135 * scaleRatio);
  const stampBoxSize = Math.round(76 * stampRatio);

  if (!isOpen) return null;

  const periodeLabel = matrixYear === 'all' ? 'Semua Tahun (Komulatif)' : `Tahun Anggaran ${matrixYear}`;
  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const serapanRate = totalPenerimaan > 0 ? (totalRealisasi / totalPenerimaan) * 100 : 0;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[99999] flex justify-center items-center p-2 sm:p-4 print:p-0 print:bg-transparent print:static print:block print:z-auto overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full border border-slate-300 flex flex-col my-auto max-h-[94vh] print:max-h-none print:m-0 print:border-none print:shadow-none print:w-full print:rounded-none transition-all duration-200 ${
          isFullscreen ? '!max-w-[98vw] !h-[96vh]' : 'max-w-5xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal & Tombol Aksi */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6 border-b border-slate-200 bg-slate-50 rounded-t-2xl no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 font-serif">
                Cetak Ringkasan Matriks Finansial Bulanan
              </h3>
              <p className="text-xs text-slate-600">
                Format resmi siap cetak ke kertas printer atau simpan ke dokumen PDF ({periodeLabel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Otomatisasi Tanda Tangan & Stempel Resmi */}
            <div 
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs"
              title="Status Otomatisasi Tanda Tangan & Stempel Resmi (Dikelola otomatis sesuai Pengaturan Sistem)"
            >
              <ShieldCheck size={14} className="text-teal-600" />
              <span className={embedSignatures ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                TTD: {embedSignatures ? 'ON' : 'OFF'}
              </span>
              <span className="text-slate-300">•</span>
              <span className={showStamp ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                Stempel: {showStamp ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Tombol Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors hidden sm:flex items-center justify-center cursor-pointer"
              title={isFullscreen ? 'Kembalikan Ukuran Normal' : 'Buka Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Tombol Unduh PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Unduh visualisasi matriks langsung ke berkas PDF"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Memproses PDF...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Tombol Cetak Kertas / Printer */}
            <button
              type="button"
              onClick={handlePrintToPaper}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Buka dialog printer untuk mencetak ke kertas fisik atau Print to PDF"
            >
              <Printer size={14} />
              <span>Cetak Kertas / Printer</span>
            </button>

            {/* Tombol Tutup */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors ml-1 cursor-pointer"
              title="Tutup jendela pratinjau"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Konten Dokumen Resmi Siap Cetak */}
        <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-100/50 print:bg-white print:p-0 print:overflow-visible">
          <div 
            id="printable-matrix-modal-doc"
            className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 max-w-4xl mx-auto"
          >
            {/* KOP RESMI DOKUMEN DESA ADAT */}
            <div className="border-b-4 border-double border-slate-900 pb-4 mb-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="p-2 bg-slate-100 border border-slate-400 rounded-lg text-slate-800 print:border-slate-800">
                  <Building2 size={24} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-serif font-black tracking-wider uppercase text-slate-950 m-0">
                    {villageProfile.namaDesa}
                  </h1>
                  <p className="text-xs sm:text-sm font-serif font-bold text-slate-800 uppercase tracking-widest m-0">
                    KECAMATAN ABANG, KABUPATEN KARANGASEM - BALI
                  </p>
                </div>
              </div>
              <p className="text-[11px] font-sans text-slate-600 italic mt-1">
                {villageProfile.alamat}
              </p>
            </div>

            {/* JUDUL DOKUMEN */}
            <div className="text-center mb-6">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-950 font-serif underline decoration-2 underline-offset-4">
                MATRIKS REKAPITULASI REALISASI FINANSIAL BULANAN
              </h2>
              <p className="text-xs font-mono font-bold text-slate-700 mt-1 uppercase">
                Periode: {periodeLabel}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-600 mt-2">
                <span>Tanggal Cetak: <strong>{currentDateFormatted}</strong></span>
                <span>•</span>
                <span>Jumlah Periode: <strong>{monthlyData.length} Bulan</strong></span>
                <span>•</span>
                <span>Status Fiskal: <strong className={surplusDefisit >= 0 ? 'text-emerald-800' : 'text-rose-800'}>{surplusDefisit >= 0 ? 'Surplus Operasional' : 'Defisit Operasional'}</strong></span>
              </div>
            </div>

            {/* 4 KARTU RINGKASAN METRIK (KPI) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {/* Total Penerimaan */}
              <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/70 print:bg-white print:border-slate-400">
                <span className="text-[10px] font-bold uppercase text-emerald-900 tracking-wider block">
                  Total Penerimaan
                </span>
                <p className="text-sm sm:text-base font-black font-mono text-emerald-900 mt-0.5">
                  {formatCurrency(totalPenerimaan)}
                </p>
                <span className="text-[9px] text-emerald-800 font-sans">
                  Penerimaan Kas &amp; Punia
                </span>
              </div>

              {/* Total Belanja */}
              <div className="p-3 rounded-xl border border-rose-300 bg-rose-50/70 print:bg-white print:border-slate-400">
                <span className="text-[10px] font-bold uppercase text-rose-900 tracking-wider block">
                  Total Realisasi Belanja
                </span>
                <p className="text-sm sm:text-base font-black font-mono text-rose-900 mt-0.5">
                  {formatCurrency(totalRealisasi)}
                </p>
                <span className="text-[9px] text-rose-800 font-sans">
                  Beban Belanja Operasional
                </span>
              </div>

              {/* Net Surplus / Defisit */}
              <div className={`p-3 rounded-xl border print:bg-white print:border-slate-400 ${
                surplusDefisit >= 0 ? 'border-teal-300 bg-teal-50/70' : 'border-amber-300 bg-amber-50/70'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                  surplusDefisit >= 0 ? 'text-teal-900' : 'text-amber-900'
                }`}>
                  Surplus / (Defisit)
                </span>
                <p className={`text-sm sm:text-base font-black font-mono mt-0.5 ${
                  surplusDefisit >= 0 ? 'text-teal-950' : 'text-rose-950'
                }`}>
                  {surplusDefisit >= 0 ? `+${formatCurrency(surplusDefisit)}` : formatCurrency(surplusDefisit)}
                </p>
                <span className="text-[9px] text-slate-700 font-sans">
                  Selisih Bersih Berjalan
                </span>
              </div>

              {/* Saldo Kas Akhir */}
              <div className="p-3 rounded-xl border border-sky-300 bg-sky-50/70 print:bg-white print:border-slate-400">
                <span className="text-[10px] font-bold uppercase text-sky-900 tracking-wider block">
                  {matrixYear === 'all' ? 'Kas Netto' : 'Saldo Akhir Kas'}
                </span>
                <p className="text-sm sm:text-base font-black font-mono text-sky-950 mt-0.5">
                  {formatCurrency(saldoAkhir)}
                </p>
                <span className="text-[9px] text-sky-800 font-sans">
                  {matrixYear === 'all' ? 'Akumulasi Kas' : 'Termasuk SiLPA Lalu'}
                </span>
              </div>
            </div>

            {/* TABEL MATRIKS BULANAN UTAMA */}
            <div className="overflow-x-auto mb-6">
              <table className="matrix-print-table w-full text-left text-xs border border-slate-400 border-collapse print:text-[10px]">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-400 text-slate-900 font-black uppercase text-[10px] tracking-wider print:bg-slate-100">
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center w-10">No</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Bulan / Periode</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-right">Penerimaan Kas (Rp)</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-right">Realisasi Belanja (Rp)</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-right">Surplus / (Defisit) (Rp)</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center">Serapan</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {monthlyData.map((m, idx) => {
                    const diff = m.penerimaan - m.realisasi;
                    const monthlyRate = m.penerimaan > 0 ? (m.realisasi / m.penerimaan) * 100 : 0;
                    return (
                      <tr 
                        key={idx} 
                        className={idx % 2 === 1 ? 'bg-slate-50/80 print:bg-slate-50' : 'bg-white'}
                      >
                        <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-300 font-bold text-slate-900 font-mono">
                          {m.name}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-300 text-right font-mono text-emerald-900 font-semibold">
                          {formatCurrency(m.penerimaan)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-300 text-right font-mono text-rose-900 font-semibold">
                          {formatCurrency(m.realisasi)}
                        </td>
                        <td className={`py-2 px-3 border-r border-slate-300 text-right font-mono font-black ${
                          diff >= 0 ? 'text-teal-900' : 'text-rose-900'
                        }`}>
                          {diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-300 text-center font-mono text-[10px] text-slate-700">
                          {monthlyRate.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase print:border print:border-slate-400 ${
                            diff >= 0 
                              ? 'bg-teal-100 text-teal-950 border border-teal-300' 
                              : 'bg-rose-100 text-rose-950 border border-rose-300'
                          }`}>
                            {diff >= 0 ? 'Surplus' : 'Defisit'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* BARIS TOTAL KOMULATIF */}
                  <tr className="bg-slate-200 border-t-2 border-slate-500 font-black text-slate-950 font-mono text-xs print:bg-slate-200">
                    <td colSpan={2} className="py-2.5 px-3 border-r border-slate-400 uppercase tracking-wider">
                      TOTAL KOMULATIF
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-400 text-right text-emerald-950 font-black">
                      {formatCurrency(totalPenerimaan)}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-400 text-right text-rose-950 font-black">
                      {formatCurrency(totalRealisasi)}
                    </td>
                    <td className={`py-2.5 px-3 border-r border-slate-400 text-right font-black ${
                      surplusDefisit >= 0 ? 'text-teal-950' : 'text-rose-950'
                    }`}>
                      {surplusDefisit >= 0 ? `+${formatCurrency(surplusDefisit)}` : formatCurrency(surplusDefisit)}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-400 text-center font-black">
                      {serapanRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        surplusDefisit >= 0 ? 'bg-teal-700 text-white' : 'bg-rose-700 text-white'
                      }`}>
                        {surplusDefisit >= 0 ? 'Surplus' : 'Defisit'}
                      </span>
                    </td>
                  </tr>

                  {/* BARIS SILPA & SALDO AKHIR (Hanya untuk tahun spesifik) */}
                  {matrixYear !== 'all' && (
                    <>
                      <tr className="bg-amber-50 border-t border-amber-300 font-mono text-xs print:bg-amber-50">
                        <td colSpan={2} className="py-2.5 px-3 border-r border-slate-400 font-black text-amber-950 uppercase">
                          SILPA TAHUN LALU
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-right font-black text-amber-950">
                          {formatCurrency(silpaTahunLalu)}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-center text-slate-400">-</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[9px] font-black uppercase">
                            SiLPA
                          </span>
                        </td>
                      </tr>

                      <tr className="bg-teal-100 border-t-2 border-teal-600 font-black text-slate-950 font-mono text-xs print:bg-teal-50">
                        <td colSpan={2} className="py-2.5 px-3 border-r border-slate-400 font-black text-teal-950 uppercase">
                          SALDO AKHIR KAS (KOMULATIF)
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-right font-black text-teal-950 text-sm">
                          {formatCurrency(saldoAkhir)}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-400 text-center text-slate-400">-</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-teal-800 text-white text-[9px] font-black uppercase">
                            Saldo Kas
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>

            {/* IKHTISAR DAN CATATAN EVALUASI */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-xs text-slate-800 mb-6 print:bg-transparent print:border-slate-400">
              <div className="flex items-start gap-2">
                <span className="font-black uppercase text-[11px] text-slate-900 font-mono shrink-0">
                  Catatan Evaluasi:
                </span>
                <p className="m-0 leading-relaxed text-[11px]">
                  Berdasarkan matriks realisasi berjalan {periodeLabel}, total penerimaan operasional terealisasi sebesar <strong>{formatCurrency(totalPenerimaan)}</strong> dengan penyerapan belanja sebesar <strong>{formatCurrency(totalRealisasi)}</strong> (rasio serapan <strong>{serapanRate.toFixed(1)}%</strong>). Posisi buku kas mencatatkan <strong>{surplusDefisit >= 0 ? 'Surplus' : 'Defisit'}</strong> sebesar <strong>{formatCurrency(Math.abs(surplusDefisit))}</strong> dengan saldo akhir kas bersih <strong>{formatCurrency(saldoAkhir)}</strong>.
                </p>
              </div>
            </div>

            {/* LEMBAR PENGESAHAN TANDA TANGAN RESMI */}
            <div className="pt-3 border-t border-slate-300 text-xs text-slate-900">
              <div className="text-right text-[11px] font-serif mb-4">
                <span>Basangalas, {currentDateFormatted}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                {/* 1. Keliang / Bendesa Adat */}
                <div className="flex flex-col items-center justify-between min-h-[140px]">
                  <div>
                    <p className="font-serif font-bold text-xs">Mengetahui &amp; Menyetujui,</p>
                    <p className="font-serif text-[11px] text-slate-700">Bendesa Adat Basangalas</p>
                  </div>

                  <div className="relative my-1 flex items-center justify-center h-16 w-36">
                    {/* Tanda Tangan Digital Otomatis saat ON */}
                    {embedSignatures && signaturesState?.keliang ? (
                      <img 
                        src={signaturesState.keliang} 
                        alt="TTD Bendesa" 
                        style={{ maxHeight: `${sigImgHeight}px`, maxWidth: `${sigImgMaxWidth}px` }}
                        className="object-contain relative z-10 mx-auto"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 italic print:hidden">( Tanda Tangan )</div>
                    )}

                    {/* Stempel Resmi Desa Otomatis saat ON */}
                    {showStamp && (
                      <img 
                        src={effectiveStamp} 
                        alt="Stempel Desa" 
                        style={{ 
                          width: `${stampBoxSize}px`, 
                          height: `${stampBoxSize}px`,
                          transform: 'translate(-65%, -50%) rotate(-4deg)'
                        }}
                        className="stamp-overlay absolute pointer-events-none select-none left-1/2 top-1/2 opacity-88 mix-blend-multiply z-20" 
                      />
                    )}
                  </div>

                  <div>
                    <p className="font-bold underline text-xs uppercase font-serif">
                      {villageProfile.namaKetua || 'I Made Mudita'}
                    </p>
                    <p className="text-[10px] text-slate-500">Bendesa Adat</p>
                  </div>
                </div>

                {/* 2. Petengen / Bendahara Adat */}
                <div className="flex flex-col items-center justify-between min-h-[140px]">
                  <div>
                    <p className="font-serif font-bold text-xs">Diverifikasi Oleh,</p>
                    <p className="font-serif text-[11px] text-slate-700">Petengen / Bendahara Adat</p>
                  </div>

                  <div className="relative my-1 flex items-center justify-center h-16 w-36">
                    {embedSignatures && signaturesState?.juruRaksa ? (
                      <img 
                        src={signaturesState.juruRaksa} 
                        alt="TTD Petengen" 
                        style={{ maxHeight: `${sigImgHeight}px`, maxWidth: `${sigImgMaxWidth}px` }}
                        className="object-contain relative z-10 mx-auto"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 italic print:hidden">( Tanda Tangan )</div>
                    )}
                  </div>

                  <div>
                    <p className="font-bold underline text-xs uppercase font-serif">
                      {villageProfile.namaBendahara || 'I Putu Gede Sutrana'}
                    </p>
                    <p className="text-[10px] text-slate-500">Petengen Desa Adat</p>
                  </div>
                </div>

                {/* 3. Penyarikan / Sekretaris Adat */}
                <div className="flex flex-col items-center justify-between min-h-[140px]">
                  <div>
                    <p className="font-serif font-bold text-xs">Dicatat &amp; Disusun Oleh,</p>
                    <p className="font-serif text-[11px] text-slate-700">Penyarikan / Sekretaris</p>
                  </div>

                  <div className="relative my-1 flex items-center justify-center h-16 w-36">
                    {embedSignatures && signaturesState?.pembuat ? (
                      <img 
                        src={signaturesState.pembuat} 
                        alt="TTD Penyarikan" 
                        style={{ maxHeight: `${sigImgHeight}px`, maxWidth: `${sigImgMaxWidth}px` }}
                        className="object-contain relative z-10 mx-auto"
                      />
                    ) : (
                      <div className="text-[10px] text-slate-400 italic print:hidden">( Tanda Tangan )</div>
                    )}
                  </div>

                  <div>
                    <p className="font-bold underline text-xs uppercase font-serif">
                      {villageProfile.namaSekretaris || 'Penyarikan Desa Adat'}
                    </p>
                    <p className="text-[10px] text-slate-500">Penyarikan Desa Adat</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STYLES KHUSUS PRINT A4 LANDSCAPE */}
        <style>{`
          @media print {
            body.print-matrix-modal-mode * {
              visibility: hidden;
            }
            body.print-matrix-modal-mode #printable-matrix-modal-doc,
            body.print-matrix-modal-mode #printable-matrix-modal-doc * {
              visibility: visible;
            }
            body.print-matrix-modal-mode #printable-matrix-modal-doc {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 6mm 8mm !important;
              margin: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              box-shadow: none !important;
              border: none !important;
            }
            /* Row Total Komulatif hanya ditampilkan paling bawah tabel di atas signature saat tabel melebihi satu halaman cetak */
            body.print-matrix-modal-mode #printable-matrix-modal-doc table tfoot,
            body.print-matrix-modal-mode .matrix-print-table tfoot,
            #printable-matrix-modal-doc tfoot {
              display: table-row-group !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            body.print-matrix-modal-mode #printable-matrix-modal-doc table tfoot tr,
            body.print-matrix-modal-mode .matrix-print-table tfoot tr,
            #printable-matrix-modal-doc tfoot tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            body.print-matrix-modal-mode .no-print {
              display: none !important;
            }
            @page {
              size: A4 landscape;
              margin: 6mm 8mm;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default MatrixSummaryPrintModal;
