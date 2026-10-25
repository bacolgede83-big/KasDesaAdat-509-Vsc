
import React, { useMemo, useState } from 'react';
import { Printer, Calendar, RotateCcw, Calculator, Settings, Info, FileText } from 'lucide-react';
import type { JuDisplayRow, DanaPuniaItem, BudgetItem } from '../types';
import { formatCurrency, formatLongDate } from '../utils/formatter';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import ExportPdfButton from '../components/shared/ExportPdfButton';
import RekapitulasiNaratifTemplateModal from '../components/rekapitulasi/RekapitulasiNaratifTemplateModal';

interface RekapitulasiProps {
    entries: JuDisplayRow[];
    danaPuniaItems: DanaPuniaItem[];
    budgetItems: BudgetItem[];
}

const Rekapitulasi: React.FC<RekapitulasiProps> = ({ entries, danaPuniaItems, budgetItems }) => {
    const { showPermissionDenied } = useNotification();
    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('rekapitulasi_keliangName') || 'I Made Mudita');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('rekapitulasi_juruRaksaName') || 'I Putu Gede Sutrana');
    const [penyarikanName, setPenyarikanName] = useState(() => localStorage.getItem('rekapitulasi_penyarikanName') || '');
    const [pengawasName, setPengawasName] = useState(() => localStorage.getItem('rekapitulasi_pengawasName') || '');
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('rekapitulasi_customPlace') || 'Basangalas');
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('rekapitulasi_signatureDate') || new Date().toISOString().split('T')[0]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isNaratifModalOpen, setIsNaratifModalOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [tempKeliangName, setTempKeliangName] = useState(keliangName);
    const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
    const [tempPenyarikanName, setTempPenyarikanName] = useState(penyarikanName);
    const [tempPengawasName, setTempPengawasName] = useState(pengawasName);
    const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
    const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);

    const handleOpenSettings = () => {
        setTempKeliangName(keliangName);
        setTempJuruRaksaName(juruRaksaName);
        setTempPenyarikanName(penyarikanName);
        setTempPengawasName(pengawasName);
        setTempCustomPlace(customPlace);
        setTempSignatureDate(signatureDate);
        setIsSettingsOpen(true);
    };

    const handleSaveSettings = () => {
        setKeliangName(tempKeliangName);
        setJuruRaksaName(tempJuruRaksaName);
        setPenyarikanName(tempPenyarikanName);
        setPengawasName(tempPengawasName);
        setCustomPlace(tempCustomPlace);
        setSignatureDate(tempSignatureDate);

        localStorage.setItem('rekapitulasi_keliangName', tempKeliangName);
        localStorage.setItem('rekapitulasi_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('rekapitulasi_penyarikanName', tempPenyarikanName);
        localStorage.setItem('rekapitulasi_pengawasName', tempPengawasName);
        localStorage.setItem('rekapitulasi_customPlace', tempCustomPlace);
        localStorage.setItem('rekapitulasi_signatureDate', tempSignatureDate);

        setIsSettingsOpen(false);
        setNotification({ message: 'Pengaturan tanda tangan Rekapitulasi berhasil disimpan!', type: 'success' });
    };


    const monthsList = [
        { val: '01', label: 'Januari' }, { val: '02', label: 'Februari' }, { val: '03', label: 'Maret' },
        { val: '04', label: 'April' }, { val: '05', label: 'Mei' }, { val: '06', label: 'Juni' },
        { val: '07', label: 'Juli' }, { val: '08', label: 'Agustus' }, { val: '09', label: 'September' },
        { val: '10', label: 'Oktober' }, { val: '11', label: 'November' }, { val: '12', label: 'Desember' }
    ];

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        entries.forEach(e => { if (e.date) years.add(e.date.split('-')[0]); });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [entries]);

    const reportPeriodLabel = useMemo(() => {
        if (selectedMonth && selectedYear) {
            const m = monthsList.find(i => i.val === selectedMonth)?.label;
            return `${m} ${selectedYear}`;
        }
        if (selectedYear) return `Tahun ${selectedYear}`;
        return "Seluruh Periode";
    }, [selectedMonth, selectedYear]);

    // Filtered Data
    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (!e.date) return false;
            const [y, m] = e.date.split('-');
            const matchYear = selectedYear ? y === selectedYear : true;
            const matchMonth = selectedMonth ? m === selectedMonth : true;
            return matchYear && matchMonth;
        });
    }, [entries, selectedYear, selectedMonth]);

    const filteredDanaPunia = useMemo(() => {
        return danaPuniaItems.filter(item => {
            // Priority 1: Use item.date if available
            if (item.date) {
                const [y, m] = item.date.split('-');
                const matchYear = selectedYear ? y === selectedYear : true;
                const matchMonth = selectedMonth ? m === selectedMonth : true;
                return matchYear && matchMonth;
            }
            // Priority 2: Fallback to linked transaction date
            if (item.idTransaksi) {
                const linkedJu = entries.find(e => e.idTransaksi === item.idTransaksi);
                if (linkedJu && linkedJu.date) {
                    const [y, m] = linkedJu.date.split('-');
                    const matchYear = selectedYear ? y === selectedYear : true;
                    const matchMonth = selectedMonth ? m === selectedMonth : true;
                    return matchYear && matchMonth;
                }
            }
            // If no date and no linked transaction, include if no filter is active
            // OR if only year is selected and it matches the current year (fallback for legacy data)
            if (!selectedMonth && selectedYear === new Date().getFullYear().toString()) {
                return true;
            }
            return !selectedYear && !selectedMonth;
        });
    }, [danaPuniaItems, entries, selectedYear, selectedMonth]);

    // Table A: Sumber Dana (7.1) and Pengeluaran (LRA)
    const tableA = useMemo(() => {
        const rows: any[] = [];
        let runningSaldo = 0;

        // Sumber Dana (7.1) and Kas Urunan (1.1.1.08)
        filteredEntries.forEach(e => {
            if (e.kodeRekening?.startsWith('7.1')) {
                // For 7.1 (Sumber Dana), primary income is Kredit
                const amount = (e.kredit || 0) - (e.debet || 0);
                if (amount > 0) { // Only count income
                    runningSaldo += amount;
                    rows.push({
                        uraian: e.uraian,
                        debet: amount,
                        kredit: 0,
                        saldo: runningSaldo
                    });
                }
            } else if (e.kodeRekening === '1.1.1.08') {
                // For 1.1.1.08 (Kas Urunan), primary income is Debet
                const amount = (e.debet || 0) - (e.kredit || 0);
                if (amount > 0) { // Only count income
                    // Check if this transaction has a source account (7.x or 4.x)
                    // or if it's an internal mutation to another cash account
                    // to avoid double counting in Table A or Table B
                    const transactionRows = entries.filter(r => r.idTransaksi === e.idTransaksi);
                    const isAlreadyHandled = transactionRows.some(r => 
                        r.kodeRekening?.startsWith('7.') || 
                        r.kodeRekening?.startsWith('4.') ||
                        (r.kodeRekening?.startsWith('1.1') && r !== e)
                    );
                    
                    if (isAlreadyHandled) return;

                    runningSaldo += amount;
                    rows.push({
                        uraian: e.uraian,
                        debet: amount,
                        kredit: 0,
                        saldo: runningSaldo
                    });
                }
            }
        });

        // Pengeluaran (Total Belanja Tunai)
        // Replicating SaldoAkhir logic for "Belanja/Pengeluaran Tunai"
        let totalBelanjaTunai = 0;
        filteredEntries.forEach(e => {
            const isCashAccount = e.kodeRekening?.startsWith('1.1');
            if (!isCashAccount) return;

            const relatedRows = entries.filter(r => r.idTransaksi === e.idTransaksi);
            const debetCode = relatedRows.find(r => r.rowType === 'debet')?.kodeRekening || '';
            const kreditCode = relatedRows.find(r => r.rowType === 'kredit')?.kodeRekening || '';
            
            const isInternalMutation = debetCode.startsWith('1.1') && kreditCode.startsWith('1.1');
            if (isInternalMutation) return;

            if (e.kredit > 0) {
                totalBelanjaTunai += (e.kredit || 0);
            }
        });

        if (totalBelanjaTunai > 0) {
            runningSaldo -= totalBelanjaTunai;
            rows.push({
                uraian: 'Pengeluaran Dana Aci Pura Dalem',
                debet: 0,
                kredit: totalBelanjaTunai,
                saldo: runningSaldo
            });
        }

        return {
            rows,
            totalDebet: rows.reduce((sum, r) => sum + r.debet, 0),
            totalKredit: rows.reduce((sum, r) => sum + r.kredit, 0),
            finalSaldo: runningSaldo
        };
    }, [filteredEntries, entries]);

    // Table B: Pemasukan Dana Punia (Tunai, Transfer, Lainnya)
    const tableB = useMemo(() => {
        const rows: any[] = [];
        let runningSaldo = 0;

        const totals = {
            tunai: { debet: 0, kredit: 0 },
            transfer: { debet: 0, kredit: 0 },
            lainnya: { debet: 0, kredit: 0 },
            barang: { debet: 0, kredit: 0}
        };

        filteredEntries.forEach(e => {
            if (e.kodeRekening === '1.1.1.04') { totals.tunai.debet += (e.debet || 0); totals.tunai.kredit += (e.kredit || 0); }
            if (e.kodeRekening === '1.1.1.05') { totals.transfer.debet += (e.debet || 0); totals.transfer.kredit += (e.kredit || 0); }
            if (e.kodeRekening === '1.1.1.09') { totals.lainnya.debet += (e.debet || 0); totals.lainnya.kredit += (e.kredit || 0); }
        });

        // Calculate Barang from Dana Punia items (Non-Journal)
        const puniaBarangTotal = filteredDanaPunia
            .filter(i => i.type === 'barang' && i.idTransaksi === 'PUNIA-BARANG-SUMMARY')
            .reduce((sum, item) => sum + item.total, 0);
        
        totals.barang.debet = puniaBarangTotal;
        totals.barang.kredit = puniaBarangTotal;

        // Dana Punia Transfer (1.1.1.05)
        if (totals.transfer.debet > 0 || totals.transfer.kredit > 0) {
            runningSaldo += (totals.transfer.debet - totals.transfer.kredit);
            rows.push({
                uraian: 'Total Dana Punia Transfer',
                debet: totals.transfer.debet,
                kredit: totals.transfer.kredit,
                saldo: runningSaldo
            });
        }

        // Dana Punia Tunai (1.1.1.04)
        if (totals.tunai.debet > 0 || totals.tunai.kredit > 0) {
            runningSaldo += (totals.tunai.debet - totals.tunai.kredit);
            rows.push({
                uraian: 'Total Dana Punia Tunai',
                debet: totals.tunai.debet,
                kredit: totals.tunai.kredit,
                saldo: runningSaldo
            });
        }

        // Dana Punia Lainnya (1.1.1.09)
        if (totals.lainnya.debet > 0 || totals.lainnya.kredit > 0) {
            runningSaldo += (totals.lainnya.debet - totals.lainnya.kredit);
            rows.push({
                uraian: 'Total Dana Punia Lainnya',
                debet: totals.lainnya.debet,
                kredit: totals.lainnya.kredit,
                saldo: runningSaldo
            });
        }

        // Dana Punia Barang (1.1.1.06)
        if (totals.barang.debet > 0 || totals.barang.kredit > 0) {
            runningSaldo += (totals.barang.debet - totals.barang.kredit);
            rows.push({
                uraian: 'Total Dana Punia Barang',
                debet: totals.barang.debet,
                kredit: totals.barang.kredit,
                saldo: runningSaldo
            });
        }

        return {
            rows,
            totalDebet: rows.reduce((sum, r) => sum + r.debet, 0),
            totalKredit: rows.reduce((sum, r) => sum + r.kredit, 0),
            finalSaldo: runningSaldo
        };
    }, [filteredEntries, filteredDanaPunia]);

    // Table C: Pemasukan Lain-Lain (Sasah Abu, Penjualan, Lainnya)
    const tableC = useMemo(() => {
        const rows: any[] = [];
        let runningSaldo = 0;

        const totals = {
            sasahAbu: { debet: 0, kredit: 0 },
            penjualan: { debet: 0, kredit: 0 },
            lainnya: { debet: 0, kredit: 0 }
        };

        filteredEntries.forEach(e => {
            if (e.kodeRekening === '1.1.1.03') { totals.sasahAbu.debet += (e.debet || 0); totals.sasahAbu.kredit += (e.kredit || 0); }
            
            // Check for direct income accounts
            if (e.kodeRekening === '4.1.1.02' && e.kredit > 0) { // Sasah Abu
                const relatedRows = entries.filter(r => r.idTransaksi === e.idTransaksi);
                if (!relatedRows.some(r => r.kodeRekening === '1.1.1.03')) {
                    totals.sasahAbu.debet += e.kredit;
                }
            }
            if (e.kodeRekening === '4.1.1.03' && e.kredit > 0) { // Penjualan
                totals.penjualan.debet += e.kredit;
            }
            if (e.kodeRekening === '4.1.3.01' && e.kredit > 0) { // Lain-lain
                totals.lainnya.debet += e.kredit;
            }
        });

        if (totals.sasahAbu.debet > 0 || totals.sasahAbu.kredit > 0) {
            const amount = totals.sasahAbu.debet - totals.sasahAbu.kredit;
            runningSaldo += amount;
            rows.push({ uraian: 'Total Pendapatan Sasah Abu', debet: amount, kredit: 0, saldo: runningSaldo });
        }
        if (totals.penjualan.debet > 0) {
            runningSaldo += totals.penjualan.debet;
            rows.push({ uraian: 'Total Pendapatan Penjualan', debet: totals.penjualan.debet, kredit: 0, saldo: runningSaldo });
        }
        if (totals.lainnya.debet > 0) {
            runningSaldo += totals.lainnya.debet;
            rows.push({ uraian: 'Total Pendapatan Lain-lain', debet: totals.lainnya.debet, kredit: 0, saldo: runningSaldo });
        }

        return {
            rows,
            totalDebet: rows.reduce((sum, r) => sum + r.debet, 0),
            totalKredit: rows.reduce((sum, r) => sum + r.kredit, 0),
            finalSaldo: runningSaldo
        };
    }, [filteredEntries, entries]);

    // Table Penggenap: Dana Urunan (1.1.1.08) + Mutasi Punia/Lainnya
    const tablePenggenap = useMemo(() => {
        const rows: any[] = [];
        let runningSaldo = 0;

        filteredEntries.forEach(e => {
            // Rule: if 1.1.1.03/04/05/09 is credited, it becomes a source for Penggenap (A.1)
            const isSourceAccount = [
                '1.1.1.03', // Sasah Abu
                '1.1.1.04', // Punia Tunai
                '1.1.1.05', // Punia Transfer
                '1.1.1.09'  // Punia Lainnya
            ].includes(e.kodeRekening || '');

            if (isSourceAccount && (e.kredit || 0) > 0) {
                const amount = e.kredit || 0;
                runningSaldo += amount;
                rows.push({
                    uraian: `Mutasi Kas/Sumber Dana (${e.uraian || 'Tanpa Keterangan'})`,
                    debet: amount,
                    kredit: 0,
                    saldo: runningSaldo
                });
            }
        });

        return {
            rows,
            totalDebet: rows.reduce((sum, r) => sum + r.debet, 0),
            totalKredit: rows.reduce((sum, r) => sum + r.kredit, 0),
            finalSaldo: runningSaldo
        };
    }, [filteredEntries]);

    // Rekapitulasi Totals
    const rekap = useMemo(() => {
        const totalSumberDana = tableA.rows
            .filter(r => r.debet > 0 && r.uraian !== 'Pengeluaran Dana Aci Pura Dalem')
            .reduce((s, r) => s + r.debet, 0);
        
        const totalDanaPuniaUang = tableB.rows
            .filter(r => r.uraian.includes('Tunai') || r.uraian.includes('Transfer') || r.uraian.includes('Sasah Abu') || r.uraian.includes('Lainnya'))
            .reduce((sum, r) => sum + r.debet, 0);
            
        const totalDanaPuniaBarang = tableB.rows
            .find(r => r.uraian === 'Total Dana Punia Barang')?.debet || 0;

        const totalDanaPenggenap = tablePenggenap.totalDebet;

            
        const totalDanaPuniaAll = totalDanaPuniaUang + totalDanaPuniaBarang;

        const totalPemasukan = tableA.totalDebet + tableB.totalDebet + tableC.totalDebet + tablePenggenap.totalDebet;
        const totalPengeluaran = tableA.totalKredit + tableB.totalKredit + tableC.totalKredit + tablePenggenap.totalKredit;
        const saldoAkhir = totalPemasukan - totalPengeluaran;

        return {
            totalSumberDana,
            totalDanaPuniaUang,
            totalDanaPuniaBarang,
            totalDanaPuniaAll,
            totalDanaPenggenap,
            totalPemasukanLain: tableC.totalDebet,
            totalPemasukan,
            totalPengeluaran,
            saldoAkhir
        };
    }, [tableA, tableB, tableC, tablePenggenap]);

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
        <div className="space-y-8 animate-fade-in-up relative min-h-screen pb-20" id="rekap-printable-area">
            {/* Falling Particles */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden no-print">
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
                @media print {
                    * {
                        overflow: visible !important;
                    }
                    html, body {
                        width: 100%;
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: visible !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 15mm 10mm;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        line-height: 1.2;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #rekap-printable-area {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        page-break-after: always;
                    }
                    
                    /* Hide scrollbars for print */
                    ::-webkit-scrollbar {
                        display: none;
                    }
                    scrollbar-width: none;
                    
                    /* Remove rounded corners and shadows for print */
                    .rounded-3xl, .rounded-2xl, .rounded-xl, .rounded-lg {
                        border-radius: 0 !important;
                    }
                    .shadow-2xl, .shadow-xl, .shadow-lg, .shadow {
                        box-shadow: none !important;
                    }
                    
                    /* Container styling for print */
                    .bg-slate-900\\/50, .bg-slate-800\\/80, .bg-teal-900\\/20 {
                        border: none !important;
                        background: transparent !important;
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        page-break-inside: avoid;
                        margin-bottom: 10mm;
                    }
                    
                    /* Table styling for print */
                    table {
                        border: 1px solid black !important;
                        border-collapse: collapse !important;
                        font-size: 8px !important;
                        width: 100% !important;
                        page-break-inside: avoid;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tfoot {
                        display: table-footer-group;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                    th, td {
                        border: 1px solid black !important;
                        padding: 3px 4px !important;
                        color: black !important;
                        background: transparent !important;
                        word-wrap: break-word;
                    }
                    thead th {
                        background-color: #e5e7eb !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-weight: bold;
                    }
                    tfoot td {
                        background-color: #f3f4f6 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-weight: bold;
                    }
                    
                    /* Overflow handling */
                    .overflow-x-auto {
                        overflow-x: visible !important;
                    }
                    
                    /* Summary section styling */
                    .signature-section {
                        margin-top: 20mm;
                        page-break-inside: avoid;
                    }
                    
                    /* Print header */
                    .hidden.print\\:block {
                        page-break-after: avoid;
                        margin-bottom: 10mm;
                    }
                }
            `}</style>

            {/* Header / Controls */}
            <div className="bg-white border-b-4 border-emerald-500 pb-4 no-print relative z-10">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
            <div className="absolute -right-0 -bottom-0 p-4 opacity-10 text-emerald-400 pointer-events-none">
                <Calculator size={120} />
            </div>
        </div>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-4 bg-teal-500/20 rounded-2xl border border-teal-500/50 shrink-0 mt-1">
                            <Calculator className="h-8 w-8 text-teal-700" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-4 mb-1">
                                <h2 className="text-3xl font-black text-gray-900 tracking-tighter font-serif">
                                    Rekapitulasi</h2>
                                <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-300">
                                    Ikhtisar Komprehensif Arus Kas
                                </span>
                            </div>
                            <p className="text-emerald-700 text-sm font-medium">Laporan Ringkasan Arus Keuangan &amp; Posisi Kas Bersih</p>
                            <div className="mt-2 text-xs text-teal-700 w-full font-normal">
                                <p className="leading-relaxed">
                                    <strong className="text-teal-950 font-bold">Definisi Rekapitulasi:</strong> Ikhtisar komprehensif yang mengkonsolidasikan seluruh arus masuk (Sumber Dana, Punia, Penggenap) dan arus keluar belanja operasional guna menyajikan posisi surplus/defisit akhir.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-4">
                        <ExportPdfButton 
                            elementId="rekap-printable-area" 
                            filename={`Laporan_Rekapitulasi_${reportPeriodLabel.replace(/\s+/g, '_')}.pdf`} 
                            buttonText="Unduh PDF" 
                            variant="default"
                            defaultOrientation="portrait"
                            options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                        />
                    </div>
                </div>
            </div>
            <div className="bg-amber-900/30 p-2 border border-teal-600 rounded-xl no-print relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-gray-600">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <select 
                                value={selectedYear} 
                                onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth(''); }}
                                className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
                            >
                                <option value="" className="bg-slate-800">Semua Tahun</option>
                                {availableYears.map(y => <option key={y} value={y} className="bg-slate-800">{y}</option>)}
                            </select>
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer border border-gray-600 pl-2"
                            >
                                <option value="" className="bg-slate-800">Semua Bulan</option>
                                {monthsList.map(m => <option key={m.val} value={m.val} className="bg-slate-800">{m.label}</option>)}
                            </select>
                        </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => { setSelectedMonth(''); setSelectedYear(new Date().getFullYear().toString()); }}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs"
                            title="Reset Filter"
                        >
                            <RotateCcw size={18}/> Reset Filter
                        </button>
                        <button 
                            onClick={handleOpenSettings}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs"
                        >
                            <Settings size={18} /> PENGATURAN
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all uppercase tracking-widest text-xs"
                        >
                            <Printer size={18} /> CETAK 
                        </button>
                    </div>
                </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-8 relative z-10">
                {/* Print Header */}
                <div className="hidden print:block text-slate-900 mb-6">
                    <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                        <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                            DESA ADAT BASANGALAS
                        </h2>
                        <p className="text-sm font-bold text-slate-800 font-serif my-0.5 tracking-widest">
                            Tata Kelola Penatausahaan Kas Desa Adat
                        </p>
                        <p className="text-xs font-normal text-slate-700 font-serif m-0">
                            Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                        </p>
                    </div>

                    <div className="text-center mb-6">
                        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                            LAPORAN REKAPITULASI KEUANGAN
                        </h3>
                        <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                            Periode: {reportPeriodLabel}
                        </p>
                    </div>
                </div>

                {/* Table A */}
                {tableA.rows.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-500 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                    <div className="bg-slate-100 px-6 py-4 border-b border-gray-500 print:bg-transparent print:border-none print:px-0">
                        <h3 className="text-lg font-black text-teal-400 uppercase tracking-tighter print:text-black print:text-sm">
                            A. Sumber Dana & Pengeluaran</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-700 text-gray-100 uppercase text-[10px] font-black tracking-widest print:text-black print:bg-gray-200">
                                <tr>
                                    <th className="px-6 py-3 border-b border-gray-700">No</th>
                                    <th className="px-6 py-3 border-b border-gray-700">Uraian</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Debet</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Kredit</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 print:divide-black">
                                {tableA.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors print:text-black">
                                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{idx + 1}</td>
                                        <td className="px-6 py-3 font-medium text-gray-900 print:text-black">{row.uraian}</td>
                                        <td className="px-6 py-3 text-right text-emerald-500 font-mono print:text-black">{row.debet > 0 ? formatCurrency(row.debet) : '-'}</td>
                                        <td className="px-6 py-3 text-right text-rose-900 font-mono print:text-black">{row.kredit > 0 ? formatCurrency(row.kredit) : '-'}</td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-900 print:text-black">{formatCurrency(row.saldo)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-amber-500/20 font-bold print:bg-gray-100 print:text-black border-t-2 border border-gray-700">
                                <tr>
                                    <td colSpan={2} className="px-6 py-3 text-gray-900 uppercase text-[12px] print:text-black">Total A ( Sumber Dana & Pengeluaran )</td>
                                    <td className="px-6 py-3 text-right text-emerald-500 print:text-black">{formatCurrency(tableA.totalDebet)}</td>
                                    <td className="px-6 py-3 text-right text-rose-900 print:text-black">{formatCurrency(tableA.totalKredit)}</td>
                                    <td className="px-6 py-3 text-right text-teal-500 print:text-black">{formatCurrency(tableA.finalSaldo)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                )}
                
                {/* Tabel Dana Penggenap, Muncul apabila Pengeluaran minus & ada data */}
                {(tableA.finalSaldo < 0 && tablePenggenap.rows.length > 0) && (
                <div className="bg-white rounded-xl border border-gray-500 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                    <div className="bg-slate-100 px-6 py-4 border-b border-gray-500 print:bg-transparent print:border-none print:px-0">
                        <h3 className="text-lg font-black text-teal-400 uppercase tracking-tighter print:text-black print:text-sm">
                            A.1. Sumber Dana Penggenap</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-200 text-gray-800 uppercase text-[10px] font-black tracking-widest print:text-black print:bg-gray-200">
                                <tr>
                                    <th className="px-6 py-3 border-b border-gray-700">No</th>
                                    <th className="px-6 py-3 border-b border-gray-700">Uraian</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Debet</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Kredit</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 print:divide-black">
                                {tablePenggenap.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors print:text-black">
                                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{idx + 1}</td>
                                        <td className="px-6 py-3 font-medium text-gray-900 print:text-black">{row.uraian}</td>
                                        <td className="px-6 py-3 text-right text-emerald-500 font-mono print:text-black">{row.debet > 0 ? formatCurrency(row.debet) : '-'}</td>
                                        <td className="px-6 py-3 text-right text-rose-900 font-mono print:text-black">{row.kredit > 0 ? formatCurrency(row.kredit) : '-'}</td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-900 print:text-black">{formatCurrency(row.saldo)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-amber-500/20 font-bold print:bg-gray-100 print:text-black border-t-2 border border-gray-700">
                                <tr>
                                    <td colSpan={2} className="px-6 py-3 text-gray-900 uppercase text-[10px] print:text-black">Total Dana Penggenap</td>
                                    <td className="px-6 py-3 text-right text-emerald-500 print:text-black">{formatCurrency(tablePenggenap.totalDebet)}</td>
                                    <td className="px-6 py-3 text-right text-rose-900 print:text-black">{formatCurrency(tablePenggenap.totalKredit)}</td>
                                    <td className="px-6 py-3 text-right text-teal-500 print:text-black">{formatCurrency(tablePenggenap.finalSaldo)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                )}

                {/* Table B */}
                {tableB.rows.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-500 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                    <div className="bg-slate-100 px-6 py-4 border-b border-gray-500 print:bg-transparent print:border-none print:px-0">
                        <h3 className="text-lg font-black text-teal-400 uppercase tracking-tighter print:text-black print:text-sm">B. Pemasukan Dana Punia</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-700 text-gray-100 uppercase text-[10px] font-black tracking-widest print:text-black print:bg-gray-200">
                                <tr>
                                    <th className="px-6 py-3 border-b border-gray-700">No</th>
                                    <th className="px-6 py-3 border-b border-gray-700">Uraian</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Debet</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Kredit</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 print:divide-black">
                                {tableB.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors print:text-black">
                                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{idx + 1}</td>
                                        <td className="px-6 py-3 font-medium text-gray-900 print:text-black">{row.uraian}</td>
                                        <td className="px-6 py-3 text-right text-emerald-500 font-mono print:text-black">{row.debet > 0 ? formatCurrency(row.debet) : '-'}</td>
                                        <td className="px-6 py-3 text-right text-rose-900 font-mono print:text-black">{row.kredit > 0 ? formatCurrency(row.kredit) : '-'}</td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-900 print:text-black">{formatCurrency(row.saldo)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-amber-500/20 font-bold print:bg-gray-100 print:text-black border-t-2 border border-gray-700">
                                <tr>
                                    <td colSpan={2} className="px-6 py-3 text-gray-900 uppercase text-[12px] print:text-black">Total B ( Pemasukan Dana Punia )</td>
                                    <td className="px-6 py-3 text-right text-emerald-500 print:text-black">{formatCurrency(tableB.totalDebet)}</td>
                                    <td className="px-6 py-3 text-right text-rose-900 print:text-black">{formatCurrency(tableB.totalKredit)}</td>
                                    <td className="px-6 py-3 text-right text-teal-500 print:text-black">{formatCurrency(tableB.finalSaldo)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                )}

                {/* Table C */}
                {tableC.rows.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-500 shadow-2xl overflow-hidden print:border-none print:shadow-none">
                    <div className="bg-slate-100 px-6 py-4 border-b border-gray-500 print:bg-transparent print:border-none print:px-0">
                        <h3 className="text-lg font-black text-teal-400 uppercase tracking-tighter print:text-black print:text-sm">C. Pemasukan Lain-Lain</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-700 text-gray-100 uppercase text-[10px] font-black tracking-widest print:text-black print:bg-gray-200">
                                <tr>
                                    <th className="px-6 py-3 border-b border-gray-700">No</th>
                                    <th className="px-6 py-3 border-b border-gray-700">Uraian</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Debet</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Kredit</th>
                                    <th className="px-6 py-3 border-b border-gray-700 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 print:divide-black">
                                {tableC.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors print:text-black">
                                        <td className="px-6 py-3 font-mono text-xs text-gray-700">{idx + 1}</td>
                                        <td className="px-6 py-3 font-medium text-gray-900 print:text-black">{row.uraian}</td>
                                        <td className="px-6 py-3 text-right text-emerald-500 font-mono print:text-black">{row.debet > 0 ? formatCurrency(row.debet) : '-'}</td>
                                        <td className="px-6 py-3 text-right text-rose-900 font-mono print:text-black">{row.kredit > 0 ? formatCurrency(row.kredit) : '-'}</td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-900 print:text-black">{formatCurrency(row.saldo)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-amber-500/20 font-bold print:bg-gray-100 print:text-black border-t-2 border border-gray-700">
                                <tr>
                                    <td colSpan={2} className="px-6 py-3 text-gray-900 uppercase text-[12px] print:text-black">Total C ( Pemasukan Lain-Lain )</td>
                                    <td className="px-6 py-3 text-right text-emerald-500 print:text-black">{formatCurrency(tableC.totalDebet)}</td>
                                    <td className="px-6 py-3 text-right text-rose-900 print:text-black">{formatCurrency(tableC.totalKredit)}</td>
                                    <td className="px-6 py-3 text-right text-teal-500 print:text-black">{formatCurrency(tableC.finalSaldo)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                )}

                {tableA.rows.length === 0 && tableB.rows.length === 0 && tableC.rows.length === 0 && (
                    <div className="bg-white rounded-xl border border-gray-300 p-8 text-center text-gray-600 font-medium italic shadow">
                        Tidak ada data rekapitulasi untuk periode {reportPeriodLabel}
                    </div>
                )}

                {/* Summary Section */}
                <div className="bg-white rounded-xl border border-gray-500 shadow-2xl p-6 no-print">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 border-b border-gray-700 pb-4">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter print:text-black print:border-black print:text-lg">
                                Rekapitulasi Akhir
                            </h3>
                            <p className="text-xs text-slate-500 font-sans mt-0.5">
                                Ringkasan konsolidasi penerimaan & pengeluaran kas
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsNaratifModalOpen(true)}
                            className="flex items-center gap-2 text-xs font-black bg-amber-300 hover:bg-amber-400 text-amber-950 uppercase tracking-wider border-2 border-amber-600 px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer no-print group"
                            title="Buka Naskah Narasi Rekapitulasi Akhir Ramah Krama"
                        >
                            <FileText size={16} className="text-amber-900 group-hover:scale-110 transition-transform" />
                            <span>Buka &amp; Cetak Narasi</span>
                        </button>
                    </div>
                    <div className="flex flex-col gap-y-4 text-gray-900 print:text-black">
                        <div className="bg-green-800/10 flex justify-between items-center py-2 border-b border-dashed border-emerald-500 print:border-gray-300">
                            <span className="text-sm px-4 font-bold">A. Total Penerimaan Sumber Dana</span>
                            <span className="px-4 font-mono font-bold text-emerald-400 print:text-black">{formatCurrency(rekap.totalSumberDana)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-300 print:border-gray-300">
                            <span className="text-sm px-6 italic text-gray-700">---B.1. Total Penerimaan Dana Punia (Uang)</span>
                            <span className="px-24 font-mono font-bold text-amber-900 print:text-black">{formatCurrency(rekap.totalDanaPuniaUang)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-dashed border-amber-700 print:border-gray-300">
                            <span className="text-sm px-6 italic text-gray-700">---B.2. Total Penerimaan Dana Punia Barang</span>
                            <span className="px-24 font-mono font-bold text-amber-900 print:text-black">{formatCurrency(rekap.totalDanaPuniaBarang)}</span>
                        </div>
                        <div className="bg-blue-800/10 flex justify-between items-center py-2 border-b border-gray-800 print:border-gray-300">
                            <span className="text-sm px-4 font-bold">B. Total Penerimaan Dana Punia (Uang + Barang)</span>
                            <span className="px-4 font-mono font-bold text-emerald-400 print:text-black">{formatCurrency(rekap.totalDanaPuniaAll)}</span>
                        </div>  
                        <div className="bg-blue-800/10 flex justify-between items-center py-2 border-b border-gray-800 print:border-gray-300">
                            <span className="text-sm px-4 font-bold">C. Total Dana Penggenap</span>
                            <span className="px-4 font-mono font-bold text-emerald-400 print:text-black">{formatCurrency(rekap.totalDanaPenggenap)}</span>
                        </div>  
                        <div className="bg-blue-800/10 flex justify-between items-center py-2 border-b border-gray-800 print:border-gray-300">
                            <span className="text-sm px-4 font-bold">D. Total Penerimaan Lainnya</span>
                            <span className="px-4 font-mono font-bold text-emerald-400 print:text-black">{formatCurrency(rekap.totalPemasukanLain)}</span>
                        </div>  
                        <div className="bg-emerald-800/10 flex justify-between items-center py-2 border border-gray-800 p-4 rounded-xl print:border-gray-300">
                            <span className="font-lg font-bold">Total Pemasukan (A + B + Penggenap + C)</span>
                            <span className="font-mono font-bold text-emerald-400 print:text-black">{formatCurrency(rekap.totalPemasukan)}</span>
                        </div>
                        <div className="bg-amber-800/20 flex justify-between items-center py-2 border border-gray-800 p-4 rounded-xl print:border-gray-300">
                            <span className="font-lg font-bold">Total Pengeluaran (A + B + Penggenap + C)</span>
                            <span className="font-mono font-bold text-rose-900 print:text-black">{formatCurrency(rekap.totalPengeluaran)}</span>
                        </div>
                        <div className="flex justify-between items-center py-4 mt-4 bg-teal-900/20 px-4 rounded-2xl border border-teal-500/30 print:bg-transparent print:border-gray-900 print:px-0">
                            <span className="text-xl font-black text-teal-400 uppercase tracking-tighter print:text-black">Saldo Akhir</span>
                            <span className="text-2xl font-black text-emerald-400 font-mono print:text-black">{formatCurrency(rekap.saldoAkhir)}</span>
                        </div>
                    </div>
                </div>

                {/* Signature Section */}
                <div className="hidden print:flex justify-between mt-12 px-10 text-black text-sm italic font-serif signature-section">
                    <div className="text-center w-64">
                        <p>Mengetahui,</p>
                        <p className="font-semibold">Keliang Adat Basangalas</p>
                        <div className="h-24"></div>
                        <p className="font border-b border-black">{keliangName}</p>
                    </div>
                    <div className="text-center w-64">
                        <p>{customPlace}, {formatLongDate(signatureDate)}</p>
                        <p className="font-semibold">Juru Raksa</p>
                        <div className="h-24"></div>
                        <p className="font border-b border-black">{juruRaksaName}</p>
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
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Juru Raksa (Bendahara)</label>
                            <input type="text" value={tempJuruRaksaName} onChange={e => setTempJuruRaksaName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Penyarikan (Sekretaris)</label>
                            <input type="text" value={tempPenyarikanName} onChange={e => setTempPenyarikanName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Badan Pengawas</label>
                            <input type="text" value={tempPengawasName} onChange={e => setTempPengawasName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <button onClick={handleSaveSettings} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest">Simpan Perubahan</button>
                    </div>
                </Modal>

                {/* TEMPLATE MODAL NARASI REKAPITULASI AKHIR */}
                <RekapitulasiNaratifTemplateModal
                    isOpen={isNaratifModalOpen}
                    onClose={() => setIsNaratifModalOpen(false)}
                    reportPeriodLabel={reportPeriodLabel}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    entries={filteredEntries}
                    rekap={rekap}
                    keliangName={keliangName}
                    juruRaksaName={juruRaksaName}
                    penyarikanName={penyarikanName}
                    pengawasName={pengawasName}
                    customPlace={customPlace}
                    signatureDate={signatureDate}
                />

                {notification && (
                    <Notification 
                        message={notification.message} 
                        type={notification.type} 
                        onClose={() => setNotification(null)} 
                    />
                )}
            </div>
        </div>
    );
};

export default Rekapitulasi;
