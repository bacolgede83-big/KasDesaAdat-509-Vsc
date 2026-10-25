import React from 'react';
import { Target, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatter';

interface BudgetEfficiencyCardProps {
  totalExpenseRealization: number;
  totalExpenseBudget: number;
  selectedYear: number | 'all';
  setActivePage?: (page: string) => void;
}

export const BudgetEfficiencyCard: React.FC<BudgetEfficiencyCardProps> = ({
  totalExpenseRealization,
  totalExpenseBudget,
  selectedYear: _selectedYear,
  setActivePage
}) => {
  const hasBudget = totalExpenseBudget > 0;
  const ratio = hasBudget ? (totalExpenseRealization / totalExpenseBudget) * 100 : 0;
  const sisaPagu = totalExpenseBudget - totalExpenseRealization;
  const isOver = hasBudget && totalExpenseRealization > totalExpenseBudget;

  // Tentukan status efisiensi
  let statusBadge = {
    label: 'Efisien',
    bg: 'bg-emerald-200 text-emerald-950 border-emerald-400',
    cardBg: 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500',
    text: 'text-emerald-900',
    iconColor: 'text-emerald-700',
    subText: 'Pengeluaran Terkendali'
  };

  if (!hasBudget) {
    statusBadge = {
      label: 'Tanpa Pagu',
      bg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      cardBg: 'bg-indigo-50/70 border-indigo-200 hover:border-indigo-400',
      text: 'text-indigo-900',
      iconColor: 'text-indigo-700',
      subText: 'Pagu Belum Ditetapkan'
    };
  } else if (isOver) {
    statusBadge = {
      label: 'Melampaui Pagu',
      bg: 'bg-rose-200 text-rose-950 border-rose-400',
      cardBg: 'bg-rose-50/70 border-rose-300 hover:border-rose-500',
      text: 'text-rose-900',
      iconColor: 'text-rose-700',
      subText: 'Melampaui Batas Pagu'
    };
  } else if (ratio > 90) {
    statusBadge = {
      label: 'Mendekati Pagu',
      bg: 'bg-amber-200 text-amber-950 border-amber-400',
      cardBg: 'bg-amber-50/70 border-amber-300 hover:border-amber-500',
      text: 'text-amber-900',
      iconColor: 'text-amber-700',
      subText: 'Optimal / Menjelang Penuh'
    };
  } else if (ratio <= 60) {
    statusBadge = {
      label: 'Sangat Hemat',
      bg: 'bg-teal-200 text-teal-950 border-teal-400',
      cardBg: 'bg-teal-50/70 border-teal-300 hover:border-teal-500',
      text: 'text-teal-900',
      iconColor: 'text-teal-700',
      subText: 'Serapan Hemat & Terkendali'
    };
  }

  const progressPercent = Math.min(100, Math.max(0, ratio));

  return (
    <div
      id="kpi-rasio-efisiensi-anggaran"
      className={`${statusBadge.cardBg} p-4 rounded-xl border-2 transition-all shadow-xs flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${statusBadge.text}`}>
            <Target size={16} className={statusBadge.iconColor} /> Rasio Efisiensi Anggaran
          </span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="my-1">
          <div className="flex items-baseline gap-1.5">
            <p className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${statusBadge.text}`}>
              {hasBudget ? `${ratio.toFixed(1)}%` : totalExpenseRealization > 0 ? '100%' : '0.0%'}
            </p>
            {hasBudget && (
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                / 100% Pagu
              </span>
            )}
          </div>
        </div>

        {/* Progress bar visual efisiensi serapan belanja terhadap pagu */}
        <div className="w-full bg-slate-200/90 rounded-full h-1.5 mt-1.5 mb-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOver
                ? 'bg-rose-600'
                : ratio > 90
                ? 'bg-amber-500'
                : ratio > 60
                ? 'bg-emerald-600'
                : 'bg-teal-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-700 leading-tight">
          {hasBudget ? (
            <>
              Realisasi: <strong className="font-mono text-slate-900">{formatCurrency(totalExpenseRealization)}</strong> dari Pagu <strong className="font-mono text-slate-900">{formatCurrency(totalExpenseBudget)}</strong>
            </>
          ) : (
            <>
              Realisasi Belanja: <strong className="font-mono text-slate-900">{formatCurrency(totalExpenseRealization)}</strong> (Belum ada pagu APB)
            </>
          )}
        </p>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-300/80 flex items-center justify-between text-[10px] font-mono font-semibold">
        <span className="text-slate-600">
          {hasBudget ? (sisaPagu >= 0 ? 'Sisa Pagu' : 'Defisit Pagu') : 'Kelola Pagu'}
        </span>
        {hasBudget ? (
          <span className={`font-bold ${sisaPagu >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
            {formatCurrency(Math.abs(sisaPagu))}
          </span>
        ) : setActivePage ? (
          <button
            type="button"
            onClick={() => setActivePage('Anggaran')}
            className="text-indigo-700 hover:text-indigo-900 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
          >
            <span>Set Pagu</span>
            <ArrowUpRight size={10} />
          </button>
        ) : (
          <span className="text-slate-500">Belum diinput</span>
        )}
      </div>
    </div>
  );
};

export default BudgetEfficiencyCard;
