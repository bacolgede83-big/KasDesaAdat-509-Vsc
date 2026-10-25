import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatLongDate, numberToWords } from '../../utils/formatter';
import { 
  FileText, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  Building2, 
  Landmark, 
  Coins, 
  X, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { 
  getStoredSignatures, 
  getSignatureSettings, 
  isAutoEmbedSignaturesEnabled,
  isStampOverlayEnabled,
  getEffectiveStamp, 
  type DigitalSignatures, 
  type SignatureSettings 
} from '../../utils/signatureStorage';
import { exportElementToPdf } from '../../utils/pdfExport';

export interface FormulirNaratifKalkulasiProps {
  financialReport: {
    totalJuruRaksaTunai: number;
    kasJuruRaksaTunai: { code: string; name: string; saldo: number };
    totalAsetLPD: number;
    totalAsetKas: number;
    totalAsetAktif?: number;
    totalAsetKasBank?: number;
    totalKasBank?: number;
    totalAsetPiutang?: number;
    totalPiutangDesaAdat?: number;
    totalAset: number;
    totalKewajiban: number;
    totalEkuitas: number;
    totalPasiva: number;
    surplusDefisit: number;
    manualSurplusBalance: number;
    asetPada?: Array<{ code: string; name: string; saldo: number }>;
    asetPiutang?: Array<{ code: string; name: string; saldo: number }>;
    asetTempekan?: Array<{ code: string; name: string; saldo: number }>;
    asetLainnya?: Array<{ code: string; name: string; saldo: number }>;
    totalAsetLainnya?: number;
    kasTempekan?: { code: string; name: string; saldo: number };
    kasDPD?: { code: string; name: string; saldo: number };
    kasKarya18?: { code: string; name: string; saldo: number };
    kasDanaKematian?: { code: string; name: string; saldo: number };
    totalkasAdat2?: number;
    totalKasAdat2?: number;
    totalAsetTempekan?: number;
    totalKasDPD?: number;
    totalKasKarya18?: number;
    totalKasDanaKematian?: number;
    kewajiban?: Array<{ code: string; name: string; saldo: number }>;
    ekuitas?: Array<{ code: string; name: string; saldo: number }>;
  };
  reportDate: string;
  customPlace: string;
  signatureDate: string;
  keliangName: string;
  juruRaksaName: string;
  isBalanced: boolean;
  initialOpen?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  hideTriggerCard?: boolean;
}

interface DocumentBodyProps {
  financialReport: FormulirNaratifKalkulasiProps['financialReport'];
  formattedReportDate: string;
  formattedSigDate: string;
  customPlace: string;
  keliangName: string;
  juruRaksaName: string;
  isBalanced: boolean;
  totalHutangAbs: number;
  netAsset: number;
  totalKasBank: number;
  totalAsetTempekan: number;
  totalKasDPD: number;
  totalKasKarya18: number;
  totalKasDanaKematian: number;
  totalAsetLainnya: number;
  totalAsetKasBank: number;
  totalAsetPiutang: number;
  totalAsetAktif: number;
  getTerbilang: (val: number) => string;
  signatures: DigitalSignatures;
  effectiveStamp: string;
  embedSignatures: boolean;
  showStamp: boolean;
  sigSettings?: SignatureSettings;
  isPrint?: boolean;
}

/**
 * Komponen dokumen kanvas naratif (Dipakai bersama oleh Modal View dan Print Output)
 * Menjamin hasil print 100% sama persis dengan modal layar penuh.
 */
const FormulirNaratifDocumentContent: React.FC<DocumentBodyProps> = ({
  financialReport,
  formattedReportDate,
  formattedSigDate,
  customPlace,
  keliangName,
  juruRaksaName,
  isBalanced,
  totalHutangAbs,
  netAsset,
  totalKasBank,
  totalAsetTempekan,
  totalKasDPD,
  totalKasKarya18,
  totalKasDanaKematian,
  totalAsetLainnya,
  totalAsetKasBank,
  totalAsetPiutang,
  totalAsetAktif,
  getTerbilang,
  signatures,
  effectiveStamp,
  embedSignatures,
  showStamp,
  sigSettings: propSigSettings,
  isPrint = false
}) => {
  const sigSettings = propSigSettings || getSignatureSettings();
  return (
    <div className="space-y-6 sm:space-y-7 font-serif text-slate-900">
      {/* 1. KOP SURAT RESMI DESA ADAT BASANGALAS */}
      <div className="text-center border-b-4 border-double border-slate-900 pb-4">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1.5">
          <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-800 shrink-0" />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-widest text-slate-950 font-serif m-0">
            DESA ADAT BASANGALAS
          </h2>
        </div>
        <p className="text-xs sm:text-base font-bold text-slate-800 uppercase tracking-wider my-0.5">
          Tata Kelola Keuangan Desa Adat
        </p>
        <p className="text-[11px] sm:text-xs text-slate-600 italic">
          Jln. Raya Basangalas, Tribuana, Abang, Karangasem - Bali
        </p>
      </div>

      {/* 2. JUDUL DOKUMEN & PERIODE */}
      <div className="text-center space-y-1.5 py-1">
        <h3 className="text-base sm:text-lg md:text-xl font-black uppercase tracking-wider text-slate-950 underline decoration-2 underline-offset-4">
          FORMULIR KALKULASI KAS &amp; POSISI NERACA
        </h3>
        <p className="text-xs sm:text-sm font-mono font-bold text-emerald-800">
          Posisi Per Tanggal: {formattedReportDate}
        </p>
      </div>

      {/* 3. PARAGRAF PEMBUKA */}
      <p className="leading-relaxed text-slate-800 text-justify">
        Berdasarkan hasil pembukuan Buku Kas Umum (BKU), mutasi penerimaan, dan Jurnal Umum Desa Adat Basangalas sampai dengan tanggal <strong>{formattedReportDate}</strong>, berikut disajikan uraian penjelasan yang mendasari hasil kalkulasi kas fisik, saldo simpanan bank, akumulasi dana hibah, Piutang yang belum diterima, dan posisi keseimbangan neraca keuangan desa:
      </p>

      {/* 4. POIN-POIN NARATIF TERPERINCI DALAM KARTU ELEGAN */}
      <div className="space-y-4 text-slate-800">
        {/* Poin 1: Kas Tunai Juru Raksa */}
        <div 
          className="p-4 sm:p-5 bg-emerald-50/90 rounded-xl border-l-4 border-emerald-600 border border-emerald-200 shadow-xs print:shadow-none break-inside-avoid"
          style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderLeftColor: '#059669', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="flex items-center gap-2.5 font-bold text-slate-950 mb-1.5">
            <Coins size={18} className="text-emerald-700 shrink-0" />
            <span className="uppercase text-xs sm:text-sm tracking-wide">1. Total Kas Tunai yang Dikelola Juru Raksa</span>
          </div>
          <p className="leading-relaxed pl-6 sm:pl-7 text-justify">
            Jumlah fisik uang tunai yang berada dalam penguasaan dan pengelolaan langsung Juru Raksa tercatat sebesar{' '}
            <strong className="font-mono text-emerald-950 font-black">{formatCurrency(financialReport.totalJuruRaksaTunai)}</strong>{' '}
            (<em>{getTerbilang(financialReport.totalJuruRaksaTunai)}</em>). Posisi kas tunai ini bersumber dari:
          </p>
          <div 
            className="pl-6 sm:pl-9 mt-2.5 space-y-1.5 text-slate-700 bg-white/90 p-3 rounded-lg border border-emerald-200/80"
            style={{ backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-emerald-100">
              <span>• <strong>Kas Tunai Operasional Adat (1.1.1.02):</strong></span>
              <span className="font-mono font-bold text-slate-950">{formatCurrency(financialReport.kasJuruRaksaTunai?.saldo || 0)}</span>
            </div>
          </div>
        </div>

        {/* Poin 2: Kas Tersimpan Bank / LPD */}
        <div 
          className="p-4 sm:p-5 bg-blue-50/90 rounded-xl border-l-4 border-blue-600 border border-blue-200 shadow-xs print:shadow-none break-inside-avoid"
          style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderLeftColor: '#2563eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="flex items-center gap-2.5 font-bold text-slate-950 mb-1.5">
            <Landmark size={18} className="text-blue-700 shrink-0" />
            <span className="uppercase text-xs sm:text-sm tracking-wide">2. Total Kas Tersimpan pada Rekening Bank / LPD</span>
          </div>
          <p className="leading-relaxed pl-6 sm:pl-7 text-justify">
            Saldo kas desa yang tersimpan aman di rekening lembaga keuangan / LPD adalah sebesar{' '}
            <strong className="font-mono text-blue-950 font-black">{formatCurrency(financialReport.totalAsetLPD)}</strong>{' '}
            (<em>{getTerbilang(financialReport.totalAsetLPD)}</em>).
          </p>
          <div 
            className="pl-6 sm:pl-9 mt-2.5 space-y-1.5 text-slate-700 bg-white/90 p-3 rounded-lg border border-blue-200/80"
            style={{ backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-blue-100">
              <span>• <strong>Kas Desa Adat (1.1.1.01):</strong></span>
              <span className="font-mono font-bold text-slate-950">{formatCurrency(totalKasBank)}</span>
            </div>
            {totalAsetTempekan > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-blue-100">
                <span>• <strong>Kas Tempekan (1.1.2.07):</strong></span>
                <span className="font-mono font-bold text-slate-950">{formatCurrency(totalAsetTempekan)}</span>
              </div>
            )}
            {totalKasDPD > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-blue-100">
                <span>• <strong>Kas Dana Pembangunan Desa (1.1.2.06):</strong></span>
                <span className="font-mono font-bold text-slate-950">{formatCurrency(totalKasDPD)}</span>
              </div>
            )}
            {totalKasKarya18 > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-blue-100">
                <span>• <strong>Kas Saldo Karya-18 (1.1.2.01):</strong></span>
                <span className="font-mono font-bold text-slate-950">{formatCurrency(totalKasKarya18)}</span>
              </div>
            )}
            {totalKasDanaKematian > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-blue-100">
                <span>• <strong>Kas Dana Kematian (1.1.2.05):</strong></span>
                <span className="font-mono font-bold text-slate-950">{formatCurrency(totalKasDanaKematian)}</span>
              </div>
            )}
          </div>
          <p className="leading-relaxed pl-6 sm:pl-7 mt-2 text-justify">
            Penggabungan antara Kas Tunai Operasional dan Simpanan Bank menghasilkan{' '}
            <strong className="text-slate-950">Total Kas &amp; Bank Desa sebesar {formatCurrency(totalAsetKasBank)}</strong>{' '}
            (<em>{getTerbilang(totalAsetKasBank)}</em>).
          </p>
        </div>

        {/* Poin 3: Total Piutang Desa Adat */}
        {totalAsetPiutang > 0 && (
        <div 
          className="p-4 sm:p-5 bg-amber-50/90 rounded-xl border-l-4 border-amber-500 border border-amber-200 shadow-xs print:shadow-none break-avoid"
          style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', borderLeftColor: '#d97706', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="flex items-center gap-2.5 font-bold text-slate-950 mb-1.5">
            <FileText size={18} className="text-amber-700 shrink-0" />
            <span className="uppercase text-xs sm:text-sm tracking-wide">3. Total Piutang Desa Adat</span>
          </div>
          <p className="leading-relaxed pl-6 sm:pl-7 text-justify">
            Berdasarkan catatan pembukuan, total piutang desa tercatat sebesar{' '}
            <strong className="font-mono text-amber-950 font-black">{formatCurrency(totalAsetPiutang)}</strong>{' '}
            (<em>{getTerbilang(totalAsetPiutang)}</em>). Posisi piutang ini berasal dari:
          </p>
          <div 
            className="pl-6 sm:pl-9 mt-2.5 space-y-1.5 text-slate-700 bg-white/90 p-3 rounded-lg border border-amber-200/80"
            style={{ backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-amber-100">
              <span>• <strong>Piutang dari Krama / Pihak Terkait:</strong></span>
              <span className="font-mono font-bold text-slate-950">{formatCurrency(totalAsetPiutang)}</span>
            </div>
          </div>
        </div>
        )}

        {/* Poin 4: Posisi Pasiva, Kewajiban & Keseimbangan Neraca */}
        <div 
          className="p-4 sm:p-5 bg-slate-100 rounded-xl border-l-4 border-slate-700 border border-slate-300 shadow-xs print:shadow-none break-inside-avoid"
          style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderLeftColor: '#334155', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
        >
          <div className="flex items-center gap-2.5 font-bold text-slate-950 mb-1.5">
            <ShieldCheck size={18} className="text-slate-800 shrink-0" />
            <span className="uppercase text-xs sm:text-sm tracking-wide">4. Posisi Pasiva, Kewajiban, dan Keseimbangan Neraca</span>
          </div>
          <p className="leading-relaxed pl-6 sm:pl-7 text-justify">
            Dari sisi pasiva, total kewajiban / hutang pihak ketiga tercatat sebesar{' '}
            <strong className="font-mono">{totalHutangAbs === 0 ? 'Rp 0 (Nihil / Bebas Hutang)' : formatCurrency(totalHutangAbs)}</strong>. Posisi Aset Bersih (Net Asset) desa adalah sebesar{' '}
            <strong className="font-mono text-blue-900 font-bold">{formatCurrency(netAsset)}</strong>. Total Pasiva (Kewajiban + Ekuitas &amp; Surplus Periode Berjalan) berjumlah{' '}
            <strong className="font-mono font-bold">{formatCurrency(financialReport.totalPasiva)}</strong>, yang menunjukkan bahwa posisi Neraca Keuangan Desa dalam status{' '}
            <strong className={isBalanced ? 'text-emerald-800 font-bold' : 'text-rose-800 font-bold'}>
              {isBalanced ? 'SEIMBANG (BALANCED - Selisih Rp 0)' : 'TERDAPAT SELISIH'}
            </strong>.
          </p>
        </div>
      </div>

      {/* 5. TABEL RINGKASAN REKAPITULASI ANGKA */}
      <div 
        className="overflow-x-auto rounded-xl border border-slate-400 shadow-sm print:shadow-none break-inside-avoid"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        <table className="w-full text-left text-xs sm:text-sm border-collapse font-sans">
          <thead>
            <tr 
              className="bg-slate-900 text-white uppercase text-[11px] sm:text-xs font-bold"
              style={{ backgroundColor: '#0f172a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              <th className="p-2.5 sm:p-3 border-r border-slate-700 w-10 sm:w-12 text-center">No</th>
              <th className="p-2.5 sm:p-3 border-r border-slate-700">Komponen Kalkulasi Kas &amp; Neraca</th>
              <th className="p-2.5 sm:p-3 border-r border-slate-700 text-right w-36 sm:w-44">Nilai (Rp)</th>
              <th className="p-2.5 sm:p-3">Penjelasan &amp; Peruntukan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 text-slate-800">
            <tr className="hover:bg-slate-50">
              <td className="p-2.5 text-center font-bold">1</td>
              <td className="p-2.5 font-semibold">Total Kas Tunai Juru Raksa</td>
              <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(financialReport.totalJuruRaksaTunai)}</td>
              <td className="p-2.5 text-xs text-slate-600">Fisik tunai dipegang Juru Raksa (Adat)</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="p-2.5 text-center font-bold">2</td>
              <td className="p-2.5 font-semibold">Total Kas Bank / LPD</td>
              <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(financialReport.totalAsetLPD)}</td>
              <td className="p-2.5 text-xs text-slate-600">Simpanan rekening lembaga perbankan / LPD</td>
            </tr>
            <tr 
              className="bg-emerald-100/60 font-bold"
              style={{ backgroundColor: '#d1fae5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              <td className="p-2.5 text-center">•</td>
              <td className="p-2.5 text-emerald-950">Subtotal Kas &amp; Bank Desa</td>
              <td className="p-2.5 text-right font-mono text-emerald-900">{formatCurrency(totalAsetKasBank)}</td>
              <td className="p-2.5 text-xs text-emerald-900">Total likuiditas operasional kas + bank</td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="p-2.5 text-center font-bold">3</td>
              <td className="p-2.5 font-semibold">Total Piutang Desa Adat</td>
              <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(totalAsetPiutang)}</td>
              <td className="p-2.5 text-xs text-slate-600">Piutang dari Krama atau pihak terkait</td>
            </tr>
            <tr 
              className="bg-emerald-100/60 font-bold"
              style={{ backgroundColor: '#d1fae5', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              <td className="p-2.5 text-center">•</td>
              <td className="p-2.5 text-emerald-950">Subtotal Kas, Piutang &amp; Bank Desa</td>
              <td className="p-2.5 text-right font-mono text-emerald-900">{formatCurrency(totalAsetAktif)}</td>
              <td className="p-2.5 text-xs text-emerald-900">Total likuiditas operasional kas + bank + Piutang</td>
            </tr>
            <tr 
              className="bg-blue-50 font-bold text-blue-950"
              style={{ backgroundColor: '#eff6ff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              <td className="p-2.5 text-center">4</td>
              <td className="p-2.5">Posisi Aset Bersih (Net Asset)</td>
              <td className="p-2.5 text-right font-mono text-blue-900">{formatCurrency(netAsset)}</td>
              <td className="p-2.5 text-xs text-blue-900">Total Aset dikurangi Kewajiban / Hutang</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. PARAGRAF PENUTUP */}
      <p className="leading-relaxed text-slate-800 text-justify">
        Demikian formulir penjelasan hasil kalkulasi kas dan posisi neraca keuangan ini disusun dengan sebenarnya untuk dapat dipergunakan sebagai bahan pertanggungjawaban serta acuan transparansi pengelolaan keuangan Desa Adat Basangalas.
      </p>

      {/* 7. TANDA TANGAN PENGESAHAN (SIGNATURE & OFFICIAL STEMPEL) */}
      <div className="pt-6 border-t border-slate-300 break-inside-avoid">
        <div className="grid grid-cols-2 gap-6 text-center text-xs sm:text-sm text-slate-900 font-serif">
          {/* Sisi Kiri: Mengetahui Keliang Adat */}
          <div className="space-y-1">
            <p className="not-italic text-slate-700">Mengetahui,</p>
            <p className="font-bold text-slate-950 text-sm sm:text-base relative z-10">Keliang Adat Basangalas</p>
            <div className="h-16 sm:h-20 flex items-center justify-center relative">
              {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, mengambil tempat setengah nama Keliang Adat ke kiri, mengenai tanda tangan dan label pejabat */}
              {showStamp && effectiveStamp && (
                <div 
                  className="absolute pointer-events-none select-none z-0"
                  style={{
                    left: '30%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.92,
                    filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                  }}
                >
                  <img 
                    src={effectiveStamp} 
                    alt="Stempel Resmi Desa Adat" 
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain max-w-none mix-blend-multiply" 
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                      transform: `scale(${((sigSettings.stampScale || 100) / 100) * 1.8})`
                    }}
                  />
                </div>
              )}
              {embedSignatures && signatures?.keliang ? (
                <img 
                  src={signatures.keliang} 
                  alt="TTD Keliang" 
                  className="max-h-16 sm:max-h-20 object-contain relative z-10" 
                />
              ) : (
                <span className="text-[10px] text-slate-400 italic select-none no-print">[ Tanda Tangan ]</span>
              )}
            </div>
            <p className="font-bold border-b-2 border-slate-900 uppercase pb-0.5 inline-block min-w-[150px] sm:min-w-[220px] text-slate-950 relative z-10">
              {keliangName}
            </p>
          </div>

          {/* Sisi Kanan: Juru Raksa */}
          <div className="space-y-1">
            <p className="not-italic text-slate-700">{customPlace}, {formattedSigDate}</p>
            <p className="font-bold text-slate-950 text-sm sm:text-base">Juru Raksa</p>
            <div className="h-16 sm:h-20 flex items-center justify-center relative">
              {embedSignatures && signatures?.juruRaksa ? (
                <img 
                  src={signatures.juruRaksa} 
                  alt="TTD Juru Raksa" 
                  className="max-h-16 sm:max-h-20 object-contain relative z-10" 
                />
              ) : (
                <span className="text-[10px] text-slate-400 italic select-none no-print">[ Tanda Tangan ]</span>
              )}
            </div>
            <p className="font-bold border-b-2 border-slate-900 uppercase pb-0.5 inline-block min-w-[150px] sm:min-w-[220px] text-slate-950">
              {juruRaksaName}
            </p>
          </div>
        </div>
      </div>
      {/* Formal Footer Layout (Lembar Ke-2) */}
      <div className="neraca-main-footer justify-between items-center mt-6 print:mt-4 pt-2 border-t border-slate-300 print:px-2 text-slate-900 break-inside-avoid">
          <div>
              <p className="font-semibold print:text-[11px] print:text-slate-500">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
              <p className="print:text-[9px] text-slate-500 print:text-slate-400">Transparansi dan integritas data keuangan terjamin &amp; terautentikasi secara digital.</p>
          </div>
          <div className="text-right font-mono print:text-[9px] text-slate-500 print:text-slate-700">
              <p className="hidden print:block font-bold">https://desaadatbasangalas.netlify.app</p>
             {/*} <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p> */}
          </div>
      </div>
    </div>
  );
};

export const FormulirNaratifKalkulasi: React.FC<FormulirNaratifKalkulasiProps> = ({
  financialReport,
  reportDate,
  customPlace,
  signatureDate,
  keliangName,
  juruRaksaName,
  isBalanced,
  initialOpen = false,
  isOpen: controlledIsOpen,
  onClose,
  hideTriggerCard = false
}) => {
  const [internalOpen, setInternalOpen] = useState(initialOpen);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const handleOpen = () => {
    if (!isControlled) {
      setInternalOpen(true);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    if (!isControlled) {
      setInternalOpen(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(0); // -1: small, 0: normal, 1: large, 2: extra-large

  // Reactive Digital Signatures and Village Stempel
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [sigSettings, setSigSettings] = useState<SignatureSettings>(() => getSignatureSettings());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStamp, setShowStamp] = useState<boolean>(() => isStampOverlayEnabled());

  useEffect(() => {
    const handleSigUpdate = () => {
      setSignatures(getStoredSignatures());
      setSigSettings(getSignatureSettings());
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
    };
    window.addEventListener('signatures-updated', handleSigUpdate);
    window.addEventListener('storage', handleSigUpdate);
    return () => {
      window.removeEventListener('signatures-updated', handleSigUpdate);
      window.removeEventListener('storage', handleSigUpdate);
    };
  }, []);

  const effectiveStamp = getEffectiveStamp(signatures, 'DESA ADAT BASANGALAS');

  // Capitalize first letter of terbilang
  const capitalize = (text: string) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const getTerbilang = (amount: number) => {
    const rounded = Math.round(Math.abs(amount));
    if (rounded === 0) return 'Nol rupiah';
    return `${capitalize(numberToWords(rounded))} rupiah`;
  };

  const formattedReportDate = formatLongDate(reportDate);
  const formattedSigDate = formatLongDate(signatureDate || reportDate);
  const totalHutangAbs = Math.abs(financialReport.totalKewajiban);
  const netAsset = financialReport.totalAset - totalHutangAbs;
  const surplusTotal = (financialReport.surplusDefisit || 0) + (financialReport.manualSurplusBalance || 0);

  const saldoKasTunai = financialReport.kasJuruRaksaTunai?.saldo || 0;
  const totalKasBank = financialReport.totalKasBank ?? (financialReport.totalAsetKas - saldoKasTunai);
  const totalAsetTempekan = (financialReport.totalAsetTempekan ?? (financialReport as any).totalAsetKasTempekan ?? financialReport.kasTempekan?.saldo ?? (financialReport.asetTempekan?.reduce((s, i) => s + (i.saldo || 0), 0) || 0)) || Number(localStorage.getItem('neraca_saldo_tempekan')) || 0;
  const totalKasDPD = (financialReport.totalKasDPD ?? (financialReport as any).totalAsetKasSHULPD ?? financialReport.kasDPD?.saldo ?? 0) || Number(localStorage.getItem('neraca_saldo_shulpd')) || 0;
  const totalKasKarya18 = financialReport.totalKasKarya18 ?? financialReport.kasKarya18?.saldo ?? 0;
  const totalKasDanaKematian = financialReport.totalKasDanaKematian ?? financialReport.kasDanaKematian?.saldo ?? 0;
  const totalAsetLainnya = financialReport.totalAsetLainnya ?? (financialReport.asetLainnya?.reduce((s, i) => s + (i.saldo || 0), 0) || 0);
  const totalAsetKasBank = financialReport.totalAsetKasBank ?? (financialReport.totalAsetKas + totalAsetLainnya);
  const totalAsetPiutang = financialReport.totalAsetPiutang ?? (financialReport.asetPiutang?.reduce((s, i) => s + (i.saldo || 0), 0) || 0);
  const totalAsetAktif = financialReport.totalAsetAktif ?? (financialReport.totalAsetKas + totalAsetPiutang + totalAsetLainnya);

  // Handle ESC key to close modal & lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('print-formulir-kalkulasi-mode');
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('print-formulir-kalkulasi-mode');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Listen to beforeprint and afterprint events to safely toggle body print class
  useEffect(() => {
    const handleBeforePrint = () => {
      if (isOpen) {
        document.body.classList.add('print-formulir-kalkulasi-mode');
      }
    };

    const handleAfterPrint = () => {
      document.body.classList.remove('print-formulir-kalkulasi-mode');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-formulir-kalkulasi-mode');
    };
  }, [isOpen]);

  // Build full narrative text for clipboard
  const generateNarrativeText = () => {
    return `DESA ADAT BASANGALAS
Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
============================================================
BERITA ACARA & HASIL KALKULASI KAS & NERACA KEUANGAN
Posisi Per Tanggal: ${formattedReportDate}

Berdasarkan pencatatan Buku Kas Umum dan pembukuan Neraca Keuangan Desa Adat Basangalas per tanggal ${formattedReportDate}, berikut adalah rincian penjelasan naratif atas kalkulasi posisi kas dan likuiditas desa:

1. TOTAL KAS TUNAI JURU RAKSA:
   Total fisik kas tunai yang berada dalam pengelolaan langsung oleh Juru Raksa tercatat sebesar ${formatCurrency(financialReport.totalJuruRaksaTunai)} (${getTerbilang(financialReport.totalJuruRaksaTunai)}).
   Rincian kas tunai ini meliputi:
   - Kas Tunai Operasional Adat (1.1.1.02): ${formatCurrency(financialReport.kasJuruRaksaTunai.saldo)} (${getTerbilang(financialReport.kasJuruRaksaTunai.saldo)})

2. TOTAL KAS TERSIMPAN DI BANK / LPD:
   Saldo kas yang tersimpan secara aman pada rekening lembaga perbankan / LPD tercatat sebesar ${formatCurrency(financialReport.totalAsetLPD)} (${getTerbilang(financialReport.totalAsetLPD)}).
   Rincian rekening perbankan / LPD meliputi:
   - Kas Desa Adat (1.1.1.01): ${formatCurrency(totalKasBank)} (${getTerbilang(totalKasBank)})
   - Kas Tempekan (1.1.2.07): ${formatCurrency(totalAsetTempekan)} (${getTerbilang(totalAsetTempekan)})
   - Kas Dana Pembangunan Desa (1.1.2.06): ${formatCurrency(totalKasDPD)} (${getTerbilang(totalKasDPD)})
   - Kas Saldo Karya-18 (1.1.2.01): ${formatCurrency(totalKasKarya18)} (${getTerbilang(totalKasKarya18)})${totalKasDanaKematian > 0 ? `\n   - Kas Dana Kematian (1.1.2.05): ${formatCurrency(totalKasDanaKematian)} (${getTerbilang(totalKasDanaKematian)})` : ''}
   Dengan demikian, akumulasi Total Kas & Bank Desa (gabungan kas tunai operasional dan rekening bank) adalah sebesar ${formatCurrency(totalAsetKasBank)} (${getTerbilang(totalAsetKasBank)}).

   - Posisi Aset Bersih (Net Asset): ${formatCurrency(netAsset)} (${getTerbilang(netAsset)})
   - Surplus / Defisit Periode Berjalan: ${formatCurrency(surplusTotal)} (${getTerbilang(surplusTotal)})
   - Total Pasiva: ${formatCurrency(financialReport.totalPasiva)} (${getTerbilang(financialReport.totalPasiva)})
   - Status Keseimbangan Neraca: ${isBalanced ? 'SEIMBANG (BALANCED - Selisih Rp 0)' : 'TERDAPAT SELISIH'}

Demikian formulir penjelasan naratif hasil kalkulasi keuangan ini disusun dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.

${customPlace}, ${formattedSigDate}

Mengetahui,
Keliang Adat Basangalas: ${keliangName}

Juru Raksa:
${juruRaksaName}`;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateNarrativeText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  /**
   * Cetak Formulir Naratif Resmi:
   * Mengaktifkan mode print-formulir-kalkulasi-mode sehingga browser mencetak dokumen
   * yang 100% sama persis dengan modal (Kop Surat, Kartu Warna-Warni, Tabel Indah, Signature & Stempel).
   */
  const handlePrintForm = () => {
    document.body.classList.add('print-formulir-kalkulasi-mode');
    setTimeout(() => {
      window.print();
    }, 120);

    // Failsafe cleanup jika browser tidak memicu event afterprint
    setTimeout(() => {
      document.body.classList.remove('print-formulir-kalkulasi-mode');
    }, 2500);
  };

  /**
   * Unduh Formulir Naratif dalam Format PDF
   * Menggunakan exportElementToPdf yang merender kanvas formulir identik ke berkas PDF.
   */
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const printableEl = document.getElementById('printable-formulir-kalkulasi');
      if (printableEl) {
        await exportElementToPdf(printableEl, {
          filename: `Formulir_Naratif_Kalkulasi_Kas_${reportDate || 'Desa_Adat'}.pdf`,
          orientation: 'portrait',
          format: 'a4',
          margin: [8, 10, 8, 10],
          scale: 2.2,
          enableWatermark: false
        });
      } else {
        handlePrintForm();
      }
    } catch (err) {
      console.error('Error generating PDF: ', err);
      handlePrintForm();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const sharedDocProps: DocumentBodyProps = {
    financialReport,
    formattedReportDate,
    formattedSigDate,
    customPlace,
    keliangName,
    juruRaksaName,
    isBalanced,
    totalHutangAbs,
    netAsset,
    totalKasBank,
    totalAsetTempekan,
    totalKasDPD,
    totalKasKarya18,
    totalKasDanaKematian,
    totalAsetLainnya,
    totalAsetKasBank,
    totalAsetPiutang,
    totalAsetAktif,
    getTerbilang,
    signatures,
    effectiveStamp,
    embedSignatures,
    showStamp,
    sigSettings
  };

  // Font size multiplier class mapping
  const getTextSizeClass = () => {
    switch (fontSizeLevel) {
      case -1: return 'text-xs';
      case 1: return 'text-base';
      case 2: return 'text-lg';
      case 0:
      default: return 'text-sm';
    }
  };

  return (
    <>
      {/* --- 1. PROMINENT TRIGGER CARD IN KALKULASI PANEL --- */}
      {!hideTriggerCard && (
        <div className="mt-3 pt-3 border-t-2 border-dashed border-emerald-500/40 animate-fade-in">
          <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 p-3.5 rounded-xl border border-emerald-500/50 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/40 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <FileText size={22} className="text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-200">
                    Formulir Penjelasan Naratif
                  </h5>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 rounded-full flex items-center gap-1">
                    <ShieldCheck size={11} className="text-emerald-300" />
                    <span>TTD: {embedSignatures ? 'ON' : 'OFF'}</span>
                    <span>•</span>
                    <span>Stempel: {showStamp ? 'ON' : 'OFF'}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                  Uraian kalimat lengkap dari seluruh jumlah kalkulasi kas & neraca
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpen}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md border border-emerald-300/40 transition-all transform active:scale-95 group-hover:shadow-emerald-500/25 group-hover:shadow-lg cursor-pointer"
              title="Buka Formulir Penjelasan Naratif dalam Layar Penuh (Modal)"
            >
              <Maximize2 size={16} />
              <span>Buka Layar Penuh (Modal)</span>
              <ChevronRight size={16} className="text-emerald-200 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* --- 2. FULLSCREEN MODAL (RENDERED VIA PORTAL DIRECTLY TO BODY FOR FLAWLESS PRINTING) --- */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          id="formulir-naratif-portal-modal"
          className="fixed inset-0 z-[99999] flex flex-col bg-slate-950/90 backdrop-blur-md animate-fade-in select-text print:static print:inset-auto print:z-auto print:bg-white print:p-0 print:m-0 print:overflow-visible print:block"
          role="dialog"
          aria-modal="true"
        >
          {/* EMBEDDED PRINT STYLES FOR ABSOLUTE GUARANTEED PRINT FIDELITY */}
          <style>{`
            @media print {
              body.print-formulir-kalkulasi-mode {
                background: #ffffff !important;
                color: #0f172a !important;
              }
              body.print-formulir-kalkulasi-mode #root,
              body.print-formulir-kalkulasi-mode #rekap-printable-area,
              body.print-formulir-kalkulasi-mode #lra-printable-area,
              body.print-formulir-kalkulasi-mode #lra-onepage-printable-container,
              body.print-formulir-kalkulasi-mode #lra-onepage-fullscreen-printable,
              body.print-formulir-kalkulasi-mode #printable-area-bkp-full,
              body.print-formulir-kalkulasi-mode #printable-area-bku-full,
              body.print-formulir-kalkulasi-mode #printable-area,
              body.print-formulir-kalkulasi-mode [id^="printable-area-"],
              body.print-formulir-kalkulasi-mode #printable-receipt-dana-punia,
              body.print-formulir-kalkulasi-mode #printable-receipt-nota-belanja,
              body.print-formulir-kalkulasi-mode #printable-receipt-sasah-abu,
              body.print-formulir-kalkulasi-mode #printable-rekap-naratif,
              body.print-formulir-kalkulasi-mode #printable-lra-naratif {
                display: none !important;
                visibility: hidden !important;
              }
              body.print-formulir-kalkulasi-mode #formulir-naratif-portal-modal {
                position: static !important;
                display: block !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 100% !important;
                overflow: visible !important;
                z-index: auto !important;
              }
              body.print-formulir-kalkulasi-mode .formulir-naratif-toolbar,
              body.print-formulir-kalkulasi-mode .no-print {
                display: none !important;
                visibility: hidden !important;
              }
              body.print-formulir-kalkulasi-mode .formulir-naratif-scroll-area {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
                height: auto !important;
              }
              body.print-formulir-kalkulasi-mode #printable-formulir-kalkulasi {
                position: relative !important;
                display: block !important;
                visibility: visible !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                background: #ffffff !important;
                color: #0f172a !important;
                font-size: 10pt !important;
                line-height: 1.45 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body.print-formulir-kalkulasi-mode #printable-formulir-kalkulasi * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: A4 portrait;
                margin: 10mm 12mm 10mm 12mm;
              }
            }
          `}</style>

          {/* TOP ACTION & TOOLBAR HEADER (STICKY - HIDDEN IN PRINT) */}
          <div className="shrink-0 bg-slate-900/95 border-b border-emerald-500/30 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 z-10 shadow-xl no-print formulir-naratif-toolbar print:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/40 shrink-0">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-base font-black text-white uppercase tracking-wider truncate flex items-center gap-1.5">
                  <span>Formulir Penjelasan Naratif Kalkulasi</span>
                  <span className="hidden md:inline-block px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md font-sans font-bold">
                    Desa Adat Basangalas
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono truncate">
                  Posisi Per: {formattedReportDate}
                </p>
              </div>
            </div>

            {/* CONTROLS & ACTION BUTTONS */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
              {/* Status Otomatisasi Tanda Tangan & Stempel */}
              <div 
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-slate-300 font-sans"
                title="Status Otomatisasi Tanda Tangan & Stempel Resmi (Sesuai Pengaturan Sistem)"
              >
                <ShieldCheck size={13} className="text-teal-400" />
                <span className={embedSignatures ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  TTD: {embedSignatures ? 'ON' : 'OFF'}
                </span>
                <span className="text-slate-500">•</span>
                <span className={showStamp ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  Stempel: {showStamp ? 'ON' : 'OFF'}
                </span>
              </div>

              {/* Text Size Control */}
              <div className="hidden sm:flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => setFontSizeLevel(prev => Math.max(-1, prev - 1))}
                  className="px-2 py-1 hover:bg-slate-700 hover:text-white rounded transition-colors disabled:opacity-30 cursor-pointer"
                  disabled={fontSizeLevel <= -1}
                  title="Perkecil Ukuran Teks"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="px-1.5 font-mono text-[10px] text-emerald-400 font-bold">
                  {fontSizeLevel === 0 ? '100%' : fontSizeLevel === 1 ? '115%' : fontSizeLevel === 2 ? '130%' : '85%'}
                </span>
                <button
                  type="button"
                  onClick={() => setFontSizeLevel(prev => Math.min(2, prev + 1))}
                  className="px-2 py-1 hover:bg-slate-700 hover:text-white rounded transition-colors disabled:opacity-30 cursor-pointer"
                  disabled={fontSizeLevel >= 2}
                  title="Perbesar Ukuran Teks"
                >
                  <ZoomIn size={13} />
                </button>
                {fontSizeLevel !== 0 && (
                  <button
                    type="button"
                    onClick={() => setFontSizeLevel(0)}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded border-l border-slate-700 ml-0.5 cursor-pointer"
                    title="Reset Ukuran Teks"
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
              </div>

              {/* Copy Text */}
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/40 transition-all shadow active:scale-95 cursor-pointer"
                title="Salin Narasi Lengkap ke Clipboard"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span className="hidden xs:inline">{copied ? 'Tersalin!' : 'Salin'}</span>
              </button>

              {/* Download PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg border border-rose-600 transition-all shadow active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Unduh Formulir Naratif dalam Format PDF"
              >
                <Download size={14} />
                <span className="hidden xs:inline">{isGeneratingPdf ? 'PDF...' : 'PDF'}</span>
              </button>

              {/* Print */}
              <button
                type="button"
                onClick={handlePrintForm}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg border border-teal-500 transition-all shadow active:scale-95 cursor-pointer"
                title="Cetak Formulir Naratif Resmi (Identik 100% dengan Tampilan Modal)"
              >
                <Printer size={14} />
                <span className="hidden xs:inline">Cetak</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center justify-center p-1.5 sm:p-2 bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 rounded-lg border border-slate-700 hover:border-rose-500 transition-all ml-1 cursor-pointer active:scale-95"
                title="Tutup Modal (ESC)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* SCROLLABLE DOCUMENT CANVAS (100% Identical Visuals with Stempel, Signatures, and Official Kop) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 flex justify-center custom-scrollbar formulir-naratif-scroll-area print:p-0 print:m-0 print:overflow-visible print:block">
            <div 
              id="printable-formulir-kalkulasi"
              className={`w-full max-w-4xl bg-white text-slate-900 rounded-2xl border-2 border-emerald-600/40 p-4 sm:p-8 md:p-10 shadow-2xl font-serif my-auto print:my-0 print:p-0 print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none ${getTextSizeClass()}`}
            >
              <FormulirNaratifDocumentContent {...sharedDocProps} isPrint={false} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default FormulirNaratifKalkulasi;
