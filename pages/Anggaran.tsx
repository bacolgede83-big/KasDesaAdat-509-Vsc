import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { BudgetItem, ManualBudgetCaps, JuDisplayRow, RincianPaguItem } from '../types';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { 
  Plus, Pencil, Trash2, Save, Download, Printer, 
  AlertCircle, CheckCircle2, FileCheck2, ArrowUpRight, 
  Settings, Search, Sparkles, SlidersHorizontal, 
  PieChart, RefreshCw, Layers, TrendingUp, TrendingDown,
  Info, Landmark, BookOpen, AlertTriangle, Menu, ChevronDown, FileSpreadsheet,
  Tag, Calculator, HelpCircle, ArrowRightLeft, FileSignature, Check, Eye
} from 'lucide-react';
import { numberToWords, formatCurrency, formatLongDate } from '../utils/formatter';
import { REFERENSI_REKENING } from '../constants';
import { ReportSignatureBlock } from '../components/shared/ReportSignatureBlock';
import { 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  saveSignatureSettings, 
  setStampOverlayEnabled 
} from '../utils/signatureStorage';

declare const XLSX: any;

interface AnggaranProps {
  budgetItems: BudgetItem[];
  setBudgetItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  manualBudgetCaps?: ManualBudgetCaps;
  onSetManualBudgetCaps?: (caps: ManualBudgetCaps) => void;
  entries?: JuDisplayRow[];
  onAddBudgetItem?: (item: BudgetItem) => Promise<void>;
  onUpdateBudgetItem?: (item: BudgetItem) => Promise<void>;
  onDeleteBudgetItem?: (id: string) => Promise<void>;
  onBatchSaveBudgetItems?: (items: BudgetItem[]) => Promise<void>;
  setActivePage?: (page: string) => void;
}

// Master Pos Standar Akuntansi Nasional
interface AccountGroupDef {
  id: string;
  codePrefix: string;
  title: string;
  categoryType: 'pendapatan' | 'belanja' | 'sumberdana';
  description: string;
}

const ACCOUNT_GROUPS: AccountGroupDef[] = [
  { id: 'pendapatan-adat', codePrefix: '4.1.1', title: 'I. PENDAPATAN DESA ADAT', categoryType: 'pendapatan', description: 'Pendapatan Desa Adat, Bunga LPD, Saldo Awal' },
  { id: 'belanja-operasional-adat', codePrefix: '5.1.5', title: 'II.1 BEBAN OPERASIONAL ADAT', categoryType: 'belanja', description: 'Gong, Peralatan, Kundangan, Dana Punia, Pesangkepan, ATK, dll' },
  { id: 'belanja-parhyangan-adat', codePrefix: '5.2.1', title: 'II.2 PARHYANGAN ADAT', categoryType: 'belanja', description: 'Pecanangan, Dana Aci Melanting/Dalem/BaleAgung/Puseh/UlunSuwi, Galungan, Kuningan, dll' },
  { id: 'belanja-pawongan-adat', codePrefix: '5.3.2', title: 'II.3 PAWONGAN ADAT', categoryType: 'belanja', description: 'Dana Kematian, Pawongan Lainnya' },
  { id: 'belanja-palemahan-adat', codePrefix: '5.4.1', title: 'II.4 PROGRAM PALEMAHAN', categoryType: 'belanja', description: 'Penataan Wewidangan, Pengelolaan Sampah, Setra' },
  { id: 'sumberdana', codePrefix: '7', title: 'III. SUMBER DANA', categoryType: 'sumberdana', description: 'Penerimaan sumber dana, Ekuitas Dll' },
];

