import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Scale, 
  Receipt, 
  Calendar, 
  Filter, 
  Printer, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Info, 
  Landmark, 
  Coins, 
  Calculator, 
  ShoppingBag, 
  ChevronRight, 
  FileText,
  Activity,
  Layers,
  Sparkles,
  Award,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import type { JuDisplayRow, MonthlyData, CategoryData, BkuData, DanaPuniaItem, UrunanItem, BudgetItem, ManualBudgetCaps } from '../types';
import MonthlyBarChart from '../components/dashboard/MonthlyBarChart';
import MonthlyLineChart from '../components/dashboard/MonthlyLineChart';
import CategoryDonutChart from '../components/dashboard/CategoryDonutChart';
import FundingSourceDistributionChart from '../components/dashboard/FundingSourceDistributionChart';
import BudgetSummaryProgress from '../components/dashboard/BudgetSummaryProgress';
import DebtSummaryCard from '../components/dashboard/DebtSummaryCard';
import ExecutiveSummaryAi from '../components/dashboard/ExecutiveSummaryAi';
import FinancialChatbotAi from '../components/dashboard/FinancialChatbotAi';
import FinancialHealthScoreChart from '../components/dashboard/FinancialHealthScoreChart';
import AnnualTrendBarChart from '../components/dashboard/AnnualTrendBarChart';
import MatrixSummaryPrintModal from '../components/dashboard/MatrixSummaryPrintModal';
import BudgetEfficiencyCard from '../components/dashboard/BudgetEfficiencyCard';
import BudgetProjectionAi from '../components/dashboard/BudgetProjectionAi';
import YoyFinancialAnalytics from '../components/dashboard/YoyFinancialAnalytics';
import { calculateBudgetAndRealization } from '../utils/budgetCalculations';
import { formatCurrency } from '../utils/formatter';
import { REFERENSI_REKENING, isKasAccount } from '../constants';
import { useNotification } from '../context/NotificationContext';
import { exportElementToPdf } from '../utils/pdfExport';
import { 
  getStoredSignatures, 
  getSignatureSettings, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  DigitalSignatures, 
  SignatureSettings 
} from '../utils/signatureStorage';

interface RingkasanEksekutifProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
  budgetItems?: BudgetItem[];
  manualBudgetCaps?: ManualBudgetCaps;
  setActivePage?: (page: string) => void;
  onOpenJurnalWithAccounts?: (debet: string, kredit: string) => void;
}

