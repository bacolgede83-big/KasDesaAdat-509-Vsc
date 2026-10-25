import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeftRight, 
  Coins, 
  ShoppingBag, 
  Landmark, 
  Building2, 
  X, 
  Search, 
  Check, 
  ArrowRight, 
  ChevronLeft,
  Info,
  CheckCircle2,
  Wallet,
  Sparkles,
  ArrowDownLeft,
  SlidersHorizontal,
  FileEdit
} from 'lucide-react';
import { REFERENSI_REKENING, isKasAccount } from '../../constants';

export type TransaksiType = 'mutasi' | 'pendapatan' | 'belanja_adat' | 'belanja_hibah_prov' | 'belanja_hibah_kab';

export interface AccountItem {
  code: string;
  name: string;
}

export interface CashAccountBalanceInfo {
  code: string;
  name: string;
  balance: number;
}

interface FullHeightAccountPortalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  categoryLabel?: string;
  role: 'kredit' | 'debet';
  accounts: AccountItem[];
  selectedCode: string;
  disabledCode?: string;
  onSelect: (code: string) => void;
  extraInfo?: string;
  cashBalances?: Record<string, CashAccountBalanceInfo>;
}

/**
 * Popup Bebas & Panjang dari Atas ke Bawah (Full-Height Portal)
 * - Rendered directly to document.body via createPortal
 * - Desktop: spans vertically from top: 16px to bottom: 16px (h: calc(100vh - 32px)), width >= 450px (w-[520px])
 *   Displays 18-25+ accounts simultaneously in a single glance without narrow scrolling
 * - Mobile: uses inset-x-3 top-3 bottom-3 to maximize full smartphone viewport
 * - Menampilkan jumlah nominal saldo pada setiap akun kas yang mempunyai saldo: (Rp. 2.000)
 */
