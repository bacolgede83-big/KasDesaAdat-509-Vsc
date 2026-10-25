
import React, { useMemo, useState } from 'react';
import type { BkuTransaction, BkpTransaction, JuDisplayRow } from '../types';
import { formatCurrency, formatDate, formatLongDate } from '../utils/formatter';
import { Printer, Scale, Settings, Calculator, CheckCircle2, AlertTriangle, Calendar, Database, User, Info } from 'lucide-react';
import { REFERENSI_REKENING } from '../constants';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import ExportPdfButton from '../components/shared/ExportPdfButton';

interface RekonsiliasiProps {
    bkuTransactions: BkuTransaction[];
    bkpTransactions: BkpTransaction[];
    entries: JuDisplayRow[];
}

const Rekonsiliasi: React.FC<RekonsiliasiProps> = ({ bkuTransactions, bkpTransactions, entries }) => {
    const { showPermissionDenied } = useNotification();
    const [physicalCash, setPhysicalCash] = useState<Record<string, number>>({});
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Signature Configuration State
    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('rekonsiliasi_keliangName') || 'I Made Mudita');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('rekonsiliasi_juruRaksaName') || 'I Putu Gede Sutrana');
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('rekonsiliasi_customPlace') || 'Basangalas');
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('rekonsiliasi_signatureDate') || new Date().toISOString().split('T')[0]);
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

        localStorage.setItem('rekonsiliasi_keliangName', tempKeliangName);
        localStorage.setItem('rekonsiliasi_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('rekonsiliasi_customPlace', tempCustomPlace);
        localStorage.setItem('rekonsiliasi_signatureDate', tempSignatureDate);

        setIsSettingsOpen(false);
        setNotification({ message: 'Pengaturan tanda tangan Rekonsiliasi berhasil disimpan!', type: 'success' });
    };

    const cashAccounts = useMemo(() => {
        return REFERENSI_REKENING.filter(r => r.code.startsWith('1.1'));
    }, []);

    const reconciliationData = useMemo(() => {
        const systemBalances: Record<string, number> = {};
        cashAccounts.forEach(acc => {
            let balance = 0;
            entries.forEach(e => {
                if (e.kodeRekening === acc.code) {
                    balance += (e.debet - e.kredit);
                }
            });
            systemBalances[acc.code] = balance;
        });

        const totalSystem = Object.values(systemBalances).reduce((a, b) => a + b, 0);
        const totalPhysical = cashAccounts.reduce((sum, acc) => sum + (physicalCash[acc.code] || 0), 0);
        const selisihTotal = totalSystem - totalPhysical;

        return { systemBalances, totalSystem, totalPhysical, selisihTotal };
    }, [entries, physicalCash, cashAccounts]);

    const handlePhysicalInput = (code: string, value: string) => {
        const num = value === '' ? 0 : Number(value);
        setPhysicalCash(prev => ({ ...prev, [code]: num }));
    };

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
        <div className="bg-white animate-slide-up-enter" id="printable-area">
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
                    #printable-area, #printable-area * { visibility: visible; }
                    #printable-area { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100% !important; 
                        background: white !important; 
                        color: black !important; 
                        padding: 0 !important; 
                        margin: 0 !important; 
                    }
                    .no-print { display: none !important; }
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        border: 2px solid black !important; 
                    }
                    th, td { 
                        border: 1px solid black !important; 
                        padding: 8px !important; 
                        color: black !important; 
                        background: transparent !important; 
                        font-size: 11px !important; 
                    }
                    thead th { 
                        background: #f3f4f6 !important; 
                        -webkit-print-color-adjust: exact;
                        font-weight: bold !important; 
                    }
                    .text-teal-400, .text-green-400, .text-red-400, .text-white { color: black !important; }
                    input { border: none !important; color: black !important; font-weight: bold !important; text-align: right !important; }
                    .signature-section { display: flex !important; page-break-inside: avoid; }
               
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

            {notification && <div className="no-print"><Notification {...notification} onClose={() => setNotification(null)} /></div>}
            
            {/* MAIN HEADER AND ACTION BUTTONS */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b-4 border-emerald-500 pb-4 gap-4 no-print">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-teal-500/20 rounded-xl shadow-lg shrink-0 mt-1">
                        <Scale className="text-teal-700 w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="text-3xl md:text-3xl font-black text-gray-900 tracking-tight font-serif">
                                Rekonsiliasi Multi-Kas
                            </h2>
                            <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-300">
                                Cash Reconciliation &amp; Verifikasi
                            </span>
                        </div>
                        <p className="text-sm font-medium text-emerald-700">Pencocokan saldo sistem terhadap fisik kas riil.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-4 w-full lg:w-auto">

                    <ExportPdfButton 
                        elementId="printable-area" 
                        filename={`Rekonsiliasi_Multi_Kas_Basangalas.pdf`} 
                        buttonText="Unduh PDF" 
                        options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }} 
                        className="whitespace-nowrap px-3.5 py-2.5 text-xs font-bold rounded-xl shadow-md"
                    />

                    <button 
                        onClick={handleOpenSettings} 
                        className="flex items-center justify-center gap-2 whitespace-nowrap bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-white px-3.5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-bold" 
                        title="Pengaturan Tanda Tangan"
                    >
                        <Settings size={16} className="shrink-0" />
                        <span>Tanda Tangan</span>
                    </button>

                    <button 
                        onClick={handlePrint} 
                        className="flex items-center justify-center gap-2 whitespace-nowrap bg-gray-800 border border-gray-700 text-amber-400 hover:text-teal-300 hover:bg-gray-700 px-3.5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-bold" 
                        title="Cetak Rekonsiliasi"
                    >
                        <Printer size={16} className="shrink-0" />
                        <span>Cetak</span>
                    </button>
                </div>
            </div>

            {/* FORMAL KOP SURAT HEADER FOR PRINT AND PDF EXPORT */}
            <div className="hidden print:block text-center text-black mb-6">
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

                <div className="text-center mb-4">
                    <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                        LAPORAN REKONSILIASI MULTI-KAS & BANK
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                        Per Tanggal: {formatDate(signatureDate)}
                    </p>
                </div>
            </div>
            <div className="mt-4 text-xs text-teal-700 w-full font-normal">
                <p className="leading-relaxed">
                    <strong className="text-teal-950 font-bold">Definisi Rekonsiliasi :</strong> Proses verifikasi dan pencocokan komparatif antara saldo kas menurut pembukuan sistem (BKU/Jurnal) dengan fisik kas riil di brankas/bank untuk memastikan ketepatan dan nihil selisih.
                </p>
            </div>

            <div className="overflow-x-auto border border-gray-500 rounded-xl bg-white print:border-black mt-6 print:rounded-none">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-gray-100 uppercase text-[10px] font-black tracking-widest print:text-black">
                        <tr>
                            <th className="px-6 py-4">Nama Akun Kas</th>
                            <th className="px-6 py-4 text-right">Saldo Sistem (Rp)</th>
                            <th className="px-6 py-4 text-right">Saldo Fisik/Riil (Rp)</th>
                            <th className="px-6 py-4 text-right">Selisih</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500 print:divide-black">
                        {cashAccounts.map(acc => {
                            const sysBal = reconciliationData.systemBalances[acc.code] || 0;
                            const phyBal = physicalCash[acc.code] || 0;
                            const diff = sysBal - phyBal;
                            return (
                                <tr key={acc.code} className="hover:bg-slate-200 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900 font-bold print:text-black">{acc.name}</div>
                                        <div className="text-[10px] text-gray-500 print:text-[8px]">{acc.code}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-arial text-teal-700 print:text-black">{formatCurrency(sysBal)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <input 
                                            type="number" 
                                            value={physicalCash[acc.code] || ''} 
                                            onChange={(e) => handlePhysicalInput(acc.code, e.target.value)}
                                            className="bg-gray-900 border border-gray-500 rounded px-3 py-1.5 text-gray-100 text-right w-40 focus:ring-1 focus:ring-teal-500 outline-none no-print"
                                            placeholder="0"
                                        />
                                        <span className="hidden print:inline font-mono font-bold">{formatCurrency(phyBal)}</span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold font-arial ${diff === 0 ? 'text-green-600' : 'text-red-600'} print:text-black`}>
                                        {formatCurrency(diff)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-400 text-gray-900 font-black print:bg-gray-100 print:text-black">
                        <tr>
                            <td className="px-6 py-4 uppercase">Total Kumulatif Seluruh Kas</td>
                            <td className="px-6 py-4 text-right font-arial">{formatCurrency(reconciliationData.totalSystem)}</td>
                            <td className="px-6 py-4 text-right font-arial">{formatCurrency(reconciliationData.totalPhysical)}</td>
                            <td className={`px-6 py-4 text-right font-arial ${reconciliationData.selisihTotal === 0 ? 'text-green-600' : 'text-red-400'} print:text-black`}>
                                {formatCurrency(reconciliationData.selisihTotal)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className={`mt-6 p-4 rounded-xl border ${reconciliationData.selisihTotal === 0 ? 'bg-green-900/20 border-green-800 text-green-600' : 'bg-red-900/20 border-red-800 text-red-600'} no-print text-center font-bold uppercase tracking-widest text-sm shadow-inner`}>
                {reconciliationData.selisihTotal === 0 ? "✅ SELURUH KAS TELAH TEREKONSILIASI DENGAN SEMPURNA" : `⚠️ TERDAPAT SELISIH SEBESAR ${formatCurrency(Math.abs(reconciliationData.selisihTotal))}`}
            </div>
            
            {/* Signature Block for Reconciliation */}
            <div className="hidden print:flex justify-between mt-12 px-10 text-black text-[12px] italic break-inside-avoid">
                <div className="text-center w-1/3">
                    <p>Mengetahui,</p>
                    <p className="font-bold">Keliang Adat Basangalas</p>
                    <div className="h-24"></div>
                    <p className="font-bold underline uppercase">{keliangName}</p>
                </div>
                <div className="text-center w-1/3">
                    <p>{customPlace}, {formatLongDate(signatureDate)}</p>
                    <p className="font-bold">Juru Raksa</p>
                    <div className="h-24"></div>
                    <p className="font-bold underline uppercase">{juruRaksaName}</p>
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


            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Laporan Rekonsiliasi" className="max-w-md">
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
                    <button onClick={handleSaveSettings} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest text-xs">Simpan Perubahan</button>
                </div>
            </Modal>
        </div>
    );
};

export default Rekonsiliasi;
