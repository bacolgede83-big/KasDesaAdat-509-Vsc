import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, ArrowRight, Wallet, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../../utils/formatter';

export interface RecommendedAccount {
  code: string;
  name: string;
  desc?: string;
  isLpd?: boolean;
}

export interface RekomendasiConfig {
  kreditCode: string;
  kreditName: string;
  badgeLabel: string;
  badgeClass: string;
  description: string;
  accounts: RecommendedAccount[];
}

export const HIBAH_RECOMMENDATIONS: Record<string, RekomendasiConfig> = {
  '4.1.3.01': {
    kreditCode: '4.1.3.01',
    kreditName: 'Pendapatan Hibah Provinsi',
    badgeLabel: 'Hibah Provinsi',
    badgeClass: 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    description: 'Pilih rekening kas penerima dana Bantuan Keuangan Khusus (BKK) Pemprov Bali:',
    accounts: [
      { code: '1.1.2.02', name: 'Kas Hibah Prov(LPD)', desc: 'Rekening Giro/Simpanan Hibah di LPD', isLpd: true },
      { code: '1.1.2.04', name: 'Kas JuruRaksa(HibProv)', desc: 'Kas Tunai Pengelola Hibah Provinsi' },
      { code: '1.1.1.02', name: 'Kas Juru Raksa(DesaAdat)', desc: 'Kas Operasional Juru Raksa Desa' },
      { code: '1.1.1.01', name: 'Kas Desa Adat', desc: 'Kas Kasir / Bendahara Desa Adat' },
    ],
  },
  '4.1.3.02': {
    kreditCode: '4.1.3.02',
    kreditName: 'Pendapatan Hibah Kabupaten',
    badgeLabel: 'Hibah Kabupaten',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    description: 'Pilih rekening kas penerima dana Hibah Pemerintah Kabupaten:',
    accounts: [
      { code: '1.1.2.03', name: 'Kas Hibah Kab(LPD)', desc: 'Rekening Giro/Simpanan Hibah di LPD', isLpd: true },
      { code: '1.1.1.02', name: 'Kas Juru Raksa(DesaAdat)', desc: 'Kas Operasional Juru Raksa Desa' },
      { code: '1.1.1.01', name: 'Kas Desa Adat', desc: 'Kas Kasir / Bendahara Desa Adat' },
    ],
  },
};

interface RekomendasiAkunDebetProps {
  idPrefix?: string;
  kreditCode: string;
  selectedDebetCode: string;
  onSelectDebet: (code: string, name: string) => void;
  cashBalances?: Record<string, { code: string; name: string; balance: number }>;
}

