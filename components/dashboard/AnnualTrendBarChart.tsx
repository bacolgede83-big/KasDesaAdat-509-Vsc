import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  Scale,
  DollarSign,
  BarChart3,
  CheckCircle2,
  Info,
  Sliders,
  ChevronRight,
  Percent
} from 'lucide-react';
import type { JuDisplayRow, BkuData, BudgetItem } from '../../types';
import { formatCurrency } from '../../utils/formatter';

export interface AnnualTrendBarChartProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  budgetItems?: BudgetItem[];
  availableYears: number[];
  selectedYear?: number | 'all';
}

export interface YearTrendMetric {
  year: number;
  yearLabel: string;
  pendapatan: number;
  belanja: number;
  surplusDefisit: number;
  rasioSerapan: number; // % belanja terhadap pendapatan
  anggaranPendapatan: number;
  anggaranBelanja: number;
  capaianPendapatan: number | null; // % realisasi thd anggaran
  capaianBelanja: number | null;
  pendapatanYoY: number | null; // % pertumbuhan thd tahun sebelumnya
  belanjaYoY: number | null;
  isSurplus: boolean;
  hasData: boolean;
  transactionCount: number;
}

const formatCompactRupiah = (value: number) => {
  if (value === 0) return 'Rp 0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}Jt`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(0)}Rb`;
  }
  return String(value);
};

