import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Activity,
  Sliders
} from 'lucide-react';
import type { MonthlyData } from '../../types';

interface MonthlyLineChartProps {
  data: MonthlyData[];
  selectedYear?: number | 'all';
}

const formatRupiah = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const saldo = Number(item.saldo || 0);
    const monthlyNet = Number(item.monthlyNet || 0);
    const penerimaan = Number(item.penerimaan || 0);
    const realisasi = Number(item.realisasi || 0);
    const isSurplus = monthlyNet >= 0;

    return (
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 min-w-[260px] text-xs font-mono">
        <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-slate-700 text-slate-200">
          <Calendar size={14} className="text-sky-400" />
          <span className="font-bold text-sm text-white font-sans">{label}</span>
        </div>

        <div className="space-y-2">
          {/* Saldo Kumulatif */}
          <div className="flex items-center justify-between gap-3 bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <span className="text-sky-300 font-sans font-bold">Saldo Kumulatif:</span>
            <span className="font-black text-white text-sm">{formatRupiah(saldo)}</span>
          </div>

          {/* Arus Kas Bulan Ini */}
          <div className="pt-1 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-300 font-sans">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Penerimaan Bulan Ini:
              </span>
              <span className="font-mono text-emerald-300">{formatRupiah(penerimaan)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300 font-sans">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                Realisasi Bulan Ini:
              </span>
              <span className="font-mono text-rose-300">{formatRupiah(realisasi)}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-sans">
              <span className="text-slate-400">Selisih Bulan (Net):</span>
              <span className={`font-mono font-bold ${isSurplus ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isSurplus ? `+${formatRupiah(monthlyNet)}` : formatRupiah(monthlyNet)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const MonthlyLineChart: React.FC<MonthlyLineChartProps> = ({ data, selectedYear }) => {
  const [viewMode, setViewMode] = useState<'cumulative' | 'monthly'>('cumulative');

  // Compute cumulative balance trajectory
  const chartData = useMemo(() => {
    let runningBalance = 0;
    return data.map(d => {
      const net = (Number(d.penerimaan) || 0) - (Number(d.realisasi) || 0);
      runningBalance += net;
      return {
        ...d,
        monthlyNet: net,
        saldo: runningBalance,
      };
    });
  }, [data]);

  // Key metrics
  const { currentSaldo, peakSaldo, lowestSaldo, averageSaldo } = useMemo(() => {
    if (chartData.length === 0) {
      return { currentSaldo: 0, peakSaldo: { month: '-', value: 0 }, lowestSaldo: { month: '-', value: 0 }, averageSaldo: 0 };
    }

    let max = { month: chartData[0].name, value: chartData[0].saldo };
    let min = { month: chartData[0].name, value: chartData[0].saldo };
    let sum = 0;

    chartData.forEach(d => {
      sum += d.saldo;
      if (d.saldo > max.value) {
        max = { month: d.name, value: d.saldo };
      }
      if (d.saldo < min.value) {
        min = { month: d.name, value: d.saldo };
      }
    });

    const last = chartData[chartData.length - 1];

    return {
      currentSaldo: last ? last.saldo : 0,
      peakSaldo: max,
      lowestSaldo: min,
      averageSaldo: chartData.length > 0 ? sum / chartData.length : 0
    };
  }, [chartData]);

  const hasNegativeBalance = useMemo(() => {
    return chartData.some(d => (viewMode === 'cumulative' ? d.saldo < 0 : d.monthlyNet < 0));
  }, [chartData, viewMode]);

  return (
    <div className="bg-white rounded-2xl border border-slate-400 p-6 shadow-xl relative overflow-hidden transition-all text-slate-900">
      {/* Decorative ambient blur */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-sky-500/5 blur-3xl pointer-events-none no-print" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b-2 border-slate-300">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border shrink-0 bg-sky-50 border-sky-300 text-sky-700 shadow-2xs">
            <Wallet size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                Proyeksi &amp; Kurva Saldo Kas Bulanan
              </h3>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-sky-100 text-sky-900 border-sky-300">
                {selectedYear === 'all' ? 'Seluruh Tahun' : `Tahun ${selectedYear}`}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Trajektori likuiditas kumulatif dan tren pertumbuhan saldo kas operasional
            </p>
          </div>
        </div>

        {/* View Mode Toggle Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto no-print">
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-300 flex items-center gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('cumulative')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cumulative'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Saldo Kumulatif
            </button>
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'monthly'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Net Bulanan (MoM)
            </button>
          </div>
        </div>
      </div>

      {/* Definisi / Penjelasan Resmi Akuntansi */}
      <div className="mb-5 bg-slate-50 border border-slate-300 rounded-xl p-3.5 flex items-start gap-3">
        <div className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 shrink-0 mt-0.5 shadow-2xs">
          <Info size={16} />
        </div>
        <div className="text-xs leading-relaxed text-slate-700">
          <span className="font-bold text-slate-900 uppercase tracking-wide mr-1">Definisi &amp; Ketentuan:</span>
          Grafik kurva linier <em>(Area &amp; Line Chart)</em> ini menggambarkan trajektori saldo likuiditas kas kumulatif (akumulasi Penerimaan dikurangi Realisasi) sepanjang waktu, memperlihatkan ketahanan finansial, titik puncak saldo, dan proyeksi ketersediaan dana kas operasional.
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 font-mono">
        <div className="p-3 bg-sky-50/70 border border-sky-300 rounded-xl">
          <span className="text-[10px] text-sky-800 font-bold uppercase tracking-wider block font-sans">
            Saldo Akhir Periode
          </span>
          <p className="text-base font-black text-sky-950 mt-0.5">{formatRupiah(currentSaldo)}</p>
          <span className="text-[10px] text-sky-700 font-sans">Posisi kas penutupan</span>
        </div>

        <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl">
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block font-sans">
            Titik Saldo Puncak
          </span>
          <p className="text-base font-black text-emerald-950 mt-0.5">{formatRupiah(peakSaldo.value)}</p>
          <span className="text-[10px] text-emerald-700 font-sans">Tercapai pada: {peakSaldo.month}</span>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-xl">
          <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block font-sans">
            Titik Saldo Terendah
          </span>
          <p className="text-base font-black text-amber-950 mt-0.5">{formatRupiah(lowestSaldo.value)}</p>
          <span className="text-[10px] text-amber-700 font-sans">Terjadi pada: {lowestSaldo.month}</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl">
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block font-sans">
            Rata-rata Saldo Bulanan
          </span>
          <p className="text-base font-black text-slate-900 mt-0.5">{formatRupiah(averageSaldo)}</p>
          <span className="text-[10px] text-slate-500 font-sans">Likuiditas rerata per bulan</span>
        </div>
      </div>

      {/* Recharts Area & Line Chart Container */}
      {chartData.length === 0 ? (
        <div className="p-10 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-500 text-xs italic">
          Belum ada catatan mutasi kas untuk memproyeksikan kurva saldo pada periode ini.
        </div>
      ) : (
        <div className="w-full bg-slate-50/60 p-4 rounded-xl border border-slate-300">
          <div className="w-full" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 25,
                  left: 10,
                  bottom: 10,
                }}
              >
                <defs>
                  {/* Subtle Gradient Glow for Area Fill */}
                  <linearGradient id="saldoAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Gradient for Net Monthly */}
                  <linearGradient id="monthlyNetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                
                <XAxis 
                  dataKey="name" 
                  stroke="#475569" 
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8' }}
                />
                
                <YAxis 
                  stroke="#475569" 
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8' }}
                  tickFormatter={formatCompactRupiah}
                />
                
                {hasNegativeBalance && (
                  <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" strokeWidth={1.5} />
                )}

                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ stroke: '#0284c7', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                />
                
                <Legend 
                  verticalAlign="top" 
                  align="right"
                  wrapperStyle={{ paddingBottom: '16px', fontSize: '12px', fontWeight: 'bold' }}
                />

                {viewMode === 'cumulative' ? (
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    stroke="#0284c7"
                    strokeWidth={3}
                    fill="url(#saldoAreaGradient)"
                    name="Saldo Kas Kumulatif (Rp)"
                    activeDot={{ r: 7, strokeWidth: 3, stroke: '#ffffff', fill: '#0284c7' }}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#ffffff', fill: '#0284c7' }}
                    animationDuration={1000}
                  />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="monthlyNet"
                    stroke="#0d9488"
                    strokeWidth={3}
                    fill="url(#monthlyNetGradient)"
                    name="Surplus / Defisit Bulanan (Rp)"
                    activeDot={{ r: 7, strokeWidth: 3, stroke: '#ffffff', fill: '#0d9488' }}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#ffffff', fill: '#0d9488' }}
                    animationDuration={1000}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Sub-footer insight */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
              <span className="font-semibold text-slate-800">
                Mode Tampilan: {viewMode === 'cumulative' ? 'Saldo Kas Kumulatif Berjalan' : 'Surplus / Defisit Bulanan'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              * Kurva diperhalus secara kontinu (monotone spline)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyLineChart;
