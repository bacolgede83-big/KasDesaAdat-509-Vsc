import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Zap,
  Calendar,
  CheckCircle2,
  BarChart3,
  Layers,
  ShieldCheck,
  Percent,
  Sliders,
  Printer
} from 'lucide-react';
import type { JuDisplayRow, BkuData, BudgetItem } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { REFERENSI_REKENING } from '../../constants';

export interface YoyFinancialAnalyticsProps {
  entries: JuDisplayRow[];
  selectedYear: number | 'all';
  availableYears?: number[];
  bkuData?: BkuData[];
  budgetItems?: BudgetItem[];
  setActivePage?: (page: string) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const YoyFinancialAnalytics: React.FC<YoyFinancialAnalyticsProps> = ({
  entries = [],
  selectedYear: rawSelectedYear,
  availableYears: rawAvailableYears = [],
  bkuData = [],
  budgetItems = [],
  setActivePage
}) => {
  const safeSelectedYear = useMemo(() => {
    if (rawSelectedYear === 'all') {
      if (Array.isArray(rawAvailableYears) && rawAvailableYears.length > 0) {
        return Math.max(...rawAvailableYears);
      }
      return new Date().getFullYear();
    }
    const num = Number(rawSelectedYear);
    return !isNaN(num) && num > 0 ? num : new Date().getFullYear();
  }, [rawSelectedYear, rawAvailableYears]);

  const safeAvailableYears = useMemo(() => {
    if (Array.isArray(rawAvailableYears) && rawAvailableYears.length > 0) {
      const filtered = rawAvailableYears.filter(y => typeof y === 'number' && !isNaN(y));
      if (!filtered.includes(safeSelectedYear)) {
        filtered.push(safeSelectedYear);
      }
      return filtered.sort((a, b) => b - a);
    }
    return [safeSelectedYear];
  }, [rawAvailableYears, safeSelectedYear]);

  // Option to select comparison year (default to safeSelectedYear - 1 if present, or first available year != safeSelectedYear)
  const defaultComparisonYear = useMemo(() => {
    if (safeAvailableYears.includes(safeSelectedYear - 1)) return safeSelectedYear - 1;
    const other = safeAvailableYears.find(y => y !== safeSelectedYear);
    return other !== undefined ? other : safeSelectedYear - 1;
  }, [safeAvailableYears, safeSelectedYear]);

  const [userSelectedCompYear, setUserSelectedCompYear] = useState<number | null>(null);
  const comparisonYear = (userSelectedCompYear !== null && userSelectedCompYear !== safeSelectedYear)
    ? userSelectedCompYear
    : defaultComparisonYear;

  const [activeTab, setActiveTab] = useState<'comparison' | 'category' | 'monthly_rev'>('comparison');

  // Helper to extract year from date string safely
  const getYearOfEntry = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.getFullYear();
  };

