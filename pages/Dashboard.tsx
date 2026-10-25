
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Wallet, Calendar, Filter, Printer, Droplets, ArrowUpRight, ArrowDownLeft, Info, Scale, CheckCircle2, AlertTriangle, Receipt, Download, Loader2, FileText, Landmark, Coins, Calculator, Layers, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff, BookOpen, PlusCircle, Plus, ClipboardList, ArrowLeftRight, ShoppingBag, Building2, ShieldCheck, Activity, X, RotateCcw, Clock } from 'lucide-react';
import type { JuDisplayRow, MonthlyData, CategoryData, Transaction, BkuData, DanaPuniaItem, UrunanItem, BudgetItem, ManualBudgetCaps } from '../types';
import StatCard from '../components/dashboard/StatCard';
import MonthlyBarChart from '../components/dashboard/MonthlyBarChart';
import MonthlyLineChart from '../components/dashboard/MonthlyLineChart';
import CategoryDonutChart from '../components/dashboard/CategoryDonutChart';
import FundingSourceDistributionChart from '../components/dashboard/FundingSourceDistributionChart';
import BudgetSummaryProgress from '../components/dashboard/BudgetSummaryProgress';
import DebtSummaryCard from '../components/dashboard/DebtSummaryCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import TopTransactions from '../components/dashboard/TopTransactions';
import ExecutiveSummaryAi from '../components/dashboard/ExecutiveSummaryAi';
import FinancialHealthScoreChart from '../components/dashboard/FinancialHealthScoreChart';
import InstantSummaryCards from '../components/dashboard/InstantSummaryCards';
import { InputKategoriTransaksiModal, TransaksiType } from '../components/jurnal/InputKategoriTransaksiModal';
import { formatCurrency } from '../utils/formatter';
import { REFERENSI_REKENING, isKasAccount } from '../constants';
import { useNotification } from '../context/NotificationContext';
import { exportElementToPdf } from '../utils/pdfExport';