const RingkasanEksekutif: React.FC<RingkasanEksekutifProps> = ({
  entries,
  bkuData = [],
  danaPuniaItems = [],
  urunanItems = [],
  budgetItems = [],
  manualBudgetCaps,
  setActivePage,
  onOpenJurnalWithAccounts
}) => {
  const { showNotification } = useNotification();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isMatrixPrintModalOpen, setIsMatrixPrintModalOpen] = useState(false);
  const [showOpsiNeraca, setShowOpsiNeraca] = useState(false);
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [signatureSettings, setSignatureSettings] = useState<SignatureSettings>(() => getSignatureSettings());

  useEffect(() => {
    const handleUpdateSigs = () => {
      try {
        const sigs = getStoredSignatures();
        const settings = getSignatureSettings();
        setSignatures(sigs);
        setSignatureSettings(settings);
      } catch (e) {
        console.error('Failed to load digital signatures:', e);
      }
    };
    handleUpdateSigs();
    window.addEventListener('signatures-updated', handleUpdateSigs);
    return () => window.removeEventListener('signatures-updated', handleUpdateSigs);
  }, []);

  // Filter tahun yang tersedia dari data Jurnal, BKU, & Anggaran
  const availableYears = useMemo(() => {
    const years = new Set<number>();
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
  const [matrixYear, setMatrixYear] = useState<number | 'all'>('all');

  // Sinkronisasi filter matriks ketika filter utama halaman berubah
  useEffect(() => {
    setMatrixYear(selectedYear);
  }, [selectedYear]);

  // Filter entries berdasarkan tahun
  const filteredEntries = useMemo(() => {
    if (selectedYear === 'all') return entries;
    return entries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d.getFullYear() === selectedYear;
    });
  }, [entries, selectedYear]);

  // Filter BKU berdasarkan tahun
  const filteredBkuData = useMemo(() => {
    if (selectedYear === 'all') return bkuData;
    return bkuData.filter(b => {
      if (!b.tanggal) return false;
      const d = new Date(b.tanggal);
      return !isNaN(d.getTime()) && d.getFullYear() === selectedYear;
    });
  }, [bkuData, selectedYear]);

  // BKU Summary Stats
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

          if (selectedYear === 'all') {
            totalPenerimaan += debetVal;
            totalPengeluaran += kreditVal;
          } else if (e.date) {
            const d = new Date(e.date);
            if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
              totalPenerimaan += debetVal;
              totalPengeluaran += kreditVal;
            }
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

    const allTimePenerimaan = bkuData.reduce((sum, item) => sum + (Number(item.penerimaan) || 0), 0);
    const allTimePengeluaran = bkuData.reduce((sum, item) => sum + (Number(item.pengeluaran) || 0), 0);
    const cumulativeBalance = allTimePenerimaan - allTimePengeluaran;

    return {
      totalPenerimaan,
      totalPengeluaran,
      periodBalance,
      cumulativeBalance
    };
  }, [entries, filteredBkuData, bkuData, selectedYear]);

  // Executive Financial Statistics
  const summaryData = useMemo(() => {
    let totalRevenue = 0;      // Akun 4.* (Pendapatan Operasional & Punia)
    let totalExpenses = 0;     // Akun 5.* (Belanja / Pengeluaran)
    let totalSumberDana = 0;   // Akun 7.* (Sumber Dana / Ekuitas)
    let totalHutangRaw = 0;    // Akun 2.* (Kewajiban / Hutang Belanja)
    let cashBalance = 0;       // Akun 1.1.* (Kas & Bank)

    const revenueCashCodes = ['1.1.1.03', '1.1.1.04', '1.1.1.05', '1.1.1.06', '1.1.1.09'];
    let pendapatanMasukKas = 0;
    let pendapatanTerpakai = 0;

    const activeYearEntries = entries.filter(e => {
      if (selectedYear === 'all') return true;
      return e.date && new Date(e.date).getFullYear() === selectedYear;
    });

    activeYearEntries.forEach(e => {
      const code = (e.kodeRekening || '').trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;
      
      if (code.startsWith('4')) {
        totalRevenue += (kreditVal - debetVal);
      }
      if (code.startsWith('5')) {
        totalExpenses += (debetVal - kreditVal);
      }
      if (code.startsWith('7')) {
        totalSumberDana += (kreditVal - debetVal);
      }
      if (code.startsWith('2')) {
        totalHutangRaw += (kreditVal - debetVal);
      }
      if (revenueCashCodes.includes(code)) {
        pendapatanMasukKas += debetVal;
        pendapatanTerpakai += kreditVal;
      }
    });

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

    const opsi1KebutuhanSumberDana = totalHutang + pendapatanTerpakai;
    const opsi1NetOperasional = totalRevenue - totalExpenses;

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
  }, [entries, selectedYear]);

  // Reconciliation
  const reconciliationDelta = Math.abs(bkuSummary.cumulativeBalance - summaryData.balance);
  const isReconciled = reconciliationDelta === 0;

  // Monthly Chart Data
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

      if (cleanCode.startsWith('4') || cleanCode.startsWith('7') || cleanCode.startsWith('6')) {
        monthly[key].penerimaan += (kreditVal - debetVal);
      }
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

  // Data Bulanan Khusus Matriks Rekapitulasi Finansial berdasarkan matrixYear
  const matrixMonthlyData: MonthlyData[] = useMemo(() => {
    const monthly: { [key: string]: { penerimaan: number; realisasi: number } } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    if (matrixYear !== 'all') {
      monthNames.forEach(m => {
        const key = `${m} ${matrixYear}`;
        monthly[key] = { penerimaan: 0, realisasi: 0 };
      });
    }

    const targetEntries = matrixYear === 'all' 
      ? entries 
      : entries.filter(e => {
          if (!e.date) return false;
          const d = new Date(e.date);
          return !isNaN(d.getTime()) && d.getFullYear() === Number(matrixYear);
        });

    targetEntries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const key = matrixYear === 'all' ? `${monthNames[monthIndex]} ${year}` : `${monthNames[monthIndex]} ${matrixYear}`;
      
      if (!monthly[key]) {
        monthly[key] = { penerimaan: 0, realisasi: 0 };
      }

      const rawCode = e.kodeRekening || '';
      const cleanCode = rawCode.split(' - ')[0].trim();
      const kreditVal = Number(e.kredit) || 0;
      const debetVal = Number(e.debet) || 0;

      // Bila filter per tahun aktif, kecualikan akun SiLPA (6.1.1.01) dari penerimaan bulanan
      // agar tidak terhitung ganda dengan baris khusus "SILPA TAHUN LALU"
      const isSilpaAccount = cleanCode === '6.1.1.01' || cleanCode.startsWith('6.1.1');
      if (matrixYear !== 'all' && isSilpaAccount) {
        return;
      }

      // Penerimaan: Kelompok 4 (Pendapatan), Kelompok 7 (Sumber Dana/Hibah), Kelompok 6 (Pembiayaan)
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
  }, [entries, matrixYear]);

  // Perhitungan Silpa Tahun Lalu dan Saldo Akhir untuk Matriks Rekapitulasi
  const { 
    matrixSilpaTahunLalu, 
    matrixSaldoAkhir, 
    matrixTotalPenerimaan, 
    matrixTotalRealisasi, 
    matrixSurplusDefisit 
  } = useMemo(() => {
    const totalPenerimaan = matrixMonthlyData.reduce((acc, m) => acc + m.penerimaan, 0);
    const totalRealisasi = matrixMonthlyData.reduce((acc, m) => acc + m.realisasi, 0);
    const surplusDefisit = totalPenerimaan - totalRealisasi;

    if (matrixYear === 'all') {
      return {
        matrixSilpaTahunLalu: 0,
        matrixSaldoAkhir: surplusDefisit,
        matrixTotalPenerimaan: totalPenerimaan,
        matrixTotalRealisasi: totalRealisasi,
        matrixSurplusDefisit: surplusDefisit
      };
    }

    const numYear = Number(matrixYear);
    let priorCashBalance = 0;
    let hasPriorEntries = false;

    // 1. Akumulasi saldo kas riil dari Jurnal Umum sebelum tahun matrixYear (Akun 1.1.*)
    entries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() < numYear) {
        const code = (e.kodeRekening || '').trim();
        if (isKasAccount(code) || code.startsWith('1.1')) {
          hasPriorEntries = true;
          priorCashBalance += ((Number(e.debet) || 0) - (Number(e.kredit) || 0));
        }
      }
    });

    // 2. Jika belum ada entri jurnal di tahun sebelumnya, gunakan akumulasi data BKU
    if (!hasPriorEntries && bkuData.length > 0) {
      bkuData.forEach(b => {
        if (!b.tanggal) return;
        const d = new Date(b.tanggal);
        if (isNaN(d.getTime())) return;
        if (d.getFullYear() < numYear) {
          priorCashBalance += ((Number(b.penerimaan) || 0) - (Number(b.pengeluaran) || 0));
        }
      });
    }

    // 3. Periksa juga apakah ada akun SiLPA (6.1.1.01) tercatat di tahun berjalan
    let explicitSilpaInYear = 0;
    entries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() === numYear) {
        const rawCode = (e.kodeRekening || '').trim();
        const cleanCode = rawCode.split(' - ')[0].trim();
        if (cleanCode === '6.1.1.01' || cleanCode.startsWith('6.1.1')) {
          explicitSilpaInYear += (Number(e.kredit) || 0) - (Number(e.debet) || 0);
        }
      }
    });

    const silpaTahunLalu = priorCashBalance !== 0 ? priorCashBalance : explicitSilpaInYear;
    const saldoAkhir = silpaTahunLalu + surplusDefisit;

    return {
      matrixSilpaTahunLalu: silpaTahunLalu,
      matrixSaldoAkhir: saldoAkhir,
      matrixTotalPenerimaan: totalPenerimaan,
      matrixTotalRealisasi: totalRealisasi,
      matrixSurplusDefisit: surplusDefisit
    };
  }, [entries, bkuData, matrixMonthlyData, matrixYear]);

  // Breakdown Pendapatan
  const revenueCategoryData: CategoryData[] = useMemo(() => {
    const categories: { [key: string]: { value: number; count: number; code: string } } = {};
    filteredEntries.forEach(e => {
      const rawCode = e.kodeRekening || '';
      const cleanCode = rawCode.split(' - ')[0].trim();
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

  // Breakdown Belanja
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

  // Breakdown Kas per Akun
  const cashAccountsBreakdown = useMemo(() => {
    const map: Record<string, { code: string; name: string; balance: number }> = {};
    entries.forEach(e => {
      const rawCode = (e.kodeRekening || '').trim();
      const cleanCode = rawCode.split(' - ')[0].trim();
      if (cleanCode.startsWith('1.1')) {
        if (!map[cleanCode]) {
          const acc = REFERENSI_REKENING.find(r => r.code === cleanCode);
          map[cleanCode] = {
            code: cleanCode,
            name: acc ? acc.name : (rawCode.includes(' - ') ? rawCode.split(' - ')[1].trim() : `Kas (${cleanCode})`),
            balance: 0
          };
        }
        map[cleanCode].balance += ((Number(e.debet) || 0) - (Number(e.kredit) || 0));
      }
    });
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [entries]);

  // Financial Health Metrics & Ratios
  const financialRatios = useMemo(() => {
    const activeMonths = monthlyChartData.filter(m => m.penerimaan > 0 || m.realisasi > 0);
    const monthsCount = Math.max(1, activeMonths.length);
    const avgMonthlyExpense = summaryData.totalExpenses / monthsCount;
    const runwayMonths = avgMonthlyExpense > 0 ? (summaryData.balance / avgMonthlyExpense).toFixed(1) : '∞';
    const burnRate = avgMonthlyExpense;
    const savingsRatio = summaryData.totalRevenue > 0 
      ? (((summaryData.totalRevenue - summaryData.totalExpenses) / summaryData.totalRevenue) * 100).toFixed(1)
      : '0.0';
    const debtRatio = summaryData.balance > 0 
      ? ((summaryData.totalHutang / summaryData.balance) * 100).toFixed(1) 
      : (summaryData.totalHutang > 0 ? '100+' : '0.0');

    return {
      runwayMonths,
      burnRate,
      savingsRatio,
      debtRatio,
      monthsCount
    };
  }, [monthlyChartData, summaryData]);

  // Perhitungan Anggaran & Rasio Efisiensi Anggaran Tahun Berjalan
  const budgetSummary = useMemo(() => {
    return calculateBudgetAndRealization(entries, budgetItems, selectedYear);
  }, [entries, budgetItems, selectedYear]);

  // Export Executive Report to PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    const yearLabel = selectedYear === 'all' ? 'Semua_Tahun' : `${selectedYear}`;
    const filename = `Laporan_Ringkasan_Eksekutif_Desa_Adat_${yearLabel}.pdf`;

    try {
      const success = await exportElementToPdf('executive-printable-report', {
        filename,
        orientation: 'portrait',
        format: 'a4',
        margin: [10, 6, 6, 6],
        enableWatermark: true,
        watermarkText: 'Desa Adat Basangalas'
      });

      if (success !== false) {
        showNotification(`Dokumen "${filename}" berhasil diunduh sebagai PDF!`, 'success');
      } else {
        showNotification(`Dialog cetak sistem dibuka untuk dokumen "${filename}".`, 'info');
      }
    } catch (err) {
      console.error('Error exporting Executive Summary PDF:', err);
      showNotification('Gagal mengunduh Laporan Ringkasan Eksekutif PDF. Silakan coba lagi.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 relative" id="executive-printable-report">
      {/* Styles for print output */}
      <style>{`
        @media print {
          @page { size: portrait; margin: 8mm; }
          body * { visibility: hidden; }
          #executive-printable-report, #executive-printable-report * { visibility: visible; }
          #executive-printable-report { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            background: #ffffff !important; 
            color: #000000 !important; 
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header Eksekutif & Action Bar */}
      <div className="border-b-4 border-teal-600 p-3 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
            <div className="absolute -right-0 -bottom-0 opacity-10 text-emerald-500 pointer-events-none">
                <Sparkles size={130} />
            </div>
        </div>

        <div className="relative z-10 lg:flex-row justify-between items-start lg:items-center gap-6 no-print">
          <div className="flex items-start md:items-center gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/20 text-amber-900 border border-amber-500/40 shadow-xs">
                  Laporan Strategis & Analisis
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-emerald-500/20 text-emerald-700 border border-emerald-500/40">
                  Prajuru Desa Adat
                </span>
              </div>
              <div className="flex items-start md:items-center gap-4">
                  <div className="p-3 bg-teal-500/20 rounded-2xl border border-teal-500/30 shrink-0">
                      <Sparkles className="h-9 w-9 text-teal-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight font-serif">
                      Ringkasan Eksekutif Keuangan & Kinerja
                    </h1>
                    <p className="text-xs text-teal-700 font-bold tracking-widest mt-0.5">
                      Ikhtisar Posisi Kas, Kinerja Anggaran &amp; Analisis Kesehatan Finansial Berjalan ({selectedYear === 'all' ? 'Seluruh Tahun Kumulatif' : `Tahun ${selectedYear}`})
                    </p>
                  </div>
              </div>
            </div>
          </div>

          {/* Controls: Filter & Actions */}
          <div className="flex flex-wrap mt-2 items-center gap-2.5 w-full lg:w-auto justify-start sm:justify-end no-print">
            {/* Periode Filter */}
            <div className="flex items-center gap-2 bg-slate-100 text-slate-900 text-xs font-black px-3 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <Filter className="h-4 w-4 text-teal-700 shrink-0" />
              <label className="text-xs font-black font-mono text-slate-700 uppercase tracking-tighter">Periode :</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs sm:text-sm"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Tombol Unduh PDF */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Unduh laporan ringkasan eksekutif ini sebagai PDF"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Mengekspor PDF...</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>Export PDF Eksekutif</span>
                </>
              )}
            </button>

            {/* Tombol Cetak Dokumen */}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Cetak langsung menggunakan printer dokumen"
            >
              <Printer size={15} />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Print-Only Formal Header */}
        <div className="hidden print:block text-slate-900 mt-4 pt-3 border-t-2 border-slate-900 text-center">
          <h2 className="text-xl font-black uppercase tracking-widest font-serif m-0">
            DESA ADAT BASANGALAS
          </h2>
          <h3 className="text-base font-black uppercase tracking-wider font-serif m-0 text-slate-800">
            LAPORAN RINGKASAN EKSEKUTIF KEUANGAN &amp; STATUS KESEHATAN FINANSIAL
          </h3>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 mt-2 px-2 border-t border-dashed border-slate-300 pt-1">
            <span>Periode: <strong>{selectedYear === 'all' ? 'Seluruh Periode Akuntansi' : `Tahun Anggaran ${selectedYear}`}</strong></span>
            <span>Tanggal Cetak: <strong>{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
            <span>Status Kas: <strong>{isReconciled ? 'Terekonsiliasi 100%' : 'Ada Penyesuaian Kas'}</strong></span>
          </div>
        </div>
      </div>

      {/* DEFINISI */}
      <p className="bg-teal-50 p-2 border border-teal-200 rounded-lg shadow-lg text-teal-700 text-xs mt-1.5 w-full font-normal">
        <span><strong>Definisi : </strong></span>
        Sintesis komprehensif bagi Prajuru Adat untuk mengevaluasi indikator kinerja utama (KPI) keuangan desa, membandingkan dinamika pendapatan vs beban, memantau posisi likuiditas kas, tingkat kolektabilitas kredit, rasio solvabilitas, serta proyeksi kebutuhan kas masa depan.
      </p>

      {/* --- GRID 6 KARTU INDIKATOR UTAMA (EXECUTIVE KPI CARDS) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Pendapatan */}
        <div className="bg-emerald-50/70 p-4 rounded-xl border-2 border-emerald-300 hover:border-emerald-500 transition-all shadow-sm flex flex-col justify-between hover:shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpRight size={16} className="text-emerald-700" /> Pendapatan Riil
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 border border-emerald-400 px-2 py-0.5 rounded-full">
                Akun 4.x
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-900 font-mono tracking-tight my-1">
              {formatCurrency(summaryData.totalRevenue)}
            </p>
            <p className="text-[11px] text-emerald-800 leading-tight mt-1">
              Penerimaan Operasional &amp; Punia
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-200 flex items-center justify-between text-[10px] font-mono text-emerald-900 font-semibold">
            <span>Penerimaan Masuk</span>
            <span className="bg-emerald-200/80 px-1.5 py-0.5 rounded">Aktif</span>
          </div>
        </div>

        {/* Card 2: Total Belanja */}
        <div className="bg-rose-50/70 p-4 rounded-xl border-2 border-rose-300 hover:border-rose-500 transition-all shadow-sm flex flex-col justify-between hover:shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownLeft size={16} className="text-rose-700" /> Realisasi Belanja
              </span>
              <span className="text-[10px] font-mono font-bold bg-rose-200 text-rose-950 border border-rose-400 px-2 py-0.5 rounded-full">
                Akun 5.x
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-900 font-mono tracking-tight my-1">
              {formatCurrency(summaryData.totalExpenses)}
            </p>
            <p className="text-[11px] text-rose-800 leading-tight mt-1">
              Realisasi Rutin &amp; Program Adat
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-rose-200 flex items-center justify-between text-[10px] font-mono text-rose-900 font-semibold">
            <span>Beban Operasional</span>
            <span className="bg-rose-200/80 px-1.5 py-0.5 rounded">Keluar</span>
          </div>
        </div>

        {/* Card 3: Rasio Efisiensi Anggaran */}
        <BudgetEfficiencyCard
          totalExpenseRealization={budgetSummary.totalExpenseRealization}
          totalExpenseBudget={budgetSummary.totalExpenseBudget}
          selectedYear={selectedYear}
          setActivePage={setActivePage}
        />

        {/* Card 4: Surplus / Defisit Bersih */}
        <div className={`p-4 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between ${
          summaryData.netSurplusDeficit >= 0 
            ? 'bg-teal-50/80 border-teal-300 hover:border-teal-500 hover:shadow-lg' 
            : 'bg-amber-50/80 border-amber-300 hover:border-amber-500 hover:shadow-lg'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                summaryData.netSurplusDeficit >= 0 ? 'text-teal-900' : 'text-amber-900'
              }`}>
                <Scale size={16} className={summaryData.netSurplusDeficit >= 0 ? 'text-teal-700' : 'text-amber-700'} />
                Surplus / Defisit
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                summaryData.netSurplusDeficit >= 0 
                  ? 'bg-teal-200 text-teal-950 border-teal-400' 
                  : 'bg-amber-200 text-amber-950 border-amber-400'
              }`}>
                {summaryData.netSurplusDeficit >= 0 ? 'SURPLUS' : 'DEFISIT'}
              </span>
            </div>
            <p className={`text-xl sm:text-2xl font-black font-mono tracking-tight my-1 ${
              summaryData.netSurplusDeficit >= 0 ? 'text-teal-900' : 'text-amber-950'
            }`}>
              {formatCurrency(summaryData.netSurplusDeficit)}
            </p>
            <p className="text-[11px] text-slate-700 leading-tight mt-1">
              Selisih Bersih Pendapatan vs Belanja
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-800 font-semibold">
            <span>Rasio Tabungan</span>
            <span className="font-bold">{financialRatios.savingsRatio}%</span>
          </div>
        </div>

        {/* Card 5: Saldo Kas & Bank Riil */}
        <div className="bg-sky-50/80 p-4 rounded-xl border-2 border-sky-300 hover:border-sky-500 transition-all shadow-sm flex flex-col justify-between hover:shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark size={16} className="text-sky-700" /> Saldo Kas Riil
              </span>
              <span className="text-[10px] font-mono font-bold bg-sky-200 text-sky-950 border border-sky-400 px-2 py-0.5 rounded-full">
                Akun 1.1.x
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-sky-900 font-mono tracking-tight my-1">
              {formatCurrency(summaryData.balance)}
            </p>
            <p className="text-[11px] text-sky-800 leading-tight mt-1">
              Kas Desa Adat, Juru Raksa &amp; Khusus
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-sky-200 flex items-center justify-between text-[10px] font-mono text-sky-900 font-semibold">
            <span>Runway Kas</span>
            <span className="bg-sky-200/80 px-1.5 py-0.5 rounded font-bold">{financialRatios.runwayMonths} Bln</span>
          </div>
        </div>

        {/* Card 6: Total Hutang & Kewajiban */}
        <div className={`p-4 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between ${
          summaryData.totalHutang > 0 
            ? 'bg-purple-50/80 border-purple-300 hover:border-purple-500 hover:shadow-lg' 
            : 'bg-slate-50 border-slate-300 hover:border-slate-400 hover:shadow-lg'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                summaryData.totalHutang > 0 ? 'text-purple-900' : 'text-slate-800'
              }`}>
                <Receipt size={16} className={summaryData.totalHutang > 0 ? 'text-purple-700' : 'text-slate-600'} /> Kewajiban Belanja
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                summaryData.totalHutang > 0 
                  ? 'bg-purple-200 text-purple-950 border-purple-400' 
                  : 'bg-slate-200 text-slate-800 border-slate-300'
              }`}>
                Akun 2.x
              </span>
            </div>
            <p className={`text-xl sm:text-2xl font-black font-mono tracking-tight my-1 ${
              summaryData.totalHutang > 0 ? 'text-purple-900' : 'text-slate-900'
            }`}>
              {formatCurrency(summaryData.totalHutang)}
            </p>
            <p className="text-[11px] text-slate-700 leading-tight mt-1">
              {summaryData.totalHutang > 0 ? 'Kewajiban yang Belum Dilunasi' : 'Bebas Kewajiban (Lunas Sempurna)'}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono font-semibold">
            <span className="text-slate-600">Status Beban</span>
            <span className={`px-1.5 py-0.5 rounded ${
              summaryData.totalHutang > 0 ? 'bg-purple-200 text-purple-950 font-bold' : 'bg-emerald-200 text-emerald-950'
            }`}>
              {summaryData.totalHutang > 0 ? 'Tertunda' : 'Nihil'}
            </span>
          </div>
        </div>
      </div>

      {/* Banner Rekonsiliasi Kas (BKU vs Jurnal Umum) */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isReconciled ? (
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div className="text-xs">
            <span className="font-bold text-slate-900">Integritas &amp; Rekonsiliasi Kas (Buku Kas Umum vs Akun Kas Jurnal): </span>
            {isReconciled ? (
              <span className="text-emerald-700 font-semibold">Terekonsiliasi Sempurna (100% Cocok — Selisih Rp 0)</span>
            ) : (
              <span className="text-amber-700 font-semibold">Terdapat Penyesuaian Kas Sebesar {formatCurrency(reconciliationDelta)} (BKU: {formatCurrency(bkuSummary.cumulativeBalance)} vs Jurnal: {formatCurrency(summaryData.balance)})</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 shrink-0">
          <span>Kas Riil (BKU):</span>
          <span className="text-teal-800">{formatCurrency(selectedYear === 'all' ? bkuSummary.cumulativeBalance : bkuSummary.periodBalance)}</span>
        </div>
      </div>

      {/* --- MODUL ANALISIS EKSEKUTIF CERDAS DENGAN GEMINI AI --- */}
      <div className="no-print">
      <ExecutiveSummaryAi
        entries={filteredEntries}
        bkuData={filteredBkuData}
        monthlyChartData={monthlyChartData}
        summaryData={summaryData}
        budgetItems={budgetItems}
        selectedYear={selectedYear}
      />
      </div>

      {/* --- CHATBOT AI KEUANGAN DESA ADAT BASANGALAS --- */}
      <div className="no-print">
      <FinancialChatbotAi
        entries={entries}
        bkuData={bkuData}
        budgetItems={budgetItems}
        monthlyChartData={monthlyChartData}
        selectedYear={selectedYear}
        availableYears={availableYears}
        bkuBalance={selectedYear === 'all' ? bkuSummary.cumulativeBalance : bkuSummary.periodBalance}
        totalHutang={summaryData.totalHutang}
      />
      </div>
      
      {/* --- SKOR KESEHATAN KEUANGAN TREN BULANAN --- */}
      <div className="print:mt-4">
      <FinancialHealthScoreChart 
        entries={entries}
        bkuData={bkuData}
        budgetItems={budgetItems}
        selectedYear={selectedYear}
        availableYears={availableYears}
      />
      </div>

      {/* --- RINCIAN SALDO KAS & BANK RIIL PER AKUN (1.1.x) --- */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-lg print:mb-4">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-300">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 rounded-lg text-sky-800">
              <Landmark size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Posisi Likuiditas Kas &amp; Bank Riil (Kelompok Akun 1.1)
              </h4>
              <p className="text-[11px] text-slate-600">
                Rincian saldo aktif pada masing-masing buku kas per tanggal berjalan
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-sky-100 text-sky-950 px-3 py-1 rounded-full border border-sky-300">
            Total: {formatCurrency(summaryData.balance)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cashAccountsBreakdown.map(item => (
            <div 
              key={item.code} 
              className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/70 hover:bg-white hover:border-teal-400 transition-all"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-800 truncate font-luxury" title={item.name}>{item.name}</span>
                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{item.code}</span>
              </div>
              <p className="text-lg font-black font-mono text-slate-900">
                {formatCurrency(item.balance)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* --- TABEL REKAPITULASI EKSEKUTIF BULANAN --- */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-300 shadow-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-300">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
              <FileText size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Matriks Rekapitulasi Realisasi Finansial Bulanan
              </h4>
              <p className="text-[11px] text-slate-600">
                Komparasi penerimaan kas, realisasi beban belanja, dan surplus/defisit berjalan per bulan
              </p>
            </div>
          </div>

          {/* Filter Tahun & Cetak Matriks */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto no-print">
            <div className="flex items-center gap-2 bg-slate-100 text-slate-900 text-xs font-black px-3 py-1 rounded-xl border border-slate-300 shadow-2xs">
              <Filter className="h-3.5 w-3.5 text-teal-700 shrink-0" />
              <label htmlFor="matrix-year-select" className="text-[11px] font-black font-mono text-slate-700 uppercase tracking-tighter">
                Tahun:
              </label>
              <select
                id="matrix-year-select"
                value={matrixYear}
                onChange={(e) => setMatrixYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs sm:text-sm"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Status Otomatisasi Tanda Tangan & Stempel */}
            <div 
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100/90 border border-slate-300 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs"
              title="Status Otomatisasi Tanda Tangan & Stempel Matriks Finansial (Sesuai Pengaturan Sistem)"
            >
              <ShieldCheck size={13} className="text-teal-600" />
              <span className={signatureSettings.autoEmbed !== false ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                TTD: {signatureSettings.autoEmbed !== false ? 'ON' : 'OFF'}
              </span>
              <span className="text-slate-300">•</span>
              <span className={signatureSettings.showStampOverlay !== false ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                Stempel: {signatureSettings.showStampOverlay !== false ? 'ON' : 'OFF'}
              </span>
            </div>

            {setActivePage && (
              <button
                type="button"
                onClick={() => setActivePage('Matriks Bulanan')}
                className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Buka halaman penuh Matriks Bulanan dengan fitur Penjilidan & Signature Otomatis"
              >
                <Calendar size={14} />
                <span className="hidden sm:inline">Matriks Penuh</span>
              </button>
            )}

            <span className="text-xs font-bold text-slate-600 font-mono hidden sm:inline-block">
              {matrixMonthlyData.length} {matrixYear === 'all' ? 'Periode' : 'Bulan'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-black uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Bulan</th>
                <th className="py-2.5 px-3 text-right">Penerimaan (Rp)</th>
                <th className="py-2.5 px-3 text-right">Realisasi Belanja (Rp)</th>
                <th className="py-2.5 px-3 text-right">Surplus / Defisit (Rp)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matrixMonthlyData.map((m, idx) => {
                const diff = m.penerimaan - m.realisasi;
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-800 font-mono">{m.name}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-800 font-semibold">{formatCurrency(m.penerimaan)}</td>
                    <td className="py-2 px-3 text-right font-mono text-rose-800 font-semibold">{formatCurrency(m.realisasi)}</td>
                    <td className={`py-2 px-3 text-right font-mono font-black ${diff >= 0 ? 'text-teal-800' : 'text-amber-800'}`}>
                      {formatCurrency(diff)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        diff >= 0 ? 'bg-teal-100 text-teal-900' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {diff >= 0 ? 'Surplus' : 'Defisit'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {/* Baris Total Kumulatif */}
              <tr className="bg-slate-200 border-t-2 border-slate-400 font-black text-slate-900 font-mono text-xs">
                <td className="py-2.5 px-3">
                  {matrixYear === 'all' ? 'TOTAL KOMULATIF' : `TOTAL KOMULATIF (TA ${matrixYear})`}
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-950 font-black">
                  {formatCurrency(matrixTotalPenerimaan)}
                </td>
                <td className="py-2.5 px-3 text-right text-rose-950 font-black">
                  {formatCurrency(matrixTotalRealisasi)}
                </td>
                <td className={`py-2.5 px-3 text-right font-black ${matrixSurplusDefisit >= 0 ? 'text-teal-950' : 'text-rose-950'}`}>
                  {formatCurrency(matrixSurplusDefisit)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    matrixSurplusDefisit >= 0 ? 'bg-teal-100 text-teal-900' : 'bg-rose-100 text-rose-900'
                  }`}>
                    {matrixSurplusDefisit >= 0 ? 'Surplus' : 'Defisit'}
                  </span>
                </td>
              </tr>

              {/* Baris SILPA Tahun Lalu & Saldo Akhir: Hanya ditampilkan jika filter tahun terisi (bukan 'all') */}
              {matrixYear !== 'all' && (
                <>
                  {/* Baris SILPA Tahun Lalu */}
                  <tr className="bg-amber-50/90 border-t border-amber-300 font-mono text-xs">
                    <td className="py-2.5 px-3 font-black text-amber-950">
                      SILPA TAHUN LALU :
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-semibold">
                      -
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-semibold">
                      -
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-amber-950">
                      {formatCurrency(matrixSilpaTahunLalu)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-400 text-[10px] font-black">
                        SiLPA Lalu
                      </span>
                    </td>
                  </tr>

                  {/* Baris Saldo Akhir */}
                  <tr className="bg-teal-100/90 border-t-2 border-teal-500 font-black text-slate-900 font-mono text-xs">
                    <td className="py-2.5 px-3 font-black text-teal-950">
                      SALDO AKHIR :
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-semibold">
                      -
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 font-semibold">
                      -
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-teal-950 text-sm">
                      {formatCurrency(matrixSaldoAkhir)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-teal-700 text-white text-[10px] font-black uppercase tracking-wider">
                        Saldo Akhir
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* --- ANALISIS PERTUMBUHAN FINANSIAL TAHUNAN (YOY FINANCIAL ANALYTICS) --- */}
      <div className="print:mt-4">
      <YoyFinancialAnalytics
        entries={entries}
        bkuData={bkuData}
        budgetItems={budgetItems}
        availableYears={availableYears}
        selectedYear={selectedYear}
        setActivePage={setActivePage}
      />
      </div>

      {/* --- RINGKASAN HUTANG & KEWAJIBAN BELANJA --- */}
      <div className="print:mt-4 print:p-4">
      <DebtSummaryCard 
        entries={entries}
        selectedYear={selectedYear}
        setActivePage={setActivePage}
      />
      </div>

        {/* --- BAGIAN 2: NET OPERASIONAL DARI OPSI 1 DAN OPSI 2 DARI NERACA (HANYA DITAMPILKAN JIKA ADA HUTANG) --- */}
        {summaryData.totalHutang > 0 && (
          <div className="mb-5">
            {/* Toggle Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/70 border border-purple-400 rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 border border-purple-300 rounded-lg text-purple-800 shrink-0">
                  <Calculator size={18} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-purple-950 uppercase tracking-wide">
                      Net Operasional Berdasarkan Opsi Neraca
                    </h4>
                    <span className="text-[12px] font-mono font-bold bg-purple-200/80 text-slate-900 border border-purple-300 px-2 py-0.5 rounded-full">
                      Hutang: {formatCurrency(summaryData.totalHutang)}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    Simulasi 2 skenario pelunasan kewajiban: Pemulihan Utuh Pendapatan (Opsi 1) vs Kombinasi Kas Pendapatan (Opsi 2)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowOpsiNeraca(prev => !prev)}
                  className="no-print flex items-center gap-1.5 text-xs font-bold text-purple-900 bg-white hover:bg-purple-100 border border-purple-300 hover:border-purple-400 py-1.5 px-3.5 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer"
                  title={showOpsiNeraca ? "Sembunyikan rincian opsi neraca" : "Tampilkan rincian opsi neraca"}
                >
                  {showOpsiNeraca ? (
                    <>
                      <EyeOff size={14} className="text-purple-700" />
                      <span>Sembunyikan Opsi</span>
                      <ChevronUp size={14} className="text-purple-700" />
                    </>
                  ) : (
                    <>
                      <Eye size={14} className="text-purple-700" />
                      <span>Tampilkan Opsi</span>
                      <ChevronDown size={14} className="text-purple-700" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Content Expandable */}
            {showOpsiNeraca && (
              <div className="bg-slate-50/90 rounded-2xl border border-slate-400 p-5 mt-3 shadow-xs animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-400">
                  <div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Rincian Komparasi Skenario Neraca
                    </h5>
                    <p className="text-[11px] text-slate-800">
                      Perhitungan real-time sinkron dengan laporan neraca berjalan
                    </p>
                  </div>

                  {setActivePage && (
                    <button
                      type="button"
                      onClick={() => setActivePage('Neraca')}
                      className="no-print flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 py-1.5 px-3 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                    >
                      <span>Buka Rincian Neraca</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* OPSI 1: PEMULIHAN UTUH PENDAPATAN */}
                  <div className="bg-white p-4 rounded-xl border-2 border-teal-500/40 shadow-xs hover:border-teal-500 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                          <span className="text-xs font-black text-teal-950 uppercase tracking-wide">
                            Opsi 1: Pemulihan Utuh Pendapatan
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md">
                          Sumber Dana Pokok
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 mb-3 leading-relaxed">
                        Seluruh hutang dilunasi penuh dan seluruh pendapatan <strong>dipulihkan utuh 100%</strong> menggunakan Sumber Dana Pokok.
                      </p>

                      {/* Main Metric Opsi 1 */}
                      <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200 mb-3">
                        <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                          Net Operasional Opsi 1 (Surplus / Defisit Murni):
                        </span>
                        <div className="flex items-baseline justify-between gap-2 mt-1">
                          <p className={`text-2xl font-black font-mono tracking-tight ${
                            summaryData.opsi1NetOperasional >= 0 ? 'text-teal-800' : 'text-rose-700'
                          }`}>
                            {formatCurrency(summaryData.opsi1NetOperasional)}
                          </p>
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                            summaryData.opsi1NetOperasional >= 0 
                              ? 'bg-teal-100 text-teal-900 border-teal-300' 
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}>
                            {summaryData.opsi1NetOperasional >= 0 ? 'SURPLUS BERSIH' : 'DEFISIT BERSIH'}
                          </span>
                        </div>
                      </div>

                      {/* Step Breakdown Opsi 1 */}
                      <div className="space-y-1.5 text-xs text-slate-700 font-mono bg-slate-50 p-3 rounded-lg border border-slate-400">
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-600">Total Pendapatan (Utuh):</span>
                          <span className="font-bold text-emerald-700">+{formatCurrency(summaryData.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-600">Total Belanja Operasional:</span>
                          <span className="font-bold text-rose-900">-{formatCurrency(summaryData.totalExpenses)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-t border-slate-400 pt-1">
                          <span className="text-slate-600">Beban Hutang Dilunasi:</span>
                          <span className="font-bold text-purple-700">{formatCurrency(summaryData.totalHutang)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-600">Mutasi Kas Terpakai:</span>
                          <span className="font-bold text-slate-800">{formatCurrency(summaryData.pendapatanTerpakai)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-teal-400 flex items-center justify-between text-xs bg-teal-100/50 p-2.5 rounded-lg">
                      <span className="text-[11px] font-bold text-teal-950">Kebutuhan Sumber Dana:</span>
                      <span className="font-mono font-black text-teal-900 text-sm">
                        {formatCurrency(summaryData.opsi1KebutuhanSumberDana)}
                      </span>
                    </div>
                  </div>

                  {/* OPSI 2: PELUNASAN VIA PENDAPATAN + SUMBER DANA */}
                  <div className="bg-white p-4 rounded-xl border-2 border-indigo-500/40 shadow-xs hover:border-indigo-500 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                            Opsi 2: Pelunasan via Kas Pendapatan
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md">
                          Pendapatan + Sumber Dana
                        </span>
                      </div>

                      <p className="text-xs text-slate-800 mb-3 leading-relaxed">
                        Hutang diselesaikan terlebih dahulu memanfaatkan hasil pendapatan yang tersedia, lalu sisa kekurangannya dipenuhi dari Estimasi Sumber Dana.
                      </p>

                      {/* Main Metric Opsi 2 */}
                      <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 mb-3">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                          Net Operasional Opsi 2 (Sisa Bersih setelah Alokasi Hutang):
                        </span>
                        <div className="flex items-baseline justify-between gap-2 mt-1">
                          <p className={`text-2xl font-black font-mono tracking-tight ${
                            summaryData.opsi2NetOperasional >= 0 ? 'text-indigo-900' : 'text-rose-700'
                          }`}>
                            {formatCurrency(summaryData.opsi2NetOperasional)}
                          </p>
                          <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                            summaryData.opsi2NetOperasional >= 0 
                              ? 'bg-indigo-100 text-indigo-900 border-indigo-300' 
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}>
                            {summaryData.opsi2NetOperasional >= 0 ? 'SURPLUS NETTO' : 'DEFISIT NETTO'}
                          </span>
                        </div>
                      </div>

                      {/* Step Breakdown Opsi 2 */}
                      <div className="space-y-1.5 text-xs text-slate-700 font-mono bg-slate-50 p-3 rounded-lg border border-slate-400">
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-600">Total Hutang yang Dilunasi:</span>
                          <span className="font-bold text-purple-900">{formatCurrency(summaryData.totalHutang)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-600">Alokasi dari Kas Pendapatan:</span>
                          <span className="font-bold text-rose-900">-{formatCurrency(summaryData.opsi2AlokasiPendapatan)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-t border-slate-400 pt-1">
                          <span className="text-slate-600">Sisa Kas Pendapatan Bersih:</span>
                          <span className="font-bold text-emerald-900">{formatCurrency(summaryData.opsi2SisaPendapatan)}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-600">Total Belanja Operasional:</span>
                          <span className="font-bold text-rose-900">-{formatCurrency(summaryData.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-indigo-400 flex items-center justify-between text-xs bg-indigo-100/50 p-2.5 rounded-lg">
                      <span className="text-[11px] font-bold text-indigo-950">Estimasi Tambahan Sumber Dana:</span>
                      <span className="font-mono font-black text-indigo-900 text-sm">
                        {formatCurrency(summaryData.opsi2EstimasiSumberDana)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {/* --- VISUALISASI TREN REALISASI PENDAPATAN & BELANJA TAHUNAN (3 TAHUN TERAKHIR) --- */}
      <div className="print:mt-4">
      <AnnualTrendBarChart
        entries={entries}
        bkuData={bkuData}
        budgetItems={budgetItems}
        availableYears={availableYears}
        selectedYear={selectedYear}
      />
      </div>

      <div className="print:mt-4">
      {/* --- PROYEKSI ANGGARAN MENDATANG & REKOMENDASI ALOKASI DANA (GEMINI AI FORECAST) --- */}
      <BudgetProjectionAi
        entries={entries}
        bkuData={bkuData}
        budgetItems={budgetItems}
        availableYears={availableYears}
        selectedYear={selectedYear}
        setActivePage={setActivePage}
      />
      </div>


      {/* --- TANDA TANGAN DOKUMEN RESMI DESA ADAT BASANGALAS --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-lg signature-section">
        <div className="text-center mb-6 border-b pb-3 border-slate-200">
          <p className="text-xs font-serif font-black uppercase tracking-widest text-slate-900">
            PRAJURU DESA ADAT BASANGALAS
          </p>
          <p className="text-[11px] text-slate-600">
            Dokumen Laporan Eksekutif ini disahkan dan ditandatangani secara resmi untuk pertanggungjawaban tata kelola keuangan adat.
          </p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-3 gap-6 text-center">
          {/* Bendesa Adat / Keliang */}
          <div className="signature-box flex flex-col items-center justify-between h-44 p-2 border border-slate-200 rounded-xl bg-slate-50/50 relative">
            <div>
              <p className="text-xs font-bold text-slate-800">Mengetahui &amp; Menyetujui,</p>
              <p className="text-[11px] font-semibold text-slate-600 uppercase">Keliang Adat Basangalas</p>
            </div>
            
            <div className="relative flex items-center justify-center my-1 h-20 w-36">
              {signatureSettings.autoEmbed !== false && signatures?.keliang ? (
                <img 
                  src={signatures.keliang} 
                  alt="TTD Bendesa Adat" 
                  className="signature-img max-h-16 max-w-full object-contain relative z-10"
                />
              ) : (
                <div className="text-[11px] text-slate-400 italic">( Tanda Tangan )</div>
              )}
              {signatureSettings.showStampOverlay !== false && (
                <img 
                  src={getEffectiveStamp(signatures, 'DESA ADAT BASANGALAS')} 
                  alt="Stempel Desa Adat" 
                  className="stamp-overlay absolute top-50 -left-16 w-55 h-50 object-contain opacity-85 pointer-events-none mix-blend-multiply z-20" 
                />
              )}
            </div>

            <div>
              <p className="text-xs font-black text-slate-900 underline signature-name">
                I Made Mudita
              </p>
              <p className="text-[10px] text-slate-500">Keliang Adat</p>
            </div>
          </div>

          {/* Petengen / Bendahara */}
          <div className="signature-box flex flex-col items-center justify-between h-44 p-2 border border-slate-200 rounded-xl bg-slate-50/50 relative">
            <div>
              <p className="text-xs font-bold text-slate-800">Dicatat &amp; Disusun Oleh,</p>
              <p className="text-[11px] font-semibold text-slate-600 uppercase">Petengen / Juru Raksa Adat</p>
            </div>
            
            <div className="relative flex items-center justify-center my-1 h-20 w-36">
              {signatureSettings.autoEmbed !== false && signatures?.juruRaksa ? (
                <img 
                  src={signatures.juruRaksa} 
                  alt="TTD Petengen" 
                  className="signature-img max-h-16 max-w-full object-contain"
                />
              ) : (
                <div className="text-[11px] text-slate-400 italic">( Tanda Tangan )</div>
              )}
            </div>

            <div>
              <p className="text-xs font-black text-slate-900 underline signature-name">
                I Putu Gede Sutrana
              </p>
              <p className="text-[10px] text-slate-500">Petengen Desa Adat</p>
            </div>
          </div>

          {/* Penyarikan / Sekretaris */}
          <div className="signature-box flex flex-col items-center justify-between h-44 p-2 border border-slate-200 rounded-xl bg-slate-50/50 relative">
            <div>
              <p className="text-xs font-bold text-slate-800">Diverifikasi Oleh,</p>
              <p className="text-[11px] font-semibold text-slate-600 uppercase">Penyarikan / Sekretaris Adat</p>
            </div>
            
            <div className="relative flex items-center justify-center my-1 h-20 w-36">
              {signatureSettings.autoEmbed !== false && signatures?.pembuat ? (
                <img 
                  src={signatures.pembuat} 
                  alt="TTD Penyarikan" 
                  className="signature-img max-h-16 max-w-full object-contain"
                />
              ) : (
                <div className="text-[11px] text-slate-400 italic">( Tanda Tangan )</div>
              )}
            </div>

            <div>
              <p className="text-xs font-black text-slate-900 underline signature-name">

              </p>
              <p className="text-[10px] text-slate-500">Penyarikan Desa Adat</p>
            </div>
          </div>
        </div>
      </div>
       
       <div className="my-4 flex items-center justify-center gap-3 no-print">
            {/* Tombol Cetak Dokumen */}
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Cetak langsung menggunakan printer dokumen"
            >
              <Printer size={15} />
              <span>Cetak Laporan</span>
            </button>
        </div>

      {/* Catatan Dokumen Resmi */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-3 no-print">
        <Info className="text-teal-700 shrink-0 mt-0.5" size={18} />
        <p className="text-xs text-teal-900 leading-relaxed">
          Seluruh kalkulasi dan indikator pada <strong>Ringkasan Eksekutif</strong> ini terintegrasi langsung dengan <strong>Buku Jurnal Umum</strong> dan <strong>Buku Kas Umum (BKU)</strong> Desa Adat Basangalas secara real-time. Anda dapat mengekspor ringkasan ini menjadi file PDF formal atau mencetaknya untuk keperluan rapat Paruman Desa Adat.
        </p>
      </div>
    </div>
  );
};

export default RingkasanEksekutif;
