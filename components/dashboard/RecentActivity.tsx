import React, { useState, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  Calendar, 
  Layers, 
  ChevronRight, 
  ArrowRight,
  Filter,
  Receipt,
  FileText
} from 'lucide-react';
import type { Transaction } from '../../types';
import { formatDate } from '../../utils/formatter';

interface RecentActivityProps {
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

const RecentActivity: React.FC<RecentActivityProps> = ({ transactions = [], setActivePage }) => {
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense'>('all');

  const filteredTransactions = useMemo(() => {
    if (filterType === 'revenue') {
      return transactions.filter(t => t.type === 'Penerimaan' || t.type === 'Pendapatan' || t.type === 'Sumber Dana & Pendapatan');
    }
    if (filterType === 'expense') {
      return transactions.filter(t => t.type === 'Realisasi' || t.type === 'Belanja');
    }
    return transactions;
  }, [transactions, filterType]);

  const displayList = filteredTransactions.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-400 p-6 shadow-xl relative overflow-hidden transition-all text-slate-900 flex flex-col justify-between">
      {/* Decorative ambient blur */}
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none no-print" />

      <div>
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b-2 border-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl border shrink-0 bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs">
              <Clock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                  Aktivitas Terkini
                </h3>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border bg-indigo-100 text-indigo-900 border-indigo-300">
                  {transactions.length} Mutasi
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Kronologi transaksi penerimaan dan pengeluaran kas paling mutakhir
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
                  ? 'bg-indigo-600 text-white shadow-xs'
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
              Penerimaan
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

        {/* List of Recent Transactions */}
        {displayList.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-500 text-xs italic">
            Belum ada catatan mutasi transaksi pada kategori ini.
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayList.map((tx) => {
              const isRevenue = tx.type === 'Penerimaan' || tx.type === 'Pendapatan' || tx.type === 'Sumber Dana & Pendapatan';

              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl border border-slate-300 bg-slate-50/70 hover:bg-white hover:border-slate-400 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Direction Icon Badge */}
                    <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                      isRevenue 
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                        : 'bg-rose-50 border-rose-300 text-rose-700'
                    }`}>
                      {isRevenue ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-900 leading-snug line-clamp-1" title={tx.description}>
                        {tx.description || 'Transaksi Tanpa Uraian'}
                      </p>
                      
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
                  <div className="text-left sm:text-right shrink-0 font-mono">
                    <span className={`text-xs font-black tracking-tight ${
                      isRevenue ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {isRevenue ? `+${formatRupiah(tx.amount)}` : `-${formatRupiah(tx.amount)}`}
                    </span>
                    <span className="text-[10px] text-slate-500 block uppercase font-sans font-medium">
                      {isRevenue ? 'Masuk' : 'Keluar'}
                    </span>
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
            Menampilkan 5 mutasi paling mutakhir
          </span>
          <button
            type="button"
            onClick={() => setActivePage('Buku Kas Umum')}
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Buka Buku Kas Umum</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