interface DashboardProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
  budgetItems?: BudgetItem[];
  manualBudgetCaps?: ManualBudgetCaps;
  setActivePage?: (page: string) => void;
  onAddUrunan?: (item: UrunanItem) => Promise<void>;
  onOpenJurnalWithAccounts?: (debet: string, kredit: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  entries, 
  bkuData = [],
  danaPuniaItems = [],
  urunanItems = [],
  budgetItems = [],
  manualBudgetCaps,
  setActivePage,
  onAddUrunan: _onAddUrunan,
  onOpenJurnalWithAccounts
}) => {
  const { showNotification } = useNotification();
  const [isExportingSummaryPdf, setIsExportingSummaryPdf] = useState(false);
  const [showOpsiNeraca, setShowOpsiNeraca] = useState(false);
  const [showDqiDetailModal, setShowDqiDetailModal] = useState(false);
  const [showFilterDashboard, setShowFilterDashboard] = useState<boolean>(false);
  
  // Transaksi Baru / Kategori Modal & Dropdown (Sesuai Entri Baru di Jurnal)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showKategoriModal, setShowKategoriModal] = useState(false);
  const [selectedCategoryType, setSelectedCategoryType] = useState<TransaksiType | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // Perhitungan Saldo Kas Akun 1.1.* untuk Input Kategori Transaksi
  const cashAccountBalances = useMemo<Record<string, { code: string; name: string; balance: number }>>(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const balances: Record<string, { code: string; name: string; balance: number }> = {};

    REFERENSI_REKENING.forEach(acc => {
      if (isKasAccount(acc.code)) {
        balances[acc.code] = {
          code: acc.code,
          name: acc.name,
          balance: 0
        };
      }
    });

    safeEntries.forEach(row => {
      const cleanCode = (row.kodeRekening || (row as any).kodeAkunDebet || (row as any).kodeAkunKredit || '').split(' - ')[0].trim();
      if (isKasAccount(cleanCode)) {
        if (!balances[cleanCode]) {
          const accMatch = REFERENSI_REKENING.find(r => r.code === cleanCode);
          balances[cleanCode] = {
            code: cleanCode,
            name: accMatch ? accMatch.name : (row.kodeRekening?.includes(' - ') ? row.kodeRekening.split(' - ').slice(1).join(' - ').trim() : `Kas (${cleanCode})`),
            balance: 0
          };
        }

        const debetVal = Number(row.debet) || 0;
        const kreditVal = Number(row.kredit) || 0;
        balances[cleanCode].balance += (debetVal - kreditVal);
      }
    });

    return balances;
  }, [entries]);

  const handleOpenInput = () => {
    setShowCategoryDropdown(prev => !prev);
  };

  const handleOpenCategory = (type: TransaksiType) => {
    setShowCategoryDropdown(false);
    setSelectedCategoryType(type);
    setShowKategoriModal(true);
  };

  const handleDirectOpenInput = () => {
    setShowCategoryDropdown(false);
    setShowKategoriModal(false);
    setSelectedCategoryType(null);
    if (onOpenJurnalWithAccounts) {
      onOpenJurnalWithAccounts('', '');
    } else if (setActivePage) {
      setActivePage('Jurnal Umum');
    }
  };

  const handleSelectCategoryTransaction = ({ debet, kredit }: { debet: string; kredit: string }) => {
    setShowKategoriModal(false);
    setSelectedCategoryType(null);
    if (onOpenJurnalWithAccounts) {
      onOpenJurnalWithAccounts(debet, kredit);
    } else if (setActivePage) {
      setActivePage('Jurnal Umum');
    }
  };

  // Get unique years from entries and bkuData, default to current year
  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      entries.forEach(e => {
          if (e.date) {
              const d = new Date(e.date);
              if (!isNaN(d.getTime())) years.add(d.getFullYear());
          }
      });
      bkuData.forEach(b => {
          if (b.tanggal) {
              const d = new Date(b.tanggal);
              if (!isNaN(d.getTime())) years.add(d.getFullYear());
          }
      });
      budgetItems.forEach(b => {
          if (b.tahun && !isNaN(Number(b.tahun))) {
              years.add(Number(b.tahun));
          }
      });
      return Array.from(years).sort((a, b) => b - a);
  }, [entries, bkuData, budgetItems]);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const MONTHS_LIST = useMemo(() => [
    { value: 'all', label: 'Semua Bulan' },
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ], []);

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const activePeriodLabel = useMemo(() => {
    if (filterStartDate && filterEndDate) {
      return `${formatDisplayDate(filterStartDate)} s.d ${formatDisplayDate(filterEndDate)}`;
    }
    if (filterStartDate) {
      return `Mulai ${formatDisplayDate(filterStartDate)}`;
    }
    if (filterEndDate) {
      return `Sampai ${formatDisplayDate(filterEndDate)}`;
    }
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      const mLabel = MONTHS_LIST.find(m => m.value === selectedMonth)?.label || selectedMonth;
      return `${mLabel} ${selectedYear}`;
    }
    if (selectedMonth !== 'all') {
      const mLabel = MONTHS_LIST.find(m => m.value === selectedMonth)?.label || selectedMonth;
      return `Bulan ${mLabel} (Semua Tahun)`;
    }
    if (selectedYear !== 'all') {
      return `Tahun Anggaran ${selectedYear}`;
    }
    return 'Semua Periode (Kumulatif)';
  }, [filterStartDate, filterEndDate, selectedMonth, selectedYear, MONTHS_LIST]);

  // Evaluasi filter per baris berdasarkan tahun, bulan, dan rentang tanggal (dari s.d sampai)
  const isRowInFilter = (dateStr?: string) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    if (cleanDate.length < 10) return false;

    // 1. Rentang Tanggal Spesifik (Dari Tanggal s.d Sampai Tanggal)
    if (filterStartDate && cleanDate < filterStartDate) return false;
    if (filterEndDate && cleanDate > filterEndDate) return false;

    // 2. Filter Bulan (jika bukan 'all')
    if (selectedMonth !== 'all' && selectedMonth !== '') {
      const mo = cleanDate.split('-')[1];
      if (mo !== selectedMonth) return false;
    }

    // 3. Filter Tahun (jika bukan 'all')
    if (selectedYear !== 'all') {
      const yr = parseInt(cleanDate.split('-')[0], 10);
      if (yr !== selectedYear) return false;
    }

    return true;
  };

  // Handlers Filter
  const handleYearChange = (year: number | 'all') => {
    setSelectedYear(year);
    if (year === 'all') {
      setSelectedMonth('all');
      setFilterStartDate('');
      setFilterEndDate('');
    } else if (filterStartDate || filterEndDate) {
      const sYr = filterStartDate ? filterStartDate.split('-')[0] : '';
      const eYr = filterEndDate ? filterEndDate.split('-')[0] : '';
      if ((sYr && parseInt(sYr, 10) !== year) || (eYr && parseInt(eYr, 10) !== year)) {
        setFilterStartDate('');
        setFilterEndDate('');
      }
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setFilterStartDate('');
    setFilterEndDate('');
    if (month !== 'all' && selectedYear === 'all') {
      const defaultYear = availableYears[0] || new Date().getFullYear();
      setSelectedYear(defaultYear);
    }
  };

  const handleStartDateChange = (val: string) => {
    setFilterStartDate(val);
    setSelectedMonth('all');
    if (val && filterEndDate) {
      const startYr = val.split('-')[0];
      const endYr = filterEndDate.split('-')[0];
      if (startYr !== endYr) {
        setSelectedYear('all');
      } else {
        setSelectedYear(parseInt(startYr, 10));
      }
    } else if (val && selectedYear !== 'all') {
      const startYr = parseInt(val.split('-')[0], 10);
      if (startYr !== selectedYear) {
        setSelectedYear(startYr);
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setFilterEndDate(val);
    setSelectedMonth('all');
    if (filterStartDate && val) {
      const startYr = filterStartDate.split('-')[0];
      const endYr = val.split('-')[0];
      if (startYr !== endYr) {
        setSelectedYear('all');
      } else {
        setSelectedYear(parseInt(endYr, 10));
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const handlePresetAll = () => {
    handleResetFilters();
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    setSelectedYear(curYear);
    setSelectedMonth(curMonth);
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const handlePresetThisYear = () => {
    const curYear = new Date().getFullYear();
    setSelectedYear(curYear);
    setSelectedMonth('all');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const isFilterActive = useMemo(() => {
    return selectedYear !== 'all' || selectedMonth !== 'all' || Boolean(filterStartDate) || Boolean(filterEndDate);
  }, [selectedYear, selectedMonth, filterStartDate, filterEndDate]);

  // Filter entries based on selected year, month, and date range
  const filteredEntries = useMemo(() => {
    return entries.filter(e => isRowInFilter(e.date));
  }, [entries, selectedYear, selectedMonth, filterStartDate, filterEndDate]);

  // Filter BKU data based on selected year, month, and date range
  const filteredBkuData = useMemo(() => {
    return bkuData.filter(b => isRowInFilter(b.tanggal));
  }, [bkuData, selectedYear, selectedMonth, filterStartDate, filterEndDate]);

  // --- BKU SUMMARY STATS (STANDAR AKUNTANSI NASIONAL) ---
  // Jika terdapat data Jurnal Umum (Single Source of Truth), BKU diturunkan langsung dari Buku Kas (Akun 1.1.*)
  const bkuSummary = useMemo(() => {
    if (entries.length > 0) {
      let totalPenerimaan = 0;
      let totalPengeluaran = 0;
      let allTimePenerimaan = 0;
      let allTimePengeluaran = 0;

      entries.forEach(e => {
        const code = (e.kodeRekening || '').trim();
        if (isKasAccount(code)) {
          const debetVal = Number(e.debet) || 0;
          const kreditVal = Number(e.kredit) || 0;

          allTimePenerimaan += debetVal;
          allTimePengeluaran += kreditVal;

          if (isRowInFilter(e.date)) {
            totalPenerimaan += debetVal;
            totalPengeluaran += kreditVal;
          }
        }
      });

      return {
        totalPenerimaan,
        totalPengeluaran,
        periodBalance: totalPenerimaan - totalPengeluaran,
        cumulativeBalance: allTimePenerimaan - allTimePengeluaran
      };
    }

    const totalPenerimaan = filteredBkuData.reduce((sum, item) => sum + (Number(item.penerimaan) || 0), 0);
    const totalPengeluaran = filteredBkuData.reduce((sum, item) => sum + (Number(item.pengeluaran) || 0), 0);
    const periodBalance = totalPenerimaan - totalPengeluaran;

    // Cumulative real BKU cash
    const allTimePenerimaan = bkuData.reduce((sum, item) => sum + (Number(item.penerimaan) || 0), 0);
    const allTimePengeluaran = bkuData.reduce((sum, item) => sum + (Number(item.pengeluaran) || 0), 0);
    const cumulativeBalance = allTimePenerimaan - allTimePengeluaran;

    return {
        totalPenerimaan,
        totalPengeluaran,
        periodBalance,
        cumulativeBalance
    };
  }, [entries, filteredBkuData, bkuData, selectedYear, selectedMonth, filterStartDate, filterEndDate]);

  // --- RINGKASAN EKSEKUTIF & STATISTIK KEUANGAN LENGKAP (JURNAL UMUM, SUMBER DANA & NERACA) ---
  const summaryData = useMemo(() => {
    let totalRevenue = 0;      // Akun 4.* (Pendapatan Operasional & Punia)
    let totalExpenses = 0;     // Akun 5.* (Belanja / Pengeluaran)
    let totalSumberDana = 0;   // Akun 7.* (Sumber Dana / Ekuitas)
    let totalHutangRaw = 0;    // Akun 2.* (Kewajiban / Hutang Belanja)
    let cashBalance = 0;       // Akun 1.1.* (Kas & Bank)

    // Kode Kas Penerimaan Khusus (Kas Punia, dll untuk tracking mutasi kas)
    const revenueCashCodes = ['1.1.1.03', '1.1.1.04', '1.1.1.05', '1.1.1.06', '1.1.1.09'];
    let pendapatanMasukKas = 0;
    let pendapatanTerpakai = 0;

    const activePeriodEntries = filteredEntries;

    activePeriodEntries.forEach(e => {
        const code = (e.kodeRekening || '').trim();
        const debetVal = Number(e.debet) || 0;
        const kreditVal = Number(e.kredit) || 0;
        
        // Pendapatan (Revenue - Akun 4.*)
        if (code.startsWith('4')) {
            totalRevenue += (kreditVal - debetVal);
        }
        
        // Belanja (Expense - Akun 5.*)
        if (code.startsWith('5')) {
            totalExpenses += (debetVal - kreditVal);
        }

        // Sumber Dana (Modal / Ekuitas - Akun 7.*)
        if (code.startsWith('7')) {
            totalSumberDana += (kreditVal - debetVal);
        }

        // Kewajiban / Hutang (Akun 2.*)
        if (code.startsWith('2')) {
            totalHutangRaw += (kreditVal - debetVal);
        }
        
        // Tracking mutasi penerimaan kas
        if (revenueCashCodes.includes(code)) {
            pendapatanMasukKas += debetVal;
            pendapatanTerpakai += kreditVal;
        }
    });

    // Saldo Kas Riil di Jurnal Umum (Akun 1.1.*)
    entries.forEach(e => {
        const code = (e.kodeRekening || '').trim();
        if (code.startsWith('1.1')) {
            cashBalance += ((Number(e.debet) || 0) - (Number(e.kredit) || 0));
        }
    });

    const totalHutang = Math.abs(totalHutangRaw);
    const totalPendapatanMurni = Math.max(pendapatanMasukKas, totalRevenue);
    const saldoKasPendapatan = Math.max(0, pendapatanMasukKas - pendapatanTerpakai);
    const pendapatanTersedia = saldoKasPendapatan > 0 ? saldoKasPendapatan : totalPendapatanMurni;

    // --- PERHITUNGAN OPSI 1 DARI NERACA ---
    // Prinsip: Pelunasan Hutang & Pemulihan Utuh Pendapatan dari Sumber Dana Pokok
    // Seluruh hutang diselesaikan dan seluruh pendapatan (Punia/Sasah Abu) dipulihkan utuh 100% dari Sumber Dana Pokok
    const opsi1KebutuhanSumberDana = totalHutang + pendapatanTerpakai;
    const opsi1NetOperasional = totalRevenue - totalExpenses; // Surplus/Defisit murni pendapatan operasional vs belanja

    // --- PERHITUNGAN OPSI 2 DARI NERACA ---
    // Prinsip: Pelunasan Hutang dari Hasil Pendapatan + Estimasi Sumber Dana
    // Alokasi hasil pendapatan untuk pelunasan hutang = min(Pendapatan Tersedia, Total Hutang)
    // Sisa kekurangan hutang yang didanai Sumber Dana = max(0, Total Hutang - Alokasi Pendapatan)
    const opsi2AlokasiPendapatan = Math.min(pendapatanTersedia, totalHutang);
    const opsi2EstimasiSumberDana = Math.max(0, totalHutang - opsi2AlokasiPendapatan);
    const opsi2SisaPendapatan = Math.max(0, totalRevenue - opsi2AlokasiPendapatan);
    const opsi2NetOperasional = (totalRevenue - opsi2AlokasiPendapatan) - totalExpenses;

    return { 
      totalRevenue, 
      totalExpenses, 
      totalSumberDana,
      totalHutang,
      balance: cashBalance,
      pendapatanTerpakai,
      pendapatanTersedia,
      opsi1KebutuhanSumberDana,
      opsi1NetOperasional,
      opsi2AlokasiPendapatan,
      opsi2EstimasiSumberDana,
      opsi2SisaPendapatan,
      opsi2NetOperasional,
      netSurplusDeficit: totalRevenue - totalExpenses
    };
  }, [entries, filteredEntries]);

  // Surplus / Defisit Operasional
  const netSurplusDeficit = summaryData.netSurplusDeficit;
  // Selisih Rekonsiliasi Kas (BKU vs Kas JU)
  const reconciliationDelta = Math.abs(bkuSummary.cumulativeBalance - summaryData.balance);
  const isReconciled = reconciliationDelta === 0;

  // --- DATA QUALITY INDEX (DQI) - KONSISTENSI TRANSAKSI TAHUN ANGGARAN BERJALAN ---
  const activeFinancialYear = selectedYear === 'all' 
    ? (availableYears[0] || new Date().getFullYear()) 
    : selectedYear;

  const dqiMetrics = useMemo(() => {
    // Filter transaksi untuk tahun keuangan yang aktif / berjalan
    const currentYearEntries = entries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d.getFullYear() === activeFinancialYear;
    });

    const totalRows = currentYearEntries.length;
    if (totalRows === 0) {
      return {
        score: 100,
        statusText: 'Standar Ideal',
        category: 'prima' as const,
        totalTransactions: 0,
        balancedTransactions: 0,
        balanceRatio: 100,
        overallBalanceRatio: 100,
        reconciliationScore: 100,
        completenessRatio: 100,
        continuityRatio: 100,
        totalDebet: 0,
        totalKredit: 0,
        deltaDebetKredit: 0,
        reconciliationDelta,
        activeYear: activeFinancialYear
      };
    }

    // 1. Konsistensi Keseimbangan Pembukuan Berpasangan (Double-Entry Balance)
    const txMap = new Map<string, { debet: number; kredit: number; dates: Set<string> }>();
    let totalDebetYear = 0;
    let totalKreditYear = 0;
    let validCompletenessRows = 0;
    let validContinuityRows = 0;

    currentYearEntries.forEach(e => {
      const dVal = Number(e.debet) || 0;
      const kVal = Number(e.kredit) || 0;
      totalDebetYear += dVal;
      totalKreditYear += kVal;

      const txId = (e.idTransaksi || '').trim() || `GEN-${e.date}-${e.rowId || 'row'}`;
      if (!txMap.has(txId)) {
        txMap.set(txId, { debet: 0, kredit: 0, dates: new Set() });
      }
      const g = txMap.get(txId)!;
      g.debet += dVal;
      g.kredit += kVal;
      if (e.date) g.dates.add(e.date);

      // Kelengkapan parameter dan atribut per baris
      const hasValidDate = Boolean(e.date && !isNaN(new Date(e.date).getTime()));
      const rawCode = (e.kodeRekening || '').trim();
      const hasValidCode = rawCode.length >= 3 && /^[1-7]/.test(rawCode);
      const hasValidUraian = Boolean(e.uraian && e.uraian.trim().length >= 3);
      const hasValidAmount = (dVal > 0 || kVal > 0) && !isNaN(dVal) && !isNaN(kVal);
      const hasValidType = e.rowType === 'debet' || e.rowType === 'kredit';

      if (hasValidDate && hasValidCode && hasValidUraian && hasValidAmount && hasValidType) {
        validCompletenessRows++;
      }

      // Kontinuitas rujukan & ID transaksi
      if (e.idTransaksi && e.idTransaksi.trim().length > 0) {
        validContinuityRows++;
      }
    });

    const totalTxCount = txMap.size;
    let balancedTxCount = 0;

    txMap.forEach((val) => {
      if (Math.abs(val.debet - val.kredit) < 0.01) {
        balancedTxCount++;
      }
    });

    // Rasio Transaksi Berpasangan Seimbang (Bobot 35%)
    const balanceRatio = totalTxCount > 0 ? (balancedTxCount / totalTxCount) * 100 : 100;

    // Rasio Keseluruhan Debet vs Kredit Tahun Ini (Bobot 15%)
    const deltaDebetKredit = Math.abs(totalDebetYear - totalKreditYear);
    const overallBalanceRatio = deltaDebetKredit < 0.01 
      ? 100 
      : Math.max(0, 100 - (deltaDebetKredit / Math.max(1, totalDebetYear)) * 100);

    // Rasio Rekonsiliasi Kas BKU vs Jurnal Kas (Bobot 25%)
    const reconDelta = Math.abs((selectedYear === 'all' ? bkuSummary.cumulativeBalance : bkuSummary.periodBalance) - summaryData.balance);
    const reconciliationScore = reconDelta < 0.01
      ? 100
      : Math.max(0, 100 - (reconDelta / Math.max(1, Math.abs(summaryData.balance) || 1)) * 100);

    // Rasio Kelengkapan Data & Atribut (Bobot 15%)
    const completenessRatio = totalRows > 0 ? (validCompletenessRows / totalRows) * 100 : 100;

    // Rasio Rujukan & Identitas Transaksi (Bobot 10%)
    const continuityRatio = totalRows > 0 ? (validContinuityRows / totalRows) * 100 : 100;

    // Skor Tertimbang Indeks Kualitas Data (DQI)
    const rawScore = (
      balanceRatio * 0.35 +
      overallBalanceRatio * 0.15 +
      reconciliationScore * 0.25 +
      completenessRatio * 0.15 +
      continuityRatio * 0.10
    );

    const score = Math.min(100, Math.max(0, Math.round(rawScore * 10) / 10));

    let statusText = 'Sangat Baik (Prima)';
    let category: 'prima' | 'baik' | 'cukup' | 'perlu-perhatian' = 'prima';

    if (score >= 95) {
      statusText = 'Sangat Baik (Prima)';
      category = 'prima';
    } else if (score >= 85) {
      statusText = 'Baik & Konsisten';
      category = 'baik';
    } else if (score >= 70) {
      statusText = 'Cukup (Perlu Review)';
      category = 'cukup';
    } else {
      statusText = 'Perlu Rekonsiliasi';
      category = 'perlu-perhatian';
    }

    return {
      score,
      statusText,
      category,
      totalTransactions: totalTxCount,
      balancedTransactions: balancedTxCount,
      balanceRatio: Math.round(balanceRatio * 10) / 10,
      overallBalanceRatio: Math.round(overallBalanceRatio * 10) / 10,
      reconciliationScore: Math.round(reconciliationScore * 10) / 10,
      completenessRatio: Math.round(completenessRatio * 10) / 10,
      continuityRatio: Math.round(continuityRatio * 10) / 10,
      totalDebet: totalDebetYear,
      totalKredit: totalKreditYear,
      deltaDebetKredit,
      reconciliationDelta: reconDelta,
      activeYear: activeFinancialYear
    };
  }, [entries, activeFinancialYear, selectedYear, bkuSummary.cumulativeBalance, bkuSummary.periodBalance, summaryData.balance, reconciliationDelta]);

  // --- CHARTS DATA ---
  const monthlyChartData: MonthlyData[] = useMemo(() => {
    const monthly: { [key: string]: { penerimaan: number; realisasi: number } } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    if (selectedYear !== 'all') {
        monthNames.forEach(m => {
            const key = `${m} ${selectedYear}`;
            monthly[key] = { penerimaan: 0, realisasi: 0 };
        });
    }

    filteredEntries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const key = selectedYear === 'all' ? `${monthNames[monthIndex]} ${year}` : `${monthNames[monthIndex]} ${selectedYear}`;
      
      if (!monthly[key]) {
          monthly[key] = { penerimaan: 0, realisasi: 0 };
      }

      const rawCode = e.kodeRekening || '';
      const cleanCode = rawCode.split(' - ')[0].trim();
      const kreditVal = Number(e.kredit) || 0;
      const debetVal = Number(e.debet) || 0;

      // Penerimaan: Kelompok 4 (Pendapatan), Kelompok 7 (Sumber Dana/Hibah), Kelompok 6 (Pembiayaan/SILPA)
      if (cleanCode.startsWith('4') || cleanCode.startsWith('7') || cleanCode.startsWith('6')) {
          monthly[key].penerimaan += (kreditVal - debetVal);
      }
      // Pengeluaran: Kelompok 5 (Belanja)
      if (cleanCode.startsWith('5')) {
          monthly[key].realisasi += (debetVal - kreditVal);
      }
    });

    return Object.entries(monthly)
        .map(([name, values]) => ({ name, ...values }))
        .sort((a,b) => {
            const [mA, yA] = a.name.split(' ');
            const [mB, yB] = b.name.split(' ');
            if (yA !== yB) return Number(yA) - Number(yB);
            return monthNames.indexOf(mA) - monthNames.indexOf(mB);
        });
  }, [filteredEntries, selectedYear]);

  const revenueCategoryData: CategoryData[] = useMemo(() => {
    const categories: { [key: string]: { value: number; count: number; code: string } } = {};
    filteredEntries.forEach(e => {
        const rawCode = e.kodeRekening || '';
        const cleanCode = rawCode.split(' - ')[0].trim();
        // Penerimaan: Akun 4.* (Pendapatan), 7.* (Sumber Dana), 6.* (Pembiayaan/Silpa)
        if (cleanCode.startsWith('4') || cleanCode.startsWith('7') || cleanCode.startsWith('6')) {
            const acc = REFERENSI_REKENING.find(r => r.code === cleanCode);
            const accName = acc?.name || (e.namaAkun ? e.namaAkun : (rawCode.includes(' - ') ? rawCode.split(' - ')[1].trim() : 'Pendapatan Lain-lain'));
            if (!categories[accName]) {
              categories[accName] = { value: 0, count: 0, code: cleanCode };
            }
            categories[accName].value += ((Number(e.kredit) || 0) - (Number(e.debet) || 0));
            categories[accName].count += 1;
        }
    });
    return Object.entries(categories)
      .map(([name, item]) => ({ 
        name, 
        value: item.value, 
        count: item.count, 
        code: item.code 
      }))
      .filter(item => item.value > 0)
      .sort((a,b) => b.value - a.value);
  }, [filteredEntries]);

  const expenseCategoryData: CategoryData[] = useMemo(() => {
      const categories: { [key: string]: { value: number; count: number; code: string } } = {};
      filteredEntries.forEach(e => {
          const rawCode = e.kodeRekening || '';
          const cleanCode = rawCode.split(' - ')[0].trim();
          if (cleanCode.startsWith('5')) {
              const acc = REFERENSI_REKENING.find(r => r.code === cleanCode);
              const accName = acc?.name || (e.namaAkun ? e.namaAkun : (rawCode.includes(' - ') ? rawCode.split(' - ')[1].trim() : 'Belanja Lain-lain'));
              if (!categories[accName]) {
                categories[accName] = { value: 0, count: 0, code: cleanCode };
              }
              categories[accName].value += ((Number(e.debet) || 0) - (Number(e.kredit) || 0));
              categories[accName].count += 1;
          }
      });
      return Object.entries(categories)
        .map(([name, item]) => ({ 
          name, 
          value: item.value, 
          count: item.count, 
          code: item.code 
        }))
        .filter(item => item.value > 0)
        .sort((a,b) => b.value - a.value);
  }, [filteredEntries]);
  
  const allTransactions: Transaction[] = useMemo(() => {
    const txs: Transaction[] = [];
    const processedIds = new Set<string>();

    filteredEntries.forEach(e => {
        if (!e.idTransaksi || processedIds.has(e.idTransaksi)) return;
        
        const related = filteredEntries.filter(r => r.idTransaksi === e.idTransaksi);
        const revenueRow = related.find(r => {
          const c = (r.kodeRekening || '').split(' - ')[0].trim();
          return c.startsWith('4') || c.startsWith('7') || c.startsWith('6');
        });
        const expenseRow = related.find(r => {
          const c = (r.kodeRekening || '').split(' - ')[0].trim();
          return c.startsWith('5');
        });

        if (revenueRow) {
            const revCode = (revenueRow.kodeRekening || '').split(' - ')[0].trim();
            const revAcc = REFERENSI_REKENING.find(r => r.code === revCode);
            txs.push({
                id: `${e.idTransaksi}-rev`,
                date: e.date || '',
                description: e.uraian,
                amount: ((Number(revenueRow.kredit) || 0) - (Number(revenueRow.debet) || 0)),
                type: 'Pendapatan',
                category: revAcc?.name || revenueRow.namaAkun || 'Pendapatan',
            });
        }
        if (expenseRow) {
            const expCode = (expenseRow.kodeRekening || '').split(' - ')[0].trim();
            const expAcc = REFERENSI_REKENING.find(r => r.code === expCode);
            txs.push({
                id: `${e.idTransaksi}-exp`,
                date: e.date || '',
                description: e.uraian,
                amount: ((Number(expenseRow.debet) || 0) - (Number(expenseRow.kredit) || 0)),
                type: 'Realisasi',
                category: expAcc?.name || expenseRow.namaAkun || 'Belanja',
            });
        }
        processedIds.add(e.idTransaksi);
    });

    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredEntries]);

  const recentTransactions = allTransactions.slice(0, 5);
  const topTransactions = [...allTransactions].sort((a,b) => b.amount - a.amount).slice(0, 5);

  // --- KALKULASI RINGKASAN INSTAN: TOTAL KAS HARI INI & TRANSAKSI TERAKHIR ---
  const totalKasHariIni = useMemo(() => {
    if (entries.length > 0) {
      return summaryData.balance;
    }
    return bkuSummary.cumulativeBalance;
  }, [entries.length, summaryData.balance, bkuSummary.cumulativeBalance]);

  const todayStats = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    let cashIn = 0;
    let cashOut = 0;
    let txCount = 0;

    if (entries.length > 0) {
      entries.forEach(e => {
        if (e.date && e.date.startsWith(todayStr)) {
          const code = (e.kodeRekening || '').trim();
          if (isKasAccount(code) || code.startsWith('1.1')) {
            const deb = Number(e.debet) || 0;
            const kre = Number(e.kredit) || 0;
            cashIn += deb;
            cashOut += kre;
            if (deb > 0 || kre > 0) txCount++;
          }
        }
      });
    } else if (bkuData.length > 0) {
      bkuData.forEach(b => {
        if (b.tanggal && b.tanggal.startsWith(todayStr)) {
          cashIn += Number(b.penerimaan) || 0;
          cashOut += Number(b.pengeluaran) || 0;
          txCount++;
        }
      });
    }

    return { cashIn, cashOut, txCount };
  }, [entries, bkuData]);

  const latestTransaction = useMemo<Transaction | null>(() => {
    if (allTransactions.length > 0) {
      return allTransactions[0];
    }
    if (bkuData.length > 0) {
      const sortedBku = [...bkuData].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      const first = sortedBku[0];
      const isPenerimaan = (Number(first.penerimaan) || 0) > 0;
      return {
        id: first.id || first.noBukti || 'bku-last',
        date: first.tanggal,
        description: first.uraian,
        amount: isPenerimaan ? (Number(first.penerimaan) || 0) : (Number(first.pengeluaran) || 0),
        type: isPenerimaan ? 'Penerimaan' : 'Realisasi',
        category: first.kategori || 'Buku Kas Umum'
      };
    }
    return null;
  }, [allTransactions, bkuData]);

  const activeCashAccounts = useMemo(() => {
    const list = Object.values(cashAccountBalances) as Array<{ code: string; name: string; balance: number }>;
    return list.filter(a => a.balance !== 0);
  }, [cashAccountBalances]);

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

  const handleDownloadSummaryPdf = async () => {
    setIsExportingSummaryPdf(true);
    const cleanLabel = activePeriodLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Ringkasan_KPI_Dashboard_Kas_${cleanLabel}.pdf`;
    
    try {
      const targetId = document.getElementById('dashboard-summary-card') ? 'dashboard-summary-card' : 'kpi-summary-section';
      const success = await exportElementToPdf(targetId, {
        filename,
        orientation: 'landscape',
        format: 'a4',
        margin: [6, 6, 6, 6],
        enableWatermark: true,
        watermarkText: 'Desa Adat Basangalas'
      });
      
      if (success !== false) {
        showNotification(`Dokumen "${filename}" berhasil diunduh sebagai PDF!`, 'success');
      } else {
        showNotification(`Sistem dialog cetak dibuka untuk dokumen "${filename}".`, 'info');
      }
    } catch (err) {
      console.error('Error exporting KPI Summary PDF:', err);
      showNotification('Gagal mengunduh ringkasan KPI PDF. Silakan coba lagi.', 'error');
    } finally {
      setIsExportingSummaryPdf(false);
    }
  };

  return (
    <div className="space-y-6 relative" id="printable-area">
      {/* Falling Particles Wrapper */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none no-print" style={{ zIndex: 0 }}>
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
          @media print {
            @page { size: landscape; margin: 10mm; }
            body * { visibility: hidden; }
            #printable-area, #printable-area * { visibility: visible; }
            #printable-area { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; }
            .no-print { display: none !important; }
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
      `}</style>

      {/* Header & Filter */}
      <div className="bg-transparent text-gray-900 border-b-4 border-emerald-500 p-4 pb-3 no-print rounded-2xl shadow-sm relative overflow-visible z-30">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
            <div className="absolute -right-0 -bottom-0 opacity-20 text-emerald-300 pointer-events-none">
                <Droplets size={120} />
            </div>
        </div>
        {/* Box System dan Identitas */}
        <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-900 border border-amber-500/40 shadow-xs flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-amber-800" />
                Bacol Enterprise System
            </span>
            <span className="px-3 py-1 rounded-full text-[9px] font-sans font-black tracking-widest uppercase bg-emerald-500/20 text-emerald-700 border border-emerald-500/40">
                Desa Adat Basangalas
            </span>
            {/* Download Summary PDF Button */}
            <button
              type="button"
              onClick={handleDownloadSummaryPdf}
              disabled={isExportingSummaryPdf}
              className="flex items-center gap-2 bg-teal-100 hover:bg-teal-200 text-teal-900 text-xs font-black px-3 py-1 rounded-xl border border-teal-300 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download print-friendly export of KPI Summary Section (PDF)"
            >
              {isExportingSummaryPdf ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Mengekspor PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Download PDF</span>
                </>
              )}
            </button>
        </div>

        <div className="mt-2 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative z-20">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
             <div className="bg-teal-500/20 p-3 rounded-2xl border border-teal-500/30 text-teal-700 shrink-0">
                <Droplets className="h-7 w-7 sm:h-8 sm:w-8 text-teal-600" />
             </div>
             <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                 <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight font-serif">
                  Dashboard Keuangan Desa Adat</h2>
                </div>
                 <p className="text-xs text-teal-700 font-bold tracking-wider mt-0.5">
                  Dashboard Akuntansi Periode: {activePeriodLabel}</p>
             </div>
          </div>
          
          {/* Tombol Input Data Baru & Dropdown Kategori Transaksi */}
          <div className="relative w-full sm:w-auto z-50" ref={categoryDropdownRef}>
            <button
              type="button"
              id="btn-transaksi-baru-dashboard"
              onClick={handleOpenInput}
              className="w-full sm:w-auto bg-emerald-500/20 hover:bg-teal-500 text-slate-900 border border-emerald-500/60 font-black py-1 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 uppercase tracking-wider text-[9px] sm:text-sm transition-all cursor-pointer"
              aria-haspopup="true"
              aria-expanded={showCategoryDropdown}
              title="Buka pilihan Transaksi Baru"
            >
              <Plus size={16} />
              <span>Entry Baru</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* DROPDOWN MENU: INPUT KATEGORI TRANSAKSI */}
            {showCategoryDropdown && (
              <div className="absolute left-0 lg:left-auto lg:right-0 top-full mt-2 w-[calc(100vw-32px)] sm:w-80 max-w-xs sm:max-w-none bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-fade-in text-slate-800 dark:text-slate-100 divide-y divide-slate-100 dark:divide-slate-800">
                {/* Header Dropdown */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/90 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-teal-600 dark:text-teal-400" />
                      Input Kategori Transaksi
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Pilih jenis transaksi untuk otomatisasi akun:
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300 font-bold">
                    3 Pilihan
                  </span>
                </div>

                {/* Menu Items */}
                <div className="p-1.5 space-y-1">
                  {/* 1. Mutasi */}
                  <button
                    type="button"
                    onClick={() => handleOpenCategory('mutasi')}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 group-hover:scale-110 transition-transform shrink-0">
                      <ArrowLeftRight size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        1. Mutasi
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                        Kredit: Kas Sumber | Debet: Kas Penerima
                      </div>
                    </div>
                  </button>

                  {/* 2. Pendapatan */}
                  <button
                    type="button"
                    onClick={() => handleOpenCategory('pendapatan')}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform shrink-0">
                      <Coins size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        2. Pendapatan
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                        Kredit: Pendapatan | Debet: Kas Otomatis
                      </div>
                    </div>
                  </button>

                  {/* 3. Belanja Adat */}
                  <button
                    type="button"
                    onClick={() => handleOpenCategory('belanja_adat')}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform shrink-0">
                      <ShoppingBag size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        3. Belanja Adat
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                        Kas Desa Adat &amp; Juru Raksa (Kecuali Insentif)
                      </div>
                    </div>
                  </button>
                </div>

                {/* Direct / Manual option */}
                <div className="p-2 bg-slate-50 dark:bg-slate-800/60 text-center">
                  <button
                    type="button"
                    onClick={handleDirectOpenInput}
                    className="w-full text-center py-1.5 px-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Entri Formulir Kosong (Manual) →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
            
        {/* --- BILAH FILTER DASHBOARD (BULAN, DARI TANGGAL S.D SAMPAI TANGGAL, TAHUN) --- */}
        <div className="mt-3.5 pt-3.5 border-t border-emerald-500/20 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-filter-dashboard"
                onClick={() => setShowFilterDashboard(prev => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                  showFilterDashboard 
                    ? 'bg-teal-800 text-white ring-2 ring-teal-400' 
                    : 'bg-teal-700 hover:bg-teal-800 text-white'
                }`}
                aria-expanded={showFilterDashboard}
                title={showFilterDashboard ? "Sembunyikan Filter Dashboard" : "Tampilkan Filter Dashboard"}
              >
                <Filter size={13} className={showFilterDashboard ? "text-teal-200" : "text-white"} />
                <span>Filter Dashboard</span>
                {showFilterDashboard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              <span className="text-[11px] font-mono font-bold bg-teal-50 text-teal-900 border border-teal-200 px-2.5 py-0.5 rounded-full">
                {filteredEntries.length} Baris Jurnal
              </span>
              <span className="text-[11px] font-bold text-slate-800 bg-white px-3 py-0.5 rounded-full border border-slate-300 shadow-2xs">
                Periode: <strong className="text-teal-800">{activePeriodLabel}</strong>
              </span>

              {isFilterActive && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Filter Aktif
                </span>
              )}
            </div>

            {/* Quick Reset Button saat filter sedang tertutup/tersembunyi */}
            {!showFilterDashboard && isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Reset Semua Filter ke Default"
              >
                <RotateCcw size={11} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Kontrol Filter & Presets (Hanya ditampilkan saat showFilterDashboard = true) */}
          {showFilterDashboard && (
            <div className="bg-white/95 backdrop-blur-xs border border-teal-200/80 p-3.5 rounded-2xl shadow-md space-y-3 mt-1 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter size={13} className="text-teal-600" />
                  Pengaturan Filter Periode
                </span>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                    <Clock size={11} className="text-teal-600" /> Preset:
                  </span>
                  <button
                    type="button"
                    onClick={handlePresetAll}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedYear === 'all' && selectedMonth === 'all' && !filterStartDate && !filterEndDate
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                    title="Tampilkan seluruh data tanpa batasan filter"
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetThisMonth}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedMonth === String(new Date().getMonth() + 1).padStart(2, '0') && selectedYear === new Date().getFullYear() && !filterStartDate
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                    title="Filter ke bulan berjalan saat ini"
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={handlePresetThisYear}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedYear === new Date().getFullYear() && selectedMonth === 'all' && !filterStartDate
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                    title="Filter ke tahun anggaran berjalan saat ini"
                  >
                    Tahun Ini ({new Date().getFullYear()})
                  </button>
                  {isFilterActive && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Reset Semua Filter ke Default"
                    >
                      <RotateCcw size={11} />
                      <span>Reset Filter</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFilterDashboard(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
                    title="Tutup Filter"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Grid Kontrol Filter: Tahun, Bulan, Dari Tanggal, Sampai Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
                {/* 1. Filter Tahun */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-teal-600" /> Filter Tahun
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                  >
                    <option value="all">Semua Tahun</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Filter Bulan */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-teal-600" /> Filter Bulan
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                  >
                    {MONTHS_LIST.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Filter Dari Tanggal */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-teal-600" /> Dari Tanggal
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                    />
                    {filterStartDate && (
                      <button
                        type="button"
                        onClick={() => setFilterStartDate('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Kosongkan Dari Tanggal"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Filter Sampai Tanggal */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                    <Calendar size={12} className="text-teal-600" /> Sampai Tanggal
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                    />
                    {filterEndDate && (
                      <button
                        type="button"
                        onClick={() => setFilterEndDate('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Kosongkan Sampai Tanggal"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- RINGKASAN EKSEKUTIF & POSISI KEUANGAN (KPI SUMMARY SECTION) --- */}
      <div id="dashboard-summary-card" data-section="kpi-summary-section" className="bg-white p-6 rounded-2xl shadow-xl border border-slate-400 text-slate-900 relative overflow-hidden print:border-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none no-print"></div>

        {/* Print-friendly Formal Header for html2pdf / Printing */}
        <div className="hidden print:block text-slate-900 mb-5 pb-3 border-b-2 border-slate-900 text-center">
          <h2 className="text-lg font-black uppercase tracking-widest font-serif m-0 text-slate-900">
            DESA ADAT BASANGALAS
          </h2>
          <h2 className="text-lg font-black uppercase tracking-widest font-serif m-0 text-slate-900">
            LAPORAN KAS DESA ADAT
          </h2>
          <p className="text-sm font-bold font-serif text-slate-800 my-0.5">
            Laporan Ringkasan Eksekutif &amp; Net Operasional Neraca (Real-Time)
          </p>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 mt-2 px-2 border-t border-dashed border-slate-300 pt-1">
            <span>Periode: <strong className="text-slate-900">{activePeriodLabel}</strong></span>
            <span>Tanggal Cetak: <strong className="text-slate-900">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
            <span>Status: <strong className="text-emerald-700">{isReconciled ? 'Terekonsiliasi Sempurna' : 'Perhatian Rekonsiliasi'}</strong></span>
          </div>
        </div>

        {/* Top Header of Executive Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-slate-400">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
              <Scale size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase flex items-center gap-2">
                Ringkasan Eksekutif &amp; KPI Real-Time
              </h3>
              <p className="text-xs text-slate-700">
                Ringkasan Komprehensif, Pendapatan, Pengeluaran, Hutang &amp; Rekonsiliasi Net Operasional Neraca
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* DATA QUALITY INDEX PERCENTAGE INDICATOR BADGE */}
            <button
              type="button"
              onClick={() => setShowDqiDetailModal(true)}
              className="no-print group flex items-center gap-2.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 via-teal-50/60 to-slate-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-300/90 rounded-xl shadow-2xs transition-all cursor-pointer select-none active:scale-95 text-left"
              title="Klik untuk melihat rincian kalkulasi Data Quality Index (DQI)"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600 group-hover:bg-emerald-700 text-white font-black shadow-xs transition-colors shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Data Quality Index</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300/60">
                    Thn {dqiMetrics.activeYear}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="text-sm font-black font-mono tracking-tight text-emerald-800">
                    {dqiMetrics.score.toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 hidden sm:inline">
                    • {dqiMetrics.statusText}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleDownloadSummaryPdf}
              disabled={isExportingSummaryPdf}
              className="no-print flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-gray-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-rose-500 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Unduh bagian ringkasan KPI ini sebagai file PDF"
            >
              {isExportingSummaryPdf ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              <span>Export PDF</span>
            </button>
            <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-300 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-700 font-semibold">Data Terintegrasi Real-Time</span>
            </div>
          </div>
        </div>

        {/* --- DATA QUALITY INDEX CONSISTENCY STRIP --- */}
        <div className="mb-5 p-3 sm:p-3.5 bg-gradient-to-r from-slate-50 via-teal-50/30 to-emerald-50/40 rounded-xl border border-slate-300/90 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300 shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <span>Data Quality Index (Konsistensi Transaksi)</span>
                </h4>
                <span className={`px-2 py-0.5 text-[10px] font-mono font-black rounded-full border ${
                  dqiMetrics.category === 'prima'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : dqiMetrics.category === 'baik'
                    ? 'bg-teal-100 text-teal-900 border-teal-300'
                    : dqiMetrics.category === 'cukup'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
                }`}>
                  {dqiMetrics.score.toFixed(1)}% — {dqiMetrics.statusText}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Tahun Anggaran: <strong className="text-slate-800">{dqiMetrics.activeYear}</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Evaluasi otomatis konsistensi pembukuan berpasangan (double-entry), rekonsiliasi kas BKU, dan validitas transaksi tahun berjalan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 w-full md:w-auto shrink-0 justify-between md:justify-end">
            <div className="w-36 hidden sm:block">
              <div className="flex justify-between text-[10px] font-mono font-bold text-slate-600 mb-1">
                <span>Konsistensi</span>
                <span className="text-emerald-800">{dqiMetrics.score.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, dqiMetrics.score))}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDqiDetailModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
            >
              <Info size={13} className="text-teal-600" />
              <span>Rincian Metrik</span>
            </button>
          </div>
        </div>

        {/* --- KARTU RINGKASAN INSTAN: TOTAL KAS HARI INI & TOTAL TRANSAKSI TERAKHIR --- */}
        <InstantSummaryCards
          totalKasHariIni={totalKasHariIni}
          todayCashIn={todayStats.cashIn}
          todayCashOut={todayStats.cashOut}
          todayTxCount={todayStats.txCount}
          todayDate={new Date()}
          latestTransaction={latestTransaction}
          recentTransactions={recentTransactions}
          cashAccounts={activeCashAccounts}
          setActivePage={setActivePage}
        />

        {/* --- BAGIAN 1: GRID 4 CARD RINGKASAN EKSEKUTIF UTAMA --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: TOTAL SUMBER DANA */}

          {/* Card 2: TOTAL PENDAPATAN */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 hover:border-emerald-400 transition-all shadow-xs relative group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight size={15} className="text-emerald-600" /> Total Pendapatan
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                  Akun 4.x
                </span>
              </div>
              <p className="text-xl font-black text-emerald-800 font-mono tracking-tight my-1">
                {formatCurrency(summaryData.totalRevenue)}
              </p>
              <p className="text-[11px] text-emerald-700/90 leading-tight mt-1">
                Pendapatan Desa Adat &amp; Lainnya
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-200/80 flex items-center justify-between text-[10px] font-mono text-emerald-800 font-semibold">
              <span>Penerimaan Periode Ini</span>
              <span className="bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900">Masuk</span>
            </div>
          </div>

          {/* Card 3: TOTAL PENGELUARAN */}
          <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-500 hover:border-rose-500 transition-all shadow-xs relative group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft size={15} className="text-rose-600" /> Total Pengeluaran
                </span>
                <span className="text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-full">
                  Akun 5.x
                </span>
              </div>
              <p className="text-xl font-black text-rose-800 font-mono tracking-tight my-1">
                {formatCurrency(summaryData.totalExpenses)}
              </p>
              <p className="text-[11px] text-rose-900/90 leading-tight mt-1">
                Realisasi Belanja &amp; Operasional
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-rose-500/80 flex items-center justify-between text-[10px] font-mono text-rose-800 font-semibold">
              <span>Belanja / Beban</span>
              <span className="bg-rose-200/60 px-1.5 py-0.5 rounded text-rose-900">Keluar</span>
            </div>
          </div>

          {/* Card 4: TOTAL HUTANG */}
          <div className={`p-4 rounded-xl border transition-all shadow-xs relative group flex flex-col justify-between ${
            summaryData.totalHutang > 0 
              ? 'bg-purple-50/50 border-purple-400 hover:border-purple-500' 
              : 'bg-slate-50 border-slate-300 hover:border-slate-400'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  summaryData.totalHutang > 0 ? 'text-purple-800' : 'text-slate-700'
                }`}>
                  <Receipt size={15} className={summaryData.totalHutang > 0 ? 'text-purple-600' : 'text-slate-500'} /> Total Hutang
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  summaryData.totalHutang > 0 
                    ? 'bg-purple-100 text-purple-900 border-purple-300' 
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}>
                  Akun 2.x
                </span>
              </div>
              <p className={`text-2xl font-black font-mono tracking-tight my-1 ${
                summaryData.totalHutang > 0 ? 'text-purple-900' : 'text-slate-900'
              }`}>
                {formatCurrency(summaryData.totalHutang)}
              </p>
              <p className={`text-[11px] leading-tight mt-1 ${
                summaryData.totalHutang > 0 ? 'text-purple-900' : 'text-slate-700'
              }`}>
                {summaryData.totalHutang > 0 
                  ? 'Kewajiban Belanja yang Belum Dilunasi' 
                  : 'Kewajiban / Hutang Nihil (Lunas Sempurna)'}
              </p>
            </div>
            <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[10px] font-mono font-semibold ${
              summaryData.totalHutang > 0 
                ? 'border-purple-200/80 text-purple-800' 
                : 'border-slate-200 text-slate-600'
            }`}>
              <span>Status Kewajiban</span>
              <span className={`px-1.5 py-0.5 rounded ${
                summaryData.totalHutang > 0 
                  ? 'bg-purple-200 text-purple-900' 
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {summaryData.totalHutang > 0 ? 'Ada Hutang' : 'Lunas'}
              </span>
            </div>
          </div>
          {/* Saldo Kas Riil (BKU vs Kas JU) */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-slate-300 hover:border-slate-500 transition-all shadow-xs relative group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark size={15} className="text-slate-600" /> Total Saldo Kas Riil
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-slate-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  Akun 1.1
                </span>
              </div>
              <p className="text-xl font-black text-amber-900 font-mono tracking-tight my-1">
                {formatCurrency(totalKasHariIni)}
              </p>
              <p className="text-[11px] text-slate-900 leading-tight mt-1">
                Kas Desa Adat, &amp; Saldo Riil Tersedia
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-amber-400/80 flex items-center justify-between text-[10px] font-mono text-slate-800 font-semibold">
              <span>Status Kas Riil</span>
              <span className="bg-amber-200/60 px-1.5 py-0.5 rounded text-slate-900">Aktif</span>
            </div>
          </div>
        </div>

        {/* Footer Banner Rekonsiliasi & Status Integritas Kas */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-400">
          <div className="flex items-center gap-3">
            {isReconciled ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div className="text-xs">
              <span className="font-bold text-slate-900">Rekonsiliasi Kas (BKU vs Akun Kas Jurnal): </span>
              {isReconciled ? (
                <span className="text-emerald-700 font-semibold">Terekonsiliasi Sempurna (100% Match - Selisih Rp 0)</span>
              ) : (
                <span className="text-amber-700 font-semibold">Terdapat Selisih {formatCurrency(reconciliationDelta)} (BKU: {formatCurrency(bkuSummary.cumulativeBalance)} vs Jurnal: {formatCurrency(summaryData.balance)})</span>
              )}
            </div>
          </div>
          <span className="text-[12px] font-mono font-bold text-slate-900 bg-white px-3 py-1 rounded-md border border-slate-400 shrink-0 shadow-2xs">
            Kas Riil (BKU): {formatCurrency(selectedYear === 'all' ? bkuSummary.cumulativeBalance : bkuSummary.periodBalance)}
          </span>
        </div>
      </div>

      {/* --- RINGKASAN ANGGARAN & SERAPAN BERJALAN (PROGRESS BAR PENDAPATAN VS BELANJA) --- */}
      <BudgetSummaryProgress 
        entries={entries}
        budgetItems={budgetItems}
        manualBudgetCaps={manualBudgetCaps}
        selectedYear={selectedYear}
        setActivePage={setActivePage}
      />

      {/* --- VISUALISASI PROPORSI PENERIMAAN BERBAGAI SUMBER DANA (RECHARTS REAL-TIME) --- */}
      <FundingSourceDistributionChart 
        entries={entries}
        bkuData={bkuData}
        danaPuniaItems={danaPuniaItems}
        urunanItems={urunanItems}
        selectedYear={selectedYear}
      />

      {/* Main Charts: Bar Chart Ringkasan Bulanan & Area/Line Chart Proyeksi Saldo */}
      <div className="flex flex-col gap-6">
        <MonthlyBarChart 
          data={monthlyChartData} 
          selectedYear={selectedYear} 
        />
        <MonthlyLineChart 
          data={monthlyChartData} 
          selectedYear={selectedYear} 
        />
      </div>
      
      {/* Pie Charts - Stacked with Sumber Pendapatan on Top and Alokasi Belanja Below */}
      <div className="flex flex-col gap-6">
          <CategoryDonutChart 
            type="revenue"
            title={`Komposisi & Distribusi Sumber Pendapatan (${activePeriodLabel})`}
            definition="Akumulasi seluruh penerimaan operasional dan pendapatan sah lainnya yang terekam pada kelompok akun 4.* di Buku Jurnal Umum & Buku Kas."
            data={revenueCategoryData} 
            selectedYear={selectedYear}
          />
          <CategoryDonutChart 
            type="expense"
            title={`Komposisi & Distribusi Alokasi Belanja (${activePeriodLabel})`}
            definition="Akumulasi seluruh realisasi beban pengeluaran Insentif, operasional, beban-beban, dan Program yang terekam pada kelompok akun 5.* di Buku Jurnal Umum & Buku Kas."
            data={expenseCategoryData} 
            selectedYear={selectedYear}
          />
      </div>

      {/* Details Lists */}
      <div className="relative">
         <RecentActivity 
            transactions={recentTransactions} 
            setActivePage={setActivePage}
         />
      </div>
      <div className="relative">
         <TopTransactions 
            transactions={topTransactions} 
            setActivePage={setActivePage}
         />
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-blue-900/20 border border-blue-800/40 rounded-2xl no-print flex items-start gap-4">
          <Info className="text-gray-700 shrink-0" />
          <p className="text-sm text-gray-700 italic leading-relaxed">
              Seluruh angka di atas dihitung secara otomatis berdasarkan <strong>Buku Kas Umum (BKU)</strong> dan <strong>Buku Jurnal Umum</strong> sesuai standar akuntansi. Nilai Pendapatan merepresentasikan seluruh kredit pada akun 4.*, sedangkan Belanja merepresentasikan debet pada akun 5.*. Saldo Kas & Bank mencerminkan posisi likuiditas riil pada BKU dan akun 1.1.*.
          </p>
      </div>

      {/* Formal Footer Layout */}
      <div className="flex justify-between items-center mt-12 text-slate-900 border-t-2 border-gray-400 pt-2">
          <div>
              <p className="font-semibold">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
              <p className="text-[10px] text-slate-500">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
          </div>
          <div className="text-right font-mono text-[8px] text-slate-500">
              <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
      </div>

      <div className="flex justify-end mt-6 no-print">
            <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-gray-700 text-gray-100 font-black py-2.5 px-8 rounded-xl border border-emerald-700 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
                <Printer size={18} />
                <span>Cetak Dashboard</span>
            </button>
      </div>

      {/* MODAL RINCIAN DATA QUALITY INDEX (DQI) */}
      {showDqiDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden animate-scale-up text-slate-900">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl">
                  <ShieldCheck size={20} className="text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Data Quality Index (DQI)</h3>
                  <p className="text-xs text-emerald-200">
                    Analisis Konsistensi Transaksi Tahun Anggaran {dqiMetrics.activeYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDqiDetailModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Score Highlight Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Indeks Konsistensi Keseluruhan
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-emerald-700">
                      {dqiMetrics.score.toFixed(1)}%
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${
                      dqiMetrics.category === 'prima'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : dqiMetrics.category === 'baik'
                        ? 'bg-teal-100 text-teal-800 border-teal-300'
                        : dqiMetrics.category === 'cukup'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {dqiMetrics.statusText}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Dihitung berdasarkan konsistensi pembukuan berpasangan, rekonsiliasi kas, dan kelengkapan atribut entri transaksi.
                  </p>
                </div>

                <div className="w-20 h-20 rounded-full border-4 border-emerald-500/30 flex items-center justify-center p-2 text-center bg-white shadow-inner shrink-0">
                  <span className="text-xs font-black text-slate-800 font-mono">
                    {dqiMetrics.score.toFixed(0)}/100
                  </span>
                </div>
              </div>

              {/* Consistency Pillars Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Rincian 4 Pilar Konsistensi Transaksi
                </h4>

                {/* 1. Keseimbangan Jurnal Berpasangan */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Scale size={14} className="text-emerald-600" />
                      1. Keseimbangan Transaksi Berpasangan (Bobot 35%)
                    </span>
                    <span className="font-mono font-bold text-emerald-700">{dqiMetrics.balanceRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dqiMetrics.balanceRatio}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {dqiMetrics.balancedTransactions} dari {dqiMetrics.totalTransactions} transaksi berpasangan memiliki total debet dan kredit yang seimbang sempurna.
                  </p>
                </div>

                {/* 2. Rekonsiliasi Kas BKU vs Jurnal */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Landmark size={14} className="text-teal-600" />
                      2. Rekonsiliasi Kas Riil BKU vs Jurnal (Bobot 25%)
                    </span>
                    <span className="font-mono font-bold text-teal-700">{dqiMetrics.reconciliationScore.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${dqiMetrics.reconciliationScore}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {dqiMetrics.reconciliationDelta === 0 
                      ? 'Saldo kas BKU dan akun kas jurnal umum terekonsiliasi 100% tanpa selisih (Rp 0).'
                      : `Terdapat selisih rekonsiliasi kas sebesar Rp ${dqiMetrics.reconciliationDelta.toLocaleString('id-ID')}.`}
                  </p>
                </div>

                {/* 3. Kesetaraan Akumulasi Debet & Kredit */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Receipt size={14} className="text-indigo-600" />
                      3. Kesetaraan Akumulasi Debet &amp; Kredit (Bobot 15%)
                    </span>
                    <span className="font-mono font-bold text-indigo-700">{dqiMetrics.overallBalanceRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${dqiMetrics.overallBalanceRatio}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Total Debet: Rp {dqiMetrics.totalDebet.toLocaleString('id-ID')} vs Total Kredit: Rp {dqiMetrics.totalKredit.toLocaleString('id-ID')} (Selisih: Rp {dqiMetrics.deltaDebetKredit.toLocaleString('id-ID')}).
                  </p>
                </div>

                {/* 4. Kelengkapan Atribut & Parameter */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-blue-600" />
                      4. Kelengkapan Parameter &amp; Atribut Transaksi (Bobot 25%)
                    </span>
                    <span className="font-mono font-bold text-blue-700">{dqiMetrics.completenessRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${dqiMetrics.completenessRatio}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {dqiMetrics.completenessRatio}% baris entri memiliki tanggal valid, kode akun baku, uraian jelas, dan nilai nominal terverifikasi.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDqiDetailModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT KATEGORI TRANSAKSI MODAL (Sesuai Entri Baru di Jurnal) */}
      <InputKategoriTransaksiModal
        isOpen={showKategoriModal}
        initialType={selectedCategoryType}
        cashBalances={cashAccountBalances}
        onClose={() => {
          setShowKategoriModal(false);
          setSelectedCategoryType(null);
        }}
        onSelectTransaction={handleSelectCategoryTransaction}
        onBypassCategory={handleDirectOpenInput}
      />
    </div>
  );
};

export default Dashboard;

