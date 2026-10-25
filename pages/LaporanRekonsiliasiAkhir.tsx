import React, { useMemo, useState, useEffect } from 'react';
import type { JuDisplayRow, BudgetItem, ManualBudgetCaps } from '../types';
import { 
  Printer, 
  Settings, 
  FileText, 
  Calendar, 
  Filter, 
  RotateCcw, 
  Info, 
  Palette, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Layout, 
  FileSpreadsheet, 
  Maximize2,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  X,
  FileSignature,
  Stamp
} from 'lucide-react';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import { formatCurrency, formatDate, formatLongDate } from '../utils/formatter';
import { REFERENSI_REKENING } from '../constants';
import { useNotification } from '../context/NotificationContext';
import { ExportPdfButton } from '../components/shared/ExportPdfButton';
import { LraBudgetComparisonChart } from '../components/lra/LraBudgetComparisonChart';
import { LraAdatSummary } from '../components/lra/LraAdatSummary';
import { LraFullScreenAdatModal } from '../components/lra/LraFullScreenAdatModal';
import { LraFullScreenModal } from '../components/lra/LraFullScreenModal';
import { LraSignatureBlock } from '../components/lra/LraSignatureBlock';
import { LraVarianceExplanation } from '../components/lra/LraVarianceExplanation';
import { 
  saveSignatureSettings, 
  setStampOverlayEnabled, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled,
  getStampScale,
  setStampScale
} from '../utils/signatureStorage';
import { 
  calculateLraReportData, 
  MONTHS_LIST, 
  OperationalRow, 
  LraGroupData, 
  LraReportDataProps 
} from '../utils/lraCalculator';
import LraNaratifTemplateModal from '../components/lra/LraNaratifTemplateModal';

