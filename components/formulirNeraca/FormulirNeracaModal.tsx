import React, { useRef, useState } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  X, 
  Scale, 
  Sparkles, 
  Building2, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatter';
import { getStoredSignatures, getSignatureSettings, getEffectiveStamp } from '../../utils/signatureStorage';

export interface FormulirNeracaModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportDate: string;
  financialReport: {
    asetKas: Array<{ code: string; name: string; saldo: number }>;
    asetPiutang: Array<{ code: string; name: string; saldo: number }>;
    kewajiban: Array<{ code: string; name: string; saldo: number }>;
    ekuitas: Array<{ code: string; name: string; saldo: number }>;
    totalAsetKas: number;
    totalAsetPiutang: number;
    totalAset: number;
    totalKewajiban: number;
    totalEkuitas: number;
    totalPasiva: number;
    surplusDefisit: number;
    isBalanced: boolean;
    selisih: number;
  };
  aiAnalysis?: {
    healthScore: number;
    healthStatus: string;
    headline: string;
    ringkasanPerjalanan: string;
    analisisPengeluaran: string;
    rekomendasi: string[];
  } | null;
  institutionName?: string;
  customPlace?: string;
  keliangName?: string;
  juruRaksaName?: string;
}

export const FormulirNeracaModal: React.FC<FormulirNeracaModalProps> = ({
  isOpen,
  onClose,
  reportDate,
  financialReport,
  aiAnalysis,
  institutionName = 'DESA ADAT BASANGALAS',
  customPlace = 'Basangalas',
  keliangName = 'I Made Mudita',
  juruRaksaName = 'I Putu Gede Sutrana'
}) => {
  const [copied, setCopied] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);
  const signatures = getStoredSignatures();
  const sigSettings = getSignatureSettings();
  const effectiveStamp = getEffectiveStamp(signatures, institutionName || 'DESA ADAT BASANGALAS');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyNarrative = () => {
    if (!aiAnalysis) return;
    const text = `LAPORAN FORMULIR NERACA & ANALISIS PERJALANAN KEUANGAN\n${institutionName}\nPer Tanggal: ${formatDate(reportDate)}\n\n` +
      `Ringkasan Eksekutif:\n${aiAnalysis.headline}\n\n` +
      `Ringkasan Perjalanan Keuangan:\n${aiAnalysis.ringkasanPerjalanan}\n\n` +
      `Analisis Pengeluaran:\n${aiAnalysis.analisisPengeluaran}\n\n` +
      `Rekomendasi Strategis:\n` + aiAnalysis.rekomendasi.map((r, i) => `${i + 1}. ${r}`).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-white">Formulir Neraca & Naskah Perjalanan Keuangan</h2>
              <p className="text-xs text-slate-300">Posisi Keuangan per {formatDate(reportDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {aiAnalysis && (
              <button
                type="button"
                onClick={handleCopyNarrative}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Tersalin' : 'Salin Naskah AI'}
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Dokumen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content / Printable Document */}
        <div className="overflow-y-auto p-6 lg:p-8 space-y-6 print:p-0 print:space-y-4" ref={printableRef}>
          
          {/* Kop Surat Dokumen Resmi */}
          <div className="text-center border-b-2 border-slate-900 pb-4">
            <h1 className="text-xl lg:text-2xl font-bold tracking-wide text-slate-900 uppercase">
              {institutionName}
            </h1>
            <p className="text-sm font-semibold text-slate-700 tracking-wider uppercase mt-0.5">
              FORMULIR NERACA & RINGKASAN PERJALANAN KEUANGAN
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Posisi Saldo Buku per Tanggal: {formatDate(reportDate)} | Acuan Kode Rekening Baku Desa Adat
            </p>
          </div>

          {/* Status Keseimbangan */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              {financialReport.isBalanced ? (
                <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-rose-100 text-rose-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status Neraca</div>
                <div className="text-sm font-bold text-slate-900">
                  {financialReport.isBalanced ? 'SEIMBANG (Aktiva = Pasiva)' : `BELUM SEIMBANG (Selisih: ${formatCurrency(financialReport.selisih)})`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-500">Total Aktiva (Aset)</div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(financialReport.totalAset)}</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-xs text-slate-500">Total Pasiva (Kewajiban + Modal)</div>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(financialReport.totalPasiva)}</div>
              </div>
            </div>
          </div>

          {/* Naskah AI Insight jika sudah digenerate */}
          {aiAnalysis && (
            <div className="p-5 rounded-xl bg-slate-50 border border-indigo-100 print:border-slate-300">
              <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm mb-3">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Naskah Narasi Eksekutif & Analisis Pengeluaran AI</span>
                <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-medium">
                  Skor Kesehatan: {aiAnalysis.healthScore}/100 ({aiAnalysis.healthStatus})
                </span>
              </div>
              
              <div className="text-xs lg:text-sm text-slate-800 font-medium mb-3 italic">
                "{aiAnalysis.headline}"
              </div>

              <div className="space-y-3 text-xs lg:text-sm text-slate-700 leading-relaxed">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">1. Ringkasan Perjalanan Keuangan Desa:</h4>
                  <p className="whitespace-pre-line text-slate-600">{aiAnalysis.ringkasanPerjalanan}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">2. Analisis Pengeluaran Berstandar AI:</h4>
                  <p className="whitespace-pre-line text-slate-600">{aiAnalysis.analisisPengeluaran}</p>
                </div>
                {aiAnalysis.rekomendasi && aiAnalysis.rekomendasi.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">3. Rekomendasi Strategis Paruman:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      {aiAnalysis.rekomendasi.map((rek, idx) => (
                        <li key={idx}>{rek}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabel Neraca 2 Kolom (Aktiva vs Pasiva) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 text-xs lg:text-sm">
            
            {/* AKTIVA */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-slate-100 font-bold text-slate-800 border-b border-slate-200 flex justify-between">
                <span>AKTIVA (ASET)</span>
                <span>JUMLAH</span>
              </div>
              <div className="p-3 space-y-4">
                <div>
                  <div className="font-semibold text-slate-700 mb-1.5 pb-1 border-b border-slate-100">A. KAS & SETARA KAS (1.1)</div>
                  <div className="space-y-1">
                    {financialReport.asetKas.length > 0 ? (
                      financialReport.asetKas.map((item) => (
                        <div key={item.code} className="flex justify-between py-0.5 text-slate-600">
                          <span className="truncate pr-2">{item.code} {item.name}</span>
                          <span className="font-mono text-slate-800">{formatCurrency(item.saldo)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 italic py-1">Tidak ada saldo kas aktif</div>
                    )}
                  </div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-100 font-semibold text-slate-700">
                    <span>Subtotal Kas & Setara Kas</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalAsetKas)}</span>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700 mb-1.5 pb-1 border-b border-slate-100">B. PIUTANG (1.2)</div>
                  <div className="space-y-1">
                    {financialReport.asetPiutang.length > 0 ? (
                      financialReport.asetPiutang.map((item) => (
                        <div key={item.code} className="flex justify-between py-0.5 text-slate-600">
                          <span className="truncate pr-2">{item.code} {item.name}</span>
                          <span className="font-mono text-slate-800">{formatCurrency(item.saldo)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 italic py-1">Tidak ada piutang</div>
                    )}
                  </div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-100 font-semibold text-slate-700">
                    <span>Subtotal Piutang</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalAsetPiutang)}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2.5 bg-slate-100 font-bold text-slate-900 border-t border-slate-200 flex justify-between">
                <span>TOTAL AKTIVA</span>
                <span className="font-mono">{formatCurrency(financialReport.totalAset)}</span>
              </div>
            </div>

            {/* PASIVA */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-slate-100 font-bold text-slate-800 border-b border-slate-200 flex justify-between">
                <span>PASIVA (KEWAJIBAN & MODAL)</span>
                <span>JUMLAH</span>
              </div>
              <div className="p-3 space-y-4">
                <div>
                  <div className="font-semibold text-slate-700 mb-1.5 pb-1 border-b border-slate-100">A. KEWAJIBAN / HUTANG (2.1)</div>
                  <div className="space-y-1">
                    {financialReport.kewajiban.length > 0 ? (
                      financialReport.kewajiban.map((item) => (
                        <div key={item.code} className="flex justify-between py-0.5 text-slate-600">
                          <span className="truncate pr-2">{item.code} {item.name}</span>
                          <span className="font-mono text-slate-800">{formatCurrency(item.saldo)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-emerald-600 italic py-1">Bebas Hutang / Kewajiban Nihil</div>
                    )}
                  </div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-100 font-semibold text-slate-700">
                    <span>Subtotal Kewajiban</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalKewajiban)}</span>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-700 mb-1.5 pb-1 border-b border-slate-100">B. EKUITAS & MODAL (3.1)</div>
                  <div className="space-y-1">
                    {financialReport.ekuitas.map((item) => (
                      <div key={item.code} className="flex justify-between py-0.5 text-slate-600">
                        <span className="truncate pr-2">{item.code} {item.name}</span>
                        <span className="font-mono text-slate-800">{formatCurrency(item.saldo)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span className="truncate pr-2">3.1.1.07 Surplus/Defisit Berjalan</span>
                      <span className={`font-mono ${financialReport.surplusDefisit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(financialReport.surplusDefisit)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-100 font-semibold text-slate-700">
                    <span>Subtotal Ekuitas</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalEkuitas)}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-2.5 bg-slate-100 font-bold text-slate-900 border-t border-slate-200 flex justify-between">
                <span>TOTAL PASIVA</span>
                <span className="font-mono">{formatCurrency(financialReport.totalPasiva)}</span>
              </div>
            </div>

          </div>

          {/* Tanda Tangan Resmi Prajuru */}
          <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs lg:text-sm text-slate-800 print:pt-4">
            <div className="text-center w-52 space-y-1">
              <p className="text-slate-500 mb-2">Mengetahui,<br /><span className="font-semibold text-slate-900">Keliang Desa Adat</span></p>
              <div className="h-16 flex items-center justify-center relative my-1">
                {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, bukan di Juru Raksa, mengambil tempat setengah nama Keliang Adat ke kiri */}
                {sigSettings.autoEmbed && sigSettings.showStampOverlay && effectiveStamp && (
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
                      className="w-24 h-24 print:w-24 print:h-24 object-contain max-w-none mix-blend-multiply" 
                      style={{
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }}
                    />
                  </div>
                )}
                {signatures.keliang && sigSettings.autoEmbed ? (
                  <img 
                    src={signatures.keliang} 
                    alt="TTD Keliang" 
                    className="h-14 object-contain relative z-10" 
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}
                  />
                ) : (
                  <div className="h-14" />
                )}
              </div>
              <p className="font-bold underline text-slate-900 relative z-10">{keliangName}</p>
            </div>

            <div className="text-center w-52 space-y-1">
              <p className="text-slate-500 mb-1">{customPlace}, {formatDate(reportDate)}</p>
              <p className="text-slate-500 mb-2"><span className="font-semibold text-slate-900">Juru Raksa / Bendahara</span></p>
              <div className="h-16 flex items-center justify-center relative my-1">
                {signatures.juruRaksa && sigSettings.autoEmbed ? (
                  <img 
                    src={signatures.juruRaksa} 
                    alt="TTD Juru Raksa" 
                    className="h-14 object-contain relative z-10" 
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}
                  />
                ) : (
                  <div className="h-14" />
                )}
              </div>
              <p className="font-bold underline text-slate-900 relative z-10">{juruRaksaName}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FormulirNeracaModal;
