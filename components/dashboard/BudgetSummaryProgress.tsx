import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Layers, 
  Scale, 
  ShieldCheck, 
  ExternalLink,
  Info
} from 'lucide-react';
import type { JuDisplayRow, BudgetItem, ManualBudgetCaps } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { calculateBudgetAndRealization } from '../../utils/budgetCalculations';
import { motion } from 'motion/react';

interface BudgetSummaryProgressProps {
  entries: JuDisplayRow[];
  budgetItems?: BudgetItem[];
  manualBudgetCaps?: ManualBudgetCaps;
  selectedYear: number | 'all';
  setActivePage?: (page: string) => void;
}

export const BudgetSummaryProgress: React.FC<BudgetSummaryProgressProps> = ({
  entries,
  budgetItems = [],
  manualBudgetCaps,
  selectedYear,
  setActivePage
}) => {
  // Calculate real-time financial metrics using Single Source of Truth Engine
  const summary = useMemo(() => {
    return calculateBudgetAndRealization(entries, budgetItems, selectedYear);
  }, [entries, budgetItems, selectedYear]);

  const {
    totalRevenueRealization: totalRevenue,
    totalExpenseRealization: totalExpenses,
    netBalance,
    totalRevenueBudget,
    totalExpenseBudget,
    revenueProgress,
    expenseProgress,
    expenseToRevenueRatio,
    subCategories
  } = summary;

  // Filter sub-pos belanja: hanya tampilkan sub-pos yang memiliki data (realisasi > 0 atau anggaran > 0)
  const activeSubCategories = useMemo(() => {
    return subCategories.filter(cat => cat.anggaran > 0 || Math.abs(cat.realisasi) > 0);
  }, [subCategories]);

  // Determine financial health status
  const isHealthy = netBalance >= 0;
  const isHeavyBurn = expenseToRevenueRatio > 90;
  const periodTitle = selectedYear === 'all' ? 'Seluruh Periode Berjalan' : `Tahun Anggaran ${selectedYear}`;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-400 p-6 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-400">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-300 shadow-sm">
            <Scale size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                Ringkasan Anggaran & Serapan Berjalan
              </h3>
              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Komparasi total pendapatan masuk vs realisasi pengeluaran berjalan • {periodTitle}
            </p>
          </div>
        </div>

        {setActivePage && (
          <div className="flex items-center gap-2 self-start sm:self-auto no-print">
            <button
              onClick={() => setActivePage('Anggaran')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200"
            >
              <span>Kelola Pagu Anggaran</span>
              <ExternalLink size={13} />
            </button>
            <button
              onClick={() => setActivePage('Laporan Pendapatan & Belanja')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold transition-all border border-teal-200"
            >
              <span>Lihat LRA</span>
              <ExternalLink size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Main Dual Progress Bars (Pendapatan vs Belanja) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
        {/* PROGRESS 1: PENDAPATAN BERJALAN */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.2 } }}
          className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-5 rounded-2xl border border-emerald-300/90 shadow-sm flex flex-col justify-between"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors duration-300"></div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-sm">
                  <ArrowUpRight size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  Total Pendapatan Berjalan
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200">
                {totalRevenueBudget > 0 ? `${revenueProgress.toFixed(1)}% Tercapai` : 'Aktual'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight">
                {formatCurrency(totalRevenue)}
              </span>
              {totalRevenueBudget > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                  / Target {formatCurrency(totalRevenueBudget)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3">
            {/* Progress Bar */}
            <div className="w-full bg-emerald-200/60 rounded-full h-3.5 overflow-hidden p-0.5 border border-emerald-300/60">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.max(revenueProgress, totalRevenue > 0 ? 5 : 0), 100)}%` }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 shadow-sm"
              ></motion.div>
            </div>

            <div className="flex justify-between items-center text-xs text-emerald-900 mt-2 font-medium">
              <span>Penerimaan Masuk: <strong>{formatCurrency(totalRevenue)}</strong></span>
              <span>
                {totalRevenueBudget > 0 
                  ? (totalRevenue >= totalRevenueBudget 
                      ? `Melampaui Target: +${formatCurrency(totalRevenue - totalRevenueBudget)}` 
                      : `Sisa Target: ${formatCurrency(totalRevenueBudget - totalRevenue)}`) 
                  : 'Punia & Sumber Dana'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* PROGRESS 2: BELANJA / REALISASI BERJALAN */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.2 } }}
          className="bg-gradient-to-br from-rose-50/70 to-indigo-50/40 p-5 rounded-2xl border border-slate-500/90 shadow-sm flex flex-col justify-between"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors duration-300"></div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-500 text-white rounded-lg shadow-sm">
                  <ArrowDownLeft size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-800">
                  Total Belanja / Realisasi
                </span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                expenseProgress > 100 
                  ? 'bg-rose-100 text-rose-800 border-rose-300' 
                  : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                {totalExpenseBudget > 0 ? `${expenseProgress.toFixed(1)}% Terserap` : 'Aktual'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-2xl sm:text-3xl font-black text-rose-700 font-mono tracking-tight">
                {formatCurrency(totalExpenses)}
              </span>
              {totalExpenseBudget > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                  / Pagu {formatCurrency(totalExpenseBudget)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3">
            {/* Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-300/80">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.max(expenseProgress, totalExpenses > 0 ? 5 : 0), 100)}%` }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                  expenseProgress > 100 
                    ? 'bg-gradient-to-r from-rose-500 to-red-600' 
                    : expenseProgress >= 80 
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                }`}
              ></motion.div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-700 mt-2 font-medium">
              <span>Pengeluaran: <strong>{formatCurrency(totalExpenses)}</strong></span>
              <span>{totalExpenseBudget > 0 ? `Sisa Pagu: ${formatCurrency(totalExpenseBudget - totalExpenses)}` : 'Akun 5.x Operasional'}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* COMBINED RATIO BAR (Rasio Belanja terhadap Pendapatan Real-Time) */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-200 text-white rounded-2xl p-5 shadow-lg border border-slate-800 my-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-teal-400">
                Rasio Serapan Belanja Terhadap Pendapatan Masuk
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isHealthy 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                  : 'bg-rose-950 text-rose-300 border-rose-700'
              }`}>
                {isHealthy ? 'Surplus / Likuid Aman' : 'Defisit Sementara'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Proporsi dana masuk yang telah terpakai untuk seluruh pos operasional dan upakara
            </p>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-teal-300">
              {expenseToRevenueRatio.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-600">terpakai</span>
          </div>
        </div>

        {/* Stacked Visual Bar */}
        <div className="relative w-full bg-slate-800 rounded-full h-4 overflow-hidden border border-slate-700">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(expenseToRevenueRatio, 100)}%` }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className={`h-full transition-all duration-700 ${
              expenseToRevenueRatio > 100 
                ? 'bg-rose-500' 
                : expenseToRevenueRatio > 85 
                ? 'bg-amber-500' 
                : 'bg-teal-500'
            }`}
          >            
          </motion.div>
        </div>

        {/* Summary Metric Footers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800 text-xs">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="text-slate-600">Total Masuk:</span>
            <span className="font-bold text-emerald-400 font-mono">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="text-slate-600">Total Keluar:</span>
            <span className="font-bold text-rose-800 font-mono">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="text-slate-600">Net Surplus / Sisa:</span>
            <span className={`font-black font-mono ${netBalance >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
              {formatCurrency(netBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* SUB-POS BREAKDOWN PROGRESS MINI CARDS */}
      {activeSubCategories.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-slate-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Rincian Serapan per Sub-Pos Belanja
              </span>
            </div>
            <span className="text-[11px] text-slate-900">
              Realisasi Aktual vs Pagu Rencana
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSubCategories.map(cat => (
              <div 
                key={cat.id} 
                className="bg-slate-50 hover:bg-slate-200/80 p-3.5 rounded-xl border border-slate-500/90 transition-all shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-600 block">
                      {cat.code}
                    </span>
                    <span className="font-bold text-xs text-slate-800 truncate block">
                      {cat.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-extrabold font-mono px-1.5 py-0.5 rounded shrink-0 ${
                    cat.isOver 
                      ? 'bg-rose-100 text-rose-900 border border-rose-200' 
                      : cat.persentase >= 80 
                      ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                      : 'bg-teal-100 text-teal-800 border border-teal-200'
                  }`}>
                    {cat.persentase.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Mini Bar */}
                <div className="mt-2.5 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(cat.persentase, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.isOver 
                        ? 'bg-rose-500' 
                        : cat.persentase >= 80 
                        ? 'bg-amber-500' 
                        : 'bg-teal-500'
                    }`}
                  >                  
                  </motion.div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-600 mt-2 font-mono">
                  <span>Real: <strong className={cat.isOver ? 'text-rose-900' : 'text-slate-800'}>{formatCurrency(cat.realisasi)}</strong></span>
                  <span>Pagu: <strong className="text-slate-800">{cat.anggaran > 0 ? formatCurrency(cat.anggaran) : '-'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetSummaryProgress;