const Anggaran: React.FC<AnggaranProps> = ({ 
  budgetItems = [], 
  setBudgetItems, 
  entries = [],
  onAddBudgetItem,
  onUpdateBudgetItem,
  onDeleteBudgetItem,
  onBatchSaveBudgetItems,
  setActivePage
}) => {
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubpage, setActiveSubpage] = useState<'rapb' | 'anggaran-1-tahun'>('rapb');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<BudgetItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Penanda Khusus & Modal Rincian Pagu Anggaran
  const [isRincianModalOpen, setIsRincianModalOpen] = useState<boolean>(false);
  const [selectedItemForRincian, setSelectedItemForRincian] = useState<BudgetItem | null>(null);

  // Signatures & Print Configuration State
  const [keliangName, setKeliangName] = useState(() => localStorage.getItem('anggaran_keliangName') || 'I Made Mudita');
  const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('anggaran_juruRaksaName') || 'I Putu Gede Sutrana');
  const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('anggaran_customPlace') || 'Basangalas');
  const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('anggaran_signatureDate') || new Date().toISOString().split('T')[0]);
  const [printOrientation, setPrintOrientation] = useState<'auto' | 'portrait' | 'landscape'>(() => (localStorage.getItem('anggaran_printOrientation') as any) || 'auto');

  // Digital Signatures & Stamp Automation State
  const [autoEmbedSignatures, setAutoEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStampOverlay, setShowStampOverlay] = useState<boolean>(() => isStampOverlayEnabled());
  const [tempAutoEmbed, setTempAutoEmbed] = useState<boolean>(autoEmbedSignatures);
  const [tempShowStamp, setTempShowStamp] = useState<boolean>(showStampOverlay);

  useEffect(() => {
    const syncSigs = () => {
      const embed = isAutoEmbedSignaturesEnabled();
      const stamp = isStampOverlayEnabled();
      setAutoEmbedSignatures(embed);
      setShowStampOverlay(stamp);
      setTempAutoEmbed(embed);
      setTempShowStamp(stamp);
    };
    syncSigs();
    window.addEventListener('signatures-updated', syncSigs);
    return () => window.removeEventListener('signatures-updated', syncSigs);
  }, []);

  // Header Dropdown Menu State
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close action menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    if (isActionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isActionMenuOpen]);

  // Clean unmount of all dropdowns and modals
  useEffect(() => {
    return () => {
      setIsActionMenuOpen(false);
      setIsModalOpen(false);
      setIsDeleteModalOpen(false);
      setIsSettingsOpen(false);
      setIsPresetModalOpen(false);
      setIsRincianModalOpen(false);
    };
  }, []);

  // Temp Settings State
  const [tempKeliangName, setTempKeliangName] = useState(keliangName);
  const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
  const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
  const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
  const [tempPrintOrientation, setTempPrintOrientation] = useState<'auto' | 'portrait' | 'landscape'>(printOrientation);

  // Form State
  const [formKode, setFormKode] = useState('');
  const [formUraian, setFormUraian] = useState('');
  const [formVolume, setFormVolume] = useState<number | ''>('');
  const [formSatuan, setFormSatuan] = useState('');
  const [isCustomSatuan, setIsCustomSatuan] = useState<boolean>(false);
  const [formHargaSatuan, setFormHargaSatuan] = useState<number | ''>('');
  const [formJumlah, setFormJumlah] = useState<number | ''>('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formTahun, setFormTahun] = useState(selectedYear);
  const [formGroupPrefix, setFormGroupPrefix] = useState<string>('5.1.1');

  // Requirement 1 & 2: Visibility control & Rincian Table items
  const [hasAccountSelected, setHasAccountSelected] = useState<boolean>(false);
  const [formRincianList, setFormRincianList] = useState<RincianPaguItem[]>([]);

  // Helper untuk mendapatkan list rincian lengkap dari BudgetItem
  const getItemRincianList = (item: BudgetItem): RincianPaguItem[] => {
    if (item.rincianList && item.rincianList.length > 0) {
      return item.rincianList;
    }
    if (item.kegiatanList && item.kegiatanList.length > 0) {
      return item.kegiatanList.map((k, idx) => ({
        id: k.id || `r-${idx}`,
        no: idx + 1,
        uraian: k.namaKegiatan,
        qty: k.volume || 1,
        satuan: k.satuan || 'Paket',
        tarifSatuan: k.nominalSatuan || (k.volume ? Math.round(k.anggaran / k.volume) : k.anggaran),
        paguAnggaran: k.anggaran
      }));
    }
    const defaultVol = item.volume !== undefined ? item.volume : 1;
    const defaultPrice = item.hargaSatuan !== undefined ? item.hargaSatuan : (defaultVol ? Math.round(item.jumlah / defaultVol) : item.jumlah);
    return [
      {
        id: `default-${item.id}`,
        no: 1,
        uraian: item.uraian,
        qty: defaultVol,
        satuan: item.satuan || 'Paket',
        tarifSatuan: defaultPrice,
        paguAnggaran: item.jumlah
      }
    ];
  };

  // Total Pagu (Estimasi) dari baris-baris rincian di modal
  const totalPaguEstimasi = useMemo(() => {
    return formRincianList.reduce((sum, r) => sum + (Number(r.paguAnggaran) || 0), 0);
  }, [formRincianList]);

  // Handler Tambah Baris Rincian Baru (Requirement 2)
  const handleAddRincianRow = () => {
    const defaultSat = formSatuan && formSatuan !== '--pilih satuan--' ? formSatuan : 'Paket';
    setFormRincianList(prev => [
      ...prev,
      {
        id: `rincian-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        no: prev.length + 1,
        uraian: '',
        qty: 1,
        satuan: defaultSat,
        tarifSatuan: 0,
        paguAnggaran: 0
      }
    ]);
  };

  // Handler Update Kolom Baris Rincian
  const handleUpdateRincianRow = (index: number, field: keyof RincianPaguItem, value: any) => {
    setFormRincianList(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'qty') {
        const qtyNum = value === '' ? 0 : Number(value);
        item.qty = qtyNum;
        item.paguAnggaran = Math.round(qtyNum * (Number(item.tarifSatuan) || 0));
      } else if (field === 'tarifSatuan') {
        const priceNum = value === '' ? 0 : Number(value);
        item.tarifSatuan = priceNum;
        item.paguAnggaran = Math.round((Number(item.qty) || 0) * priceNum);
      } else if (field === 'paguAnggaran') {
        const paguNum = value === '' ? 0 : Number(value);
        item.paguAnggaran = paguNum;
        if (item.qty > 0) {
          item.tarifSatuan = Math.round((paguNum / item.qty) * 100) / 100;
        }
      } else {
        (item as any)[field] = value;
      }
      updated[index] = item;
      return updated;
    });
  };

  // Handler Hapus Baris Rincian
  const handleDeleteRincianRow = (index: number) => {
    setFormRincianList(prev => prev.filter((_, idx) => idx !== index).map((r, i) => ({ ...r, no: i + 1 })));
  };

  // Handler Samakan Total Pagu Anggaran dengan Total Pagu Estimasi Rincian
  const handleSyncPaguWithEstimasi = () => {
    handleTotalJumlahChange(totalPaguEstimasi);
    const totalVol = formRincianList.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);
    if (totalVol > 0 && formRincianList.length > 1) {
      setFormVolume(totalVol);
      setFormHargaSatuan(Math.round((totalPaguEstimasi / totalVol) * 100) / 100);
    } else if (formRincianList.length === 1) {
      setFormVolume(formRincianList[0].qty);
      setFormSatuan(formRincianList[0].satuan);
      setFormHargaSatuan(formRincianList[0].tarifSatuan);
    }
  };

  // Handler Memunculkan Rincian Tabel Pagu (Requirement 5)
  const handleViewRincian = (item: BudgetItem) => {
    setSelectedItemForRincian(item);
    setIsRincianModalOpen(true);
  };

  // Daftar Satuan dari Data yang Tersimpan & Preset Standar (Requirement 2)
  const savedSatuanList = useMemo(() => {
    const list = new Set<string>();
    budgetItems.forEach(b => {
      const s = (b.satuan || '').trim();
      if (s && s !== '--pilih satuan--') {
        list.add(s);
      }
    });
    const defaultPresets = ['Paket', 'Bulan', 'Tahun', 'Kegiatan', 'Orang', 'Hari', 'Pcs', 'Kg', 'Rim', 'Liter', 'Meter', 'Porsi', 'Set', 'Unit'];
    defaultPresets.forEach(p => list.add(p));
    return Array.from(list);
  }, [budgetItems]);

  // Pos Anggaran Aktif & Daftar Akun untuk Pos Terpilih (Requirement 3)
  const currentGroup = useMemo(() => {
    return ACCOUNT_GROUPS.find(g => g.codePrefix === formGroupPrefix) || ACCOUNT_GROUPS[0];
  }, [formGroupPrefix]);

  const posAkunList = useMemo(() => {
    if (!formGroupPrefix) return REFERENSI_REKENING;
    return REFERENSI_REKENING.filter(r => r.code.startsWith(formGroupPrefix));
  }, [formGroupPrefix]);

  // Calculation of Realization directly from Jurnal Umum (LRA Integration)
  const realizationMap = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      if (!e.date) return;
      const entryYear = e.date.split('-')[0];
      if (selectedYear && entryYear !== selectedYear) return;

      const code = e.kodeRekening || '';
      if (!code) return;

      // 4. Pendapatan (Kredit - Debet)
      if (code.startsWith('4')) {
        map[code] = (map[code] || 0) + ((Number(e.kredit) || 0) - (Number(e.debet) || 0));
      }
      // 7. Sumber Dana (Kredit - Debet)
      else if (code.startsWith('7')) {
        map[code] = (map[code] || 0) + ((Number(e.kredit) || 0) - (Number(e.debet) || 0));
      }
      // 5. Belanja (Debet - Kredit)
      else if (code.startsWith('5')) {
        map[code] = (map[code] || 0) + ((Number(e.debet) || 0) - (Number(e.kredit) || 0));
      }
      // 6. SILPA / Saldo Awal
      else if (code.startsWith('6')) {
        map[code] = (map[code] || 0) + ((Number(e.kredit) || 0) - (Number(e.debet) || 0));
      }
    });
    return map;
  }, [entries, selectedYear]);

  // Filter years available in budget items + current year
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const curr = new Date().getFullYear().toString();
    years.add(curr);
    years.add((Number(curr) - 1).toString());
    years.add((Number(curr) + 1).toString());
    budgetItems.forEach(b => {
      if (b.tahun) years.add(b.tahun);
    });
    entries.forEach(e => {
      if (e.date) years.add(e.date.split('-')[0]);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [budgetItems, entries]);

  // Filter budget items by selected year and search query
  const filteredBudgetItems = useMemo(() => {
    return budgetItems.filter(item => {
      const matchYear = selectedYear ? (!item.tahun || item.tahun === selectedYear) : true;
      const matchQuery = searchQuery.trim() === '' || 
        item.kode.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchYear && matchQuery;
    });
  }, [budgetItems, selectedYear, searchQuery]);

  // Total Sub-Rincian items across all filtered budget items
  const totalRincianKegiatanCount = useMemo(() => {
    return filteredBudgetItems.reduce((acc, item) => {
      return acc + getItemRincianList(item).length;
    }, 0);
  }, [filteredBudgetItems]);

  // Aggregate Data by Account Groups
  const groupedData = useMemo(() => {
    return ACCOUNT_GROUPS.map(group => {
      // Find matching items
      const items = filteredBudgetItems.filter(item => item.kode.startsWith(group.codePrefix));
      
      // Also get all official accounts in this group for comprehensive overview
      const coaAccounts = REFERENSI_REKENING.filter(r => r.code.startsWith(group.codePrefix));

      // Calculate totals
      const totalPagu = items.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
      
      // Calculate group realization
      let totalRealisasi = 0;
      coaAccounts.forEach(acc => {
        totalRealisasi += (realizationMap[acc.code] || 0);
      });

      // PSAP 02 / Standard Accounting Logic:
      // - Pendapatan & Sumber Dana: Selisih = Realisasi - Pagu (Lebih target = +, Kurang target = -)
      // - Belanja: Sisa Pagu = Pagu - Realisasi (Sisa aman = +, Overbudget = -)
      const isRevenueGroup = group.categoryType === 'sumberdana' || group.categoryType === 'pendapatan';
      const selisih = isRevenueGroup ? (totalRealisasi - totalPagu) : (totalPagu - totalRealisasi);
      const persentase = totalPagu > 0 ? (totalRealisasi / totalPagu) * 100 : (totalRealisasi > 0 ? 100 : 0);

      return {
        ...group,
        items,
        coaAccounts,
        totalPagu,
        totalRealisasi,
        selisih,
        persentase
      };
    });
  }, [filteredBudgetItems, realizationMap]);

  // Fiscal KPI Summary
  const fiscalKPI = useMemo(() => {
    let totalPaguSumberDana = 0;
    let totalRealisasiSumberDana = 0;
    let totalPaguPendapatan = 0;
    let totalRealisasiPendapatan = 0;
    let totalPaguBelanja = 0;
    let totalRealisasiBelanja = 0;

    groupedData.forEach(g => {
      if (g.categoryType === 'sumberdana') {
        totalPaguSumberDana += g.totalPagu;
        totalRealisasiSumberDana += g.totalRealisasi;
      } else if (g.categoryType === 'pendapatan') {
        totalPaguPendapatan += g.totalPagu;
        totalRealisasiPendapatan += g.totalRealisasi;
      } else if (g.categoryType === 'belanja') {
        totalPaguBelanja += g.totalPagu;
        totalRealisasiBelanja += g.totalRealisasi;
      }
    });

    const totalPaguPenerimaan = totalPaguSumberDana + totalPaguPendapatan;
    const totalRealisasiPenerimaan = totalRealisasiSumberDana + totalRealisasiPendapatan;

    const surplusDefisitPagu = totalPaguPenerimaan - totalPaguBelanja;
    const surplusDefisitRealisasi = totalRealisasiPenerimaan - totalRealisasiBelanja;
    const rasioPenyerapanBelanja = totalPaguBelanja > 0 ? (totalRealisasiBelanja / totalPaguBelanja) * 100 : 0;

    return {
      totalPaguSumberDana,
      totalPaguPendapatan,
      totalPaguPenerimaan,
      totalRealisasiPenerimaan,
      totalPaguBelanja,
      totalRealisasiBelanja,
      surplusDefisitPagu,
      surplusDefisitRealisasi,
      rasioPenyerapanBelanja
    };
  }, [groupedData]);

  // 1. Perubahan Volume / Qty (Requirement 1)
  const handleVolumeChange = (newVol: number | '') => {
    setFormVolume(newVol);
    const volNum = newVol === '' ? 1 : Number(newVol);
    if (formJumlah !== '' && Number(formJumlah) > 0 && volNum > 0) {
      const calcPrice = Math.round((Number(formJumlah) / volNum) * 100) / 100;
      setFormHargaSatuan(calcPrice);
    } else if (formHargaSatuan !== '' && Number(formHargaSatuan) > 0 && volNum > 0) {
      setFormJumlah(volNum * Number(formHargaSatuan));
    }
  };

  // 2. Perubahan Tarif / Harga Satuan
  const handleHargaSatuanChange = (newPrice: number | '') => {
    setFormHargaSatuan(newPrice);
    if (newPrice !== '') {
      const priceNum = Number(newPrice);
      const volNum = formVolume === '' ? 1 : Number(formVolume);
      if (!isNaN(priceNum) && volNum > 0) {
        setFormJumlah(volNum * priceNum);
      }
    }
  };

  // 3. Perubahan Total Pagu Anggaran (Requirement 1: auto Tarif/harga satuan terisi hasil perhitungan = Total Pagu anggaran dibagi Volume/Qty)
  const handleTotalJumlahChange = (newTotal: number | '') => {
    setFormJumlah(newTotal);
    if (newTotal !== '') {
      const totalNum = Number(newTotal);
      const volNum = formVolume === '' ? 1 : Number(formVolume);
      if (!isNaN(totalNum) && volNum > 0) {
        const calculatedPrice = Math.round((totalNum / volNum) * 100) / 100;
        setFormHargaSatuan(calculatedPrice);
      }
    } else {
      setFormHargaSatuan('');
    }
  };

  // Open Modal for Add / Edit
  const handleOpenItemModal = (item: BudgetItem | null = null, defaultGroupPrefix?: string) => {
    if (item) {
      setEditingItem(item);
      setFormKode(item.kode);
      setFormUraian(item.uraian);
      setFormVolume(item.volume !== undefined ? item.volume : 1);
      const curSatuan = item.satuan || '';
      setFormSatuan(curSatuan);
      setIsCustomSatuan(!!curSatuan && !savedSatuanList.includes(curSatuan));
      setFormHargaSatuan(item.hargaSatuan !== undefined ? item.hargaSatuan : (item.volume ? Math.round(item.jumlah / item.volume) : item.jumlah));
      setFormJumlah(item.jumlah !== undefined ? item.jumlah : 0);
      setFormKeterangan(item.keterangan || '');
      setFormTahun(item.tahun || selectedYear);

      const matchingGroup = ACCOUNT_GROUPS.find(g => item.kode.startsWith(g.codePrefix));
      setFormGroupPrefix(matchingGroup ? matchingGroup.codePrefix : (defaultGroupPrefix || '5.1.1'));

      const initialRincian = getItemRincianList(item);
      setFormRincianList(initialRincian);
      setHasAccountSelected(true);
    } else {
      setEditingItem(null);
      let targetPrefix = defaultGroupPrefix;
      if (!targetPrefix && selectedGroupTab !== 'all') {
        const found = ACCOUNT_GROUPS.find(g => g.id === selectedGroupTab);
        if (found) targetPrefix = found.codePrefix;
      }
      if (!targetPrefix) targetPrefix = '5.1.1';
      setFormGroupPrefix(targetPrefix);

      setFormKode('');
      setFormUraian('');
      setFormVolume(1);
      setFormSatuan(''); // default: --pilih satuan-- (Requirement 2)
      setIsCustomSatuan(false);
      setFormHargaSatuan('');
      setFormJumlah('');
      setFormKeterangan('');
      setFormTahun(selectedYear);
      setFormRincianList([]);
      setHasAccountSelected(false); // Requirement 1: initially false so calculation & keterangan are hidden!
    }
    setIsModalOpen(true);
  };

  // Helper to suggest standard keterangan options based on selected account code
  const getKeteranganSuggestions = (code: string) => {
    const clean = code.split(' - ')[0].trim();
    const suggestions: string[] = [];

    if (clean.startsWith('4.1.1')) {
      suggestions.push('Penerimaan Kas & Pendanaan', 'Saldo Awal');
    } else if (clean.startsWith('5.1.5.01')) {
      suggestions.push('Service Gong', 'Belanja Kelengkapan Gong');
    } else if (clean.startsWith('5.1.5.07')) {
      suggestions.push('Sesari Daksina Pesangkepan');
    } else if (clean.startsWith('5.1.5.08')) {
      suggestions.push('Pengadaan Kertas HVS', 'Buku Agenda & ATK Kantor', 'Penggandaan Dokumen & Fotokopi', 'Penjilidan Dokumen', 'Belanja ATK Lainnya');
    } else if (clean.startsWith('5.1.5.14')) {
      suggestions.push('Token Listrik Pura Puseh', 'Token Listrik Pura Dalem', 'Token Listrik Pura Bale Agung', 'Token Listrik Pura Melanting');
    } else if (clean.startsWith('5.1.5.15')) {
      suggestions.push('Tagihan PDAM Pura Puseh');
    } else if (clean.startsWith('5.1.5')) {
      suggestions.push('Belanja Peralatan & Perlengkapan Adat', 'Belanja/Service Gong', 'Belanja Kundangan', 'Belanja Pesangkepan', 'Belanja Adat Lainnya');
    } else if (clean.startsWith('5.2.1')) {
      suggestions.push('Sesari & Kelengkapan Pecanangan', 'Upakara & Dudonan Aci Piodalan Pura', 'Penyediaan Sarana Upakara & Bebantenan', 'Piodalan Alit Pura Kahyangan Desa', 'Renovasi / Pemeliharaan Pelinggih & Sarana Pura', 'Piodalan Ageng & Pujawali Pura Kahyangan Desa');
    } else if (clean.startsWith('5.3.2')) {
      suggestions.push('Dana Kematian', 'Dana Santunan', 'Pawongan Lainnya');
    } else if (clean.startsWith('5.4')) {
      suggestions.push('Pengelolaan Sampah & Sanitasi Wewidangan', 'Penataan Palemahan & Penghijauan Pura', 'Pemeliharaan Fasilitas Umum & Jalan Desa', 'Pengelolaan Setra & Pemeliharaan Pura Setra');
    } else {
      suggestions.push('Kebutuhan Anggaran Operasional Desa Adat', 'Belanja Kebutuhan Rutin / Terencana');
    }

    return suggestions;
  };

  // Handle Account Selection from Dropdown / List (Requirement 3 & 1)
  const handleSelectAccount = (codeVal: string) => {
    const cleanCode = codeVal.split(' - ')[0].trim();
    setFormKode(cleanCode);
    const match = REFERENSI_REKENING.find(r => r.code === cleanCode);
    if (match) {
      // Auto populate uraian pos with the account's standard name (can still be freely edited)
      setFormUraian(match.name);
    }
    // Auto sync formGroupPrefix if account matches a defined group
    const matchingGroup = ACCOUNT_GROUPS.find(g => cleanCode.startsWith(g.codePrefix));
    if (matchingGroup && matchingGroup.codePrefix !== formGroupPrefix) {
      setFormGroupPrefix(matchingGroup.codePrefix);
    }
    // Requirement 1: Munculkan perhitungan rincian & keterangan setelah klik akun
    setHasAccountSelected(true);

    // Initialize initial rincian row if empty
    if (formRincianList.length === 0) {
      setFormRincianList([
        {
          id: `rincian-${Date.now()}`,
          no: 1,
          uraian: match ? match.name : formUraian || '',
          qty: formVolume === '' ? 1 : Number(formVolume),
          satuan: formSatuan || 'Paket',
          tarifSatuan: formHargaSatuan === '' ? 0 : Number(formHargaSatuan),
          paguAnggaran: formJumlah === '' ? 0 : Number(formJumlah)
        }
      ]);
    }
  };

  // Handle Group Prefix Switch from Dropdown (Requirement 3)
  const handleGroupPrefixChange = (newPrefix: string) => {
    setFormGroupPrefix(newPrefix);
    const accountsInGroup = REFERENSI_REKENING.filter(r => r.code.startsWith(newPrefix));
    if (accountsInGroup.length > 0) {
      if (!formKode.startsWith(newPrefix)) {
        setFormKode(accountsInGroup[0].code);
        setFormUraian(accountsInGroup[0].name);
      }
    }
  };

  // Save Item (Requirement 3: Simpan volume, satuan, tarif satuan, total pagu, dan rincianList)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const numJumlah = formJumlah === '' ? 0 : Number(formJumlah);
    if (!formKode.trim() || !formUraian.trim() || isNaN(numJumlah) || numJumlah < 0) {
      setNotification({ message: 'Lengkapi kode rekening, uraian pos, dan jumlah pagu anggaran yang valid (minimal 0).', type: 'error' });
      return;
    }

    const cleanCode = formKode.split(' - ')[0].trim();
    const finalJumlah = numJumlah;
    const finalVol = formVolume === '' ? 1 : Number(formVolume);
    const finalPrice = formHargaSatuan === '' 
      ? (finalVol > 0 ? Math.round(finalJumlah / finalVol) : finalJumlah) 
      : Number(formHargaSatuan);
    const finalSatuan = (!formSatuan || formSatuan === '--pilih satuan--') ? 'Paket' : formSatuan.trim();

    // Persiapkan data rincianList untuk disimpan ke pos anggaran
    const preparedRincianList: RincianPaguItem[] = formRincianList.length > 0
      ? formRincianList.map((r, idx) => ({
          ...r,
          no: idx + 1,
          uraian: r.uraian.trim() || formUraian.trim(),
          qty: Number(r.qty) || 1,
          satuan: r.satuan || finalSatuan,
          tarifSatuan: Number(r.tarifSatuan) || 0,
          paguAnggaran: Number(r.paguAnggaran) || 0
        }))
      : [
          {
            id: `rincian-${cleanCode}-${Date.now()}`,
            no: 1,
            uraian: formUraian.trim(),
            qty: finalVol,
            satuan: finalSatuan,
            tarifSatuan: finalPrice,
            paguAnggaran: finalJumlah
          }
        ];

    const getItemType = (code: string): BudgetItem['type'] => {
      if (code.startsWith('4.1.1')) return 'pendapatan-adat';
      if (code.startsWith('7')) return 'pendapatan';
      if (code.startsWith('5.1.5')) return 'belanja-operasional-adat';
      if (code.startsWith('5.2.1')) return 'belanja-parhyangan-adat';
      if (code.startsWith('5.3.2')) return 'belanja-pawongan-adat';
      if (code.startsWith('5.4')) return 'belanja-palemahan-adat';
      return 'belanja-rutin-operasional';
    };

    const newItem: BudgetItem = {
      id: editingItem ? editingItem.id : `budget-${cleanCode}-${Date.now()}`,
      kode: cleanCode,
      uraian: formUraian.trim(),
      jumlah: finalJumlah,
      volume: finalVol,
      satuan: finalSatuan,
      hargaSatuan: finalPrice,
      keterangan: formKeterangan.trim(),
      tahun: formTahun || selectedYear,
      type: getItemType(cleanCode),
      rincianList: preparedRincianList
    };

    try {
      if (editingItem) {
        if (onUpdateBudgetItem) {
          await onUpdateBudgetItem(newItem);
        } else {
          setBudgetItems(prev => prev.map(i => i.id === editingItem.id ? newItem : i));
        }
        setNotification({ message: `Pagu anggaran [${newItem.kode}] ${newItem.uraian} berhasil diperbarui.`, type: 'success' });
      } else {
        if (onAddBudgetItem) {
          await onAddBudgetItem(newItem);
        } else {
          setBudgetItems(prev => [...prev.filter(i => i.id !== newItem.id), newItem]);
        }
        setNotification({ message: `Pos anggaran [${newItem.kode}] ${newItem.uraian} berhasil ditambahkan.`, type: 'success' });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save budget error:", err);
      setNotification({ message: 'Gagal menyimpan pos anggaran.', type: 'error' });
    }
  };

  // Delete Item
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (onDeleteBudgetItem) {
        await onDeleteBudgetItem(itemToDelete.id);
      } else {
        setBudgetItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      }
      setNotification({ message: `Pos anggaran [${itemToDelete.kode}] ${itemToDelete.uraian} dihapus.`, type: 'info' });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err) {
      console.error("Delete budget item error:", err);
      setNotification({ message: 'Gagal menghapus pos anggaran.', type: 'error' });
    }
  };

  // Save Settings Modal
  const handleSaveSettings = () => {
    setKeliangName(tempKeliangName);
    setJuruRaksaName(tempJuruRaksaName);
    setCustomPlace(tempCustomPlace);
    setSignatureDate(tempSignatureDate);
    setPrintOrientation(tempPrintOrientation);

    localStorage.setItem('anggaran_keliangName', tempKeliangName);
    localStorage.setItem('anggaran_juruRaksaName', tempJuruRaksaName);
    localStorage.setItem('anggaran_customPlace', tempCustomPlace);
    localStorage.setItem('anggaran_signatureDate', tempSignatureDate);
    localStorage.setItem('anggaran_printOrientation', tempPrintOrientation);

    // Simpan status otomatisasi tanda tangan digital & stempel resmi
    saveSignatureSettings({ autoEmbed: tempAutoEmbed });
    setStampOverlayEnabled(tempShowStamp);
    setAutoEmbedSignatures(tempAutoEmbed);
    setShowStampOverlay(tempShowStamp);
    window.dispatchEvent(new Event('signatures-updated'));

    setIsSettingsOpen(false);
    setNotification({ message: 'Pengaturan tanda tangan & stempel RAPB berhasil disimpan.', type: 'success' });
  };

  // Load Standard CoA Preset
  const handleLoadStandardPreset = async () => {
    // Generate standard default budget items for all CoA accounts if not yet added
    const newItems: BudgetItem[] = [];
    const targetYear = selectedYear || new Date().getFullYear().toString();

    // Mapping default accounts for National Village/Customary Accounting Standards
    const defaultAccounts = REFERENSI_REKENING.filter(r => 
      r.code.startsWith('7.') || 
      r.code.startsWith('4.') || 
      r.code.startsWith('5.')
    );

    defaultAccounts.forEach(acc => {
      const existing = budgetItems.find(b => b.kode === acc.code && (b.tahun === targetYear || !b.tahun));
      if (!existing) {
        newItems.push({
          id: `budget-preset-${acc.code}-${targetYear}`,
          kode: acc.code,
          uraian: acc.name,
          jumlah: 0,
          volume: 1,
          satuan: 'Paket',
          hargaSatuan: 0,
          keterangan: 'Pagu Standar Bagan Akun',
          tahun: targetYear,
          type: acc.code.startsWith('4') ? 'pendapatan' : 'belanja-parhyangan-adat' // default type, can be refined based on code
        });
      }
    });

    if (newItems.length === 0) {
      setNotification({ message: 'Seluruh pos rekening standar sudah terdaftar untuk tahun ini.', type: 'info' });
      setIsPresetModalOpen(false);
      return;
    }

    try {
      const combined = [...budgetItems, ...newItems];
      if (onBatchSaveBudgetItems) {
        await onBatchSaveBudgetItems(combined);
      } else {
        setBudgetItems(combined);
      }
      setNotification({ message: `${newItems.length} pos akun standar berhasil dimuat ke dalam RAPB Tahun ${targetYear}!`, type: 'success' });
      setIsPresetModalOpen(false);
    } catch (err) {
      console.error("Preset load error:", err);
      setNotification({ message: 'Gagal memuat pos standar anggaran.', type: 'error' });
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (typeof XLSX === 'undefined') {
      alert("Pustaka Excel belum siap. Silakan coba sesaat lagi.");
      return;
    }

    const rows: any[] = [];
    rows.push({
      "Kode Rekening": "RENCANA ANGGARAN PENDAPATAN DAN BELANJA (RAPB)",
      "Uraian Pos": `Tahun Anggaran ${selectedYear}`,
      "Volume": "",
      "Satuan": "",
      "Tarif Satuan (Rp)": "",
      "Pagu Anggaran (Rp)": "",
      "Realisasi LRA (Rp)": "",
      "Sisa Pagu / Selisih (Rp)": "",
      "Persentase (%)": "",
      "Keterangan": ""
    });
    rows.push({});

    groupedData.forEach(group => {
      rows.push({
        "Kode Rekening": group.codePrefix,
        "Uraian Pos": group.title,
        "Volume": "",
        "Satuan": "",
        "Tarif Satuan (Rp)": "",
        "Pagu Anggaran (Rp)": group.totalPagu,
        "Realisasi LRA (Rp)": group.totalRealisasi,
        "Sisa Pagu / Selisih (Rp)": group.selisih,
        "Persentase (%)": `${group.persentase.toFixed(1)}%`,
        "Keterangan": group.description
      });

      const isRevenueGroup = group.categoryType === 'sumberdana' || group.categoryType === 'pendapatan';
      group.items.forEach(item => {
        const itemReal = realizationMap[item.kode] || 0;
        const itemPagu = Number(item.jumlah) || 0;
        const itemSelisih = isRevenueGroup ? (itemReal - itemPagu) : (itemPagu - itemReal);
        const itemPct = itemPagu > 0 ? (itemReal / itemPagu) * 100 : (itemReal > 0 ? 100 : 0);

        rows.push({
          "Kode Rekening": item.kode,
          "Uraian Pos": item.uraian,
          "Volume": item.volume || 1,
          "Satuan": item.satuan || "Paket",
          "Tarif Satuan (Rp)": item.hargaSatuan || item.jumlah,
          "Pagu Anggaran (Rp)": item.jumlah,
          "Realisasi LRA (Rp)": itemReal,
          "Sisa Pagu / Selisih (Rp)": itemSelisih,
          "Persentase (%)": `${itemPct.toFixed(1)}%`,
          "Keterangan": item.keterangan || ""
        });
      });
      rows.push({});
    });

    // Summary row
    rows.push({
      "Kode Rekening": "TOTAL",
      "Uraian Pos": "TOTAL ANGGARAN BELANJA",
      "Volume": "",
      "Satuan": "",
      "Tarif Satuan (Rp)": "",
      "Pagu Anggaran (Rp)": fiscalKPI.totalPaguBelanja,
      "Realisasi LRA (Rp)": fiscalKPI.totalRealisasiBelanja,
      "Sisa Pagu / Selisih (Rp)": fiscalKPI.totalPaguBelanja - fiscalKPI.totalRealisasiBelanja,
      "Persentase (%)": `${fiscalKPI.rasioPenyerapanBelanja.toFixed(1)}%`,
      "Keterangan": ""
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RAPB");
    XLSX.writeFile(wb, `RAPB_Anggaran_Desa_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Print Document with dynamic orientation support & paper conservation
  const handlePrint = (orientation: 'auto' | 'portrait' | 'landscape' = printOrientation) => {
    const existingStyle = document.getElementById('dynamic-print-orientation-style');
    if (existingStyle) {
      existingStyle.remove();
    }
    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-orientation-style';
    const pageOrientation = orientation !== 'auto' ? `size: A4 ${orientation} !important;` : 'size: A4 portrait !important;';
    styleEl.innerHTML = `
      @media print {
        @page {
          ${pageOrientation}
          margin: 7mm 7mm 7mm 7mm !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
  };

  // Full Year Grouped Data for Complete Multi-Page Official Print Document
  const fullPrintGroupedData = useMemo(() => {
    return ACCOUNT_GROUPS.map(group => {
      const items = budgetItems.filter(item => {
        const matchYear = selectedYear ? (!item.tahun || item.tahun === selectedYear) : true;
        return matchYear && item.kode.startsWith(group.codePrefix);
      });
      const coaAccounts = REFERENSI_REKENING.filter(r => r.code.startsWith(group.codePrefix));
      const totalPagu = items.reduce((sum, item) => sum + (Number(item.jumlah) || 0), 0);
      let totalRealisasi = 0;
      coaAccounts.forEach(acc => {
        totalRealisasi += (realizationMap[acc.code] || 0);
      });
      const isRevenueGroup = group.categoryType === 'sumberdana' || group.categoryType === 'pendapatan';
      const selisih = isRevenueGroup ? (totalRealisasi - totalPagu) : (totalPagu - totalRealisasi);
      const persentase = totalPagu > 0 ? (totalRealisasi / totalPagu) * 100 : (totalRealisasi > 0 ? 100 : 0);

      return {
        ...group,
        items,
        coaAccounts,
        totalPagu,
        totalRealisasi,
        selisih,
        persentase
      };
    });
  }, [budgetItems, selectedYear, realizationMap]);

  return (
    <div className="space-y-6 animate-fade-in-up pb-12" id="printable-area-anggaran-wrapper">
      {notification && (
        <div className="no-print">
          <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ON-SCREEN INTERACTIVE DASHBOARD VIEW (Hidden during print)             */}
      {/* ========================================================================= */}
      <div className="space-y-6 print:hidden">
        {/* HEADER SECTION */}
        <div className="bg-white p-4 border-b-4 border-gray-700/70 relative z-10 shadow-sm rounded-2xl">
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
              <div className="absolute -right-0 -bottom-0 p-2 opacity-20 text-emerald-300 pointer-events-none">
                  <Landmark size={110} />
              </div>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-start gap-3 mb-1">
                <span className="p-2 bg-teal-500/20 text-teal-700 border border-teal-500/40 rounded-xl mt-0.5">
                  <Landmark size={28} />
                </span>
                <div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2 font-serif">
                    Rencana Anggaran Pendapatan &amp; Belanja (RAPB)
                  </h1>
                  <p className="text-teal-800 text-sm mt-0.5">
                    Perencanaan dan Penetapan Pagu Anggaran Berstandar Akuntansi Nasional (Terintegrasi Langsung dengan Realisasi LRA)
                  </p>
                </div>
              </div>
            </div>

            {/* ACTION MENU & STATUS INDICATOR */}
            <div className="flex items-center gap-2 no-print z-20">
              <button 
                type="button"
                onClick={() => {
                  setTempKeliangName(keliangName);
                  setTempJuruRaksaName(juruRaksaName);
                  setTempCustomPlace(customPlace);
                  setTempSignatureDate(signatureDate);
                  setTempPrintOrientation(printOrientation);
                  setTempAutoEmbed(isAutoEmbedSignaturesEnabled());
                  setTempShowStamp(isStampOverlayEnabled());
                  setIsSettingsOpen(true);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-xs transition-colors cursor-pointer"
                title="Status Otomatisasi Tanda Tangan & Stempel RAPB (Klik untuk mengatur)"
              >
                <FileSignature size={14} className="text-teal-600" />
                <span className={autoEmbedSignatures ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  TTD: {autoEmbedSignatures ? 'ON' : 'OFF'}
                </span>
                <span className="text-slate-300">•</span>
                <span className={showStampOverlay ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                  Stempel: {showStampOverlay ? 'ON' : 'OFF'}
                </span>
              </button>

              <div className="relative" ref={actionMenuRef}>
                <button 
                  type="button"
                  onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/20 hover:bg-teal-900 text-teal-950 font-bold hover:text-teal-200 border border-teal-700/60 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 group"
                  title="Buka Menu Aksi Anggaran"
                >
                  <Menu size={16} className={`text-teal-500 group-hover:text-teal-300 transition-transform duration-300 ${isActionMenuOpen ? 'rotate-90 text-teal-200' : ''}`} />
                  <span>Menu Anggaran</span>
                  <ChevronDown size={20} className={`text-gray-700 transition-transform duration-200 ${isActionMenuOpen ? 'rotate-180 text-teal-200' : ''}`} />
                </button>

              {/* DROPDOWN MENU */}
              {isActionMenuOpen && (
                <>
                  {/* Backdrop for click outside & preventing occlusion */}
                  <div 
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" 
                    onClick={() => setIsActionMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-teal-700/80 rounded-2xl shadow-2xl z-30 p-2.5 text-xs space-y-1.5 animate-fade-in-up">
                    {/* Category: Anggaran & Data */}
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-teal-400/90 border-b border-gray-800 flex items-center justify-between">
                      <span>Menu Aksi Anggaran</span>
                      <Sparkles size={11} className="text-teal-400" />
                    </div>

                    {/* 6. Cetak RAPB */}
                    <div className="p-2 bg-gray-100 rounded-xl border border-gray-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-teal-600">
                        <span className="flex items-center gap-1.5">
                          <Printer size={13} className="text-teal-600" /> Cetak RAPB
                        </span>
                        <span className="text-[9px] font-normal text-gray-600">Pilih orientasi:</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <button 
                          type="button"
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            handlePrint('auto');
                          }}
                          className="px-2 py-1.5 bg-gray-800 hover:bg-teal-600 text-gray-200 hover:text-white rounded-lg text-[10px] font-bold transition-all text-center"
                          title="Cetak Bebas (Ikuti dialog browser)"
                        >
                          Otomatis
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            handlePrint('portrait');
                          }}
                          className="px-2 py-1.5 bg-gray-800 hover:bg-teal-600 text-gray-200 hover:text-white rounded-lg text-[10px] font-bold transition-all text-center"
                          title="Cetak format Potret (Tegak)"
                        >
                          Potret
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setIsActionMenuOpen(false);
                            handlePrint('landscape');
                          }}
                          className="px-2 py-1.5 bg-gray-800 hover:bg-teal-600 text-gray-200 hover:text-white rounded-lg text-[10px] font-bold transition-all text-center"
                          title="Cetak format Lanskap (Mendatar)"
                        >
                          Lanskap
                        </button>
                      </div>
                    </div>

                    {/* 1. Tambah Pos Anggaran */}
                    <button 
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        handleOpenItemModal(null);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-teal-950/70 text-white hover:text-teal-100 transition-colors text-left group"
                    >
                      <span className="p-1.5 bg-teal-500/20 text-teal-400 rounded-lg group-hover:bg-teal-500 group-hover:text-white transition-colors">
                        <Plus size={15} />
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 group-hover:text-teal-200 text-xs">Tambah Pos Anggaran</div>
                        <div className="text-[10px] text-gray-500">Input rencana pos pagu baru</div>
                      </div>
                    </button>

                    {/* 2. Buka LRA */}
                    {setActivePage && (
                      <button 
                        type="button"
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          setActivePage('Laporan Pendapatan & Belanja');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800 text-white hover:text-teal-100 transition-colors text-left group"
                      >
                        <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <FileCheck2 size={15} />
                        </span>
                        <div className="flex-1">
                          <div className="font-bold text-teal-800 group-hover:text-teal-200 text-xs flex items-center justify-between">
                            <span>Buka LRA</span>
                            <ArrowUpRight size={13} className="text-gray-800 group-hover:text-teal-300" />
                          </div>
                          <div className="text-[10px] text-gray-500">Laporan Realisasi Anggaran</div>
                        </div>
                      </button>
                    )}

                    {/* 3. Muat Pos Standar */}
                    <button 
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setIsPresetModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800 text-white hover:text-teal-100 transition-colors text-left group"
                    >
                      <span className="p-1.5 bg-amber-500/20 text-amber-600 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        <Sparkles size={15} />
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-amber-800 group-hover:text-teal-200 text-xs">Muat Pos Standar</div>
                        <div className="text-[10px] text-gray-500">Pos akun standar akuntansi</div>
                      </div>
                    </button>

                    {/* 4. Pengaturan Dokumen (Setting) */}
                    <button 
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setTempKeliangName(keliangName);
                        setTempJuruRaksaName(juruRaksaName);
                        setTempCustomPlace(customPlace);
                        setTempSignatureDate(signatureDate);
                        setTempPrintOrientation(printOrientation);
                        setTempAutoEmbed(isAutoEmbedSignaturesEnabled());
                        setTempShowStamp(isStampOverlayEnabled());
                        setIsSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800 text-white hover:text-teal-100 transition-colors text-left group"
                    >
                      <span className="p-1.5 bg-purple-800/20 text-purple-800 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-colors">
                        <Settings size={15} />
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-purple-800 group-hover:text-teal-200 text-xs">Pengaturan Dokumen</div>
                        <div className="text-[10px] text-gray-500">Tanda tangan &amp; orientasi cetak</div>
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="my-1 border-t border-gray-800" />

                    {/* 5. Ekspor Excel */}
                    <button 
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        handleExportExcel();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-950/60 text-white hover:text-emerald-100 transition-colors text-left group"
                    >
                      <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <FileSpreadsheet size={15} />
                      </span>
                      <div className="flex-1">
                        <div className="font-bold text-emerald-600 group-hover:text-emerald-200 text-xs">Ekspor ke Excel</div>
                        <div className="text-[10px] text-gray-400">Unduh berkas spreadsheet (.xlsx)</div>
                      </div>
                    </button>

                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* SUBPAGE NAVIGATION: TABEL RAPB vs ANGGARAN 1 TAHUN (Requirement 4) */}
        <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-slate-200/90 rounded-2xl border border-slate-300 shadow-inner no-print">
          <button
            type="button"
            onClick={() => setActiveSubpage('rapb')}
            className={`flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubpage === 'rapb'
                ? 'bg-teal-700 text-white shadow-md'
                : 'bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200'
            }`}
          >
            <Landmark size={16} />
            <span>Tabel RAPB (Realisasi &amp; Pagu)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubpage('anggaran-1-tahun')}
            className={`flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubpage === 'anggaran-1-tahun'
                ? 'bg-teal-700 text-white shadow-md'
                : 'bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200'
            }`}
          >
            <FileSpreadsheet size={16} />
            <span className="flex items-center gap-1.5">
              <span>Anggaran 1 Tahun (Tabel RKA &amp; Sub-Rincian)</span>
              <span className="text-[10px] px-2 py-0.5 bg-amber-400 text-slate-950 font-extrabold rounded-full">
                1 Tahun
              </span>
            </span>
          </button>
        </div>

        {activeSubpage === 'rapb' ? (
          <>
            {/* FILTER & SEARCH BAR */}
            <div className="bg-gray-100 p-2 rounded-xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Tahun Anggaran:</span>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="">Semua Tahun</option>
              {availableYears.map(y => (
                <option key={y} value={y}>Tahun {y}</option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari kode rekening, uraian pos, rincian kegiatan..."
              className="w-full bg-gray-100 border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-teal-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs">
                ×
              </button>
            )}
          </div>
        </div>

        {/* FISCAL KPI CARDS (Live LRA Synchronization) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          {/* Card 1: Estimasi Penerimaan */}
          <div className="bg-gray-200/80 border border-teal-900/40 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} /> Total Estimasi Penerimaan
              </span>
              <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full border border-teal-800 font-mono">
                Akun 7 & 4
              </span>
            </div>
            <p className="text-2xl font-black text-teal-700 tracking-tight">
              {formatCurrency(fiscalKPI.totalPaguPenerimaan)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-600 mt-2 pt-2 border-t border-gray-800">
              <span>Realisasi LRA:</span>
              <span className="font-bold text-teal-700">{formatCurrency(fiscalKPI.totalRealisasiPenerimaan)}</span>
            </div>
          </div>

          {/* Card 2: Total Pagu Belanja */}
          <div className="bg-gray-300/80 border border-amber-900/80 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown size={14} /> Total Plafon Belanja
              </span>
              <span className="text-[10px] bg-amber-800/20 text-amber-900 px-2 py-0.5 rounded-full border border-amber-800 font-mono">
                Akun 5.x
              </span>
            </div>
            <p className="text-2xl font-black text-amber-700 tracking-tight">
              {formatCurrency(fiscalKPI.totalPaguBelanja)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-600 mt-2 pt-2 border-t border-gray-800">
              <span>Realisasi Belanja:</span>
              <span className="font-bold text-amber-900">{formatCurrency(fiscalKPI.totalRealisasiBelanja)}</span>
            </div>
          </div>

          {/* Card 3: Surplus / Defisit Terencana */}
          <div className={`bg-gray-200/80 border ${fiscalKPI.surplusDefisitPagu >= 0 ? 'border-emerald-900/40' : 'border-red-900/40'} p-5 rounded-2xl shadow-sm relative overflow-hidden`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${fiscalKPI.surplusDefisitPagu >= 0 ? 'text-emerald-600' : 'text-red-700'}`}>
                <PieChart size={14} /> Anggaran {fiscalKPI.surplusDefisitPagu >= 0 ? 'Surplus' : 'Defisit'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${fiscalKPI.surplusDefisitPagu >= 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-red-950 text-red-300 border-red-800'}`}>
                {fiscalKPI.surplusDefisitPagu >= 0 ? 'Surplus' : 'Defisit'}
              </span>
            </div>
            <p className={`text-2xl font-black tracking-tight ${fiscalKPI.surplusDefisitPagu >= 0 ? 'text-emerald-700' : 'text-red-800'}`}>
              {formatCurrency(Math.abs(fiscalKPI.surplusDefisitPagu))}
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-700 mt-2 pt-2 border-t border-gray-800">
              <span>Realisasi Surplus/Defisit:</span>
              <span className={`font-bold ${fiscalKPI.surplusDefisitRealisasi >= 0 ? 'text-emerald-800' : 'text-red-900'}`}>
                {formatCurrency(fiscalKPI.surplusDefisitRealisasi)}
              </span>
            </div>
          </div>

          {/* Card 4: Rasio Penyerapan Anggaran */}
          <div className="bg-gray-300/80 border border-sky-900/40 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw size={14} /> Serapan Anggaran (LRA)
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                fiscalKPI.rasioPenyerapanBelanja > 100 
                  ? 'bg-red-950 text-red-300 border-red-800' 
                  : fiscalKPI.rasioPenyerapanBelanja > 80 
                  ? 'bg-amber-950 text-amber-300 border-amber-800' 
                  : 'bg-sky-950 text-sky-300 border-sky-800'
              }`}>
                {fiscalKPI.rasioPenyerapanBelanja.toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-black text-gray-900 tracking-tight">
              {fiscalKPI.rasioPenyerapanBelanja.toFixed(1)}%
            </p>
            {/* Progress bar */}
            <div className="w-full bg-gray-800 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  fiscalKPI.rasioPenyerapanBelanja > 100 
                    ? 'bg-red-500' 
                    : fiscalKPI.rasioPenyerapanBelanja > 80 
                    ? 'bg-amber-400' 
                    : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(fiscalKPI.rasioPenyerapanBelanja, 100)}%` }}
              />
            </div>
          </div>
        </div>


        {/* POS GROUP TABS */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-800 overflow-x-auto gap-1 no-print">
          <button
            onClick={() => setSelectedGroupTab('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              selectedGroupTab === 'all' 
                ? 'bg-teal-600 text-white shadow-md' 
                : 'text-gray-500 hover:text-white hover:bg-gray-800'
            }`}
          > 
            Semua Pos (RAPB Konsolidasi)
          </button>
          {ACCOUNT_GROUPS.map(grp => (
            <button
              key={grp.id}
              onClick={() => setSelectedGroupTab(grp.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedGroupTab === grp.id 
                  ? 'bg-teal-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {grp.title.split(' ')[0]} {grp.title.split(' ').slice(1, 3).join(' ')}
            </button>
          ))}
        </div>

        {/* MAIN DATA TABLES GROUPED BY ACCOUNT CATEGORY */}
        <div className="space-y-6">
          {groupedData
            .filter(grp => selectedGroupTab === 'all' || selectedGroupTab === grp.id)
            .map(group => {
              const isGroupEmpty = group.items.length === 0;

              return (
                <div 
                  key={group.id} 
                  className="bg-white rounded-2xl border border-gray-800 overflow-hidden shadow-lg"
                >
                  {/* Group Header */}
                  <div className="bg-gradient-to-r from-teal-800 to-teal-400 px-4 sm:px-6 py-4 border-b border-gray-700/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2 flex-wrap">
                        <span>{group.title}</span>
                        <span className="text-[10px] bg-teal-950/80 text-teal-200 border border-teal-700/60 px-2 py-0.5 rounded font-mono font-normal whitespace-nowrap">
                          Prefix {group.codePrefix}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-100 mt-0.5">
                        {group.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 sm:gap-4 text-xs font-mono overflow-x-auto max-w-full pb-1">
                      <div className="text-left sm:text-right min-w-[90px]">
                        <span className="text-[10px] text-teal-200 uppercase block whitespace-nowrap">Total Pagu</span>
                        <span className="font-bold text-white text-sm whitespace-nowrap">{formatCurrency(group.totalPagu)}</span>
                      </div>
                      <div className="text-left sm:text-right border-l border-teal-600/80 pl-2 sm:pl-4 min-w-[90px]">
                        <span className="text-[10px] text-slate-100 uppercase block whitespace-nowrap">Realisasi LRA</span>
                        <span className="font-bold text-white text-sm whitespace-nowrap">{formatCurrency(group.totalRealisasi)}</span>
                      </div>
                      <div className="text-left sm:text-right border-l border-teal-600/80 pl-2 sm:pl-4 min-w-[90px]">
                        <span className="text-[10px] text-teal-100 uppercase block whitespace-nowrap">Sisa / Selisih</span>
                        <span className={`font-bold text-sm whitespace-nowrap ${group.selisih >= 0 ? 'text-emerald-100' : 'text-rose-300'}`}>
                          {formatCurrency(group.selisih)}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleOpenItemModal(null, group.codePrefix)}
                        className="ml-auto sm:ml-2 p-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                        title={`Tambah pos di ${group.title}`}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Items Table */}
                  {isGroupEmpty ? (
                    <div className="py-8 text-center text-gray-800 text-xs italic bg-amber-50">
                      Belum ada rincian pos anggaran pada kelompok ini. Klik tombol <strong className="text-teal-700 font-semibold">"+"</strong> atau gunakan <strong className="text-teal-700 font-semibold">"Muat Pos Standar"</strong> untuk mengisi.
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Mobile Scroll Hint Banner */}
                      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-teal-50/90 border-b border-teal-200/80 text-[11px] text-teal-900 font-medium">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <ArrowRightLeft size={13} className="text-teal-700 shrink-0 animate-pulse" />
                          Tabel pagu dapat digeser ke samping (geser layar)
                        </span>
                        <span className="text-[10px] text-teal-800 font-bold uppercase tracking-wider bg-teal-200/60 px-2 py-0.5 rounded-full">
                          Geser ↔
                        </span>
                      </div>

                      <div 
                        className="overflow-x-auto w-full max-w-full touch-pan-x overscroll-x-contain pb-2" 
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        <table className="w-full min-w-[860px] text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-emerald-800/50 text-[11px] font-bold text-gray-100 tracking-wider border-b border-gray-400">
                              <th className="px-4 py-2 w-28 font-mono whitespace-nowrap">Kode Rek</th>
                              <th className="px-2 py-2 min-w-[200px]">Uraian Pos &amp; Rincian RKA</th>
                              <th className="px-2 py-2 text-left w-28 whitespace-nowrap">Volume / Satuan</th>
                              <th className="px-4 py-2 text-right w-36 whitespace-nowrap">Anggaran (Rp)</th>
                              <th className="px-4 py-2 text-right w-36 whitespace-nowrap">Realisasi(Rp)</th>
                              <th className="px-4 py-2 text-right w-32 whitespace-nowrap">Selisih Rp)</th>
                              <th className="px-3 py-2 text-center w-24 whitespace-nowrap">Kinerja (%)</th>
                              <th className="px-3 py-2 text-center w-20 whitespace-nowrap no-print">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {group.items.map(item => {
                              const isRev = group.categoryType === 'pendapatan' || group.categoryType === 'sumberdana';
                              const realisasi = realizationMap[item.kode] || 0;
                              const itemPagu = Number(item.jumlah) || 0;
                              const selisih = isRev ? (realisasi - itemPagu) : (itemPagu - realisasi);
                              const persentase = itemPagu > 0 ? (realisasi / itemPagu) * 100 : (realisasi > 0 ? 100 : 0);
                              const isOver = isRev ? (persentase >= 100) : (persentase > 100);

                              return (
                                <tr 
                                  key={item.id} 
                                  className="hover:bg-amber-50/70 transition-colors group"
                                >
                                  {/* Kode Rekening */}
                                  <td className="px-4 py-1 font-mono text-gray-700 whitespace-nowrap">
                                    {item.kode}
                                  </td>

                                  {/* Uraian & Penanda Khusus (Requirement 5) */}
                                  <td className="px-2 py-1 min-w-[200px]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-gray-950 text-[12px]">{item.uraian}</span>
                                      {/* PENANDA KHUSUS (Requirement 5) */}
                                      <button
                                        type="button"
                                        onClick={() => handleViewRincian(item)}
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 text-teal-800 border border-teal-300/90 rounded-md text-[10.5px] font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
                                        title="Penanda Khusus: Klik untuk memunculkan rincian tabel pagu dari data penganggaran baris ini"
                                      >
                                        <Layers size={11} className="text-teal-600 shrink-0" />
                                        <span>
                                          {item.rincianList && item.rincianList.length > 0 
                                            ? `${item.rincianList.length} Rincian Pagu` 
                                            : 'Rincian Pagu'}
                                        </span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                      </button>
                                    </div>
                                    {item.keterangan && (
                                      <div className="text-[9px] text-gray-600 mt-0.5 italic">
                                        {item.keterangan}
                                      </div>
                                    )}
                                  </td>

                                  {/* Volume & Satuan */}
                                  <td className="px-1 py-1 text-left text-gray-900 whitespace-nowrap">
                                    <div>
                                      <span className="font-mono font-bold">{item.volume || 1}</span> {item.satuan || 'Paket'}
                                    </div>
                                    <div className="text-left font-mono text-gray-500 text-[11px]">
                                      {formatCurrency(item.hargaSatuan !== undefined ? item.hargaSatuan : item.jumlah)}
                                    </div>
                                  </td>

                                  {/* Pagu Anggaran */}
                                  <td className="px-4 py-1 text-right font-mono font-bold text-teal-800 text-[12px] whitespace-nowrap">
                                    {formatCurrency(item.jumlah)}
                                  </td>

                                  {/* Realisasi LRA */}
                                  <td className="px-4 py-1 text-right font-mono text-[12px] font-bold text-slate-950 whitespace-nowrap">
                                    {formatCurrency(realisasi)}
                                  </td>

                                  {/* Selisih */}
                                  <td className={`px-4 py-1 text-right text-[12px] font-mono font-semibold whitespace-nowrap ${
                                    selisih >= 0 ? 'text-emerald-700 font-bold' : (isRev ? 'text-amber-700' : 'text-rose-700 font-bold')
                                  }`}>
                                    {selisih > 0 && isRev ? `+${formatCurrency(selisih)}` : formatCurrency(selisih)}
                                  </td>

                                  {/* Persentase Penyerapan */}
                                  <td className="px-3 py-1 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                        isRev
                                          ? (persentase >= 100 
                                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                                              : 'bg-amber-100 text-amber-900 border border-amber-300')
                                          : (isOver 
                                              ? 'bg-red-100 text-red-900 border border-red-300' 
                                              : persentase >= 80 
                                              ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                              : 'bg-teal-100 text-teal-900 border border-teal-300')
                                      }`}>
                                        {persentase.toFixed(0)}%
                                      </span>
                                      <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden no-print">
                                        <div 
                                          className={`h-full ${
                                            isRev 
                                              ? (persentase >= 100 ? 'bg-emerald-500' : 'bg-amber-500') 
                                              : (isOver ? 'bg-red-500' : persentase >= 80 ? 'bg-amber-500' : 'bg-teal-500')
                                          }`}
                                          style={{ width: `${Math.min(persentase, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  {/* Aksi */}
                                  <td className="px-3 py-3.5 text-center whitespace-nowrap no-print">
                                    <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        type="button"
                                        onClick={() => handleViewRincian(item)}
                                        className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                        title="Penanda Khusus: Tampilkan Rincian Tabel Pagu Anggaran"
                                      >
                                        <Layers size={13} />
                                      </button>
                                      <button 
                                        onClick={() => handleOpenItemModal(item)}
                                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                        title="Edit Pos Anggaran"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setItemToDelete(item);
                                          setIsDeleteModalOpen(true);
                                        }}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                        title="Hapus Pos Anggaran"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Formal Footer Layout */}
        <div className="flex justify-between items-center mt-8 text-slate-900 border-t-2 border-slate-400 pt-2 no-print">
            <div>
                <p className="font-semibold">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                <p className="text-[12px]">Transparansi dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
            </div>
            <div className="text-right font-mono text-[10px] text-slate-600">
                <p>Update pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
        </div>
          </>
        ) : (
          /* ========================================================================= */
          /* SUBPAGE: ANGGARAN 1 TAHUN (RKA LENGKAP & TABEL SUB-RINCIAN PENGANGGARAN)  */
          /* ========================================================================= */
          <div className="space-y-6 animate-fade-in-up">
            {/* Banner Header Subpage Anggaran 1 Tahun */}
            <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-teal-700/60 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 p-3 opacity-15 text-teal-300 pointer-events-none">
                <FileSpreadsheet size={120} />
              </div>
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold font-mono px-2.5 py-0.5 bg-amber-400 text-slate-950 rounded-full uppercase tracking-wider">
                      Sub-Page Anggaran 1 Tahun
                    </span>
                    <span className="text-xs text-teal-300 font-mono">
                      Tahun Anggaran {selectedYear || 'Semua Periode'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight font-serif text-white">
                    Tabel Rencana Kerja &amp; Anggaran (RKA) 1 Tahun
                  </h2>
                  <p className="text-xs text-teal-100/90 mt-1 max-w-2xl leading-relaxed">
                    Menampilkan rincian pagu anggaran dan sub-rincian penganggaran per pos kegiatan secara terperinci untuk perencanaan kas 1 tahun penuh.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                  <button
                    type="button"
                    onClick={() => handleOpenItemModal(null)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Tambah Pos RKA</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Ekspor Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint('auto')}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer border border-slate-700"
                  >
                    <Printer size={14} />
                    <span>Cetak RKA</span>
                  </button>
                </div>
              </div>
            </div>

            {/* KPI STATS FOR 1-YEAR BUDGET */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
              <div className="bg-white border border-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Total Plafon Belanja (1 Thn)
                </span>
                <p className="text-xl font-black text-amber-700 font-mono">
                  {formatCurrency(fiscalKPI.totalPaguBelanja)}
                </p>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <span>Akun 5.x</span>
                  <span>•</span>
                  <span>Kelompok Beban Adat</span>
                </div>
              </div>

              <div className="bg-white border border-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Total Estimasi Penerimaan
                </span>
                <p className="text-xl font-black text-teal-700 font-mono">
                  {formatCurrency(fiscalKPI.totalPaguPenerimaan)}
                </p>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <span>Akun 4.x &amp; 7.x</span>
                  <span>•</span>
                  <span>Pendapatan &amp; Sumber Dana</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Jumlah Pos Rekening
                </span>
                <p className="text-xl font-black text-slate-900 font-mono">
                  {filteredBudgetItems.length} Pos
                </p>
                <div className="text-[10px] text-slate-500 mt-1">
                  Terdaftar dalam RAPB Tahun {selectedYear || 'Aktif'}
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Total Sub-Rincian RKA
                </span>
                <p className="text-xl font-black text-indigo-700 font-mono">
                  {totalRincianKegiatanCount} Rincian
                </p>
                <div className="text-[10px] text-slate-500 mt-1">
                  Tersebar di seluruh pos belanja &amp; pendapatan
                </div>
              </div>
            </div>

            {/* FILTER & SEARCH TOOLBAR */}
            <div className="bg-gray-100 p-2.5 rounded-xl border border-gray-300 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                  Tahun Anggaran:
                </span>
                <select 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none shadow-2xs"
                >
                  <option value="">Semua Tahun</option>
                  {availableYears.map(y => (
                    <option key={y} value={y}>Tahun {y}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari kode pos, uraian pos, atau nama sub-rincian..."
                  className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 outline-none shadow-2xs"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* POS GROUP FILTER CHIPS */}
            <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-300 overflow-x-auto gap-1 no-print">
              <button
                onClick={() => setSelectedGroupTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedGroupTab === 'all' 
                    ? 'bg-teal-700 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                }`}
              > 
                Semua Kelompok Pos (1 Tahun)
              </button>
              {ACCOUNT_GROUPS.map(grp => (
                <button
                  key={grp.id}
                  onClick={() => setSelectedGroupTab(grp.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    selectedGroupTab === grp.id 
                      ? 'bg-teal-700 text-white shadow-xs' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }`}
                >
                  {grp.title.split(' ')[0]} {grp.title.split(' ').slice(1, 3).join(' ')}
                </button>
              ))}
            </div>

            {/* COMPREHENSIVE TABEL ANGGARAN 1 TAHUN & SUB-RINCIAN (Requirement 4) */}
            <div className="space-y-6">
              {groupedData
                .filter(grp => selectedGroupTab === 'all' || selectedGroupTab === grp.id)
                .map(group => {
                  const isGroupEmpty = group.items.length === 0;

                  return (
                    <div 
                      key={`subpage-group-${group.id}`} 
                      className="bg-white rounded-2xl border border-slate-300 overflow-hidden shadow-md"
                    >
                      {/* Group Header */}
                      <div className="bg-gradient-to-r from-teal-800 to-teal-600 px-4 sm:px-6 py-3.5 text-white flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold bg-teal-950 text-teal-200 border border-teal-500/60 px-2 py-0.5 rounded">
                            {group.codePrefix}
                          </span>
                          <h3 className="text-sm font-black tracking-tight text-white uppercase">
                            {group.title}
                          </h3>
                          <span className="text-[11px] text-teal-100">
                            ({group.items.length} Pos)
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-teal-200 uppercase block">Subtotal Pagu Group</span>
                            <span className="font-bold text-sm font-mono text-amber-200">
                              {formatCurrency(group.totalPagu)}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleOpenItemModal(null, group.codePrefix)}
                            className="p-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                            title={`Tambah pos di ${group.title}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Pos Items & Nested Sub-rincian Table */}
                      {isGroupEmpty ? (
                        <div className="py-8 text-center text-slate-500 text-xs italic bg-slate-50">
                          Belum ada pos anggaran pada kelompok ini untuk tahun {selectedYear || 'terpilih'}.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200">
                          {group.items.map((item, itemIdx) => {
                            const subItems = getItemRincianList(item);
                            const totalSubPagu = subItems.reduce((acc, s) => acc + (Number(s.paguAnggaran) || 0), 0);

                            return (
                              <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors space-y-3">
                                {/* Pos Master Header Row */}
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-100/90 border border-slate-200 p-3 rounded-xl">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-800 text-white rounded">
                                        {item.kode}
                                      </span>
                                      <h4 className="text-sm font-black text-slate-900 tracking-tight">
                                        {item.uraian}
                                      </h4>
                                      {/* PENANDA KHUSUS (Requirement 5) */}
                                      <button
                                        type="button"
                                        onClick={() => handleViewRincian(item)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 text-teal-800 border border-teal-300 rounded-md text-[10.5px] font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
                                        title="Penanda Khusus: Klik untuk memunculkan rincian tabel pagu baris ini"
                                      >
                                        <Layers size={11} className="text-teal-600 shrink-0" />
                                        <span>{subItems.length} Rincian Pagu</span>
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                      </button>
                                    </div>
                                    {item.keterangan && (
                                      <p className="text-xs text-slate-500 italic">
                                        Catatan: {item.keterangan}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 text-xs font-mono self-start lg:self-auto flex-wrap sm:flex-nowrap">
                                    <div className="text-left sm:text-right">
                                      <span className="text-[10px] text-slate-500 uppercase block">Volume / Satuan</span>
                                      <span className="font-bold text-slate-800">
                                        {item.volume || 1} {item.satuan || 'Paket'}
                                      </span>
                                    </div>
                                    <div className="text-left sm:text-right border-l border-slate-300 pl-3">
                                      <span className="text-[10px] text-slate-500 uppercase block">Tarif Satuan</span>
                                      <span className="font-bold text-slate-800">
                                        {formatCurrency(item.hargaSatuan || item.jumlah)}
                                      </span>
                                    </div>
                                    <div className="text-left sm:text-right border-l border-slate-300 pl-3">
                                      <span className="text-[10px] text-teal-700 uppercase block font-bold">Total Pagu</span>
                                      <span className="font-black text-sm text-teal-900">
                                        {formatCurrency(item.jumlah)}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
                                      <button 
                                        type="button"
                                        onClick={() => handleOpenItemModal(item)}
                                        className="p-1.5 text-sky-600 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer"
                                        title="Edit Pos & Rincian"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setItemToDelete(item);
                                          setIsDeleteModalOpen(true);
                                        }}
                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                        title="Hapus Pos"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Nested Table of Sub-Rincian (Tabel Rincian Pagu Baris Tersebut) */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                  <table className="w-full text-xs text-left border-collapse min-w-[600px]">
                                    <thead>
                                      <tr className="bg-teal-50/80 text-teal-900 text-[11px] font-bold border-b border-teal-100 uppercase tracking-wider">
                                        <th className="py-1.5 px-3 text-center w-10 font-mono">No</th>
                                        <th className="py-1.5 px-3 min-w-[180px]">Uraian</th>
                                        <th className="py-1.5 px-3 text-center w-20">Qty</th>
                                        <th className="py-1.5 px-3 text-left w-24">Tarif Satuan</th>
                                        <th className="py-1.5 px-3 text-right w-36">Satuan Anggaran (Rp)</th>
                                        <th className="py-1.5 px-4 text-right w-40">Pagu Anggaran</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {subItems.map((rinc, rIdx) => (
                                        <tr key={rinc.id || rIdx} className="hover:bg-slate-50 transition-colors">
                                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                                            {rIdx + 1}
                                          </td>
                                          <td className="py-2 px-3 text-slate-800 font-medium">
                                            {rinc.uraian || item.uraian}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                            {rinc.qty || 1}
                                          </td>
                                          <td className="py-2 px-3 text-slate-600">
                                            {rinc.satuan || 'Paket'}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                                            {formatCurrency(rinc.tarifSatuan || 0)}
                                          </td>
                                          <td className="py-2 px-4 text-right font-mono font-bold text-teal-800">
                                            {formatCurrency(rinc.paguAnggaran || 0)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                      <tr>
                                        <td colSpan={5} className="py-2 px-3 text-right font-black uppercase text-[10px] text-slate-600">
                                          Total Sub-Rincian Pos [{item.kode}]:
                                        </td>
                                        <td className="py-2 px-4 text-right font-mono font-black text-xs text-teal-900">
                                          {formatCurrency(totalSubPagu)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Grand Total Row Anggaran 1 Tahun */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-amber-300 font-mono font-bold uppercase tracking-wider block">
                  Rekapitulasi Konsolidasi RKA
                </span>
                <h3 className="text-base font-black tracking-tight text-white font-serif">
                  TOTAL KESELURUHAN ANGGARAN BELANJA 1 TAHUN ({selectedYear || 'SEMUA'})
                </h3>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-teal-200 uppercase block">Total Plafon Anggaran Belanja</span>
                <span className="text-2xl font-black text-amber-300">
                  {formatCurrency(fiscalKPI.totalPaguBelanja)}
                </span>
              </div>
            </div>

            {/* Lembar Tanda Tangan Resmi Dokumen Anggaran 1 Tahun */}
            <div className="bg-white border border-slate-300 p-6 rounded-2xl shadow-sm">
              <ReportSignatureBlock
                keliangName={keliangName}
                juruRaksaName={juruRaksaName}
                customPlace={customPlace}
                signatureDate={signatureDate}
                keliangTitle="Keliang Desa Adat Basangalas"
                keliangSubtitle="Penanggung Jawab Kebijakan RAPB"
                juruRaksaTitle="Juru Raksa Desa Adat"
                juruRaksaSubtitle="Pengelola Anggaran & Perbendaharaan"
                keliangActionText="Mengetahui dan Mengesahkan Dokumen RKA 1 Tahun,"
                namaDesa="DESA ADAT BASANGALAS"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. OFFICIAL MULTI-PAGE PRINT DOCUMENT LAYOUT (All Groups & Pages)         */}
      {/* ========================================================================= */}
      <div className="hidden print:block text-black bg-white w-full print-compact-mode" id="printable-area-anggaran-full">
        {/* KOP SURAT RESMI DESA ADAT */}
        <div className="text-center border-b-2 border-black pb-2 mb-2.5 print-header-kop">
          <h2 className="text-lg font-serif font-black uppercase tracking-wider text-black m-0 leading-tight">
            DESA ADAT BASANGALAS
          </h2>
          <h3 className="text-sm font-serif font-bold text-black my-0.5 tracking-wide">
            Tata Kelola Penatausahaan Keuangan Kas Desa Adat
          </h3>
          <p className="text-[10px] font-serif text-black m-0 italic">
            Jln. Raya Basangalas, Desa Tribuana, Kec. Abang, Kab. Karangasem - Bali
          </p>
        </div>

        {/* JUDUL DOKUMEN LAPORAN */}
        <div className="text-center mb-3">
          <h3 className="text-sm font-serif font-black uppercase tracking-wider text-black m-0">
            RENCANA ANGGARAN PENDAPATAN DAN BELANJA (RAPB)
          </h3>
          <p className="text-[11px] font-mono font-bold text-black mt-0.5">
            TAHUN ANGGARAN: {selectedYear ? `TAHUN ${selectedYear}` : 'SELURUH PERIODE'}
          </p>
          <p className="text-[9px] font-sans text-gray-700 italic">
            Dokumen Resmi Penetapan Pagu Anggaran dan Realisasi Akuntansi LRA | Dicetak: {formatLongDate(new Date().toISOString())}
          </p>
        </div>

        {/* RINGKASAN EKSEKUTIF ANGGARAN (FISCAL SUMMARY TABLE) */}
        <div className="mb-3.5 rapb-summary-block">
          <table className="w-full text-[10px] border-collapse border border-black mb-1">
            <thead>
              <tr className="bg-gray-100 font-bold border-b border-black">
                <th className="border border-black px-2 py-1 text-left w-1/3">Keterangan Ringkasan RAPB</th>
                <th className="border border-black px-2 py-1 text-right w-1/5">Pagu Anggaran (Rp)</th>
                <th className="border border-black px-2 py-1 text-right w-1/5">Realisasi LRA (Rp)</th>
                <th className="border border-black px-2 py-1 text-right w-1/5">Sisa / Selisih (Rp)</th>
                <th className="border border-black px-1 py-1 text-center w-14">Serapan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1 font-semibold">I. Estimasi Penerimaan (Pendapatan &amp; Pembiayaan)</td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">{formatCurrency(fiscalKPI.totalPaguPenerimaan)}</td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">{formatCurrency(fiscalKPI.totalRealisasiPenerimaan)}</td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">
                  {fiscalKPI.totalRealisasiPenerimaan - fiscalKPI.totalPaguPenerimaan > 0 ? `+${formatCurrency(fiscalKPI.totalRealisasiPenerimaan - fiscalKPI.totalPaguPenerimaan)}` : formatCurrency(fiscalKPI.totalRealisasiPenerimaan - fiscalKPI.totalPaguPenerimaan)}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono font-bold">
                  {fiscalKPI.totalPaguPenerimaan > 0 ? ((fiscalKPI.totalRealisasiPenerimaan / fiscalKPI.totalPaguPenerimaan) * 100).toFixed(1) : 0}%
                </td>
              </tr>
              <tr>
                <td className="border border-black px-2 py-1 font-semibold">II. Total Plafon Beban/Belanja Operasional</td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">{formatCurrency(fiscalKPI.totalPaguBelanja)}</td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">{formatCurrency(fiscalKPI.totalRealisasiBelanja)}</td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">{formatCurrency(fiscalKPI.totalPaguBelanja - fiscalKPI.totalRealisasiBelanja)}</td>
                <td className="border border-black px-1 py-1 text-center font-mono font-bold">
                  {fiscalKPI.rasioPenyerapanBelanja.toFixed(1)}%
                </td>
              </tr>
              <tr className="bg-gray-50 font-black">
                <td className="border border-black px-2 py-1 uppercase">
                  SURPLUS / (DEFISIT) ANGGARAN
                </td>
                <td className={`border border-black px-2 py-1 text-right font-mono ${fiscalKPI.surplusDefisitPagu >= 0 ? '' : 'text-red-700'}`}>
                  {fiscalKPI.surplusDefisitPagu < 0 ? `(${formatCurrency(Math.abs(fiscalKPI.surplusDefisitPagu))})` : formatCurrency(fiscalKPI.surplusDefisitPagu)}
                </td>
                <td className={`border border-black px-2 py-1 text-right font-mono ${fiscalKPI.surplusDefisitRealisasi >= 0 ? '' : 'text-red-700'}`}>
                  {fiscalKPI.surplusDefisitRealisasi < 0 ? `(${formatCurrency(Math.abs(fiscalKPI.surplusDefisitRealisasi))})` : formatCurrency(fiscalKPI.surplusDefisitRealisasi)}
                </td>
                <td className="border border-black px-2 py-1 text-right font-mono">
                  {formatCurrency(fiscalKPI.surplusDefisitPagu - fiscalKPI.surplusDefisitRealisasi)}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono text-[9px]">
                  {fiscalKPI.surplusDefisitPagu >= 0 ? 'Surplus' : 'Defisit'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* TABEL RINCIAN LENGKAP SEMUA KATEGORI POS ANGGARAN */}
        <div className="space-y-4 print:space-y-3">
          {fullPrintGroupedData.map((group) => {
            const hasItems = group.items.length > 0;

            return (
              <div key={group.id} className="mb-3.5 print:mb-2.5 rapb-group-block">
                {/* Header Kategori */}
                <div className="bg-gray-200 border border-black border-b-0 px-2.5 py-1 flex justify-between items-center print-group-header">
                  <span className="font-bold text-[11px] uppercase tracking-tight text-black">
                    {group.title} (Akun {group.codePrefix})
                  </span>
                  <span className="text-[10px] font-mono font-bold text-black">
                    Subtotal: {formatCurrency(group.totalPagu)} | Realisasi: {formatCurrency(group.totalRealisasi)}
                  </span>
                </div>

                <table className="w-full text-[9.5px] border-collapse border border-black text-left rapb-print-table">
                  <thead>
                    <tr className="bg-gray-100 font-bold border-b border-black text-black text-center print:bg-gray-100">
                      <th className="border border-black px-1.5 py-1 w-16 font-mono text-center">Kode Rek.</th>
                      <th className="border border-black px-1.5 py-1 text-left">Uraian Pos Kegiatan / Rincian Belanja</th>
                      <th className="border border-black px-1.5 py-1 w-20 text-center">Vol &amp; Tarif</th>
                      <th className="border border-black px-1.5 py-1 text-right w-24">Pagu (Rp)</th>
                      <th className="border border-black px-1.5 py-1 text-right w-24">Realisasi LRA (Rp)</th>
                      <th className="border border-black px-1.5 py-1 text-right w-24">Sisa Pagu (Rp)</th>
                      <th className="border border-black px-1 py-1 w-10 text-center">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasItems ? (
                      <tr>
                        <td colSpan={7} className="border border-black p-1.5 text-center italic text-gray-500">
                          - Tidak ada rincian pos anggaran spesifik pada kelompok ini -
                        </td>
                      </tr>
                    ) : (
                      group.items.map((item, idx) => {
                        const isRev = group.categoryType === 'sumberdana' || group.categoryType === 'pendapatan';
                        const realisasi = realizationMap[item.kode] || 0;
                        const itemPagu = Number(item.jumlah) || 0;
                        const selisih = isRev ? (realisasi - itemPagu) : (itemPagu - realisasi);
                        const persentase = itemPagu > 0 ? (realisasi / itemPagu) * 100 : (realisasi > 0 ? 100 : 0);

                        return (
                          <tr key={item.id || idx} className="border-b border-black print-item-row">
                            <td className="border border-black px-1.5 py-1 font-mono text-center font-semibold align-middle text-[9px]">
                              {item.kode}
                            </td>
                            <td className="border border-black px-1.5 py-1 align-middle text-[9.5px]">
                              <div className="font-bold text-black leading-tight">{item.uraian}</div>
                              {item.keterangan && (
                                <div className="text-[8.5px] text-gray-700 italic mt-0.5 leading-tight">{item.keterangan}</div>
                              )}
                            </td>
                            <td className="border border-black px-1 py-1 text-center font-mono align-middle text-[8.5px] leading-tight">
                              <div>
                                <span className="font-semibold">{item.volume || 1}</span> {item.satuan || 'Paket'}
                              </div>
                              <div className="text-gray-600 text-[8px]">
                                @{formatCurrency(item.hargaSatuan !== undefined ? item.hargaSatuan : item.jumlah)}
                              </div>
                            </td>
                            <td className="border border-black px-1.5 py-1 text-right font-mono font-bold align-middle text-[9.5px] whitespace-nowrap">
                              {formatCurrency(item.jumlah)}
                            </td>
                            <td className="border border-black px-1.5 py-1 text-right font-mono font-bold align-middle text-[9.5px] whitespace-nowrap">
                              {formatCurrency(realisasi)}
                            </td>
                            <td className="border border-black px-1.5 py-1 text-right font-mono align-middle text-[9.5px] whitespace-nowrap">
                              {selisih > 0 && isRev ? `+${formatCurrency(selisih)}` : formatCurrency(selisih)}
                            </td>
                            <td className="border border-black px-1 py-1 text-center font-mono font-semibold align-middle text-[9px] whitespace-nowrap">
                              {persentase.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2 border-black print:bg-gray-100 print-subtotal-row">
                      <td colSpan={3} className="border border-black px-2 py-1 text-right uppercase text-[9px]">
                        SUBTOTAL {group.title.split(' ').slice(0, 3).join(' ')}:
                      </td>
                      <td className="border border-black px-1.5 py-1 text-right font-mono font-black text-[10px] whitespace-nowrap">
                        {formatCurrency(group.totalPagu)}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-right font-mono font-black text-[10px] whitespace-nowrap">
                        {formatCurrency(group.totalRealisasi)}
                      </td>
                      <td className="border border-black px-1.5 py-1 text-right font-mono font-bold text-[9.5px] whitespace-nowrap">
                        {formatCurrency(group.selisih)}
                      </td>
                      <td className="border border-black px-1 py-1 text-center font-mono font-black text-[9.5px] whitespace-nowrap">
                        {group.persentase.toFixed(0)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>

        {/* GRAND TOTAL ROW */}
        <div className="mt-3 print:mt-2 break-inside-avoid">
          <table className="w-full text-[10.5px] border-collapse border-2 border-black">
            <tbody>
              <tr className="bg-gray-200 font-black text-black">
                <td className="border border-black px-2 py-1.5 text-right uppercase text-[10px] w-1/2">
                  TOTAL KESELURUHAN ANGGARAN BELANJA (RAPB):
                </td>
                <td className="border border-black px-2 py-1.5 text-right font-mono text-xs w-1/4">
                  {formatCurrency(fiscalKPI.totalPaguBelanja)}
                </td>
                <td className="border border-black px-2 py-1.5 text-right font-mono text-xs w-1/4">
                  Realisasi: {formatCurrency(fiscalKPI.totalRealisasiBelanja)} ({fiscalKPI.rasioPenyerapanBelanja.toFixed(1)}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* LEMBAR PENGESAHAN DAN TANDA TANGAN RESMI */}
        <div className="mt-4 print:mt-3 pt-2 border-t border-slate-400 break-inside-avoid">
          <ReportSignatureBlock
            keliangName={keliangName}
            juruRaksaName={juruRaksaName}
            customPlace={customPlace}
            signatureDate={signatureDate}
            keliangTitle="Keliang Desa Adat Basangalas"
            keliangSubtitle="Penanggung Jawab Kebijakan RAPB"
            juruRaksaTitle="Juru Raksa Desa Adat"
            juruRaksaSubtitle="Pengelola Anggaran & Perbendaharaan"
            keliangActionText="Mengetahui dan Mengesahkan,"
            namaDesa="DESA ADAT BASANGALAS"
          />
        </div>
            {/* Formal Footer */}
            <div className="flex justify-between items-center mt-3 print:mt-2 px-2 text-slate-900 border-t border-slate-300 pt-1">
              <div>
                <p className="font-semibold text-[9px] m-0">Dokumen Resmi Penatausahaan Keuangan Desa Adat Basangalas.</p>
                <p className="text-[8px] text-slate-500 m-0">Perencanaan dan Penetapan Pagu Anggaran Berstandar Akuntansi Nasional.</p>
              </div>
              <div className="text-right font-mono text-[7.5px] text-slate-500">
                <p className="m-0">Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
      </div>

      {/* MODAL INPUT & EDIT RKA ITEM */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`${editingItem ? 'Edit' : 'Tambah'} Pos Rencana Anggaran (RKA)`}
        className="max-w-4xl"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {/* Header Banner Info */}
          <div className="bg-teal-50 border border-teal-200/90 rounded-xl p-3 flex items-start gap-3 text-teal-900 shadow-xs">
            <div className="p-2 bg-teal-600 text-white rounded-lg shrink-0 mt-0.5 shadow-sm">
              <Landmark size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-950">
                  {editingItem ? 'Perbarui Pagu Anggaran Desa' : 'Perencanaan Pagu Anggaran Baru'}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-100 border border-teal-300 rounded-full text-teal-800 font-mono">
                  Tahun {formTahun || selectedYear}
                </span>
              </div>
              <p className="text-[11px] text-teal-800/90 mt-0.5 leading-relaxed">
                Pilih pos anggaran dan akun dari daftar di samping, atau ketik langsung kode rekening. Tarif satuan otomatis terhitung dari Total Pagu dibagi Volume.
              </p>
            </div>
          </div>

          {/* Section 1: Pos Anggaran, Kode Rekening & Daftar Akun Terpilih (Requirement 3) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-inner">
            {/* Selector Kelompok Pos Anggaran */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-teal-600 shrink-0" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Kelompok Pos Anggaran:
                </span>
              </div>
              <select
                value={formGroupPrefix}
                onChange={e => handleGroupPrefixChange(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-900 rounded-lg text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer max-w-full sm:max-w-md truncate shadow-xs"
              >
                {ACCOUNT_GROUPS.map(g => (
                  <option key={g.id} value={g.codePrefix}>
                    {g.title} [{g.codePrefix}]
                  </option>
                ))}
              </select>
            </div>

            {/* Grid 2 Kolom: Kiri (Box Kode Akun & Uraian) vs Kanan (Daftar Akun Pos Anggaran) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* Kolom Kiri: Box Kode Akun & Box Uraian */}
              <div className="lg:col-span-6 space-y-3">
                {/* Kode Rekening Box */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1 tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tag size={13} className="text-teal-600" />
                      Kode Rekening (Bagan Akun Standar) <span className="text-rose-500">*</span>
                    </span>
                    {formKode && (
                      <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-md border border-teal-200">
                        Akun: {formKode}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input 
                      list="coa-referensi-list"
                      type="text" 
                      value={formKode} 
                      onChange={e => handleSelectAccount(e.target.value)} 
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono text-sm font-semibold shadow-xs" 
                      placeholder="Ketik kode akun atau pilih di daftar samping..." 
                      required 
                    />
                    <datalist id="coa-referensi-list">
                      {REFERENSI_REKENING.map(r => (
                        <option key={r.code} value={`${r.code} - ${r.name}`} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 italic">
                    Klik salah satu akun di daftar sebelah kanan untuk memilih langsung.
                  </p>
                </div>

                {/* Uraian Pos Kegiatan */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1 tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={13} className="text-teal-600" />
                      Uraian Pos Kegiatan / Rincian Belanja <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal italic">
                      Dapat diedit bebas
                    </span>
                  </label>
                  <input 
                    type="text" 
                    value={formUraian} 
                    onChange={e => setFormUraian(e.target.value)} 
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm font-medium shadow-xs" 
                    placeholder="Contoh: Belanja Bebantenan Utama Aci, Pengadaan Beras, dsb." 
                    required 
                  />
                </div>
              </div>

              {/* Kolom Kanan: Di samping box kode akun, buatkan daftar akun dari pos anggaran yang dipilih (Requirement 3) */}
              <div className="lg:col-span-6 bg-white border border-slate-300 rounded-xl p-3 shadow-xs flex flex-col min-h-[185px]">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Layers size={13} className="text-teal-600 shrink-0" />
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide truncate">
                      Daftar Akun: {currentGroup.codePrefix}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full font-mono shrink-0">
                    {posAkunList.length} Akun
                  </span>
                </div>

                {/* Scrollable list of accounts */}
                <div className="flex-1 overflow-y-auto max-h-[160px] space-y-1.5 pr-1 custom-scrollbar">
                  {posAkunList.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">
                      Tidak ada akun spesifik untuk awalan {formGroupPrefix}. Anda dapat memasukkan kode akun secara manual di kolom sebelah kiri.
                    </div>
                  ) : (
                    posAkunList.map(acc => {
                      const isSelected = formKode === acc.code;
                      return (
                        <button
                          key={acc.code}
                          type="button"
                          onClick={() => handleSelectAccount(acc.code)}
                          className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold ring-1 ring-teal-500 shadow-xs'
                              : 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-teal-50/70 hover:border-teal-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              isSelected ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-800'
                            }`}>
                              {acc.code}
                            </span>
                            <span className="truncate text-xs">{acc.name}</span>
                          </div>
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[10px] text-teal-700 font-bold shrink-0">
                              <CheckCircle2 size={13} className="text-teal-600" />
                              Dipilih
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 group-hover:text-teal-600 font-medium shrink-0">
                              Pilih
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                  <span>Klik akun untuk mengisi otomatis</span>
                  <span className="text-teal-700 font-semibold truncate max-w-[180px]">{currentGroup.title}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Requirement 1: Sembunyikan Perhitungan Rincian & Pagu, dan Keterangan anggaran, saat modal dimunculkan.
              Setelah klik akun daftar akun, munculkan Perhitungan rincian dan keterangan. */}
          {!hasAccountSelected ? (
            <div className="bg-amber-50/80 border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center space-y-2 animate-fade-in-up">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Layers size={22} className="animate-pulse" />
              </div>
              <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Langkah 1: Silakan Pilih Akun Rekening
              </h5>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Silakan klik salah satu akun pada panel <strong>Daftar Akun</strong> di sebelah kanan (atau ketik langsung pada kotak Kode Rekening) untuk membuka pengisian perhitungan rincian pagu, tabel rincian, dan keterangan anggaran.
              </p>
            </div>
          ) : (
            <>
              {/* Section 2: Rincian Perhitungan (Volume, Satuan, Tarif, Total) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Calculator size={14} className="text-teal-600" />
                  Perhitungan Rincian & Pagu Anggaran
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Volume */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 tracking-wider">
                      Volume / Qty
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      step="any"
                      value={formVolume} 
                      onChange={e => handleVolumeChange(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm font-semibold shadow-xs" 
                      placeholder="1" 
                    />
                  </div>

                  {/* Satuan (Requirement 2: default = "--pilih satuan--", dropdown dari data tersimpan, editable opsional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Satuan
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomSatuan(prev => !prev)}
                        className="text-[10px] text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer flex items-center gap-1"
                        title="Beralih antara pilihan dropdown dan ketik bebas"
                      >
                        <Pencil size={10} />
                        {isCustomSatuan ? 'Pilih Dropdown' : 'Ketik Manual'}
                      </button>
                    </div>

                    {isCustomSatuan ? (
                      <div className="relative">
                        <input 
                          type="text" 
                          value={formSatuan} 
                          onChange={e => setFormSatuan(e.target.value)} 
                          className="w-full px-3 py-2 bg-white border border-teal-500 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-xs font-semibold shadow-xs" 
                          placeholder="Ketik nama satuan..." 
                          autoFocus
                        />
                      </div>
                    ) : (
                      <select
                        value={formSatuan}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setIsCustomSatuan(true);
                            setFormSatuan('');
                          } else {
                            setFormSatuan(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-xs font-medium shadow-xs cursor-pointer"
                      >
                        <option value="">--pilih satuan--</option>
                        {savedSatuanList.map((sat, idx) => (
                          <option key={idx} value={sat}>
                            {sat}
                          </option>
                        ))}
                        <option value="__custom__">+ Ketik Satuan Lainnya (Kustom)...</option>
                      </select>
                    )}
                  </div>

                  {/* Tarif Satuan */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 tracking-wider">
                      Tarif / Harga Satuan (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rp</span>
                      <input 
                        type="number" 
                        min="0"
                        value={formHargaSatuan} 
                        onChange={e => handleHargaSatuanChange(e.target.value === '' ? '' : Number(e.target.value))} 
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm font-semibold shadow-xs" 
                        placeholder="0" 
                      />
                    </div>
                  </div>
                </div>

                {/* Total Pagu Anggaran Box */}
                <div className="bg-gradient-to-br from-teal-700 to-teal-900 border border-teal-600 rounded-xl p-3.5 text-white shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-teal-100 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-300" />
                      Total Pagu Anggaran (Rp) <span className="text-rose-300">*</span>
                    </label>
                    {formVolume !== '' && formHargaSatuan !== '' && (
                      <span className="text-[11px] text-teal-200 font-mono bg-teal-800/80 px-2 py-0.5 rounded-md border border-teal-600/60">
                        Perhitungan: {formVolume} {formSatuan && formSatuan !== '--pilih satuan--' ? formSatuan : 'satuan'} × {formatCurrency(Number(formHargaSatuan))}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-300 font-black text-lg">Rp</span>
                    <input 
                      type="number" 
                      min="0"
                      value={formJumlah} 
                      onChange={e => handleTotalJumlahChange(e.target.value === '' ? '' : Number(e.target.value))} 
                      className="w-full pl-11 pr-4 py-2.5 bg-teal-950/70 border border-teal-500/70 text-white rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-mono font-black text-xl text-amber-300 shadow-inner" 
                      placeholder="0" 
                      required 
                    />
                  </div>

                  {Number(formJumlah) > 0 ? (
                    <div className="text-[11px] text-teal-100/95 mt-1.5 flex items-start gap-1">
                      <span className="font-bold text-amber-300">Terbilang:</span>
                      <span className="italic">{numberToWords(Number(formJumlah))} Rupiah</span>
                    </div>
                  ) : formJumlah !== '' && Number(formJumlah) === 0 ? (
                    <p className="text-[11px] text-teal-200/90 mt-1 italic">
                      Pagu Nihil (Rp 0)
                    </p>
                  ) : null}
                </div>

                {/* Requirement 2: Buatkan di bawah total pagu anggaran tabel dengan kolom:
                    | No | Uraian | Qty| tarif satuan |satuan anggaran (Rp) | Pagu Anggaran |
                    Tambah Rincian
                    Total Pagu (Estimasi) : (Harus sama dengan total pagu anggaran), apabila belum beri peringatan di baris ini. */}
                <div className="bg-white border border-slate-300 rounded-xl p-3 space-y-3 shadow-xs mt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} className="text-teal-600" />
                        <span>Tabel Sub-Rincian Penganggaran</span>
                        <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                          {formRincianList.length} Rincian
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Rincian item belanja / sub-kegiatan pendukung pagu anggaran pos ini.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddRincianRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                    >
                      <Plus size={14} />
                      <span>Tambah Rincian</span>
                    </button>
                  </div>

                  {/* Tabel Rincian */}
                  <div className="overflow-x-auto w-full border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left border-collapse min-w-[620px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold border-b border-slate-200 uppercase tracking-wider">
                          <th className="py-2 px-2 text-center w-10 font-mono">No</th>
                          <th className="py-2 px-3 min-w-[180px]">Uraian</th>
                          <th className="py-2 px-2 text-center w-20">Qty</th>
                          <th className="py-2 px-2 text-left w-24">Tarif Satuan</th>
                          <th className="py-2 px-2 text-right w-36">Satuan Anggaran (Rp)</th>
                          <th className="py-2 px-3 text-right w-36">Pagu Anggaran</th>
                          <th className="py-2 px-1 text-center w-10">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {formRincianList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-5 text-center text-slate-500 italic text-xs">
                              Belum ada rincian. Klik tombol <strong>"+ Tambah Rincian"</strong> untuk menambahkan baris rincian pagu.
                            </td>
                          </tr>
                        ) : (
                          formRincianList.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-teal-50/40 transition-colors">
                              <td className="py-2 px-2 text-center font-mono font-bold text-slate-600">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={row.uraian}
                                  onChange={e => handleUpdateRincianRow(idx, 'uraian', e.target.value)}
                                  placeholder="Contoh: Daksina Piodalan, Beras, Tenaga..."
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                                  required
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={row.qty}
                                  onChange={e => handleUpdateRincianRow(idx, 'qty', e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                                  required
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  list="sub-satuan-presets-modal"
                                  value={row.satuan}
                                  onChange={e => handleUpdateRincianRow(idx, 'satuan', e.target.value)}
                                  placeholder="Paket / Bln"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-right">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[10px]">Rp</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.tarifSatuan}
                                    onChange={e => handleUpdateRincianRow(idx, 'tarifSatuan', e.target.value)}
                                    className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-right focus:bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                                    required
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-teal-800 text-xs whitespace-nowrap">
                                {formatCurrency(row.paguAnggaran)}
                              </td>
                              <td className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRincianRow(idx)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus baris rincian ini"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={5} className="py-2.5 px-3 text-right font-black uppercase text-[11px] text-slate-700">
                            Total Pagu (Estimasi) :
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-xs text-teal-900 whitespace-nowrap">
                            {formatCurrency(totalPaguEstimasi)}
                          </td>
                          <td></td>
                        </tr>
                        {/* Requirement 2: Total Pagu (Estimasi) : (Harus sama dengan total pagu anggaran), apabila belum beri peringatan di baris ini */}
                        {formRincianList.length > 0 && totalPaguEstimasi !== (Number(formJumlah) || 0) && (
                          <tr className="bg-amber-100 border-t-2 border-amber-300 text-amber-950 font-bold">
                            <td colSpan={7} className="py-2.5 px-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-amber-900">
                                  <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                                  <span>
                                    ⚠️ <strong>Peringatan di baris ini:</strong> Total Pagu (Estimasi): <strong>{formatCurrency(totalPaguEstimasi)}</strong> belum sama dengan Total Pagu Anggaran (<strong>{formatCurrency(Number(formJumlah) || 0)}</strong>). Total Pagu (Estimasi) harus sama dengan total pagu anggaran!
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleSyncPaguWithEstimasi}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shadow-xs whitespace-nowrap cursor-pointer shrink-0"
                                >
                                  Samakan Total Pagu ({formatCurrency(totalPaguEstimasi)})
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>

                  <datalist id="sub-satuan-presets-modal">
                    {savedSatuanList.map((sat, i) => (
                      <option key={i} value={sat} />
                    ))}
                  </datalist>

                  {/* Status Keseimbangan & Peringatan Total Pagu (Estimasi) vs Total Pagu Anggaran (Requirement 2) */}
                  {formRincianList.length > 0 && (
                    <div className="pt-1">
                      {totalPaguEstimasi === (Number(formJumlah) || 0) ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
                            <div>
                              <span>Total Pagu (Estimasi): <strong>{formatCurrency(totalPaguEstimasi)}</strong></span>
                              <span className="text-emerald-700 ml-1.5">
                                ✓ Sesuai dan seimbang dengan Total Pagu Anggaran ({formatCurrency(Number(formJumlah) || 0)})
                              </span>
                            </div>
                          </div>
                          <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap self-start sm:self-auto">
                            Seimbang (100%)
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-amber-900">
                                  Total Pagu (Estimasi): {formatCurrency(totalPaguEstimasi)}
                                </span>
                                <p className="text-amber-800 text-[11px] mt-0.5">
                                  Belum sama dengan Total Pagu Anggaran ({formatCurrency(Number(formJumlah) || 0)}). Selisih: <strong>{formatCurrency(Math.abs(totalPaguEstimasi - (Number(formJumlah) || 0)))}</strong>
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleSyncPaguWithEstimasi}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
                            >
                              <Sparkles size={13} />
                              <span>Samakan Total Pagu ({formatCurrency(totalPaguEstimasi)})</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-amber-700 italic border-t border-amber-200/80 pt-1.5">
                            ⚠️ Peringatan: Total Pagu Estimasi harus sama dengan total pagu anggaran di atas, apabila belum beri penyesuaian sebelum menyimpan.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Keterangan / Justifikasi & Tahun */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Keterangan Input with Quick Options */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileCheck2 size={13} className="text-teal-600" />
                        Keterangan / Justifikasi Anggaran
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Pilih opsi atau ketik bebas
                      </span>
                    </label>
                    
                    <input 
                      type="text" 
                      list="keterangan-suggestions-list"
                      value={formKeterangan} 
                      onChange={e => setFormKeterangan(e.target.value)} 
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-xs font-medium shadow-xs" 
                      placeholder="Contoh: Kebutuhan Aci Usaba Dalem 2026, Insentif Triwulan, dsb." 
                    />
                    <datalist id="keterangan-suggestions-list">
                      {getKeteranganSuggestions(formKode).map((sug, idx) => (
                        <option key={idx} value={sug} />
                      ))}
                    </datalist>

                    {/* Quick Chips Opsi Keterangan */}
                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                        <HelpCircle size={10} className="text-teal-600" /> Opsi Rekomendasi Keterangan:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {getKeteranganSuggestions(formKode).slice(0, 4).map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormKeterangan(sug)}
                            className={`text-[10.5px] px-2.5 py-1 rounded-lg border text-left transition-all ${
                              formKeterangan === sug
                                ? 'bg-teal-700 text-white border-teal-800 font-bold shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 font-medium'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Tahun Anggaran */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Tahun Anggaran
                    </label>
                    <select
                      value={formTahun}
                      onChange={e => setFormTahun(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 text-slate-900 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono text-xs font-bold shadow-xs cursor-pointer"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>
                          Tahun {yr}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Tahun penetapan RKA yang terhubung dengan buku kas dan LRA.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Buttons Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors border border-slate-300"
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-xl text-xs shadow-md shadow-teal-700/30 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <Save size={15} />
              <span>{editingItem ? 'Simpan Perubahan' : 'Simpan Pos Anggaran'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION MODAL DELETE */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Pos Anggaran"
        message={`Apakah Anda yakin ingin menghapus pos anggaran [${itemToDelete?.kode}] ${itemToDelete?.uraian} senilai ${formatCurrency(itemToDelete?.jumlah)}?`}
        confirmText="Hapus Pos"
        confirmButtonClass="bg-red-600 hover:bg-red-500 text-white"
      />

      {/* MODAL PRESET LOAD */}
      <ConfirmationModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        onConfirm={handleLoadStandardPreset}
        title="Muat Pos Akun Standar Nasional"
        message={`Sistem akan menambahkan pos-pos akun standar akuntansi (Sumber Dana, Pendapatan, Bebantenan, Operasional, Konsumsi, Caru, dan Wewalungan) untuk Tahun ${selectedYear || new Date().getFullYear()}. Apakah Anda ingin melanjutkan?`}
        confirmText="Muat Standar Sekarang"
        confirmButtonClass="bg-teal-600 hover:bg-teal-500 text-white"
      />

      {/* MODAL SETTINGS TANDA TANGAN */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Pengaturan Tanda Tangan Dokumen RAPB"
      >
        <div className="space-y-4">
          {/* TOGGLE OTOMATISASI TANDA TANGAN & STEMPEL DIGITAL */}
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3.5 space-y-3">
            <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-700 pb-2">
              <FileSignature size={14} />
              <span>Otomatisasi Tanda Tangan &amp; Stempel</span>
            </div>

            {/* Switch Tanda Tangan Digital */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-gray-200 block">Sematkan Tanda Tangan Digital</span>
                <span className="text-[10px] text-gray-400 block">Tampilkan TTD digital Keliang &amp; Juru Raksa</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={tempAutoEmbed}
                  onChange={e => setTempAutoEmbed(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {/* Switch Stempel Resmi Desa */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-700/80">
              <div>
                <span className="text-xs font-bold text-gray-200 block">Tampilkan Stempel Resmi Desa</span>
                <span className="text-[10px] text-gray-400 block">Cap stempel merah Desa Adat Basangalas</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={tempShowStamp}
                  onChange={e => setTempShowStamp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-1 tracking-wider">Nama Keliang Desa Adat</label>
            <input 
              type="text" 
              value={tempKeliangName} 
              onChange={e => setTempKeliangName(e.target.value)} 
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-1 tracking-wider">Nama Juru Raksa / Bendahara</label>
            <input 
              type="text" 
              value={tempJuruRaksaName} 
              onChange={e => setTempJuruRaksaName(e.target.value)} 
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase mb-1 tracking-wider">Tempat / Desa</label>
              <input 
                type="text" 
                value={tempCustomPlace} 
                onChange={e => setTempCustomPlace(e.target.value)} 
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase mb-1 tracking-wider">Tanggal Dokumen</label>
              <input 
                type="date" 
                value={tempSignatureDate} 
                onChange={e => setTempSignatureDate(e.target.value)} 
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-1 tracking-wider">Orientasi Cetak Dokumen Default</label>
            <select
              value={tempPrintOrientation}
              onChange={e => setTempPrintOrientation(e.target.value as any)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm"
            >
              <option value="auto">Otomatis (Bebas diatur di dialog cetak browser)</option>
              <option value="portrait">Paksa Potret / Tegak (A4 Portrait)</option>
              <option value="landscape">Paksa Lanskap / Mendatar (A4 Landscape)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button 
              type="button" 
              onClick={() => setIsSettingsOpen(false)} 
              className="px-5 py-2 bg-gray-800 text-gray-300 font-bold rounded-xl text-xs"
            >
              Batal
            </button>
            <button 
              type="button" 
              onClick={handleSaveSettings} 
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white font-bold rounded-xl text-xs shadow-lg"
            >
              <Save size={15} />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL RINCIAN TABEL PAGU (Requirement 5) */}
      <Modal
        isOpen={isRincianModalOpen}
        onClose={() => {
          setIsRincianModalOpen(false);
          setSelectedItemForRincian(null);
        }}
        title="Rincian Tabel Pagu Anggaran"
        className="max-w-4xl"
      >
        {selectedItemForRincian && (() => {
          const rincianItems = getItemRincianList(selectedItemForRincian);
          const totalRincian = rincianItems.reduce((sum, r) => sum + (Number(r.paguAnggaran) || 0), 0);
          const realisasi = realizationMap[selectedItemForRincian.kode] || 0;
          const isBalanced = totalRincian === Number(selectedItemForRincian.jumlah);

          return (
            <div className="space-y-4">
              {/* Header Info Pos */}
              <div className="bg-gradient-to-r from-teal-900 to-teal-700 text-white p-4 rounded-2xl shadow-md border border-teal-600">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-600/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-teal-950 text-teal-200 border border-teal-500/60 rounded">
                        {selectedItemForRincian.kode}
                      </span>
                      <h3 className="text-base font-black tracking-tight text-white">
                        {selectedItemForRincian.uraian}
                      </h3>
                    </div>
                    {selectedItemForRincian.keterangan && (
                      <p className="text-xs text-teal-100 mt-1 italic">
                        {selectedItemForRincian.keterangan}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold px-3 py-1 bg-teal-800 text-teal-100 border border-teal-500/80 rounded-full self-start sm:self-auto">
                    Tahun {selectedItemForRincian.tahun || selectedYear}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                    <span className="text-[10px] text-teal-300 uppercase block">Total Pagu Pos</span>
                    <span className="text-sm font-bold font-mono text-amber-300">
                      {formatCurrency(selectedItemForRincian.jumlah)}
                    </span>
                  </div>
                  <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                    <span className="text-[10px] text-teal-300 uppercase block">Volume / Satuan</span>
                    <span className="text-sm font-bold text-white">
                      {selectedItemForRincian.volume || 1} {selectedItemForRincian.satuan || 'Paket'}
                    </span>
                  </div>
                  <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                    <span className="text-[10px] text-teal-300 uppercase block">Tarif Satuan</span>
                    <span className="text-sm font-bold font-mono text-white">
                      {formatCurrency(selectedItemForRincian.hargaSatuan || selectedItemForRincian.jumlah)}
                    </span>
                  </div>
                  <div className="bg-teal-950/60 p-2.5 rounded-xl border border-teal-600/40">
                    <span className="text-[10px] text-teal-300 uppercase block">Realisasi LRA</span>
                    <span className="text-sm font-bold font-mono text-emerald-300">
                      {formatCurrency(realisasi)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabel Rincian Pagu Anggaran */}
              <div className="bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-teal-600" />
                    Tabel Rincian Pagu ({rincianItems.length} Sub-Rincian)
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    isBalanced 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {isBalanced ? '✓ 100% Sesuai Pagu' : '⚠️ Selisih Estimasi'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-slate-200 uppercase">
                        <th className="py-2.5 px-3 text-center w-12 font-mono">No</th>
                        <th className="py-2.5 px-4 min-w-[200px]">Uraian</th>
                        <th className="py-2.5 px-3 text-center w-24">Qty</th>
                        <th className="py-2.5 px-3 text-left w-24">Tarif Satuan</th>
                        <th className="py-2.5 px-4 text-right w-36">Satuan Anggaran (Rp)</th>
                        <th className="py-2.5 px-4 text-right w-40">Pagu Anggaran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rincianItems.map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-teal-50/50 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {r.uraian || selectedItemForRincian.uraian}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                            {r.qty || 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.satuan || 'Paket'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {formatCurrency(r.tarifSatuan || 0)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-black text-teal-800">
                            {formatCurrency(r.paguAnggaran || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-4 text-right uppercase text-[11px] text-slate-700">
                          Total Rincian Pagu (Estimasi):
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-black text-sm text-teal-900">
                          {formatCurrency(totalRincian)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const itemToEdit = selectedItemForRincian;
                    setIsRincianModalOpen(false);
                    setSelectedItemForRincian(null);
                    handleOpenItemModal(itemToEdit);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Pencil size={14} />
                  <span>Edit Pos &amp; Kelola Rincian</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRincianModalOpen(false);
                      setSelectedItemForRincian(null);
                    }}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-300"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

    </div>
  );
};

export default Anggaran;
