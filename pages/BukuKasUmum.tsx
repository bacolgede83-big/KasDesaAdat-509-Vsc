import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { BkuData, BkpData, JuDisplayRow, BudgetItem } from '../types';
import Pagination from '../components/bku/Pagination';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import Modal from '../components/shared/Modal';
import RegisterPenutupanBku from '../components/bku/RegisterPenutupanBku';
import { 
  BookOpen, Search, Download, Printer, Wallet, Trash2, 
  Calendar, Filter, Settings, ArrowLeftRight, CheckCircle2, 
  FileSpreadsheet, ShieldCheck, ArrowDownLeft, ArrowUpRight,
  Info, RotateCcw, Landmark, Building2, Layers, CheckSquare,
  FileCheck2, Stamp, Menu, ChevronDown, Sliders, Maximize2, FileText
} from 'lucide-react';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency, numberToWords, formatDate } from '../utils/formatter';
import { REFERENSI_REKENING, isKasAccount } from '../constants';
import { generateSequentialJuId } from '../utils/financialValidator';
import ExportPdfButton from '../components/shared/ExportPdfButton';
import { 
  getStoredSignatures, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  saveSignatureSettings, 
  setStampOverlayEnabled, 
  DigitalSignatures 
} from '../utils/signatureStorage';
import { ReportSignatureBlock } from '../components/shared/ReportSignatureBlock';
import { FileSignature } from 'lucide-react';

declare const XLSX: any;

