import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronDown, X, Sparkles, Clock, Layers, Check, Search } from 'lucide-react';

export interface UraianOption {
  uraian: string;
  category: string;
  source: 'account' | 'history' | 'standard';
  matchCodes?: string[];
}

// 45+ Pilihan Standar Transaksi Keuangan Desa Adat Bali (KDA V.3.1)
export const STANDARD_DESA_ADAT_URAIAN: { uraian: string; category: string; matchCodes?: string[] }[] = [
  // 1. Operasional & Kantor
  { uraian: 'Belanja Alat Tulis Kantor (ATK) dan Kebutuhan Kantor', category: 'Operasional', matchCodes: ['5.1.2.01'] },
  { uraian: 'Pengadaan Kertas HVS, Tinta Printer, dan Stopmap Arsip', category: 'Operasional', matchCodes: ['5.1.2.01'] },
  { uraian: 'Belanja Konsumsi Paruman / Rapat Desa Adat', category: 'Operasional', matchCodes: ['5.1.2.02'] },
  { uraian: 'Belanja Konsumsi Rapat Koordinasi Prajuru & Pemangku', category: 'Operasional', matchCodes: ['5.1.2.02'] },
  { uraian: 'Pembayaran Langganan Internet & Wifi Kantor Desa Adat', category: 'Operasional', matchCodes: ['5.1.2.03'] },
  { uraian: 'Pembayaran Token Listrik PLN Pura Puseh', category: 'Operasional', matchCodes: ['5.1.2.07'] },
  { uraian: 'Pembayaran Token Listrik PLN Kantor Desa Adat', category: 'Operasional', matchCodes: ['5.1.2.07'] },
  { uraian: 'Pembayaran Tagihan Air PDAM Pura Puseh', category: 'Operasional', matchCodes: ['5.1.2.08'] },
  { uraian: 'Belanja Pemeliharaan & Servis Peralatan Kantor', category: 'Operasional', matchCodes: ['5.1.2', '5.1.4.04'] },
  { uraian: 'Belanja Penggandaan / Fotokopi Dokumen Administrasi', category: 'Operasional', matchCodes: ['5.1.2.01'] },
  { uraian: 'Belanja Perlengkapan & Sarana Kebersihan', category: 'Operasional', matchCodes: ['5.1.2'] },

  // 2. Insentif & Honorarium Prajuru
  { uraian: 'Pembayaran Insentif Bendesa Adat / Keliang Desa', category: 'Insentif', matchCodes: ['5.1.1.01'] },
  { uraian: 'Pembayaran Insentif Penyarikan (Sekretaris) Desa Adat', category: 'Insentif', matchCodes: ['5.1.1.02'] },
  { uraian: 'Pembayaran Insentif Petajuh (Wakil Bendesa) Desa Adat', category: 'Insentif', matchCodes: ['5.1.1.03'] },
  { uraian: 'Pembayaran Insentif Juru Raksa (Bendahara) Desa Adat', category: 'Insentif', matchCodes: ['5.1.1.04'] },
  { uraian: 'Pembayaran Honorarium Tenaga Administrasi / Operator Sistem', category: 'Insentif', matchCodes: ['5.1.1.05'] },
  { uraian: 'Pembayaran Insentif Penempek / Prajuru Banjar Adat', category: 'Insentif', matchCodes: ['5.1.1.06'] },
  { uraian: 'Pembayaran Insentif Istri Penempek / PKK Banjar Adat', category: 'Insentif', matchCodes: ['5.1.1.07'] },
  { uraian: 'Pembayaran Insentif Serati Banten Desa Adat', category: 'Insentif', matchCodes: ['5.1.1.08'] },
  { uraian: 'Pembayaran Honor / Uang Saku Pengamanan Pecalang Desa Adat', category: 'Insentif', matchCodes: ['5.1.3.03'] },
  { uraian: 'Biaya Perjalanan Dinas / Uang Saku Tugas Luar Prajuru', category: 'Insentif', matchCodes: ['5.1.3.01', '5.1.3.02'] },

  // 3. Upakara, Parhyangan & Piodalan
  { uraian: 'Biaya Upakara & Pelaksanaan Piodalan Pura Bale Agung', category: 'Parhyangan', matchCodes: ['5.2.1.04', '5.2'] },
  { uraian: 'Biaya Upakara & Pelaksanaan Piodalan Pura Puseh', category: 'Parhyangan', matchCodes: ['5.2.1.05', '5.2'] },
  { uraian: 'Biaya Dana Aci Usabe Ageng Desa Adat', category: 'Parhyangan', matchCodes: ['5.2.1.03', '5.2', '1.1.1.04'] },
  { uraian: 'Biaya Dana Aci Usabe Dalem Desa Adat', category: 'Parhyangan', matchCodes: ['5.2.1.03', '5.2', '1.1.1.05'] },
  { uraian: 'Biaya Dana Aci Pura Melanting Desa Adat', category: 'Parhyangan', matchCodes: ['5.2.1.02', '5.2', '1.1.1.07'] },
  { uraian: 'Biaya Upakara & Banten Hari Raya Galungan dan Kuningan', category: 'Parhyangan', matchCodes: ['5.2.1.07', '5.2.1.08', '5.2'] },
  { uraian: 'Biaya Upakara Pecanangan Pura Kahyangan Tiga', category: 'Parhyangan', matchCodes: ['5.2.1.06', '5.2'] },
  { uraian: 'Biaya Upakara Tawur Kesanga & Pengerupukan Nyepi', category: 'Parhyangan', matchCodes: ['5.2'] },
  { uraian: 'Biaya Pembelian Sarana Upakara (Beras, Kelapa, Daksina, dll)', category: 'Parhyangan', matchCodes: ['5.2.1.12', '5.2'] },
  { uraian: 'Belanja Pemeliharaan Sarana dan Prasarana Bangunan Pura', category: 'Parhyangan', matchCodes: ['5.2.1.10', '5.2.1.11', '5.2.1.12'] },

  // 4. Pawongan & Palemahan
  { uraian: 'Bantuan Pembinaan Pasraman Kilat Remaja Desa Adat', category: 'Pawongan', matchCodes: ['5.3.1.01'] },
  { uraian: 'Biaya Pembinaan & Pelestarian Sekaa Gong / Seni Tari Wali', category: 'Pawongan', matchCodes: ['5.3.1.02', '5.1.4.03'] },
  { uraian: 'Bantuan Dana Kedukaan / Santunan Kematian Krama Adat', category: 'Pawongan', matchCodes: ['5.3'] },
  { uraian: 'Biaya Pelaksanaan Pesangkepan / Paruman Krama Adat', category: 'Pawongan', matchCodes: ['5.1.4.07'] },
  { uraian: 'Biaya Gotong Royong Kebersihan Lingkungan & Wewidangan', category: 'Palemahan', matchCodes: ['5.4', '5.1'] },
  { uraian: 'Biaya Pengangkutan & Pengelolaan Sampah Desa Adat', category: 'Palemahan', matchCodes: ['5.4', '5.1'] },

  // 5. Pendapatan & Penerimaan
  { uraian: 'Penerimaan Dana Punia Sukarela Upakara dari Krama Adat', category: 'Pendapatan', matchCodes: ['4.1.1.01'] },
  { uraian: 'Penerimaan Dana Punia Pemedek / Donatur Luar Desa', category: 'Pendapatan', matchCodes: ['4.1.1.01'] },
  { uraian: 'Penerimaan Iuran Wajib / Urunan Krama Desa Adat', category: 'Pendapatan', matchCodes: ['7.1.2.02', '4.1'] },
  { uraian: 'Penerimaan Hibah Pemerintah Provinsi Bali', category: 'Pendapatan', matchCodes: ['4.1.3.01'] },
  { uraian: 'Penerimaan Hibah Pemerintah Kabupaten', category: 'Pendapatan', matchCodes: ['4.1.3.02'] },
  { uraian: 'Penerimaan Bagi Hasil Laba Bersih LPD kepada Desa Adat', category: 'Pendapatan', matchCodes: ['4.1.2.03'] },
  { uraian: 'Penerimaan Bagi Hasil Bunga Simpanan / Deposito Bank BPD', category: 'Pendapatan', matchCodes: ['4.1.2.02'] },
  { uraian: 'Penerimaan Hasil Usaha Pengelolaan BUPDA Desa Adat', category: 'Pendapatan', matchCodes: ['4.1.1.03', '4.1.2.01'] },
  { uraian: 'Penerimaan Bagi Hasil Retribusi Wisata / Parkir Desa Adat', category: 'Pendapatan', matchCodes: ['4.1.2.01'] },

  // 6. Kas, Perbankan, Utang & Pajak
  { uraian: 'Penyetoran Kas Tunai ke Rekening Bank BPD Bali Desa Adat', category: 'Kas & Bank', matchCodes: ['1.1'] },
  { uraian: 'Penarikan Tunai dari Rekening Bank BPD Bali', category: 'Kas & Bank', matchCodes: ['1.1'] },
  { uraian: 'Pemindahan Dana / Mutasi Kas Antar Rekening Desa Adat', category: 'Kas & Bank', matchCodes: ['1.1'] },
  { uraian: 'Pelunasan Utang Belanja Pengadaan Barang / Jasa Rekanan', category: 'Utang', matchCodes: ['2.1.1.04', '2.1'] },
  { uraian: 'Pencatatan Utang Belanja Pembelian Barang Secara Kredit', category: 'Utang', matchCodes: ['2.1.1.04', '2.1'] },
  { uraian: 'Penerimaan Titipan Pajak PPh/PPN Pengadaan Belanja', category: 'Pajak', matchCodes: ['2.1.1.03'] },
  { uraian: 'Penyetoran Titipan Pajak PPh/PPN ke Kas Negara', category: 'Pajak', matchCodes: ['2.1.1.03'] },
  { uraian: 'Pencatatan Saldo Awal Kas dan Modal Awal Desa Adat', category: 'Modal', matchCodes: ['4.1.1.04', '3.1.1.06'] },
];

