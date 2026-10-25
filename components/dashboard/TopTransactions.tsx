import React, { useState, useMemo } from 'react';
import { 
  Award, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ChevronRight, 
  Crown, 
  Medal, 
  Layers,
  Sparkles
} from 'lucide-react';
import type { Transaction } from '../../types';
import { formatDate } from '../../utils/formatter';

interface TopTransactionsProps {
  transactions: Transaction[];
  setActivePage?: (page: string) => void;
}

const formatRupiah = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const TopTransactions: React.FC<TopTransactionsProps> = ({ transactions = [], setActivePage }) => {
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense'>('all');

  const filteredTransactions = useMemo(() => {
    let list = [...transactions];
    if (filterType === 'revenue') {
      list = list.filter(t => t.type === 'Penerimaan' || t.type === 'Pendapatan' || t.type === 'Sumber Dana & Pendapatan');
    } else if (filterType === 'expense') {
      list = list.filter(t => t.type === 'Realisasi' || t.type === 'Belanja');
    }
    return list.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 5);
  }, [transactions, filterType]);

  const maxAmount = useMemo(() => {
    if (filteredTransactions.length === 0) return 1;
    return Math.max(...filteredTransactions.map(t => Number(t.amount) || 0));
  }, [filteredTransactions]);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-7 h-7 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-900 flex items-center justify-center font-black text-xs shadow-xs shrink-0 relative">
          <Crown size={12} className="absolute -top-1.5 -right-1 text-amber-600 fill-amber-500" />
          <span>1</span>
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-7 h-7 rounded-xl bg-slate-200 border-2 border-slate-400 text-slate-900 flex items-center justify-center font-black text-xs shadow-xs shrink-0">
          <span>2</span>
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-7 h-7 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-800 flex items-center justify-center font-black text-xs shadow-xs shrink-0">
          <span>3</span>
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-xl bg-slate-100 border border-slate-300 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
        <span>{index + 1}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-400 p-6 shadow-xl relative overflow-hidden transition-all text-slate-900 flex flex-col justify-between">
      {/* Decorative ambient blur */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none no-print" />

      <div>
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border shrink-0 bg-amber-50 border-amber-300 text-amber-700 shadow-2xs">
              <Award size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                  Top 5 Transaksi Terbesar
                </h3>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-amber-100 text-amber-900 border-amber-300">
                  Peringkat Nominal
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Daftar transaksi dengan dampak nilai perputaran kas paling signifikan
              </p>
            </div>
          </div>

          {/* Filter Type Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs font-bold no-print">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterType('revenue')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterType === 'revenue'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Pendapatan
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expense')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                filterType === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Belanja
            </button>
          </div>
        </div>

        {/* Top Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-500 text-xs italic">
            Belum ada catatan transaksi pada filter yang dipilih.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map((tx, idx) => {
              const isRevenue = tx.type === 'Penerimaan' || tx.type === 'Pendapatan' || tx.type === 'Sumber Dana & Pendapatan';
              const percentOfMax = maxAmount > 0 ? (Number(tx.amount) / maxAmount) * 100 : 0;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/70 hover:bg-white hover:border-slate-400 hover:shadow-xs transition-all flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {getRankBadge(idx)}

                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-black text-slate-900 leading-snug line-clamp-1" title={tx.description}>
                          {tx.description || 'Transaksi Tanpa Uraian'}
                        </h5>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                            <Calendar size={11} className="text-slate-400" />
                            {formatDate(tx.date) || '-'}
                          </span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${
                            isRevenue 
                              ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300' 
                              : 'bg-rose-100/70 text-rose-900 border-rose-300'
                          }`}>
                            {tx.category || (isRevenue ? 'Pendapatan' : 'Belanja')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Amount Display */}
                    <div className="text-right shrink-0 font-mono">
                      <span className={`text-sm font-black tracking-tight ${
                        isRevenue ? 'text-emerald-800' : 'text-rose-800'
                      }`}>
                        {formatRupiah(tx.amount)}
                      </span>
                      <span className="text-[10px] text-slate-500 block uppercase font-sans font-medium">
                        {isRevenue ? 'Penerimaan' : 'Realisasi'}
                      </span>
                    </div>
                  </div>

                  {/* Relative Proportion Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden border border-slate-300">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isRevenue ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                      style={{ width: `${Math.max(5, percentOfMax)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Navigation Link */}
      {setActivePage && (
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between no-print">
          <span className="text-[11px] text-slate-500 font-mono">
            Peringkat 5 transaksi dengan nilai tertinggi
          </span>
          <button
            type="button"
            onClick={() => setActivePage('Jurnal Umum')}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Buka Jurnal Umum</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TopTransactions;