const LaporanRekonsiliasiAkhir: React.FC<{ entries: JuDisplayRow[]; budgetItems: BudgetItem[]; manualBudgetCaps: ManualBudgetCaps }> = ({ entries, budgetItems }) => {
    const { showNotification } = useNotification();
    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('lra_keliangName') || 'I Made Mudita');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('lra_juruRaksaName') || 'I Putu Gede Sutrana');
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('lra_customPlace') || 'Basangalas');
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('lra_signatureDate') || new Date().toISOString().split('T')[0]);
    const [penyarikanName, setPenyarikanName] = useState(() => localStorage.getItem('lra_penyarikanName') || '');
    const [pengawasName, setPengawasName] = useState(() => localStorage.getItem('lra_pengawasName') || '');
    const [isNaratifModalOpen, setIsNaratifModalOpen] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    // Filter States
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    // View & Print States
    const [viewMode, setViewMode] = useState<'detailed' | 'adat'>('detailed');
    const [isFullScreenModalOpen, setIsFullScreenModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [printColorMode, setPrintColorMode] = useState<'color' | 'monochrome'>('color');
    const [includeChartInPrint, setIncludeChartInPrint] = useState<boolean>(false);
    const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);

    // Digital Signatures & Stamp Automation State
    const [autoEmbedSignatures, setAutoEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
    const [showStampOverlay, setShowStampOverlay] = useState<boolean>(() => isStampOverlayEnabled());
    const [tempAutoEmbed, setTempAutoEmbed] = useState<boolean>(autoEmbedSignatures);
    const [tempShowStamp, setTempShowStamp] = useState<boolean>(showStampOverlay);
    const [tempStampScale, setTempStampScale] = useState<number>(() => getStampScale());

    useEffect(() => {
        const syncSigs = () => {
            const embed = isAutoEmbedSignaturesEnabled();
            const stamp = isStampOverlayEnabled();
            setAutoEmbedSignatures(embed);
            setShowStampOverlay(stamp);
            setTempAutoEmbed(embed);
            setTempShowStamp(stamp);
            setTempStampScale(getStampScale());
        };
        syncSigs();
        window.addEventListener('signatures-updated', syncSigs);
        return () => window.removeEventListener('signatures-updated', syncSigs);
    }, []);

    // Temp Signature Settings State
    const [tempKeliangName, setTempKeliangName] = useState(keliangName);
    const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
    const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
    const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
    const [tempPenyarikanName, setTempPenyarikanName] = useState(penyarikanName);
    const [tempPengawasName, setTempPengawasName] = useState(pengawasName);
    
    const handleOpenSettings = () => {
        setTempKeliangName(keliangName);
        setTempJuruRaksaName(juruRaksaName);
        setTempCustomPlace(customPlace);
        setTempSignatureDate(signatureDate);
        setTempPenyarikanName(penyarikanName);
        setTempPengawasName(pengawasName);
        setTempAutoEmbed(isAutoEmbedSignaturesEnabled());
        setTempShowStamp(isStampOverlayEnabled());
        setTempStampScale(getStampScale());
        setIsSettingsOpen(true);
    };

    const handleSaveSettings = () => {
        setKeliangName(tempKeliangName);
        setJuruRaksaName(tempJuruRaksaName);
        setCustomPlace(tempCustomPlace);
        setSignatureDate(tempSignatureDate);
        setPenyarikanName(tempPenyarikanName);
        setPengawasName(tempPengawasName);

        localStorage.setItem('lra_keliangName', tempKeliangName);
        localStorage.setItem('lra_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('lra_customPlace', tempCustomPlace);
        localStorage.setItem('lra_signatureDate', tempSignatureDate);
        localStorage.setItem('lra_penyarikanName', tempPenyarikanName);
        localStorage.setItem('lra_pengawasName', tempPengawasName);

        saveSignatureSettings({ autoEmbed: tempAutoEmbed });
        setStampOverlayEnabled(tempShowStamp);
        setStampScale(tempStampScale);
        setAutoEmbedSignatures(tempAutoEmbed);
        setShowStampOverlay(tempShowStamp);
        window.dispatchEvent(new Event('signatures-updated'));

        setIsSettingsOpen(false);
        showNotification('Pengaturan tanda tangan & stempel Laporan Rekonsiliasi Akhir berhasil disimpan!', 'success');
    };

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        entries.forEach(e => { if (e.date) years.add(e.date.split('-')[0]); });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [entries]);

    // Calculate LRA Report Data via centralized utility
    const { reportData, periodLabel: reportPeriodLabel } = useMemo(() => {
        return calculateLraReportData(entries, budgetItems, {
            startDate,
            endDate,
            selectedYear,
            selectedMonth
        });
    }, [entries, budgetItems, startDate, endDate, selectedYear, selectedMonth]);

    //  ( TAMBAHAN CETAK NARASI ) Filtered Entries based on active date range or year/month
    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (!e.date) return false;
            if (startDate && endDate) {
                return e.date >= startDate && e.date <= endDate;
            }
            if (startDate) {
                return e.date >= startDate;
            }
            if (endDate) {
                return e.date <= endDate;
            }
            const [y, m] = e.date.split('-');
            const matchYear = selectedYear ? y === selectedYear : true;
            const matchMonth = selectedMonth ? m === selectedMonth : true;
            return matchYear && matchMonth;
        });
    }, [entries, startDate, endDate, selectedYear, selectedMonth]);

    //  ( TAMBAHAN CETAK NARASI ) Rekapitulasi Summary for Naratif Modal
    const rekap = useMemo(() => {
        let totalSumberDana = reportData.sumberdana.totalRealisasi;
        if (totalSumberDana === 0) {
            filteredEntries.forEach(e => {
                if (e.kodeRekening?.startsWith('7.')) {
                    totalSumberDana += ((e.kredit || 0) - (e.debet || 0));
                }
            });
            if (totalSumberDana < 0) totalSumberDana = 0;
        }

        let puniaUang = 0;
        let puniaBarang = 0;
        let sasahAbu = 0;
        let pendapatanLain = 0;

        filteredEntries.forEach(e => {
            if (e.kodeRekening === '1.1.1.04' || e.kodeRekening === '1.1.1.05' || e.kodeRekening === '1.1.1.09') {
                puniaUang += Math.max(0, (e.debet || 0) - (e.kredit || 0));
            } else if (e.kodeRekening === '4.1.1.01' && (e.kredit || 0) > 0) {
                const hasCashPunia = filteredEntries.some(r => r.idTransaksi === e.idTransaksi && (r.kodeRekening === '1.1.1.04' || r.kodeRekening === '1.1.1.05' || r.kodeRekening === '1.1.1.09'));
                if (!hasCashPunia) {
                    puniaUang += ((e.kredit || 0) - (e.debet || 0));
                }
            } else if (e.kodeRekening === '1.1.1.06') {
                puniaBarang += Math.max(0, (e.debet || 0) - (e.kredit || 0));
            } else if (e.kodeRekening === '1.1.1.03' || e.kodeRekening === '4.1.1.01') {
                sasahAbu += Math.max(0, (e.debet || 0) || (e.kredit || 0));
            } else if (e.kodeRekening?.startsWith('4.1.3') || e.kodeRekening === '4.1.1.01') {
                pendapatanLain += Math.max(0, (e.kredit || 0) - (e.debet || 0));
            }
        });

        const totalDanaPuniaUang = puniaUang;
        const totalDanaPuniaBarang = puniaBarang;
        const totalDanaPuniaAll = totalDanaPuniaUang + totalDanaPuniaBarang;
        const totalPemasukanLain = pendapatanLain + sasahAbu;

        const totalPemasukan = (reportData.sumberdana.totalRealisasi + reportData.pendapatan.totalRealisasi) || (totalSumberDana + totalDanaPuniaAll + totalPemasukanLain);
        const totalPengeluaran = reportData.totalBelanjaRealisasi;
        const saldoAkhir = totalPemasukan - totalPengeluaran;

        return {
            totalSumberDana,
            totalDanaPuniaUang,
            totalDanaPuniaBarang,
            totalDanaPuniaAll,
            totalPemasukanLain,
            totalPemasukan,
            totalPengeluaran,
            saldoAkhir
        };
    }, [filteredEntries, reportData]); // AKHIR TAMBAHAN NARASI

    const handleTriggerPrint = (mode: 'color' | 'monochrome' = printColorMode, withChart: boolean = includeChartInPrint) => {
        setPrintColorMode(mode);
        setIncludeChartInPrint(withChart);
        setIsPrintMenuOpen(false);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handlePresetAll = () => {
        setStartDate('');
        setEndDate('');
        setSelectedYear('');
        setSelectedMonth('');
    };

    const handlePresetThisYear = () => {
        setStartDate('');
        setEndDate('');
        setSelectedYear(new Date().getFullYear().toString());
        setSelectedMonth('');
    };

    const handlePresetThisMonth = () => {
        const now = new Date();
        const curYear = now.getFullYear().toString();
        const curMonth = String(now.getMonth() + 1).padStart(2, '0');
        setStartDate('');
        setEndDate('');
        setSelectedYear(curYear);
        setSelectedMonth(curMonth);
    };

    const handlePresetQuarter = (quarterNum: number) => {
        const yr = selectedYear || new Date().getFullYear().toString();
        setSelectedMonth('');
        if (quarterNum === 1) {
            setStartDate(`${yr}-01-01`);
            setEndDate(`${yr}-03-31`);
        } else if (quarterNum === 2) {
            setStartDate(`${yr}-04-01`);
            setEndDate(`${yr}-06-30`);
        } else if (quarterNum === 3) {
            setStartDate(`${yr}-07-01`);
            setEndDate(`${yr}-09-30`);
        } else if (quarterNum === 4) {
            setStartDate(`${yr}-10-01`);
            setEndDate(`${yr}-12-31`);
        }
    };

    const handleResetFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedYear(new Date().getFullYear().toString());
        setSelectedMonth('');
    };

    const hasActiveFilter = Boolean(startDate || endDate || selectedMonth || (selectedYear && selectedYear !== new Date().getFullYear().toString()));

    const isMonthFilterActive = useMemo(() => {
        if (selectedMonth && selectedMonth !== '') return true;
        if (startDate && endDate) {
            const startM = startDate.slice(0, 7);
            const endM = endDate.slice(0, 7);
            if (startM === endM) {
                return true;
            }
        }
        return false;
    }, [selectedMonth, startDate, endDate]);

    const GroupSection = ({ data }: { data: LraGroupData }) => {
        if (!data || !data.rows || data.rows.length === 0) return null;
        return (
            <>
                <tr className="lra-group-header bg-slate-200">
                    <td colSpan={isMonthFilterActive ? 3 : 5} className="px-6 py-3 font-black text-teal-700 uppercase text-xs tracking-tighter">{data.label}</td>
                </tr>
                {data.rows.map((r: OperationalRow, idx: number) => {
                    const isRev = r.kode.startsWith('4') || r.kode.startsWith('7') || r.kode.startsWith('6');
                    return (
                        <tr key={`${r.kode}-${idx}`} className="lra-data-row hover:bg-gray-200 transition-colors border-b border-gray-300 break-inside-avoid">
                            <td className="px-6 py-3 font-mono text-[11px] text-gray-700">{r.kode}</td>
                            <td className="px-6 py-3 font-medium text-gray-900">{r.uraian}</td>
                            {!isMonthFilterActive && (
                                <td className="px-6 py-3 text-right font-sans text-gray-700">{r.anggaran > 0 ? formatCurrency(r.anggaran) : '-'}</td>
                            )}
                            <td className="px-6 py-3 text-right font-sans text-gray-700">{formatCurrency(r.realisasi)}</td>
                            {!isMonthFilterActive && (
                                <td className={`selisih-col px-6 py-3 text-right font-sans font-medium ${isRev ? (r.selisih >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700') : (r.selisih >= 0 ? 'text-teal-700' : 'text-rose-700 font-bold')}`}>
                                    {isRev ? (r.selisih > 0 ? `+${formatCurrency(r.selisih)}` : formatCurrency(r.selisih)) : formatCurrency(r.selisih)}
                                </td>
                            )}
                        </tr>
                    );
                })}
            </>
        );
    };

    return (
        <div className="space-y-6">
            <style>{`
                @media print {
                    @page {
                        margin: 10mm;
                    }
                    body {
                        background-color: white !important;
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    body:not(.print-lra-naratif-mode):not(.print-rekap-naratif-mode) #lra-printable-area, 
                    body:not(.print-lra-naratif-mode):not(.print-rekap-naratif-mode) #lra-onepage-printable-container, 
                    body:not(.print-lra-naratif-mode):not(.print-rekap-naratif-mode) #lra-onepage-fullscreen-printable {
                        display: block !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background-color: white !important;
                        background: white !important;
                    }
                    body.print-lra-naratif-mode #lra-printable-area,
                    body.print-lra-naratif-mode #lra-onepage-printable-container,
                    body.print-lra-naratif-mode #lra-onepage-fullscreen-printable,
                    body.print-rekap-naratif-mode #lra-printable-area,
                    body.print-rekap-naratif-mode #lra-onepage-printable-container,
                    body.print-rekap-naratif-mode #lra-onepage-fullscreen-printable {
                        display: none !important;
                        visibility: hidden !important;
                    }
                    .print-formal-header {
                        display: block !important;
                    }
                    
                    /* ============================================================ */
                    /* 1. COLOR PRINT MODE                                          */
                    /* ============================================================ */
                    .print-mode-color table {
                        border: 1px solid #cbd5e1 !important;
                    }
                    .print-mode-color th, .print-mode-color td {
                        border: 1px solid #cbd5e1 !important;
                        padding: 6px !important;
                    }
                    .print-mode-color thead th {
                        background-color: #0f172a !important;
                        color: white !important;
                    }
                    .print-mode-color .lra-group-header td {
                        background-color: #f1f5f9 !important;
                        color: #0f766e !important;
                        font-weight: bold !important;
                    }
                    .print-mode-color .lra-row-subtotal td {
                        background-color: #064e3b !important;
                        color: white !important;
                        font-weight: bold !important;
                    }
                    .print-mode-color .lra-row-belanja-header td {
                        background-color: #334155 !important;
                        color: white !important;
                        font-weight: bold !important;
                    }
                    .print-mode-color .lra-row-total-belanja td {
                        background-color: #1e293b !important;
                        color: white !important;
                        font-weight: bold !important;
                    }
                    .print-mode-color .lra-row-surplus td {
                        background-color: #f0fdfa !important;
                        color: #0f766e !important;
                        border-top: 3px solid #0d9488 !important;
                    }
                    .print-mode-color .text-emerald-700 { color: #047857 !important; }
                    .print-mode-color .text-teal-700 { color: #0f766e !important; }
                    .print-mode-color .text-amber-700 { color: #b45309 !important; }
                    .print-mode-color .text-rose-700 { color: #be123c !important; }
                    .print-mode-color .text-slate-800 { color: #1e293b !important; }

                    .print-mode-color .lra-chart-printable {
                        border: 1px solid #94a3b8 !important;
                        background-color: #f8fafc !important;
                        color: #0f172a !important;
                        page-break-inside: avoid !important;
                        margin-bottom: 20px !important;
                    }

                    /* ============================================================ */
                    /* 2. MONOCHROME PRINT MODE (STANDAR HITAM PUTIH / BG-WHITE)    */
                    /* ============================================================ */
                    .print-mode-monochrome,
                    .print-mode-monochrome div,
                    .print-mode-monochrome section,
                    .print-mode-monochrome article {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                    }

                    /* Tabel Rinci LRA (Monochrome) */
                    .print-mode-monochrome table {
                        border: 1.5px solid #000000 !important;
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        border-collapse: collapse !important;
                        width: 100% !important;
                    }
                    .print-mode-monochrome th, 
                    .print-mode-monochrome td { 
                        border: 1px solid #000000 !important; 
                        padding: 5px 8px !important; 
                        color: #000000 !important; 
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                    }
                    .print-mode-monochrome thead th {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border-bottom: 2px solid #000000 !important;
                        font-weight: 900 !important;
                        text-transform: uppercase !important;
                    }
                    .print-mode-monochrome .lra-group-header td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-weight: bold !important;
                        border-top: 1.5px solid #000000 !important;
                        border-bottom: 1px solid #000000 !important;
                        text-decoration: underline !important;
                    }
                    .print-mode-monochrome .lra-data-row td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: 1px solid #333333 !important;
                    }
                    .print-mode-monochrome .lra-row-subtotal td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-weight: bold !important;
                        border-top: 1.5px solid #000000 !important;
                        border-bottom: 1.5px solid #000000 !important;
                    }
                    .print-mode-monochrome .lra-row-total-penerimaan td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-weight: 900 !important;
                        border-top: 2px solid #000000 !important;
                        border-bottom: 2px solid #000000 !important;
                    }
                    .print-mode-monochrome .lra-row-belanja-header td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-weight: 900 !important;
                        border-top: 2px solid #000000 !important;
                        border-bottom: 1.5px solid #000000 !important;
                    }
                    .print-mode-monochrome .lra-row-total-belanja td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-weight: 900 !important;
                        border-top: 2px solid #000000 !important;
                        border-bottom: 2px solid #000000 !important;
                    }
                    .print-mode-monochrome .lra-row-surplus td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-weight: 900 !important;
                        border-top: 3px double #000000 !important;
                        border-bottom: 3px double #000000 !important;
                    }

                    /* All text overrides for monochrome */
                    .print-mode-monochrome .text-emerald-700,
                    .print-mode-monochrome .text-teal-700,
                    .print-mode-monochrome .text-teal-800,
                    .print-mode-monochrome .text-teal-900,
                    .print-mode-monochrome .text-teal-950,
                    .print-mode-monochrome .text-amber-700,
                    .print-mode-monochrome .text-rose-700,
                    .print-mode-monochrome .text-rose-500,
                    .print-mode-monochrome .text-rose-800,
                    .print-mode-monochrome .text-slate-800,
                    .print-mode-monochrome .text-slate-900,
                    .print-mode-monochrome .text-slate-950,
                    .print-mode-monochrome .text-slate-100,
                    .print-mode-monochrome .text-gray-100,
                    .print-mode-monochrome .text-emerald-200,
                    .print-mode-monochrome .selisih-col,
                    .print-mode-monochrome .realisasi-belanja-col,
                    .print-mode-monochrome .surplus-positive,
                    .print-mode-monochrome .surplus-negative {
                        color: #000000 !important;
                    }

                    /* Ringkasan 1 Halaman Macro Cards & Progress (Monochrome) */
                    .print-mode-monochrome .bg-emerald-50\\/80,
                    .print-mode-monochrome .bg-slate-100,
                    .print-mode-monochrome .bg-teal-50\\/80,
                    .print-mode-monochrome .bg-teal-900,
                    .print-mode-monochrome .bg-rose-900,
                    .print-mode-monochrome .bg-teal-50,
                    .print-mode-monochrome .bg-slate-50,
                    .print-mode-monochrome .bg-slate-700,
                    .print-mode-monochrome .bg-slate-800,
                    .print-mode-monochrome .bg-slate-200,
                    .print-mode-monochrome .bg-teal-100,
                    .print-mode-monochrome .bg-rose-100 {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }

                    .print-mode-monochrome [class*="bg-"] {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                    }

                    .print-mode-monochrome [class*="border-"] {
                        border-color: #000000 !important;
                    }

                    .print-mode-monochrome span,
                    .print-mode-monochrome p,
                    .print-mode-monochrome h1,
                    .print-mode-monochrome h2,
                    .print-mode-monochrome h3,
                    .print-mode-monochrome h4,
                    .print-mode-monochrome td,
                    .print-mode-monochrome th {
                        color: #000000 !important;
                    }

                    .signature-section { 
                        display: flex !important; 
                        page-break-inside: avoid !important; 
                        margin-top: 30px; 
                    }

                    .lra-narrative-printable {
                        display: block !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin-top: 20px !important;
                        margin-bottom: 20px !important;
                    }
                    .print-mode-monochrome .lra-narrative-printable {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: 1.5px solid #000000 !important;
                    }
                }
            `}</style>

            {/* CONTROL PANEL - HANYA TAMPIL SAAT VIEWING, HILANG SAAT CETAK */}
            <div className="bg-white p-4 pt-0 text-left">
                <div className="space-y-3 no-print p-2 sm:p-4">
                    {/* Header Title Section */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-10 border-b-4 border-gray-400 pb-3">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-3 sm:p-3.5 bg-teal-50 rounded-2xl border border-teal-200 shadow-sm shrink-0 mt-0.5">
                                <FileText size={24} className="text-teal-700" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h2 className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight leading-tight font-serif">
                                        Laporan Realisasi Anggaran (LRA) &amp; Belanja
                                    </h2>
                                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                                        PSAP 02 / Standar LRA
                                    </span>
                                </div>
                                <p className="text-teal-700 text-xs sm:text-sm text-left font-bold">
                                    Otomatisasi &amp; Penyelarasan Realisasi Pendapatan dengan Belanja Adat
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Definition info box */}
                    <div className="text-xs text-slate-700 bg-amber-50/90 border border-amber-200 rounded-xl px-3 py-1.5 w-full flex items-start gap-2 shadow-2xs">
                        <Info size={14} className="text-amber-700 mt-0.5 shrink-0" />
                        <p className="leading-snug">
                            <strong className="text-amber-950 font-bold">Definisi Akuntansi (LRA):</strong> Laporan akuntabilitas keuangan yang menyandingkan pagu anggaran terencana dengan realisasi aktual pos penerimaan pendapatan, sumber dana, dan belanja adat serta menghitung selisih / varians anggarannya.
                        </p>
                    </div>

                    {/* =========================================================================
                        BARIS 1: BOX (RINGKASAN 1 HALAMAN - TABEL RINCI) & MENU DALAM 1 BARIS
                        ========================================================================= */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center border border-slate-300 p-2 sm:p-2.5 rounded-2xl justify-between gap-2.5 bg-slate-50 no-print shadow-xs">
                        {/* Kiri: Segmented Switcher (Ringkasan 1 Halaman | Tabel Rinci) + Modal Fullscreen Button */}
                        <div className="flex flex-wrap items-center gap-2 max-w-full overflow-hidden">
                            <div className="inline-flex p-1 bg-slate-200/90 border border-slate-300 rounded-xl shadow-inner max-w-full overflow-x-auto scrollbar-none">
                                <button
                                    onClick={() => setViewMode('detailed')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                                        viewMode === 'detailed'
                                            ? 'bg-teal-800 text-white shadow-sm scale-100'
                                            : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/60'
                                    }`}
                                    title="Tampilan Detail Per Pos Rekening Akun dan Subtotal"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Tabel Rinci LRA</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('adat')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                                        viewMode === 'adat'
                                            ? 'bg-teal-800 text-white shadow-sm scale-100'
                                            : 'text-slate-700 hover:text-slate-950 hover:bg-slate-300/60'
                                    }`}
                                    title="Tampilan Ringkasan Khusus Pos Rekening Adat"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>One Page Summary Adat</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* Kanan: Tombol Menu (Filter, Tanda Tangan, Cetak, Ekspor) dalam 1 Baris */}
                        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 sm:gap-2 w-full lg:w-auto">
                            {/* Tombol Status Otomatisasi Tanda Tangan & Stempel */}
                            <div 
                              onClick={handleOpenSettings}
                              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-slate-200 transition-colors shadow-2xs"
                              title="Status Otomatisasi Tanda Tangan & Stempel (Klik untuk mengubah)"
                            >
                              <span className={autoEmbedSignatures ? 'text-emerald-700' : 'text-slate-500'}>
                                TTD: {autoEmbedSignatures ? 'ON' : 'OFF'}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className={showStampOverlay ? 'text-rose-700' : 'text-slate-500'}>
                                Stempel: {showStampOverlay ? 'ON' : 'OFF'}
                              </span>
                            </div>
                           {/* Tombol Filter dengan Toggle Sembunyikan/Tampilkan */}
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-xs ${
                                    isFilterOpen 
                                        ? 'bg-teal-800 text-white border-teal-900 ring-2 ring-teal-600/30' 
                                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                                title="Klik untuk membuka / menutup menu filter periode & rentang tanggal"
                            >
                                <Filter size={14} className={isFilterOpen ? 'text-amber-300' : 'text-teal-700'} />
                                <span>Filter</span>
                                {hasActiveFilter && (
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                )}
                                {isFilterOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>                           
                        </div>
                    </div>

                    {/* =========================================================================
                        BARIS 2: BOX FILTER MUNCUL DI BAWAHNYA DENGAN TOGGLE SEMBUNYIKAN
                        (Default Disembunyikan - Muncul saat Tombol Filter Diklik)
                        ========================================================================= */}
                    {isFilterOpen && (
                        <div className="bg-white border-2 border-teal-600/30 rounded-2xl p-3.5 sm:p-4 shadow-md animate-fade-in text-slate-900 space-y-3">
                            {/* Filter Box Header */}
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-teal-100 text-teal-800 rounded-lg">
                                        <SlidersHorizontal size={15} />
                                    </div>
                                    <div>
                                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                                            Filter Periode &amp; Rentang Tanggal LRA
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-mono">
                                            Periode Aktif: <strong className="text-teal-800">{reportPeriodLabel}</strong>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsFilterOpen(false)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors border border-slate-300"
                                    title="Sembunyikan Panel Filter"
                                >
                                    <ChevronUp size={13} />
                                    <span>Sembunyikan Filter</span>
                                </button>
                            </div>

                            {/* Filter Controls: Date Range & Dropdown */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                                {/* 1. Rentang Tanggal (Start Date & End Date) */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                                    <label className="block text-[10px] font-black text-slate-700 uppercase mb-1 flex items-center gap-1">
                                        <Calendar size={12} className="text-teal-700" />
                                        <span>Rentang Tanggal Spesifik (Start - End)</span>
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => {
                                                setStartDate(e.target.value);
                                                if (e.target.value) setSelectedMonth('');
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 outline-none focus:border-teal-600"
                                            title="Tanggal Mulai"
                                        />
                                        <span className="text-[10px] font-bold text-slate-500">s/d</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => {
                                                setEndDate(e.target.value);
                                                if (e.target.value) setSelectedMonth('');
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 outline-none focus:border-teal-600"
                                            title="Tanggal Selesai"
                                        />
                                    </div>
                                </div>

                                {/* 2. Pilihan Tahun & Bulan */}

                                {/* 3. Presets Cepat & Tombol Reset */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between">
                                    <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                                        Pilihan Preset Cepat
                                    </label>
                                    <div className="flex flex-wrap items-center gap-1">
                                        <button
                                            onClick={handlePresetThisYear}
                                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold border border-slate-300 transition-colors"
                                        >
                                            Tahun Ini
                                        </button>
                                        <button
                                            onClick={handlePresetThisMonth}
                                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold border border-slate-300 transition-colors"
                                        >
                                            Bulan Ini
                                        </button>
                                        <button
                                            onClick={() => handlePresetQuarter(1)}
                                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold border border-slate-300 transition-colors"
                                        >
                                            TW I
                                        </button>
                                        <button
                                            onClick={() => handlePresetQuarter(2)}
                                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold border border-slate-300 transition-colors"
                                        >
                                            TW II
                                        </button>
                                        <button
                                            onClick={() => handlePresetQuarter(3)}
                                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold border border-slate-300 transition-colors"
                                        >
                                            TW III
                                        </button>
                                        <button
                                            onClick={() => handlePresetQuarter(4)}
                                            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold border border-slate-300 transition-colors"
                                        >
                                            TW IV
                                        </button>
                                        <button
                                            onClick={handleResetFilters}
                                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-[10px] font-bold border border-rose-200 transition-colors flex items-center gap-0.5 ml-auto"
                                            title="Reset Filter ke Tahun Berjalan"
                                        >
                                            <RotateCcw size={10} />
                                            <span>Reset</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            {/* CONDITIONAL RENDER: ONE-PAGE SUMMARY vs LRA ADAT vs DETAILED LRA */}
            {viewMode === 'adat' ? (
                <div className="p-1">
                    <LraAdatSummary
                        reportData={reportData}
                        periodLabel={reportPeriodLabel}
                        keliangName={keliangName}
                        juruRaksaName={juruRaksaName}
                        customPlace={customPlace}
                        signatureDate={signatureDate}
                        onOpenSettings={handleOpenSettings}
                        onOpenFullScreen={() => setIsFullScreenModalOpen(true)}
                        printColorMode={printColorMode}
                        onTriggerPrint={(mode) => handleTriggerPrint(mode || printColorMode, false)}
                        entries={entries}
                        budgetItems={budgetItems}
                        initialStartDate={startDate}
                        initialEndDate={endDate}
                        initialYear={selectedYear}
                        initialMonth={selectedMonth}
                        onApplyFilterToParent={(f) => {
                            setStartDate(f.startDate);
                            setEndDate(f.endDate);
                            setSelectedYear(f.selectedYear);
                            setSelectedMonth(f.selectedMonth);
                        }}
                    />
                </div>
            ) : (

            <div id="lra-printable-area" className={`p-1 ${printColorMode === 'color' ? 'print-mode-color' : 'print-mode-monochrome'}`}>
                {/* HEADER LAPORAN - HANYA TAMPIL SAAT CETAK */}
              <div className="space-y-6">
                <div className="no-print bg-slate-50 border border-slate-300 p-4 sm:p-5 rounded-2xl shadow-sm mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Kolom Kiri: Header Bagus & Tombol Aksi */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2.5 bg-teal-700 text-white rounded-xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
                          <FileText size={22} />
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight font-serif tracking-tight">
                            Laporan Realisasi Anggaran (LRA) &amp; Belanja
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Format resmi standar akuntansi (PSAP 02) sesuai Chart of Accounts Desa Adat Basangalas.
                          </p>
                        </div>
                      </div>

                      {/* Tombol Aksi: Tanda Tangan, Cetak, Buka Narasi */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Tombol Tanda Tangan & Status Automation */}
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={handleOpenSettings}
                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-3.5 rounded-xl transition-colors border border-slate-700 shadow-xs active:scale-95 text-xs shrink-0"
                            title="Atur Nama, Tanggal Pengesahan, & Otomatisasi Tanda Tangan/Stempel"
                          >
                            <Settings size={14} />
                            <span>Tanda Tangan</span>
                          </button>
                        </div>

                        {/* Mode Cetak Button Group & Dropdown */}
                        <div className="relative inline-flex rounded-xl shadow-xs shrink-0">
                          <button 
                            onClick={() => handleTriggerPrint('color', includeChartInPrint)} 
                            className="bg-gradient-to-r from-teal-800 to-emerald-800 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-2 px-3.5 rounded-l-xl border-r border-teal-900 flex items-center gap-1.5 text-xs active:scale-95 transition-all whitespace-nowrap"
                            title="Cetak LRA Berwarna sesuai format aktif"
                          >
                            <Palette size={13} className="text-teal-200" />
                            <Printer size={13} />
                            <span>Cetak</span>
                          </button>
                          <button 
                            onClick={() => setIsPrintMenuOpen(!isPrintMenuOpen)}
                            className="bg-teal-900 hover:bg-teal-800 text-teal-100 font-bold py-2 px-2.5 rounded-r-xl text-xs transition-colors flex items-center"
                            title="Pilihan Opsi Cetak LRA"
                          >
                            <ChevronDown size={13} />
                          </button>

                          {isPrintMenuOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsPrintMenuOpen(false)} />
                              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 z-50 text-slate-800 text-xs space-y-2.5 animate-fade-in-up">
                                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Printer size={14} className="text-teal-700" />
                                    Pilihan Mode Cetak LRA
                                  </span>
                                  <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200 font-mono font-bold">
                                    {viewMode === 'onepage' ? '1 Halaman' : 'Detail'}
                                  </span>
                                </div>

                                <div className="space-y-1.5">
                                  <button
                                    onClick={() => handleTriggerPrint('color', includeChartInPrint)}
                                    className={`w-full flex items-start gap-2.5 p-2 rounded-lg transition-all text-left border ${
                                      printColorMode === 'color' 
                                        ? 'bg-teal-50 border-teal-300 text-teal-950 shadow-2xs' 
                                        : 'border-transparent hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0 mt-0.5">
                                      <Palette size={14} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 flex items-center gap-1">
                                        Cetak Berwarna (Full Color)
                                        {printColorMode === 'color' && <Check size={12} className="text-teal-600" />}
                                      </p>
                                      <p className="text-[10px] text-slate-500 leading-snug">
                                        Hasil cetak berwarna sesuai format {viewMode === 'onepage' ? 'Ringkasan 1 Halaman' : 'Tabel Rinci'}.
                                      </p>
                                    </div>
                                  </button>

                                  <button
                                    onClick={() => handleTriggerPrint('monochrome', includeChartInPrint)}
                                    className={`w-full flex items-start gap-2.5 p-2 rounded-lg transition-all text-left border ${
                                      printColorMode === 'monochrome' 
                                        ? 'bg-slate-100 border-slate-300 text-slate-950 shadow-2xs' 
                                        : 'border-transparent hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="p-1.5 bg-slate-200 text-slate-700 rounded-md shrink-0 mt-0.5">
                                      <FileText size={14} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 flex items-center gap-1">
                                        Cetak Standar (Hitam Putih)
                                        {printColorMode === 'monochrome' && <Check size={12} className="text-teal-600" />}
                                      </p>
                                      <p className="text-[10px] text-slate-500 leading-snug">
                                        Format formal monokrom hemat tinta untuk arsip fisik.
                                      </p>
                                    </div>
                                  </button>
                                </div>

                                {viewMode === 'detailed' && (
                                  <div className="pt-2 border-t border-slate-100">
                                    <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-700 hover:text-slate-900">
                                      <input
                                        type="checkbox"
                                        checked={includeChartInPrint}
                                        onChange={(e) => setIncludeChartInPrint(e.target.checked)}
                                        className="rounded border-slate-300 bg-white text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                                      />
                                      <span className="font-medium">Sertakan Diagram Visualisasi Anggaran</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Tombol Buka Narasi */}
                        <button
                          type="button"
                          onClick={() => setIsNaratifModalOpen(true)}
                          className="flex items-center gap-2 text-xs font-black bg-amber-300 hover:bg-amber-400 text-amber-950 uppercase tracking-wider border border-amber-600 px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer no-print group shrink-0"
                          title="Buka Naskah Narasi Rekapitulasi Akhir Ramah Krama"
                        >
                          <FileText size={16} className="text-amber-900 group-hover:scale-110 transition-transform" />
                          <span>Buka Narasi</span>
                        </button>
                      </div>
                    </div>

                    {/* Kolom Kanan: Pilihan Tahun & Bulan dengan Narasi Singkat */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs lg:w-80 shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-black text-slate-800 uppercase tracking-wider">
                          Filter Berdasarkan Tahun &amp; Bulan
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsFilterOpen(true)}
                          className="text-[10px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition-colors"
                          title="Buka panel filter untuk rentang tanggal lebih spesifik"
                        >
                          <Filter size={11} />
                          <span>Filter Spesifik</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mb-2">
                        Pilih tahun &amp; bulan untuk rekapitulasi cepat. Untuk rentang tanggal harian atau kriteria lain yang lebih spesifik, silakan klik tombol <strong className="text-teal-800 font-semibold cursor-pointer hover:underline" onClick={() => setIsFilterOpen(true)}>Filter</strong>.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={selectedYear}
                          onChange={(e) => {
                            setSelectedYear(e.target.value);
                            setStartDate('');
                            setEndDate('');
                          }}
                          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-600 cursor-pointer"
                        >
                          <option value="">Semua Tahun</option>
                          {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <select
                          value={selectedMonth}
                          onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            setStartDate('');
                            setEndDate('');
                          }}
                          className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-600 cursor-pointer"
                        >
                          <option value="">Semua Bulan</option>
                          {MONTHS_LIST.map(m => (
                            <option key={m.val} value={m.val}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>  

            <div className="hidden print:block text-slate-900 mb-6">
                <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                        DESA ADAT BASANGALAS
                    </h2>
                    <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
                        Laporan Pertanggungjawaban Keuangan Kas Desa Adat
                    </p>
                    <p className="text-xs font-semibold text-slate-700 font-serif m-0">
                        Jln. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                    </p>
                </div>
                <div className="text-center mb-4">
                    <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                        LAPORAN REALISASI ANGGARAN (LRA) &amp; BELANJA
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                        Periode Laporan: {reportPeriodLabel}
                    </p>
                </div>
            </div>

            {/* LAPORAN TABEL */}  
            <div className="bg-slate-100 rounded-xl border border-gray-500 shadow-2xl overflow-x-auto print:overflow-visible mt-4 print:shadow-none print:border-none print:rounded-none">
                {isMonthFilterActive && (
                    <div className="bg-teal-50 border-b border-teal-200 px-4 py-2 text-xs text-teal-900 font-semibold flex items-center justify-between no-print">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                            Filter Bulan Aktif: Menampilkan realisasi kas bulanan. Kolom Pagu Anggaran dan Selisih/Sisa disembunyikan.
                        </span>
                        <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono font-bold">
                            Mode Realisasi Bulanan
                        </span>
                    </div>
                )}
                <table className="w-full min-w-[500px] text-sm text-left">
                    <thead className="bg-slate-700 text-white uppercase text-[10px] font-black tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-left">Kode Akun</th>
                            <th className="px-6 py-4 text-left">Uraian Pos Rekening</th>
                            {!isMonthFilterActive && <th className="px-6 py-4 text-right">Pagu Anggaran (Rp)</th>}
                            <th className="px-6 py-4 text-right">Realisasi Kas (Rp)</th>
                            {!isMonthFilterActive && <th className="px-6 py-4 text-right">Selisih / Sisa (Rp)</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <GroupSection data={reportData.sumberdana} />
                        {reportData.sumberdana.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL SUMBER DANA (TERMASUK SALDO LALU)</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.sumberdana.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.sumberdana.totalRealisasi)}</td>
                                {!isMonthFilterActive && (
                                    <td className="selisih-col px-6 py-3 text-right text-emerald-200">
                                        {reportData.sumberdana.totalSelisih > 0 ? `+${formatCurrency(reportData.sumberdana.totalSelisih)}` : formatCurrency(reportData.sumberdana.totalSelisih)}
                                    </td>
                                )}
                            </tr>
                        )}
                        <GroupSection data={reportData.pendapatan} />
                        {reportData.pendapatan.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL PENDAPATAN DESA ADAT</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.pendapatan.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.pendapatan.totalRealisasi)}</td>
                                {!isMonthFilterActive && (
                                    <td className="selisih-col px-6 py-3 text-right text-emerald-200">
                                        {reportData.pendapatan.totalSelisih > 0 ? `+${formatCurrency(reportData.pendapatan.totalSelisih)}` : formatCurrency(reportData.pendapatan.totalSelisih)}
                                    </td>
                                )}
                            </tr>
                        )}
                        {(reportData.sumberdana.rows.length > 0 || reportData.pendapatan.rows.length > 0) && (
                            <tr className="lra-row-total-penerimaan bg-teal-950 text-white font-black border-y-2 border-teal-500">
                                <td colSpan={2} className="px-6 py-3.5 uppercase text-xs tracking-wide text-teal-200">
                                    TOTAL PENERIMAAN DESA ADAT (SUMBER DANA + PENDAPATAN)
                                </td>
                                {!isMonthFilterActive && (
                                    <td className="px-6 py-3.5 text-right text-white font-black">
                                        {formatCurrency(reportData.sumberdana.totalAnggaran + reportData.pendapatan.totalAnggaran)}
                                    </td>
                                )}
                                <td className="px-6 py-3.5 text-right text-teal-300 font-black">
                                    {formatCurrency(reportData.sumberdana.totalRealisasi + reportData.pendapatan.totalRealisasi)}
                                </td>
                                {!isMonthFilterActive && (
                                    <td className="selisih-col px-6 py-3.5 text-right font-black text-emerald-200">
                                        {(reportData.sumberdana.totalSelisih + reportData.pendapatan.totalSelisih) > 0
                                            ? `+${formatCurrency(reportData.sumberdana.totalSelisih + reportData.pendapatan.totalSelisih)}`
                                            : formatCurrency(reportData.sumberdana.totalSelisih + reportData.pendapatan.totalSelisih)}
                                    </td>
                                )}
                            </tr>
                        )}
                        {(reportData.totalBelanjaAnggaran > 0 || reportData.totalBelanjaRealisasi > 0) && (
                            <tr className="lra-row-belanja-header bg-slate-600 text-white font-black">
                                <td colSpan={isMonthFilterActive ? 3 : 5} className="px-6 py-4 text-xs tracking-widest uppercase">BELANJA DESA ADAT</td>
                            </tr>
                        )}
                        <GroupSection data={reportData.operasional} />
                        {reportData.operasional.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL BELANJA OPERASIONAL ADAT (5.1.5)</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.operasional.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.operasional.totalRealisasi)}</td>
                                {!isMonthFilterActive && <td className="selisih-col px-6 py-3 text-right text-slate-100">{formatCurrency(reportData.operasional.totalSelisih)}</td>}
                            </tr>
                        )}
                        <GroupSection data={reportData.parhyangan} />
                        {reportData.parhyangan.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL BIDANG PARHYANGAN (5.2.1)</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.parhyangan.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.parhyangan.totalRealisasi)}</td>
                                {!isMonthFilterActive && <td className="selisih-col px-6 py-3 text-right text-slate-100">{formatCurrency(reportData.parhyangan.totalSelisih)}</td>}
                            </tr>
                        )}
                        <GroupSection data={reportData.pawongan} />
                        {reportData.pawongan.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL BIDANG PAWONGAN (5.3.2)</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.pawongan.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.pawongan.totalRealisasi)}</td>
                                {!isMonthFilterActive && <td className="selisih-col px-6 py-3 text-right text-slate-100">{formatCurrency(reportData.pawongan.totalSelisih)}</td>}
                            </tr>
                        )}
                        <GroupSection data={reportData.palemahan} />
                        {reportData.palemahan.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL BIDANG PALEMAHAN (5.4.1)</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.palemahan.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.palemahan.totalRealisasi)}</td>
                                {!isMonthFilterActive && <td className="selisih-col px-6 py-3 text-right text-slate-100">{formatCurrency(reportData.palemahan.totalSelisih)}</td>}
                            </tr>
                        )}
                        <GroupSection data={reportData.belanjaLainnya} />
                        {reportData.belanjaLainnya.rows.length > 0 && (
                            <tr className="lra-row-subtotal bg-emerald-900/60 font-bold border-y-2 border-gray-500">
                                <td colSpan={2} className="px-6 py-3 text-gray-100 uppercase text-[10px]">TOTAL BELANJA LAIN-LAIN</td>
                                {!isMonthFilterActive && <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.belanjaLainnya.totalAnggaran)}</td>}
                                <td className="px-6 py-3 text-right text-gray-100">{formatCurrency(reportData.belanjaLainnya.totalRealisasi)}</td>
                                {!isMonthFilterActive && <td className="selisih-col px-6 py-3 text-right text-slate-100">{formatCurrency(reportData.belanjaLainnya.totalSelisih)}</td>}
                            </tr>
                        )}
                        {(reportData.totalBelanjaAnggaran > 0 || reportData.totalBelanjaRealisasi > 0) && (
                            <tr className="lra-row-total-belanja bg-gray-800 text-white font-black border-t-2 border-black">
                                <td colSpan={2} className="px-6 py-4 uppercase text-xs">
                                    {isMonthFilterActive ? 'TOTAL REALISASI BELANJA BULAN INI' : 'TOTAL REALISASI BELANJA TAHUN BERJALAN'}
                                </td>
                                {!isMonthFilterActive && <td className="px-6 py-4 text-right text-white">{formatCurrency(reportData.totalBelanjaAnggaran)}</td>}
                                <td className="realisasi-belanja-col px-6 py-4 text-right text-rose-500">{formatCurrency(reportData.totalBelanjaRealisasi)}</td>
                                {!isMonthFilterActive && (
                                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-100">
                                        {formatCurrency(reportData.totalBelanjaAnggaran - reportData.totalBelanjaRealisasi)}
                                    </td>
                                )}
                            </tr>
                        )}
                        <tr className="lra-row-surplus bg-teal-50 font-black text-xl border-t-4 border-teal-600">
                            <td colSpan={isMonthFilterActive ? 2 : 3} className="px-6 py-6 uppercase tracking-tighter text-slate-900">SURPLUS / (DEFISIT) AKHIR</td>
                            <td colSpan={isMonthFilterActive ? 1 : 2} className={`px-6 py-6 text-right hover:text-2xl ${reportData.surplusDefisit.realisasi >= 0 ? 'surplus-positive text-teal-700' : 'surplus-negative text-rose-700'}`}>
                                {formatCurrency(reportData.surplusDefisit.realisasi)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* CATATAN & NARASI PENJELASAN SELISIH ANGGARAN & REALISASI */}
            <div className="mt-6">
                <LraVarianceExplanation
                    reportData={reportData}
                    periodLabel={reportPeriodLabel}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    isMonthFilterActive={isMonthFilterActive}
                />
            </div>

            {/* TANDA TANGAN RESMI PENGESAHAN (TABEL LRA RINCI) */}
            <div className="mt-8 pt-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-300 shadow-sm print:shadow-none print:border-none print:p-0">
                <LraSignatureBlock
                    keliangName={keliangName}
                    juruRaksaName={juruRaksaName}
                    customPlace={customPlace}
                    signatureDate={signatureDate}
                    keliangTitle="Keliang Adat Basangalas"
                    keliangSubtitle="Penanggung Jawab Umum"
                    juruRaksaTitle="Juru Raksa"
                    juruRaksaSubtitle="Pengelola &amp; Pembukuan Kas"
                    keliangActionText="Mengetahui,"
                    namaDesa="DESA ADAT BASANGALAS"
                    showQuickControls={true}
                    onOpenSettings={handleOpenSettings}
                />
            </div>

            {/* VISUALISASI ANGGARAN VS REALISASI (DIAGRAM BATANG & SERAPAN DANA) */}
            <LraBudgetComparisonChart 
                reportData={reportData} 
                periodLabel={reportPeriodLabel} 
                hideInPrint={!includeChartInPrint}
            />
        </div>

                {/* Formal Footer Layout */}
                <div className="justify-start items-center mt-8 text-slate-900 border-t border-slate-300 pt-4 print:mt-4">
                    <div>
                        <p className="font-semibold text-left print:text-[11px] print:text-slate-400">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                        <p className="text-[10px] text-slate-500 text-left print:text-[9px] print:text-slate-400">Transparansi dan integritas data keuangan terjamin &amp; terautentikasi secara digital.</p>
                    </div>
                    <div className="text-right font-mono text-[8px] text-slate-500 print:text-slate-400">
                        <p>https:/desaadatbasangalas.netlify.app</p>
                    </div>
                </div>
            </div>
            )}

            {/* FULL SCREEN SPECIALIZED / ONE PAGE SUMMARY MODAL */}
            {viewMode === 'adat' ? (
                <LraFullScreenAdatModal
                    isOpen={isFullScreenModalOpen}
                    onClose={() => setIsFullScreenModalOpen(false)}
                    reportData={reportData}
                    periodLabel={reportPeriodLabel}
                    keliangName={keliangName}
                    juruRaksaName={juruRaksaName}
                    customPlace={customPlace}
                    signatureDate={signatureDate}
                    onOpenSettings={handleOpenSettings}
                    printColorMode={printColorMode}
                    onTriggerPrint={(mode) => handleTriggerPrint(mode || printColorMode, false)}
                    entries={entries}
                    budgetItems={budgetItems}
                    initialStartDate={startDate}
                    initialEndDate={endDate}
                    initialYear={selectedYear}
                    initialMonth={selectedMonth}
                    onApplyFilterToParent={(f) => {
                        setStartDate(f.startDate);
                        setEndDate(f.endDate);
                        setSelectedYear(f.selectedYear);
                        setSelectedMonth(f.selectedMonth);
                    }}
                />
            ) : (
                <LraFullScreenModal
                    isOpen={isFullScreenModalOpen}
                    onClose={() => setIsFullScreenModalOpen(false)}
                    reportData={reportData}
                    periodLabel={reportPeriodLabel}
                    keliangName={keliangName}
                    juruRaksaName={juruRaksaName}
                    customPlace={customPlace}
                    signatureDate={signatureDate}
                    onOpenSettings={handleOpenSettings}
                    printColorMode={printColorMode}
                    onTriggerPrint={(mode) => handleTriggerPrint(mode || printColorMode, false)}
                    entries={entries}
                    budgetItems={budgetItems}
                    initialStartDate={startDate}
                    initialEndDate={endDate}
                    initialYear={selectedYear}
                    initialMonth={selectedMonth}
                    onApplyFilterToParent={(f) => {
                        setStartDate(f.startDate);
                        setEndDate(f.endDate);
                        setSelectedYear(f.selectedYear);
                        setSelectedMonth(f.selectedMonth);
                    }}
                />
            )}

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Tanda Tangan & Stempel LRA" className="max-w-md">
                <div className="space-y-4">
                    {/* TOGGLE OTOMATISASI TANDA TANGAN & STEMPEL DIGITAL */}
                    <div className="bg-gray-700/80 border border-gray-600 rounded-xl p-3.5 space-y-3">
                        <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-600 pb-2">
                            <FileSignature size={14} />
                            <span>Otomatisasi Tanda Tangan &amp; Stempel</span>
                        </div>

                        {/* Switch Tanda Tangan Digital */}
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-100 block">Sematkan Tanda Tangan Digital</span>
                                <span className="text-[10px] text-slate-400 block">Tampilkan TTD digital Keliang &amp; Juru Raksa</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={tempAutoEmbed}
                                    onChange={e => setTempAutoEmbed(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                            </label>
                        </div>

                        {/* Switch Stempel Resmi Desa */}
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-600/60">
                            <div>
                                <span className="text-xs font-bold text-slate-100 block">Tampilkan Stempel Resmi Desa</span>
                                <span className="text-[10px] text-slate-400 block">Cap stempel merah Desa Adat Basangalas</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={tempShowStamp}
                                    onChange={e => setTempShowStamp(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                            </label>
                        </div>

                        {/* Slider & Presets Pengaturan Skala Ukuran Stempel */}
                        {tempShowStamp && (
                            <div className="pt-2 border-t border-gray-600/60 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-200">Skala Ukuran Stempel:</span>
                                    <span className="font-mono text-teal-400 font-black bg-gray-800 px-2 py-0.5 rounded border border-gray-600">
                                        {tempStampScale}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range"
                                        min={60}
                                        max={180}
                                        step={5}
                                        value={tempStampScale}
                                        onChange={(e) => setTempStampScale(Number(e.target.value))}
                                        className="w-full accent-teal-500 cursor-pointer h-2 bg-slate-600 rounded-lg"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[10px] gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setTempStampScale(80)}
                                        className={`px-2 py-1 rounded transition-colors ${tempStampScale === 80 ? 'bg-teal-600 text-white font-bold' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                                    >
                                        80% (Kecil)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTempStampScale(100)}
                                        className={`px-2 py-1 rounded transition-colors ${tempStampScale === 100 ? 'bg-teal-600 text-white font-bold' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                                    >
                                        100% (Standar)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTempStampScale(120)}
                                        className={`px-2 py-1 rounded transition-colors ${tempStampScale === 120 ? 'bg-teal-600 text-white font-bold' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                                    >
                                        120% (Besar)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTempStampScale(130)}
                                        className={`px-2 py-1 rounded transition-colors ${tempStampScale === 130 ? 'bg-teal-600 text-white font-bold' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                                    >
                                        130%
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Tempat Laporan</label>
                        <input type="text" value={tempCustomPlace} onChange={e => setTempCustomPlace(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Tanggal Laporan (Tanda Tangan)</label>
                        <input type="date" value={tempSignatureDate} onChange={e => setTempSignatureDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nama Keliang Adat</label>
                        <input type="text" value={tempKeliangName} onChange={e => setTempKeliangName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nama Juru Raksa</label>
                        <input type="text" value={tempJuruRaksaName} onChange={e => setTempJuruRaksaName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    {/* TAMBAHAN CETAK NARASI */}
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nama Penyarikan (Sekretaris)</label>
                        <input type="text" value={tempPenyarikanName} onChange={e => setTempPenyarikanName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Nama Penyarikan" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1">Nama Pengawas / Baga Petilik</label>
                        <input type="text" value={tempPengawasName} onChange={e => setTempPengawasName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Nama Pengawas" />
                    </div>
                    <button onClick={handleSaveSettings} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest">Simpan Perubahan</button>
                </div>
            </Modal>

                {/* TEMPLATE MODAL NARASI REALISASI ANGGARAN (LRA) */}
                <LraNaratifTemplateModal
                    isOpen={isNaratifModalOpen}
                    onClose={() => setIsNaratifModalOpen(false)}
                    reportPeriodLabel={reportPeriodLabel}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    reportData={reportData}
                    entries={filteredEntries}
                    budgetItems={budgetItems}
                    rekap={rekap}
                    keliangName={keliangName}
                    juruRaksaName={juruRaksaName}
                    penyarikanName={penyarikanName}
                    pengawasName={pengawasName}
                    customPlace={customPlace}
                    signatureDate={signatureDate}
                />
            </div>
        </div>
    );
};

export default LaporanRekonsiliasiAkhir;
