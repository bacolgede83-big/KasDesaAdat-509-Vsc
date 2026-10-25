
import React, { useState, useMemo } from 'react';
import type { JuDisplayRow, BudgetItem } from '../types';
import Modal from '../components/shared/Modal';
import { Plus, ArrowUpRight, ArrowDownLeft, Printer, Settings, Wallet, ShieldCheck, Calendar, Calculator, Info } from 'lucide-react';
import { numberToWords, formatCurrency, formatDate } from '../utils/formatter';
import { REFERENSI_REKENING } from '../constants';
import { useNotification } from '../context/NotificationContext';
import ExportPdfButton from '../components/shared/ExportPdfButton';

interface SaldoAkhirProps {
    entries: JuDisplayRow[];
    budgetItems: BudgetItem[];
    penyetoranPajak: number;
    setPenyetoranPajak: React.Dispatch<React.SetStateAction<number>>;
}

interface CategorySummary {
    name: string;
    total: number;
    count: number;
}

interface SaldoSummary {
    saldoAwal: number;
    totalPendapatan: number;
    totalBelanja: number;
    totalDebetKumulatif: number;
    totalKreditKumulatif: number;
    saldoAkhirKas: number;
    revenueByCategory: CategorySummary[];
    expenseByCategory: CategorySummary[];
}

