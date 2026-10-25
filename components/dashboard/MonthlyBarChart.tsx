import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import type { MonthlyData } from '../../types';

interface MonthlyBarChartProps {
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
    const penerimaan = Number(payload.find((p: any) => p.dataKey === 'penerimaan')?.value || 0);
    const realisasi = Number(payload.find((p: any) => p.dataKey === 'realisasi')?.value || 0);
    const net = penerimaan - realisasi;
    const isSurplus = net >= 0;
    const ratio = penerimaan > 0 ? ((realisasi / penerimaan) * 100).toFixed(1) : '-';

    return (
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 min-w-[240px] text-xs font-mono">
        <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-slate-700 text-slate-200">
          <Calendar size={14} className="text-sky-400" />
          <span className="font-bold text-sm text-white font-sans">{label}</span>
        </div>

        <div className="space-y-2">
          {/* Penerimaan */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Penerimaan:</span>
            </div>
            <span className="font-black text-emerald-300">{formatRupiah(penerimaan)}</span>
          </div>

          {/* Realisasi */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-rose-400 font-medium font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>Realisasi:</span>
            </div>
            <span className="font-black text-rose-300">{formatRupiah(realisasi)}</span>
          </div>

          {/* Net Month Surplus/Deficit */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
            <span className="text-slate-400 font-sans">Net Selisih:</span>
            <div className={`flex items-center gap-1 font-black ${isSurplus ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isSurplus ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{isSurplus ? `+${formatRupiah(net)}` : formatRupiah(net)}</span>
            </div>
          </div>

          {/* Ratio */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans pt-1">
            <span>Rasio Realisasi:</span>
            <span className="font-bold text-slate-200 font-mono">{ratio === '-' ? '-' : `${ratio}%`}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ data, selectedYear }) => {
  const [filterActiveMonths, setFilterActiveMonths] = useState<boolean>(false);

  // Filtered data based on toggle
  const displayData = useMemo(() => {
    if (!filterActiveMonths) return data;
    return data.filter(item => item.penerimaan > 0 || item.realisasi > 0);
  }, [data, filterActiveMonths]);

  // Aggregate metrics
  const { totalPenerimaan, totalRealisasi, netSurplus, peakPenerimaan, peakRealisasi } = useMemo(() => {
    let totPen = 0;
    let totReal = 0;
    let maxPen = { month: '-', value: 0 };
    let maxReal = { month: '-', value: 0 };

    data.forEach(d => {
      totPen += Number(d.penerimaan) || 0;
      totReal += Number(d.realisasi) || 0;
      if (d.penerimaan > maxPen.value) {
        maxPen = { month: d.name, value: d.penerimaan };
      }
      if (d.realisasi > maxReal.value) {
        maxReal = { month: d.name, value: d.realisasi };
      }
    });

    return {
      totalPenerimaan: totPen,
      totalRealisasi: totReal,
      netSurplus: totPen - totReal,
      peakPenerimaan: maxPen,
      peakRealisasi: maxReal
    };
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-400 p-6 shadow-xl relative overflow-hidden transition-all text-slate-900">
      {/* Decorative ambient blur */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none no-print" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b-2 border-slate-300">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl border shrink-0 bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                Ringkasan Arus Kas Bulanan (Penerimaan vs Realisasi)
              </h3>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-900 border-emerald-300">
                {selectedYear === 'all' ? 'Seluruh Tahun' : `Tahun ${selectedYear}`}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Grafik perbandingan volume penerimaan dan realisasi belanja per bulan pembukuan
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto no-print">
          <button
            type="button"
            onClick={() => setFilterActiveMonths(!filterActiveMonths)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              filterActiveMonths
                ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            <BarChart3 size={13} />
            <span>{filterActiveMonths ? 'Tampilkan Semua Bulan' : 'Hanya Bulan Bertransaksi'}</span>
          </button>
        </div>
      </div>

      {/* Definisi / Penjelasan Resmi Akuntansi */}
      <div className="mb-5 bg-slate-50 border border-slate-300 rounded-xl p-3.5 flex items-start gap-3">
        <div className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 shrink-0 mt-0.5 shadow-2xs">
          <Info size={16} />
        </div>
        <div className="text-xs leading-relaxed text-slate-700">
          <span className="font-bold text-slate-900 uppercase tracking-wide mr-1">Definisi &amp; Ketentuan:</span>
          Grafik batang <em>(Bar Chart)</em> ini membandingkan volume penerimaan kas masuk (seluruh kredit akun 4.*) dan realisasi pengeluaran beban belanja (seluruh debet akun 5.*) pada setiap bulan transaksi untuk mengevaluasi ritme operasional dan likuiditas periodik.
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 font-mono">
        <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl">
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block font-sans">
            Total Penerimaan
          </span>
          <p className="text-base font-black text-emerald-950 mt-0.5">{formatRupiah(totalPenerimaan)}</p>
          <span className="text-[10px] text-emerald-700 font-sans">Akumulasi pendapatan</span>
        </div>

        <div className="p-3 bg-rose-50/70 border border-rose-300 rounded-xl">
          <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block font-sans">
            Total Realisasi
          </span>
          <p className="text-base font-black text-rose-950 mt-0.5">{formatRupiah(totalRealisasi)}</p>
          <span className="text-[10px] text-rose-700 font-sans">Akumulasi beban belanja</span>
        </div>

        <div className="p-3 bg-sky-50/70 border border-sky-300 rounded-xl">
          <span className="text-[10px] text-sky-800 font-bold uppercase tracking-wider block font-sans">
            Net Surplus / (Defisit)
          </span>
          <p className={`text-base font-black mt-0.5 ${netSurplus >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
            {netSurplus >= 0 ? `+${formatRupiah(netSurplus)}` : formatRupiah(netSurplus)}
          </p>
          <span className="text-[10px] text-sky-700 font-sans">
            {netSurplus >= 0 ? 'Surplus Operasional' : 'Defisit Berjalan'}
          </span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl">
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block font-sans">
            Puncak Penerimaan
          </span>
          <p className="text-base font-black text-slate-900 mt-0.5">{peakPenerimaan.month || '-'}</p>
          <span className="text-[10px] text-slate-500 font-sans">
            {peakPenerimaan.value > 0 ? formatRupiah(peakPenerimaan.value) : 'Belum ada data'}
          </span>
        </div>
      </div>

      {/* Recharts Bar Chart Container */}
      {displayData.length === 0 ? (
        <div className="p-10 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-500 text-xs italic">
          Belum ada catatan penerimaan maupun realisasi belanja pada periode yang dipilih.
        </div>
      ) : (
        <div className="w-full bg-slate-50/60 p-4 rounded-xl border border-slate-300">
          <div className="w-full" style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayData}
                margin={{
                  top: 20,
                  right: 25,
                  left: 10,
                  bottom: 10,
                }}
                barGap={6}
                barCategoryGap="20%"
              >
                <defs>
                  {/* Gradient for Penerimaan (Emerald) */}
                  <linearGradient id="barPenerimaanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
                  </linearGradient>
                  {/* Gradient for Realisasi (Rose) */}
                  <linearGradient id="barRealisasiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d48" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.8} />
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
                
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: 'rgba(148, 163, 184, 0.15)', radius: 6 }} 
                />
                
                <Legend 
                  verticalAlign="top" 
                  align="right"
                  wrapperStyle={{ paddingBottom: '16px', fontSize: '12px', fontWeight: 'bold' }}
                />
                
                <Bar 
                  dataKey="penerimaan" 
                  fill="url(#barPenerimaanGradient)" 
                  name="Penerimaan (Pendapatan)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={45}
                  animationDuration={800}
                />
                
                <Bar 
                  dataKey="realisasi" 
                  fill="url(#barRealisasiGradient)" 
                  name="Realisasi (Belanja)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={45}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Sub-footer summary */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                Hijau: Penerimaan (Akun 4.*)
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                Merah: Realisasi (Akun 5.*)
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              * Nilai pada sumbu Y disingkat dalam Juta (Jt) &amp; Miliar (M)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyBarChart;