  // Financial calculations for Selected Year (Current) and Comparison Year (Prior)
  const yoyMetrics = useMemo(() => {
    let revCurrent = 0;
    let expCurrent = 0;
    let revPrior = 0;
    let expPrior = 0;

    let cashEndCurrent = 0;
    let cashEndPrior = 0;

    entries.forEach(e => {
      const year = getYearOfEntry(e.date);
      if (!year) return;

      const rawCode = (e.kodeRekening || '').trim();
      const code = rawCode.split(' - ')[0].trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;

      // Current year revenue & expenses
      if (year === safeSelectedYear) {
        if (code.startsWith('4') || code.startsWith('7') || (code.startsWith('6') && !code.startsWith('6.1.1'))) {
          revCurrent += (kreditVal - debetVal);
        }
        if (code.startsWith('5')) {
          expCurrent += (debetVal - kreditVal);
        }
      }

      // Prior/Comparison year revenue & expenses
      if (year === comparisonYear) {
        if (code.startsWith('4') || code.startsWith('7') || (code.startsWith('6') && !code.startsWith('6.1.1'))) {
          revPrior += (kreditVal - debetVal);
        }
        if (code.startsWith('5')) {
          expPrior += (debetVal - kreditVal);
        }
      }

      // Cash balance up to end of safeSelectedYear (Kas 1.1)
      if (year <= safeSelectedYear && code.startsWith('1.1')) {
        cashEndCurrent += (debetVal - kreditVal);
      }

      // Cash balance up to end of comparisonYear
      if (year <= comparisonYear && code.startsWith('1.1')) {
        cashEndPrior += (debetVal - kreditVal);
      }
    });

    // Fallback to BKU if Jurnal Umum has 0 for that year
    if (revCurrent === 0 && expCurrent === 0 && Array.isArray(bkuData) && bkuData.length > 0) {
      const bkuCurrent = bkuData.filter(b => b.tanggal && new Date(b.tanggal).getFullYear() === safeSelectedYear);
      if (bkuCurrent.length > 0) {
        revCurrent = bkuCurrent.reduce((sum, b) => sum + (Number(b.penerimaan) || 0), 0);
        expCurrent = bkuCurrent.reduce((sum, b) => sum + (Number(b.pengeluaran) || 0), 0);
      }
    }
    if (revPrior === 0 && expPrior === 0 && Array.isArray(bkuData) && bkuData.length > 0) {
      const bkuPrior = bkuData.filter(b => b.tanggal && new Date(b.tanggal).getFullYear() === comparisonYear);
      if (bkuPrior.length > 0) {
        revPrior = bkuPrior.reduce((sum, b) => sum + (Number(b.penerimaan) || 0), 0);
        expPrior = bkuPrior.reduce((sum, b) => sum + (Number(b.pengeluaran) || 0), 0);
      }
    }

    const netSurplusCurrent = revCurrent - expCurrent;
    const netSurplusPrior = revPrior - expPrior;

    // Calculate YoY variance and percentages
    const revDiff = revCurrent - revPrior;
    const revPct = revPrior > 0 ? (revDiff / revPrior) * 100 : (revCurrent > 0 ? 100 : 0);

    const expDiff = expCurrent - expPrior;
    const expPct = expPrior > 0 ? (expDiff / expPrior) * 100 : (expCurrent > 0 ? 100 : 0);

    const cashDiff = cashEndCurrent - cashEndPrior;
    const cashPct = cashEndPrior > 0 ? (cashDiff / cashEndPrior) * 100 : (cashEndCurrent > 0 ? 100 : 0);

    const netDiff = netSurplusCurrent - netSurplusPrior;

    // Efficiency ratio (Expenses / Revenue) - lower percentage means higher margin retention
    const efficiencyRatioCurrent = revCurrent > 0 ? Math.round((expCurrent / revCurrent) * 100) : 0;
    const efficiencyRatioPrior = revPrior > 0 ? Math.round((expPrior / revPrior) * 100) : 0;
    const efficiencyDiff = efficiencyRatioCurrent - efficiencyRatioPrior;

    return {
      revCurrent,
      revPrior,
      revDiff,
      revPct: Math.round(revPct * 10) / 10,

      expCurrent,
      expPrior,
      expDiff,
      expPct: Math.round(expPct * 10) / 10,

      netSurplusCurrent,
      netSurplusPrior,
      netDiff,

      cashEndCurrent,
      cashEndPrior,
      cashDiff,
      cashPct: Math.round(cashPct * 10) / 10,

      efficiencyRatioCurrent,
      efficiencyRatioPrior,
      efficiencyDiff
    };
  }, [entries, bkuData, safeSelectedYear, comparisonYear]);