interface BukuKasUmumProps {
  bkuData: BkuData[];
  bkpData?: BkpData[];
  entries?: JuDisplayRow[];
  budgetItems?: BudgetItem[];
  onSubmit?: (juRows: JuDisplayRow[], bkuRows: Omit<BkuData, 'id' | 'saldo'>[], bkpItems: Omit<BkpData, 'id' | 'saldo'>[], oldIdTransaksi?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onReplace?: (data: BkuData[]) => void;
}

export interface BkuRowItem {
  id: string;
  idTransaksi?: string;
  tanggal: string;
  bukti: string;
  kode: string;
  namaAkun?: string;
  uraian: string;
  kategori?: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
  createdAt?: number;
}

const BukuKasUmum: React.FC<BukuKasUmumProps> = ({ 
  bkuData = [], 
  bkpData = [], 
  entries = [],
  budgetItems = [],
  onDelete, 
  onReplace 
}) => {
  const { showPermissionDenied } = useNotification();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showQuickFilter, setShowQuickFilter] = useState<boolean>(false);
  
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'bku_table' | 'register_penutupan'>('bku_table');
  const [isFullScreenRegister, setIsFullScreenRegister] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Digital Signatures & Stamp State
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStampOverlay, setShowStampOverlay] = useState<boolean>(() => isStampOverlayEnabled());
  const [tempAutoEmbed, setTempAutoEmbed] = useState<boolean>(embedSignatures);
  const [tempShowStamp, setTempShowStamp] = useState<boolean>(showStampOverlay);

  useEffect(() => {
    const handleUpdateSigs = () => {
      setSignatures(getStoredSignatures());
      const embed = isAutoEmbedSignaturesEnabled();
      const stamp = isStampOverlayEnabled();
      setEmbedSignatures(embed);
      setShowStampOverlay(stamp);
      setTempAutoEmbed(embed);
      setTempShowStamp(stamp);
    };
    window.addEventListener('signatures-updated', handleUpdateSigs);
    return () => window.removeEventListener('signatures-updated', handleUpdateSigs);
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Signature Configuration State
  const [keliangName, setKeliangName] = useState(() => localStorage.getItem('bku_keliangName') || 'I Made Mudita');
  const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('bku_juruRaksaName') || 'I Putu Gede Sutrana');
  const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('bku_customPlace') || 'Basangalas');
  const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('bku_signatureDate') || new Date().toISOString().split('T')[0]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [tempKeliangName, setTempKeliangName] = useState(keliangName);
  const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
  const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
  const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
  const [isConfirmSaveSettingsOpen, setIsConfirmSaveSettingsOpen] = useState(false);

  const itemsPerPage = 15;

  const handleOpenSettings = () => {
    setTempKeliangName(keliangName);
    setTempJuruRaksaName(juruRaksaName);
    setTempCustomPlace(customPlace);
    setTempSignatureDate(signatureDate);
    setTempAutoEmbed(isAutoEmbedSignaturesEnabled());
    setTempShowStamp(isStampOverlayEnabled());
    setIsSettingsOpen(true);
  };

  const handleConfirmSaveSettings = () => {
    setKeliangName(tempKeliangName);
    setJuruRaksaName(tempJuruRaksaName);
    setCustomPlace(tempCustomPlace);
    setSignatureDate(tempSignatureDate);

    localStorage.setItem('bku_keliangName', tempKeliangName);
    localStorage.setItem('bku_juruRaksaName', tempJuruRaksaName);
    localStorage.setItem('bku_customPlace', tempCustomPlace);
    localStorage.setItem('bku_signatureDate', tempSignatureDate);

    // Simpan status tanda tangan digital dan stempel resmi
    saveSignatureSettings({ autoEmbed: tempAutoEmbed });
    setStampOverlayEnabled(tempShowStamp);
    setEmbedSignatures(tempAutoEmbed);
    setShowStampOverlay(tempShowStamp);
    window.dispatchEvent(new Event('signatures-updated'));

    setIsConfirmSaveSettingsOpen(false);
    setIsSettingsOpen(false);
    setNotification({ message: 'Pengaturan tanda tangan & stempel BKU berhasil diperbarui!', type: 'success' });
  };

  // Map Nama Rekening dari CoA
  const coaMap = useMemo(() => {
    const map = new Map<string, string>();
    REFERENSI_REKENING.forEach(r => {
      map.set(r.code, r.name);
    });
    if (budgetItems) {
      budgetItems.forEach(b => {
        if (b.kode && !map.has(b.kode)) {
          map.set(b.kode, b.uraian || b.keterangan || 'Pos Anggaran');
        }
      });
    }
    return map;
  }, [budgetItems]);

  const getCategoryDisplayLabel = (val: string) => {
    if (!val) return '';
    const accName = coaMap.get(val);
    if (accName) {
      return `${val} ${accName}`;
    }
    return val;
  };

  // Map Bukti Transaksi dari BKP jika ada
  const bkpBuktiMap = useMemo(() => {
    const map = new Map<string, string>();
    bkpData.forEach(b => {
      if (b.idTransaksi && b.bukti) {
        map.set(b.idTransaksi, b.bukti);
      }
    });
    return map;
  }, [bkpData]);

  // Tahun yang tersedia dari master entries dan bkuData
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    
    entries.forEach(e => {
      if (e.date) {
        const year = e.date.split('-')[0];
        if (year) years.add(year);
      }
    });

    bkuData.forEach(b => {
      if (b.tanggal) {
        const year = b.tanggal.split('-')[0];
        if (year) years.add(year);
      }
    });

    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [entries, bkuData]);

  // Bulan yang tersedia
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const processDate = (dateStr?: string) => {
      if (!dateStr) return;
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const itemYear = parts[0];
        const itemMonth = parts[1];
        if (!selectedYear || itemYear === selectedYear) {
          months.add(itemMonth);
        }
      }
    };

    entries.forEach(e => processDate(e.date));
    bkuData.forEach(b => processDate(b.tanggal));

    return Array.from(months).sort();
  }, [entries, bkuData, selectedYear]);

  const formatMonthLabelOnly = (mm: string) => {
    const date = new Date(2000, Number(mm) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long' });
  };

  const formatMonthLabelFull = (yyyyMm: string) => {
    const [year, month] = yyyyMm.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // =========================================================================
  // NORMALISASI TRANSAKSI BUKU KAS UMUM (STANDAR NASIONAL)
  // =========================================================================
  const allBkuRows = useMemo<BkuRowItem[]>(() => {
    // Jika ada entries Jurnal Umum, gunakan sebagai single source of truth untuk kas flows (Standar Nasional)
    if (entries.length > 0) {
      // Ambil seluruh transaksi yang mempengaruhi kas/bank (seluruh akun Kas & Setara Kas 1.1.*)
      const cashEntries = entries.filter(e => isKasAccount(e.kodeRekening));
      
      return cashEntries.map((e, idx) => {
        // No. Bukti di BKU adalah ID Transaksi Jurnal (JU-yymmdd-number) agar validasi data tetap terjaga
        const idTx = e.idTransaksi || generateSequentialJuId(e.date, entries, bkuData, bkpData);
        const debetVal = Number(e.debet || 0);
        const kreditVal = Number(e.kredit || 0);
        const nama = coaMap.get(e.kodeRekening) || e.namaRekening || e.kodeRekening;

        return {
          id: e.rowId || `${idTx}-${idx}`,
          idTransaksi: idTx,
          tanggal: e.date,
          bukti: idTx, // No. Bukti BKU adalah ID Transaksi di Jurnal (format JU-yymmdd-number)
          kode: e.kodeRekening,
          namaAkun: nama,
          uraian: e.uraian,
          kategori: e.kategori,
          penerimaan: debetVal,
          pengeluaran: kreditVal,
          saldo: 0,
          createdAt: e.createdAt || idx
        };
      });
    }

    // Fallback ke bkuData
    return bkuData.map((b, idx) => {
      const idTx = b.idTransaksi || b.noBukti || b.bukti || generateSequentialJuId(b.tanggal, entries, bkuData, bkpData);
      const kode = b.kode || '1.1.1.01';
      const nama = coaMap.get(kode) || b.kategori || kode;
      return {
        id: b.id || `BKU-${idx}`,
        idTransaksi: idTx,
        tanggal: b.tanggal,
        bukti: idTx, // No. Bukti BKU adalah ID Transaksi di Jurnal (format JU-yymmdd-number)
        kode,
        namaAkun: nama,
        uraian: b.uraian,
        kategori: b.kategori,
        penerimaan: Number(b.penerimaan || 0),
        pengeluaran: Number(b.pengeluaran || 0),
        saldo: 0,
        createdAt: b.createdAt || Number(b.id) || idx
      };
    });
  }, [entries, bkuData, bkpData, coaMap]);

  // Helper pencocokan filter Kategori / Akun Rekening
  const matchesCategoryFilter = (item: { kategori?: string; kode?: string; namaAkun?: string }, category: string) => {
    if (!category) return true;
    const lowerCat = category.toLowerCase().trim();
    const itemKode = (item.kode || '').trim().toLowerCase();
    const itemKategori = (item.kategori || '').trim().toLowerCase();
    const itemNamaAkun = (item.namaAkun || '').trim().toLowerCase();
    const combined = `${item.kode || ''} ${item.namaAkun || ''}`.trim().toLowerCase();

    return (
      item.kategori === category ||
      item.kode === category ||
      itemKode === lowerCat ||
      itemKategori === lowerCat ||
      itemNamaAkun.includes(lowerCat) ||
      combined.includes(lowerCat)
    );
  };

  // =========================================================================
  // SALDO PINDAHAN / AWAL (PERIODE LALU)
  // =========================================================================
  const { saldoPindahan, pindahanLabel } = useMemo(() => {
    if (!selectedYear && !selectedMonth) {
      return { saldoPindahan: 0, pindahanLabel: '' };
    }

    let cutoffDate = "";
    let label = "";

    if (selectedMonth && selectedYear) {
      cutoffDate = `${selectedYear}-${selectedMonth}-01`;
      label = "SALDO BULAN LALU";
    } else if (selectedYear) {
      cutoffDate = `${selectedYear}-01-01`;
      label = "SALDO TAHUN SEBELUMNYA";
    } else if (selectedMonth) {
      label = "SALDO BULAN LALU";
    }

    let prevRows = allBkuRows.filter(r => {
      if (!r.tanggal) return false;
      if (cutoffDate) return r.tanggal < cutoffDate;
      if (selectedMonth) {
        const parts = r.tanggal.split('-');
        return parts.length >= 2 && parts[1] < selectedMonth;
      }
      return false;
    });

    // Mengikuti filter Kategori / Akun jika dipilih agar saldo bulan lalu sesuai akun bersangkutan
    if (selectedCategory) {
      prevRows = prevRows.filter(r => matchesCategoryFilter(r, selectedCategory));
    }

    const saldo = prevRows.reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);
    return { saldoPindahan: saldo, pindahanLabel: label };
  }, [allBkuRows, selectedYear, selectedMonth, selectedCategory]);

  // =========================================================================
  // DATA BKU TERFILTER & RUNNING BALANCE
  // =========================================================================
  const filteredData = useMemo(() => {
    let result = allBkuRows;

    // Filter Tahun
    if (selectedYear) {
      result = result.filter(item => item.tanggal && item.tanggal.startsWith(selectedYear));
    }

    // Filter Bulan
    if (selectedMonth && selectedYear) {
      const prefix = `${selectedYear}-${selectedMonth}`;
      result = result.filter(item => item.tanggal && item.tanggal.startsWith(prefix));
    } else if (selectedMonth && !selectedYear) {
      result = result.filter(item => item.tanggal && item.tanggal.split('-')[1] === selectedMonth);
    }

    // Filter Kategori / Akun
    if (selectedCategory) {
      result = result.filter(item => matchesCategoryFilter(item, selectedCategory));
    }

    // Filter Pencarian
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(item => 
        (item.uraian && item.uraian.toLowerCase().includes(lower)) ||
        (item.bukti && item.bukti.toLowerCase().includes(lower)) ||
        (item.kode && item.kode.toLowerCase().includes(lower)) ||
        (item.namaAkun && item.namaAkun.toLowerCase().includes(lower)) ||
        (item.idTransaksi && item.idTransaksi.toLowerCase().includes(lower))
      );
    }

    // Urutkan kronologis (Tanggal ASC, createdAt ASC)
    const sorted = [...result].sort((a, b) => {
      const dateA = new Date(a.tanggal || 0).getTime();
      const dateB = new Date(b.tanggal || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    // Hitung Saldo Berjalan (Running Balance)
    let running = (selectedYear || selectedMonth) ? saldoPindahan : 0;
    return sorted.map(item => {
      running += (item.penerimaan - item.pengeluaran);
      return { ...item, saldo: running };
    });
  }, [allBkuRows, selectedYear, selectedMonth, selectedCategory, searchTerm, saldoPindahan]);

  // Ringkasan Keuangan
  const summary = useMemo(() => {
    const penerimaan = filteredData.reduce((acc, item) => acc + item.penerimaan, 0);
    const pengeluaran = filteredData.reduce((acc, item) => acc + item.pengeluaran, 0);
    const mutasi = penerimaan - pengeluaran;
    const initialSaldo = (selectedYear || selectedMonth) ? saldoPindahan : 0;
    const totalSaldoAkhir = initialSaldo + mutasi;

    return { 
      saldoAwal: initialSaldo,
      penerimaan, 
      pengeluaran, 
      mutasiPeriode: mutasi,
      totalSaldoAkhir
    };
  }, [filteredData, saldoPindahan, selectedYear, selectedMonth]);

  // =========================================================================
  // RINCIAN KOMPOSISI SALDO KAS (BERITA ACARA PEMERIKSAAN KAS NYATA)
  // =========================================================================
  const cashBreakdown = useMemo(() => {
    // Hitung saldo kumulatif per rekening kas (1.1.1.* dan 1.1.2.*) per akhir periode terpilih
    const cutoffDate = (selectedYear && selectedMonth) 
      ? `${selectedYear}-${selectedMonth}-31` 
      : (selectedYear ? `${selectedYear}-12-31` : '9999-12-31');

    const relevantRows = allBkuRows.filter(r => r.tanggal <= cutoffDate);

    // 1. Kas Desa Adat (1.1.1.01)
    const kasDesaAdat = relevantRows
      .filter(r => r.kode === '1.1.1.01')
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    // 2. Kas Juru Raksa (1.1.1.02)
    const kasJuruRaksa = relevantRows
      .filter(r => r.kode === '1.1.1.02')
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    // 3. Kas Aset Lainnya (kode 1.1.2.*)
    const kasAsetLainnya = relevantRows
      .filter(r => r.kode && (r.kode.startsWith('1.1.2') || r.kode.startsWith('1.1.2.')))
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    // Rincian Akun Kas 1.1.1.* lainnya
    const kasSasahAbu = relevantRows
      .filter(r => r.kode === '1.1.1.03')
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    const kasDanaPuniaTunai = relevantRows
      .filter(r => r.kode === '1.1.1.04')
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    const kasBank = relevantRows
      .filter(r => r.kode === '1.1.1.05')
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    // 4. Kas Lainnya di luar 1.1.1.01, 1.1.1.02, dan 1.1.2.*
    const kasLainnya = relevantRows
      .filter(r => !['1.1.1.01', '1.1.1.02'].includes(r.kode) && !(r.kode && (r.kode.startsWith('1.1.2') || r.kode.startsWith('1.1.2.'))))
      .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);

    const totalKasNyata = kasDesaAdat + kasJuruRaksa + kasAsetLainnya + kasLainnya;
    
    // Selisih kas: jika filter akun dipilih, bandingkan kas nyata akun tersebut dengan saldo akhir BKU akun tersebut
    let selisihKas = totalKasNyata - summary.totalSaldoAkhir;
    if (selectedCategory) {
      const specificKasNyata = relevantRows
        .filter(r => matchesCategoryFilter(r, selectedCategory))
        .reduce((sum, r) => sum + (r.penerimaan - r.pengeluaran), 0);
      selisihKas = specificKasNyata - summary.totalSaldoAkhir;
    }

    return {
      kasDesaAdat,
      kasJuruRaksa,
      kasAsetLainnya,
      kasBank,
      kasSasahAbu,
      kasDanaPuniaTunai,
      kasLainnya,
      totalKasNyata,
      selisihKas
    };
  }, [allBkuRows, selectedYear, selectedMonth, selectedCategory, summary.totalSaldoAkhir]);

  // Kategori & Akun Unik HANYA dari data transaksi BKU yang ada,
  // dengan nama akun ditambahkan di belakang kode akun (contoh: 1.1.2.04 Kas JuruRaksa(HibProv))
  const uniqueCategories = useMemo(() => {
    const map = new Map<string, string>();

    allBkuRows.forEach(item => {
      // 1. Kode akun dari transaksi yang ada di BKU
      if (item.kode) {
        const rawCode = item.kode.trim();
        const accName = item.namaAkun || coaMap.get(rawCode);
        const label = accName && !rawCode.toLowerCase().includes(accName.toLowerCase())
          ? `${rawCode} ${accName}`
          : rawCode;
        map.set(rawCode, label);
      }

      // 2. Kategori transaksi yang ada di BKU
      if (item.kategori) {
        const rawCat = item.kategori.trim();
        if (rawCat) {
          const accName = coaMap.get(rawCat);
          const label = accName && !rawCat.toLowerCase().includes(accName.toLowerCase())
            ? `${rawCat} ${accName}`
            : rawCat;
          map.set(rawCat, label);
        }
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
  }, [allBkuRows, coaMap]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const pageSubtotal = useMemo(() => {
    const penerimaan = paginatedData.reduce((acc, item) => acc + item.penerimaan, 0);
    const pengeluaran = paginatedData.reduce((acc, item) => acc + item.pengeluaran, 0);
    return { penerimaan, pengeluaran };
  }, [paginatedData]);

  const handlePrintDocument = () => { window.print(); };

  const handleExportClick = () => {
    setExportFilename(`Buku_Kas_Umum_${selectedYear || 'SemuaTahun'}_${selectedMonth || 'SemuaBulan'}`);
    setIsExportModalOpen(true);
  };

  const processExportBku = () => {
    if (typeof XLSX === 'undefined') return;

    // Header Resmi Excel Standar Nasional
    const dataRows = [
      ["PEMERINTAH DESA ADAT BASANGALAS"],
      ["BUKU KAS UMUM (BKU)"],
      ["STANDAR NASIONAL PENATAUSAHAAN KEUANGAN DESA"],
      [`Periode: ${selectedMonth && selectedYear ? formatMonthLabelFull(`${selectedYear}-${selectedMonth}`) : (selectedYear ? `Tahun ${selectedYear}` : 'Seluruh Periode Transaksi')}`],
      [],
      ["NO", "TANGGAL", "NOMOR BUKTI", "URAIAN / KETERANGAN TRANSAKSI", "KODE REKENING", "PENERIMAAN (DEBET)", "PENGELUARAN (KREDIT)", "SALDO KAS (RP)"]
    ];

    if (selectedYear || selectedMonth) {
      dataRows.push([
        "",
        "",
        "",
        selectedCategory 
          ? `${pindahanLabel || "SALDO AWAL / PINDAHAN"} (${uniqueCategories.find(c => c.value === selectedCategory)?.label || selectedCategory})`
          : (pindahanLabel || "SALDO AWAL / PINDAHAN (KUMULATIF LALU)"),
        "",
        "",
        "",
        summary.saldoAwal
      ]);
    }

    filteredData.forEach((item, index) => {
      dataRows.push([
        index + 1,
        item.tanggal,
        item.bukti || item.idTransaksi || '-',
        item.uraian || '-',
        item.kode || '-',
        item.penerimaan || 0,
        item.pengeluaran || 0,
        item.saldo || 0
      ]);
    });

    dataRows.push([
      "",
      "",
      "",
      "JUMLAH MUTASI PERIODE INI",
      "",
      summary.penerimaan,
      summary.pengeluaran,
      summary.mutasiPeriode
    ]);

    dataRows.push([
      "",
      "",
      "",
      "SALDO AKHIR BUKU KAS UMUM (BKU)",
      "",
      "",
      "",
      summary.totalSaldoAkhir
    ]);

    dataRows.push([]);
    dataRows.push(["RINCIAN SALDO KAS / BERITA ACARA PEMERIKSAAN KAS:"]);
    dataRows.push(["1. Saldo Kas Desa Adat (1.1.1.01)", "", "", "", "", "", "", cashBreakdown.kasDesaAdat]);
    dataRows.push(["2. Saldo Kas Juru Raksa (1.1.1.02)", "", "", "", "", "", "", cashBreakdown.kasJuruRaksa]);
    dataRows.push(["3. Saldo Kas Aset Lainnya (1.1.2.*)", "", "", "", "", "", "", cashBreakdown.kasAsetLainnya]);
    dataRows.push(["4. Saldo Kas Lainnya (1.1.1.*)", "", "", "", "", "", "", cashBreakdown.kasLainnya]);
    dataRows.push(["TOTAL KAS NYATA", "", "", "", "", "", "", cashBreakdown.totalKasNyata]);
    dataRows.push(["SELISIH KAS", "", "", "", "", "", "", cashBreakdown.selisihKas === 0 ? "NIHIL (COCOK)" : cashBreakdown.selisihKas]);

    dataRows.push([]);
    dataRows.push([`Terbilang: ${numberToWords(Math.abs(summary.totalSaldoAkhir))} Rupiah`]);
    dataRows.push([]);
    dataRows.push(["", "Mengetahui,", "", "", "", `${customPlace}, ${formatDate(signatureDate)}`, "", ""]);
    dataRows.push(["", "Keliang Adat Basangalas", "", "", "", "Juru Raksa Desa Adat", "", ""]);
    dataRows.push([]);
    dataRows.push([]);
    dataRows.push(["", `( ${keliangName} )`, "", "", "", `( ${juruRaksaName} )`, "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buku Kas Umum");
    
    let finalFilename = exportFilename.trim();
    if (!finalFilename.endsWith('.xlsx')) finalFilename += '.xlsx';

    XLSX.writeFile(wb, finalFilename);
    setNotification({ message: 'Buku Kas Umum berhasil diekspor ke Excel.', type: 'success' });
    setIsExportModalOpen(false);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedYear('');
    setSelectedMonth('');
    setCurrentPage(1);
    setNotification({ message: 'Filter BKU berhasil direset.', type: 'success' });
  };

  return (
    <div className="bg-white p-4 sm:p-6 space-y-4" id="printable-area">
      {/* Styles Cetak Khusus BKU Standar Nasional Permendagri No. 20/2018 (Hanya aktif saat di tab BKU) */}
      {activeView === 'bku_table' && (
        <style>{`
          @media print {
            body:not(.print-receipt-mode) * { visibility: hidden; }
            body:not(.print-receipt-mode) #printable-area-bku-full, 
            body:not(.print-receipt-mode) #printable-area-bku-full * { visibility: visible !important; }
            body:not(.print-receipt-mode) #printable-area-bku-full { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%; 
              margin: 0; 
              padding: 20px !important; 
              display: block !important; 
              background: white !important; 
              color: black !important; 
            }
            body.print-receipt-mode #printable-area-bku-full {
              display: none !important;
              visibility: hidden !important;
            }
            .no-print { display: none !important; }
            table { width: 100% !important; border-collapse: collapse !important; font-size: 10px; page-break-inside: auto; }
            th, td { border: 1px solid #333 !important; padding: 4px 6px !important; color: black !important; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group !important; }
            tfoot { display: table-row-group !important; }
            thead th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; text-transform: uppercase; font-weight: bold; }
            .bku-summary-row { page-break-inside: avoid !important; break-inside: avoid !important; }
            .signature-section { display: flex !important; page-break-inside: avoid !important; break-inside: avoid !important; margin-top: 24px; }
          }
        `}</style>
      )}
      
      {notification && (
        <div className="no-print">
          <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}
      
      {/* ========================================================================= */}
      {/* TEMPLATE CETAK RESMI: BUKU KAS UMUM (STANDAR NASIONAL PERMENDAGRI NO. 20/2018) */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-slate-900 mb-6 pb-4" id="printable-area-bku-full">
        <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
            DESA ADAT BASANGALAS
          </h2>
          <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
            Tata Kelola Penatausahaan Kas Desa Adat
          </p>
          <p className="text-xs font-semibold text-slate-700 font-serif m-0">
            Jl. Raya Basangalas, Tribuana, Abang, Karangasem - Bali
          </p>
        </div>

        <div className="text-center mb-4">
          <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
            BUKU KAS UMUM (BKU)
          </h3>
          <div className="flex justify-center items-center gap-4 text-xs font-bold text-slate-800 mt-1 uppercase">
            <span>Standar Permendagri No. 20/2018 (Format D.1)</span>
            <span>•</span>
            <span>Tahun Anggaran: {selectedYear || new Date().getFullYear()}</span>
          </div>
          <p className="text-xs font-semibold text-slate-700 mt-0.5 font-mono">
            Periode: {selectedMonth && selectedYear ? formatMonthLabelFull(`${selectedYear}-${selectedMonth}`) : (selectedYear ? `Tahun ${selectedYear}` : 'Seluruh Periode Transaksi')}
          </p>
          {selectedCategory && (
            <p className="text-xs font-bold text-slate-700 uppercase mt-0.5">
              Filter Rekening / Kategori: {getCategoryDisplayLabel(selectedCategory)}
            </p>
          )}
        </div>

        <div className="mt-4">
          <table className="w-full text-left border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 font-black text-center text-[10px]">
                <th className="p-1 border border-black w-10">No</th>
                <th className="p-1 border border-black w-20">Tanggal</th>
                <th className="p-1 border border-black w-24">No. Bukti</th>
                <th className="p-1 border border-black">Uraian / Keterangan Transaksi</th>
                <th className="p-1 border border-black text-right w-24">Penerimaan (Rp)</th>
                <th className="p-1 border border-black text-right w-24">Pengeluaran (Rp)</th>
                <th className="p-1 border border-black text-right w-26">Saldo Kas (Rp)</th>
              </tr>
              {/* Baris Nomor Kolom Standar Nasional */}
              <tr className="bg-slate-50 text-slate-500 text-[8px] text-center italic font-mono">
                <th className="p-0.5 border border-black">1</th>
                <th className="p-0.5 border border-black">2</th>
                <th className="p-0.5 border border-black">3</th>
                <th className="p-0.5 border border-black">4</th>
                <th className="p-0.5 border border-black">5</th>
                <th className="p-0.5 border border-black">6</th>
                <th className="p-0.5 border border-black">7</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. Saldo Awal / Pindahan Periode Lalu */}
              {(selectedYear || selectedMonth) && (
                <tr className="bg-slate-100/90 font-bold">
                  <td className="p-1 border border-black text-center font-mono">-</td>
                  <td className="p-1 border border-black text-center font-mono">
                    {selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}-01` : `${selectedYear}-01-01`}
                  </td>
                  <td className="p-1 border border-black font-black uppercase text-slate-900" colSpan={2}>
                    <span>{pindahanLabel}</span>
                    {selectedCategory && (
                      <span className="ml-1.5 font-normal text-[9px] text-slate-700 normal-case">
                        ({uniqueCategories.find(c => c.value === selectedCategory)?.label || selectedCategory})
                      </span>
                    )}
                  </td>
                  <td className="p-1 border border-black text-right font-mono font-bold">
                    {summary.saldoAwal >= 0 ? formatCurrency(summary.saldoAwal) : '-'}
                  </td>
                  <td className="p-1 border border-black text-right font-mono font-bold">
                    {summary.saldoAwal < 0 ? formatCurrency(Math.abs(summary.saldoAwal)) : '-'}
                  </td>
                  <td className="p-1 border border-black text-right font-mono font-black text-slate-950 bg-slate-200">
                    {formatCurrency(summary.saldoAwal)}
                  </td>
                </tr>
              )}

              {/* 2. Baris Transaksi BKU */}
              {filteredData.map((item, index) => (
                <tr key={item.id}>
                  <td className="p-1 border border-black text-center font-mono">{index + 1}</td>
                  <td className="p-1 border border-black text-center font-mono whitespace-nowrap">{item.tanggal}</td>
                  <td className="p-1 border border-black text-center font-mono font-semibold whitespace-nowrap">{item.bukti || item.idTransaksi || '-'}</td>
                  <td className="p-1 border border-black">
                    <div className="font-semibold text-slate-900 leading-tight">{item.uraian}</div>
                  <div className="p-1 font-mono text-[9px] text-slate-700 italic">{item.kode || '-'}</div>
                  </td>
                  <td className="p-1 border border-black text-right font-mono text-emerald-800 font-semibold">
                    {item.penerimaan > 0 ? formatCurrency(item.penerimaan) : '-'}
                  </td>
                  <td className="p-1 border border-black text-right font-mono text-rose-800 font-semibold">
                    {item.pengeluaran > 0 ? formatCurrency(item.pengeluaran) : '-'}
                  </td>
                  <td className="p-1 border border-black text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.saldo)}
                  </td>
                </tr>
              ))}

              {/* 3. Baris Total Mutasi Periode Ini */}
              <tr className="bg-slate-100 font-black border-t-2 border-black bku-summary-row">
                <td colSpan={4} className="p-1.5 border border-black text-right uppercase tracking-wider">
                  Jumlah Penerimaan & Pengeluaran Periode Ini
                </td>
                <td className="p-1.5 border border-black text-right font-mono font-black text-emerald-900 bg-emerald-50">
                  {formatCurrency(summary.penerimaan)}
                </td>
                <td className="p-1.5 border border-black text-right font-mono font-black text-rose-900 bg-rose-50">
                  {formatCurrency(summary.pengeluaran)}
                </td>
                <td className="p-1.5 border border-black text-right font-mono font-bold text-slate-700">
                  {formatCurrency(summary.mutasiPeriode)}
                </td>
              </tr>

              {/* 4. Baris Saldo Akhir BKU */}
              <tr className="bg-slate-200 font-black border-t-2 border-black bku-summary-row">
                <td colSpan={6} className="p-2 border border-black text-right uppercase text-xs tracking-wider text-slate-950">
                  Total Saldo Akhir Kas Menurut Buku Kas Umum (BKU)
                </td>
                <td className="p-2 border border-black text-right font-mono font-black text-xs text-slate-950 bg-slate-300">
                  {formatCurrency(summary.totalSaldoAkhir)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Terbilang & Catatan */}
          <div className="mt-2 text-[10px] text-slate-800 italic px-1 space-y-0.5">
            <p className="m-0 font-medium">
              Terbilang: <span className="font-bold font-serif uppercase tracking-wide text-slate-900">"{numberToWords(Math.abs(summary.totalSaldoAkhir))} Rupiah"</span>
            </p>
          </div>

          {/* Rincian Kas Nyata / Fisik Kas & Rekonsiliasi (Permendagri D.1) */}
          <div className="mt-3 p-2.5 bg-slate-50 border border-black rounded text-[10px] bku-summary-row">
            <div className="font-black uppercase text-slate-900 mb-1 border-b border-slate-300 pb-0.5">
              Rincian Posisi Saldo Kas (Pemeriksaan Fisik Kas / Cash Opname):
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
              <div className="flex justify-between">
                <span>1. Kas Desa Adat (1.1.1.01):</span>
                <span className="font-bold">{formatCurrency(cashBreakdown.kasDesaAdat)}</span>
              </div>
              <div className="flex justify-between">
                <span>2. Kas Juru Raksa (1.1.1.02):</span>
                <span className="font-bold">{formatCurrency(cashBreakdown.kasJuruRaksa)}</span>
              </div>
              <div className="flex justify-between">
                <span>3. Kas Aset Lainnya (1.1.2.*):</span>
                <span className="font-bold">{formatCurrency(cashBreakdown.kasAsetLainnya)}</span>
              </div>
              <div className="flex justify-between">
                <span>4. Kas Lainnya (1.1.1.*):</span>
                <span className="font-bold">{formatCurrency(cashBreakdown.kasLainnya)}</span>
              </div>
              <div className="flex justify-between font-black border-t border-slate-400 pt-0.5 text-slate-950 col-span-2">
                <span>TOTAL KAS NYATA / FISIK:</span>
                <span>{formatCurrency(cashBreakdown.totalKasNyata)}</span>
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-300 flex justify-between items-center text-[9px]">
              <span className="font-bold uppercase text-slate-700">Status Selisih Kas (Kas Fisik - Saldo BKU):</span>
              <span className={`font-black font-mono ${cashBreakdown.selisihKas === 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                {cashBreakdown.selisihKas === 0 ? 'Rp 0 (NIHIL / COCOK / SEIMBANG)' : `${formatCurrency(cashBreakdown.selisihKas)} (TERDAPAT SELISIH)`}
              </span>
            </div>
          </div>

          {/* Formal Signature Section */}
          <div className="mt-6 border-t border-slate-300 pt-4">
            <ReportSignatureBlock
              keliangName={keliangName}
              juruRaksaName={juruRaksaName}
              customPlace={customPlace}
              signatureDate={signatureDate}
              keliangTitle="Keliang Adat Basangalas"
              keliangSubtitle="Penanggung Jawab Umum"
              juruRaksaTitle="Juru Raksa Desa Adat"
              juruRaksaSubtitle="Pengelola Kas & Pembukuan"
              keliangActionText="Mengetahui & Menyetujui,"
              namaDesa="DESA ADAT BASANGALAS"
            />
          </div>

          {/* Formal Footer */}
          <div className="flex justify-between items-center mt-4 text-slate-900 border-t border-slate-300 pt-1.5">
            <div>
              <p className="font-semibold text-[10px] m-0 print:text-slate-400">Dokumen Resmi Penatausahaan Keuangan Desa Adat Basangalas.</p>
              <p className="text-[8px] text-slate-500 m-0">Buku Kas Umum (BKU) Standar Akuntansi Permendagri No. 20/2018 (Format D.1).</p>
            </div>
            <div className="text-right font-mono text-[7.5px] text-slate-500">
              <p className="m-0">Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAMPILAN INTERAKTIF PADA LAYAR (ON-SCREEN UI) */}
      {/* ========================================================================= */}
      
      {/* Header Utama & Kontrol Aksi */}
      <div className="bg-white text-gray-900 border-b-4 border-emerald-500 p-4 no-print my-6 relative print:border-none print:shadow-none print:bg-white print:rounded-none print:p-0 print:m-0">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
            <div className="absolute -right-0 -bottom-0 opacity-10 text-emerald-600 pointer-events-none">
                <BookOpen size={100} />
            </div>
        </div>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-teal-100 text-teal-600 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-teal-300">
                Standar Nasional Permendagri No. 20/2018
              </span>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-teal-800 text-white rounded-xl shadow-md">
                <BookOpen size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-serif">
                    Buku Kas Umum</h1>
                  <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-blue-600" />
                    Satu Sumber  (Jurnal & Kas)
                  </span>
                </div>
                <p className="text-slate-600 text-xs font-medium mt-0.5">
                  Buku Kas Umum (BKU) penatausahaan penerimaan dan pengeluaran kas tunai & bank secara kronologis dengan verifikasi register penutupan kas berkala.
                </p>
              </div>
            </div>
      </div>

        <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap justify-end">
          {/* Status Otomatisasi TTD & Stempel BKU */}
          <button 
            type="button"
            onClick={handleOpenSettings}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-xs transition-colors cursor-pointer"
            title="Status Otomatisasi Tanda Tangan & Stempel BKU (Klik untuk mengubah)"
          >
            <FileSignature size={14} className="text-teal-600" />
            <span className={embedSignatures ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
              TTD: {embedSignatures ? 'ON' : 'OFF'}
            </span>
            <span className="text-slate-300">•</span>
            <span className={showStampOverlay ? 'text-rose-700 font-bold' : 'text-slate-500'}>
              Stempel: {showStampOverlay ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* TOMBOL MENU TERPADU (REGISTER, SETTING, EXPORT, UNDUH, CETAK) */}
          <div className="relative" ref={menuRef}>
            <button 
              id="bku-header-menu-button"
              type="button"
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs border border-teal-700 active:scale-95 cursor-pointer"
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              title="Buka Menu Tindakan Buku Kas Umum"
            >
              <Menu size={16} className="text-teal-300" />
              <span className="tracking-wide">Menu BKU</span>
              <ChevronDown size={14} className={`transition-transform duration-200 text-teal-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMenuOpen && (
              <div 
                id="bku-header-menu-dropdown"
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100"
              >
                {/* 1. Navigasi & Register Penutupan */}
                <div className="p-1.5">
                  <div className="px-3 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">
                    Navigasi Pembukuan
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView(prev => prev === 'bku_table' ? 'register_penutupan' : 'bku_table');
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-amber-50 transition-colors group cursor-pointer"
                  >
                    <div className={`p-2 rounded-lg ${activeView === 'register_penutupan' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
                      {activeView === 'register_penutupan' ? <BookOpen size={16} /> : <Stamp size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 flex items-center justify-between">
                        <span>{activeView === 'register_penutupan' ? 'Buku Kas Harian' : 'Register Penutupan Kas'}</span>
                        <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                          {activeView === 'register_penutupan' ? 'Tabel' : 'Permendagri D.1'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {activeView === 'register_penutupan' ? 'Kembali ke tabel transaksi BKU' : 'Berita acara & pemeriksaan kas fisik'}
                      </div>
                    </div>
                  </button>

                  {/* Opsi Buka Layar Penuh (Modal) jika Register Penutupan Aktif */}
                  {activeView === 'register_penutupan' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsFullScreenRegister(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left rounded-xl hover:bg-indigo-50 transition-colors group cursor-pointer text-indigo-900 mt-1"
                    >
                      <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg group-hover:bg-indigo-200 transition-colors">
                        <Maximize2 size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900">Buka Layar Penuh (Modal)</div>
                        <div className="text-[11px] text-slate-500 truncate">Modal Register Full-Screen (Layar Besar &amp; HP)</div>
                      </div>
                    </button>
                  )}
                </div>

                {/* 2. Ekspor & Dokumen (Export Excel, Unduh PDF, Cetak BKU) */}
                <div className="p-1.5">
                  <div className="px-3 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">
                    Dokumen, Cetak & Ekspor
                  </div>

                  {/* Cetak BKU */}
                  <button
                    type="button"
                    onClick={() => {
                      handlePrintDocument();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-teal-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-teal-100 text-teal-800 rounded-lg group-hover:bg-teal-200 transition-colors">
                      <Printer size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Cetak BKU</div>
                      <div className="text-[11px] text-slate-500 truncate">Cetak dokumen fisik BKU (A4/Folio)</div>
                    </div>
                  </button>

                  {/* Unduh PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsPdfModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-rose-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-rose-100 text-rose-800 rounded-lg group-hover:bg-rose-200 transition-colors">
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Unduh PDF</div>
                      <div className="text-[11px] text-slate-500 truncate">Atur orientasi &amp; download PDF BKU</div>
                    </div>
                  </button>

                  {/* Export Excel */}
                  <button
                    type="button"
                    onClick={() => {
                      handleExportClick();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-emerald-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg group-hover:bg-emerald-200 transition-colors">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Export Excel (.xlsx)</div>
                      <div className="text-[11px] text-slate-500 truncate">Unduh data BKU ke spreadsheet Excel</div>
                    </div>
                  </button>
                </div>

                {/* 3. Pengaturan Tanda Tangan */}
                <div className="p-1.5">
                  <div className="px-3 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">
                    Konfigurasi
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenSettings();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-slate-100 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-slate-200 transition-colors">
                      <Settings size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Setting TTD</div>
                      <div className="text-[11px] text-slate-500 truncate">Atur nama Keliang, Juru Raksa, tempat & tgl</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* TAB NAVIGATION: BUKU KAS HARIAN VS REGISTER PENUTUPAN & PENGESAHAN */}
      <div className="flex border-b-2 border-slate-200 gap-2 no-print">
        <button
          onClick={() => setActiveView('bku_table')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-all ${
            activeView === 'bku_table'
              ? 'border-teal-700 text-teal-900 bg-teal-50/70 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <BookOpen size={16} className={activeView === 'bku_table' ? 'text-teal-700' : 'text-slate-400'} />
          <span>Buku Kas Umum (Buku Harian Transaksi)</span>
        </button>

        <button
          onClick={() => setActiveView('register_penutupan')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-all ${
            activeView === 'register_penutupan'
              ? 'border-teal-700 text-teal-900 bg-teal-50/70 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <FileCheck2 size={16} className={activeView === 'register_penutupan' ? 'text-teal-700' : 'text-slate-400'} />
          <span>Register Penutupan & Pengesahan BKU</span>
          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
            Permendagri D.1
          </span>
        </button>
      </div>

      {/* VIEW 1: REGISTER PENUTUPAN & PENGESAHAN BKU */}
      {activeView === 'register_penutupan' && (
        <RegisterPenutupanBku
          saldoBuku={summary.totalSaldoAkhir}
          saldoAwal={summary.saldoAwal}
          totalPenerimaan={summary.penerimaan}
          totalPengeluaran={summary.pengeluaran}
          mutasiPeriode={summary.mutasiPeriode}
          kasDesaAdatBuku={cashBreakdown.kasDesaAdat}
          kasJuruRaksaBuku={cashBreakdown.kasJuruRaksa}
          kasAsetLainnyaBuku={cashBreakdown.kasAsetLainnya}
          kasBankBuku={cashBreakdown.kasBank}
          kasSasahAbuBuku={cashBreakdown.kasSasahAbu}
          kasLainnyaBuku={cashBreakdown.kasLainnya}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          keliangName={keliangName}
          juruRaksaName={juruRaksaName}
          customPlace={customPlace}
          signatureDate={signatureDate}
          onOpenSettings={handleOpenSettings}
          onBackToBku={() => setActiveView('bku_table')}
          isFullScreenOpen={isFullScreenRegister}
          onToggleFullScreen={setIsFullScreenRegister}
        />
      )}

      {/* VIEW 2: BUKU KAS UMUM TABLE & CONTROLS */}
      {activeView === 'bku_table' && (
        <div className="space-y-4">
          {/* TOGGLE FILTER CEPAT (Default Disembunyikan) */}
          <div className="flex items-center justify-between gap-3 no-print flex-wrap">
            <button
              type="button"
              onClick={() => setShowQuickFilter(prev => !prev)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                showQuickFilter 
                  ? 'bg-teal-700 text-white border-teal-800 hover:bg-teal-800' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-teal-500'
              }`}
              title={showQuickFilter ? 'Sembunyikan bilah filter cepat' : 'Buka bilah filter cepat'}
            >
              <Filter size={14} className={showQuickFilter ? 'text-teal-200' : 'text-teal-600'} />
              <span>{showQuickFilter ? 'Sembunyikan Filter Cepat' : 'Tampilkan Filter Cepat'}</span>
              {(selectedCategory || selectedYear || selectedMonth || searchTerm.trim()) && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                  showQuickFilter ? 'bg-teal-900 text-teal-200' : 'bg-teal-100 text-teal-800 border border-teal-300'
                }`}>
                  Filter Aktif
                </span>
              )}
              <ChevronDown size={14} className={`transform transition-transform duration-200 ${showQuickFilter ? 'rotate-180' : ''}`} />
            </button>

            {(selectedCategory || selectedYear || selectedMonth || searchTerm.trim()) && !showQuickFilter && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl text-xs">
                <span className="text-teal-800 font-medium">
                  <strong>Filter Aktif:</strong> {[
                    selectedCategory && `Akun/Kategori: ${getCategoryDisplayLabel(selectedCategory)}`,
                    selectedYear && `Tahun: ${selectedYear}`,
                    selectedMonth && `Bulan: ${formatMonthLabelOnly(selectedMonth)}`,
                    searchTerm && `Pencarian: "${searchTerm}"`
                  ].filter(Boolean).join(' • ')}
                </span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 ml-1 cursor-pointer"
                  title="Reset Filter"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            )}
          </div>

          {/* BILAH FILTER UTAMA (DITAMPILKAN JIKA TOGGLE AKTIF) */}
          {showQuickFilter && (
            <div className="bg-slate-50 border border-slate-400 rounded-xl p-3.5 space-y-3 no-print shadow-sm animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Filter Kategori / Akun */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <Filter size={12} className="text-teal-700" />
                    Kategori / Akun
                  </label>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">Semua Kategori & Rekening</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Filter Periode Tahun */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-teal-700" />
                    Tahun Anggaran
                  </label>
                  <select 
                    value={selectedYear} 
                    onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth(''); setCurrentPage(1); }} 
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Semua Tahun</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>Tahun {year}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Filter Periode Bulan */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                    <Calendar size={12} className="text-teal-700" />
                    Bulan Transaksi
                  </label>
                  <select 
                    value={selectedMonth} 
                    onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }} 
                    className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Semua Bulan</option>
                    {availableMonths.map(mm => (
                      <option key={mm} value={mm}>{formatMonthLabelOnly(mm)}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Pencarian Kata Kunci & Reset */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase text-slate-500 mb-1">Pencarian / Reset</label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        placeholder="Cari uraian / bukti / kode..." 
                        value={searchTerm} 
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full bg-white border border-slate-300 rounded-lg py-1.5 pl-7 pr-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500" 
                      />
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                      title="Reset Semua Filter"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* RINGKASAN SALDO & MUTASI (FINANCIAL SUMMARY CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 no-print">
        {/* Card Saldo Awal / Pindahan */}
        <div className="bg-slate-50 border border-slate-400 rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Saldo Awal / Pindahan</span>
            <ArrowLeftRight size={14} className="text-slate-400" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {formatCurrency(summary.saldoAwal)}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5 truncate">
            {selectedYear || selectedMonth 
              ? `${pindahanLabel || 'Kumulatif periode lalu'}${selectedCategory ? ` • ${uniqueCategories.find(c => c.value === selectedCategory)?.label || selectedCategory}` : ''}` 
              : 'Termasuk dalam saldo berjalan'}
          </div>
        </div>

        {/* Card Total Penerimaan (Debet) */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800">Penerimaan Kas (Masuk)</span>
            <span className="bg-emerald-200 text-emerald-900 text-[10px] font-bold px-1.5 rounded flex items-center gap-0.5">
              <ArrowDownLeft size={11} /> Debet
            </span>
          </div>
          <div className="text-lg font-black text-emerald-700">
            {formatCurrency(summary.penerimaan)}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">
            {filteredData.filter(i => i.penerimaan > 0).length} transaksi penerimaan
          </div>
        </div>

        {/* Card Total Pengeluaran (Kredit) */}
        <div className="bg-rose-50/70 border border-rose-600 rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-rose-800">Pengeluaran Kas (Keluar)</span>
            <span className="bg-rose-200 text-rose-900 text-[10px] font-bold px-1.5 rounded flex items-center gap-0.5">
              <ArrowUpRight size={11} /> Kredit
            </span>
          </div>
          <div className="text-lg font-black text-rose-700">
            {formatCurrency(summary.pengeluaran)}
          </div>
          <div className="text-[10px] text-slate-900 mt-0.5">
            {filteredData.filter(i => i.pengeluaran > 0).length} transaksi belanja / kas keluar
          </div>
        </div>

        {/* Card Saldo Akhir BKU Terkini */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-300 flex items-center gap-1">
              <Wallet size={12} className="text-teal-200" />
              Saldo Akhir BKU
            </span>
            <span className="text-[10px] font-mono text-teal-200 font-bold">STANDAR BKU</span>
          </div>
          <div className="text-lg font-black text-teal-300">
            {formatCurrency(summary.totalSaldoAkhir)}
          </div>
          <div className="text-[10px] text-slate-200 mt-0.5 truncate">
            {summary.mutasiPeriode >= 0 ? `+ Surplus: ${formatCurrency(summary.mutasiPeriode)}` : `- Defisit: ${formatCurrency(Math.abs(summary.mutasiPeriode))}`}
          </div>
        </div>
      </div>

      {/* BERITA ACARA KAS RINGKAS (ON-SCREEN ACCORDION / INFO PANEL) */}
      <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-teal-200/80">
          <span className="text-xs font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
            <Landmark size={14} className="text-teal-700" />
            Rincian Komposisi Kas Nyata (Pemeriksaan Kas):
          </span>
          <span className="text-[11px] font-bold text-teal-800 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-teal-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Selisih Kas: {cashBreakdown.selisihKas === 0 ? 'Nihil / Cocok Rp 0' : formatCurrency(cashBreakdown.selisihKas)}
          </span>
        </div>
        <div className={`grid grid-cols-2 ${cashBreakdown.kasLainnya !== 0 ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'} gap-2 pt-2 text-xs`}>
          <div className="bg-white p-2 rounded-lg border border-teal-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">1. Kas Desa Adat (1.1.1.01)</span>
            <span className="font-bold text-slate-800">{formatCurrency(cashBreakdown.kasDesaAdat)}</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-teal-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">2. Kas Juru Raksa (1.1.1.02)</span>
            <span className="font-bold text-slate-800">{formatCurrency(cashBreakdown.kasJuruRaksa)}</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-teal-100">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">3. Kas Aset Lainnya (1.1.2.*)</span>
            <span className="font-bold text-slate-800">{formatCurrency(cashBreakdown.kasAsetLainnya)}</span>
          </div>
          {cashBreakdown.kasLainnya !== 0 && (
            <div className="bg-white p-2 rounded-lg border border-teal-100">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">4. Kas Lainnya (1.1.1.*)</span>
              <span className="font-bold text-slate-800">{formatCurrency(cashBreakdown.kasLainnya)}</span>
            </div>
          )}
          <div className="bg-teal-900 text-white p-2 rounded-lg shadow-sm">
            <span className="text-[10px] text-teal-200 uppercase font-bold block">Total Kas Nyata</span>
            <span className="font-black text-teal-300">{formatCurrency(cashBreakdown.totalKasNyata)}</span>
          </div>
        </div>
      </div>

      {/* TABEL BUKU KAS UMUM STANDAR NASIONAL (PERMENDAGRI NO. 20/2018 FORMAT D.1) */}
      <div className="no-print overflow-x-auto rounded-xl border border-slate-400 shadow-sm bg-white">
        <table className="w-full text-xs text-left text-slate-800">
          <thead className="text-[11px] text-slate-900 uppercase bg-slate-100 font-black border-b-2 border-slate-300">
            <tr>
              <th className="px-3 py-2.5 text-center w-10 border-r border-slate-200">No</th>
              <th className="px-3 py-2.5 text-center w-24 border-r border-slate-200">Tanggal</th>
              <th className="px-3 py-2.5 text-center w-28 border-r border-slate-200">No. Bukti</th>
              <th className="px-4 py-2.5 ">Uraian / Keterangan Transaksi</th>
              <th className="px-3 py-2.5 text-right w-20 border-r border-slate-200 text-emerald-800">Penerimaan (Debet)</th>
              <th className="px-3 py-2.5 text-right w-20 border-r border-slate-200 text-rose-800">Pengeluaran (Kredit)</th>
              <th className="px-3 py-2.5 text-right w-28 text-slate-900">Saldo Kas (Rp)</th>
            </tr>
            {/* Baris Nomor Kolom Standar Nasional */}
            <tr className="bg-slate-200/70 text-slate-600 text-[9px] text-center font-mono font-bold border-b border-slate-300">
              <th className="py-0.5 border-r border-slate-300">1</th>
              <th className="py-0.5 border-r border-slate-300">2</th>
              <th className="py-0.5 border-r border-slate-300">3</th>
              <th className="py-0.5 border-r border-slate-300">4</th>
              <th className="py-0.5 border-r border-slate-300">5</th>
              <th className="py-0.5 border-r border-slate-300">6</th>
              <th className="py-0.5 border-r border-slate-300">7</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {(selectedYear || selectedMonth) && (
              <tr className="bg-slate-100 font-bold italic text-slate-700">
                <td className="px-3 py-2 text-center border-r border-slate-200"></td>
                <td colSpan={3} className="px-4 py-2 border-r border-slate-200 font-black uppercase text-[11px] text-slate-800">
                  <span>{pindahanLabel || "SALDO AWAL / PINDAHAN (KUMULATIF LALU)"}</span>
                  {selectedCategory && (
                    <span className="ml-2 font-bold text-[10px] text-teal-800 normal-case bg-teal-100/70 border border-teal-300 px-2 py-0.5 rounded inline-block">
                      Rekening: {uniqueCategories.find(c => c.value === selectedCategory)?.label || selectedCategory}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center border-r border-slate-200 text-slate-400">-</td>
                <td className="px-3 py-2 text-right border-r border-slate-200 text-slate-400">-</td>
                <td className="px-3 py-2 text-right font-black text-slate-900">{formatCurrency(summary.saldoAwal)}</td>
              </tr>
            )}

            {paginatedData.map((item, idx) => {
              const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;

              return (
                <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-center border-r border-slate-200 font-mono text-[11px] text-slate-500">
                    {rowNumber}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-slate-200 whitespace-nowrap font-mono text-[11px] text-slate-700">
                    {formatDate(item.tanggal)}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-slate-200 font-mono text-[11px] font-bold text-teal-800 whitespace-nowrap">
                    {item.bukti || item.idTransaksi || '-'}
                  </td>
                  <td className="px-4 py-2.5 border-r border-slate-200 text-slate-900">
                    <div className="font-semibold text-[12px] leading-snug">{item.uraian}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold">
                        {item.kode || '-'}
                      </span>
                      {item.namaAkun && (
                        <span className="text-[10px] text-slate-600 font-medium">
                          {item.namaAkun}
                        </span>
                      )}
                      {item.kategori && item.kategori !== item.namaAkun && (
                        <span className="text-[9px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                          {item.kategori}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-slate-200 font-bold text-[12px] text-emerald-700">
                    {item.penerimaan > 0 ? formatCurrency(item.penerimaan) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-slate-200 font-bold text-[12px] text-rose-700">
                    {item.pengeluaran > 0 ? formatCurrency(item.pengeluaran) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black text-[12px] text-slate-900">
                    {formatCurrency(item.saldo)}
                  </td>
                </tr>
              );
            })}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-slate-400 italic">
                  <div className="flex flex-col items-center gap-2">
                    <Wallet size={40} className="text-slate-300" />
                    <span className="font-semibold text-sm text-slate-500">Tidak ada data transaksi Buku Kas Umum.</span>
                    <span className="text-xs text-slate-400">Silakan sesuaikan filter tanggal atau lakukan input transaksi di Jurnal Umum.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {filteredData.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 font-bold text-slate-900 bg-slate-100">
              {/* Subtotal Halaman Ini */}
              {totalPages > 1 && (
                <tr className="bg-slate-200/80 border-b border-slate-300">
                  <td colSpan={4} className="px-4 py-2 text-right uppercase text-[11px] text-slate-700">
                    Subtotal Halaman Ini (Hal. {currentPage} dari {totalPages})
                  </td>
                  <td className="px-3 py-2 text-right font-black text-emerald-800 text-[12px]">
                    {formatCurrency(pageSubtotal.penerimaan)}
                  </td>
                  <td className="px-3 py-2 text-right font-black text-rose-800 text-[12px]">
                    {formatCurrency(pageSubtotal.pengeluaran)}
                  </td>
                  <td className="px-3 py-2 text-right font-black text-slate-800 text-[12px]">
                    {formatCurrency(pageSubtotal.penerimaan - pageSubtotal.pengeluaran)}
                  </td>
                </tr>
              )}

              {/* Total Mutasi Periode Ini */}
              <tr className="bg-slate-300/80 border-b border-slate-400 text-slate-900">
                <td colSpan={4} className="px-4 py-2 text-right uppercase font-black text-[11px]">
                  TOTAL MUTASI PERIODE INI ({filteredData.length} Transaksi)
                </td>
                <td className="px-3 py-2 text-right font-black text-emerald-900 text-[13px]">
                  {formatCurrency(summary.penerimaan)}
                </td>
                <td className="px-3 py-2 text-right font-black text-rose-900 text-[13px]">
                  {formatCurrency(summary.pengeluaran)}
                </td>
                <td className="px-3 py-2 text-right font-black text-slate-900 text-[13px]">
                  {formatCurrency(summary.mutasiPeriode)}
                </td>
              </tr>

              {/* Saldo Akhir BKU Resmi */}
              <tr className="bg-teal-900 text-white font-black">
                <td colSpan={6} className="px-4 py-2.5 text-right uppercase tracking-wider text-[11px] text-teal-100">
                  SALDO AKHIR BUKU KAS UMUM (PER TANGGAL LAPORAN)
                </td>
                <td colSpan={3} className="px-4 py-2.5 text-right text-base font-black text-emerald-300 bg-teal-950 font-mono">
                  {formatCurrency(summary.totalSaldoAkhir)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination dan Kontrol Baris Bawah */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 no-print pt-2 border-t border-slate-200">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold">{filteredData.length} baris transaksi</span>
          <span>•</span>
          <span>Halaman {currentPage} dari {totalPages}</span>
        </div>
        <div>
          <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
        </div>
      </div>
        </div>
      )}

      {/* Formal Footer */}
      <div className="flex justify-between items-center mt-6 text-slate-900 border-t border-slate-300 pt-4 no-print">
        <div>
          <p className="font-semibold">Dokumen Resmi Penatausahaan Keuangan Desa Adat Basangalas.</p>
          <p className="text-[11px] text-slate-600">Buku Kas Umum (BKU) Standar Akuntansi Permendagri No. 20/2018 (Format D.1).</p>
        </div>
        <div className="text-right font-mono text-[10px] text-slate-500">
          <p className="m-0">Update: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* MODAL SETTINGS TANDA TANGAN */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Tanda Tangan BKU" className="max-w-md">
        <div className="space-y-4">
          {/* TOGGLE OTOMATISASI TANDA TANGAN & STEMPEL DIGITAL */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <FileSignature size={14} className="text-teal-700" />
              <span>Otomatisasi Tanda Tangan &amp; Stempel</span>
            </div>

            {/* Switch Tanda Tangan Digital */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Sematkan Tanda Tangan Digital</span>
                <span className="text-[10px] text-slate-500 block">Tampilkan TTD digital Keliang &amp; Juru Raksa</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={tempAutoEmbed}
                  onChange={e => setTempAutoEmbed(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-700"></div>
              </label>
            </div>

            {/* Switch Stempel Resmi Desa */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Tampilkan Stempel Resmi Desa</span>
                <span className="text-[10px] text-slate-500 block">Cap stempel merah Desa Adat Basangalas</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={tempShowStamp}
                  onChange={e => setTempShowStamp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tempat Pengesahan</label>
            <input 
              type="text" 
              value={tempCustomPlace} 
              onChange={e => setTempCustomPlace(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tanggal Laporan (Tanda Tangan)</label>
            <input 
              type="date" 
              value={tempSignatureDate} 
              onChange={e => setTempSignatureDate(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Keliang Adat (Mengetahui)</label>
            <input 
              type="text" 
              value={tempKeliangName} 
              onChange={e => setTempKeliangName(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama Juru Raksa Desa Adat (Bendahara)</label>
            <input 
              type="text" 
              value={tempJuruRaksaName} 
              onChange={e => setTempJuruRaksaName(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={() => setIsSettingsOpen(false)} 
              className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={() => setIsConfirmSaveSettingsOpen(true)} 
              className="px-5 py-2 bg-teal-700 text-white font-bold rounded-lg text-xs hover:bg-teal-800 transition-colors shadow-sm"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL SAVE SETTINGS */}
      <ConfirmationModal 
        isOpen={isConfirmSaveSettingsOpen} 
        onClose={() => setIsConfirmSaveSettingsOpen(false)} 
        onConfirm={handleConfirmSaveSettings} 
        title="Konfirmasi Perubahan Tanda Tangan" 
        message="Apakah Anda yakin ingin menyimpan perubahan data pejabat penandatangan Buku Kas Umum?" 
        confirmText="Ya, Simpan" 
        confirmColor="bg-teal-700" 
      />

      {/* MODAL EXPORT EXCEL */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Buku Kas Umum ke Excel" className="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama File Excel (.xlsx)</label>
            <input 
              type="text" 
              value={exportFilename} 
              onChange={(e) => setExportFilename(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none" 
              placeholder="Buku_Kas_Umum.xlsx" 
              autoFocus 
            />
            <p className="text-[11px] text-slate-500 mt-1">
              File Excel akan mencakup Kop resmi, tabel BKU, Saldo Pindahan, Berita Acara Kas Nyata, dan Tanda Tangan Pengesahan.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={() => setIsExportModalOpen(false)} 
              className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={processExportBku} 
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
            >
              <Download size={14} />
              <span>Download Excel</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL CONFIRM DELETE */}
      <ConfirmationModal 
        isOpen={isConfirmModalOpen} 
        onClose={() => setIsConfirmModalOpen(false)} 
        onConfirm={() => {
          if (deletingId) {
            onDelete(deletingId);
            setNotification({ message: 'Mutasi berhasil dihapus dari pembukuan.', type: 'success' });
          }
          setIsConfirmModalOpen(false);
          setDeletingId(null);
        }} 
        title="Hapus Transaksi Kas" 
        message="Tindakan ini akan menghapus data transaksi dari seluruh buku keuangan terkait." 
        confirmText="Hapus" 
        confirmColor="bg-rose-600" 
      />
      {/* EXPORT PDF MODAL & CONTROLLER */}
      <ExportPdfButton 
        elementId="printable-area-bku-full" 
        filename={`Buku_Kas_Umum_${selectedYear || 'Semua'}_${selectedMonth || 'Semua'}.pdf`} 
        buttonText="Unduh PDF" 
        hideButton={true}
        defaultOrientation="portrait"
        options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
        isOpen={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
      />
    </div>
  );
};

export default BukuKasUmum;