const SaldoAkhir: React.FC<SaldoAkhirProps> = ({ 
    entries, 
    penyetoranPajak, 
    setPenyetoranPajak
}) => {
    const { showNotification, showPermissionDenied } = useNotification();
    const [isPajakModalOpen, setIsPajakModalOpen] = useState(false);
    const [formPajak, setFormPajak] = useState<number | ''>('');
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('saldoakhir_signatureDate') || new Date().toISOString().split('T')[0]);
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('saldoakhir_customPlace') || 'Basangalas');
    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('saldoakhir_keliangName') || 'I MADE MUDITA');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('saldoakhir_juruRaksaName') || 'I PUTU GEDE SUTRANA');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [tempKeliangName, setTempKeliangName] = useState(keliangName);
    const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
    const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
    const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);

    const handleOpenSettings = () => {
        setTempKeliangName(keliangName);
        setTempJuruRaksaName(juruRaksaName);
        setTempCustomPlace(customPlace);
        setTempSignatureDate(signatureDate);
        setIsSettingsOpen(true);
    };

    const handleSaveSettings = () => {
        setKeliangName(tempKeliangName);
        setJuruRaksaName(tempJuruRaksaName);
        setCustomPlace(tempCustomPlace);
        setSignatureDate(tempSignatureDate);

        localStorage.setItem('saldoakhir_keliangName', tempKeliangName);
        localStorage.setItem('saldoakhir_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('saldoakhir_customPlace', tempCustomPlace);
        localStorage.setItem('saldoakhir_signatureDate', tempSignatureDate);

        setIsSettingsOpen(false);
        showNotification('Pengaturan tanda tangan Saldo Akhir berhasil disimpan!', 'success');
    };

    const summaryData = useMemo((): SaldoSummary => {
        const filteredEntries = entries.filter(e => e.date && e.date <= reportDate);
        
        let saldoAwalOtomatis = 0;
        let totalPendapatanMurni = 0;
        let totalBelanja = 0;

        const revenueMap: Record<string, { total: number, count: number }> = {};
        const expenseMap: Record<string, { total: number, count: number }> = {};

        const SALDO_AWAL_ACCOUNTS = ['6.1.1.01']; // Silpa Tahun Sebelumnya

        filteredEntries.forEach(e => {
            const isCashAccount = e.kodeRekening?.startsWith('1.1'); 
            if (!isCashAccount) return;

            const relatedRows = entries.filter(r => r.idTransaksi === e.idTransaksi);
            const debetCode = relatedRows.find(r => r.rowType === 'debet')?.kodeRekening || '';
            const kreditCode = relatedRows.find(r => r.rowType === 'kredit')?.kodeRekening || '';
            
            const isInternalMutation = debetCode.startsWith('1.1') && kreditCode.startsWith('1.1');
            if (isInternalMutation) return;

            if (e.debet > 0) {
                if (SALDO_AWAL_ACCOUNTS.includes(kreditCode)) {
                    saldoAwalOtomatis += e.debet;
                } else {
                    totalPendapatanMurni += e.debet;
                    const accName = REFERENSI_REKENING.find(r => r.code === kreditCode)?.name;
                    const catName = accName || e.uraian.split(' dari ')[0].split(' kepada ')[0].replace('Penerimaan ', '').replace('Belanja ', '').trim() || 'Lain-lain';
                    if (!revenueMap[catName]) revenueMap[catName] = { total: 0, count: 0 };
                    revenueMap[catName].total += e.debet;
                    revenueMap[catName].count += 1;
                }
            }

            if (e.kredit > 0) {
                totalBelanja += e.kredit;
                const accName = REFERENSI_REKENING.find(r => r.code === debetCode)?.name;
                const catName = accName || e.uraian.split(' kepada ')[0].split(' dari ')[0].replace('Belanja ', '').replace('Penerimaan ', '').trim() || 'Lain-lain';
                if (!expenseMap[catName]) expenseMap[catName] = { total: 0, count: 0 };
                expenseMap[catName].total += e.kredit;
                expenseMap[catName].count += 1;
            }
        });

        const totalDebetKumulatif = saldoAwalOtomatis + totalPendapatanMurni;
        const totalKreditKumulatif = totalBelanja + penyetoranPajak;
        const saldoAkhirKas = totalDebetKumulatif - totalKreditKumulatif;

        return {
            saldoAwal: saldoAwalOtomatis,
            totalPendapatan: totalPendapatanMurni,
            totalBelanja,
            totalDebetKumulatif,
            totalKreditKumulatif,
            saldoAkhirKas,
            revenueByCategory: Object.entries(revenueMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total),
            expenseByCategory: Object.entries(expenseMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total)
        };
    }, [entries, penyetoranPajak, reportDate]);

    const handlePrint = () => window.print();

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
        <div className="space-y-8 animate-fade-in-up" id="printable-area">
          {/* Falling Particles */}
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
           
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-area-saldo-akhir, #printable-area-saldo-akhir * { visibility: visible; }
                    #printable-area-saldo-akhir {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        color: black !important;
                        display: block !important;
                    }
                    @page { size: portrait; margin: 15mm; }
                    .no-print { display: none !important; }
                    
                    table { 
                        width: 100% !important;
                        border-collapse: collapse !important;
                        border: 2px solid black !important; 
                        page-break-inside: auto;
                    }
                    
                    thead { display: table-header-group !important; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    
                    th, td { 
                        border: 1px solid black !important; 
                        color: black !important; 
                        padding: 8px !important;
                        background: transparent !important;
                    }
                    
                    .text-white, .text-gray-300, .text-gray-400, .text-teal-400, .text-emerald-300, .text-red-400, .text-gray-500, .text-gray-600, .text-gray-700, .text-gray-950 { 
                        color: black !important; 
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
                }
            `}</style>

            {/* DEDICATED PRINT TEMPLATE */}
            <div className="hidden print:block text-black" id="printable-area-saldo-akhir">
                <div className="text-slate-900 mb-6">
                    <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                        <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                            DESA ADAT BASANGALAS
                        </h2>
                        <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
                            Tata Kelola Penatausahaan Keuangan Kas Desa Adat
                        </p>
                        <p className="text-xs font-normal text-slate-700 font-serif m-0">
                            Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                        </p>
                    </div>

                    <div className="text-center mb-6">
                        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                            LAPORAN REKAPITULASI POSISI KAS RIIL
                        </h3>
                        <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                            Berdasarkan Jurnal Umum s.d. Tanggal: {new Date(reportDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                <table className="w-full text-sm text-left border-collapse border-2 border-black mb-8">
                    <thead className="bg-gray-100 uppercase text-[10px] font-black tracking-widest">
                        <tr>
                            <th className="border border-black px-6 py-4">Uraian Aliran Dana</th>
                            <th className="border border-black px-6 py-4 text-right">Debet (Masuk)</th>
                            <th className="border border-black px-6 py-4 text-right">Kredit (Keluar)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-black px-6 py-4 font-bold">
                                <div className="flex flex-col">
                                    <span>Saldo Kas Awal (Otomatis)</span>
                                    <span className="text-[9px] font-normal italic">Dari Jurnal Akun 6.1.1.01 (Silpa)</span>
                                </div>
                            </td>
                            <td className="border border-black px-6 py-4 text-right font-bold">{formatCurrency(summaryData.saldoAwal)}</td>
                            <td className="border border-black px-6 py-4 text-right">-</td>
                        </tr>
                        <tr>
                            <td className="border border-black px-6 py-4 font-bold">
                                <div className="flex flex-col">
                                    <span>Pendapatan Kas (Murni)</span>
                                    <span className="text-[9px] font-normal italic">Total Penerimaan Kas Baru (Luar Saldo Awal)</span>
                                </div>
                            </td>
                            <td className="border border-black px-6 py-4 text-right font-bold">{formatCurrency(summaryData.totalPendapatan)}</td>
                            <td className="border border-black px-6 py-4 text-right">-</td>
                        </tr>
                        <tr>
                            <td className="border border-black px-6 py-4 font-bold">
                                <div className="flex flex-col">
                                    <span>Belanja / Pengeluaran Tunai</span>
                                    <span className="text-[9px] font-normal italic">Mutasi Kredit pada Akun Kas 1.1.*</span>
                                </div>
                            </td>
                            <td className="border border-black px-6 py-4 text-right">-</td>
                            <td className="border border-black px-6 py-4 text-right font-bold">{formatCurrency(summaryData.totalBelanja)}</td>
                        </tr>
                        <tr>
                            <td className="border border-black px-6 py-4 font-bold">
                                <div className="flex flex-col">
                                    <span>Penyetoran Pajak (SSP)</span>
                                    <span className="text-[9px] font-normal italic">Titipan pajak yang sudah disetorkan</span>
                                </div>
                            </td>
                            <td className="border border-black px-6 py-4 text-right">-</td>
                            <td className="border border-black px-6 py-4 text-right font-bold">{formatCurrency(penyetoranPajak)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-black">
                            <td className="border border-black px-6 py-4 font-black uppercase text-[10px] tracking-widest">Total Mutasi Bruto</td>
                            <td className="border border-black px-6 py-4 text-right font-black">{formatCurrency(summaryData.totalDebetKumulatif)}</td>
                            <td className="border border-black px-6 py-4 text-right font-black">{formatCurrency(summaryData.totalKreditKumulatif)}</td>
                        </tr>
                        <tr className="border-t-4 border-black">
                            <td className="border border-black px-6 py-8 text-xl font-black uppercase tracking-tighter">SALDO AKHIR KAS RIIL</td>
                            <td colSpan={2} className="border border-black px-6 py-8 text-right text-4xl font-black tracking-tighter">
                                {formatCurrency(summaryData.saldoAkhirKas)}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div className="p-6 border border-black italic text-sm mb-8">
                    <span className="font-black text-[12px] tracking-widest block mb-2 not-italic uppercase">Terbilang (Sesuai Neraca):</span>
                    <span className="font-bold text-base capitalize leading-tight">
                        # {numberToWords(summaryData.saldoAkhirKas)} Rupiah #
                    </span>
                </div>

                <div className="flex justify-between mt-12 px-10 text-black text-[11px] italic break-inside-avoid font-serif">
                    <div className="text-center w-1/3">
                        <p>Mengetahui,</p>
                        <p className="font-bold">Keliang Adat Basangalas</p>
                        <div className="h-24"></div>
                        <p className="font-bold uppercase border-b border-black inline-block px-4">{keliangName}</p>
                    </div>
                    <div className="text-center w-1/3">
                        <p>{customPlace}, {new Date(signatureDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="font-bold">Juru Raksa</p>
                        <div className="h-24"></div>
                        <p className="font-bold uppercase border-b border-black inline-block px-4">{juruRaksaName}</p>
                    </div>
                </div>
                {/* Print Footer Layout */}
                <div className="print-formal-footer flex justify-between items-center mt-8 text-slate-900 border-t border-slate-400 pt-2">
                    <div>
                        <p className="font-semibold print:text-slate-400 print:text-[12px]">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                        <p className="text-[10px] text-slate-500 print:text-slate-400 print:text-[10px]">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                    </div>
                    <div className="text-right font-mono text-[8px] text-slate-500 print:text-slate-300">
                        <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>

            {/* Action Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white0 p-4 border-b-4 border-emerald-600 pb-4 no-print relative overflow-hidden">
                <div className="absolute bottom-0 right-0 p-2 opacity-10 pointer-events-none text-emerald-500">
                    <ShieldCheck size={120} />
                </div>
                <div className="flex items-start gap-4 z-10">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.15)] shrink-0 mt-1">
                        <Calculator size={36} className="text-teal-400" />  
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-none font-serif">
                                Saldo Akhir Kas Riil</h2>
                            <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-300">
                                Posisi Kas Riil Netto
                            </span>
                        </div>
                        <div className="mt-2 text-xs text-teal-700 w-full flex items-start gap-2 shadow-2xs">
                            <p className="leading-snug">
                                <strong className="text-teal-950 font-bold">Definisi Saldo Kas Riil:</strong> Laporan posisi likuiditas kas riil netto (Kas Tunai &amp; Rekening Bank) pada tanggal cut-off tertentu, dihitung dari akumulasi penerimaan dikurangi seluruh belanja operasional.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto z-10">
                        <p className="text-teal-700 text-sm font-bold tracking-wide">
                            Otomatisasi Jurnal (Sinkron Neraca)
                        </p>
                    <div className="flex items-center gap-2 bg-transparent hover:bg-teal-200 px-4 py-2.5 rounded-xl border border-gray-500">
                        <Calendar size={18} className="text-teal-500" />
                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter mr-1">Cut-off Jurnal:</span>
                        <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} 
                        className="bg-transparent text-gray-900 font-bold focus:outline-none cursor-pointer text-sm" />
                    </div>                    
                </div>
            </div>

            <div className="bg-white border border-blue-800/50 p-4 rounded-xl no-print flex items-start gap-3">
                <Info className="text-blue-400 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-gray-700 italic leading-relaxed">
                    Saldo ini dihitung otomatis dari akun kelompok <strong>1.1.*</strong> (Kas & Bank). Mutasi antar kas diabaikan agar realisasi pendapatan & belanja akurat.
                </p>
            </div>

            {/* Accounting Container */}
            <div className="w-full bg-white rounded-xl p-8 md:p-10 shadow-xl border border-gray-500 relative overflow-visible no-print">
               <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4"> 
                <div className="flex items-center gap-4 no-print">
                    <h3 className="text-xl font-black text-gray-900 flex items-center gap-3 uppercase tracking-widest">
                        <ShieldCheck className="text-teal-400" />
                        Rekapitulasi Akuntansi Kas
                    </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 no-print">
                    {/* Signature Configuration */}
                    <button onClick={handleOpenSettings} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors border border-gray-700 shadow-lg active:scale-95 text-xs" title="Pengaturan Tanda Tangan">
                        <Settings size={16} />
                    </button>
                    <ExportPdfButton 
                        elementId="printable-area-saldo-akhir" 
                        filename={`Laporan_Saldo_Akhir_${reportDate}.pdf`} 
                        buttonText="Unduh PDF" 
                        variant="default"
                        defaultOrientation="portrait"
                        options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                    />
                    <button onClick={handlePrint} className="flex items-center justify-center py-2 px-4 bg-emerald-600 font-medium hover:bg-emerald-700 text-gray-100 rounded-lg shadow-xl shadow-teal-900/30 transition-all active:scale-95 gap-2 no-print text-xs">
                        <Printer size={18} /><span>Cetak</span>
                    </button>
                </div>
              </div>

                <div className="overflow-x-auto rounded-xl border border-gray-500 print:border-none mb-8">
                    <table className="w-full min-w-[600px] text-sm text-left">
                        <thead className="bg-gray-700 text-gray-100 uppercase text-[10px] border-b border-gray-500 font-black tracking-widest print:text-black">
                            <tr>
                                <th className="px-6 py-5">Uraian Aliran Dana</th>
                                <th className="px-6 py-5 text-right">Debet (Masuk)</th>
                                <th className="px-6 py-5 text-right">Kredit (Keluar)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-600 print:divide-black">
                            <tr className="hover:bg-gray-200 transition-colors">
                                <td className="px-6 py-5 font-bold text-gray-900 print:text-black">
                                    <div className="flex flex-col">
                                        <span>Saldo Kas Awal (Otomatis)</span>
                                        <span className="text-[10px] text-gray-500 font-normal italic">Dari Jurnal Akun 6.1.1.01 (Silpa)</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right text-teal-400 font-arial font-bold text-lg print:text-black">{formatCurrency(summaryData.saldoAwal)}</td>
                                <td className="px-6 py-5 text-right print:text-black">-</td>
                                </tr>                                                                                                                                                                                                                                                                                   
                            <tr className="hover:bg-gray-200 transition-colors">
                                <td className="px-6 py-5 font-bold text-gray-900 print:text-black">
                                    <div className="flex flex-col">
                                        <span>Pendapatan Kas (Murni)</span>
                                        <span className="text-[10px] text-gray-500 font-normal italic">Total Penerimaan Kas Baru (Luar Saldo Awal)</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right text-emerald-400 font-arial font-bold text-lg print:text-black">{formatCurrency(summaryData.totalPendapatan)}</td>
                                <td className="px-6 py-5 text-right print:text-black">-</td>
                            </tr>
                            <tr className="hover:bg-gray-200 transition-colors">
                                <td className="px-6 py-5 font-bold text-gray-900 print:text-black">
                                    <div className="flex flex-col">
                                        <span>Belanja / Pengeluaran Tunai</span>
                                        <span className="text-[10px] text-gray-500 font-normal italic">Mutasi Kredit pada Akun Kas 1.1.*</span>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right print:text-black">-</td>
                                <td className="px-6 py-5 text-right text-rose-700 font-arial font-bold text-lg print:text-black">{formatCurrency(summaryData.totalBelanja)}</td>
                            </tr>
                            <tr className="hover:bg-gray-200 transition-colors group">
                                <td className="px-6 py-5 font-bold text-gray-900 print:text-black">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex flex-col">
                                            <span>Penyetoran Pajak (SSP)</span>
                                            <span className="text-[10px] text-gray-500 font-normal italic">Titipan pajak yang sudah disetorkan</span>
                                        </div>
                                        <button onClick={() => setIsPajakModalOpen(true)} className="no-print opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 transition-all border border-teal-500/20" title="Kelola Penyetoran Pajak">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right print:text-black">-</td>
                                <td className="px-6 py-5 text-right text-rose-400 font-arial font-bold text-lg print:text-black">{formatCurrency(penyetoranPajak)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-800/40 print:bg-gray-900 border-t-2 border-gray-700">
                                <td className="px-6 py-4 font-black text-gray-900 uppercase text-[10px] print:text-black tracking-widest">Total Mutasi Bruto</td>
                                <td className="px-6 py-4 text-right text-teal-500 font-black print:text-black">{formatCurrency(summaryData.totalDebetKumulatif)}</td>
                                <td className="px-6 py-4 text-right text-rose-500 font-black print:text-black">{formatCurrency(summaryData.totalKreditKumulatif)}</td>
                            </tr>
                            <tr className="bg-gradient-to-r from-teal-900/10 to-emerald-900/10 border-t-4 border-teal-500 print:bg-transparent print:border-black">
                                <td className="px-6 py-8 text-xl font-black text-gray-900 print:text-black uppercase tracking-tighter">SALDO AKHIR KAS RIIL</td>
                                <td colSpan={2} className="px-6 py-8 text-right text-4xl md:text-5xl font-black text-gray-900 print:text-black tracking-tighter">
                                    {formatCurrency(summaryData.saldoAkhirKas)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                <div className="p-6 bg-amber-900/50 rounded-xl border border-gray-500 italic text-sm text-gray-400 shadow-inner print:bg-transparent print:border-none print:text-black print:p-0 print:mb-10 mb-8">
                    <span className="font-black text-teal-500 text-[12px] tracking-widest block mb-2 print:text-black print:not-italic">Terbilang (Sesuai Neraca):</span>
                    <span className="text-gray-900 font-bold text-base md:text-[15px] capitalize print:text-black leading-tight">
                        # {numberToWords(summaryData.saldoAkhirKas)} Rupiah #
                    </span>
                </div>

                {/* Analysis Section - HIDDEN ON PRINT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 no-print">
                    <div className="bg-white p-6 rounded-xl border border-emerald-500 shadow-xl hover:shadow-emerald-900/50 transition-shadow">
                        <h4 className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                            <ArrowUpRight size={16} /> Analisis Pendapatan
                        </h4>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {summaryData.revenueByCategory.length > 0 ? summaryData.revenueByCategory.map((cat, i) => (
                                <div key={i} className="flex justify-between items-center group border-b border-gray-300 pb-2 last:border-0">
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 text-sm font-bold group-hover:text-emerald-400 transition-colors hover-bg-gray-700">{cat.name}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">{cat.count} Transaksi</span>
                                    </div>
                                    <span className="text-emerald-400 font-arial text-xs font-black">{formatCurrency(cat.total)}</span>
                                </div>
                            )) : <p className="text-center text-gray-300 text-xs italic py-4">Belum ada pendapatan terekam.</p>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-rose-500 shadow-xl hover:shadow-rose-900/50 transition-shadow">
                        <h4 className="text-rose-800 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                            <ArrowDownLeft size={16} /> Analisis Belanja
                        </h4>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {summaryData.expenseByCategory.length > 0 ? summaryData.expenseByCategory.map((cat, i) => (
                                <div key={i} className="flex justify-between items-center group border-b border-gray-300 pb-2 last:border-0">
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 text-sm font-bold group-hover:text-rose-800 transition-colors hover-bg-gray-700">{cat.name}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">{cat.count} Transaksi</span>
                                    </div>
                                    <span className="text-rose-800 font-mono text-xs font-black">{formatCurrency(cat.total)}</span>
                                </div>
                            )) : <p className="text-center text-gray-300 text-xs italic py-4">Belum ada belanja terekam.</p>}
                        </div>
                    </div>
                </div>

                {/* Audit Message */}
                <div className="p-6 bg-teal-900/10 rounded-2xl border border-teal-500/20 mb-8 no-print">
                        <div className="flex items-center gap-3 text-slate-800 mb-2 print:text-black">
                        <ShieldCheck size={20} />
                        <span className="font-black text-xs uppercase tracking-widest">Pesan Audit Akuntansi</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed italic print:text-black">
                        Saldo Akhir ini mencakup seluruh akun kelompok "1.1 - Kas & Bank". Mutasi internal diabaikan untuk menghindari duplikasi data pendapatan/belanja. Data ini telah diverifikasi sinkron dengan Buku Jurnal Umum (General Ledger) per {formatDate(reportDate)}.
                        </p>
                </div>
            </div>

            {/* Formal Footer Layout */}
            <div className="flex justify-between items-center mt-8 text-slate-900 border-t-2 border-slate-400 pt-2 no-print">
                <div>
                    <p className="font-semibold">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                    <p className="text-[12px]">Transparansi dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                </div>
                <div className="text-right font-mono text-[9px] text-slate-600">
                    <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>

            
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Tanda Tangan" className="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Tempat Laporan</label>
                        <input type="text" value={tempCustomPlace} onChange={e => setTempCustomPlace(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Tanggal Laporan (Tanda Tangan)</label>
                        <input type="date" value={tempSignatureDate} onChange={e => setTempSignatureDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Keliang Adat</label>
                        <input type="text" value={tempKeliangName} onChange={e => setTempKeliangName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Juru Raksa</label>
                        <input type="text" value={tempJuruRaksaName} onChange={e => setTempJuruRaksaName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <button onClick={handleSaveSettings} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest">Simpan Perubahan</button>
                </div>
            </Modal>

            <Modal isOpen={isPajakModalOpen} onClose={() => setIsPajakModalOpen(false)} title="Penyetoran Pajak" className="max-w-md">
                <div className="space-y-6">
                    <div className="bg-rose-900/20 p-5 rounded-2xl border border-rose-500/30">
                         <p className="text-sm text-rose-200 font-medium italic">Masukkan total pajak yang sudah dibayarkan (SSP) untuk mengurangi saldo kas riil (netto).</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 ml-1 tracking-widest">Total Pajak Terbayar (Rp)</label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-rose-600 text-2xl">Rp</span>
                            <input type="number" value={formPajak} onChange={e => setFormPajak(e.target.value===''?'':Number(e.target.value))} className="w-full bg-gray-950 border border-gray-700 rounded-3xl py-6 pl-16 pr-6 text-white text-3xl font-black focus:ring-2 focus:ring-rose-500 outline-none shadow-inner" placeholder="0" autoFocus />
                        </div>
                    </div>
                    <button onClick={() => { setPenyetoranPajak(Number(formPajak)); setIsPajakModalOpen(false); }} className="w-full bg-gradient-to-r from-rose-600 to-orange-700 py-5 rounded-2xl font-black text-white hover:brightness-110 transition-all shadow-xl uppercase tracking-[0.2em] text-xs active:scale-95">Simpan Pajak</button>
                </div>
            </Modal>
        </div>
    );
};

export default SaldoAkhir;