  // Monthly breakdown comparison data for Recharts
  const monthlyComparisonData = useMemo(() => {
    return MONTH_NAMES.map((mName, mIdx) => {
      let revCurr = 0;
      let expCurr = 0;
      let revPrio = 0;
      let expPrio = 0;

      entries.forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date);
        if (isNaN(d.getTime())) return;

        const y = d.getFullYear();
        const m = d.getMonth();

        if (m === mIdx) {
          const rawCode = (e.kodeRekening || '').trim();
          const code = rawCode.split(' - ')[0].trim();
          const debetVal = Number(e.debet) || 0;
          const kreditVal = Number(e.kredit) || 0;

          if (y === safeSelectedYear) {
            if (code.startsWith('4') || code.startsWith('7') || (code.startsWith('6') && !code.startsWith('6.1.1'))) {
              revCurr += (kreditVal - debetVal);
            }
            if (code.startsWith('5')) {
              expCurr += (debetVal - kreditVal);
            }
          } else if (y === comparisonYear) {
            if (code.startsWith('4') || code.startsWith('7') || (code.startsWith('6') && !code.startsWith('6.1.1'))) {
              revPrio += (kreditVal - debetVal);
            }
            if (code.startsWith('5')) {
              expPrio += (debetVal - kreditVal);
            }
          }
        }
      });

      // BKU Monthly Fallback if needed
      if (revCurr === 0 && expCurr === 0 && Array.isArray(bkuData) && bkuData.length > 0) {
        bkuData.forEach(b => {
          if (!b.tanggal) return;
          const d = new Date(b.tanggal);
          if (isNaN(d.getTime())) return;
          if (d.getFullYear() === safeSelectedYear && d.getMonth() === mIdx) {
            revCurr += Number(b.penerimaan) || 0;
            expCurr += Number(b.pengeluaran) || 0;
          }
        });
      }

      if (revPrio === 0 && expPrio === 0 && Array.isArray(bkuData) && bkuData.length > 0) {
        bkuData.forEach(b => {
          if (!b.tanggal) return;
          const d = new Date(b.tanggal);
          if (isNaN(d.getTime())) return;
          if (d.getFullYear() === comparisonYear && d.getMonth() === mIdx) {
            revPrio += Number(b.penerimaan) || 0;
            expPrio += Number(b.pengeluaran) || 0;
          }
        });
      }

      return {
        month: mName,
        [`Pendapatan ${safeSelectedYear}`]: revCurr,
        [`Pendapatan ${comparisonYear}`]: revPrio,
        [`Belanja ${safeSelectedYear}`]: expCurr,
        [`Belanja ${comparisonYear}`]: expPrio,
        [`Surplus ${safeSelectedYear}`]: revCurr - expCurr,
        [`Surplus ${comparisonYear}`]: revPrio - expPrio
      };
    });
  }, [entries, bkuData, safeSelectedYear, comparisonYear]);

  // Category program spending breakdown YoY
  const categorySpendingComparison = useMemo(() => {
    const categoriesMap: { [catName: string]: { current: number; prior: number } } = {};

    entries.forEach(e => {
      const year = getYearOfEntry(e.date);
      if (!year) return;

      const rawCode = (e.kodeRekening || '').trim();
      const code = rawCode.split(' - ')[0].trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;

      if (code.startsWith('5')) {
        const matched = REFERENSI_REKENING.find(r => r.code === code);
        const accName = matched?.name || (rawCode.includes(' - ') ? rawCode.split(' - ').slice(1).join(' - ').trim() : `Akun ${code}`);
        const fullName = `${code} - ${accName}`;

        if (!categoriesMap[fullName]) {
          categoriesMap[fullName] = { current: 0, prior: 0 };
        }

        const amount = debetVal - kreditVal;
        if (year === safeSelectedYear) {
          categoriesMap[fullName].current += amount;
        } else if (year === comparisonYear) {
          categoriesMap[fullName].prior += amount;
        }
      }
    });

    return Object.entries(categoriesMap)
      .map(([name, vals]) => {
        const diff = vals.current - vals.prior;
        const pct = vals.prior > 0 ? (diff / vals.prior) * 100 : (vals.current > 0 ? 100 : 0);
        return {
          name,
          [`Belanja ${safeSelectedYear}`]: vals.current,
          [`Belanja ${comparisonYear}`]: vals.prior,
          diff,
          pct: Math.round(pct * 10) / 10
        };
      })
      .filter(item => Number(item[`Belanja ${safeSelectedYear}`] || 0) !== 0 || Number(item[`Belanja ${comparisonYear}`] || 0) !== 0)
      .sort((a, b) => Number(b[`Belanja ${safeSelectedYear}`] || 0) - Number(a[`Belanja ${safeSelectedYear}`] || 0));
  }, [entries, safeSelectedYear, comparisonYear]);

  return (
    <div className="p-6 bg-white border border-slate-300 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full font-mono font-black uppercase tracking-wider">
              Analisis Komparatif Akuntansi
            </span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-mono font-black uppercase tracking-wider">
              YoY ({safeSelectedYear} vs {comparisonYear})
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight font-mono mt-1 flex items-center gap-2">
            <span>📈</span> Analisis Perbandingan Keuangan Tahun-ke-Tahun (YoY)
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Evaluasi laju pertumbuhan penerimaan desa, efisiensi belanja program, dan proyeksi akumulasi saldo kas desa secara kuantitatif.
          </p>
        </div>

        {/* CONTROLS: Year Selector & Tab Toggle placed directly below the header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Comparison Year Selector */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-bold text-slate-600 uppercase text-[10px]">Bandingkan dgn:</span>
            <select
              value={comparisonYear}
              onChange={(e) => setUserSelectedCompYear(Number(e.target.value))}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {safeAvailableYears.map(year => (
                <option key={year} value={year} disabled={year === safeSelectedYear}>
                  Tahun {year} {year === safeSelectedYear ? '(Aktif)' : ''}
                </option>
              ))}
              {!safeAvailableYears.includes(safeSelectedYear - 1) && (
                <option value={safeSelectedYear - 1}>Tahun {safeSelectedYear - 1}</option>
              )}
            </select>
          </div>

          {/* View Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'comparison'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 size={14} />
              <span>Grafik Belanja</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly_rev')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'monthly_rev'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <TrendingUp size={14} />
              <span>Pendapatan YoY</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('category')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'category'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers size={14} />
              <span>Program Program</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS COMPARISON CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Revenue YoY */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
              Pendapatan Desa (YoY)
            </span>
            <div className={`p-1.5 rounded-lg ${
              yoyMetrics.revDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {yoyMetrics.revDiff >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black font-mono text-slate-900">
              {formatCurrency(yoyMetrics.revCurrent)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-500 font-mono">vs {comparisonYear}: {formatCurrency(yoyMetrics.revPrior)}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                yoyMetrics.revDiff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {yoyMetrics.revPct >= 0 ? `+${yoyMetrics.revPct}%` : `${yoyMetrics.revPct}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2: Realisasi Belanja YoY */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
              Realisasi Belanja (YoY)
            </span>
            <div className={`p-1.5 rounded-lg ${
              yoyMetrics.expDiff <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {yoyMetrics.expDiff <= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black font-mono text-slate-900">
              {formatCurrency(yoyMetrics.expCurrent)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-500 font-mono">vs {comparisonYear}: {formatCurrency(yoyMetrics.expPrior)}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                yoyMetrics.expDiff <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {yoyMetrics.expPct >= 0 ? `+${yoyMetrics.expPct}%` : `${yoyMetrics.expPct}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 3: Pertumbuhan Saldo Kas & Bank */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
              Saldo Kas & Bank Kumulatif
            </span>
            <div className={`p-1.5 rounded-lg ${
              yoyMetrics.cashDiff >= 0 ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black font-mono text-teal-700">
              {formatCurrency(yoyMetrics.cashEndCurrent)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-500 font-mono">End {comparisonYear}: {formatCurrency(yoyMetrics.cashEndPrior)}</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                yoyMetrics.cashDiff >= 0 ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {yoyMetrics.cashPct >= 0 ? `+${yoyMetrics.cashPct}%` : `${yoyMetrics.cashPct}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 4: Rasio Efisiensi Belanja / Penetrasi Program */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">
              Rasio Belanja vs Pendapatan
            </span>
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Percent size={16} />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-black font-mono text-slate-900">
              {yoyMetrics.efficiencyRatioCurrent}%
            </p>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              vs {comparisonYear}: {yoyMetrics.efficiencyRatioPrior}% ({yoyMetrics.efficiencyDiff <= 0 ? 'Efisiensi Meningkat' : 'Ekspansi Program'})
            </p>
          </div>
        </div>
      </div>

      {/* CHART SECTION */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        {activeTab === 'comparison' && (
          <div>
            <div className="mb-3">
              <h4 className="text-xs font-black uppercase text-slate-800 font-mono">
                Perbandingan Realisasi Belanja Bulanan: {safeSelectedYear} vs {comparisonYear}
              </h4>
              <p className="text-[11px] text-slate-500">
                Membandingkan alokasi dan ritme serapan anggaran belanja program desa setiap bulan antara dua tahun anggaran.
              </p>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientSurplusYoy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} fontWeight="bold" />
                  <YAxis stroke="#475569" fontSize={11} fontWeight="bold" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderColor: '#cbd5e1', 
                      borderRadius: '12px',
                      fontSize: '11px',
                      maxWidth: '85vw',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none', outline: 'none' }}
                    allowEscapeViewBox={{ x: false, y: false }}
                    formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Bar dataKey={`Belanja ${safeSelectedYear}`} fill="#0d9488" name={`Belanja ${safeSelectedYear} (Rp)`} radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey={`Belanja ${comparisonYear}`} fill="#94a3b8" name={`Belanja ${comparisonYear} (Rp)`} radius={[4, 4, 0, 0]} barSize={18} />
                  <Area
                    type="monotone"
                    dataKey={`Surplus ${safeSelectedYear}`}
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradientSurplusYoy)"
                    fillOpacity={1}
                    name={`Surplus/Defisit ${safeSelectedYear}`}
                    dot={{ r: 3.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'monthly_rev' && (
          <div>
            <div className="mb-3">
              <h4 className="text-xs font-black uppercase text-slate-800 font-mono">
                Perbandingan Penerimaan Pendapatan Bulanan: {safeSelectedYear} vs {comparisonYear}
              </h4>
              <p className="text-[11px] text-slate-500">
                Laju penerimaan kas dari pendapatan asli desa (PADes), bantuan pemerintah, dan sumber penerimaan adat.
              </p>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} fontWeight="bold" />
                  <YAxis stroke="#059669" fontSize={11} fontWeight="bold" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      borderColor: '#cbd5e1', 
                      borderRadius: '12px',
                      fontSize: '11px',
                      maxWidth: '85vw',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }}
                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none', outline: 'none' }}
                    allowEscapeViewBox={{ x: false, y: false }}
                    formatter={(value: any, name: any) => [formatCurrency(Number(value)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                  <Bar dataKey={`Pendapatan ${safeSelectedYear}`} fill="#059669" name={`Pendapatan ${safeSelectedYear} (Rp)`} radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey={`Pendapatan ${comparisonYear}`} fill="#cbd5e1" name={`Pendapatan ${comparisonYear} (Rp)`} radius={[4, 4, 0, 0]} barSize={20} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'category' && (
          <div>
            <div className="mb-3">
              <h4 className="text-xs font-black uppercase text-slate-800 font-mono">
                Rincian Perubahan Belanja Berdasarkan Kategori Program Desa
              </h4>
              <p className="text-[11px] text-slate-500">
                Membandingkan alokasi anggaran belanja program pada tahun {safeSelectedYear} dan {comparisonYear}.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2">Kategori Program / Rekening Belanja</th>
                    <th className="p-2 text-right font-mono">Belanja {comparisonYear}</th>
                    <th className="p-2 text-right font-mono">Belanja {safeSelectedYear}</th>
                    <th className="p-2 text-right font-mono">Selisih (Rp)</th>
                    <th className="p-2 text-center font-mono">Perubahan (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {categorySpendingComparison.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                        Belum ada data transaksi belanja untuk dibandingkan.
                      </td>
                    </tr>
                  ) : (
                    categorySpendingComparison.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-semibold text-slate-800">{cat.name}</td>
                        <td className="p-2 text-right font-mono text-slate-600">
                          {formatCurrency(cat[`Belanja ${comparisonYear}`])}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(cat[`Belanja ${safeSelectedYear}`])}
                        </td>
                        <td className={`p-2 text-right font-mono font-bold ${
                          cat.diff > 0 ? 'text-amber-700' : cat.diff < 0 ? 'text-emerald-700' : 'text-slate-600'
                        }`}>
                          {cat.diff > 0 ? `+${formatCurrency(cat.diff)}` : formatCurrency(cat.diff)}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            cat.pct > 0 ? 'bg-amber-100 text-amber-800' : cat.pct < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {cat.pct > 0 ? `+${cat.pct}%` : `${cat.pct}%`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* POLICY INSIGHTS PANEL FOR PRAJURU DESA ADAT */}
      <div className="p-5 bg-linear-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-teal-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-xl">
              <Award size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider font-mono text-teal-400">
                💡 Ringkasan Eksekutif Keputusan Keuangan Desa (YoY)
              </h4>
              <p className="text-[11px] text-teal-200/80">
                Analisis otomatis tren pertumbuhan kas dan efisiensi pengeluaran program Desa Adat Basangalas.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-teal-800/80 text-teal-200 px-3 py-1 rounded-full font-mono font-bold uppercase border border-teal-700">
            Prajuru Policy Matrix
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Card A: Cash Growth & Revenue Trend */}
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase font-mono text-[11px]">
              <CheckCircle2 size={14} />
              <span>1. Pertumbuhan Kas & Pendapatan</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {yoyMetrics.cashDiff >= 0 ? (
                <span>
                  Kas desa tumbuh sebesar <strong className="text-emerald-400">+{yoyMetrics.cashPct}%</strong> ({formatCurrency(yoyMetrics.cashDiff)}) dibanding tahun {comparisonYear}. Likuiditas kas berada dalam kondisi aman.
                </span>
              ) : (
                <span>
                  Saldo kas mengalami koreksi sebesar <strong className="text-amber-400">{yoyMetrics.cashPct}%</strong>. Disarankan memperketat perencanaan arus kas keluar untuk program mendatang.
                </span>
              )}
            </p>
          </div>

          {/* Card B: Spending Efficiency */}
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase font-mono text-[11px]">
              <Sliders size={14} />
              <span>2. Efisiensi Belanja Program</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {yoyMetrics.efficiencyDiff <= 0 ? (
                <span>
                  Rasio belanja terhadap pendapatan turun dari <strong className="text-slate-200">{yoyMetrics.efficiencyRatioPrior}%</strong> menjadi <strong className="text-emerald-400">{yoyMetrics.efficiencyRatioCurrent}%</strong>, menunjukkan efisiensi operasional yang semakin membaik.
                </span>
              ) : (
                <span>
                  Rasio belanja terhadap pendapatan meningkat menjadi <strong className="text-amber-400">{yoyMetrics.efficiencyRatioCurrent}%</strong> (naik {yoyMetrics.efficiencyDiff}%), mencerminkan ekspansi pembangunan dan aktivitas program desa.
                </span>
              )}
            </p>
          </div>

          {/* Card C: Recommendation */}
          <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-blue-400 font-bold uppercase font-mono text-[11px]">
              <Zap size={14} />
              <span>3. Rekomendasi Paruman Desa</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Saran bagi Prajuru Desa: Jaga keseimbangan antara pendapatan rutin dan realisasi program adat, serta pastikan setiap entri terus terdokumentasi dalam Jurnal Umum.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YoyFinancialAnalytics;
