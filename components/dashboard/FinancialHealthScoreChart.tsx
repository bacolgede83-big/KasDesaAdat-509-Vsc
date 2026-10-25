import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine} from 'recharts';
import {
  HeartPulse,
  Activity,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Calendar,
  Filter,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet
} from 'lucide-react';
import type { JuDisplayRow, BkuData, BudgetItem } from '../../types';
import { formatCurrency } from '../../utils/formatter';

export interface MonthlyHealthScoreData {
  monthIndex: number;
  monthName: string;
  year: number;
  label: string;
  penerimaan: number;
  realisasi: number;
  netMonthly: number;
  saldoKas: number;
  hutang: number;
  skorKesehatan: number; // 0 - 100
  status: 'Sangat Sehat' | 'Sehat' | 'Cukup Sehat' | 'Kurang Sehat';
  deltaFromPrevMonth: number;
  // 4 Pilar Skor
  likuiditasScore: number;   // max 30
  operasionalScore: number;  // max 25
  solvabilitasScore: number; // max 25
  efisiensiScore: number;    // max 20
  catatanKesehatan: string;
  hasData: boolean;
}

interface FinancialHealthScoreChartProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  budgetItems?: BudgetItem[];
  selectedYear: number | 'all';
  availableYears?: number[];
  onYearChange?: (year: number) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const FinancialHealthScoreChart: React.FC<FinancialHealthScoreChartProps> = ({
  entries,
  bkuData = [],
  budgetItems = [],
  selectedYear,
  availableYears,
  onYearChange
}) => {
  const [activeTab, setActiveTab] = useState<'trend' | 'pillars' | 'table'>('trend');
  const [showFullYear, setShowFullYear] = useState<boolean>(false);
  const [showMetricDetails, setShowMetricDetails] = useState<boolean>(false);

  // List seluruh tahun yang tersedia dari data Jurnal, BKU, & Anggaran
  const calculatedAvailableYears = useMemo(() => {
    if (availableYears && availableYears.length > 0) return availableYears;
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
    if (budgetItems) {
      budgetItems.forEach(b => {
        if (b.tahun && !isNaN(Number(b.tahun))) {
          years.add(Number(b.tahun));
        }
      });
    }
    const arr = Array.from(years).sort((a, b) => b - a);
    return arr.length > 0 ? arr : [new Date().getFullYear()];
  }, [availableYears, entries, bkuData, budgetItems]);

  // State tahun target yang dapat difilter secara independen
  const [internalYear, setInternalYear] = useState<number>(() => {
    if (typeof selectedYear === 'number') return selectedYear;
    let maxYear = new Date().getFullYear();
    entries.forEach(e => {
      if (e.date) {
        const d = new Date(e.date);
        if (!isNaN(d.getTime()) && d.getFullYear() > maxYear) {
          maxYear = d.getFullYear();
        }
      }
    });
    return maxYear;
  });

  // Sinkronisasi tahun jika prop selectedYear berubah menjadi angka spesifik
  useEffect(() => {
    if (typeof selectedYear === 'number') {
      setInternalYear(selectedYear);
    }
  }, [selectedYear]);

  const targetYear = internalYear;

  // Kalkulasi data skor per bulan dari awal bulan (Januari) sampai bulan terakhir berjalan
  const { monthlyScorecards, latestMonthIndex, summaryMetrics } = useMemo(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeBku = Array.isArray(bkuData) ? bkuData : [];

    // Deteksi bulan terakhir yang memiliki transaksi di tahun berjalan
    let detectedLatestMonth = 0; // minimal Januari
    const currentCalYear = new Date().getFullYear();
    const currentCalMonth = new Date().getMonth();

    if (targetYear === currentCalYear) {
      detectedLatestMonth = currentCalMonth;
    } else if (targetYear < currentCalYear) {
      // Untuk tahun buku sebelumnya yang sudah selesai, tampilkan hingga Desember (11)
      detectedLatestMonth = 11;
    }

    safeEntries.forEach(e => {
      if (e.date) {
        const d = new Date(e.date);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear) {
          const m = d.getMonth();
          if (m > detectedLatestMonth) detectedLatestMonth = m;
        }
      }
    });

    safeBku.forEach(b => {
      if (b.tanggal) {
        const d = new Date(b.tanggal);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear) {
          const m = d.getMonth();
          if (m > detectedLatestMonth) detectedLatestMonth = m;
        }
      }
    });

    // Batasi index bulan terakhir (0 - 11)
    detectedLatestMonth = Math.min(11, Math.max(0, detectedLatestMonth));

    // Array hasil perhitungan 12 bulan
    const rawMonthly: Array<{
      monthIndex: number;
      penerimaan: number;
      realisasi: number;
      saldoKas: number;
      hutang: number;
      hasData: boolean;
    }> = [];

    // Inisialisasi tiap bulan
    for (let m = 0; m < 12; m++) {
      rawMonthly.push({
        monthIndex: m,
        penerimaan: 0,
        realisasi: 0,
        saldoKas: 0,
        hutang: 0,
        hasData: false
      });
    }

    // Hitung Penerimaan (4.*, 7.*, 6.*), Belanja (5.*) per bulan
    safeEntries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== targetYear) return;

      const m = d.getMonth();
      const rawCode = (e.kodeRekening || '').trim();
      const cleanCode = rawCode.split(' - ')[0].trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;

      // Pendapatan & Sumber Dana (Penerimaan)
      if (cleanCode.startsWith('4') || cleanCode.startsWith('7') || cleanCode.startsWith('6')) {
        rawMonthly[m].penerimaan += (kreditVal - debetVal);
        rawMonthly[m].hasData = true;
      }

      // Belanja (Pengeluaran)
      if (cleanCode.startsWith('5')) {
        rawMonthly[m].realisasi += (debetVal - kreditVal);
        rawMonthly[m].hasData = true;
      }
    });

    // Hitung Saldo Kas Kumulatif (1.1.*) dan Saldo Hutang Kumulatif (2.*) sampai akhir tiap bulan m
    // Urutkan transaksi berdasarkan tanggal
    for (let m = 0; m < 12; m++) {
      let cumulativeCash = 0;
      let cumulativeDebt = 0;

      // Hitung kumulatif kas dari seluruh histori hingga akhir bulan m tahun target
      safeEntries.forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date);
        if (isNaN(d.getTime())) return;
        
        // Cek apakah tanggal transaksi <= akhir bulan m tahun target
        const entryYear = d.getFullYear();
        const entryMonth = d.getMonth();

        const isBeforeOrInMonth = entryYear < targetYear || (entryYear === targetYear && entryMonth <= m);
        if (!isBeforeOrInMonth) return;

        const rawCode = (e.kodeRekening || '').trim();
        const cleanCode = rawCode.split(' - ')[0].trim();
        const debetVal = Number(e.debet) || 0;
        const kreditVal = Number(e.kredit) || 0;

        // Akun Kas & Bank 1.1.*
        if (cleanCode.startsWith('1.1')) {
          cumulativeCash += (debetVal - kreditVal);
        }

        // Akun Kewajiban/Hutang 2.*
        if (cleanCode.startsWith('2')) {
          cumulativeDebt += (kreditVal - debetVal);
        }
      });

      // Jika tidak ada data dari Jurnal Kas, coba sinkronisasi dari BKU
      if (cumulativeCash === 0 && safeBku.length > 0) {
        let bkuBal = 0;
        safeBku.forEach(b => {
          if (!b.tanggal) return;
          const d = new Date(b.tanggal);
          if (isNaN(d.getTime())) return;
          const entryYear = d.getFullYear();
          const entryMonth = d.getMonth();
          if (entryYear < targetYear || (entryYear === targetYear && entryMonth <= m)) {
            bkuBal += (Number(b.penerimaan) || 0) - (Number(b.pengeluaran) || 0);
          }
        });
        cumulativeCash = bkuBal;
      }

      rawMonthly[m].saldoKas = cumulativeCash;
      rawMonthly[m].hutang = Math.max(0, cumulativeDebt);
    }

    // Kalkulasi Skor Kesehatan 4 Pilar untuk tiap bulan
    const scorecards: MonthlyHealthScoreData[] = [];
    let previousMonthScore = 80;

    for (let m = 0; m < 12; m++) {
      const monthData = rawMonthly[m];
      const penerimaan = Math.max(0, monthData.penerimaan);
      const realisasi = Math.max(0, monthData.realisasi);
      const netMonthly = penerimaan - realisasi;
      const saldoKas = monthData.saldoKas;
      const hutang = monthData.hutang;

      // --- PILAR 1: LIKUIDITAS & KETAHANAN KAS (Bobot Maks: 30 Poin) ---
      let likuiditasScore = 20;
      if (saldoKas <= 0) {
        likuiditasScore = 0;
      } else {
        const bebanRujukan = realisasi > 0 ? realisasi : 10_000_000;
        const ratioKas = saldoKas / bebanRujukan;
        if (ratioKas >= 3.0) likuiditasScore = 30;
        else if (ratioKas >= 2.0) likuiditasScore = 27;
        else if (ratioKas >= 1.0) likuiditasScore = 23;
        else if (ratioKas >= 0.5) likuiditasScore = 16;
        else likuiditasScore = 8;
      }

      // --- PILAR 2: KESEIMBANGAN OPERASIONAL / SURPLUS-DEFISIT (Bobot Maks: 25 Poin) ---
      let operasionalScore = 18;
      if (penerimaan === 0 && realisasi === 0) {
        operasionalScore = 20; // Impas / Belum ada aktivitas
      } else if (penerimaan >= realisasi) {
        if (realisasi === 0) {
          operasionalScore = 25;
        } else {
          const ratioSurplus = penerimaan / realisasi;
          if (ratioSurplus >= 1.3) operasionalScore = 25;
          else if (ratioSurplus >= 1.1) operasionalScore = 23;
          else operasionalScore = 20;
        }
      } else {
        // Defisit
        const ratioDefisit = realisasi > 0 ? penerimaan / realisasi : 0;
        if (ratioDefisit >= 0.8) operasionalScore = 14;
        else if (ratioDefisit >= 0.5) operasionalScore = 8;
        else operasionalScore = 3;
      }

      // --- PILAR 3: SOLVABILITAS & PENGENDALIAN HUTANG (Bobot Maks: 25 Poin) ---
      let solvabilitasScore = 25;
      if (hutang === 0) {
        solvabilitasScore = 25; // Bebas hutang
      } else {
        if (saldoKas >= 3 * hutang) solvabilitasScore = 22;
        else if (saldoKas >= 1.5 * hutang) solvabilitasScore = 18;
        else if (saldoKas >= 1 * hutang) solvabilitasScore = 14;
        else if (saldoKas > 0) solvabilitasScore = 6;
        else solvabilitasScore = 0;
      }

      // --- PILAR 4: EFISIENSI & STABILITAS TABUNGAN KAS (Bobot Maks: 20 Poin) ---
      let efisiensiScore = 16;
      const prevKas = m > 0 ? rawMonthly[m - 1].saldoKas : saldoKas;
      if (saldoKas >= prevKas) {
        efisiensiScore = 20; // Arus kas meningkat atau stabil
      } else {
        const penurunan = prevKas > 0 ? (prevKas - saldoKas) / prevKas : 0;
        if (penurunan < 0.10) efisiensiScore = 17;
        else if (penurunan < 0.25) efisiensiScore = 13;
        else efisiensiScore = 6;
      }

      // Total Skor Kumulatif (0 - 100)
      const totalScore = Math.max(15, Math.min(100, Math.round(likuiditasScore + operasionalScore + solvabilitasScore + efisiensiScore)));

      // Status Predikat
      let status: 'Sangat Sehat' | 'Sehat' | 'Cukup Sehat' | 'Kurang Sehat' = 'Sehat';
      if (totalScore >= 85) status = 'Sangat Sehat';
      else if (totalScore >= 70) status = 'Sehat';
      else if (totalScore >= 55) status = 'Cukup Sehat';
      else status = 'Kurang Sehat';

      // Delta
      const deltaFromPrevMonth = m === 0 ? 0 : totalScore - previousMonthScore;
      previousMonthScore = totalScore;

      // Catatan diagnosis
      let catatanKesehatan = '';
      if (totalScore >= 85) {
        catatanKesehatan = 'Likuiditas sangat kokoh, kas memadai, dan kewajiban terkendali penuh.';
      } else if (totalScore >= 70) {
        catatanKesehatan = 'Kondisi operasional stabil dan kas cukup menopang belanja rutin desa.';
      } else if (totalScore >= 55) {
        catatanKesehatan = 'Arus kas ketat atau terdapat defisit belanja temporer. Perlu monitoring penyerapan.';
      } else {
        catatanKesehatan = 'Peringatan: Penurunan saldo kas tajam atau beban hutang melebihi kas tersedia.';
      }

      scorecards.push({
        monthIndex: m,
        monthName: MONTH_NAMES[m],
        year: targetYear,
        label: `${MONTH_SHORT[m]} ${targetYear}`,
        penerimaan,
        realisasi,
        netMonthly,
        saldoKas,
        hutang,
        skorKesehatan: totalScore,
        status,
        deltaFromPrevMonth,
        likuiditasScore,
        operasionalScore,
        solvabilitasScore,
        efisiensiScore,
        catatanKesehatan,
        hasData: monthData.hasData || penerimaan > 0 || realisasi > 0 || saldoKas > 0
      });
    }

    // Saring data berdasarkan range (default: awal bulan Jan s/d bulan terakhir berjalan)
    const activeRange = showFullYear 
      ? scorecards 
      : scorecards.slice(0, detectedLatestMonth + 1);

    // Hitung metrik ringkasan
    const latestCard = scorecards[detectedLatestMonth] || scorecards[0];
    const avgScore = activeRange.length > 0 
      ? Math.round(activeRange.reduce((acc, curr) => acc + curr.skorKesehatan, 0) / activeRange.length) 
      : latestCard.skorKesehatan;

    let peakMonth = activeRange[0] || latestCard;
    let troughMonth = activeRange[0] || latestCard;
    activeRange.forEach(c => {
      if (c.skorKesehatan > peakMonth.skorKesehatan) peakMonth = c;
      if (c.skorKesehatan < troughMonth.skorKesehatan) troughMonth = c;
    });

    return {
      monthlyScorecards: activeRange,
      latestMonthIndex: detectedLatestMonth,
      summaryMetrics: {
        latestCard,
        avgScore,
        peakMonth,
        troughMonth,
        activeMonthsCount: activeRange.length
      }
    };
  }, [entries, bkuData, targetYear, showFullYear]);

  const { latestCard, avgScore, peakMonth, troughMonth } = summaryMetrics;

  // Custom Recharts Tooltip
  const CustomScoreTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: MonthlyHealthScoreData = payload[0].payload;
      const statusColor = 
        data.status === 'Sangat Sehat' ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' :
        data.status === 'Sehat' ? 'text-teal-400 bg-teal-950/60 border-teal-500/40' :
        data.status === 'Cukup Sehat' ? 'text-amber-400 bg-amber-950/60 border-amber-500/40' :
        'text-rose-400 bg-rose-950/60 border-rose-500/40';

      return (
        <div className="bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl border border-slate-700 max-w-xs text-xs font-sans">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
            <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <Calendar size={13} className="text-teal-400" />
              {data.monthName} {data.year}
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
              {data.status}
            </span>
          </div>

          {/* Skor Besar */}
          <div className="flex items-baseline justify-between mb-3 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <span className="text-slate-300 font-medium">Skor Kesehatan:</span>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-emerald-400">{data.skorKesehatan}</span>
              <span className="text-xs text-slate-400 font-mono"> / 100</span>
              {data.deltaFromPrevMonth !== 0 && (
                <span className={`ml-2 text-[10px] font-mono font-bold ${data.deltaFromPrevMonth > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.deltaFromPrevMonth > 0 ? `+${data.deltaFromPrevMonth}` : data.deltaFromPrevMonth} pts
                </span>
              )}
            </div>
          </div>

          {/* 4 Pilar Evaluasi */}
          <div className="space-y-1.5 mb-3 text-[11px]">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Likuiditas Kas:
              </span>
              <span className="font-mono font-bold text-slate-100">{data.likuiditasScore}/30</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Operasional / Surplus:
              </span>
              <span className="font-mono font-bold text-slate-100">{data.operasionalScore}/25</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Pengendalian Hutang:
              </span>
              <span className="font-mono font-bold text-slate-100">{data.solvabilitasScore}/25</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Stabilitas Arus Kas:
              </span>
              <span className="font-mono font-bold text-slate-100">{data.efisiensiScore}/20</span>
            </div>
          </div>

          {/* Realisasi Angka Finansial */}
          <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Penerimaan Bulan:</span>
              <span className="text-emerald-300 font-bold">{formatCurrency(data.penerimaan)}</span>
            </div>
            <div className="flex justify-between">
              <span>Realisasi Belanja:</span>
              <span className="text-rose-300 font-bold">{formatCurrency(data.realisasi)}</span>
            </div>
            <div className="flex justify-between">
              <span>Saldo Kas Akhir:</span>
              <span className="text-amber-300 font-bold">{formatCurrency(data.saldoKas)}</span>
            </div>
            {data.hutang > 0 && (
              <div className="flex justify-between text-purple-300">
                <span>Hutang Aktif:</span>
                <span className="font-bold">{formatCurrency(data.hutang)}</span>
              </div>
            )}
          </div>

          {/* Catatan Singkat */}
          <p className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-slate-400 italic">
            "{data.catatanKesehatan}"
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="financial-health-score-section" className="bg-white p-6 rounded-2xl shadow-xl border border-slate-400 text-slate-900 relative overflow-hidden print:border-none mb-6">
      {/* Glow ambient background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none no-print"></div>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-slate-300">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 shadow-xs shrink-0">
            <HeartPulse size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                Skor Kesehatan Keuangan (Tahun Berjalan)
              </h3>
              <span className="text-[11px] font-mono font-bold bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-0.5 rounded-full">
                Tahun Anggaran {targetYear}
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-md">
                Jan - {MONTH_SHORT[latestMonthIndex]} {targetYear}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Evaluasi kesehatan finansial bulanan dengan Recharts dari awal bulan (Januari) hingga bulan terakhir berjalan berbasis 4 pilar akuntansi.
            </p>
          </div>
        </div>

        {/* Action Controls & Tab Filters */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Filter Tahun Skor Kesehatan Keuangan */}
          <div className="no-print flex items-center gap-2 bg-slate-100 text-slate-900 text-xs font-black px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <Filter className="h-3.5 w-3.5 text-teal-700 shrink-0" />
            <label htmlFor="health-score-year-select" className="text-[11px] font-black font-mono text-slate-700 uppercase tracking-tighter">
              Tahun:
            </label>
            <select
              id="health-score-year-select"
              value={targetYear}
              onChange={(e) => {
                const val = Number(e.target.value);
                setInternalYear(val);
                if (onYearChange) onYearChange(val);
              }}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs sm:text-sm"
            >
              {calculatedAvailableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Range: Jan - Bulan Berjalan vs Jan - Des */}
          <button
            type="button"
            onClick={() => setShowFullYear(prev => !prev)}
            className={`no-print flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg border transition-all cursor-pointer shadow-2xs ${
              showFullYear
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            }`}
            title="Ubah rentang waktu grafik: sampai bulan terakhir berjalan atau seluruh 12 bulan"
          >
            <Calendar size={13} className="text-teal-600" />
            <span>{showFullYear ? 'Seluruh Tahun (Jan - Des)' : `Jan - ${MONTH_SHORT[latestMonthIndex]} (Berjalan)`}</span>
          </button>

          {/* View Tab Selector */}
          <div className="no-print flex items-center bg-slate-100 p-1 rounded-lg border border-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('trend')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === 'trend'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={13} />
              <span>Tren Skor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pillars')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === 'pillars'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={13} />
              <span>4 Pilar</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={13} />
              <span>Matriks Rekap</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- GRID 4 CARD RINGKASAN KESEHATAN KEUANGAN --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Skor Bulan Terakhir Berjalan */}
        <div className="bg-gradient-to-br from-teal-50/70 to-emerald-50/50 p-4 rounded-xl border border-teal-200 shadow-xs relative group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse size={15} className="text-teal-600" /> Skor Bulan Terakhir
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                latestCard.status === 'Sangat Sehat' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                latestCard.status === 'Sehat' ? 'bg-teal-100 text-teal-900 border-teal-300' :
                latestCard.status === 'Cukup Sehat' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                'bg-rose-100 text-rose-900 border-rose-300'
              }`}>
                {latestCard.status}
              </span>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <p className="text-3xl font-black font-mono tracking-tight text-teal-950">
                {latestCard.skorKesehatan}
              </p>
              <span className="text-sm font-mono text-slate-500 font-semibold">/ 100</span>
              {latestCard.deltaFromPrevMonth !== 0 && (
                <span className={`text-xs font-mono font-bold flex items-center gap-0.5 ml-auto ${
                  latestCard.deltaFromPrevMonth > 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {latestCard.deltaFromPrevMonth > 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {latestCard.deltaFromPrevMonth > 0 ? `+${latestCard.deltaFromPrevMonth}` : latestCard.deltaFromPrevMonth} pts
                </span>
              )}
            </div>
            <p className="text-[11px] text-teal-800 leading-tight mt-1">
              Posisi per {latestCard.monthName} {targetYear}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-teal-200/80 flex items-center justify-between text-[10px] font-mono text-teal-900 font-semibold">
            <span>Status Keuangan</span>
            <span className="bg-teal-200/60 px-1.5 py-0.5 rounded text-teal-950 font-bold">
              {latestCard.skorKesehatan >= 70 ? 'Prima & Terkendali' : 'Perlu Pengawasan'}
            </span>
          </div>
        </div>

        {/* Card 2: Rata-Rata Skor Sepanjang Tahun */}
        <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-200 shadow-xs relative group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={15} className="text-sky-600" /> Rata-Rata Tahun Berjalan
              </span>
              <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-900 border border-sky-300 px-2 py-0.5 rounded-full">
                {monthlyScorecards.length} Bulan
              </span>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <p className="text-3xl font-black font-mono tracking-tight text-sky-950">
                {avgScore}
              </p>
              <span className="text-sm font-mono text-slate-500 font-semibold">/ 100</span>
            </div>
            <p className="text-[11px] text-sky-800 leading-tight mt-1">
              Rerata indeks Jan s/d {MONTH_SHORT[latestMonthIndex]} {targetYear}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-sky-200/80 flex items-center justify-between text-[10px] font-mono text-sky-900 font-semibold">
            <span>Kestabilan Kinerja</span>
            <span className="bg-sky-200/60 px-1.5 py-0.5 rounded text-sky-950 font-bold">
              {avgScore >= 80 ? 'Sangat Konsisten' : avgScore >= 65 ? 'Cukup Stabil' : 'Fluktuatif'}
            </span>
          </div>
        </div>

        {/* Card 3: Bulan Puncak (Peak) & Terendah */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 shadow-xs relative group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Award size={15} className="text-amber-600" /> Rekor Kinerja Finansial
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-full">
                Fluktuasi
              </span>
            </div>
            <div className="space-y-1.5 my-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1 text-[11px]">
                  <TrendingUp size={12} className="text-emerald-600" /> Skor Tertinggi:
                </span>
                <span className="font-mono font-bold text-emerald-800">
                  {peakMonth.monthName} ({peakMonth.skorKesehatan})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1 text-[11px]">
                  <TrendingDown size={12} className="text-rose-600" /> Skor Terendah:
                </span>
                <span className="font-mono font-bold text-rose-800">
                  {troughMonth.monthName} ({troughMonth.skorKesehatan})
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-700 font-semibold">
            <span>Rentang Skor</span>
            <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-bold">
              Δ {peakMonth.skorKesehatan - troughMonth.skorKesehatan} Poin
            </span>
          </div>
        </div>

        {/* Card 4: Status 4 Pilar Terkini */}
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 shadow-xs relative group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-amber-700" /> Pilar Keuangan ({MONTH_SHORT[latestMonthIndex]})
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                4 Komponen
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono my-1">
              <div className="bg-white/80 p-1.5 rounded border border-amber-200/80">
                <span className="text-slate-600 block">Likuiditas</span>
                <span className="font-bold text-emerald-800">{latestCard.likuiditasScore}/30 pt</span>
              </div>
              <div className="bg-white/80 p-1.5 rounded border border-amber-200/80">
                <span className="text-slate-600 block">Operasional</span>
                <span className="font-bold text-sky-800">{latestCard.operasionalScore}/25 pt</span>
              </div>
              <div className="bg-white/80 p-1.5 rounded border border-amber-200/80">
                <span className="text-slate-600 block">Solvabilitas</span>
                <span className="font-bold text-indigo-800">{latestCard.solvabilitasScore}/25 pt</span>
              </div>
              <div className="bg-white/80 p-1.5 rounded border border-amber-200/80">
                <span className="text-slate-600 block">Efisiensi</span>
                <span className="font-bold text-amber-800">{latestCard.efisiensiScore}/20 pt</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-amber-200/80 flex items-center justify-between text-[10px] font-mono text-amber-900 font-semibold">
            <span>Beban Kewajiban</span>
            <span className={`px-1.5 py-0.5 rounded font-bold ${latestCard.hutang === 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-purple-100 text-purple-900'}`}>
              {latestCard.hutang === 0 ? 'Nihil Hutang' : formatCurrency(latestCard.hutang)}
            </span>
          </div>
        </div>
      </div>

      {/* --- VISUALISASI RECHARTS --- */}
      {activeTab === 'trend' && (
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-300 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Activity size={14} className="text-teal-600" />
                Grafik Skor Kesehatan Keuangan Bulanan (0 - 100)
              </h4>
              <p className="text-[11px] text-slate-600">
                Garis ambang: Hijau (&ge; 85 Sangat Sehat), Biru (&ge; 70 Sehat), Kuning (&ge; 55 Cukup Sehat)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Sangat Sehat (&ge;85)
              </span>
              <span className="flex items-center gap-1 text-teal-700">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span> Sehat (70-84)
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Waspada (&lt;70)
              </span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyScorecards}
                margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="healthScoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.7} />
                
                <XAxis 
                  dataKey="label" 
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8' }}
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}
                />
                
                <YAxis 
                  domain={[0, 100]}
                  ticks={[0, 25, 55, 70, 85, 100]}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8' }}
                  tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                />

                {/* Benchmark Reference Lines */}
                <ReferenceLine 
                  y={85} 
                  stroke="#10b981" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ value: 'Sangat Sehat (85)', position: 'insideTopRight', fill: '#047857', fontSize: 10, fontWeight: 700 }}
                />
                <ReferenceLine 
                  y={70} 
                  stroke="#0284c7" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ value: 'Batas Sehat (70)', position: 'insideTopRight', fill: '#0369a1', fontSize: 10, fontWeight: 700 }}
                />
                <ReferenceLine 
                  y={55} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ value: 'Batas Waspada (55)', position: 'insideTopRight', fill: '#b45309', fontSize: 10, fontWeight: 700 }}
                />

                <Tooltip content={<CustomScoreTooltip />} />

                {/* Area Gradient Background */}
                <Area
                  type="monotone"
                  dataKey="skorKesehatan"
                  name="Skor Kesehatan"
                  fill="url(#healthScoreGradient)"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                />

                {/* Primary Score Line with Dots */}
                <Line
                  type="monotone"
                  dataKey="skorKesehatan"
                  name="Skor Indeks"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#047857', stroke: '#ffffff', strokeWidth: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* --- TAB 2: KOMPARASI 4 PILAR KESEHATAN KEUANGAN --- */}
      {activeTab === 'pillars' && (
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-300 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers size={14} className="text-teal-600" />
                Komposisi 4 Pilar Pembentuk Skor Kesehatan (Stacked Bar)
              </h4>
              <p className="text-[11px] text-slate-600">
                Pilar: Likuiditas (Maks 30), Operasional (Maks 25), Solvabilitas (Maks 25), Efisiensi (Maks 20)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block"></span> Likuiditas (30)
              </span>
              <span className="flex items-center gap-1 text-sky-800">
                <span className="w-2.5 h-2.5 rounded bg-sky-600 inline-block"></span> Operasional (25)
              </span>
              <span className="flex items-center gap-1 text-indigo-800">
                <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block"></span> Solvabilitas (25)
              </span>
              <span className="flex items-center gap-1 text-amber-800">
                <span className="w-2.5 h-2.5 rounded bg-amber-600 inline-block"></span> Efisiensi (20)
              </span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyScorecards}
                margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.7} />
                
                <XAxis 
                  dataKey="label" 
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8' }}
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}
                />
                
                <YAxis 
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8' }}
                  tick={{ fill: '#475569', fontSize: 11, fontFamily: 'monospace' }}
                />

                <Tooltip content={<CustomScoreTooltip />} />

                {/* Stacked Bars for the 4 Pillars */}
                <Bar dataKey="likuiditasScore" name="Likuiditas Kas" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="operasionalScore" name="Keseimbangan Operasional" stackId="a" fill="#0284c7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="solvabilitasScore" name="Solvabilitas / Hutang" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} />
                <Bar dataKey="efisiensiScore" name="Stabilitas Arus Kas" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />

                {/* Total Score Line over the bars */}
                <Line
                  type="monotone"
                  dataKey="skorKesehatan"
                  name="Total Skor"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#0f172a' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* --- TAB 3: TABEL MATRIKS REKAPITULASI BULANAN --- */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden mb-4 shadow-2xs">
          <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-teal-600" />
              Matriks Kartu Hasil Evaluasi Bulanan (Januari - {MONTH_SHORT[latestMonthIndex]} {targetYear})
            </h4>
            <span className="text-[10px] font-mono text-slate-600">
              Total {monthlyScorecards.length} Periode Dievaluasi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Bulan</th>
                  <th className="py-2.5 px-3 text-right">Penerimaan</th>
                  <th className="py-2.5 px-3 text-right">Realisasi</th>
                  <th className="py-2.5 px-3 text-right">Surplus/Defisit</th>
                  <th className="py-2.5 px-3 text-right">Saldo Kas</th>
                  <th className="py-2.5 px-3 text-center">Likuiditas</th>
                  <th className="py-2.5 px-3 text-center">Operasional</th>
                  <th className="py-2.5 px-3 text-center">Solvabilitas</th>
                  <th className="py-2.5 px-3 text-center">Efisiensi</th>
                  <th className="py-2.5 px-3 text-center">Skor Akhir</th>
                  <th className="py-2.5 px-3 text-center">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {monthlyScorecards.map((row) => (
                  <tr key={row.monthIndex} className="hover:bg-teal-50/40 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                      {row.monthName}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                      {formatCurrency(row.penerimaan)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-700 font-semibold">
                      {formatCurrency(row.realisasi)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${row.netMonthly >= 0 ? 'text-teal-800' : 'text-rose-700'}`}>
                      {formatCurrency(row.netMonthly)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 font-bold">
                      {formatCurrency(row.saldoKas)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-800 font-bold">
                      {row.likuiditasScore}/30
                    </td>
                    <td className="py-2.5 px-3 text-center text-sky-800 font-bold">
                      {row.operasionalScore}/25
                    </td>
                    <td className="py-2.5 px-3 text-center text-indigo-800 font-bold">
                      {row.solvabilitasScore}/25
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-800 font-bold">
                      {row.efisiensiScore}/20
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-sm font-black text-teal-950 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {row.skorKesehatan}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border ${
                        row.status === 'Sangat Sehat' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                        row.status === 'Sehat' ? 'bg-teal-100 text-teal-900 border-teal-300' :
                        row.status === 'Cukup Sehat' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                        'bg-rose-100 text-rose-900 border-rose-300'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- FOOTER EXPLANATION & METHODOLOGY ACCORDION --- */}
      <div className="pt-3 border-t border-slate-300 print-border-t-0">
        <button
          type="button"
          onClick={() => setShowMetricDetails(prev => !prev)}
          className="no-print flex items-center justify-between w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-slate-800">
            <Info size={14} className="text-teal-600" />
            Metodologi &amp; Bobot Perhitungan 4 Pilar Skor Kesehatan Keuangan (0 - 100)
          </span>
          <div className="flex items-center gap-1 text-[11px] text-teal-700 font-bold">
            <span>{showMetricDetails ? 'Tutup Rincian' : 'Lihat Metodologi'}</span>
            {showMetricDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showMetricDetails && (
          <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-300 text-xs text-slate-700 space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="font-bold text-emerald-800 flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  1. Likuiditas Kas (Bobot: 30%)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Menilai kemampuan saldo kas riil untuk membiayai beban operasional bulanan (Cash Runway). Nilai maksimal jika kas &ge; 3x rata-rata belanja.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="font-bold text-sky-800 flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  2. Keseimbangan Operasional (Bobot: 25%)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Rasio penerimaan (Kelompok 4 &amp; 7) terhadap realisasi beban belanja (Kelompok 5). Skor maksimal tercapai saat terjadi surplus operasional &ge; 30%.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="font-bold text-indigo-800 flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  3. Pengendalian Hutang (Bobot: 25%)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tingkat solvabilitas dan beban kewajiban (Kelompok 2). Skor maksimal 25 jika kewajiban/hutang nihil atau kas &ge; 3x total kewajiban.
                </p>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="font-bold text-amber-800 flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  4. Stabilitas Arus Kas (Bobot: 20%)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Ketahanan saldo kas akhir bulan terhadap bulan sebelumnya. Menilai kedisiplinan pembentukan cadangan dana kas desa adat.
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span>* Data terhubung secara otomatis ke Buku Jurnal Umum (Akun 1.1, 2, 4, 5, 7) dan Buku Kas Umum (BKU).</span>
              <span className="font-mono text-slate-700 font-semibold">Standar Penilaian Akuntansi Sektor Publik &amp; Desa Adat</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialHealthScoreChart;
