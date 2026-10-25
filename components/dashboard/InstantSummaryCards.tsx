import React from 'react';
import { 
  Wallet, 
  Receipt, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  ChevronRight, 
  Calendar, 
  CheckCircle2,
  Coins,
  Layers,
  Sparkles
} from 'lucide-react';
import type { Transaction } from '../../types';
import { formatDate } from '../../utils/formatter';

interface CashAccountInfo {
  code: string;
  name: string;
  balance: number;
}

interface InstantSummaryCardsProps {
  totalKasHariIni: number;
  todayCashIn: number;
  todayCashOut: number;
  todayTxCount: number;
  todayDate: Date;
  latestTransaction: Transaction | null;
  recentTransactions: Transaction[];
  cashAccounts: CashAccountInfo[];
  setActivePage?: (page: string) => void;
}

const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const InstantSummaryCards: React.FC<InstantSummaryCardsProps> = ({
  totalKasHariIni,
  todayCashIn,
  todayCashOut,
  todayTxCount,
  todayDate,
  latestTransaction,
  recentTransactions = [],
  cashAccounts = [],
  setActivePage,
}) => {
  const formattedToday = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(todayDate);

  // Total nominal dari recent transactions (5 transaksi terakhir)
  const recentTotalAmount = recentTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const recentInCount = recentTransactions.filter(t => t.type === 'Penerimaan' || t.type === 'Pendapatan' || t.type === 'Sumber Dana & Pendapatan').length;
  const recentOutCount = recentTransactions.filter(t => t.type === 'Realisasi' || t.type === 'Belanja').length;

  // Cek apakah transaksi terakhir adalah penerimaan/pemasukan atau pengeluaran
  const isLatestRevenue = latestTransaction
    ? (latestTransaction.type === 'Pendapatan' || latestTransaction.type === 'Penerimaan' || latestTransaction.type === 'Sumber Dana & Pendapatan')
    : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* ========================================================================= */}
      {/* 1. KARTU RINGKASAN: TOTAL KAS HARI INI */}
      {/* ========================================================================= */}
      <div 
        id="card-total-kas-hari-ini"
        className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900 border-2 border-emerald-300 dark:border-emerald-700/80 rounded-2xl p-5 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden group"
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          {/* Header Card */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 shrink-0 group-hover:scale-105 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300 font-mono">
                  Posisi Likuiditas Kas Riil
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Total Kas Hari Ini
                </h4>
              </div>
            </div>

            {/* Status Live Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-[10px] font-bold font-mono shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time</span>
            </div>
          </div>

          {/* Primary Nominal Value */}
          <div className="my-2">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight text-emerald-950 dark:text-emerald-100">
              {formatRupiah(totalKasHariIni)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Per {formattedToday}</span>
            </p>
          </div>

          {/* Mutasi Kas Hari Ini Box */}
          <div className="mt-3 p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-emerald-200 dark:border-emerald-800/70 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Mutasi Hari Ini:
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400">
                {todayTxCount > 0 ? `${todayTxCount} Transaksi` : 'Nihil'}
              </span>
            </div>

            {todayTxCount > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-[9px] block text-emerald-600 font-sans font-semibold">Masuk</span>
                    <span className="font-bold">{formatRupiah(todayCashIn)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-[9px] block text-rose-600 font-sans font-semibold">Keluar</span>
                    <span className="font-bold">{formatRupiah(todayCashOut)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                Belum ada mutasi kas masuk/keluar pada hari ini. Saldo kas aktif tersedia untuk operasional desa adat.
              </p>
            )}

            {/* Quick Cash Accounts Breakdown */}
            {cashAccounts.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Rekening Kas:</span>
                {cashAccounts.slice(0, 3).map((acc) => (
                  <span 
                    key={acc.code} 
                    className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
                    title={`${acc.name}: ${formatRupiah(acc.balance)}`}
                  >
                    <span className="truncate max-w-[110px]">{acc.name.replace('Kas ', '')}:</span>
                    <strong className="text-emerald-700 dark:text-emerald-300">{formatRupiah(acc.balance)}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Link / Action */}
        <div className="mt-4 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-between">
          <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
            Sumber: BKU &amp; Akun 1.1.*
          </span>
          <button
            type="button"
            onClick={() => setActivePage?.('Buku Kas Umum')}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white cursor-pointer group/btn"
          >
            <span>Buka Buku Kas Umum</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KARTU RINGKASAN: TOTAL TRANSAKSI TERAKHIR */}
      {/* ========================================================================= */}
      <div 
        id="card-total-transaksi-terakhir"
        className="bg-gradient-to-br from-indigo-50 via-sky-50/40 to-white dark:from-indigo-950/40 dark:via-sky-950/20 dark:to-slate-900 border-2 border-indigo-300 dark:border-indigo-700/80 rounded-2xl p-5 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden group"
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />

        <div>
          {/* Header Card */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25 shrink-0 group-hover:scale-105 transition-transform">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-800 dark:text-indigo-300 font-mono">
                  Mutasi Aktivitas Terkini
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Total Transaksi Terakhir
                </h4>
              </div>
            </div>

            {/* Badge Tipe Transaksi Terakhir */}
            {latestTransaction ? (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border shrink-0 ${
                isLatestRevenue
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700'
              }`}>
                {isLatestRevenue ? '+ Penerimaan' : '- Pengeluaran'}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 border border-slate-300 dark:border-slate-700">
                Nihil
              </span>
            )}
          </div>

          {/* Primary Nominal Value: Nominal Transaksi Paling Terakhir */}
          <div className="my-2">
            <div className={`text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tight ${
              latestTransaction 
                ? (isLatestRevenue ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-900 dark:text-white')
                : 'text-slate-400 dark:text-slate-500'
            }`}>
              {latestTransaction ? formatRupiah(latestTransaction.amount) : 'Rp 0'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1.5 font-medium truncate">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                {latestTransaction 
                  ? `Transaksi tanggal: ${formatDate(latestTransaction.date)}`
                  : 'Belum ada transaksi terekam'}
              </span>
            </p>
          </div>

          {/* Detail Transaksi Terakhir & Akumulasi Box */}
          <div className="mt-3 p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-indigo-200 dark:border-indigo-800/70 shadow-xs space-y-2">
            {latestTransaction ? (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={latestTransaction.description}>
                  {latestTransaction.description}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span className="truncate max-w-[180px] bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded text-indigo-700 dark:text-indigo-300">
                    {latestTransaction.category}
                  </span>
                  <span className="font-semibold">
                    ID: {latestTransaction.id.replace('-rev', '').replace('-exp', '').slice(0, 10)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Belum ada transaksi di Buku Jurnal atau Buku Kas.
              </p>
            )}

            {/* Batch Rekapitulasi: Akumulasi 5 Transaksi Terakhir */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-600 dark:text-slate-400 font-sans flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Akumulasi {recentTransactions.length} Transaksi Terakhir:</span>
              </span>
              <strong className="text-indigo-900 dark:text-indigo-200 font-bold">
                {formatRupiah(recentTotalAmount)}
              </strong>
            </div>
            {recentTransactions.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{recentInCount} Penerimaan</span>
                <span>•</span>
                <span className="text-rose-700 dark:text-rose-400 font-semibold">{recentOutCount} Pengeluaran</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Link / Action */}
        <div className="mt-4 pt-3 border-t border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-between">
          <span className="text-[11px] font-medium text-indigo-800 dark:text-indigo-300">
            Sumber: Buku Jurnal Umum
          </span>
          <button
            type="button"
            onClick={() => setActivePage?.('Jurnal Umum')}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-800 dark:text-indigo-300 hover:text-indigo-950 dark:hover:text-white cursor-pointer group/btn"
          >
            <span>Buka Jurnal Umum</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstantSummaryCards;