interface UraianDropdownInputProps {
  value: string;
  onChange: (val: string) => void;
  akunDebet?: string;
  akunKredit?: string;
  existingUraians?: string[];
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

export const UraianDropdownInput: React.FC<UraianDropdownInputProps> = ({
  value,
  onChange,
  akunDebet = '',
  akunKredit = '',
  existingUraians = [],
  placeholder = 'Masukkan uraian transaksi (klik untuk pilihan)...',
  required = false,
  id = 'input-uraian-transaksi',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [pos, setPos] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update posisi dropdown agar tinggi, lapang, dan menutup box tanggal seperti di gambar
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const inputRect = inputRef.current.getBoundingClientRect();
    const modalEl = (inputRef.current.closest('.max-w-4xl') || inputRef.current.closest('[role="dialog"]') || inputRef.current.closest('.fixed')) as HTMLElement | null;

    if (modalEl) {
      const modalRect = modalEl.getBoundingClientRect();
      const dateInput = modalEl.querySelector('input[type="date"]') as HTMLElement | null;
      const dateBox = dateInput ? (dateInput.closest('.rounded-2xl') as HTMLElement || dateInput.parentElement as HTMLElement || dateInput) : null;
      const dateRect = dateBox ? dateBox.getBoundingClientRect() : null;

      // Dropdown meluncur ke atas menutup box tanggal secara presisi
      // Jika box tanggal terdeteksi, posisikan top tepat di atas batas atas box tanggal
      const targetTop = dateRect && dateRect.top > 0 
        ? Math.max(8, dateRect.top - 2) 
        : Math.max(12, modalRect.top + 36);
        
      const targetBottom = Math.min(window.innerHeight - 12, modalRect.bottom - 20);
      const targetHeight = Math.max(480, targetBottom - targetTop);

      // Posisi horizontal: mencakup kolom kiri tempat date box dan input berada
      const targetLeft = dateRect && dateRect.left > 0
        ? Math.max(12, Math.min(dateRect.left, inputRect.left))
        : Math.max(12, inputRect.left);
        
      const maxAvailableWidth = Math.max(340, modalRect.right - targetLeft - 16);
      const targetWidth = Math.min(maxAvailableWidth, Math.max(inputRect.width, (dateRect?.width || 0), 520));

      setPos({
        top: targetTop,
        left: targetLeft,
        width: targetWidth,
        height: targetHeight,
      });
    } else {
      // Fallback jika berada di luar modal dialog
      const targetTop = Math.max(16, inputRect.top - 500);
      const targetHeight = Math.min(560, window.innerHeight - 32);
      const targetLeft = Math.max(16, inputRect.left);
      const targetWidth = Math.max(inputRect.width, 500);

      setPos({
        top: targetTop,
        left: targetLeft,
        width: targetWidth,
        height: targetHeight,
      });
    }
  }, []);