export const FullHeightAccountPortal: React.FC<FullHeightAccountPortalProps> = ({
  isOpen,
  onClose,
  title,
  categoryLabel,
  role,
  accounts,
  selectedCode,
  disabledCode,
  onSelect,
  extraInfo,
  cashBalances,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) return accounts;
    const q = searchTerm.toLowerCase().trim();
    return accounts.filter(a => {
      const cleanCode = a.code.split(' - ')[0].trim();
      const cashInfo = cashBalances?.[cleanCode];
      const balanceStr = cashInfo && typeof cashInfo.balance === 'number' && cashInfo.balance > 0
        ? `(rp. ${cashInfo.balance.toLocaleString('id-ID')}) ${cashInfo.balance}`.toLowerCase()
        : '';
      return (
        a.code.toLowerCase().includes(q) || 
        a.name.toLowerCase().includes(q) ||
        balanceStr.includes(q)
      );
    });
  }, [accounts, searchTerm, cashBalances]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[99999] flex items-center justify-center p-0 animate-fade-in"
      onClick={onClose}
    >
      {/* 
        Full-Height Portal Window:
        Desktop: fixed top-4 bottom-4 left-1/2 -translate-x-1/2 w-[520px] max-w-[calc(100vw-32px)] h-[calc(100vh-32px)]
        Mobile: fixed inset-x-3 top-3 bottom-3 h-[calc(100vh-24px)]
      */}
      <div 
        className="fixed inset-x-3 top-3 bottom-3 sm:inset-x-auto sm:top-4 sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[520px] sm:max-w-[calc(100vw-32px)] h-[calc(100vh-24px)] sm:h-[calc(100vh-32px)] bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[100000] text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Portal Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/90 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                role === 'kredit' 
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' 
                  : 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
              }`}>
                {role === 'kredit' ? 'BOX KREDIT' : 'BOX DEBET'}
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                {title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                {filteredAccounts.length} Rekening
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Tutup (ESC)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {categoryLabel && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-tight">
              Kategori: <strong className="text-slate-800 dark:text-slate-200">{categoryLabel}</strong>
              {extraInfo && <span className="ml-1 text-slate-500 italic">• {extraInfo}</span>}
            </div>
          )}

          {/* Real-time Filter Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari kode atau nama rekening..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none shadow-xs text-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 
          Spacious vertical list:
          18-25+ rows visible at once on desktop without narrow scrolling!
        */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 custom-scrollbar p-1.5 sm:p-2">
          {filteredAccounts.map((item) => {
            const isSelected = selectedCode === item.code;
            const isDisabled = Boolean(disabledCode && disabledCode === item.code);
            const cleanCode = item.code.split(' - ')[0].trim();
            const cashInfo = cashBalances?.[cleanCode];
            const hasCashBalance = Boolean(cashInfo && typeof cashInfo.balance === 'number' && cashInfo.balance > 0);

            return (
              <button
                key={item.code}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onSelect(item.code);
                  }
                }}
                className={`w-full text-left py-2 px-3 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer group ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50'
                    : isSelected
                    ? 'bg-teal-50 dark:bg-teal-950/60 font-bold border-l-4 border-teal-500 text-teal-950 dark:text-teal-100'
                    : 'hover:bg-teal-50/70 dark:hover:bg-slate-800/80 hover:border-l-4 hover:border-teal-400'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                    isSelected
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-slate-200 dark:border-slate-700 group-hover:border-teal-400'
                  }`}>
                    {item.code}
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className={`text-xs sm:text-[13px] leading-tight ${
                      isSelected 
                        ? 'text-teal-950 dark:text-teal-100 font-bold' 
                        : 'text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300'
                    }`}>
                      {item.name}
                    </span>
                    {hasCashBalance && (
                      <span className="text-xs sm:text-[13px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        (Rp. {cashInfo!.balance.toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {hasCashBalance && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-lg shadow-2xs">
                      <Wallet size={11} className="text-emerald-600 dark:text-emerald-400" />
                      Rp. {cashInfo!.balance.toLocaleString('id-ID')}
                    </span>
                  )}
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-full">
                      <Check size={13} /> Terpilih
                    </span>
                  )}
                  {isDisabled && (
                    <span className="text-[10px] text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                      Sama dgn {role === 'kredit' ? 'Debet' : 'Kredit'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {filteredAccounts.length === 0 && (
            <div className="py-20 text-center text-xs text-slate-400 dark:text-slate-500 italic">
              Tidak ada rekening yang cocok dengan "{searchTerm}".
            </div>
          )}
        </div>

        {/* Portal Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px] text-slate-500">
            Klik rekening untuk memilih • Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">ESC</kbd> untuk menutup
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface InputKategoriTransaksiModalProps {
  isOpen: boolean;
  initialType?: TransaksiType | null;
  onClose: () => void;
  onSelectTransaction: (accounts: { debet: string; kredit: string }) => void;
  onBypassCategory?: () => void;
  cashBalances?: Record<string, CashAccountBalanceInfo>;
}

export const InputKategoriTransaksiModal: React.FC<InputKategoriTransaksiModalProps> = ({
  isOpen,
  initialType = null,
  onClose,
  onSelectTransaction,
  onBypassCategory,
  cashBalances,
}) => {
  const [selectedType, setSelectedType] = useState<TransaksiType | null>(null);
  const [selectedKredit, setSelectedKredit] = useState<string>('');
  const [selectedDebet, setSelectedDebet] = useState<string>('');
  const [activePortal, setActivePortal] = useState<'kredit' | 'debet' | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType || null);
      setSelectedKredit('');
      setSelectedDebet('');
      setSuccessNotice(null);

      // If initialType is provided, automatically open Box Kredit portal for instant 1-click selection!
      if (initialType) {
        setActivePortal('kredit');
      } else {
        setActivePortal(null);
      }
    } else {
      setActivePortal(null);
      setSuccessNotice(null);
    }
  }, [isOpen, initialType]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !activePortal) {
        if (selectedType) {
          setSelectedType(null);
          setSelectedKredit('');
          setSelectedDebet('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedType, activePortal, onClose]);

  // Accounts Lists
  // 1. Kas Accounts (1.1.*)
  const kasAccounts = useMemo<AccountItem[]>(() => {
    return REFERENSI_REKENING.filter(r => isKasAccount(r.code) || r.code.startsWith('1.1.'));
  }, []);

  // 2. Pendapatan Accounts (4.*)
  const pendapatanAccounts = useMemo<AccountItem[]>(() => {
    return REFERENSI_REKENING.filter(r => r.code.startsWith('4.'));
  }, []);

  // Debet automatic resolver for Pendapatan (Kredit di jurnal)
  const getDebetForPendapatan = (kreditCode: string): string => {
    const clean = kreditCode.trim();
    if (clean === '4.1.3.01') {
      return '1.1.2.02'; // Kas Hibah Prov(LPD)
    }
    if (clean === '4.1.3.02') {
      return '1.1.2.03'; // Kas Hibah Kab(LPD)
    }
    if (clean === '4.1.1.01') {
      return '1.1.1.04'; // Kas Dana Punia Tunai
    }
    if (clean === '4.1.1.05') {
      return '1.1.1.02'; // Kas Juru Raksa(DesaAdat)
    }
    if (clean === '4.1.1.07' || clean === '4.1.3.04') {
      return '1.1.1.01'; // Kas Desa Adat
    }
    return '1.1.1.01'; // Default Kas Desa Adat
  };

  // Kredit accounts list based on active category
  const kreditAccounts = useMemo<AccountItem[]>(() => {
    if (!selectedType) return [];
    switch (selectedType) {
      case 'mutasi':
        // Mutasi: kumpulan akun Kas
        return kasAccounts;
      case 'pendapatan':
        // Pendapatan: kumpulan akun Pendapatan
        return pendapatanAccounts;
      case 'belanja_adat':
        // Belanja Adat: akun Kas Desa Adat (1.1.1.01) dan Kas Juru Raksa(Desa Adat) (1.1.1.02)
        return REFERENSI_REKENING.filter(r => r.code === '1.1.1.01' || r.code === '1.1.1.02');
      case 'belanja_hibah_prov':
        // Belanja Hibah Prov: akun Kas Hibah Prov (LPD) (1.1.2.02) dan Kas Juru Raksa(HibProv) (1.1.2.04)
        return REFERENSI_REKENING.filter(r => r.code === '1.1.2.02' || r.code === '1.1.2.04');
      case 'belanja_hibah_kab':
        // Belanja Hibah Kabupaten: akun Kas Hibah Kab (LPD) (1.1.2.03)
        return REFERENSI_REKENING.filter(r => r.code === '1.1.2.03');
      default:
        return [];
    }
  }, [selectedType, kasAccounts, pendapatanAccounts]);

  // Debet accounts list based on active category
  const debetAccounts = useMemo<AccountItem[]>(() => {
    if (!selectedType) return [];
    if (selectedKredit === '1.1.2.05') {
      return REFERENSI_REKENING.filter(r => r.code === '5.3.2.01');
    }

    switch (selectedType) {
      case 'mutasi':
        // Mutasi: kumpulan akun Kas
        return kasAccounts;
      case 'pendapatan':
        return [];
      case 'belanja_adat':
        // Belanja Adat: Kumpulan akun (Kecuali akun insentif/5.1.1 dan 5.1.4(sembunyikan))
        return REFERENSI_REKENING.filter(r => {
          if (!r.code.startsWith('5.')) return false;
          if (r.code.startsWith('5.1.1') || r.code.startsWith('5.1.4')) return false;
          return true;
        });
      case 'belanja_hibah_prov':
        // Belanja Hibah Prov: Kumpulan akun (Kecuali akun insentif 5.1.4(sembunyikan))
        return REFERENSI_REKENING.filter(r => {
          if (!r.code.startsWith('5.')) return false;
          if (r.code.startsWith('5.1.4')) return false;
          return true;
        });
      case 'belanja_hibah_kab':
        // Belanja Hibah Kabupaten: Hanya tampilkan akun 5.1.4 dan 5.2.3
        return REFERENSI_REKENING.filter(r => {
          return r.code.startsWith('5.1.4') || r.code.startsWith('5.2.3');
        });
      default:
        return [];
    }
  }, [selectedType, selectedKredit, kasAccounts]);

  // Handle selection from Portal for Kredit
  const handleSelectKredit = (code: string) => {
    setSelectedKredit(code);
    setActivePortal(null);

    // Rule: Kas Dana Kematian (1.1.2.05) -> auto resolve Debet to Dana Kematian (5.3.2.01)
    if (code === '1.1.2.05') {
      setSelectedDebet('5.3.2.01');
      setSuccessNotice(`Kas Dana Kematian (1.1.2.05) dipilih. Akun Debet otomatis: 5.3.2.01 - Dana Kematian`);
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: '5.3.2.01', kredit: code });
      }, 200);
      return;
    }

    // Rule: Pendapatan -> auto resolve Debet and immediately open entry modal!
    if (selectedType === 'pendapatan') {
      const resolvedDebet = getDebetForPendapatan(code);
      setSuccessNotice(`Pendapatan ${code} dipilih. Akun Debet otomatis: ${resolvedDebet}`);
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: resolvedDebet, kredit: code });
      }, 200);
      return;
    }

    // Other categories: check if Debet is already chosen
    if (selectedDebet && selectedDebet !== code) {
      setSuccessNotice(`Kedua akun terisi! Membuka modal input jurnal umum...`);
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: selectedDebet, kredit: code });
      }, 200);
    } else {
      // Debet is not yet chosen: automatically open Debet portal after 120ms!
      setTimeout(() => {
        setActivePortal('debet');
      }, 120);
    }
  };

  // Handle selection from Portal for Debet
  const handleSelectDebet = (code: string) => {
    setSelectedDebet(code);
    setActivePortal(null);

    // Check if Kredit is already chosen
    if (selectedKredit && selectedKredit !== code) {
      setSuccessNotice(`Kedua akun terisi! Membuka modal input jurnal umum...`);
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: code, kredit: selectedKredit });
      }, 200);
    } else {
      // Kredit is not yet chosen: automatically open Kredit portal after 120ms!
      setTimeout(() => {
        setActivePortal('kredit');
      }, 120);
    }
  };

  // Helper to get account name (with balance nominal for cash accounts with saldo)
  const getAccountName = (code: string) => {
    if (!code) return '';
    const clean = code.split(' - ')[0].trim();
    const acc = REFERENSI_REKENING.find(r => r.code === clean);
    const baseName = acc ? acc.name : clean;
    const cashInfo = cashBalances?.[clean];
    if (cashInfo && typeof cashInfo.balance === 'number' && cashInfo.balance > 0) {
      return `${baseName} (Rp. ${cashInfo.balance.toLocaleString('id-ID')})`;
    }
    return baseName;
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div 
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[99990] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in"
        onClick={onClose}
      >
        <div 
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Modal */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
            <div className="flex items-center gap-3">
              {selectedType && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType(null);
                    setSelectedKredit('');
                    setSelectedDebet('');
                    setActivePortal(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Ganti Kategori Transaksi"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Input Kategori Transaksi
                  </h3>
                  {selectedType && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                      {selectedType === 'mutasi' && '1. Mutasi Kas'}
                      {selectedType === 'pendapatan' && '2. Pendapatan'}
                      {selectedType === 'belanja_adat' && '3. Belanja Adat'}
                      {selectedType === 'belanja_hibah_prov' && '4. Belanja Hibah Prov'}
                      {selectedType === 'belanja_hibah_kab' && '5. Belanja Hibah Kabupaten'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedType 
                    ? 'Klik box kredit dan box debet untuk membuka daftar rekening leluasa. Modal input terbuka otomatis setelah terisi.'
                    : 'Pilih salah satu kategori transaksi sebelum membuka form input jurnal umum.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
            {successNotice && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5 text-xs font-bold animate-pulse">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {!selectedType ? (
              /* STEP 1: PILIHAN 5 KATEGORI TRANSAKSI */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* 1. Mutasi */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType('mutasi');
                      setTimeout(() => setActivePortal('kredit'), 80);
                    }}
                    className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 bg-white dark:bg-slate-800/60 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 group-hover:scale-105 transition-transform">
                        <ArrowLeftRight size={22} />
                      </div>
                      <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        #1
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400">
                        Mutasi
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Kredit: kumpulan akun Kas, debet: Kumpulan akun Kas. Setelah kedua box terisi pilihan, auto ke modal input.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                      <span>Buka Mutasi</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* 2. Pendapatan */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType('pendapatan');
                      setTimeout(() => setActivePortal('kredit'), 80);
                    }}
                    className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 bg-white dark:bg-slate-800/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 group-hover:scale-105 transition-transform">
                        <Coins size={22} />
                      </div>
                      <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        #2
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        Pendapatan
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Kredit: kumpulan akun Pendapatan. Setelah memilih, auto ke modal input jurnal &amp; box debet disesuaikan otomatis.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span>Buka Pendapatan</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* 3. Belanja Adat */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType('belanja_adat');
                      setTimeout(() => setActivePortal('kredit'), 80);
                    }}
                    className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                        <ShoppingBag size={22} />
                      </div>
                      <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        #3
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        Belanja Adat
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Kredit: Kas Desa Adat &amp; Juru Raksa. Debet: akun belanja (kecuali insentif 5.1.1 &amp; 5.1.4 disembunyikan).
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Buka Belanja Adat</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* 4. Belanja Hibah Prov */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType('belanja_hibah_prov');
                      setTimeout(() => setActivePortal('kredit'), 80);
                    }}
                    className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-white dark:bg-slate-800/60 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 group-hover:scale-105 transition-transform">
                        <Landmark size={22} />
                      </div>
                      <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        #4
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        Belanja Hibah Prov
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Kredit: Kas Hibah Prov (LPD) &amp; Juru Raksa. Debet: akun belanja (kecuali insentif 5.1.4 disembunyikan).
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400">
                      <span>Buka Belanja Prov</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* 5. Belanja Hibah Kabupaten */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType('belanja_hibah_kab');
                      setTimeout(() => setActivePortal('kredit'), 80);
                    }}
                    className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 group-hover:scale-105 transition-transform">
                        <Building2 size={22} />
                      </div>
                      <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        #5
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        Belanja Hibah Kabupaten
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Kredit: Kas Hibah Kab (LPD) &amp; Juru Raksa. Debet: hanya tampilkan akun 5.1.4 dan 5.2.3.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <span>Buka Belanja Kab</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>

                {onBypassCategory && (
                  <div className="pt-3 text-center">
                    <button
                      type="button"
                      onClick={onBypassCategory}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-medium cursor-pointer"
                    >
                      Lewati kategori dan buka entri formulir manual biasa →
                    </button>
                  </div>
                )}
              </div>
            ) : selectedType === 'pendapatan' ? (
              /* VIEW PENDAPATAN (BOX KREDIT PENDAPATAN -> AUTO DEBET KAS) */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-3">
                  <Coins size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <strong>Aturan Pendapatan:</strong> Klik box di bawah untuk membuka popup pilihan akun pendapatan panjang dari atas ke bawah. Begitu salah satu akun pendapatan dipilih, box debet kas penerima akan otomatis disesuaikan sesuai aturan (contoh: Hibah Prov dialokasikan ke Kas Hibah Prov LPD 1.1.2.02, Hibah Kab ke 1.1.2.03, Dana Punia ke Kas Punia Tunai 1.1.1.04, dll) dan modal input Jurnal Umum langsung otomatis terbuka.
                  </div>
                </div>

                {/* Box Kredit Pendapatan */}
                <div className="p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Wallet size={16} className="text-amber-600" />
                      Box Kredit: Rekening Pendapatan
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold">
                      {kreditAccounts.length} Rekening
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePortal('kredit')}
                    className="w-full text-left p-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/80 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    {selectedKredit ? (
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 shrink-0">
                          {selectedKredit}
                        </span>
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {getAccountName(selectedKredit)}
                          </h5>
                          <p className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
                            ✓ Debet Otomatis: {getDebetForPendapatan(selectedKredit)} ({getAccountName(getDebetForPendapatan(selectedKredit))})
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-amber-800 dark:text-amber-300">
                        <Coins size={22} className="shrink-0" />
                        <div>
                          <div className="text-sm font-bold">
                            Klik di sini untuk Memilih Rekening Pendapatan
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Popup pilihan akun leluasa &amp; panjang akan terbuka
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 group-hover:bg-amber-500 text-white font-bold text-xs shadow-xs">
                      {selectedKredit ? 'Ganti Rekening' : 'Buka Daftar Akun'}
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* VIEW MUTASI, BELANJA ADAT, BELANJA HIBAH PROV, BELANJA HIBAH KABUPATEN */
              <div className="space-y-4">
                {/* Petunjuk Aturan */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <Info size={18} className="text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedType === 'mutasi' && (
                      <span>
                        <strong>Aturan Mutasi:</strong> Box kredit: <strong>kumpulan akun Kas</strong>, debet: <strong>Kumpulan akun Kas</strong>. Setelah kedua box terisi pilihan, auto modal keluar &amp; auto muncul modal input jurnal umum dengan pilihan di kedua box tadi.
                      </span>
                    )}
                    {selectedType === 'belanja_adat' && (
                      <span>
                        <strong>Aturan Belanja Adat:</strong> Box kredit: <strong>akun Kas Desa Adat dan Kas Juru Raksa(Desa Adat)</strong>, debet: <strong>Kumpulan akun (Kecuali akun insentif/5.1.1 dan 5.1.4(sembunyikan))</strong>. Setelah kedua box terisi, auto beralih ke modal input jurnal umum.
                      </span>
                    )}
                    {selectedType === 'belanja_hibah_prov' && (
                      <span>
                        <strong>Aturan Belanja Hibah Prov:</strong> Box kredit: <strong>akun Kas Hibah Prov (LPD) dan Kas Juru Raksa(HibProv)</strong>, debet: <strong>Kumpulan akun (Kecuali akun insentif 5.1.4(sembunyikan))</strong>. Setelah kedua box terisi, auto beralih ke modal input jurnal umum.
                      </span>
                    )}
                    {selectedType === 'belanja_hibah_kab' && (
                      <span>
                        <strong>Aturan Belanja Hibah Kabupaten:</strong> Box kredit: <strong>akun Kas Hibah Kab (LPD) dan Kas Juru Raksa(HibKab)</strong>, debet: <strong>Hanya tampilkan akun 5.1.4 dan 5.2.3</strong>. Setelah kedua box terisi, auto beralih ke modal input jurnal umum.
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Baris Terisi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      1. Akun Kredit:
                    </span>
                    {selectedKredit ? (
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400 truncate max-w-[200px]">
                        ✓ {selectedKredit} - {getAccountName(selectedKredit)}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 italic">Belum terisi (klik box di bawah)</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      2. Akun Debet:
                    </span>
                    {selectedDebet ? (
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400 truncate max-w-[200px]">
                        ✓ {selectedDebet} - {getAccountName(selectedDebet)}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 italic">Belum terisi (klik box di bawah)</span>
                    )}
                  </div>
                </div>

                {/* DUA BOX BESAR & INTERAKTIF: BOX KREDIT & BOX DEBET */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BOX KREDIT */}
                  <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-xs flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Wallet size={16} className="text-amber-600" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Box Kredit {selectedType === 'mutasi' ? '(Kas Sumber)' : '(Kas Pengeluaran)'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                          {kreditAccounts.length} akun
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {selectedType === 'mutasi' && 'Pilih akun Kas asal pemindahan dana'}
                        {selectedType === 'belanja_adat' && 'Hanya Kas Desa Adat & Kas Juru Raksa'}
                        {selectedType === 'belanja_hibah_prov' && 'Hanya Kas Hibah Prov & Juru Raksa'}
                        {selectedType === 'belanja_hibah_kab' && 'Hanya Kas Hibah Kab & Juru Raksa'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePortal('kredit')}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer group flex items-center justify-between gap-3 ${
                        selectedKredit
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40'
                          : 'border-dashed border-amber-300 dark:border-amber-700 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      }`}
                    >
                      {selectedKredit ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-600 text-white shrink-0">
                            {selectedKredit}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {getAccountName(selectedKredit)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                          <Wallet size={18} className="shrink-0" />
                          <span className="text-xs font-bold">
                            Klik untuk Pilih Akun Kredit...
                          </span>
                        </div>
                      )}
                      <span className="shrink-0 text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:underline">
                        {selectedKredit ? 'Ganti' : 'Pilih Akun →'}
                      </span>
                    </button>
                  </div>

                  {/* BOX DEBET */}
                  <div className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-xs flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag size={16} className="text-teal-600" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Box Debet {selectedType === 'mutasi' ? '(Kas Penerima)' : '(Beban Belanja)'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                          {debetAccounts.length} akun
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {selectedType === 'mutasi' && 'Pilih akun Kas penerima mutasi'}
                        {selectedType === 'belanja_adat' && 'Belanja umum (insentif 5.1.1 & 5.1.4 disembunyikan)'}
                        {selectedType === 'belanja_hibah_prov' && 'Belanja prov (insentif 5.1.4 disembunyikan)'}
                        {selectedType === 'belanja_hibah_kab' && 'Hanya tampilkan akun 5.1.4 dan 5.2.3'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActivePortal('debet')}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer group flex items-center justify-between gap-3 ${
                        selectedDebet
                          ? 'border-teal-500 bg-teal-50/70 dark:bg-teal-950/40'
                          : 'border-dashed border-teal-300 dark:border-teal-700 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50 dark:hover:bg-teal-950/30'
                      }`}
                    >
                      {selectedDebet ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-600 text-white shrink-0">
                            {selectedDebet}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {getAccountName(selectedDebet)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
                          <ShoppingBag size={18} className="shrink-0" />
                          <span className="text-xs font-bold">
                            Klik untuk Pilih Akun Debet...
                          </span>
                        </div>
                      )}
                      <span className="shrink-0 text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:underline">
                        {selectedDebet ? 'Ganti' : 'Pilih Akun →'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={selectedType ? () => setSelectedType(null) : onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {selectedType ? '← Ganti Kategori' : 'Batal'}
            </button>

            {selectedType && selectedType !== 'pendapatan' && (
              <button
                type="button"
                disabled={!selectedKredit || !selectedDebet || selectedKredit === selectedDebet}
                onClick={() => {
                  if (selectedKredit && selectedDebet && selectedKredit !== selectedDebet) {
                    onClose();
                    onSelectTransaction({ debet: selectedDebet, kredit: selectedKredit });
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Lanjut ke Input Jurnal</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 
        POPUP BEBAS & PANJANG DARI ATAS KE BAWAH (FULL-HEIGHT PORTAL)
        Dipanggil saat klik box kredit atau box debet
      */}
      {activePortal === 'kredit' && (
        <FullHeightAccountPortal
          isOpen={true}
          onClose={() => setActivePortal(null)}
          title={
            selectedType === 'mutasi' 
              ? 'Pilih Akun Kas (Kredit / Sumber)' 
              : selectedType === 'pendapatan'
              ? 'Pilih Rekening Pendapatan (Kredit)'
              : 'Pilih Akun Kas (Kredit / Pengeluaran)'
          }
          categoryLabel={
            selectedType === 'mutasi'
              ? '1. Mutasi'
              : selectedType === 'pendapatan'
              ? '2. Pendapatan'
              : selectedType === 'belanja_adat'
              ? '3. Belanja Adat'
              : selectedType === 'belanja_hibah_prov'
              ? '4. Belanja Hibah Prov'
              : '5. Belanja Hibah Kabupaten'
          }
          role="kredit"
          accounts={kreditAccounts}
          selectedCode={selectedKredit}
          disabledCode={selectedType === 'mutasi' ? selectedDebet : undefined}
          onSelect={handleSelectKredit}
          extraInfo={
            selectedType === 'mutasi'
              ? 'Kumpulan akun Kas'
              : selectedType === 'pendapatan'
              ? 'Pilih pendapatan, akun debet otomatis'
              : selectedType === 'belanja_adat'
              ? 'Kas Desa Adat & Kas Juru Raksa'
              : selectedType === 'belanja_hibah_prov'
              ? 'Kas Hibah Prov (LPD) & Juru Raksa'
              : 'Kas Hibah Kab (LPD) & Juru Raksa'
          }
          cashBalances={cashBalances}
        />
      )}

      {activePortal === 'debet' && (
        <FullHeightAccountPortal
          isOpen={true}
          onClose={() => setActivePortal(null)}
          title={
            selectedType === 'mutasi'
              ? 'Pilih Akun Kas (Debet / Penerima)'
              : 'Pilih Rekening Beban / Belanja (Debet)'
          }
          categoryLabel={
            selectedType === 'mutasi'
              ? '1. Mutasi'
              : selectedType === 'belanja_adat'
              ? '3. Belanja Adat'
              : selectedType === 'belanja_hibah_prov'
              ? '4. Belanja Hibah Prov'
              : '5. Belanja Hibah Kabupaten'
          }
          role="debet"
          accounts={debetAccounts}
          selectedCode={selectedDebet}
          disabledCode={selectedType === 'mutasi' ? selectedKredit : undefined}
          onSelect={handleSelectDebet}
          extraInfo={
            selectedType === 'mutasi'
              ? 'Kumpulan akun Kas'
              : selectedType === 'belanja_adat'
              ? 'Kecuali akun insentif 5.1.1 & 5.1.4 disembunyikan'
              : selectedType === 'belanja_hibah_prov'
              ? 'Kecuali akun insentif 5.1.4 disembunyikan'
              : 'Hanya akun 5.1.4 dan 5.2.3'
          }
          cashBalances={cashBalances}
        />
      )}
    </>,
    document.body
  );
};
