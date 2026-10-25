import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { BkpData, BkuData, JuDisplayRow, BudgetItem } from '../types';
import Pagination from '../components/bku/Pagination';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import Modal from '../components/shared/Modal';
import { 
  BookCopy, Search, Download, Upload, Printer, Wallet, Trash2, 
  Calendar, Filter, Settings, ArrowLeftRight, CheckCircle2, 
  Coins, RotateCcw, FileSpreadsheet, ShieldCheck, ArrowDownLeft, ArrowUpRight,
  Info, ChevronDown, ChevronRight, ListOrdered, Menu, Sliders, FileText
} from 'lucide-react';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import { formatCurrency, numberToWords, formatDate } from '../utils/formatter';
import { REFERENSI_REKENING, isKasAccount, getPosBelanjaFromTransaction, getKategoriFromAccountCode } from '../constants';
import ExportPdfButton from '../components/shared/ExportPdfButton';
import { NotaBelanjaReceiptModal } from '../components/shared/NotaBelanjaReceiptModal';
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

interface BukuKasPembantuProps {
  bkpData: BkpData[];
  bkuData?: BkuData[]; 
  entries?: JuDisplayRow[];
  budgetItems?: BudgetItem[];
  onSubmit?: (juRows: JuDisplayRow[], bkuRows: Omit<BkuData, 'id' | 'saldo'>[], bkpItems: Omit<BkpData, 'id' | 'saldo'>[], oldIdTransaksi?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onDeleteAll?: () => Promise<void>;
  onReplace: (data: BkpData[]) => void;
}

// Daftar Rekening Kas Pembantu Standar Nasional / CoA
export const DAFTAR_KAS_PEMBANTU = [
  { code: '1.1.1.01', name: 'Kas Desa Adat', label: 'Kas Desa Adat (1.1.1.01)', isDefault: false },
  { code: '1.1.1.02', name: 'Kas Juru Raksa(DesaAdat)', label: 'Kas Juru Raksa (Desa Adat)', isDefault: false },
  { code: '1.1.1.03', name: 'Kas Sasah Abu', label: 'Kas Sasah Abu', isDefault: false },
  { code: '1.1.1.04', name: 'Kas Dana Punia Tunai', label: 'Kas Dana Punia Tunai', isDefault: false },
  { code: '1.1.1.05', name: 'Kas Dana Punia Transfer', label: 'Kas Dana Punia Transfer (Bank)', isDefault: false },
  { code: '1.1.1.06', name: 'Kas Punia Barang', label: 'Kas Punia Barang', isDefault: false },
  { code: '1.1.1.08', name: 'Kas Urunan', label: 'Kas Urunan Krama', isDefault: false },
  { code: '1.1.1.09', name: 'Kas Lainnya', label: 'Kas Lainnya', isDefault: false },
  { code: '1.1.2.05', name: 'Kas Dana Kematian', label: 'Kas Dana Kematian', isDefault: false },
  { code: '1.1.2.06', name: 'Kas Dana Pembangunan Desa', label: 'Kas Dana Pembangunan Desa (SHU LPD)', isDefault: false },
  { code: '1.1.2.07', name: 'Kas Tempekan', label: 'Kas Tempekan (1.1.2.07)', isDefault: false },
];

export interface BkpRowItem {
  id: string;
  idTransaksi?: string;
  date: string;
  bukti?: string;
  uraian: string;
  akunLawanCode?: string;
  akunLawanName?: string;
  kategori?: string;
  debet: number;
  kredit: number;
  saldo: number;
  createdAt?: number;
  subItems?: BkpData[];
}

const BukuKasPembantu: React.FC<BukuKasPembantuProps> = ({ 
  bkpData = [], 
  bkuData = [], 
  entries = [],
  budgetItems = [],
  onDelete, 
  onDeleteAll, 
  onReplace 
}) => {
  const { showPermissionDenied } = useNotification();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // DEFAULT FILTER: Semua Kas & Bank (1.1.1.)
  const [selectedKasAccount, setSelectedKasAccount] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Digital Signatures & Receipt Modal
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStampOverlay, setShowStampOverlay] = useState<boolean>(() => isStampOverlayEnabled());
  const [tempAutoEmbed, setTempAutoEmbed] = useState<boolean>(embedSignatures);
  const [tempShowStamp, setTempShowStamp] = useState<boolean>(showStampOverlay);
  const [selectedReceiptEntry, setSelectedReceiptEntry] = useState<BkpData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

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
  const [keliangName, setKeliangName] = useState(() => localStorage.getItem('bkp_keliangName') || 'I Made Mudita');
  const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('bkp_juruRaksaName') || 'I Putu Gede Sutrana');
  const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('bkp_customPlace') || 'Basangalas');
  const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('bkp_signatureDate') || new Date().toISOString().split('T')[0]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [tempKeliangName, setTempKeliangName] = useState(keliangName);
  const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
  const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
  const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
  const [isConfirmSaveSettingsOpen, setIsConfirmSaveSettingsOpen] = useState(false);

  const [isConfirmImportOpen, setIsConfirmImportOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<BkpData[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
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

    localStorage.setItem('bkp_keliangName', tempKeliangName);
    localStorage.setItem('bkp_juruRaksaName', tempJuruRaksaName);
    localStorage.setItem('bkp_customPlace', tempCustomPlace);
    localStorage.setItem('bkp_signatureDate', tempSignatureDate);

    // Simpan status tanda tangan digital dan stempel resmi
    saveSignatureSettings({ autoEmbed: tempAutoEmbed });
    setStampOverlayEnabled(tempShowStamp);
    setEmbedSignatures(tempAutoEmbed);
    setShowStampOverlay(tempShowStamp);
    window.dispatchEvent(new Event('signatures-updated'));

    setIsConfirmSaveSettingsOpen(false);
    setIsSettingsOpen(false);
    setNotification({ message: 'Pengaturan tanda tangan & stempel Buku Pembantu Kas berhasil diperbarui!', type: 'success' });
  };

  // Helper untuk menentukan daftar rekening kas yang tersedia secara dinamis
  const availableKasAccounts = useMemo(() => {
    const list = [...DAFTAR_KAS_PEMBANTU];
    const existingCodes = new Set(list.map(k => k.code));

    // Tambah seluruh akun Kas & Bank (1.1.*) dari CoA atau transaksi jika belum ada di list default
    REFERENSI_REKENING.forEach(r => {
      if (isKasAccount(r.code) && !existingCodes.has(r.code)) {
        list.push({
          code: r.code,
          name: r.name,
          label: r.name,
          isDefault: false
        });
        existingCodes.add(r.code);
      }
    });

    entries.forEach(e => {
      if (e.kodeRekening && isKasAccount(e.kodeRekening) && !existingCodes.has(e.kodeRekening)) {
        list.push({
          code: e.kodeRekening,
          name: e.namaRekening || `Akun ${e.kodeRekening}`,
          label: e.namaRekening || `Akun ${e.kodeRekening}`,
          isDefault: false
        });
        existingCodes.add(e.kodeRekening);
      }
    });

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [entries]);

  // Info Akun Kas Aktif
  const currentKasInfo = useMemo(() => {
    if (!selectedKasAccount || selectedKasAccount === 'ALL') {
      return { code: '1.1.1.', name: 'Semua Kas & Bank (1.1.1.)', label: 'Semua Kas & Bank (1.1.1.)' };
    }
    const found = availableKasAccounts.find(k => k.code === selectedKasAccount || k.name === selectedKasAccount);
    if (found) return found;
    const fromCoA = REFERENSI_REKENING.find(r => r.code === selectedKasAccount);
    if (fromCoA) return { code: fromCoA.code, name: fromCoA.name, label: fromCoA.name };
    return { code: selectedKasAccount, name: selectedKasAccount, label: selectedKasAccount };
  }, [selectedKasAccount, availableKasAccounts]);

  // Map transaksi ke akun lawannya (Contra Account) dari Jurnal Umum
  const contraAccountMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    if (!entries || entries.length === 0) return map;

    // Kelompokkan entries berdasarkan idTransaksi
    const txGroups = new Map<string, JuDisplayRow[]>();
    entries.forEach(e => {
      if (e.idTransaksi) {
        if (!txGroups.has(e.idTransaksi)) txGroups.set(e.idTransaksi, []);
        txGroups.get(e.idTransaksi)!.push(e);
      }
    });

    txGroups.forEach((rows, txId) => {
      // Cari baris Kas vs baris Non-Kas (Beban/Pendapatan)
      const kasRows = rows.filter(r => isKasAccount(r.kodeRekening));
      const nonKasRows = rows.filter(r => !isKasAccount(r.kodeRekening));

      // Jika kas ada di rows, pasangkan baris kas dengan akun lawannya (nonKasRow jika ada)
      kasRows.forEach(kRow => {
        const contraRow = nonKasRows.length > 0 ? nonKasRows[0] : rows.find(r => r !== kRow);
        if (contraRow) {
          const rawCode = contraRow.kodeRekening || '';
          const clean = rawCode.split(' - ')[0].trim();
          const refMatch = REFERENSI_REKENING.find(r => r.code === clean);
          const name = refMatch?.name || (rawCode.includes(' - ') ? rawCode.split(' - ').slice(1).join(' - ').trim() : rawCode);
          map.set(`${txId}-${kRow.kodeRekening}`, {
            code: contraRow.kodeRekening,
            name: name
          });
          map.set(txId, {
            code: contraRow.kodeRekening,
            name: name
          });
        }
      });

      // Juga simpan debet & kredit standar
      const debetRow = rows.find(r => r.rowType === 'debet' || r.debet > 0);
      const kreditRow = rows.find(r => r.rowType === 'kredit' || r.kredit > 0);

      if (debetRow && kreditRow) {
        if (!map.has(`${txId}-${debetRow.kodeRekening}`)) {
          const rawCode = kreditRow.kodeRekening || '';
          const clean = rawCode.split(' - ')[0].trim();
          const refMatch = REFERENSI_REKENING.find(r => r.code === clean);
          map.set(`${txId}-${debetRow.kodeRekening}`, {
            code: kreditRow.kodeRekening,
            name: refMatch?.name || (rawCode.includes(' - ') ? rawCode.split(' - ').slice(1).join(' - ').trim() : rawCode)
          });
        }
        if (!map.has(`${txId}-${kreditRow.kodeRekening}`)) {
          const rawCode = debetRow.kodeRekening || '';
          const clean = rawCode.split(' - ')[0].trim();
          const refMatch = REFERENSI_REKENING.find(r => r.code === clean);
          map.set(`${txId}-${kreditRow.kodeRekening}`, {
            code: debetRow.kodeRekening,
            name: refMatch?.name || (rawCode.includes(' - ') ? rawCode.split(' - ').slice(1).join(' - ').trim() : rawCode)
          });
        }
      }
    });

    return map;
  }, [entries]);

  // Map sub-items rincian dari bkpData berdasarkan idTransaksi
  const bkpSubItemsMap = useMemo(() => {
    const map = new Map<string, BkpData[]>();
    bkpData.forEach(b => {
      if (b.idTransaksi) {
        if (!map.has(b.idTransaksi)) map.set(b.idTransaksi, []);
        map.get(b.idTransaksi)!.push(b);
      }
    });
    return map;
  }, [bkpData]);

  // Tahun yang tersedia dari master entries dan bkpData
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(new Date().getFullYear().toString());
    
    entries.forEach(e => {
      if (e.date) {
        const year = e.date.split('-')[0];
        if (year) years.add(year);
      }
    });

    bkpData.forEach(b => {
      if (b.tanggal) {
        const year = b.tanggal.split('-')[0];
        if (year) years.add(year);
      }
    });

    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [entries, bkpData]);

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
    bkpData.forEach(b => processDate(b.tanggal));

    return Array.from(months).sort();
  }, [entries, bkpData, selectedYear]);

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
  // SALDO PINDAHAN (IDENTIK & KONSISTEN DENGAN BUKU BESAR)
  // =========================================================================
  const { saldoPindahan, pindahanLabel } = useMemo(() => {
    if (!selectedKasAccount || (!selectedYear && !selectedMonth)) {
      return { saldoPindahan: 0, pindahanLabel: '' };
    }

    let cutoffDate = "";
    let label = "";

    if (selectedMonth && selectedYear) {
      cutoffDate = `${selectedYear}-${selectedMonth}-01`;
      label = "SALDO AWAL BULAN LALU";
    } else if (selectedYear) {
      cutoffDate = `${selectedYear}-01-01`;
      label = "SALDO AWAL TAHUN SEBELUMNYA";
    }

    // Hitung dari entries (Jurnal Umum) yang merupakan Single Source of Truth
    if (entries.length > 0) {
      const prevEntries = entries.filter(e => {
        const matchesKas = selectedKasAccount === 'ALL'
          ? (e.kodeRekening && isKasAccount(e.kodeRekening))
          : e.kodeRekening === selectedKasAccount;
        return matchesKas && e.date && e.date < cutoffDate;
      });
      const saldo = prevEntries.reduce((sum, row) => sum + (Number(row.debet || 0) - Number(row.kredit || 0)), 0);
      return { saldoPindahan: saldo, pindahanLabel: label };
    }

    // Fallback jika hanya bkpData yang tersedia
    const prevBkp = bkpData.filter(b => 
      b.tanggal && b.tanggal < cutoffDate
    );
    const saldo = prevBkp.reduce((sum, row) => sum + (Number(row.debet || 0) - Number(row.kredit || 0)), 0);
    return { saldoPindahan: saldo, pindahanLabel: label };
  }, [entries, bkpData, selectedKasAccount, selectedMonth, selectedYear]);

  // =========================================================================
  // TRANSAKSI BUKU PEMBANTU KAS (100% PERSIS BUKU BESAR + RINCIAN AKUN LAWAN)
  // =========================================================================
  const ledgerData = useMemo(() => {
    if (!selectedKasAccount) return [];

    let rawRows: BkpRowItem[] = [];

    // JIKA TERDAPAT ENTRIES (JURNAL UMUM): Gunakan entries sebagai sumber utama
    if (entries.length > 0) {
      const filteredJu = entries.filter(e => {
        if (selectedKasAccount === 'ALL') {
          return e.kodeRekening && isKasAccount(e.kodeRekening);
        }
        return e.kodeRekening === selectedKasAccount;
      });

      rawRows = filteredJu.map((e, idx) => {
        const contra = contraAccountMap.get(`${e.idTransaksi}-${e.kodeRekening}`) || (e.idTransaksi ? contraAccountMap.get(e.idTransaksi) : undefined);
        const sub = e.idTransaksi ? bkpSubItemsMap.get(e.idTransaksi) : undefined;
        const resolvedKategori = (contra?.name && contra.name !== 'Umum' ? contra.name : undefined) || e.kategori || (contra?.code ? getKategoriFromAccountCode(contra.code) : undefined) || getPosBelanjaFromTransaction({
          code: contra?.code,
          akunLawanCode: contra?.code,
          akunLawanName: contra?.name,
          uraian: e.uraian
        });

        return {
          id: e.rowId || `${e.idTransaksi}-${idx}`,
          idTransaksi: e.idTransaksi,
          date: e.date,
          bukti: e.idTransaksi,
          uraian: e.uraian,
          akunLawanCode: contra?.code,
          akunLawanName: contra?.name,
          kategori: resolvedKategori,
          debet: Number(e.debet || 0),
          kredit: Number(e.kredit || 0),
          saldo: 0,
          createdAt: e.createdAt,
          subItems: sub
        };
      });
    } else {
      // Fallback ke bkpData
      rawRows = bkpData.map((b, idx) => {
        const resolvedKategori = b.kategori || getPosBelanjaFromTransaction({
          code: b.bukti,
          uraian: b.uraian
        });

        return {
          id: b.id || `BKP-${idx}`,
          idTransaksi: b.idTransaksi,
          date: b.tanggal,
          bukti: b.bukti || b.idTransaksi,
          uraian: b.uraian,
          akunLawanCode: b.bukti,
          akunLawanName: undefined,
          kategori: resolvedKategori,
          debet: Number(b.debet || 0),
          kredit: Number(b.kredit || 0),
          saldo: 0,
          createdAt: Number(b.id) || idx
        };
      });
    }

    // Filter Periode Tahun & Bulan
    let filtered = rawRows.filter(item => {
      const entryYear = item.date?.split('-')[0];
      const entryMonth = item.date?.split('-')[1];

      const matchYear = !selectedYear || entryYear === selectedYear;
      const matchMonth = !selectedMonth || entryMonth === selectedMonth;
      return matchYear && matchMonth;
    });

    // Filter Kategori jika dipilih
    if (selectedCategory) {
      filtered = filtered.filter(item => item.kategori === selectedCategory || (item.akunLawanName && item.akunLawanName.includes(selectedCategory)));
    }

    // Filter Pencarian Teks
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.uraian && item.uraian.toLowerCase().includes(lower)) ||
        (item.idTransaksi && item.idTransaksi.toLowerCase().includes(lower)) ||
        (item.bukti && item.bukti.toLowerCase().includes(lower)) ||
        (item.akunLawanCode && item.akunLawanCode.toLowerCase().includes(lower)) ||
        (item.akunLawanName && item.akunLawanName.toLowerCase().includes(lower))
      );
    }

    // Urutkan persis seperti Buku Besar (Tanggal -> Waktu Pembuatan)
    filtered.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    // Hitung Saldo Berjalan (Running Balance)
    let runningBalance = (selectedYear || selectedMonth) ? saldoPindahan : 0;
    return filtered.map(row => {
      runningBalance += (row.debet - row.kredit);
      return { ...row, saldo: runningBalance };
    });
  }, [entries, bkpData, selectedKasAccount, selectedYear, selectedMonth, selectedCategory, searchTerm, saldoPindahan, contraAccountMap, bkpSubItemsMap]);

  // Ringkasan Keuangan Periode
  const summary = useMemo(() => {
    const debet = ledgerData.reduce((acc, item) => acc + item.debet, 0);
    const kredit = ledgerData.reduce((acc, item) => acc + item.kredit, 0);
    const mutasi = debet - kredit;
    const initialSaldo = (selectedYear || selectedMonth) ? saldoPindahan : 0;
    const totalSaldoAkhir = initialSaldo + mutasi;

    return { 
      saldoAwal: initialSaldo,
      debet, 
      kredit, 
      mutasiBulanIni: mutasi,
      totalSaldoAkhir
    };
  }, [ledgerData, saldoPindahan, selectedYear, selectedMonth]);

  // Kategori Unik yang ada di data
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    ledgerData.forEach(item => {
      if (item.kategori) cats.add(item.kategori);
      if (item.akunLawanName) cats.add(item.akunLawanName);
    });
    return Array.from(cats).sort();
  }, [ledgerData]);

  const totalPages = Math.ceil(ledgerData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return ledgerData.slice(startIndex, startIndex + itemsPerPage);
  }, [ledgerData, currentPage]);

  const pageSubtotal = useMemo(() => {
    const debet = paginatedData.reduce((acc, item) => acc + item.debet, 0);
    const kredit = paginatedData.reduce((acc, item) => acc + item.kredit, 0);
    return { debet, kredit };
  }, [paginatedData]);

  const handlePrint = () => window.print();

  const handleExportClick = () => {
    const kasClean = currentKasInfo.label.replace(/[^a-zA-Z0-9]/g, '_');
    setExportFilename(`Buku_Pembantu_Kas_${kasClean}_${selectedYear || 'SemuaTahun'}_${selectedMonth || 'SemuaBulan'}`);
    setIsExportModalOpen(true);
  };

  const processExportBkp = () => {
    if (typeof XLSX === 'undefined') return;

    // Header Resmi Excel
    const dataRows = [
      ["PEMERINTAH DESA ADAT BASANGALAS"],
      ["BUKU PEMBANTU KAS"],
      [`Rekening Kas: [${currentKasInfo.code}] ${currentKasInfo.label}`],
      [`Periode: ${selectedMonth && selectedYear ? formatMonthLabelFull(`${selectedYear}-${selectedMonth}`) : (selectedYear ? `Tahun ${selectedYear}` : 'Seluruh Periode Transaksi')}`],
      [],
      ["NO", "TANGGAL", "NOMOR BUKTI", "URAIAN / KETERANGAN", "AKUN LAWAN / SUMBER / TUJUAN", "PENERIMAAN (DEBET)", "PENGELUARAN (KREDIT)", "SALDO KAS (RP)"]
    ];

    if (selectedYear || selectedMonth) {
      dataRows.push([
        "",
        "",
        "",
        pindahanLabel || "SALDO AWAL / PINDAHAN (KUMULATIF LALU)",
        "",
        "",
        "",
        summary.saldoAwal
      ]);
    }

    ledgerData.forEach((item, index) => {
      dataRows.push([
        index + 1,
        item.date,
        item.bukti || item.idTransaksi || '-',
        item.uraian || '-',
        item.akunLawanName ? `[${item.akunLawanCode}] ${item.akunLawanName}` : '-',
        item.debet || 0,
        item.kredit || 0,
        item.saldo || 0
      ]);
    });

    dataRows.push([
      "",
      "",
      "",
      "JUMLAH MUTASI PERIODE INI",
      "",
      summary.debet,
      summary.kredit,
      summary.mutasiBulanIni
    ]);

    dataRows.push([
      "",
      "",
      "",
      "SALDO AKHIR BUKU PEMBANTU KAS",
      "",
      "",
      "",
      summary.totalSaldoAkhir
    ]);

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
    XLSX.utils.book_append_sheet(wb, ws, "Buku Pembantu Kas");
    
    let finalFilename = exportFilename.trim();
    if (!finalFilename.endsWith('.xlsx')) finalFilename += '.xlsx';

    XLSX.writeFile(wb, finalFilename);
    setNotification({ message: 'Buku Pembantu Kas berhasil diekspor ke Excel.', type: 'success' });
    setIsExportModalOpen(false);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedKasAccount('ALL'); // Reset kembali ke default Semua Kas & Bank (1.1.1.)
    setSelectedCategory('');
    setSelectedYear('');
    setSelectedMonth('');
    setCurrentPage(1);
    setNotification({ message: 'Filter dikembalikan ke Rekening Bawaan: Semua Kas & Bank (1.1.1.).', type: 'success' });
  };

  return (
    <div className="bg-white p-1 sm:p-4 space-y-4" id="printable-area">
      {/* Styles khusus cetak Standar Nasional Permendagri */}
      <style>{`
        @media print {
          ${isReceiptModalOpen ? `
            body * { visibility: hidden; }
            #printable-area-bkp-full { display: none !important; }
            #printable-receipt-nota-belanja, #printable-receipt-nota-belanja * { visibility: visible !important; }
            #printable-receipt-nota-belanja {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 16px !important;
              display: block !important;
              background: #ffffff !important;
              color: #000000 !important;
              box-shadow: none !important;
              border: none !important;
              z-index: 99999999 !important;
            }
          ` : `
            body:not(.print-receipt-mode) * { visibility: hidden; }
            body:not(.print-receipt-mode) #printable-area-bkp-full, 
            body:not(.print-receipt-mode) #printable-area-bkp-full * { visibility: visible !important; }
            body:not(.print-receipt-mode) #printable-area-bkp-full { 
              position: absolute !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important; 
              margin: 0 !important; 
              padding: 20px !important; 
              display: block !important; 
              background: white !important; 
              color: black !important; 
            }
          `}
          body.print-receipt-mode #printable-area-bkp-full {
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
          .bkp-summary-row { page-break-inside: avoid !important; break-inside: avoid !important; }
          .signature-section { display: flex !important; page-break-inside: avoid !important; break-inside: avoid !important; margin-top: 24px; }
        }
      `}</style>
      
      {notification && (
        <div className="no-print">
          <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}
      
      {/* ========================================================================= */}
      {/* TEMPLATE CETAK RESMI: BUKU PEMBANTU KAS (STANDAR NASIONAL PEMERINTAH DESA) */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-slate-900 mb-4 pb-4" id="printable-area-bkp-full">
        <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
            DESA ADAT BASANGALAS
          </h2>
          <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
            Tata Kelola Keuangan Desa Adat
          </p>
          <p className="text-xs font-semibold text-slate-700 font-serif m-0">
            Jl. Raya Basangalas, Tribuana, Abang, Karangasem - Bali
          </p>
        </div>

        <div className="text-center mb-4">
          <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
            BUKU PEMBANTU KAS
          </h3>
          <div className="flex justify-center items-center gap-4 text-xs font-bold text-slate-800 mt-1 uppercase">
            <span>Rekening Kas: [{currentKasInfo.code}] {currentKasInfo.label}</span>
            <span>•</span>
            <span>Tahun Anggaran: {selectedYear || new Date().getFullYear()}</span>
          </div>
          <p className="text-xs font-semibold text-slate-700 mt-0.5 font-mono">
            Periode: {selectedMonth && selectedYear ? formatMonthLabelFull(`${selectedYear}-${selectedMonth}`) : (selectedYear ? `Tahun ${selectedYear}` : 'Seluruh Periode Transaksi')}
          </p>
        </div>

        <div className="mt-4">
          <table className="w-full text-left border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 font-black text-center text-[10px]">
                <th className="p-1 border border-black w-8">No</th>
                <th className="p-1 border border-black w-20">Tanggal</th>
                <th className="p-1 border border-black w-24">No. Bukti</th>
                <th className="p-1 border border-black">Uraian / Keterangan</th>
                <th className="p-1 border border-black text-right w-24">Penerimaan (Debet)</th>
                <th className="p-1 border border-black text-right w-24">Pengeluaran (Kredit)</th>
                <th className="p-1 border border-black text-right w-24">Saldo Kas (Rp)</th>
              </tr>
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
              {(selectedYear || selectedMonth) && (
                <tr className="bg-slate-50 italic font-semibold">
                  <td className="p-1 text-center border border-black font-mono text-[9px]">-</td>
                  <td className="p-1 text-center border border-black font-mono text-[9px]">
                    {selectedMonth && selectedYear ? `${selectedYear}-${selectedMonth}-01` : `${selectedYear || new Date().getFullYear()}-01-01`}
                  </td>
                  <td className="p-1 text-center border border-black font-mono text-[9px]">-</td>
                  <td className="p-1 font-bold uppercase text-[9px] border border-black">
                    {pindahanLabel || "SALDO AWAL / PINDAHAN (KUMULATIF LALU)"}
                  </td>
                  <td className="p-1 text-right border border-black text-[9.5px]">
                    {summary.saldoAwal >= 0 ? formatCurrency(summary.saldoAwal) : '-'}
                  </td>
                  <td className="p-1 text-right border border-black text-[9.5px]">
                    {summary.saldoAwal < 0 ? formatCurrency(Math.abs(summary.saldoAwal)) : '-'}
                  </td>
                  <td className="p-1 text-right font-black border border-black text-[9.5px]">
                    {formatCurrency(summary.saldoAwal)}
                  </td>
                </tr>
              )}
              {ledgerData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-1 text-center border border-black font-mono text-[9px]">{idx + 1}</td>
                  <td className="p-1 text-center border border-black whitespace-nowrap text-[9px]">{formatDate(item.date)}</td>
                  <td className="p-1 text-center font-mono border border-black text-[9px]">{item.bukti || item.idTransaksi || '-'}</td>
                  <td className="p-1 border border-black text-[9.5px] leading-tight">
                    {item.uraian}
                    {item.akunLawanName && (
                      <div className="p-0.5 text-[8.5px] italic text-slate-700">
                        Akun Lawan: {item.akunLawanCode} - {item.akunLawanName}
                      </div>
                    )}
                  </td>
                  <td className="p-1 text-right border border-black text-[9.5px]">{item.debet > 0 ? formatCurrency(item.debet) : '-'}</td>
                  <td className="p-1 text-right border border-black text-[9.5px]">{item.kredit > 0 ? formatCurrency(item.kredit) : '-'}</td>
                  <td className="p-1 text-right font-bold border border-black text-[9.5px]">{formatCurrency(item.saldo)}</td>
                </tr>
              ))}

              {ledgerData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500 italic border border-black">
                    Tidak ada catatan transaksi pada Buku Pembantu Kas untuk kriteria ini.
                  </td>
                </tr>
              )}

              {/* Baris Total Mutasi */}
              <tr className="bg-slate-100 font-bold border-t-2 border-black bkp-summary-row break-inside-avoid">
                <td colSpan={4} className="border border-black p-1.5 text-right uppercase text-[9px] font-black">
                  JUMLAH TRANSAKSI PERIODE INI
                </td>
                <td className="border border-black p-1.5 text-right font-black text-[9.5px]">{formatCurrency(summary.debet)}</td>
                <td className="border border-black p-1.5 text-right font-black text-[9.5px]">{formatCurrency(summary.kredit)}</td>
                <td className="border border-black p-1.5 text-right font-black text-[9.5px]">{formatCurrency(summary.mutasiBulanIni)}</td>
              </tr>

              {/* Baris Saldo Akhir Buku Pembantu Kas */}
              <tr className="bg-slate-200 font-black bkp-summary-row break-inside-avoid">
                <td colSpan={5} className="border border-black p-2 text-right uppercase text-[10px]">
                  SALDO AKHIR BUKU PEMBANTU KAS
                </td>
                <td colSpan={2} className="border border-black p-2 text-right text-sm font-black bg-emerald-50 text-slate-900">
                  {formatCurrency(summary.totalSaldoAkhir)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Register Penutupan Kas / Pernyataan Saldo Kas */}
          <div className="mt-4 p-3 border border-slate-400 bg-slate-50 text-[10px] break-inside-avoid">
            <div className="flex justify-between items-center font-bold border-b border-slate-300 pb-1 mb-1.5">
              <span className="uppercase">Register Penutupan Buku Pembantu Kas</span>
              <span className="font-mono">Tanggal: {formatDate(signatureDate)}</span>
            </div>
            <p className="m-0 leading-relaxed text-slate-800">
              Pada hari ini, tanggal <strong>{formatDate(signatureDate)}</strong>, Buku Pembantu Kas untuk rekening <strong>[{currentKasInfo.code}] {currentKasInfo.label}</strong> ditutup dengan saldo akhir sebesar <strong>{formatCurrency(summary.totalSaldoAkhir)}</strong>.
            </p>
            <p className="mt-1 font-semibold italic text-slate-700">
              Terbilang: ({numberToWords(Math.abs(summary.totalSaldoAkhir))} Rupiah).
            </p>
          </div>

          {/* Pengesahan Tanda Tangan */}
          <div className="mt-4 border-t border-slate-300 pt-2">
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
          <div className="flex justify-between items-center mt-8 px-6 text-slate-900 border-t border-slate-300 pt-2">
            <div>
              <p className="font-semibold text-[9px] m-0">Dokumen Resmi Sistem Informasi Tata Kelola Keuangan Desa Adat Basangalas.</p>
              <p className="text-[8px] text-slate-500 m-0">Buku Pembantu Kas Standar Akuntansi Permendagri No. 20/2018 (Sinkron 100% dengan Buku Besar).</p>
            </div>
            <div className="text-right font-mono text-[8px] text-slate-500">
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
            <div className="absolute -right-0 -bottom-0 opacity-10 text-emerald-300 pointer-events-none">
                <BookCopy size={110} />
            </div>
        </div>
  
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Otomatisasi TTD & Stempel BKP */}
              <button 
                type="button"
                onClick={handleOpenSettings}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-xs transition-colors cursor-pointer"
                title="Status Otomatisasi Tanda Tangan & Stempel BKP (Klik untuk mengubah)"
              >
                <FileSignature size={14} className="text-teal-600" />
                <span className={embedSignatures ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  Tanda Tangan: {embedSignatures ? 'ON' : 'OFF'}
                </span>
                <span className="text-slate-300">•</span>
                <span className={showStampOverlay ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                  Stempel: {showStampOverlay ? 'ON' : 'OFF'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">
                  Klik Untuk Rubah
                </span>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-700 text-white rounded-xl shadow-md">
                <BookCopy size={28} />
              </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-serif">
                  Buku Pembantu Kas</h1>
                <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-blue-600" />
                  Sinkron 100% Buku Besar
                </span>
              </div>
              <p className="text-teal-700 text-xs font-medium mt-0.5">
                Buku Pembantu Kas Standar Permendagri No. 20/2018. Terintegrasi penuh dengan Jurnal Umum & Buku Besar sehingga angka debet, kredit, dan saldo kas selalu akurat dan profesional.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap justify-end">
          {/* TOMBOL MENU TERPADU (SETTING, EXPORT, UNDUH, CETAK, FILTER) */}
          <div className="relative" ref={menuRef}>
            <button 
              id="bkp-header-menu-button"
              type="button"
              onClick={() => setIsMenuOpen(prev => !prev)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs border border-slate-700 active:scale-95 cursor-pointer"
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              title="Buka Menu Tindakan Buku Pembantu Kas"
            >
              <Menu size={16} className="text-emerald-300" />
              <span className="tracking-wide">Menu BKP</span>
              <ChevronDown size={14} className={`transition-transform duration-200 text-emerald-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMenuOpen && (
              <div 
                id="bkp-header-menu-dropdown"
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100"
              >
                {/* 1. Dokumen, Cetak & Ekspor */}
                <div className="p-1.5">
                  <div className="px-3 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">
                    Dokumen, Cetak & Ekspor
                  </div>

                  {/* Cetak BKP */}
                  <button
                    type="button"
                    onClick={() => {
                      handlePrint();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-emerald-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg group-hover:bg-emerald-200 transition-colors">
                      <Printer size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Cetak BKP</div>
                      <div className="text-[11px] text-slate-500 truncate">Cetak lembar Buku Pembantu Kas ({currentKasInfo.code})</div>
                    </div>
                  </button>

                  {/* Reset Filter BKP */}
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-amber-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-lg group-hover:bg-amber-200 transition-colors">
                      <RotateCcw size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Reset Filter</div>
                      <div className="text-[11px] text-slate-500 truncate">Kembalikan ke Kas Juru Raksa default</div>
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
                      <div className="text-[11px] text-slate-500 truncate">Atur orientasi &amp; download PDF BKP</div>
                    </div>
                  </button>

                  {/* Export Excel */}
                  <button
                    type="button"
                    onClick={() => {
                      handleExportClick();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-teal-50 transition-colors group cursor-pointer"
                  >
                    <div className="p-2 bg-teal-100 text-teal-800 rounded-lg group-hover:bg-teal-200 transition-colors">
                      <FileSpreadsheet size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">Export Excel (.xlsx)</div>
                      <div className="text-[11px] text-slate-500 truncate">Unduh data BKP ke spreadsheet Excel</div>
                    </div>
                  </button>
                </div>

                {/* 2. Konfigurasi & Penatausahaan */}
                <div className="p-1.5">
                  <div className="px-3 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">
                    Konfigurasi & Pengaturan
                  </div>

                  {/* Setting TTD */}
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

      {/* BILAH FILTER UTAMA & PILIHAN REKENING KAS (DEFAULT: KAS JURU RAKSA) */}
      <div className="bg-slate-50 border border-slate-400 rounded-xl p-3.5 space-y-3 no-print shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-2 border-b border-slate-300">
          {/* Active Ledger Status Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Coins size={14} className="text-emerald-700" />
              Rekening Kas Aktif:
            </span>
            <div className="flex items-center gap-2 bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-inner">
              <span>{currentKasInfo.label}</span>
              <span className="bg-emerald-900/60 text-emerald-200 px-1.5 py-0.2 rounded font-mono text-[11px]">
                {currentKasInfo.code}
              </span>
            </div>
            {selectedKasAccount === 'ALL' && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Default BKP
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium">Total: <strong>{ledgerData.length}</strong> transaksi</span>
          </div>
        </div>

        {/* Quick Account Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap mr-1">Pintas:</span>
          <button
            onClick={() => { setSelectedKasAccount('ALL'); setCurrentPage(1); }}
            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all border ${
              selectedKasAccount === 'ALL' 
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            Semua Kas & Bank (1.1.1.)
          </button>
          {availableKasAccounts.slice(0, 2).map(k => (
            <button
              key={k.code}
              onClick={() => { setSelectedKasAccount(k.code); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all border ${
                selectedKasAccount === k.code 
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {k.code === '1.1.1.02' ? '⭐ Kas Juru Raksa' : k.label}
            </button>
          ))}
          <span className="text-[10px] font-bold uppercase text-slate-500 whitespace-nowrap mr-1"></span>
          {availableKasAccounts.slice(8, 12).map(k => (
            <button
              key={k.code}
              onClick={() => { setSelectedKasAccount(k.code); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] whitespace-nowrap transition-all border ${
                selectedKasAccount === k.code 
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {k.code === '1.1.1.02' ? '⭐ Kas Juru Raksa' : k.label}
            </button>
          ))}
        </div>

        {/* Baris Kontrol Filter Lengkap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* 1. Pilih Rekening Kas Pembantu */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1">Pilih Rekening Kas</label>
            <select 
              value={selectedKasAccount} 
              onChange={(e) => { setSelectedKasAccount(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Kas & Bank (1.1.1.)</option>
              {availableKasAccounts.map(k => (
                <option key={k.code} value={k.code}>
                  [{k.code}] {k.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Pilih Kategori Transaksi */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1">Kategori / Akun Lawan</label>
            <select 
              value={selectedCategory} 
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Kategori</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 3. Filter Periode Tahun */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1">Tahun Anggaran</label>
            <select 
              value={selectedYear} 
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth(''); setCurrentPage(1); }} 
              className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Tahun</option>
              {availableYears.map(year => (
                <option key={year} value={year}>Tahun {year}</option>
              ))}
            </select>
          </div>

          {/* 4. Filter Periode Bulan */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1">Bulan Transaksi</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }} 
              className="w-full bg-white border border-slate-300 rounded-lg py-1.5 px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Bulan</option>
              {availableMonths.map(mm => (
                <option key={mm} value={mm}>{formatMonthLabelOnly(mm)}</option>
              ))}
            </select>
          </div>

          {/* 5. Pencarian Kata Kunci & Reset */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1">Pencarian / Reset</label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Cari uraian / bukti..." 
                  value={searchTerm} 
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-white border border-slate-300 rounded-lg py-1.5 pl-7 pr-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                />
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <button
                onClick={handleResetFilters}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                title="Reset Filter ke Bawaan (Kas Juru Raksa)"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RINGKASAN SALDO & MUTASI (FINANCIAL SUMMARY CARDS - SINKRON BUKU BESAR) */}
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
          <div className="text-[10px] text-slate-600 mt-0.5">
            {selectedYear || selectedMonth ? (pindahanLabel || 'Kumulatif periode lalu') : 'Termasuk dalam saldo berjalan'}
          </div>
        </div>

        {/* Card Total Penerimaan (Debet) */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800">Penerimaan Kas (Debet)</span>
            <span className="bg-emerald-200 text-emerald-900 text-[10px] font-bold px-1.5 rounded flex items-center gap-0.5">
              <ArrowDownLeft size={11} /> Kas Masuk
            </span>
          </div>
          <div className="text-lg font-black text-emerald-700">
            {formatCurrency(summary.debet)}
          </div>
          <div className="text-[10px] text-emerald-800/80 mt-0.5">
            {ledgerData.filter(i => i.debet > 0).length} transaksi penerimaan
          </div>
        </div>

        {/* Card Total Pengeluaran (Kredit) */}
        <div className="bg-rose-50/70 border border-rose-600 rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-rose-800">Pengeluaran Kas (Kredit)</span>
            <span className="bg-rose-200 text-rose-900 text-[10px] font-bold px-1.5 rounded flex items-center gap-0.5">
              <ArrowUpRight size={11} /> Kas Keluar
            </span>
          </div>
          <div className="text-lg font-black text-rose-800">
            {formatCurrency(summary.kredit)}
          </div>
          <div className="text-[10px] text-rose-800 mt-0.5">
            {ledgerData.filter(i => i.kredit > 0).length} transaksi belanja / mutasi
          </div>
        </div>

        {/* Card Saldo Akhir Kas Terkini */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-200 flex items-center gap-1">
              <Wallet size={12} className="text-emerald-200" />
              Saldo Akhir Kas Pembantu
            </span>
            <span className="text-[10px] font-mono text-emerald-200 font-bold">{currentKasInfo.code}</span>
          </div>
          <div className="text-lg font-black text-emerald-200">
            {formatCurrency(summary.totalSaldoAkhir)}
          </div>
          <div className="text-[10px] text-slate-200 mt-0.5 truncate">
            {summary.mutasiBulanIni >= 0 ? `+ Mutasi: ${formatCurrency(summary.mutasiBulanIni)}` : `- Defisit: ${formatCurrency(Math.abs(summary.mutasiBulanIni))}`}
          </div>
        </div>
      </div>

      {/* TABEL BUKU PEMBANTU KAS STANDAR PROFESIONAL (SINKRON DENGAN BUKU BESAR) */}
      <div className="no-print overflow-x-auto rounded-xl border border-slate-400 shadow-sm bg-white">
        <table className="w-full text-xs text-left text-slate-800">
          <thead className="text-[11px] text-slate-900 uppercase bg-slate-100 font-black border-b-2 border-slate-300">
            <tr>
              <th className="px-3 py-2.5 text-center w-12 border-r border-slate-200">No</th>
              <th className="px-3 py-2.5 text-center w-28 border-r border-slate-200">Tanggal</th>
              <th className="px-3 py-2.5 text-center w-28 border-r border-slate-200">No. Bukti</th>
              <th className="px-4 py-2.5 border-r border-slate-200">Uraian / Keterangan</th>
              <th className="px-3 py-2.5 text-right w-32 border-r border-slate-200 text-emerald-800">Penerimaan (Debet)</th>
              <th className="px-3 py-2.5 text-right w-32 border-r border-slate-200 text-rose-800">Pengeluaran (Kredit)</th>
              <th className="px-3 py-2.5 text-right w-36 text-slate-900">Saldo Kas (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {(selectedYear || selectedMonth) && (
              <tr className="bg-slate-100 font-bold italic text-slate-700">
                <td className="px-3 py-2 text-center border-r border-slate-200 text-slate-400">-</td>
                <td className="px-3 py-2 text-center border-r border-slate-200"></td>
                <td className="px-3 py-2 text-center border-r border-slate-200"></td>
                <td className="px-4 py-2 border-r border-slate-200 font-black uppercase text-[11px] text-slate-800">
                  {pindahanLabel || "SALDO AWAL / PINDAHAN (KUMULATIF LALU)"}
                </td>
                <td className="px-3 py-2 text-right border-r border-slate-200 text-slate-400">-</td>
                <td className="px-3 py-2 text-right border-r border-slate-200 text-slate-400">-</td>
                <td className="px-3 py-2 text-right font-black text-slate-900">{formatCurrency(summary.saldoAwal)}</td>
              </tr>
            )}

            {paginatedData.map((item, idx) => {
              const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
              const hasSub = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedTxId === item.idTransaksi;

              return (
                <React.Fragment key={item.id || idx}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 text-center border-r border-slate-200 font-mono text-[11px] text-slate-500">
                      {rowNumber}
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-slate-200 whitespace-nowrap text-[11px] text-slate-700">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] border-r border-slate-200 text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {item.bukti || item.idTransaksi || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-200 text-slate-900" style={{ wordBreak: 'break-word', minWidth: '240px' }}>
                      <div className="font-semibold text-[12px]">{item.uraian}</div>
                      {item.akunLawanName && (
                        <div className="mt-1">
                          <span className="font-mono text-[9.5px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-bold inline-block mr-1">
                            {item.akunLawanCode}
                          </span>
                          <span className="text-[11px] font-medium text-slate-600">
                            {item.akunLawanName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.kategori && (
                          <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {item.kategori}
                          </span>
                        )}
                        {item.kredit > 0 && (
                          <button
                            onClick={() => {
                              const subs = item.subItems || [];
                              let mappedItems: Array<{ id: string; name: string; qty: number; price: number }> = [];

                              if (subs.length > 0) {
                                mappedItems = subs.map((s, idx) => {
                                  const match = s.uraian.match(/^(.*?)\s*\(([\d.,]+)\s*x\s*([\d.,]+)\)$/);
                                  if (match) {
                                    const q = parseFloat(match[2].replace(/\./g, '').replace(',', '.')) || 1;
                                    const p = parseFloat(match[3].replace(/\./g, '').replace(',', '.')) || (s.kredit || s.debet || 0);
                                    return {
                                      id: (idx + 1).toString(),
                                      name: match[1].trim(),
                                      qty: q,
                                      price: p
                                    };
                                  }
                                  return {
                                    id: (idx + 1).toString(),
                                    name: s.uraian,
                                    qty: 1,
                                    price: s.kredit || s.debet || 0
                                  };
                                });
                              } else {
                                const match = item.uraian.match(/^(.*?)\s*\(([\d.,]+)\s*x\s*([\d.,]+)\)$/);
                                if (match) {
                                  const q = parseFloat(match[2].replace(/\./g, '').replace(',', '.')) || 1;
                                  const p = parseFloat(match[3].replace(/\./g, '').replace(',', '.')) || (item.kredit || item.debet || 0);
                                  mappedItems = [{
                                    id: '1',
                                    name: match[1].trim(),
                                    qty: q,
                                    price: p
                                  }];
                                } else {
                                  mappedItems = [{
                                    id: '1',
                                    name: item.uraian || 'Barang / Jasa',
                                    qty: 1,
                                    price: item.kredit || item.debet || 0
                                  }];
                                }
                              }

                              setSelectedReceiptEntry({
                                id: item.id || '',
                                idTransaksi: item.idTransaksi,
                                date: item.date,
                                tanggal: item.date,
                                bukti: item.bukti || item.idTransaksi || '',
                                uraian: item.uraian,
                                debet: item.debet,
                                kredit: item.kredit,
                                saldo: item.saldo,
                                kategori: item.kategori,
                                namaAkun: item.akunLawanName,
                                kode: item.akunLawanCode,
                                akunLawanCode: item.akunLawanCode,
                                akunLawanName: item.akunLawanName,
                                subItems: item.subItems,
                                items: mappedItems
                              });
                              setIsReceiptModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Cetak Kwitansi / Nota Belanja (A5)"
                          >
                            <Printer size={10} />
                            <span>Cetak Nota</span>
                          </button>
                        )}
                        {hasSub && (
                          <button
                            onClick={() => setExpandedTxId(isExpanded ? null : (item.idTransaksi || null))}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5 transition-colors"
                          >
                            <ListOrdered size={10} />
                            <span>{item.subItems!.length} Rincian Nota</span>
                            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-slate-200 text-emerald-700 font-bold text-[12px]">
                      {item.debet > 0 ? formatCurrency(item.debet) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-slate-200 text-rose-700 font-bold text-[12px]">
                      {item.kredit > 0 ? formatCurrency(item.kredit) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-slate-900 text-[12px]">
                      {formatCurrency(item.saldo)}
                    </td>
                  </tr>

                  {/* Rincian Nota Dropdown Jika Di-expand */}
                  {isExpanded && hasSub && (
                    <tr className="bg-emerald-50/50 border-b border-emerald-200">
                      <td colSpan={7} className="p-3 pl-12">
                        <div className="bg-white border border-emerald-200 rounded-lg p-2.5 text-xs shadow-inner">
                          <div className="font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                            <ListOrdered size={13} className="text-emerald-700" />
                            <span>Rincian Item Nota / Kwitansi Terkait:</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.subItems!.map((sub, sIdx) => (
                              <div key={sIdx} className="bg-slate-50 border border-slate-200 p-2 rounded flex justify-between items-center text-[11px]">
                                <span className="font-medium text-slate-800">{sub.uraian}</span>
                                <span className="font-mono font-bold text-slate-900">
                                  {formatCurrency(sub.kredit || sub.debet)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {ledgerData.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-slate-500 italic text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <BookCopy size={36} className="text-slate-300" />
                    <p className="font-semibold text-slate-700">Tidak ada catatan transaksi pada Buku Pembantu Kas.</p>
                    <p className="text-xs text-slate-500">
                      Seluruh transaksi kas diambil otomatis dari Jurnal Umum & Buku Besar.
                    </p>
                    {selectedKasAccount !== 'ALL' && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-emerald-800 transition-colors"
                      >
                        Kembali ke Semua Kas & Bank (Default)
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>

          {ledgerData.length > 0 && (
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
              {totalPages > 1 && (
                <tr className="bg-slate-200/80 border-b border-slate-300 text-slate-800">
                  <td colSpan={4} className="px-4 py-2 text-right uppercase font-bold text-[11px]">
                    Subtotal Halaman Ini (Hal. {currentPage} dari {totalPages})
                  </td>
                  <td className="px-3 py-2 text-right font-black text-emerald-800 text-[12px]">
                    {formatCurrency(pageSubtotal.debet)}
                  </td>
                  <td className="px-3 py-2 text-right font-black text-rose-800 text-[12px]">
                    {formatCurrency(pageSubtotal.kredit)}
                  </td>
                  <td className="px-3 py-2 text-right font-black text-slate-900 text-[12px]">
                    {formatCurrency(pageSubtotal.debet - pageSubtotal.kredit)}
                  </td>
                </tr>
              )}
              <tr className="bg-slate-200 border-b border-slate-400 text-slate-900">
                <td colSpan={4} className="px-4 py-2.5 text-right uppercase font-black text-[11px]">
                  JUMLAH MUTASI PERIODE INI ({ledgerData.length} baris transaksi)
                </td>
                <td className="px-3 py-2.5 text-right font-black text-emerald-800 text-[12px]">
                  {formatCurrency(summary.debet)}
                </td>
                <td className="px-3 py-2.5 text-right font-black text-rose-800 text-[12px]">
                  {formatCurrency(summary.kredit)}
                </td>
                <td className="px-3 py-2.5 text-right font-black text-slate-900 text-[12px]">
                  {formatCurrency(summary.mutasiBulanIni)}
                </td>
              </tr>
              <tr className="bg-slate-900 text-white font-black">
                <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wider font-mono text-[11px] text-slate-200">
                  SALDO AKHIR BUKU PEMBANTU KAS [{currentKasInfo.code}]
                </td>
                <td colSpan={2} className="px-4 py-3 text-right font-mono text-base font-black text-emerald-300 bg-slate-950">
                  {formatCurrency(summary.totalSaldoAkhir)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination Kontrol */}
      {totalPages > 1 && (
        <div className="no-print">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* FOOTER INFORMASI PENUTUPAN & TANDA TANGAN (ON-SCREEN) */}
      <div className="no-print mt-6 bg-slate-50 border border-slate-400 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-300 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-600" />
            Register Penutupan & Pengesahan Buku Pembantu Kas
          </span>
          <span className="text-xs font-mono text-slate-600">
            {customPlace}, {formatDate(signatureDate)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="bg-white p-3 rounded-lg border border-slate-300">
            <p className="font-semibold text-slate-900 mb-1">Status Sinkronisasi Buku Besar:</p>
            <p className="leading-relaxed text-[11px] text-slate-700">
              Buku Pembantu Kas untuk rekening <strong>[{currentKasInfo.code}] {currentKasInfo.label}</strong> menampilkan saldo akhir sebesar <strong className="text-emerald-800">{formatCurrency(summary.totalSaldoAkhir)}</strong>.
            </p>
            <p className="mt-1 text-[11px] italic text-slate-900 font-medium">
              Terbilang: {numberToWords(Math.abs(summary.totalSaldoAkhir))} Rupiah.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center bg-white p-3 rounded-lg border border-slate-300">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Mengetahui,</p>
              <p className="text-[11px] font-bold text-slate-900 mt-0.5">Keliang Adat Basangalas</p>
              <div className="h-14 flex items-center justify-center my-1">
                {embedSignatures && signatures.keliang ? (
                  <img
                    src={signatures.keliang}
                    alt="TTD Keliang Adat"
                    className="max-h-12 max-w-[120px] object-contain pointer-events-none"
                  />
                ) : (
                  <span className="text-[10px] text-slate-300 italic">( Tanda Tangan )</span>
                )}
              </div>
              <p className="text-[11px] font-black border-t border-slate-300 pt-1 text-slate-900">{keliangName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Dibuat Oleh,</p>
              <p className="text-[11px] font-bold text-slate-900 mt-0.5">Juru Raksa Desa Adat</p>
              <div className="h-14 flex items-center justify-center my-1">
                {embedSignatures && signatures.juruRaksa ? (
                  <img
                    src={signatures.juruRaksa}
                    alt="TTD Juru Raksa"
                    className="max-h-12 max-w-[120px] object-contain pointer-events-none"
                  />
                ) : (
                  <span className="text-[10px] text-slate-300 italic">( Tanda Tangan )</span>
                )}
              </div>
              <p className="text-[11px] font-black border-t border-slate-300 pt-1 text-slate-900">{juruRaksaName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Formal Footer */}
      <div className="flex justify-between items-center mt-8 text-slate-900 border-t border-slate-300 pt-4 no-print">
        <div>
          <p className="font-semibold">Dokumen Resmi Sistem Informasi Tata Kelola Keuangan Desa Adat Basangalas.</p>
          <p className="text-[12px] text-slate-500 m-0">Buku Pembantu Kas Standar Akuntansi Permendagri No. 20/2018 (Sinkron 100% dengan Buku Besar).</p>
        </div>
        <div className="text-right font-mono text-[10px] text-slate-500">
          <p className="m-0">Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* EXPORT PDF MODAL & CONTROLLER */}
      <ExportPdfButton 
        elementId="printable-area-bkp-full" 
        filename={`Buku_Pembantu_Kas_${currentKasInfo.code}_${selectedYear || 'Semua'}_${selectedMonth || 'Semua'}.pdf`} 
        buttonText="Unduh PDF" 
        hideButton={true}
        defaultOrientation="portrait"
        options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
        isOpen={isPdfModalOpen}
        onOpenChange={setIsPdfModalOpen}
      />

      {/* MODAL SETTING TANDA TANGAN */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Tanda Tangan Buku Pembantu Kas">
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
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Keliang Adat (Mengetahui)</label>
            <input 
              type="text" 
              value={tempKeliangName} 
              onChange={e => setTempKeliangName(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Juru Raksa (Dibuat Oleh)</label>
            <input 
              type="text" 
              value={tempJuruRaksaName} 
              onChange={e => setTempJuruRaksaName(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500" 
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tempat / Desa</label>
              <input 
                type="text" 
                value={tempCustomPlace} 
                onChange={e => setTempCustomPlace(e.target.value)} 
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tanggal Tanda Tangan</label>
              <input 
                type="date" 
                value={tempSignatureDate} 
                onChange={e => setTempSignatureDate(e.target.value)} 
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button 
              onClick={() => setIsSettingsOpen(false)} 
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button 
              onClick={() => setIsConfirmSaveSettingsOpen(true)} 
              className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL SAVE SETTINGS */}
      <ConfirmationModal 
        isOpen={isConfirmSaveSettingsOpen} 
        title="Simpan Pengaturan Tanda Tangan" 
        message="Apakah Anda yakin ingin memperbarui data tanda tangan dan pengesahan pada Buku Pembantu Kas?" 
        confirmText="Ya, Simpan" 
        onConfirm={handleConfirmSaveSettings} 
        onClose={() => setIsConfirmSaveSettingsOpen(false)} 
      />

      {/* MODAL EXPORT EXCEL */}
      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Buku Pembantu Kas ke Excel">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama File Excel (.xlsx)</label>
            <input 
              type="text" 
              value={exportFilename} 
              onChange={e => setExportFilename(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500" 
            />
          </div>
          <p className="text-xs text-slate-500">
            File Excel akan berisi seluruh baris transaksi rekening kas <strong>[{currentKasInfo.code}] {currentKasInfo.label}</strong> lengkap dengan kolom saldo awal, akun lawan, penerimaan, pengeluaran, mutasi, dan pengesahan.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button 
              onClick={() => setIsExportModalOpen(false)} 
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button 
              onClick={processExportBkp} 
              className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors flex items-center gap-1"
            >
              <FileSpreadsheet size={14} />
              <span>Unduh File Excel</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL CETAK NOTA BELANJA / KWITANSI */}
      <NotaBelanjaReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedReceiptEntry(null);
        }}
        entry={selectedReceiptEntry}
      />
    </div>
  );
};

export default BukuKasPembantu;