export const RekomendasiAkunDebet: React.FC<RekomendasiAkunDebetProps> = ({
  idPrefix = 'rekomendasi-debet',
  kreditCode,
  selectedDebetCode,
  onSelectDebet,
  cashBalances,
}) => {
  const cleanKredit = (kreditCode || '').split(' - ')[0].trim();
  const config = HIBAH_RECOMMENDATIONS[cleanKredit];

  const [isClosed, setIsClosed] = useState(false);
  const prevKreditRef = useRef(cleanKredit);

  useEffect(() => {
    if (prevKreditRef.current !== cleanKredit) {
      prevKreditRef.current = cleanKredit;
      setIsClosed(false);
    }
  }, [cleanKredit]);

  if (!config) return null;

  const cleanDebet = (selectedDebetCode || '').split(' - ')[0].trim();

  // Mode Ringkas / Tertutup untuk Menghemat Ruang
  if (isClosed) {
    return (
      <div
        id={`${idPrefix}-closed-bar`}
        className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 rounded-lg text-xs transition-all shadow-2xs animate-in fade-in duration-100"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="text-[11px] font-medium text-teal-900 dark:text-teal-200 truncate">
            Rekomendasi Debet ({config.badgeLabel}) ditutup
          </span>
          {cleanDebet && (
            <span className="shrink-0 font-mono font-bold text-[10px] text-teal-850 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
              {cleanDebet}
            </span>
          )}
        </div>
        <button
          type="button"
          id={`${idPrefix}-btn-open`}
          onClick={() => setIsClosed(false)}
          className="shrink-0 text-[11px] font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100 flex items-center gap-1 hover:underline cursor-pointer transition-colors"
          title="Tampilkan kembali pilihan rekomendasi akun debet"
        >
          <span>Buka Rekomendasi</span>
          <ChevronDown size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      id={`${idPrefix}-container`}
      className="mt-2.5 p-2.5 sm:p-3 bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl shadow-xs transition-all animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* Header Rekomendasi */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 bg-teal-600 text-white rounded-md shrink-0 shadow-2xs">
            <Sparkles size={12} className="animate-pulse" />
          </div>
          <span className="text-xs font-bold text-teal-950 dark:text-teal-200 tracking-tight">
            Rekomendasi Akun Debet
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${config.badgeClass}`}>
            {config.badgeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-teal-800/80 dark:text-teal-300/80 font-medium">
            Kredit: <strong className="font-mono">{config.kreditCode}</strong>
          </span>
          <button
            type="button"
            id={`${idPrefix}-btn-close`}
            onClick={() => setIsClosed(true)}
            className="p-1 px-1.5 text-teal-700 hover:text-teal-950 dark:text-teal-300 dark:hover:text-white rounded-md hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-semibold border border-teal-200/60 dark:border-teal-800/60"
            title="Tutup rekomendasi untuk menghemat ruang"
          >
            <ChevronUp size={12} />
            <span className="text-[10px]">Tutup</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-teal-900/90 dark:text-teal-200/90 mb-2 leading-tight">
        {config.description}
      </p>

      {/* Grid Opsi Akun Rekomendasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {config.accounts.map((acc) => {
          const isSelected = cleanDebet === acc.code;
          const balanceData = cashBalances?.[acc.code];
          const hasBalance = balanceData && typeof balanceData.balance === 'number';

          return (
            <button
              key={acc.code}
              id={`${idPrefix}-item-${acc.code.replace(/\./g, '-')}`}
              type="button"
              onClick={() => {
                onSelectDebet(acc.code, acc.name);
                setIsClosed(true);
              }}
              className={`group relative text-left p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-1 text-xs ${
                isSelected
                  ? 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-400/70 font-semibold'
                  : 'bg-white dark:bg-slate-800/95 hover:bg-teal-50/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600 shadow-2xs hover:shadow-xs'
              }`}
              title={`Pilih ${acc.code} - ${acc.name} sebagai Akun Debet`}
            >
              {/* Header Baris Kode & Status */}
              <div className="flex items-center justify-between gap-1.5 w-full">
                <span
                  className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                    isSelected
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-teal-900 dark:text-teal-300 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/60'
                  }`}
                >
                  {acc.code}
                </span>

                {isSelected ? (
                  <span className="flex items-center gap-0.5 text-[10px] bg-teal-800 text-teal-50 px-1.5 py-0.5 rounded font-bold">
                    <Check size={11} className="stroke-[3]" />
                    <span>Terpilih</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-teal-700 dark:text-teal-300 opacity-0 group-hover:opacity-100 transition-opacity font-bold flex items-center gap-0.5">
                    <span>Pilih</span>
                    <ArrowRight size={10} />
                  </span>
                )}
              </div>

              {/* Nama Akun */}
              <div className="w-full">
                <div
                  className={`text-xs truncate font-medium ${
                    isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100 font-semibold'
                  }`}
                  title={acc.name}
                >
                  {acc.name}
                </div>
                {acc.desc && (
                  <div
                    className={`text-[10px] truncate ${
                      isSelected ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {acc.desc}
                  </div>
                )}
              </div>

              {/* Info Saldo jika tersedia */}
              {hasBalance && (
                <div
                  className={`pt-1 border-t text-[10px] font-mono flex items-center justify-between ${
                    isSelected
                      ? 'border-teal-500/50 text-teal-100'
                      : 'border-slate-100 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Wallet size={10} className={isSelected ? 'text-teal-200' : 'text-slate-400'} />
                    <span>Saldo:</span>
                  </span>
                  <span className={`font-bold ${isSelected ? 'text-white' : balanceData.balance > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600'}`}>
                    {formatCurrency(balanceData.balance)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-[10px] text-teal-800/80 dark:text-teal-300/80 flex items-center gap-1 italic">
        <span>💡 Klik salah satu pos di atas untuk langsung menetapkannya sebagai Akun Debet.</span>
      </div>
    </div>
  );
};

export default RekomendasiAkunDebet;