  // Update posisi saat popup dibuka atau layar diubah
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      const handleWindowChange = () => {
        updatePosition();
      };

      window.addEventListener('resize', handleWindowChange);
      window.addEventListener('scroll', handleWindowChange, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleWindowChange);
        window.removeEventListener('scroll', handleWindowChange, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Tutup dropdown saat klik di luar atau tekan ESC
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Kode akun debet dan kredit bersih
  const debetCode = akunDebet ? akunDebet.split(' - ')[0].trim() : '';
  const kreditCode = akunKredit ? akunKredit.split(' - ')[0].trim() : '';

  // Gabungkan seluruh daftar pilihan: Rekomendasi Akun, Riwayat, dan Standar KDA
  const allOptions = useMemo<UraianOption[]>(() => {
    const list: UraianOption[] = [];
    const seen = new Set<string>();

    // 1. Rekomendasi berdasarkan Akun yang sedang dipilih
    if (debetCode || kreditCode) {
      STANDARD_DESA_ADAT_URAIAN.forEach((item) => {
        const matchesDebet = item.matchCodes?.some((code) => debetCode.startsWith(code) || code.startsWith(debetCode));
        const matchesKredit = item.matchCodes?.some((code) => kreditCode.startsWith(code) || code.startsWith(kreditCode));
        if (matchesDebet || matchesKredit) {
          if (!seen.has(item.uraian.toLowerCase())) {
            seen.add(item.uraian.toLowerCase());
            list.push({
              uraian: item.uraian,
              category: item.category,
              source: 'account',
            });
          }
        }
      });
    }

    // 2. Riwayat transaksi jurnal yang pernah dicatat sebelumnya
    existingUraians.forEach((histUraian) => {
      const clean = histUraian.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        list.push({
          uraian: clean,
          category: 'Riwayat',
          source: 'history',
        });
      }
    });

    // 3. Seluruh Pilihan Standar Transaksi Desa Adat
    STANDARD_DESA_ADAT_URAIAN.forEach((item) => {
      if (!seen.has(item.uraian.toLowerCase())) {
        seen.add(item.uraian.toLowerCase());
        list.push({
          uraian: item.uraian,
          category: item.category,
          source: 'standard',
        });
      }
    });

    return list;
  }, [debetCode, kreditCode, existingUraians]);

