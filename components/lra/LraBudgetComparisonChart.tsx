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
  Cell
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  Percent, 
  Layers, 
  PieChart as PieIcon,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatter';

export interface CategoryComparisonData {
  key: string;
  name: string;
  shortName: string;
  anggaran: number;
  realisasi: number;
  selisih: number;
  persentase: number;
  type: 'pendapatan' | 'sumberdana' | 'belanja';
}

interface LraBudgetComparisonChartProps {
  reportData: {
    sumberdana: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    pendapatan: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    insentif: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    operasional: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    perjalananDinas?: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    beban: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    parhyangan: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    pawongan: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    palemahan: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    belanjaLainnya: { label: string; rows: any[]; totalAnggaran: number; totalRealisasi: number };
    totalBelanjaAnggaran: number;
    totalBelanjaRealisasi: number;
    surplusDefisit: { anggaran: number; realisasi: number };
  };
  periodLabel?: string;
  hideInPrint?: boolean;
  className?: string;
}

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataItem = payload[0]?.payload as CategoryComparisonData;
    const isRevenue = dataItem?.type === 'pendapatan' || dataItem?.type === 'sumberdana';
    const anggaran = dataItem?.anggaran || 0;
    const realisasi = dataItem?.realisasi || 0;
    // Standard Accounting (PSAP 02):
    // Pendapatan/Sumber Dana: Realisasi - Anggaran (Lebih target = +, Kurang = -)
    // Belanja: Anggaran - Realisasi (Sisa pagu = +, Overbudget = -)
    const selisih = isRevenue ? (realisasi - anggaran) : (anggaran - realisasi);
    const persentase = anggaran > 0 ? (realisasi / anggaran) * 100 : (realisasi > 0 ? 100 : 0);
    const isOverbudget = !isRevenue && realisasi > anggaran && anggaran > 0;
    const isRevenueAchieved = isRevenue && realisasi >= anggaran && anggaran > 0;

    return (
      <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-sm min-w-[240px] text-xs">
        <p className="font-black text-sm text-teal-300 pb-1.5 border-b border-slate-700/80 mb-2">
          {dataItem?.name || label}
        </p>
        <div className="space-y-1.5 font-sans">
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block"></span>
              {isRevenue ? 'Target Anggaran:' : 'Pagu Anggaran:'}
            </span>
            <span className="font-bold text-white">{formatCurrency(anggaran)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${isOverbudget ? 'bg-rose-500' : (isRevenue ? 'bg-emerald-500' : 'bg-teal-500')} inline-block`}></span>
              Realisasi:
            </span>
            <span className={`font-bold ${isOverbudget ? 'text-rose-400' : (isRevenue ? 'text-emerald-300' : 'text-teal-300')}`}>
              {formatCurrency(realisasi)}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
            <span>{isRevenue ? 'Selisih Capaian Target:' : 'Sisa Pagu Anggaran:'}</span>
            <span className={`font-bold ${
              selisih > 0 
                ? (isRevenue ? 'text-emerald-400' : 'text-slate-100') 
                : selisih < 0 
                ? (isRevenue ? 'text-amber-400' : 'text-rose-400') 
                : 'text-slate-200'
            }`}>
              {selisih > 0 && isRevenue ? `+${formatCurrency(selisih)}` : formatCurrency(selisih)}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
            <span className="font-semibold">{isRevenue ? 'Capaian Penerimaan:' : 'Persentase Serapan:'}</span>
            <span className={`font-extrabold px-1.5 py-0.5 rounded text-[11px] ${
              isRevenue
                ? (persentase >= 100
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                    : 'bg-amber-900/60 text-amber-300 border border-amber-700')
                : (persentase > 100 
                    ? 'bg-rose-900/60 text-rose-300 border border-rose-700' 
                    : persentase >= 80 
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' 
                    : 'bg-indigo-900/60 text-indigo-300 border border-indigo-700')
            }`}>
              {persentase.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const LraBudgetComparisonChart: React.FC<LraBudgetComparisonChartProps> = ({ 
  reportData,
  periodLabel = 'Periode Terpilih',
  hideInPrint = true,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'pendapatan' | 'belanja' | 'makro' | 'semua'>('makro');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // 0. Data Pos Pendapatan & Sumber Dana
  const revenueCategories = useMemo<CategoryComparisonData[]>(() => {
    const list: CategoryComparisonData[] = [
      {
        key: 'sumberdana',
        name: 'Sumber Dana (Akun 7)',
        shortName: 'Sumber Dana',
        anggaran: reportData.sumberdana.totalAnggaran,
        realisasi: reportData.sumberdana.totalRealisasi,
        selisih: reportData.sumberdana.totalRealisasi - reportData.sumberdana.totalAnggaran,
        persentase: reportData.sumberdana.totalAnggaran > 0 
          ? (reportData.sumberdana.totalRealisasi / reportData.sumberdana.totalAnggaran) * 100 
          : (reportData.sumberdana.totalRealisasi > 0 ? 100 : 0),
        type: 'sumberdana'
      },
      {
        key: 'pendapatan',
        name: 'Pendapatan Asli / Punia (Akun 4)',
        shortName: 'Pendapatan',
        anggaran: reportData.pendapatan.totalAnggaran,
        realisasi: reportData.pendapatan.totalRealisasi,
        selisih: reportData.pendapatan.totalRealisasi - reportData.pendapatan.totalAnggaran,
        persentase: reportData.pendapatan.totalAnggaran > 0 
          ? (reportData.pendapatan.totalRealisasi / reportData.pendapatan.totalAnggaran) * 100 
          : (reportData.pendapatan.totalRealisasi > 0 ? 100 : 0),
        type: 'pendapatan'
      }
    ];

    // Tambahkan item-item individual jika ada
    if (reportData.pendapatan.rows && reportData.pendapatan.rows.length > 0) {
      reportData.pendapatan.rows.forEach(r => {
        if (r.anggaran > 0 || r.realisasi > 0) {
          list.push({
            key: `pendapatan-${r.kode}`,
            name: `${r.kode} - ${r.uraian}`,
            shortName: r.uraian.length > 15 ? `${r.uraian.substring(0, 13)}...` : r.uraian,
            anggaran: r.anggaran,
            realisasi: r.realisasi,
            selisih: r.realisasi - r.anggaran,
            persentase: r.anggaran > 0 ? (r.realisasi / r.anggaran) * 100 : (r.realisasi > 0 ? 100 : 0),
            type: 'pendapatan'
          });
        }
      });
    }

    return list.filter(item => item.anggaran > 0 || item.realisasi > 0);
  }, [reportData]);

  // 1. Data per Kategori Belanja (Sesuai Referensi Rekening constants.tsx)
  const expenseCategories = useMemo<CategoryComparisonData[]>(() => {
    const list: CategoryComparisonData[] = [
      {
        key: 'operasional',
        name: 'Bidang Operasional Adat (5.1.5)',
        shortName: 'Operasional Adat',
        anggaran: reportData.operasional.totalAnggaran,
        realisasi: reportData.operasional.totalRealisasi,
        selisih: reportData.operasional.totalAnggaran - reportData.operasional.totalRealisasi,
        persentase: reportData.operasional.totalAnggaran > 0 
          ? (reportData.operasional.totalRealisasi / reportData.operasional.totalAnggaran) * 100 
          : (reportData.operasional.totalRealisasi > 0 ? 100 : 0),
        type: 'belanja'
      },
      {
        key: 'parhyangan',
        name: 'Bidang Parhyangan (5.2.1)',
        shortName: 'Parhyangan',
        anggaran: reportData.parhyangan.totalAnggaran,
        realisasi: reportData.parhyangan.totalRealisasi,
        selisih: reportData.parhyangan.totalAnggaran - reportData.parhyangan.totalRealisasi,
        persentase: reportData.parhyangan.totalAnggaran > 0 
          ? (reportData.parhyangan.totalRealisasi / reportData.parhyangan.totalAnggaran) * 100 
          : (reportData.parhyangan.totalRealisasi > 0 ? 100 : 0),
        type: 'belanja'
      },
      {
        key: 'pawongan',
        name: 'Bidang Pawongan (5.3.2)',
        shortName: 'Pawongan',
        anggaran: reportData.pawongan.totalAnggaran,
        realisasi: reportData.pawongan.totalRealisasi,
        selisih: reportData.pawongan.totalAnggaran - reportData.pawongan.totalRealisasi,
        persentase: reportData.pawongan.totalAnggaran > 0 
          ? (reportData.pawongan.totalRealisasi / reportData.pawongan.totalAnggaran) * 100 
          : (reportData.pawongan.totalRealisasi > 0 ? 100 : 0),
        type: 'belanja'
      },
      {
        key: 'palemahan',
        name: 'Bidang Palemahan (5.4.1)',
        shortName: 'Palemahan',
        anggaran: reportData.palemahan.totalAnggaran,
        realisasi: reportData.palemahan.totalRealisasi,
        selisih: reportData.palemahan.totalAnggaran - reportData.palemahan.totalRealisasi,
        persentase: reportData.palemahan.totalAnggaran > 0 
          ? (reportData.palemahan.totalRealisasi / reportData.palemahan.totalAnggaran) * 100 
          : (reportData.palemahan.totalRealisasi > 0 ? 100 : 0),
        type: 'belanja'
      }
    ];

    if (reportData.belanjaLainnya.totalRealisasi > 0 || reportData.belanjaLainnya.totalAnggaran > 0) {
      list.push({
        key: 'belanjaLainnya',
        name: 'Belanja Lain-lain (5.x)',
        shortName: 'Lain-lain',
        anggaran: reportData.belanjaLainnya.totalAnggaran,
        realisasi: reportData.belanjaLainnya.totalRealisasi,
        selisih: reportData.belanjaLainnya.totalAnggaran - reportData.belanjaLainnya.totalRealisasi,
        persentase: reportData.belanjaLainnya.totalAnggaran > 0 
          ? (reportData.belanjaLainnya.totalRealisasi / reportData.belanjaLainnya.totalAnggaran) * 100 
          : (reportData.belanjaLainnya.totalRealisasi > 0 ? 100 : 0),
        type: 'belanja'
      });
    }

    return list.filter(item => item.anggaran > 0 || item.realisasi > 0);
  }, [reportData]);

  // 2. Data Makro (Total Penerimaan vs Total Belanja)
  const macroComparisonData = useMemo<CategoryComparisonData[]>(() => {
    const totalPenerimaanAnggaran = reportData.sumberdana.totalAnggaran + reportData.pendapatan.totalAnggaran;
    const totalPenerimaanRealisasi = reportData.sumberdana.totalRealisasi + reportData.pendapatan.totalRealisasi;

    return [
      {
        key: 'sumberdana',
        name: 'Sumber Dana (7.x)',
        shortName: 'Sumber Dana',
        anggaran: reportData.sumberdana.totalAnggaran,
        realisasi: reportData.sumberdana.totalRealisasi,
        selisih: reportData.sumberdana.totalRealisasi - reportData.sumberdana.totalAnggaran,
        persentase: reportData.sumberdana.totalAnggaran > 0 
          ? (reportData.sumberdana.totalRealisasi / reportData.sumberdana.totalAnggaran) * 100 
          : (reportData.sumberdana.totalRealisasi > 0 ? 100 : 0),
        type: 'sumberdana'
      },
      {
        key: 'pendapatan',
        name: 'Pendapatan Asli / Punia (4.x)',
        shortName: 'Pendapatan',
        anggaran: reportData.pendapatan.totalAnggaran,
        realisasi: reportData.pendapatan.totalRealisasi,
        selisih: reportData.pendapatan.totalRealisasi - reportData.pendapatan.totalAnggaran,
        persentase: reportData.pendapatan.totalAnggaran > 0 
          ? (reportData.pendapatan.totalRealisasi / reportData.pendapatan.totalAnggaran) * 100 
          : (reportData.pendapatan.totalRealisasi > 0 ? 100 : 0),
        type: 'pendapatan'
      },
      {
        key: 'totalPenerimaan',
        name: 'Total Penerimaan (Punia + Dana)',
        shortName: 'Tot. Penerimaan',
        anggaran: totalPenerimaanAnggaran,
        realisasi: totalPenerimaanRealisasi,
        selisih: totalPenerimaanRealisasi - totalPenerimaanAnggaran,
        persentase: totalPenerimaanAnggaran > 0 
          ? (totalPenerimaanRealisasi / totalPenerimaanAnggaran) * 100 
          : (totalPenerimaanRealisasi > 0 ? 100 : 0),
        type: 'pendapatan'
      },
      {
        key: 'totalBelanja',
        name: 'Total Belanja Desa (5.x)',
        shortName: 'Tot. Belanja',
        anggaran: reportData.totalBelanjaAnggaran,
        realisasi: reportData.totalBelanjaRealisasi,
        selisih: reportData.totalBelanjaAnggaran - reportData.totalBelanjaRealisasi,
        persentase: reportData.totalBelanjaAnggaran > 0 
          ? (reportData.totalBelanjaRealisasi / reportData.totalBelanjaAnggaran) * 100 
          : (reportData.totalBelanjaRealisasi > 0 ? 100 : 0),
        type: 'belanja'
      }
    ];
  }, [reportData]);

  // 3. Gabungan Semua Kategori
  const allCategoriesData = useMemo<CategoryComparisonData[]>(() => {
    return [
      {
        key: 'sumberdana',
        name: 'Sumber Dana',
        shortName: 'Sumber Dana',
        anggaran: reportData.sumberdana.totalAnggaran,
        realisasi: reportData.sumberdana.totalRealisasi,
        selisih: reportData.sumberdana.totalRealisasi - reportData.sumberdana.totalAnggaran,
        persentase: reportData.sumberdana.totalAnggaran > 0 
          ? (reportData.sumberdana.totalRealisasi / reportData.sumberdana.totalAnggaran) * 100 
          : (reportData.sumberdana.totalRealisasi > 0 ? 100 : 0),
        type: 'sumberdana'
      },
      {
        key: 'pendapatan',
        name: 'Pendapatan',
        shortName: 'Pendapatan',
        anggaran: reportData.pendapatan.totalAnggaran,
        realisasi: reportData.pendapatan.totalRealisasi,
        selisih: reportData.pendapatan.totalRealisasi - reportData.pendapatan.totalAnggaran,
        persentase: reportData.pendapatan.totalAnggaran > 0 
          ? (reportData.pendapatan.totalRealisasi / reportData.pendapatan.totalAnggaran) * 100 
          : (reportData.pendapatan.totalRealisasi > 0 ? 100 : 0),
        type: 'pendapatan'
      },
      ...expenseCategories
    ].filter(item => item.anggaran > 0 || item.realisasi > 0);
  }, [reportData, expenseCategories]);

  const currentChartData = useMemo(() => {
    switch (activeTab) {
      case 'pendapatan': return revenueCategories;
      case 'makro': return macroComparisonData;
      case 'semua': return allCategoriesData;
      case 'belanja':
      default:
        return expenseCategories;
    }
  }, [activeTab, revenueCategories, macroComparisonData, allCategoriesData, expenseCategories]);

  // Overall calculations for metrics
  const totalBelanjaAnggaran = reportData.totalBelanjaAnggaran;
  const totalBelanjaRealisasi = reportData.totalBelanjaRealisasi;
  const persentaseSerapanTotal = totalBelanjaAnggaran > 0 
    ? (totalBelanjaRealisasi / totalBelanjaAnggaran) * 100 
    : (totalBelanjaRealisasi > 0 ? 100 : 0);
  const sisaPaguBelanja = totalBelanjaAnggaran - totalBelanjaRealisasi;

  const totalPenerimaanAnggaran = reportData.sumberdana.totalAnggaran + reportData.pendapatan.totalAnggaran;
  const totalPenerimaanRealisasi = reportData.sumberdana.totalRealisasi + reportData.pendapatan.totalRealisasi;
  const persentasePenerimaanTotal = totalPenerimaanAnggaran > 0 
    ? (totalPenerimaanRealisasi / totalPenerimaanAnggaran) * 100 
    : (totalPenerimaanRealisasi > 0 ? 100 : 0);
  const selisihPenerimaan = totalPenerimaanRealisasi - totalPenerimaanAnggaran;

  return (
    <div className={`${hideInPrint ? 'no-print' : 'lra-chart-printable block'} bg-slate-300/20 border border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all duration-300 text-slate-100 mb-6 ${className}`}>
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-700/70">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30 shrink-0">
            <BarChart3 size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-gray-900">
                Visualisasi Anggaran vs Realisasi (LRA)
              </h3>
              <span className="bg-teal-950/80 text-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-600/50">
                Live Serapan
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Analisis persentase serapan pagu anggaran dan capaian realisasi keuangan • {periodLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto no-print">
          {/* Tab Selector */}
          <div className="inline-flex p-1 bg-slate-500 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('makro')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'makro'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Makro LRA
            </button>
            <button
              onClick={() => setActiveTab('pendapatan')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'pendapatan'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Penerimaan / Punia
            </button>
            <button
              onClick={() => setActiveTab('belanja')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'belanja'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Pos Belanja
            </button>
            <button
              onClick={() => setActiveTab('semua')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'semua'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Semua Pos
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors"
            title={isExpanded ? 'Sembunyikan Diagram' : 'Tampilkan Diagram'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* KPI Highlight Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-4">
        {/* Card 1: Total Serapan Belanja */}
        <div className="bg-slate-300/20 border border-slate-700/80 rounded-xl p-3.5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block">
                Total Serapan Belanja
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-teal-600">
                  {persentaseSerapanTotal.toFixed(1)}%
                </span>
                <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                  persentaseSerapanTotal > 100 ? 'text-rose-400' : 'text-teal-400'
                }`}>
                  {persentaseSerapanTotal > 100 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                  {persentaseSerapanTotal > 100 ? 'Overbudget' : 'Terserap'}
                </span>
              </div>
            </div>
            <div className="p-2 bg-indigo-500/20 text-indigo-800 rounded-lg border border-indigo-500/30">
              <Percent size={18} />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full bg-slate-700/70 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  persentaseSerapanTotal > 100 ? 'bg-rose-500' : persentaseSerapanTotal >= 80 ? 'bg-teal-400' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(persentaseSerapanTotal, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-800 mt-1.5 font-sans">
              <span>Realisasi: <strong className="text-teal-700">{formatCurrency(totalBelanjaRealisasi)}</strong></span>
              <span>Pagu: <strong className="text-teal-700">{formatCurrency(totalBelanjaAnggaran)}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: Sisa Pagu Belanja */}
        <div className="bg-emerald-800/30 border border-emerald-700/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                Sisa Pagu Anggaran Belanja
              </span>
              <span className={`text-xl sm:text-2xl font-black block mt-1 ${
                sisaPaguBelanja < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {formatCurrency(sisaPaguBelanja)}
              </span>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/30">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="text-[11px] text-slate-800 mt-2 font-sans">
            {sisaPaguBelanja >= 0 
              ? '✅ Sisa dana anggaran masih tersedia untuk operasional & upakara.' 
              : '⚠️ Realisasi belanja telah melampaui pagu anggaran yang direncanakan.'}
          </p>
        </div>

        {/* Card 3: Capaian Penerimaan */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Capaian Penerimaan / Punia
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-emerald-200">
                  {persentasePenerimaanTotal.toFixed(1)}%
                </span>
                <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                  selisihPenerimaan >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {selisihPenerimaan >= 0 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {selisihPenerimaan >= 0 
                    ? `+${formatCurrency(selisihPenerimaan)}` 
                    : `${formatCurrency(selisihPenerimaan)}`}
                </span>
              </div>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-200 rounded-lg border border-emerald-500/10">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-100 mt-2 pt-2 border-t border-slate-200 font-sans">
            <span>Realisasi: <strong className="text-amber-300">{formatCurrency(totalPenerimaanRealisasi)}</strong></span>
            <span>Target: <strong className="text-slate-200">{formatCurrency(totalPenerimaanAnggaran)}</strong></span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Main Bar Chart Container */}
          <div className="bg-white rounded-xl p-4 border border-slate-700/60 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Grafik Batang Perbandingan
                </span>
                <span className="text-[11px] text-slate-600">
                  ({currentChartData.length} Pos Teridentifikasi)
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-indigo-500 rounded-sm"></div>
                  <span className="text-slate-600">Anggaran (Pagu)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-teal-500 rounded-sm"></div>
                  <span className="text-slate-600">Realisasi (LRA)</span>
                </div>
              </div>
            </div>

            {currentChartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
                <Info size={36} className="text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Belum ada data anggaran atau realisasi untuk ditampilkan.</p>
                <p className="text-xs text-slate-500 mt-1">Pastikan Anda telah mengisi rencana pagu di menu Anggaran dan transaksi di Jurnal Umum.</p>
              </div>
            ) : (
              <div className="w-full h-80 sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentChartData}
                    margin={{
                      top: 15,
                      right: 15,
                      left: 15,
                      bottom: 45,
                    }}
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                    <XAxis 
                      dataKey="shortName" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      interval={0}
                      tick={{ fill: '#0a3b76', fontWeight: 600 }}
                      angle={-20}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis 
                      stroke="#2d3f59" 
                      fontSize={11}
                      tick={{ fill: '#94a3b8' }}
                      tickFormatter={(value) => {
                        if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}M`;
                        if (value >= 1000000) return `${(value / 1000000).toFixed(0)}jt`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
                        return `${value}`;
                      }}
                    />
                    <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(51, 65, 85, 0.4)' }} />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      wrapperStyle={{ fontSize: '12px', color: '#6c89ac' }}
                    />
                    <Bar 
                      dataKey="anggaran" 
                      name="Pagu Anggaran" 
                      fill="#6366F1" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={48}
                    />
                    <Bar 
                      dataKey="realisasi" 
                      name="Realisasi Kas" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={48}
                    >
                      {currentChartData.map((entry, index) => {
                        const isRevenue = entry.type === 'pendapatan' || entry.type === 'sumberdana';
                        const isOver = entry.type === 'belanja' && entry.anggaran > 0 && entry.realisasi > entry.anggaran;
                        const isRevenueSurplus = isRevenue && entry.anggaran > 0 && entry.realisasi >= entry.anggaran;
                        
                        let cellColor = '#14B8A6'; // Default teal
                        if (isOver) {
                          cellColor = '#F43F5E'; // Red for overbudget expense
                        } else if (isRevenueSurplus) {
                          cellColor = '#10B981'; // Emerald for achieved revenue target
                        } else if (isRevenue) {
                          cellColor = '#06B6D4'; // Cyan for regular revenue
                        }

                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={cellColor} 
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Serapan Dana Breakdown Badges */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {activeTab === 'pendapatan' 
                  ? 'Rincian Realisasi Penerimaan & Punia' 
                  : activeTab === 'makro' || activeTab === 'semua'
                  ? 'Rincian Kategori Anggaran & Capaian' 
                  : 'Rincian Serapan per Sub-Pos Belanja'}
              </span>
              <span className="text-[11px] text-slate-800">
                Pagu vs Realisasi Aktual
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(activeTab === 'pendapatan' ? revenueCategories : activeTab === 'semua' ? allCategoriesData : expenseCategories).map((cat) => {
                const isRevenue = cat.type === 'pendapatan' || cat.type === 'sumberdana';
                const isOver = !isRevenue && cat.anggaran > 0 && cat.realisasi > cat.anggaran;
                const isRevenueSurplus = isRevenue && cat.anggaran > 0 && cat.realisasi >= cat.anggaran;

                return (
                  <div 
                    key={cat.key} 
                    className="bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-white truncate">
                        {cat.name}
                      </span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                        isRevenue
                          ? (isRevenueSurplus
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800')
                          : (isOver 
                              ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                              : cat.persentase >= 80 
                              ? 'bg-teal-950 text-teal-300 border border-teal-800' 
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800')
                      }`}>
                        {cat.persentase.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isRevenue
                            ? (isRevenueSurplus ? 'bg-emerald-400' : 'bg-cyan-400')
                            : (isOver ? 'bg-rose-500' : cat.persentase >= 80 ? 'bg-teal-400' : 'bg-indigo-500')
                        }`}
                        style={{ width: `${Math.min(cat.persentase, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-200 mt-2 font-sans">
                      <span>Real: <strong className={isRevenue ? 'text-emerald-300' : (isOver ? 'text-rose-400' : 'text-slate-200')}>{formatCurrency(cat.realisasi)}</strong></span>
                      <span>Target: <strong className="text-slate-300">{cat.anggaran > 0 ? formatCurrency(cat.anggaran) : '-'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LraBudgetComparisonChart;
