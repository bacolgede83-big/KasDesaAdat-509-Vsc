import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, ChevronDown, Check, X, BookOpen, Layers, Sparkles, 
  ArrowDownLeft, ArrowUpRight, Scale, Tag, Landmark, Coins, Wallet
} from 'lucide-react';
import { REFERENSI_REKENING, isKasAccount } from '../../constants';
import type { BudgetItem } from '../../types';

export interface AccountOption {
  code: string;
  name: string;
  group: string;
  categoryType: 'Aset / Kas' | 'Kewajiban' | 'Ekuitas' | 'Pendapatan' | 'Belanja' | 'Sumber Dana' | 'Pembiayaan' | 'Lainnya';
  subCategory?: string;
  budgetItem?: BudgetItem;
}

interface KodeRekeningAutocompleteProps {
  id?: string;
  value: string; // The account code (e.g. '5.1.1.01')
  onChange: (code: string, item?: AccountOption) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  budgetItems?: BudgetItem[];
  className?: string;
  error?: string;
  side?: 'debet' | 'kredit' | 'neutral';
  helperText?: string;
  counterpartCode?: string; // e.g. saat input akun debet, counterpartCode adalah akun kredit
  cashBalances?: Record<string, { code: string; name: string; balance: number }>;
}

export const KodeRekeningAutocomplete: React.FC<KodeRekeningAutocompleteProps> = ({
  id = 'kode-rekening-autocomplete',
  value,
  onChange,
  label = 'Kode Rekening',
  placeholder = 'Klik untuk memilih kode rekening...',
  required = false,
  budgetItems = [],
  className = '',
  error,
  side = 'neutral',
  helperText,
  counterpartCode,
  cashBalances,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const cleanCounterpart = (counterpartCode || '').split(' - ')[0].trim();

  // ATURAN KHUSUS JURNAL UMUM:
  // 1. Apabila di kredit adalah akun Kas 1.1.2.02 / 1.1.2.04 maka untuk debet akun 5.1.4 dan 5.2.3 non aktif.
  const isKreditHibahProv = side === 'debet' && (cleanCounterpart === '1.1.2.02' || cleanCounterpart === '1.1.2.04');

  // 2. Apabila kredit adalah akun Kas Hibah Kab 1.1.2.03 maka akun yang aktif di debet adalah 5.1.4 dan 5.2.3
  const isKreditHibahKab = side === 'debet' && cleanCounterpart === '1.1.2.03';

  // 3. Apabila kredit adalah Kas Dana Kematian (1.1.2.05) maka akun yang aktif di debet HANYA Dana Kematian (5.3.2.01)
  const isKreditDanaKematian = side === 'debet' && cleanCounterpart === '1.1.2.05';

  // Evaluasi status akun (aktif vs non-aktif)
  const checkAccountStatus = (accountCode: string): { isDisabled: boolean; badgeLabel?: string; reason?: string } => {
    if (isKreditDanaKematian) {
      const isAllowed = accountCode === '5.3.2.01' || accountCode.startsWith('5.3.2.01');
      if (!isAllowed) {
        return {
          isDisabled: true,
          badgeLabel: 'Non-Aktif',
          reason: 'Non-aktif: Kredit adalah Kas Dana Kematian (1.1.2.05). Akun yang aktif di debet hanya 5.3.2.01 (Dana Kematian).'
        };
      }
    }

    if (isKreditHibahProv) {
      if (accountCode.startsWith('5.1.4') || accountCode.startsWith('5.2.3')) {
        return {
          isDisabled: true,
          badgeLabel: 'Non-Aktif',
          reason: 'Akun 5.1.4 & 5.2.3 non-aktif karena kredit adalah Kas Hibah Provinsi (1.1.2.02 / 1.1.2.04). Pos ini khusus peruntukan Hibah Kabupaten.'
        };
      }
    }

    if (isKreditHibahKab) {
      const isAllowed = accountCode.startsWith('5.1.4') || accountCode.startsWith('5.2.3') || accountCode === '1.1.2.03';
      if (!isAllowed) {
        return {
          isDisabled: true,
          badgeLabel: 'Non-Aktif',
          reason: 'Non-aktif: Kredit adalah Kas Hibah Kabupaten (1.1.2.03). Akun yang aktif di debet hanya 5.1.4 (Insentif Prajuru Kab) dan 5.2.3 (Parhyangan Hibah Kab).'
        };
      }
    }

    return { isDisabled: false };
  };

  // Build complete accounts list merged with budget items with accurate header grouping
  const allAccounts = useMemo<AccountOption[]>(() => {
    const list: AccountOption[] = [];
    const seenCodes = new Set<string>();

    // 1. Base REFERENSI_REKENING
    REFERENSI_REKENING.forEach(r => {
      seenCodes.add(r.code);
      let categoryType: AccountOption['categoryType'] = 'Lainnya';
      let group = 'Lainnya';
      let subCategory = '';

      if (r.code.startsWith('1.1.1')) {
        categoryType = 'Aset / Kas';
        group = '1.1.1 Kas & Bank Desa Adat (Operasional)';
        subCategory = 'Kas Operasional';
      } else if (r.code.startsWith('1.1.2')) {
        categoryType = 'Aset / Kas';
        group = '1.1.2 Kas Hibah Provinsi, Kabupaten & Khusus';
        subCategory = 'Kas Hibah';
      } else if (r.code.startsWith('1.1')) {
        categoryType = 'Aset / Kas';
        group = '1.1 Kas & Bank';
        subCategory = 'Kas & Bank';
      } else if (r.code.startsWith('1.2')) {
        categoryType = 'Aset / Kas';
        group = '1.2 Piutang & Tagihan Desa Adat';
        subCategory = 'Piutang';
      } else if (r.code.startsWith('1.')) {
        categoryType = 'Aset / Kas';
        group = '1. Aset Lainnya';
        subCategory = 'Aset';
      } else if (r.code.startsWith('2.')) {
        categoryType = 'Kewajiban';
        group = '2.1 Kewajiban & Utang Belanja / Rekanan';
        subCategory = 'Utang & Kewajiban';
      } else if (r.code.startsWith('3.')) {
        categoryType = 'Ekuitas';
        group = '3.1 Ekuitas & Saldo Modal Desa Adat';
        subCategory = 'Ekuitas';
      } else if (r.code.startsWith('4.1.1')) {
        categoryType = 'Pendapatan';
        group = '4.1.1 Pendapatan Asli Desa Adat & Punia';
        subCategory = 'Pendapatan Asli';
      } else if (r.code.startsWith('4.1.3')) {
        categoryType = 'Pendapatan';
        group = '4.1.3 Pendapatan Hibah Provinsi & Kabupaten';
        subCategory = 'Pendapatan Hibah';
      } else if (r.code.startsWith('4.')) {
        categoryType = 'Pendapatan';
        group = '4. Pendapatan Lainnya';
        subCategory = 'Pendapatan';
      } else if (r.code.startsWith('5.1.1')) {
        categoryType = 'Belanja';
        group = '5.1.1 Beban Insentif Prajuru (Hibah Provinsi)';
        subCategory = 'Insentif Provinsi';
      } else if (r.code.startsWith('5.1.4')) {
        categoryType = 'Belanja';
        group = '5.1.4 Beban Insentif Prajuru (Hibah Kabupaten)';
        subCategory = 'Insentif Kabupaten';
      } else if (r.code.startsWith('5.1.2')) {
        categoryType = 'Belanja';
        group = '5.1.2 Belanja Operasional Perkantoran & Desa';
        subCategory = 'Operasional Kantor';
      } else if (r.code.startsWith('5.1.3')) {
        categoryType = 'Belanja';
        group = '5.1.3 Belanja Perjalanan Dinas & Operasional Lainnya';
        subCategory = 'Perjalanan Dinas';
      } else if (r.code.startsWith('5.1.5')) {
        categoryType = 'Belanja';
        group = '5.1.5 Beban Adat & Kelembagaan Lainnya';
        subCategory = 'Beban Adat';
      } else if (r.code.startsWith('5.2.1')) {
        categoryType = 'Belanja';
        group = '5.2.1 Belanja Parhyangan (Desa Adat)';
        subCategory = 'Parhyangan Desa Adat';
      } else if (r.code.startsWith('5.2.2')) {
        categoryType = 'Belanja';
        group = '5.2.2 Belanja Parhyangan (Hibah Provinsi)';
        subCategory = 'Parhyangan Hibah Provinsi';
      } else if (r.code.startsWith('5.2.3')) {
        categoryType = 'Belanja';
        group = '5.2.3 Belanja Parhyangan (Hibah Kabupaten)';
        subCategory = 'Parhyangan Hibah Kabupaten';
      } else if (r.code.startsWith('5.3.1')) {
        categoryType = 'Belanja';
        group = '5.3.1 Belanja Pawongan (Hibah)';
        subCategory = 'Pawongan Hibah';
      } else if (r.code.startsWith('5.3.2')) {
        categoryType = 'Belanja';
        group = '5.3.2 Belanja Pawongan (Desa Adat)';
        subCategory = 'Pawongan Desa Adat';
      } else if (r.code.startsWith('5.4')) {
        categoryType = 'Belanja';
        group = '5.4.1 Belanja Palemahan (Desa Adat)';
        subCategory = 'Palemahan';
      } else if (r.code.startsWith('5.')) {
        categoryType = 'Belanja';
        group = '5. Belanja & Beban Lainnya';
        subCategory = 'Belanja';
      } else if (r.code.startsWith('6.')) {
        categoryType = 'Pembiayaan';
        group = '6.1 Sisa Lebih Pembiayaan (SILPA)';
        subCategory = 'SILPA';
      } else if (r.code.startsWith('7.')) {
        categoryType = 'Sumber Dana';
        group = '7.1 Sumber Dana Khusus & Urunan Krama';
        subCategory = 'Sumber Dana';
      }

      const matchingBudget = budgetItems.find(b => b.kode === r.code);

      list.push({
        code: r.code,
        name: r.name,
        group,
        categoryType,
        subCategory,
        budgetItem: matchingBudget,
      });
    });

    // 2. Add extra budget codes
    budgetItems.forEach(b => {
      if (b.kode && !seenCodes.has(b.kode)) {
        seenCodes.add(b.kode);
        let categoryType: AccountOption['categoryType'] = 'Belanja';
        let group = '5. Belanja & Beban (Pos Anggaran)';
        if (b.kode.startsWith('1.')) {
          categoryType = 'Aset / Kas';
          group = '1. Kas & Aset (Anggaran)';
        } else if (b.kode.startsWith('4.')) {
          categoryType = 'Pendapatan';
          group = '4. Pendapatan (Anggaran)';
        } else if (b.kode.startsWith('7.')) {
          categoryType = 'Sumber Dana';
          group = '7. Sumber Dana (Anggaran)';
        }

        list.push({
          code: b.kode,
          name: b.uraian || b.keterangan || 'Pos Anggaran',
          group,
          categoryType,
          subCategory: 'Pos Anggaran Khusus',
          budgetItem: b,
        });
      }
    });

    return list;
  }, [budgetItems]);

  // Find currently selected account option
  const selectedAccount = useMemo(() => {
    if (!value) return null;
    const cleanCode = value.split(' - ')[0].trim();
    return allAccounts.find(a => a.code === cleanCode) || {
      code: cleanCode,
      name: value.includes(' - ') ? value.split(' - ').slice(1).join(' - ').trim() : value,
      group: 'Akun Terpilih',
      categoryType: 'Lainnya' as const
    };
  }, [value, allAccounts]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setSearchTerm('');
      setFocusedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isModalOpen]);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Prominent Category Filters (Compact and efficient)
  const categoryFilters = useMemo(() => [
    { 
      id: 'all', 
      label: 'Semua', 
      count: allAccounts.length 
    },
    { 
      id: 'kas', 
      label: '1. Kas & Bank', 
      count: allAccounts.filter(a => a.code.startsWith('1.')).length 
    },
    { 
      id: 'kewajiban', 
      label: '2. Utang', 
      count: allAccounts.filter(a => a.code.startsWith('2.')).length 
    },
    { 
      id: 'ekuitas', 
      label: '3. Ekuitas', 
      count: allAccounts.filter(a => a.code.startsWith('3.')).length 
    },
    { 
      id: 'pendapatan', 
      label: '4. Pendapatan', 
      count: allAccounts.filter(a => a.code.startsWith('4.')).length 
    },
    { 
      id: 'belanja', 
      label: '5. Belanja', 
      count: allAccounts.filter(a => a.code.startsWith('5.')).length 
    },
    { 
      id: 'sumberdana', 
      label: '6/7. Sumber & SILPA', 
      count: allAccounts.filter(a => a.code.startsWith('7.') || a.code.startsWith('6.')).length 
    },
  ], [allAccounts]);

  // Filtered accounts based on search query and category filter
  const filteredAccounts = useMemo(() => {
    let result = allAccounts;

    if (selectedGroup === 'kas') {
      result = result.filter(a => a.code.startsWith('1.'));
    } else if (selectedGroup === 'kewajiban') {
      result = result.filter(a => a.code.startsWith('2.'));
    } else if (selectedGroup === 'ekuitas') {
      result = result.filter(a => a.code.startsWith('3.'));
    } else if (selectedGroup === 'pendapatan') {
      result = result.filter(a => a.code.startsWith('4.'));
    } else if (selectedGroup === 'belanja') {
      result = result.filter(a => a.code.startsWith('5.'));
    } else if (selectedGroup === 'sumberdana') {
      result = result.filter(a => a.code.startsWith('7.') || a.code.startsWith('6.'));
    }

    const cleanSearch = searchTerm.trim().toLowerCase();
    if (cleanSearch) {
      result = result.filter(a => {
        const cleanCode = a.code.split(' - ')[0].trim();
        const cashInfo = isKasAccount(cleanCode) ? cashBalances?.[cleanCode] : undefined;
        const balanceStr = cashInfo && typeof cashInfo.balance === 'number' && cashInfo.balance > 0
          ? `(rp. ${cashInfo.balance.toLocaleString('id-ID')}) ${cashInfo.balance}`.toLowerCase()
          : '';
        const fullCombo = `${a.code} ${a.name} ${balanceStr} ${a.group} ${a.subCategory || ''}`.toLowerCase();
        return fullCombo.includes(cleanSearch) || a.code.toLowerCase().includes(cleanSearch);
      });
    }

    return result;
  }, [allAccounts, searchTerm, selectedGroup, cashBalances]);

  // Grouped results for hierarchical presentation
  const groupedResults = useMemo(() => {
    const groups: { [groupTitle: string]: AccountOption[] } = {};
    filteredAccounts.forEach(item => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    });
    return groups;
  }, [filteredAccounts]);

  const handleSelectAccount = (account: AccountOption) => {
    onChange(account.code, account);
    setIsModalOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Theme styling based on side
  const sideConfig = {
    debet: {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
      boxBorder: 'hover:border-emerald-500 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20',
      activeRing: 'border-emerald-500 ring-1 ring-emerald-500/30',
      modalHeader: 'bg-gradient-to-r from-emerald-800 to-teal-700 text-white',
      badgeBg: 'bg-emerald-700 text-white',
      accentColor: 'text-emerald-700 dark:text-emerald-400',
      modalRoleTitle: 'PILIH REKENING DEBET (MEMASUKKAN)',
      rolePill: 'POSISI DEBET',
      sideDescription: 'Penerimaan Kas / Beban Belanja / Pengurangan Utang',
      sideLabel: 'Debet (Penerimaan / Beban)',
      groupBorder: 'border-emerald-600',
      icon: <ArrowDownLeft size={15} className="text-emerald-200" />,
    },
    kredit: {
      badge: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
      boxBorder: 'hover:border-rose-500 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/20',
      activeRing: 'border-rose-500 ring-1 ring-rose-500/30',
      modalHeader: 'bg-gradient-to-r from-rose-800 to-red-700 text-white',
      badgeBg: 'bg-rose-700 text-white',
      accentColor: 'text-rose-700 dark:text-rose-400',
      modalRoleTitle: 'PILIH REKENING KREDIT (MENGELUARKAN)',
      rolePill: 'POSISI KREDIT',
      sideDescription: 'Pengeluaran Kas / Pendapatan / Sumber Dana / Utang Baru',
      sideLabel: 'Kredit (Pengeluaran / Sumber)',
      groupBorder: 'border-rose-600',
      icon: <ArrowUpRight size={15} className="text-rose-200" />,
    },
    neutral: {
      badge: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
      boxBorder: 'hover:border-teal-500 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/20',
      activeRing: 'border-teal-500 ring-1 ring-teal-500/30',
      modalHeader: 'bg-gradient-to-r from-teal-800 to-slate-800 text-white',
      badgeBg: 'bg-teal-700 text-white',
      accentColor: 'text-teal-700 dark:text-teal-400',
      modalRoleTitle: 'PILIH BAGAN REKENING AKUN',
      rolePill: 'BAGAN AKUN',
      sideDescription: 'Daftar Standar Akun Transaksi Keuangan Desa Adat',
      sideLabel: 'Bagan Akun Rekening',
      groupBorder: 'border-teal-600',
      icon: <BookOpen size={15} className="text-teal-200" />,
    },
  }[side];

  return (
    <div id={id} className={`relative flex flex-col space-y-1 ${className}`}>
      {/* Label and Selected Code Badge */}
      <div className="flex items-center justify-between">
        <label className="block text-[10px] uppercase font-bold tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          {sideConfig.icon}
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {selectedAccount ? (
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold border shadow-2xs ${sideConfig.badge}`}>
            {selectedAccount.code}
          </span>
        ) : isKreditDanaKematian ? (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200 font-bold">
            Khusus 5.3.2.01 (Dana Kematian)
          </span>
        ) : isKreditHibahProv ? (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 font-bold">
            5.1.4 & 5.2.3 Non-Aktif
          </span>
        ) : isKreditHibahKab ? (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950 dark:text-sky-200 font-bold">
            Khusus 5.1.4 & 5.2.3
          </span>
        ) : null}
      </div>

      {/* Trigger Box (Clicking opens the compact modal) */}
      <div
        onClick={() => setIsModalOpen(true)}
        className={`relative flex items-center justify-between bg-white dark:bg-slate-800 border ${
          error ? 'border-rose-400 ring-1 ring-rose-400' : 'border-gray-300 dark:border-slate-700'
        } ${sideConfig.boxBorder} rounded-xl p-2 sm:p-2.5 shadow-2xs cursor-pointer transition-all group`}
        title="Klik untuk memilih kode rekening"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors shrink-0">
            <Search size={14} />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            {selectedAccount ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 shrink-0">
                  {selectedAccount.code}
                </span>
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {selectedAccount.name}
                  {(() => {
                    const cleanCode = selectedAccount.code.split(' - ')[0].trim();
                    const cashInfo = isKasAccount(cleanCode) ? cashBalances?.[cleanCode] : undefined;
                    if (cashInfo && typeof cashInfo.balance === 'number' && cashInfo.balance > 0) {
                      return (
                        <span className="ml-1.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          (Rp. {cashInfo.balance.toLocaleString('id-ID')})
                        </span>
                      );
                    }
                    return null;
                  })()}
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 truncate">
                {placeholder}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5">
          {selectedAccount && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title="Hapus pilihan akun"
            >
              <X size={13} />
            </button>
          )}

          <div className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/60 rounded text-slate-600 dark:text-slate-300 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors flex items-center gap-1 text-[10px] font-bold">
            <span>Pilih</span>
            <ChevronDown size={12} className="text-slate-400 group-hover:text-teal-600" />
          </div>
        </div>
      </div>

      {helperText && !error && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{helperText}</p>
      )}
      {error && <p className="text-[10px] font-semibold text-rose-500 ml-1">{error}</p>}

      {/* ========================================================================= */}
      {/* MODAL PILIHAN AKUN: COMPACT, BERSIH, EFISIEN, DENGAN HEADER AKUN PRESISI */}
      {/* ========================================================================= */}
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/60 z-[999999] flex justify-center items-center backdrop-blur-xs p-2 sm:p-4 animate-fade-in no-print"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] max-h-[660px] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Modal Slim Header Akun */}
            <div className={`px-4 py-2.5 ${sideConfig.modalHeader} flex items-center justify-between shadow-xs shrink-0`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-1.5 bg-white/20 rounded-lg shrink-0 shadow-2xs">
                  {sideConfig.icon}
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                      {sideConfig.modalRoleTitle}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/25 text-white/95 border border-white/20 shrink-0 hidden sm:inline-block">
                      {sideConfig.rolePill}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/80 truncate hidden sm:block">
                    {sideConfig.sideDescription}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-white/70 bg-black/20 px-1.5 py-0.5 rounded border border-white/10 hidden sm:inline-block font-mono">
                  ESC
                </span>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                  title="Tutup (ESC)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 1b. Alert Banner khusus Aturan Kas Hibah Provinsi / Kabupaten */}
            {isKreditHibahProv && (
              <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800/80 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-200/90 dark:bg-amber-900/90 text-[10px] font-extrabold text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
                    ATURAN HIBAH PROVINSI
                  </span>
                  <span className="text-[11px] leading-tight truncate">
                    Kredit <strong>{cleanCounterpart}</strong>: Akun Debet <strong>5.1.4</strong> & <strong>5.2.3</strong> <span className="text-rose-600 dark:text-rose-400 font-bold">non-aktif</span> (pos belanja Kabupaten).
                  </span>
                </div>
              </div>
            )}

            {isKreditDanaKematian && (
              <div className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950/70 border-b border-purple-200 dark:border-purple-800/80 flex items-center justify-between gap-2 text-xs text-purple-900 dark:text-purple-200 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-200/90 dark:bg-purple-900/90 text-[10px] font-extrabold text-purple-950 dark:text-purple-100 border border-purple-300 dark:border-purple-700">
                    ATURAN KAS DANA KEMATIAN
                  </span>
                  <span className="text-[11px] leading-tight truncate">
                    Kredit <strong>1.1.2.05 (Kas Dana Kematian)</strong>: Akun Debet yang aktif <span className="text-purple-700 dark:text-purple-300 font-bold">hanya 5.3.2.01 (Dana Kematian)</span>.
                  </span>
                </div>
              </div>
            )}

            {isKreditHibahKab && (
              <div className="px-3.5 py-2 bg-sky-50 dark:bg-sky-950/70 border-b border-sky-200 dark:border-sky-800/80 flex items-center justify-between gap-2 text-xs text-sky-900 dark:text-sky-200 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-sky-200/90 dark:bg-sky-900/90 text-[10px] font-extrabold text-sky-950 dark:text-sky-100 border border-sky-300 dark:border-sky-700">
                    ATURAN HIBAH KABUPATEN
                  </span>
                  <span className="text-[11px] leading-tight truncate">
                    Kredit <strong>{cleanCounterpart}</strong>: Akun Debet yang aktif <span className="text-emerald-700 dark:text-emerald-400 font-bold">hanya 5.1.4 & 5.2.3</span> (pos belanja Kabupaten).
                  </span>
                </div>
              </div>
            )}

            {/* 2. Compact Search & Filter Toolbar */}
            <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
              {/* Search input */}
              <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/30 transition-all">
                <div className="pl-3 text-slate-400">
                  <Search size={14} />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ketik kode rekening (misal: 1.1.1, 5.1.1, 5.1.4) atau uraian nama akun..."
                  className="w-full bg-transparent py-1.5 px-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                    className="mr-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category Filter Pills (Horizontal compact scrollable / wrap) */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {categoryFilters.map(tab => {
                  const isActive = selectedGroup === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedGroup(tab.id)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? `${sideConfig.badgeBg} shadow-xs text-white`
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] font-mono font-bold px-1 rounded ${
                        isActive 
                          ? 'bg-black/20 text-white' 
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. High-Density List of Accounts */}
            <div 
              ref={listRef} 
              className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2.5 custom-scrollbar"
            >
              {Object.keys(groupedResults).length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tidak ada kode rekening yang cocok
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Coba ubah kata kunci atau pilih tombol kategori &quot;Semua&quot;
                  </p>
                </div>
              ) : (
                (Object.entries(groupedResults) as [string, AccountOption[]][]).map(([groupTitle, accounts]) => {
                  const isEntireGroupDisabled = accounts.length > 0 && accounts.every(a => checkAccountStatus(a.code).isDisabled);

                  return (
                    <div key={groupTitle} className="space-y-1">
                      {/* Header Group Akun */}
                      <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 rounded-md flex items-center justify-between border-l-2 ${sideConfig.groupBorder}`}>
                        <span className="truncate">{groupTitle}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isEntireGroupDisabled && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              NON-AKTIF
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-slate-400 font-semibold">{accounts.length} akun</span>
                        </div>
                      </div>

                      {/* Account Compact Rows */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
                        {accounts.map((account) => {
                          const isSelected = selectedAccount?.code === account.code;
                          const { isDisabled, reason } = checkAccountStatus(account.code);
                          const cleanCode = account.code.split(' - ')[0].trim();
                          const cashInfo = isKasAccount(cleanCode) ? cashBalances?.[cleanCode] : undefined;
                          const hasCashBalance = Boolean(cashInfo && typeof cashInfo.balance === 'number' && cashInfo.balance > 0);

                          return (
                            <div
                              key={account.code}
                              onClick={() => {
                                if (isDisabled) return;
                                handleSelectAccount(account);
                              }}
                              title={isDisabled ? reason : `Pilih akun ${account.code} - ${account.name}`}
                              className={`w-full px-2.5 py-1.5 transition-colors flex items-center justify-between gap-2.5 group text-xs ${
                                isDisabled
                                  ? 'opacity-40 bg-slate-50/70 dark:bg-slate-900/40 cursor-not-allowed select-none'
                                  : isSelected
                                  ? 'bg-teal-50/90 dark:bg-teal-950/70 font-semibold cursor-pointer'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {/* Account Code */}
                                <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 min-w-[72px] text-center border ${
                                  isDisabled
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 line-through'
                                    : isSelected
                                    ? 'bg-teal-700 text-white border-teal-800'
                                    : 'bg-slate-100 dark:bg-slate-900 text-teal-800 dark:text-teal-300 border-slate-200 dark:border-slate-700 group-hover:border-teal-300'
                                }`}>
                                  {account.code}
                                </span>

                                {/* Account Name and Status */}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                    <span className={`text-xs truncate ${
                                      isDisabled
                                        ? 'text-slate-500 dark:text-slate-500'
                                        : isSelected 
                                        ? 'text-teal-950 dark:text-teal-200 font-bold' 
                                        : 'text-slate-800 dark:text-slate-200 group-hover:text-teal-900 dark:group-hover:text-teal-200'
                                    }`}>
                                      {account.name}
                                    </span>
                                    {hasCashBalance && (
                                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs shrink-0">
                                        (Rp. {cashInfo!.balance.toLocaleString('id-ID')})
                                      </span>
                                    )}
                                    {isDisabled && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shrink-0">
                                        Non-Aktif
                                      </span>
                                    )}
                                  </div>
                                  {isDisabled && reason && (
                                    <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90 truncate">
                                      {reason}
                                    </span>
                                  )}
                                </div>

                                {/* Meta Info (Cash Balance & Budget) */}
                                {!isDisabled && hasCashBalance && (
                                  <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                                    <Wallet size={9} /> Rp {cashInfo!.balance.toLocaleString('id-ID')}
                                  </span>
                                )}
                                {!isDisabled && account.budgetItem && (
                                  <span className="hidden md:inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                                    <Sparkles size={9} /> Rp {account.budgetItem.jumlah ? account.budgetItem.jumlah.toLocaleString('id-ID') : '0'}
                                  </span>
                                )}
                              </div>

                              {/* Select Action / Check */}
                              <div className="shrink-0 flex items-center">
                                {isDisabled ? (
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    Terkunci
                                  </span>
                                ) : isSelected ? (
                                  <span className="p-0.5 bg-teal-600 text-white rounded-md">
                                    <Check size={14} />
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-teal-700 group-hover:bg-teal-100 px-1.5 py-0.5 rounded transition-colors">
                                    Pilih
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 4. Slim Footer */}
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
              <span>
                Menampilkan <strong>{filteredAccounts.length}</strong> dari {allAccounts.length} rekening
              </span>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold py-1 px-3 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default KodeRekeningAutocomplete;