  // Daftar kategori unik untuk filter tabs
  const categories = useMemo(() => {
    const cats = ['Semua'];
    const hasAccountRec = allOptions.some((o) => o.source === 'account');
    if (hasAccountRec) cats.push('Sesuai Akun');
    const hasHistory = allOptions.some((o) => o.source === 'history');
    if (hasHistory) cats.push('Riwayat');
    cats.push('Operasional', 'Insentif', 'Parhyangan', 'Pendapatan', 'Kas & Bank', 'Utang');
    return cats;
  }, [allOptions]);

  // Filter berdasarkan teks input dan kategori aktif
  const filteredOptions = useMemo(() => {
    const searchLower = (value || '').toLowerCase().trim();

    return allOptions.filter((opt) => {
      // Filter kategori
      if (selectedCategory === 'Sesuai Akun' && opt.source !== 'account') return false;
      if (selectedCategory === 'Riwayat' && opt.source !== 'history') return false;
      if (selectedCategory !== 'Semua' && selectedCategory !== 'Sesuai Akun' && selectedCategory !== 'Riwayat') {
        if (opt.category !== selectedCategory) return false;
      }

      // Filter pencarian teks
      if (searchLower) {
        return opt.uraian.toLowerCase().includes(searchLower);
      }
      return true;
    });
  }, [allOptions, value, selectedCategory]);

