import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Scale, 
  Search, 
  X, 
  ArrowRight, 
  Coins, 
  Building2, 
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  FileText
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatter';

export interface DebtTransactionDetail {
  idTransaksi: string;
  date: string;
  uraian: string;
  creditor?: string;
  opposingAccount?: string;
  nominal: number;
  totalKredit: number;
  totalDebet: number;
  sisa: number;
}

export interface DebtItem {
  code: string;
  name: string;
  totalKredit: number; // Timbul Hutang
  totalDebet: number;  // Pelunasan Hutang
  sisaHutang: number;  // Saldo Sisa Hutang (Kredit - Debet)
  txCount: number;
  lastDate?: string;
  primaryCreditor?: string;
  allCreditors: string[];
  recentDescriptions: string[];
  transactions?: DebtTransactionDetail[];
}

interface DebtRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: DebtItem[];
  totalSisaHutang: number;
  totalPenambahanHutang: number;
  totalPelunasanHutang: number;
  onSelectPayDebt: (debt: DebtItem, txDetail?: DebtTransactionDetail) => void;
}

export const DebtRecapModal: React.FC<DebtRecapModalProps> = ({
  isOpen,
  onClose,
  debts = [],
  totalSisaHutang = 0,
  totalPenambahanHutang = 0,
  totalPelunasanHutang = 0,
  onSelectPayDebt,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'outstanding' | 'settled'>('outstanding');
  const [sortBy, setSortBy] = useState<'sisa-desc' | 'sisa-asc' | 'name-asc' | 'timbul-desc'>('sisa-desc');
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const safeDebts = Array.isArray(debts) ? debts : [];

  const tingkatPelunasan = useMemo(() => {
    if (totalPenambahanHutang <= 0) return 100;
    return Math.min(100, (totalPelunasanHutang / totalPenambahanHutang) * 100);
  }, [totalPelunasanHutang, totalPenambahanHutang]);

  const filteredDebts = useMemo(() => {
    return safeDebts
      .filter((item) => {
        if (filterMode === 'outstanding' && item.sisaHutang <= 0) return false;
        if (filterMode === 'settled' && item.sisaHutang > 0) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchCode = (item.code || '').toLowerCase().includes(q);
          const matchName = (item.name || '').toLowerCase().includes(q);
          const matchCreditor = (item.allCreditors || []).some((c) => (c || '').toLowerCase().includes(q));
          const matchDesc = (item.recentDescriptions || []).some((d) => (d || '').toLowerCase().includes(q));
          return matchCode || matchName || matchCreditor || matchDesc;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'sisa-desc') return b.sisaHutang - a.sisaHutang || b.totalKredit - a.totalKredit;
        if (sortBy === 'sisa-asc') return a.sisaHutang - b.sisaHutang;
        if (sortBy === 'timbul-desc') return b.totalKredit - a.totalKredit;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [safeDebts, filterMode, searchTerm, sortBy]);

  const activeCount = useMemo(() => safeDebts.filter((d) => d.sisaHutang > 0).length, [safeDebts]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 my-auto overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-300 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden relative text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-5 border-b-2 border-purple-200 bg-gradient-to-r from-purple-50 via-slate-50 to-purple-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 text-white rounded-xl shadow-md shrink-0">
              <Receipt size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-wide text-purple-950 font-serif">
                  Rekapan &amp; Pelunasan Hutang
                </h3>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                  {activeCount > 0 ? `${activeCount} Pos Terutang` : 'Semua Lunas'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Pilih pos hutang yang akan dilunasi. Form jurnal umum akan otomatis terisi dengan pos debet akun kewajiban.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Tutup Rekapan"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* KPI SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Sisa Hutang Berjalan */}
            <div className="p-4 rounded-xl border-2 border-purple-400 bg-purple-50/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-purple-900 uppercase">
                  <span className="flex items-center gap-1.5">
                    <Receipt size={14} className="text-purple-700" /> Sisa Hutang
                  </span>
                  <span className="text-[10px] bg-purple-200/80 px-1.5 py-0.5 rounded font-mono">Saldo</span>
                </div>
                <p className="text-2xl font-black font-mono text-purple-950 tracking-tight my-1">
                  {formatCurrency(totalSisaHutang)}
                </p>
                <p className="text-[11px] text-purple-800">
                  {totalSisaHutang > 0 ? 'Total sisa kewajiban yang harus dibayar' : 'Semua kewajiban telah lunas'}
                </p>
              </div>
            </div>

            {/* Total Timbul Hutang */}
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 uppercase">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight size={14} className="text-amber-700" /> Timbul Hutang
                  </span>
                  <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded font-mono">Kredit (2.*)</span>
                </div>
                <p className="text-2xl font-black font-mono text-amber-950 tracking-tight my-1">
                  {formatCurrency(totalPenambahanHutang)}
                </p>
                <p className="text-[11px] text-amber-800">
                  Akumulasi nilai nota/kewajiban yang tercatat
                </p>
              </div>
            </div>

            {/* Telah Dilunasi */}
            <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 uppercase">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft size={14} className="text-emerald-700" /> Telah Dilunasi
                  </span>
                  <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded font-mono">Debet (2.*)</span>
                </div>
                <p className="text-2xl font-black font-mono text-emerald-950 tracking-tight my-1">
                  {formatCurrency(totalPelunasanHutang)}
                </p>
                <p className="text-[11px] text-emerald-800">
                  Total pembayaran yang telah dibukukan
                </p>
              </div>
            </div>

            {/* Rasio Pelunasan */}
            <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 uppercase">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" /> Rasio Lunas
                  </span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-mono">
                    {tingkatPelunasan.toFixed(0)}%
                  </span>
                </div>
                <p className="text-2xl font-black font-mono text-slate-900 tracking-tight my-1">
                  {tingkatPelunasan.toFixed(1)}%
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden border border-slate-300">
                  <div
                    className={`h-full transition-all duration-500 ${
                      tingkatPelunasan >= 100 ? 'bg-emerald-500' : 'bg-purple-600'
                    }`}
                    style={{ width: `${tingkatPelunasan}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH, FILTER & SORT BAR */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kode akun, nama pos hutang, rekanan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode('outstanding')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-all cursor-pointer ${
                    filterMode === 'outstanding'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sisa Hutang ({debts.filter((d) => d.sisaHutang > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua ({debts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('settled')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-all cursor-pointer ${
                    filterMode === 'settled'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lunas ({debts.filter((d) => d.sisaHutang <= 0).length})
                </button>
              </div>

              {/* Sort selector */}
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
              >
                <option value="sisa-desc">Sisa Terbesar</option>
                <option value="sisa-asc">Sisa Terkecil</option>
                <option value="timbul-desc">Hutang Terbesar</option>
                <option value="name-asc">Nama Akun (A-Z)</option>
              </select>
            </div>
          </div>

          {/* LIST OF DEBT ITEMS */}
          <div className="space-y-3">
            {filteredDebts.length === 0 ? (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-bold text-slate-800">
                  {filterMode === 'outstanding'
                    ? 'Tidak ada pos hutang yang masih tersisa!'
                    : 'Tidak ada pos hutang yang sesuai dengan kriteria pencarian.'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Seluruh kewajiban desa adat telah terselesaikan dengan baik.
                </p>
              </div>
            ) : (
              filteredDebts.map((item) => {
                const isLunas = item.sisaHutang <= 0;
                const itemProgress = item.totalKredit > 0 ? Math.min(100, (item.totalDebet / item.totalKredit) * 100) : 100;
                const hasTransactions = (item.transactions && item.transactions.length > 0) || item.recentDescriptions.length > 0;
                const isExpanded = expandedCodes.has(item.code) || (!isLunas && filteredDebts.length === 1);

                return (
                  <div
                    key={item.code}
                    className={`rounded-2xl border-2 transition-all shadow-2xs overflow-hidden ${
                      isLunas
                        ? 'bg-slate-50 border-slate-200 opacity-80'
                        : 'bg-white border-purple-300 hover:border-purple-600 hover:shadow-md'
                    }`}
                  >
                    {/* Main Card Header */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-300">
                            {item.code}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {item.name}
                          </h4>
                          {isLunas && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Lunas
                            </span>
                          )}
                        </div>

                        {/* Creditor / Description Tags */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
                          {item.primaryCreditor && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              👤 Rekanan: <strong>{item.primaryCreditor}</strong>
                            </span>
                          )}
                          {item.lastDate && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                              <Calendar size={11} /> Terakhir: {formatDate(item.lastDate)}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            ({item.txCount} transaksi jurnal)
                          </span>
                        </div>

                        {/* Small progress bar */}
                        <div className="mt-2.5 flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 max-w-xs">
                            <div
                              className={`h-full transition-all duration-300 ${isLunas ? 'bg-emerald-500' : 'bg-purple-600'}`}
                              style={{ width: `${itemProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-600">
                            {itemProgress.toFixed(0)}% terbayar
                          </span>
                        </div>
                      </div>

                      {/* Middle Financial Stats */}
                      <div className="flex items-center gap-4 text-xs font-mono shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Timbul:</span>
                          <span className="font-bold text-amber-900">{formatCurrency(item.totalKredit)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Sudah Dibayar:</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(item.totalDebet)}</span>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 p-2 rounded-lg text-right min-w-[120px]">
                          <span className="text-[10px] font-bold text-purple-900 uppercase block">Sisa Hutang:</span>
                          <span className="text-sm font-black text-purple-950">{formatCurrency(item.sisaHutang)}</span>
                        </div>
                      </div>

                      {/* Right Pay Action Button & Toggle */}
                      <div className="shrink-0 flex items-center gap-2 justify-end">
                        {hasTransactions && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.code)}
                            className="px-2.5 py-2 bg-slate-100 hover:bg-purple-100 text-purple-900 font-bold rounded-xl text-xs flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
                            title="Tampilkan rincian transaksi nota hutang"
                          >
                            <FileText size={14} className="text-purple-700" />
                            <span className="hidden sm:inline text-[11px]">Rincian</span>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        {isLunas ? (
                          <button
                            type="button"
                            disabled
                            className="px-4 py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-not-allowed border border-slate-200"
                          >
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span>Lunas</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectPayDebt(item)}
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-600 hover:to-purple-700 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer border border-purple-600"
                            title={`Bayar sisa hutang ${item.name} (${formatCurrency(item.sisaHutang)})`}
                          >
                            <CreditCard size={15} />
                            <span>Bayar Hutang</span>
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Section: Rincian Transaksi / Nota Terutang */}
                    {isExpanded && (
                      <div className="bg-slate-50/90 border-t border-purple-200 p-3.5 sm:p-4 space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs text-purple-950 font-bold">
                          <span className="flex items-center gap-1.5">
                            <FileText size={14} className="text-purple-700" />
                            <span>Rincian Nota & Transaksi Terutang:</span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            Klik pada baris rincian atau tombol bayar untuk melunasi nota spesifik
                          </span>
                        </div>

                        {item.transactions && item.transactions.length > 0 ? (
                          <div className="space-y-2">
                            {item.transactions.map((tx, idx) => {
                              const isTxLunas = tx.sisa <= 0;
                              return (
                                <div
                                  key={tx.idTransaksi || idx}
                                  onClick={() => !isTxLunas && onSelectPayDebt(item, tx)}
                                  className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                                    isTxLunas
                                      ? 'bg-white border-slate-200 opacity-70'
                                      : 'bg-white border-purple-200 hover:border-purple-400 hover:shadow-xs cursor-pointer'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {tx.idTransaksi}
                                      </span>
                                      {tx.date && (
                                        <span className="text-[11px] text-slate-500 font-medium">
                                          {formatDate(tx.date)}
                                        </span>
                                      )}
                                      {tx.creditor && (
                                        <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                          👤 {tx.creditor}
                                        </span>
                                      )}
                                      {isTxLunas && (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                          Lunas
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-slate-800 font-semibold truncate text-[11px]">
                                      {tx.uraian || item.name}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-3 font-mono shrink-0 justify-between sm:justify-end">
                                    <div className="text-right">
                                      <div className="text-[10px] text-slate-500">Nominal Nota:</div>
                                      <div className="font-bold text-slate-900">{formatCurrency(tx.totalKredit || tx.nominal)}</div>
                                    </div>
                                    <div className="text-right pl-2 border-l border-slate-200">
                                      <div className="text-[10px] text-purple-700 font-bold">Sisa:</div>
                                      <div className="font-black text-purple-950">{formatCurrency(tx.sisa)}</div>
                                    </div>

                                    {!isTxLunas && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectPayDebt(item, tx);
                                        }}
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95"
                                        title={`Bayar nota ${tx.idTransaksi}`}
                                      >
                                        <span>Bayar</span>
                                        <ArrowRight size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {item.recentDescriptions.map((desc, idx) => (
                              <div
                                key={idx}
                                onClick={() => onSelectPayDebt(item, {
                                  idTransaksi: `HUTANG-${item.code}`,
                                  date: item.lastDate || new Date().toISOString().split('T')[0],
                                  uraian: desc,
                                  creditor: item.primaryCreditor,
                                  nominal: item.sisaHutang,
                                  totalKredit: item.totalKredit,
                                  totalDebet: item.totalDebet,
                                  sisa: item.sisaHutang
                                })}
                                className="p-2.5 rounded-xl border border-purple-200 bg-white hover:border-purple-400 hover:bg-purple-50/50 flex items-center justify-between gap-2 text-xs cursor-pointer transition-all"
                              >
                                <span className="text-slate-700 font-medium truncate flex-1">
                                  📝 {desc}
                                </span>
                                <span className="text-purple-700 font-bold text-[11px] shrink-0 flex items-center gap-1">
                                  <span>Bayar Sisa (Rp {formatCurrency(item.sisaHutang)})</span>
                                  <ArrowRight size={12} />
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t-2 border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Info size={14} className="text-purple-600 shrink-0" />
            <span>
              Pelunasan dicatat dengan akun debet pos hutang dan akun kredit kas/bank sumber dana.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebtRecapModal;