export const AnnualTrendBarChart: React.FC<AnnualTrendBarChartProps> = ({
  entries = [],
  bkuData = [],
  budgetItems = [],
  availableYears = [],
  selectedYear = 'all'
}) => {
  // Tentukan tahun jangkar (anchor year) yang menjadi acuan 3 tahun terakhir
  const initialAnchor = useMemo(() => {
    if (selectedYear !== 'all') return selectedYear;
    if (availableYears.length > 0) return Math.max(...availableYears);
    return new Date().getFullYear();
  }, [selectedYear, availableYears]);

  const [anchorYear, setAnchorYear] = useState<number>(initialAnchor);
  const [viewMode, setViewMode] = useState<'comparison' | 'netSurplus'>('comparison');
  const [showBudgetComparison, setShowBudgetComparison] = useState<boolean>(false);

  // Jika selectedYear berubah dari luar dan bukan 'all', sinkronkan anchorYear
  React.useEffect(() => {
    if (selectedYear !== 'all') {
      setAnchorYear(selectedYear);
    }
  }, [selectedYear]);

  // Daftar 3 tahun terakhir yang dianalisis: [anchorYear - 2, anchorYear - 1, anchorYear]
  const targetThreeYears = useMemo(() => {
    return [anchorYear - 2, anchorYear - 1, anchorYear];
  }, [anchorYear]);

  // Kalkulasi data metrik untuk masing-masing dari 3 tahun terakhir
  const annualMetrics: YearTrendMetric[] = useMemo(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeBku = Array.isArray(bkuData) ? bkuData : [];
    const safeBudget = Array.isArray(budgetItems) ? budgetItems : [];

    const results: YearTrendMetric[] = targetThreeYears.map((yr) => {
      // 1. Data Jurnal Umum untuk tahun yr
      const yearEntries = safeEntries.filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d.getFullYear() === yr;
      });

      let pendapatanJU = 0;
      let belanjaJU = 0;

      yearEntries.forEach((e) => {
        const rawCode = (e.kodeRekening || '').trim();
        const cleanCode = rawCode.split(' - ')[0].trim();
        const debetVal = Number(e.debet) || 0;
        const kreditVal = Number(e.kredit) || 0;

        // Pendapatan: Kelompok 4 (Pendapatan Desa), 7 (Hibah/Sumber Dana BKK)
        // dan Kelompok 6 (kecuali SiLPA lalu 6.1.1.01 agar murni operasional tahun berjalan)
        if (cleanCode.startsWith('4') || cleanCode.startsWith('7')) {
          pendapatanJU += (kreditVal - debetVal);
        } else if (cleanCode.startsWith('6') && !cleanCode.startsWith('6.1.1')) {
          pendapatanJU += (kreditVal - debetVal);
        }

        // Belanja: Kelompok 5
        if (cleanCode.startsWith('5')) {
          belanjaJU += (debetVal - kreditVal);
        }
      });

      // 2. Data BKU jika Jurnal belum memiliki transaksi di tahun tersebut
      const yearBku = safeBku.filter((b) => {
        if (!b.tanggal) return false;
        const d = new Date(b.tanggal);
        return !isNaN(d.getTime()) && d.getFullYear() === yr;
      });

      const bkuPenerimaan = yearBku.reduce((sum, b) => sum + (Number(b.penerimaan) || 0), 0);
      const bkuPengeluaran = yearBku.reduce((sum, b) => sum + (Number(b.pengeluaran) || 0), 0);

      // Gunakan Jurnal Umum jika ada entri, jika kosong gunakan BKU
      const hasJurnal = yearEntries.length > 0;
      const hasBku = yearBku.length > 0;
      const pendapatan = hasJurnal ? pendapatanJU : (hasBku ? bkuPenerimaan : 0);
      const belanja = hasJurnal ? belanjaJU : (hasBku ? bkuPengeluaran : 0);

      // 3. Data Anggaran (Budget) untuk tahun yr
      const yearBudgets = safeBudget.filter((b) => Number(b.tahun) === yr);
      const anggaranPendapatan = yearBudgets
        .filter((b) => b.kategori === 'pendapatan')
        .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);
      const anggaranBelanja = yearBudgets
        .filter((b) => b.kategori && b.kategori.startsWith('belanja'))
        .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);

      const surplusDefisit = pendapatan - belanja;
      const rasioSerapan = pendapatan > 0 ? (belanja / pendapatan) * 100 : 0;
      const capaianPendapatan = anggaranPendapatan > 0 ? (pendapatan / anggaranPendapatan) * 100 : null;
      const capaianBelanja = anggaranBelanja > 0 ? (belanja / anggaranBelanja) * 100 : null;
      const transactionCount = yearEntries.length > 0 ? yearEntries.length : yearBku.length;

      return {
        year: yr,
        yearLabel: `TA ${yr}`,
        pendapatan,
        belanja,
        surplusDefisit,
        rasioSerapan,
        anggaranPendapatan,
        anggaranBelanja,
        capaianPendapatan,
        capaianBelanja,
        pendapatanYoY: null, // akan dihitung di loop berikutnya
        belanjaYoY: null,
        isSurplus: surplusDefisit >= 0,
        hasData: pendapatan > 0 || belanja > 0 || transactionCount > 0,
        transactionCount
      };
    });

    // Hitung persentase pertumbuhan Year-over-Year (YoY)
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const curr = results[i];

      if (prev.pendapatan > 0) {
        curr.pendapatanYoY = ((curr.pendapatan - prev.pendapatan) / prev.pendapatan) * 100;
      }
      if (prev.belanja > 0) {
        curr.belanjaYoY = ((curr.belanja - prev.belanja) / prev.belanja) * 100;
      }
    }

    return results;
  }, [entries, bkuData, budgetItems, targetThreeYears]);

  // Statistik agregat 3 tahun
  const summaryThreeYears = useMemo(() => {
    const totalPendapatan = annualMetrics.reduce((sum, m) => sum + m.pendapatan, 0);
    const totalBelanja = annualMetrics.reduce((sum, m) => sum + m.belanja, 0);
    const totalSurplus = totalPendapatan - totalBelanja;
    const avgRasioSerapan = totalPendapatan > 0 ? (totalBelanja / totalPendapatan) * 100 : 0;

    // Hitung rata-rata pertumbuhan YoY pendapatan dan belanja
    const yoyRevenues = annualMetrics.map(m => m.pendapatanYoY).filter((v): v is number => v !== null);
    const avgRevGrowth = yoyRevenues.length > 0
      ? yoyRevenues.reduce((a, b) => a + b, 0) / yoyRevenues.length
      : null;

    const yoyExpenses = annualMetrics.map(m => m.belanjaYoY).filter((v): v is number => v !== null);
    const avgExpGrowth = yoyExpenses.length > 0
      ? yoyExpenses.reduce((a, b) => a + b, 0) / yoyExpenses.length
      : null;

    return {
      totalPendapatan,
      totalBelanja,
      totalSurplus,
      avgRasioSerapan,
      avgRevGrowth,
      avgExpGrowth
    };
  }, [annualMetrics]);

  // Custom Tooltip Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const metric = annualMetrics.find(m => m.yearLabel === label);
      if (!metric) return null;

      return (
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 min-w-[280px] text-xs font-mono">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-700 text-slate-200">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-teal-400" />
              <span className="font-bold text-sm text-white font-sans">{label}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              metric.isSurplus ? 'bg-teal-900/80 text-teal-300 border border-teal-600' : 'bg-rose-900/80 text-rose-300 border border-rose-600'
            }`}>
              {metric.isSurplus ? 'Surplus' : 'Defisit'}
            </span>
          </div>

          <div className="space-y-2">
            {/* Realisasi Pendapatan */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Realisasi Pendapatan:</span>
              </div>
              <span className="font-black text-emerald-300">{formatCurrency(metric.pendapatan)}</span>
            </div>
            {metric.pendapatanYoY !== null && (
              <div className="flex justify-end text-[10px]">
                <span className={metric.pendapatanYoY >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  Pertumbuhan YoY: {metric.pendapatanYoY >= 0 ? `+${metric.pendapatanYoY.toFixed(1)}%` : `${metric.pendapatanYoY.toFixed(1)}%`}
                </span>
              </div>
            )}

            {/* Realisasi Belanja */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-rose-400 font-medium font-sans">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>Realisasi Belanja:</span>
              </div>
              <span className="font-black text-rose-300">{formatCurrency(metric.belanja)}</span>
            </div>
            {metric.belanjaYoY !== null && (
              <div className="flex justify-end text-[10px]">
                <span className={metric.belanjaYoY >= 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  Perubahan Belanja: {metric.belanjaYoY >= 0 ? `+${metric.belanjaYoY.toFixed(1)}%` : `${metric.belanjaYoY.toFixed(1)}%`}
                </span>
              </div>
            )}

            {/* Surplus/Defisit */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-slate-400 font-sans">Net Surplus / (Defisit):</span>
              <span className={`font-black ${metric.isSurplus ? 'text-teal-300' : 'text-rose-300'}`}>
                {metric.isSurplus ? `+${formatCurrency(metric.surplusDefisit)}` : formatCurrency(metric.surplusDefisit)}
              </span>
            </div>

            {/* Rasio Serapan */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans pt-1">
              <span>Rasio Serapan Belanja:</span>
              <span className="font-bold text-slate-200">{metric.rasioSerapan.toFixed(1)}%</span>
            </div>

            {/* Jika ada data target anggaran */}
            {metric.anggaranPendapatan > 0 && (
              <div className="pt-1.5 border-t border-dashed border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Target Anggaran Pendapatan:</span>
                  <span className="text-slate-300">{formatCurrency(metric.anggaranPendapatan)}</span>
                </div>
                {metric.capaianPendapatan !== null && (
                  <div className="flex justify-between text-teal-400">
                    <span>Capaian Target Pendapatan:</span>
                    <span>{metric.capaianPendapatan.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="annual-trend-bar-chart-card" className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm mb-6 overflow-hidden">
      {/* Header Visualisasi */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-300">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-teal-100 border border-teal-200 rounded-xl text-teal-800 shadow-2xs shrink-0">
            <BarChart3 size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-wide uppercase">
                Tren Realisasi Pendapatan &amp; Belanja Tahunan
              </h3>
              <span className="text-[11px] font-mono font-black bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-0.5 rounded-full">
                Komparasi 3 Tahun: {targetThreeYears[0]} - {targetThreeYears[2]}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Visualisasi grafik batang membandingkan kinerja realisasi penerimaan operasional versus pengeluaran belanja 3 tahun anggaran terakhir.
            </p>
          </div>
        </div>

        {/* Controls: Mode & Tahun Acuan */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto no-print">
          {/* Mode Selector */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-300 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'comparison'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Komparasi Berdampingan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('netSurplus')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'netSurplus'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Surplus / Defisit Bersih
            </button>
          </div>

          {/* Pemilih Tahun Acuan (Anchor Year) */}
          <div className="flex items-center gap-2 bg-slate-100 text-slate-900 text-xs font-black px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-teal-700 shrink-0" />
            <label htmlFor="anchor-year-select" className="text-[11px] font-black font-mono text-slate-700 uppercase tracking-tighter">
              Tahun Acuan:
            </label>
            <select
              id="anchor-year-select"
              value={anchorYear}
              onChange={(e) => setAnchorYear(Number(e.target.value))}
              className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
              {!availableYears.includes(anchorYear) && (
                <option value={anchorYear}>{anchorYear}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'comparison' ? (
            <BarChart
              data={annualMetrics}
              margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="yearLabel"
                tick={{ fill: '#0f172a', fontWeight: 800, fontSize: 13 }}
                axisLine={{ stroke: '#94a3b8' }}
              />
              <YAxis
                tickFormatter={formatCompactRupiah}
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12, fontWeight: 700 }}
              />
              <Bar
                dataKey="pendapatan"
                name="Realisasi Pendapatan"
                fill="#059669"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
              />
              <Bar
                dataKey="belanja"
                name="Realisasi Belanja"
                fill="#e11d48"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
              />
            </BarChart>
          ) : (
            <BarChart
              data={annualMetrics}
              margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="yearLabel"
                tick={{ fill: '#0f172a', fontWeight: 800, fontSize: 13 }}
                axisLine={{ stroke: '#94a3b8' }}
              />
              <YAxis
                tickFormatter={formatCompactRupiah}
                tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12, fontWeight: 700 }}
              />
              <Bar
                dataKey="surplusDefisit"
                name="Net Surplus / (Defisit)"
                radius={[6, 6, 0, 0]}
                maxBarSize={70}
              >
                {annualMetrics.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.surplusDefisit >= 0 ? '#0d9488' : '#e11d48'}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* 3 Kartu Komparasi Multi-Tahun */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5 pt-4 border-t border-slate-300">
        {annualMetrics.map((item, index) => {
          const isAnchor = item.year === anchorYear;
          return (
            <div
              key={item.year}
              id={`annual-trend-card-${item.year}`}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                isAnchor
                  ? 'bg-teal-50/70 border-teal-500 shadow-xs'
                  : 'bg-slate-50/70 border-slate-300 hover:border-slate-400'
              }`}
            >
              <div>
                {/* Header Card */}
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {item.yearLabel}
                    </span>
                    {isAnchor && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-teal-200 text-teal-950 border border-teal-300">
                        Tahun Terpilih
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    item.isSurplus
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}>
                    {item.isSurplus ? 'Surplus' : 'Defisit'}
                  </span>
                </div>

                {/* Metrics */}
                <div className="space-y-2 text-xs font-mono">
                  {/* Pendapatan */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-sans">Pendapatan:</span>
                    <div className="text-right">
                      <p className="font-black text-emerald-800 text-sm">
                        {formatCurrency(item.pendapatan)}
                      </p>
                      {item.pendapatanYoY !== null && (
                        <span className={`text-[10px] font-bold ${
                          item.pendapatanYoY >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {item.pendapatanYoY >= 0 ? `+${item.pendapatanYoY.toFixed(1)}%` : `${item.pendapatanYoY.toFixed(1)}%`} YoY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Belanja */}
                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
                    <span className="text-slate-600 font-sans">Belanja:</span>
                    <div className="text-right">
                      <p className="font-black text-rose-800 text-sm">
                        {formatCurrency(item.belanja)}
                      </p>
                      {item.belanjaYoY !== null && (
                        <span className={`text-[10px] font-bold ${
                          item.belanjaYoY >= 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}>
                          {item.belanjaYoY >= 0 ? `+${item.belanjaYoY.toFixed(1)}%` : `${item.belanjaYoY.toFixed(1)}%`} YoY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Surplus / Defisit */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-300">
                    <span className="text-slate-700 font-sans font-bold">Surplus/(Defisit):</span>
                    <p className={`font-black ${item.isSurplus ? 'text-teal-900' : 'text-rose-900'}`}>
                      {item.isSurplus ? `+${formatCurrency(item.surplusDefisit)}` : formatCurrency(item.surplusDefisit)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer Card */}
              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-700">
                <span className="font-sans">Serapan Belanja:</span>
                <span className="font-black font-mono bg-slate-200 text-slate-900 px-2 py-0.5 rounded">
                  {item.rasioSerapan.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ringkasan Analisis Tren 3 Tahun */}
      <div className="mt-4 p-3.5 bg-slate-100/90 rounded-xl border border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-600 rounded-lg text-white shrink-0">
            <TrendingUp size={16} />
          </div>
          <div>
            <span className="font-black text-slate-900">Ikhtisar Tren 3 Tahun: </span>
            <span className="text-slate-700">
              Total Akumulasi Pendapatan <strong>{formatCurrency(summaryThreeYears.totalPendapatan)}</strong> vs Belanja <strong>{formatCurrency(summaryThreeYears.totalBelanja)}</strong> (Surplus Kumulatif <strong>{formatCurrency(summaryThreeYears.totalSurplus)}</strong>).
              {summaryThreeYears.avgRevGrowth !== null && (
                <> Laju rata-rata pertumbuhan pendapatan: <strong className={summaryThreeYears.avgRevGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{summaryThreeYears.avgRevGrowth >= 0 ? `+${summaryThreeYears.avgRevGrowth.toFixed(1)}%` : `${summaryThreeYears.avgRevGrowth.toFixed(1)}%`} YoY</strong>.</>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono text-xs font-bold text-slate-800">
          <span className="text-slate-600">Rata-rata Serapan:</span>
          <span className="bg-white border border-slate-300 px-2 py-1 rounded-md text-teal-900">
            {summaryThreeYears.avgRasioSerapan.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AnnualTrendBarChart;
