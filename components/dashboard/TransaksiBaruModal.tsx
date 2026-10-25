import React, { useState, useMemo, useEffect } from 'react';
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
  Wallet
} from 'lucide-react';
import { REFERENSI_REKENING, isKasAccount } from '../../constants';

export type TransaksiType = 'mutasi' | 'pendapatan' | 'belanja_adat' | 'belanja_hibah_prov' | 'belanja_hibah_kab';

interface TransaksiBaruModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction: (accounts: { debet: string; kredit: string }) => void;
}

interface AccountItem {
  code: string;
  name: string;
}

export const TransaksiBaruModal: React.FC<TransaksiBaruModalProps> = ({
  isOpen,
  onClose,
  onSelectTransaction,
}) => {
  const [selectedType, setSelectedType] = useState<TransaksiType | null>(null);
  const [selectedKredit, setSelectedKredit] = useState<string>('');
  const [selectedDebet, setSelectedDebet] = useState<string>('');
  const [searchKredit, setSearchKredit] = useState<string>('');
  const [searchDebet, setSearchDebet] = useState<string>('');

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setSelectedType(null);
      setSelectedKredit('');
      setSelectedDebet('');
      setSearchKredit('');
      setSearchDebet('');
    }
  }, [isOpen]);

  // Handle ESC key to close or go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen, selectedType, onClose]);

  // All Kas accounts (1.1.*)
  const kasAccounts = useMemo<AccountItem[]>(() => {
    return REFERENSI_REKENING.filter(r => isKasAccount(r.code) || r.code.startsWith('1.1.'));
  }, []);

  // All Pendapatan accounts (4.*)
  const pendapatanAccounts = useMemo<AccountItem[]>(() => {
    return REFERENSI_REKENING.filter(r => r.code.startsWith('4.'));
  }, []);

  // Rule 2: Determine debet account automatically for Pendapatan
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
      return '1.1.1.02'; // Kas JuruRaksa(Tunai)
    }
    if (clean === '4.1.1.07') {
      return '1.1.1.01'; // Kas Desa Adat
    }
    return '1.1.1.01'; // Default Kas Desa Adat
  };

  // Filtered account lists based on selected type
  const kreditAccounts = useMemo<AccountItem[]>(() => {
    if (!selectedType) return [];
    let list: AccountItem[] = [];

    switch (selectedType) {
      case 'mutasi':
        // Mutasi: kumpulan akun Kas
        list = kasAccounts;
        break;
      case 'pendapatan':
        // Pendapatan: kumpulan akun Pendapatan
        list = pendapatanAccounts;
        break;
      case 'belanja_adat':
        // Belanja Adat: akun Kas Desa Adat (1.1.1.01) dan Kas Juru Raksa(Desa Adat) (1.1.1.02)
        list = REFERENSI_REKENING.filter(r => r.code === '1.1.1.01' || r.code === '1.1.1.02');
        break;
      case 'belanja_hibah_prov':
        // Belanja Hibah Prov: akun Kas Hibah Prov (LPD) (1.1.2.02) dan Kas Juru Raksa(HibProv) (1.1.2.04)
        list = REFERENSI_REKENING.filter(r => r.code === '1.1.2.02' || r.code === '1.1.2.04');
        break;
      case 'belanja_hibah_kab':
        // Belanja Hibah Kabupaten: akun Kas Hibah Kab (LPD) (1.1.2.03)
        list = REFERENSI_REKENING.filter(r => r.code === '1.1.2.03');
        break;
    }

    if (!searchKredit.trim()) return list;
    const query = searchKredit.toLowerCase().trim();
    return list.filter(a => a.code.toLowerCase().includes(query) || a.name.toLowerCase().includes(query));
  }, [selectedType, kasAccounts, pendapatanAccounts, searchKredit]);

  const debetAccounts = useMemo<AccountItem[]>(() => {
    if (!selectedType) return [];
    if (selectedKredit === '1.1.2.05') {
      return REFERENSI_REKENING.filter(r => r.code === '5.3.2.01');
    }

    let list: AccountItem[] = [];

    switch (selectedType) {
      case 'mutasi':
        // Mutasi: kumpulan akun Kas
        list = kasAccounts;
        break;
      case 'pendapatan':
        // Handled automatically on selecting kredit
        return [];
      case 'belanja_adat':
        // Belanja Adat: Kumpulan akun (Kecuali akun insentif/5.1.1 dan 5.1.4(sembunyikan))
        list = REFERENSI_REKENING.filter(r => {
          if (!r.code.startsWith('5.')) return false;
          if (r.code.startsWith('5.1.1') || r.code.startsWith('5.1.4')) return false;
          return true;
        });
        break;
      case 'belanja_hibah_prov':
        // Belanja Hibah Prov: Kumpulan akun (Kecuali akun insentif 5.1.4(sembunyikan) & 5.2.3)
        list = REFERENSI_REKENING.filter(r => {
          if (!r.code.startsWith('5.')) return false;
          if (r.code.startsWith('5.1.4') || r.code.startsWith('5.2.3')) return false;
          return true;
        });
        break;
      case 'belanja_hibah_kab':
        // Belanja Hibah Kabupaten: Hanya tampilkan akun 5.1.4 dan 5.2.3
        list = REFERENSI_REKENING.filter(r => {
          return r.code.startsWith('5.1.4') || r.code.startsWith('5.2.3');
        });
        break;
    }

    if (!searchDebet.trim()) return list;
    const query = searchDebet.toLowerCase().trim();
    return list.filter(a => a.code.toLowerCase().includes(query) || a.name.toLowerCase().includes(query));
  }, [selectedType, selectedKredit, kasAccounts, searchDebet]);

  // Handle selection trigger when both boxes are selected
  const handleSelectKredit = (code: string) => {
    setSelectedKredit(code);

    if (code === '1.1.2.05') {
      // Kas Dana Kematian: otomatis Debet hanya Dana Kematian (5.3.2.01)
      setSelectedDebet('5.3.2.01');
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: '5.3.2.01', kredit: code });
      }, 150);
      return;
    }

    if (selectedType === 'pendapatan') {
      // Auto resolve debet based on accounting rules and proceed immediately
      const resolvedDebet = getDebetForPendapatan(code);
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: resolvedDebet, kredit: code });
      }, 150);
      return;
    }

    // For other types, check if debet is already selected
    if (selectedDebet && selectedDebet !== code) {
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: selectedDebet, kredit: code });
      }, 150);
    }
  };

  const handleSelectDebet = (code: string) => {
    setSelectedDebet(code);

    if (selectedKredit && selectedKredit !== code) {
      setTimeout(() => {
        onClose();
        onSelectTransaction({ debet: code, kredit: selectedKredit });
      }, 150);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in"
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
                }}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title="Kembali ke pilihan transaksi"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Mau Transaksi Apa?
                </h3>
                {selectedType && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
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
                  ? 'Pilih rekening sesuai aturan. Jurnal Umum otomatis terbuka setelah akun terisi.'
                  : 'Pilih jenis transaksi untuk langsung memfilter rekening kredit & debet yang sesuai.'}
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
          {!selectedType ? (
            /* STEP 1: PILIHAN JENIS TRANSAKSI (5 PILIHAN) */
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* 1. Mutasi */}
                <button
                  type="button"
                  onClick={() => setSelectedType('mutasi')}
                  className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
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
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      Mutasi
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Pemindahan dana antar rekening Kas / Bank (Kredit Kas ⇄ Debet Kas).
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Pilih Kas</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 2. Pendapatan */}
                <button
                  type="button"
                  onClick={() => setSelectedType('pendapatan')}
                  className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
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
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      Pendapatan
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Penerimaan Dana Punia, BKK Hibah, Penjualan, dll. Debet Kas otomatis disesuaikan.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Pilih Pendapatan</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 3. Belanja Adat */}
                <button
                  type="button"
                  onClick={() => setSelectedType('belanja_adat')}
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
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      Belanja Adat
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Pengeluaran dari Kas Desa Adat / Juru Raksa. Beban insentif 5.1.1 & 5.1.4 disembunyikan.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Pilih Belanja</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 4. Belanja Hibah Prov */}
                <button
                  type="button"
                  onClick={() => setSelectedType('belanja_hibah_prov')}
                  className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
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
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      Belanja Hibah Prov
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Pengeluaran dari Kas Hibah Prov (LPD/Juru Raksa). Akun insentif 5.1.4 disembunyikan.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Pilih Belanja Prov</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 5. Belanja Hibah Kabupaten */}
                <button
                  type="button"
                  onClick={() => setSelectedType('belanja_hibah_kab')}
                  className="group text-left p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-slate-800/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between"
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
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      Belanja Hibah Kabupaten
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Pengeluaran dari Kas Hibah Kab (LPD/Juru Raksa). Hanya menampilkan akun 5.1.4 & 5.2.3.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span>Pilih Belanja Kab</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          ) : selectedType === 'pendapatan' ? (
            /* STEP 2: PENDAPATAN (PILIH KREDIT, AUTO DEBET) */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <Info size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  <strong>Aturan Akun Pendapatan:</strong> Pilih salah satu akun Pendapatan di bawah (posisi Kredit). Akun Debet (Kas penerima) akan otomatis disesuaikan dengan aturan akuntansi (contoh: Hibah Prov dialokasikan ke Kas Hibah Prov LPD 1.1.2.02, Dana Punia ke Kas Punia Tunai 1.1.1.04, dll).
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Coins size={15} className="text-amber-500" />
                    <span>Pilih Rekening Kredit (Pendapatan)</span>
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {kreditAccounts.length} rekening tersedia
                  </span>
                </div>

                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchKredit}
                    onChange={(e) => setSearchKredit(e.target.value)}
                    placeholder="Cari kode atau nama rekening pendapatan..."
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    autoFocus
                  />
                  {searchKredit && (
                    <button
                      type="button"
                      onClick={() => setSearchKredit('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                  {kreditAccounts.map((item) => {
                    const resolvedDebetCode = getDebetForPendapatan(item.code);
                    const debetItem = REFERENSI_REKENING.find(r => r.code === resolvedDebetCode);
                    const isSelected = selectedKredit === item.code;

                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelectKredit(item.code)}
                        className={`text-left p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
                            : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 mb-1">
                              {item.code}
                            </span>
                            <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {item.name}
                            </h5>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          )}
                        </div>
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Debet Otomatis:</span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">
                            {resolvedDebetCode} ({debetItem?.name || 'Kas'})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {kreditAccounts.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-xs text-slate-400 italic">
                      Tidak ada rekening pendapatan yang cocok dengan pencarian "{searchKredit}".
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: MUTASI & SEMUA JENIS BELANJA (KREDIT & DEBET BOXES) */
            <div className="space-y-4">
              {/* Petunjuk Aturan */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <Info size={18} className="text-teal-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedType === 'mutasi' && (
                    <span>
                      <strong>Aturan Mutasi:</strong> Pilih rekening Kas pengirim di box <strong>Kredit</strong> dan rekening Kas penerima di box <strong>Debet</strong>. Setelah kedua box terpilih, modal otomatis menutup dan membuka form Jurnal Umum.
                    </span>
                  )}
                  {selectedType === 'belanja_adat' && (
                    <span>
                      <strong>Aturan Belanja Adat:</strong> Pilih kas di box <strong>Kredit</strong> (Kas Desa Adat / Juru Raksa) dan akun belanja di box <strong>Debet</strong> (Beban insentif 5.1.1 & 5.1.4 disembunyikan). Setelah kedua box terpilih, modal langsung membuka form Jurnal Umum.
                    </span>
                  )}
                  {selectedType === 'belanja_hibah_prov' && (
                    <span>
                      <strong>Aturan Belanja Hibah Prov:</strong> Pilih kas di box <strong>Kredit</strong> (Kas Hibah Prov LPD / Juru Raksa) dan akun belanja di box <strong>Debet</strong> (Beban insentif 5.1.4 disembunyikan). Setelah kedua box terpilih, form Jurnal Umum otomatis terbuka.
                    </span>
                  )}
                  {selectedType === 'belanja_hibah_kab' && (
                    <span>
                      <strong>Aturan Belanja Hibah Kabupaten:</strong> Pilih kas di box <strong>Kredit</strong> (Kas Hibah Kab LPD / Juru Raksa) dan pos belanja di box <strong>Debet</strong> (Hanya menampilkan akun 5.1.4 dan 5.2.3). Setelah kedua box terpilih, form Jurnal Umum otomatis terbuka.
                    </span>
                  )}
                </div>
              </div>

              {/* Status Pilihan Terisi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    1. Akun Kredit:
                  </span>
                  {selectedKredit ? (
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
                      ✓ {selectedKredit} - {REFERENSI_REKENING.find(r => r.code === selectedKredit)?.name || selectedKredit}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 italic">Belum dipilih</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    2. Akun Debet:
                  </span>
                  {selectedDebet ? (
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">
                      ✓ {selectedDebet} - {REFERENSI_REKENING.find(r => r.code === selectedDebet)?.name || selectedDebet}
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 italic">Belum dipilih</span>
                  )}
                </div>
              </div>

              {/* Dual Columns: Kredit & Debet Boxes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* BOX KREDIT */}
                <div className="p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Wallet size={15} className="text-amber-600 dark:text-amber-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Box Kredit (Sumber Kas)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {kreditAccounts.length} akun
                    </span>
                  </div>

                  {/* Search Kredit */}
                  <div className="relative mb-2.5">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchKredit}
                      onChange={(e) => setSearchKredit(e.target.value)}
                      placeholder="Cari akun kredit..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* List Kredit */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar flex-1">
                    {kreditAccounts.map((item) => {
                      const isSelected = selectedKredit === item.code;
                      const isSameAsDebet = selectedType === 'mutasi' && selectedDebet === item.code;

                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => handleSelectKredit(item.code)}
                          disabled={isSameAsDebet}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                            isSameAsDebet
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                              : isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/20'
                              : 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mr-2">
                              {item.code}
                            </span>
                            <span className="text-xs font-semibold">
                              {item.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Check size={16} className="text-emerald-600 shrink-0" />
                          )}
                          {isSameAsDebet && (
                            <span className="text-[10px] text-rose-500 shrink-0">Akun Debet</span>
                          )}
                        </button>
                      );
                    })}
                    {kreditAccounts.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        Tidak ada akun kredit yang sesuai.
                      </div>
                    )}
                  </div>
                </div>

                {/* BOX DEBET */}
                <div className="p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag size={15} className="text-teal-600 dark:text-teal-400" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Box Debet ({selectedType === 'mutasi' ? 'Kas Penerima' : 'Beban Belanja'})
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {debetAccounts.length} akun
                    </span>
                  </div>

                  {/* Search Debet */}
                  <div className="relative mb-2.5">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchDebet}
                      onChange={(e) => setSearchDebet(e.target.value)}
                      placeholder="Cari akun debet..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* List Debet */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar flex-1">
                    {debetAccounts.map((item) => {
                      const isSelected = selectedDebet === item.code;
                      const isSameAsKredit = selectedType === 'mutasi' && selectedKredit === item.code;

                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => handleSelectDebet(item.code)}
                          disabled={isSameAsKredit}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                            isSameAsKredit
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                              : isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/20'
                              : 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mr-2">
                              {item.code}
                            </span>
                            <span className="text-xs font-semibold">
                              {item.name}
                            </span>
                          </div>
                          {isSelected && (
                            <Check size={16} className="text-emerald-600 shrink-0" />
                          )}
                          {isSameAsKredit && (
                            <span className="text-[10px] text-rose-500 shrink-0">Akun Kredit</span>
                          )}
                        </button>
                      );
                    })}
                    {debetAccounts.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        Tidak ada akun debet yang sesuai.
                      </div>
                    )}
                  </div>
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
            {selectedType ? '← Kembali' : 'Batal'}
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
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Lanjut ke Input Jurnal</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