  const handleSelect = (selectedText: string) => {
    onChange(selectedText);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            updatePosition();
            setIsOpen(true);
          }}
          onClick={() => {
            updatePosition();
            setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg pl-9 pr-16 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs cursor-text transition-all"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title="Hapus uraian"
            >
              <X size={14} />
            </button>
          )}

          {/* Tombol Panah Dropdown Toggle */}
          <button
            type="button"
            onClick={() => {
              if (!isOpen) updatePosition();
              setIsOpen((prev) => !prev);
            }}
            className="p-1 text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            title="Buka daftar pilihan uraian (Lapang & Menutup Box Tanggal)"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-600' : 'text-slate-400'}`}
            />
          </button>
        </div>
      </div>

      {/* POPUP DROPDOWN TINGGI & LAPANG (MENGGUNAKAN PORTAL AGAR MENUTUP BOX TANGGAL DENGAN BEBAS) */}
      {isOpen &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            id={`${id}-dropdown-popup`}
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              height: `${pos.height}px`,
              zIndex: 99999,
            }}
            className="bg-white dark:bg-slate-900 border-2 border-teal-500/80 dark:border-teal-400/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Panel Dropdown dengan Kolom Cari & Filter */}
            <div className="p-3 bg-gradient-to-r from-slate-50 via-teal-50/40 to-slate-50 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-600 text-white rounded-lg shadow-2xs">
                    <Layers size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      Pilihan Uraian Transaksi
                    </h4>
                    <p className="text-[10px] text-teal-700 dark:text-teal-400 font-medium">
                      Tampilan Lapang ({filteredOptions.length} pilihan tersedia)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    ESC
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Tutup (ESC)"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Input Pencarian Langsung di dalam Popup */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-600 dark:text-teal-400" size={15} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Ketik untuk mencari uraian (atau ketik uraian baru)..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 shadow-inner"
                />
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Kategori Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat === 'Sesuai Akun' && '⭐ '}
                      {cat === 'Riwayat' && '🕒 '}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List Pilihan Uraian (Sangat Lapang, Bebas, Memuat 18+ Baris Sekaligus) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 custom-scrollbar bg-white dark:bg-slate-900">
              {filteredOptions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 font-bold">
                    Tidak ada uraian tersimpan untuk &quot;{value}&quot;
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                    Anda dapat langsung menekan tombol Tutup atau klik di luar untuk menggunakan teks yang Anda ketik sebagai uraian jurnal.
                  </p>
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = value.trim().toLowerCase() === opt.uraian.toLowerCase();

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelect(opt.uraian)}
                      className={`w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-3 group cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-950 dark:text-teal-100 font-bold border-l-4 border-teal-600'
                          : 'hover:bg-teal-50/50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:text-teal-900 dark:hover:text-teal-200 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {opt.source === 'account' ? (
                          <Sparkles size={14} className="text-amber-500 shrink-0" />
                        ) : opt.source === 'history' ? (
                          <Clock size={14} className="text-blue-500 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 group-hover:bg-teal-500 transition-colors" />
                        )}
                        <span className="text-xs sm:text-[13px] leading-relaxed truncate font-medium group-hover:font-semibold">
                          {opt.uraian}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.source === 'account' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            ⭐ Sesuai Akun
                          </span>
                        ) : opt.source === 'history' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            🕒 Riwayat
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {opt.category}
                          </span>
                        )}

                        {isSelected && (
                          <Check size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Panel Info */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1">
                <span>💡</span> Klik salah satu baris untuk memilih langsung
              </span>
              <span className="font-mono text-[10px] text-slate-400">ESC / Klik luar untuk tutup</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default UraianDropdownInput;
