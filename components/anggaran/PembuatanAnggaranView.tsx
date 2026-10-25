import React, { useState, useMemo, useEffect } from 'react';
import type { BudgetItem, BudgetItemKegiatan } from '../../types';
import { REFERENSI_REKENING } from '../../constants';
import { formatCurrency, numberToWords } from '../../utils/formatter';
import { playSaveSuccessSound, playDeleteSuccessSound, playEditSuccessSound } from '../../utils/soundEffects';
import ConfirmationModal from '../shared/ConfirmationModal';
import { 
  Plus, Pencil, Trash2, Save, Calendar, CheckCircle2, 
  AlertCircle, ArrowRight, Layers, Landmark, Sparkles,
  FileSpreadsheet, Search, RefreshCw, X, ChevronRight,
  Calculator, Filter, Copy, Printer, Download, FileText,
  TrendingUp, TrendingDown, Scale, Check, AlertTriangle, ArrowRightLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PembuatanAnggaranViewProps {
  budgetItems: BudgetItem[];
  setBudgetItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  selectedYear: string;
  setSelectedYear?: (year: string) => void;
  onAddBudgetItem?: (item: BudgetItem) => Promise<void>;
  onUpdateBudgetItem?: (item: BudgetItem) => Promise<void>;
  onBatchSaveBudgetItems?: (items: BudgetItem[]) => Promise<void>;
  onBackToRapb?: () => void;
}

// 3 Main Sub-page Categories as requested:
// 1. Perencanaan RAPB Desa Adat
// 2. RAPB Hibah Provinsi
// 3. RAPB Hibah Kabupaten
export type SubCategoryType = 'desa_adat' | 'hibah_provinsi' | 'hibah_kabupaten';

interface SubCategoryConfig {
  id: SubCategoryType;
  label: string;
  subLabel: string;
  badge: string;
  groups: {
    groupKey: string;
    groupTitle: string;
    codePrefix: string;
    badgeColor: string;
  }[];
}

const SUB_CATEGORIES: SubCategoryConfig[] = [
  {
    id: 'desa_adat',
    label: '1. Perencanaan RAPB Desa Adat',
    subLabel: 'Sumber Dana Asli & Swadaya Desa Adat (Beban Insentif, Parhyangan, Pawongan, Beban Adat, & Pendapatan)',
    badge: 'Desa Adat',
    groups: [
      { groupKey: '5.1.1', groupTitle: 'II.0 Beban Insentif Prajuru', codePrefix: '5.1.1', badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
      { groupKey: '5.2.1', groupTitle: 'II.1 Parhyangan Adat', codePrefix: '5.2.1', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },
      { groupKey: '5.3.2', groupTitle: 'II.2 Pawongan Adat', codePrefix: '5.3.2', badgeColor: 'bg-blue-100 text-blue-900 border-blue-300' },
      { groupKey: '5.1.5', groupTitle: 'II.3 Beban Adat Lainnya', codePrefix: '5.1.5', badgeColor: 'bg-purple-100 text-purple-900 border-purple-300' },
      { groupKey: '4.1.1', groupTitle: 'I. Pendapatan Desa Adat', codePrefix: '4.1.1', badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    ]
  },
  {
    id: 'hibah_provinsi',
    label: '2. RAPB Hibah Provinsi',
    subLabel: 'Bantuan Keuangan Khusus (BKK) Pemerintah Provinsi Bali',
    badge: 'Provinsi Bali',
    groups: [
      { groupKey: '5.1.1', groupTitle: 'III.1 Beban Insentif Prajuru', codePrefix: '5.1.1', badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
      { groupKey: '5.1.2', groupTitle: 'III.2 Belanja Operasional', codePrefix: '5.1.2', badgeColor: 'bg-teal-100 text-teal-900 border-teal-300' },
      { groupKey: '5.1.3', groupTitle: 'III.3 Perjalanan Dinas / Saku', codePrefix: '5.1.3', badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
      { groupKey: '5.2.2', groupTitle: 'III.5 Program Parhyangan Hibah', codePrefix: '5.2.2', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },
      { groupKey: '5.3.1', groupTitle: 'III.6 Program Pawongan Hibah', codePrefix: '5.3.1', badgeColor: 'bg-blue-100 text-blue-900 border-blue-300' },
      { groupKey: '5.4.1', groupTitle: 'III.7 Program Palemahan', codePrefix: '5.4.1', badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
      { groupKey: '4.1.3.01', groupTitle: 'Pendapatan Hibah Provinsi', codePrefix: '4.1.3.01', badgeColor: 'bg-green-100 text-green-900 border-green-300' },
    ]
  },
  {
    id: 'hibah_kabupaten',
    label: '3. RAPB Hibah Kabupaten',
    subLabel: 'Bantuan Keuangan / Hibah Pemerintah Kabupaten / Kota',
    badge: 'Kabupaten',
    groups: [
      { groupKey: '5.1.4', groupTitle: 'III.1 Insentif Petugas Kabupaten', codePrefix: '5.1.4', badgeColor: 'bg-rose-100 text-rose-900 border-rose-300' },
      { groupKey: '5.2.3', groupTitle: 'III.5 Program Parhyangan Kabupaten', codePrefix: '5.2.3', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' },
      { groupKey: '4.1.3.02', groupTitle: 'Pendapatan Hibah Kabupaten', codePrefix: '4.1.3.02', badgeColor: 'bg-green-100 text-green-900 border-green-300' },
    ]
  }
];

const STORAGE_KEY_PREFIX = 'anggaran_perencanaan_kegiatan_';

export const PembuatanAnggaranView: React.FC<PembuatanAnggaranViewProps> = ({
  budgetItems,
  setBudgetItems,
  selectedYear,
  setSelectedYear,
  onAddBudgetItem,
  onUpdateBudgetItem,
  onBackToRapb
}) => {
  // Year state with fallback to local state if not provided
  const [internalYear, setInternalYear] = useState<string>(selectedYear || new Date().getFullYear().toString());
  const activeYear = selectedYear || internalYear;

  // Sync internal year if parent selectedYear prop changes
  useEffect(() => {
    if (selectedYear && selectedYear !== internalYear) {
      setInternalYear(selectedYear);
    }
  }, [selectedYear, internalYear]);

  // Compute available fiscal years for the filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const curr = new Date().getFullYear();
    years.add(curr.toString());
    years.add((curr - 1).toString());
    years.add((curr + 1).toString());
    years.add('2026');
    budgetItems.forEach(b => {
      if (b.tahun) years.add(b.tahun);
    });
    return Array.from(years).sort().reverse();
  }, [budgetItems]);

  // Handle year filter switch
  const handleYearChange = (newYear: string) => {
    setInternalYear(newYear);
    if (setSelectedYear) {
      setSelectedYear(newYear);
    }
    setFeedback({
      message: `Filter Tahun Anggaran dialihkan ke Tahun ${newYear}. Rincian kegiatan disesuaikan.`,
      type: 'info'
    });
  };

  // Sub-category Tab
  const [activeCategory, setActiveCategory] = useState<SubCategoryType>('desa_adat');
  const currentCategoryConfig = useMemo(() => {
    return SUB_CATEGORIES.find(c => c.id === activeCategory) || SUB_CATEGORIES[0];
  }, [activeCategory]);

  // Selected Account Code (Defaults to example '5.2.1.01' - Pecanangan)
  const [selectedKode, setSelectedKode] = useState<string>('5.2.1.01');
  const [accountSearch, setAccountSearch] = useState<string>('');

  // Local storage cache map for detail kegiatan per account code
  const [kegiatanMap, setKegiatanMap] = useState<Record<string, BudgetItemKegiatan[]>>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${activeYear}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse cached kegiatan data', e);
    }
    // Default seed example from user prompt:
    return {
      '5.2.1.01': [
        {
          id: 'keg-seed-1',
          namaKegiatan: 'Buda Wage Kelawu',
          periode: 'Bulanan',
          jadwal: '23 Agustus 2026',
          anggaran: 50000
        }
      ]
    };
  });

  // Reload kegiatanMap when activeYear changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${activeYear}`);
      if (stored) {
        setKegiatanMap(JSON.parse(stored));
        return;
      }
    } catch (e) {
      console.warn('Failed to parse cached kegiatan data for year', activeYear, e);
    }

    // Check if budgetItems for this activeYear have kegiatanList
    const fromBudgetItems: Record<string, BudgetItemKegiatan[]> = {};
    let found = false;
    budgetItems.filter(b => !b.tahun || b.tahun === activeYear).forEach(b => {
      if (b.kegiatanList && b.kegiatanList.length > 0) {
        fromBudgetItems[b.kode] = b.kegiatanList;
        found = true;
      }
    });

    if (found) {
      setKegiatanMap(fromBudgetItems);
    } else if (activeYear === '2026') {
      setKegiatanMap({
        '5.2.1.01': [
          {
            id: 'keg-seed-1',
            namaKegiatan: 'Buda Wage Kelawu',
            periode: 'Bulanan',
            jadwal: '23 Agustus 2026',
            anggaran: 50000
          }
        ]
      });
    } else {
      setKegiatanMap({});
    }
  }, [activeYear]);

  // Sync with existing budgetItems kegiatanList if present
  useEffect(() => {
    setKegiatanMap(prev => {
      const updated = { ...prev };
      let changed = false;
      budgetItems
        .filter(b => !b.tahun || b.tahun === activeYear)
        .forEach(b => {
          if (b.kegiatanList && b.kegiatanList.length > 0 && (!updated[b.kode] || updated[b.kode].length === 0)) {
            updated[b.kode] = b.kegiatanList;
            changed = true;
          }
        });
      return changed ? updated : prev;
    });
  }, [budgetItems, activeYear]);

  // Persist kegiatanMap to localStorage for activeYear
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${activeYear}`, JSON.stringify(kegiatanMap));
    } catch (e) {
      console.warn('Failed to persist kegiatanMap', e);
    }
  }, [kegiatanMap, activeYear]);

  // Listen to external restore/update events (e.g. from JSON Backup Restore)
  useEffect(() => {
    const handleExternalUpdate = () => {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${activeYear}`);
        if (stored) {
          setKegiatanMap(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Failed to load updated kegiatanMap from storage event', e);
      }
    };

    window.addEventListener('pembuatan_anggaran_updated', handleExternalUpdate);
    window.addEventListener('storage', handleExternalUpdate);
    return () => {
      window.removeEventListener('pembuatan_anggaran_updated', handleExternalUpdate);
      window.removeEventListener('storage', handleExternalUpdate);
    };
  }, [activeYear]);

  // Helper date formatter to Indonesian
  const formatDateToIndonesian = (dateStr: string) => {
    if (!dateStr) return '';
    if (/[a-zA-Z]/.test(dateStr)) return dateStr;
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, monthIndex, day);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  };

  // Convert Indonesian date string like "23 Agustus 2026" to YYYY-MM-DD
  const parseIndonesianDateToISO = (str: string) => {
    if (!str) return new Date().toISOString().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const months: Record<string, string> = {
      'januari': '01', 'februari': '02', 'maret': '03', 'april': '04', 'mei': '05', 'juni': '06',
      'juli': '07', 'agustus': '08', 'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
    };
    const parts = str.trim().split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].replace(/\D/g, '').padStart(2, '0');
      const month = months[parts[1].toLowerCase()] || '01';
      const year = parts[2].replace(/\D/g, '');
      if (day && month && year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  // Form State for Adding / Editing Row
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingKegiatanId, setEditingKegiatanId] = useState<string | null>(null);
  const [formNamaKegiatan, setFormNamaKegiatan] = useState('');
  const [formVolume, setFormVolume] = useState<number | ''>(11);
  const [formSatuan, setFormSatuan] = useState<string>('Bulan');
  const [formNominalSatuan, setFormNominalSatuan] = useState<number | ''>(2500000);
  const [formAnggaran, setFormAnggaran] = useState<number | ''>(27500000);
  const [formPeriode, setFormPeriode] = useState<'Bulanan' | 'Tahunan'>('Tahunan');
  const [formDateValue, setFormDateValue] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [formJadwal, setFormJadwal] = useState('11 Bulan');
  
  // Box Independen (Opsional) & Perhitungan Otomatis
  const [formIsIndependen, setFormIsIndependen] = useState(false);
  const [formFrekuensi, setFormFrekuensi] = useState<string>('11 kali');

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Alert/Notification banner
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Quick activity suggestions based on selected account code
  const activitySuggestions = useMemo(() => {
    if (selectedKode.startsWith('5.1.1')) {
      return [
        'Insentif Keliang Desa',
        'Insentif Penyarikan',
        'Insentif Petajuh',
        'Insentif Juru Raksa',
        'Insentif Admin'
      ];
    }
    if (selectedKode.startsWith('5.1.2')) {
      return [
        'Alat Tulis Kantor (ATK)',
        'Konsumsi Paruman Desa',
        'Paket Internet & Komunikasi',
        'Iuran BPJS Ketenagakerjaan',
        'Penyusunan Awig-awig / Perarem',
        'Penanganan Perkara Adat',
        'Listrik',
        'PDAM'
      ];
    }
    if (selectedKode.startsWith('5.1.4')) {
      return [
        'Insentif Keliang Desa',
        'Insentif Penyarikan',
        'Insentif Petajuh',
        'Insentif Juru Raksa',
        'Insentif Admin',
        'Insentif Penempek',
        'Insentif Istri Penempek',
        'Insentif Serati'
      ];
    }
    if (selectedKode.startsWith('5.2.1') || selectedKode.startsWith('5.2.2')) {
      return [
        'Pecanangan Pura',
        'Dana Aci Pura Puseh',
        'Dana Aci BaleAgung',
        'Dana Aci Melanting',
        'Dana Aci Usabe Dalem',
        'Upakara & Aci Galungan',
        'Upakara & Aci Kuningan',
        'Tawur Kesanga / Nyepi'
      ];
    }
    if (selectedKode.startsWith('5.3.1') || selectedKode.startsWith('5.3.2')) {
      return [
        'Pelatihan Sekaa Truna Truni (STT)',
        'Pelatihan Seni Tari & Tabuh',
        'Pasraman Kilat Remaja Adat',
        'Bantuan Dana Kematian'
      ];
    }
    return [];
  }, [selectedKode]);

  // Available Accounts for the current sub-category
  const availableAccounts = useMemo(() => {
    const list: { code: string; name: string; groupKey: string; groupTitle: string; badgeColor: string }[] = [];
    currentCategoryConfig.groups.forEach(g => {
      const matched = REFERENSI_REKENING.filter(r => r.code.startsWith(g.codePrefix));
      matched.forEach(m => {
        list.push({
          code: m.code,
          name: m.name,
          groupKey: g.groupKey,
          groupTitle: g.groupTitle,
          badgeColor: g.badgeColor
        });
      });
    });
    return list;
  }, [currentCategoryConfig]);

  // Filtered accounts based on search
  const filteredAccounts = useMemo(() => {
    if (!accountSearch.trim()) return availableAccounts;
    const q = accountSearch.toLowerCase();
    return availableAccounts.filter(a => 
      a.code.toLowerCase().includes(q) || 
      a.name.toLowerCase().includes(q) || 
      a.groupTitle.toLowerCase().includes(q)
    );
  }, [availableAccounts, accountSearch]);

  // Ensure selectedKode is within current category when tab changes
  useEffect(() => {
    const exists = availableAccounts.some(a => a.code === selectedKode);
    if (!exists && availableAccounts.length > 0) {
      setSelectedKode(availableAccounts[0].code);
    }
  }, [availableAccounts, selectedKode]);

  // Current Selected Account Info
  const selectedAccountInfo = useMemo(() => {
    const found = availableAccounts.find(a => a.code === selectedKode);
    if (found) return found;
    const globalMatch = REFERENSI_REKENING.find(r => r.code === selectedKode);
    return {
      code: selectedKode,
      name: globalMatch ? globalMatch.name : 'Pos Anggaran Terpilih',
      groupKey: 'general',
      groupTitle: 'Pos Anggaran',
      badgeColor: 'bg-teal-100 text-teal-900 border-teal-300'
    };
  }, [availableAccounts, selectedKode]);

  // Kegiatan list for current selected account
  const currentKegiatanList = useMemo(() => {
    return kegiatanMap[selectedKode] || [];
  }, [kegiatanMap, selectedKode]);

  // Total calculated nominal for current account
  const totalNominalAnggaran = useMemo(() => {
    return currentKegiatanList.reduce((sum, item) => sum + (Number(item.anggaran) || 0), 0);
  }, [currentKegiatanList]);

  // Find corresponding saved BudgetItem in master RAPB
  const currentBudgetItem = useMemo(() => {
    return budgetItems.find(b => b.kode === selectedKode && (!b.tahun || b.tahun === activeYear));
  }, [budgetItems, selectedKode, activeYear]);

  // Check sync status between planned kegiatan total and saved budget item
  const isSyncedWithRapb = useMemo(() => {
    if (!currentBudgetItem) return false;
    return Number(currentBudgetItem.jumlah) === totalNominalAnggaran;
  }, [currentBudgetItem, totalNominalAnggaran]);

  // Codes belonging to the active sub-category
  const categoryAccountCodes = useMemo(() => {
    const set = new Set<string>();
    currentCategoryConfig.groups.forEach(g => {
      REFERENSI_REKENING.filter(r => r.code.startsWith(g.codePrefix)).forEach(r => set.add(r.code));
    });
    return Array.from(set);
  }, [currentCategoryConfig]);

  // Total Pagu from budgetItems for current activeCategory and activeYear
  const totalPaguCategory = useMemo(() => {
    return budgetItems
      .filter(b => (!b.tahun || b.tahun === activeYear) && categoryAccountCodes.includes(b.kode))
      .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);
  }, [budgetItems, activeYear, categoryAccountCodes]);

  // Total Rencana Kegiatan for current activeCategory and activeYear (from kegiatanMap)
  const totalRencanaCategory = useMemo(() => {
    let sum = 0;
    categoryAccountCodes.forEach(code => {
      const list = kegiatanMap[code] || [];
      sum += list.reduce((s, k) => s + (Number(k.anggaran) || 0), 0);
    });
    return sum;
  }, [categoryAccountCodes, kegiatanMap]);

  // Total All Activities Count in Category
  const totalKegiatanCountCategory = useMemo(() => {
    let count = 0;
    categoryAccountCodes.forEach(code => {
      count += (kegiatanMap[code] || []).length;
    });
    return count;
  }, [categoryAccountCodes, kegiatanMap]);

  const paguPosTerpilih = currentBudgetItem ? (Number(currentBudgetItem.jumlah) || 0) : 0;
  const rencanaPosTerpilih = totalNominalAnggaran;
  const selisihPosTerpilih = paguPosTerpilih - rencanaPosTerpilih;

  const selisihCategory = totalPaguCategory - totalRencanaCategory;
  const persentaseCategory = totalPaguCategory > 0 
    ? Math.min(999, Math.round((totalRencanaCategory / totalPaguCategory) * 100))
    : (totalRencanaCategory > 0 ? 100 : 0);

  // Copy from Year Modal State
  const [isCopyYearModalOpen, setIsCopyYearModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState<string>(() => {
    const prevYear = (parseInt(activeYear, 10) - 1).toString();
    return availableYears.includes(prevYear) ? prevYear : availableYears[0];
  });
  const [copyTargetScope, setCopyTargetScope] = useState<'pos' | 'category'>('pos');
  const [autoUpdateYearInSchedule, setAutoUpdateYearInSchedule] = useState<boolean>(true);

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfScope, setPdfScope] = useState<'pos' | 'category'>('pos');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Helper to parse frequency number from manual input (e.g. "2 kali", "2x", "2")
  const parseFrequencyNumber = (val: string | number): number => {
    if (typeof val === 'number') return Math.max(1, val);
    const digits = String(val).replace(/\D/g, '');
    if (!digits) return 1;
    const parsed = parseInt(digits, 10);
    return isNaN(parsed) || parsed <= 0 ? 1 : parsed;
  };

  // Handle open add modal
  const handleOpenAddModal = () => {
    setEditingKegiatanId(null);
    setFormNamaKegiatan('');
    
    // Sensible defaults based on account
    const isInsentifOrRutin = selectedKode.startsWith('5.1.1') || selectedKode.startsWith('5.1.2.04');
    const defaultVol = isInsentifOrRutin ? 11 : 1;
    const defaultSatuan = isInsentifOrRutin ? 'Bulan' : 'Kegiatan';
    const defaultNominal: number | '' = isInsentifOrRutin ? 2500000 : '';
    const defaultTotal: number | '' = (defaultVol && defaultNominal) ? defaultVol * Number(defaultNominal) : '';
    
    setFormVolume(defaultVol);
    setFormSatuan(defaultSatuan);
    setFormNominalSatuan(defaultNominal);
    setFormAnggaran(defaultTotal);

    const now = new Date();
    const currYearStr = now.getFullYear().toString();
    const defaultDate = (activeYear === currYearStr)
      ? now.toISOString().split('T')[0]
      : `${activeYear}-08-17`;
    setFormDateValue(defaultDate);

    if (isInsentifOrRutin) {
      setFormPeriode('Tahunan');
      setFormJadwal(`${defaultVol} Bulan`);
    } else {
      setFormPeriode('Bulanan');
      setFormJadwal(formatDateToIndonesian(defaultDate));
    }

    setFormIsIndependen(false);
    setFormFrekuensi(`${defaultVol} kali`);
    setIsFormModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEditModal = (item: BudgetItemKegiatan) => {
    setEditingKegiatanId(item.id);
    setFormNamaKegiatan(item.namaKegiatan);
    
    const vol = item.volume || (item.frekuensiKali ? item.frekuensiKali : 1);
    const sat = item.satuan || (item.jadwal.toLowerCase().includes('bulan') ? 'Bulan' : 'Kegiatan');
    const nom = item.nominalSatuan !== undefined ? item.nominalSatuan : (vol > 0 ? Math.round(item.anggaran / vol) : item.anggaran);
    
    setFormVolume(vol);
    setFormSatuan(sat);
    setFormNominalSatuan(nom);
    setFormAnggaran(item.anggaran);

    const isTahunan = item.periode === 'Tahunan' || item.jadwal.toLowerCase().includes('bulan') || sat === 'Bulan';
    const detectedPeriode: 'Bulanan' | 'Tahunan' = isTahunan ? 'Tahunan' : 'Bulanan';
    setFormPeriode(detectedPeriode);
    if (detectedPeriode === 'Bulanan') {
      const parsedIso = parseIndonesianDateToISO(item.jadwal);
      setFormDateValue(parsedIso);
      setFormJadwal(item.jadwal || formatDateToIndonesian(parsedIso));
    } else {
      setFormJadwal(item.jadwal || `${vol} ${sat}`);
    }

    setFormIsIndependen(!!item.isIndependen);
    setFormFrekuensi(`${vol} kali`);
    setIsFormModalOpen(true);
  };

  // Handle Volume Change with auto calculation
  const handleVolumeChange = (val: number | '') => {
    setFormVolume(val);
    if (val !== '' && formNominalSatuan !== '') {
      setFormAnggaran(Number(val) * Number(formNominalSatuan));
    } else if (val === '') {
      setFormAnggaran('');
    }
    if (val !== '' && formSatuan) {
      if (formPeriode === 'Tahunan' || formSatuan === 'Bulan') {
        setFormJadwal(`${val} ${formSatuan}`);
      }
    }
  };

  // Handle Satuan Change
  const handleSatuanChange = (val: string) => {
    setFormSatuan(val);
    if (val === 'Bulan') {
      setFormPeriode('Tahunan');
      if (formVolume !== '') {
        setFormJadwal(`${formVolume} Bulan`);
      }
    } else if (formVolume !== '') {
      setFormJadwal(`${formVolume} ${val}`);
    }
  };

  // Handle input manual nominal satuan dengan Rp.
  const handleNominalSatuanChange = (val: number | '') => {
    setFormNominalSatuan(val);
    if (val !== '' && formVolume !== '') {
      setFormAnggaran(Number(formVolume) * Number(val));
    } else if (val === '') {
      setFormAnggaran('');
    }
  };

  // Handle input manual anggaran total
  const handleAnggaranChange = (val: number | '') => {
    setFormAnggaran(val);
    if (val !== '' && formVolume !== '' && Number(formVolume) > 0) {
      setFormNominalSatuan(Math.round(Number(val) / Number(formVolume)));
    }
  };

  // Handle toggle Box Independen (Opsional)
  const handleToggleIndependen = (checked: boolean) => {
    setFormIsIndependen(checked);
  };

  // Handle input manual frekuensi (misal: 1 kali, 2 kali, dst.)
  const handleFrekuensiChange = (val: string) => {
    setFormFrekuensi(val);
    const digits = val.replace(/\D/g, '');
    if (digits) {
      handleVolumeChange(parseInt(digits, 10));
    }
  };

  // Handle Periode Change in Form
  const handlePeriodeChange = (newPeriode: 'Bulanan' | 'Tahunan') => {
    setFormPeriode(newPeriode);
    if (newPeriode === 'Bulanan') {
      const todayIso = formDateValue || new Date().toISOString().split('T')[0];
      setFormDateValue(todayIso);
      setFormJadwal(formatDateToIndonesian(todayIso));
    } else {
      setFormSatuan('Bulan');
      setFormJadwal(`${formVolume || 11} Bulan`);
    }
  };

  // Handle Date Input Change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormDateValue(val);
    setFormJadwal(formatDateToIndonesian(val));
  };

  // Handle save row kegiatan
  const handleSaveKegiatan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaKegiatan.trim()) {
      setFeedback({ message: 'Nama kegiatan / uraian rincian wajib diisi.', type: 'error' });
      return;
    }

    const volNum = Math.max(1, Number(formVolume) || 1);
    const nomNum = formNominalSatuan !== '' ? Number(formNominalSatuan) : 0;
    const finalAnggaran = formAnggaran !== '' ? Number(formAnggaran) : (volNum * nomNum);

    if (finalAnggaran < 0) {
      setFeedback({ message: 'Anggaran tidak boleh bernilai negatif.', type: 'error' });
      return;
    }

    const updatedList = [...(kegiatanMap[selectedKode] || [])];
    const finalJadwal = formPeriode === 'Bulanan' 
      ? (formJadwal || formatDateToIndonesian(formDateValue))
      : (formJadwal || `${volNum} ${formSatuan || 'Bulan'}`);

    const itemData: BudgetItemKegiatan = {
      id: editingKegiatanId || `keg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      namaKegiatan: formNamaKegiatan.trim(),
      periode: formPeriode,
      jadwal: finalJadwal,
      volume: volNum,
      satuan: formSatuan || 'Bulan',
      isIndependen: formIsIndependen,
      frekuensiKali: volNum,
      nominalSatuan: nomNum,
      anggaran: finalAnggaran
    };

    if (editingKegiatanId) {
      const idx = updatedList.findIndex(k => k.id === editingKegiatanId);
      if (idx !== -1) {
        updatedList[idx] = itemData;
      }
      playEditSuccessSound();
      setFeedback({ 
        message: `Rincian kegiatan "${formNamaKegiatan}" berhasil diperbarui. Klik "Simpan ke Pos Anggaran" untuk membukukan ke RAPB.`, 
        type: 'info' 
      });
    } else {
      updatedList.push(itemData);
      playSaveSuccessSound();
      setFeedback({ 
        message: `Rincian kegiatan "${formNamaKegiatan}" (${volNum} ${formSatuan} @ ${formatCurrency(nomNum)}) berhasil ditambahkan. Klik "Simpan ke Pos Anggaran" untuk membukukan ke RAPB.`, 
        type: 'success' 
      });
    }

    setKegiatanMap(prev => ({
      ...prev,
      [selectedKode]: updatedList
    }));

    setIsFormModalOpen(false);
  };

  // Handle open delete confirmation modal
  const handleDeleteKegiatan = (id: string, nama: string) => {
    setDeleteTarget({ id, nama });
    setIsDeleteModalOpen(true);
  };

  // Execute deletion upon confirmation
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const { id, nama } = deleteTarget;
    const updatedList = (kegiatanMap[selectedKode] || []).filter(k => k.id !== id);
    setKegiatanMap(prev => ({
      ...prev,
      [selectedKode]: updatedList
    }));
    playDeleteSuccessSound();
    setFeedback({ 
      message: `Kegiatan "${nama}" berhasil dihapus dari tabel perencanaan. Klik "Simpan ke Pos Anggaran" untuk membukukan perubahan ke RAPB.`, 
      type: 'info' 
    });
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  // Duplikat Satu Kegiatan dalam Pos yang Sama
  const handleDuplicateKegiatan = (item: BudgetItemKegiatan) => {
    const newId = `keg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const duplicated: BudgetItemKegiatan = {
      ...item,
      id: newId,
      namaKegiatan: `${item.namaKegiatan} (Duplikat)`
    };
    const currentList = kegiatanMap[selectedKode] || [];
    const updatedList = [...currentList, duplicated];
    setKegiatanMap(prev => ({
      ...prev,
      [selectedKode]: updatedList
    }));
    playSaveSuccessSound();
    setFeedback({
      message: `Kegiatan "${item.namaKegiatan}" berhasil diduplikasi. Anda dapat langsung mengedit jadwal atau nominalnya.`,
      type: 'success'
    });
  };

  // Eksekusi Duplikat Kegiatan dari Tahun Lain
  const handleExecuteCopyFromYear = () => {
    if (!copySourceYear) return;
    try {
      let sourceMap: Record<string, BudgetItemKegiatan[]> = {};
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${copySourceYear}`);
      if (stored) {
        sourceMap = JSON.parse(stored);
      } else {
        // Fallback reading from budgetItems for that year
        budgetItems.filter(b => b.tahun === copySourceYear).forEach(b => {
          if (b.kegiatanList && b.kegiatanList.length > 0) {
            sourceMap[b.kode] = b.kegiatanList;
          }
        });
      }

      const targetCodes = copyTargetScope === 'pos' ? [selectedKode] : categoryAccountCodes;
      let totalCopied = 0;
      const newKegiatanMap = { ...kegiatanMap };

      targetCodes.forEach(code => {
        const sourceList = sourceMap[code] || [];
        if (sourceList.length > 0) {
          const clonedList: BudgetItemKegiatan[] = sourceList.map(item => {
            let newJadwal = item.jadwal;
            if (autoUpdateYearInSchedule && newJadwal.includes(copySourceYear)) {
              newJadwal = newJadwal.replace(new RegExp(copySourceYear, 'g'), activeYear);
            }
            return {
              ...item,
              id: `keg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              jadwal: newJadwal
            };
          });

          const existing = newKegiatanMap[code] || [];
          newKegiatanMap[code] = [...existing, ...clonedList];
          totalCopied += clonedList.length;
        }
      });

      if (totalCopied === 0) {
        setFeedback({
          message: `Tidak ditemukan rincian kegiatan pada Tahun ${copySourceYear} untuk disalin.`,
          type: 'info'
        });
        setIsCopyYearModalOpen(false);
        return;
      }

      setKegiatanMap(newKegiatanMap);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${activeYear}`, JSON.stringify(newKegiatanMap));
      playSaveSuccessSound();
      setFeedback({
        message: `Berhasil menyalin ${totalCopied} kegiatan dari Tahun ${copySourceYear} ke Tahun ${activeYear}!`,
        type: 'success'
      });
      setIsCopyYearModalOpen(false);
    } catch (err) {
      console.error("Error copy from year", err);
      setFeedback({
        message: 'Gagal menyalin kegiatan dari tahun lain.',
        type: 'error'
      });
    }
  };

  // Export PDF with jsPDF and autoTable
  const handleGeneratePdf = (scope: 'pos' | 'category' = pdfScope) => {
    try {
      setIsGeneratingPdf(true);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      let profile = {
        namaDesa: 'Desa Adat Basangalas',
        alamat: 'Jl. Raya Basangalas, Tribuana, Abang, Karangasem - Bali',
        telepon: '085237025068',
        namaKetua: 'I Made Mudita',
        namaBendahara: 'I Putu Gede Sutrana'
      };
      try {
        const raw = localStorage.getItem('basangalas_profile') || localStorage.getItem('tigalikur_profile');
        if (raw) {
          const parsed = JSON.parse(raw);
          profile = { ...profile, ...parsed };
        }
      } catch (e) {
        console.warn("Could not read profile", e);
      }

      const pageWidth = doc.internal.pageSize.getWidth();

      // KOP SURAT
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(profile.namaDesa.toUpperCase(), pageWidth / 2, 16, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Kecamatan Abang, Kabupaten Karangasem - Bali', pageWidth / 2, 21, { align: 'center' });
      doc.text(`${profile.alamat} | Telp: ${profile.telepon}`, pageWidth / 2, 25.5, { align: 'center' });

      // Border line
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.6);
      doc.line(14, 28, pageWidth - 14, 28);
      doc.setLineWidth(0.2);
      doc.line(14, 29, pageWidth - 14, 29);

      // Document Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(13, 79, 79);
      doc.text('RENCANA KERJA & ANGGARAN KEGIATAN (RAPB)', pageWidth / 2, 36, { align: 'center' });

      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`TAHUN ANGGARAN ${activeYear}`, pageWidth / 2, 41, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Sub-Kategori: ${currentCategoryConfig.label} ${scope === 'pos' ? `| Pos: [${selectedKode}] ${selectedAccountInfo.name}` : ''}`, pageWidth / 2, 46, { align: 'center' });

      // Summary Box
      const targetPagu = scope === 'pos' ? paguPosTerpilih : totalPaguCategory;
      const targetRencana = scope === 'pos' ? totalNominalAnggaran : totalRencanaCategory;
      const targetSelisih = targetPagu - targetRencana;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, 49, pageWidth - 28, 14, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`Total Pagu Tersedia: ${formatCurrency(targetPagu)}`, 18, 54.5);
      doc.text(`Total Rencana Kegiatan: ${formatCurrency(targetRencana)}`, 85, 54.5);

      const selisihLabel = targetSelisih > 0 ? `Sisa Pagu: ${formatCurrency(targetSelisih)}` : targetSelisih === 0 ? 'Pagu Seimbang (100%)' : `Defisit: ${formatCurrency(Math.abs(targetSelisih))}`;
      doc.setTextColor(targetSelisih >= 0 ? 13 : 190, targetSelisih >= 0 ? 110 : 24, targetSelisih >= 0 ? 100 : 24);
      doc.text(`Status: ${selisihLabel}`, 155, 54.5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Terbilang Total Rencana: ${numberToWords(targetRencana)} Rupiah`, 18, 59.5);

      // Rows
      const tableRows: any[] = [];
      let rowNum = 1;

      if (scope === 'pos') {
        currentKegiatanList.forEach((keg) => {
          const detailPerhitungan = keg.isIndependen && keg.frekuensiKali && keg.nominalSatuan
            ? `${keg.frekuensiKali} kali × ${formatCurrency(keg.nominalSatuan)}`
            : '-';
          tableRows.push([
            String(rowNum++),
            selectedKode,
            selectedAccountInfo.name,
            keg.namaKegiatan,
            `${keg.periode || 'Bulanan'} - ${keg.jadwal}`,
            detailPerhitungan,
            formatCurrency(keg.anggaran)
          ]);
        });
      } else {
        availableAccounts.forEach(acc => {
          const list = kegiatanMap[acc.code] || [];
          if (list.length > 0) {
            list.forEach(keg => {
              const detailPerhitungan = keg.isIndependen && keg.frekuensiKali && keg.nominalSatuan
                ? `${keg.frekuensiKali} kali × ${formatCurrency(keg.nominalSatuan)}`
                : '-';
              tableRows.push([
                String(rowNum++),
                acc.code,
                acc.name,
                keg.namaKegiatan,
                `${keg.periode || 'Bulanan'} - ${keg.jadwal}`,
                detailPerhitungan,
                formatCurrency(keg.anggaran)
              ]);
            });
          }
        });
      }

      if (tableRows.length === 0) {
        tableRows.push(['-', '-', '-', 'Belum ada data rencana kegiatan untuk dicetak.', '-', '-', 'Rp 0']);
      }

      autoTable(doc, {
        startY: 66,
        head: [['No', 'Kode', 'Pos Rekening', 'Nama Kegiatan', 'Periode & Jadwal', 'Rincian Perhitungan', 'Anggaran (Rp)']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 60, 60],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center'
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 17, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 42 },
          3: { cellWidth: 45, fontStyle: 'bold' },
          4: { cellWidth: 32 },
          5: { cellWidth: 26, halign: 'center' },
          6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
        },
        foot: [
          [
            { content: 'TOTAL RENCANA KEGIATAN', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: formatCurrency(targetRencana), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 60, 60] } }
          ]
        ]
      });

      let sigY = (doc as any).lastAutoTable.finalY + 12;
      if (sigY > 240) {
        doc.addPage();
        sigY = 25;
      }

      const place = localStorage.getItem('anggaran_customPlace') || 'Basangalas';
      const dateStr = localStorage.getItem('anggaran_signatureDate') || new Date().toISOString().split('T')[0];
      const keliang = localStorage.getItem('anggaran_keliangName') || profile.namaKetua;
      const juruRaksa = localStorage.getItem('anggaran_juruRaksaName') || profile.namaBendahara;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      doc.text('Mengetahui / Menyetujui,', 25, sigY);
      doc.text('Bendesa / Keliang Desa Adat', 25, sigY + 5);

      const dateFormatted = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateStr));
      doc.text(`${place}, ${dateFormatted}`, 135, sigY);
      doc.text('Juru Raksa Desa Adat', 135, sigY + 5);

      doc.setFont('helvetica', 'bold');
      doc.text(`( ${keliang} )`, 25, sigY + 28);
      doc.text(`( ${juruRaksa} )`, 135, sigY + 28);

      const filename = `RENCANA_ANGGARAN_${activeYear}_${scope === 'pos' ? selectedKode.replace(/\./g, '_') : currentCategoryConfig.id.toUpperCase()}.pdf`;
      doc.save(filename);
      setFeedback({
        message: `Dokumen PDF Rencana Anggaran TA ${activeYear} berhasil diunduh.`,
        type: 'success'
      });
      setIsPdfModalOpen(false);
    } catch (error) {
      console.error("Gagal mencetak PDF:", error);
      setFeedback({
        message: 'Gagal membuat dokumen PDF. Silakan coba kembali.',
        type: 'error'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helper to determine budget item category type
  const getItemType = (code: string): BudgetItem['type'] => {
    if (code.startsWith('4.1.1')) return 'pendapatan-adat';
    if (code.startsWith('4.1.3') || code.startsWith('4.1.2')) return 'pendapatan-hibah';
    if (code.startsWith('7')) return 'pendapatan';
    if (code.startsWith('5.1.1')) return 'belanja-rutin-insentif';
    if (code.startsWith('5.1.2') || code.startsWith('5.1.3') || code.startsWith('5.1.4')) return 'belanja-rutin-operasional';
    if (code.startsWith('5.1.5')) return 'belanja-beban-adat';
    if (code.startsWith('5.2.1')) return 'belanja-parhyangan-adat';
    if (code.startsWith('5.2.2')) return 'belanja-program-parhyangan';
    if (code.startsWith('5.3.1')) return 'belanja-program-pawongan';
    if (code.startsWith('5.3.2')) return 'belanja-pawongan-adat';
    if (code.startsWith('5.4')) return 'belanja-program-palemahan';
    return 'belanja-rutin-operasional';
  };

  // SIMPAN KE POS ANGGARAN (Saves total nominal & kegiatan detail to master RAPB)
  const handleSaveToBudget = async () => {
    const list = kegiatanMap[selectedKode] || [];
    const total = totalNominalAnggaran;
    const uraianName = selectedAccountInfo.name;

    // Clean activities list to ensure no undefined values for Firestore
    const cleanList = list.map(k => ({
      id: k.id || `keg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      namaKegiatan: k.namaKegiatan || '',
      periode: k.periode || 'Tahunan',
      jadwal: k.jadwal || '',
      volume: k.volume !== undefined ? Number(k.volume) : (k.frekuensiKali || 1),
      satuan: k.satuan || (k.jadwal.toLowerCase().includes('bulan') ? 'Bulan' : 'Kegiatan'),
      nominalSatuan: k.nominalSatuan !== undefined ? Number(k.nominalSatuan) : 0,
      anggaran: Number(k.anggaran) || 0,
      isIndependen: !!k.isIndependen,
      frekuensiKali: k.frekuensiKali ? Number(k.frekuensiKali) : (k.volume ? Number(k.volume) : 1)
    }));

    let finalVolume = 1;
    let finalSatuan = 'Paket';
    let finalHargaSatuan = total;
    let finalKeterangan = '';

    if (cleanList.length === 1) {
      const single = cleanList[0];
      finalVolume = single.volume || (single.frekuensiKali ? single.frekuensiKali : 1);
      finalSatuan = single.satuan || (single.jadwal.toLowerCase().includes('bulan') ? 'Bulan' : 'Kegiatan');
      finalHargaSatuan = single.nominalSatuan !== undefined && single.nominalSatuan > 0 
        ? single.nominalSatuan 
        : (finalVolume > 0 ? Math.round(single.anggaran / finalVolume) : single.anggaran);
      finalKeterangan = `Rincian: ${single.namaKegiatan}, volume ${finalVolume} ${finalSatuan} (${formatCurrency(finalHargaSatuan)}) pagu anggaran ${formatCurrency(total)}`;
    } else if (cleanList.length > 1) {
      const allSameSatuan = cleanList.every(k => k.satuan === cleanList[0].satuan);
      if (allSameSatuan && cleanList[0].satuan) {
        finalSatuan = cleanList[0].satuan;
        finalVolume = cleanList.reduce((acc, k) => acc + (Number(k.volume) || 1), 0);
        finalHargaSatuan = finalVolume > 0 ? Math.round(total / finalVolume) : 0;
      } else {
        finalVolume = cleanList.length;
        finalSatuan = 'Rincian Kegiatan';
        finalHargaSatuan = Math.round(total / cleanList.length);
      }
      finalKeterangan = `Perencanaan ${cleanList.length} kegiatan: ${cleanList.map(k => `${k.namaKegiatan} (${k.volume} ${k.satuan})`).join(', ')}`.slice(0, 300);
    } else {
      finalKeterangan = `Pagu anggaran ${uraianName}`;
    }

    const targetId = currentBudgetItem ? currentBudgetItem.id : `budget-${selectedKode}-${activeYear}`;

    const newOrUpdatedBudgetItem: BudgetItem = {
      id: targetId,
      kode: selectedKode,
      uraian: uraianName,
      jumlah: total,
      volume: finalVolume,
      satuan: finalSatuan,
      hargaSatuan: finalHargaSatuan,
      keterangan: finalKeterangan,
      tahun: activeYear,
      type: getItemType(selectedKode),
      kegiatanList: cleanList
    };

    try {
      if (currentBudgetItem) {
        if (onUpdateBudgetItem) {
          await onUpdateBudgetItem(newOrUpdatedBudgetItem);
        }
      } else {
        if (onAddBudgetItem) {
          await onAddBudgetItem(newOrUpdatedBudgetItem);
        }
      }

      // Always update local React state immediately for snappy UI
      setBudgetItems(prev => {
        const filtered = prev.filter(i => !(i.id === targetId || (i.kode === selectedKode && (!i.tahun || i.tahun === activeYear))));
        return [...filtered, newOrUpdatedBudgetItem];
      });

      playSaveSuccessSound();
      setFeedback({ 
        message: `Sukses! Pagu Anggaran [${selectedKode}] ${uraianName} (${finalVolume} ${finalSatuan} @ ${formatCurrency(finalHargaSatuan)}) = ${formatCurrency(total)} berhasil disimpan dan disinkronkan ke tabel RAPB Tahun ${activeYear}.`, 
        type: 'success' 
      });
    } catch (err) {
      console.error('Error saving to budget item:', err);
      setFeedback({ message: 'Terjadi kendala saat menyimpan ke database RAPB.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border-2 border-teal-600/50 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none text-teal-400">
          <Landmark size={200} />
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 bg-teal-500/20 text-teal-300 rounded-full border border-teal-500/40 text-[10px] font-black tracking-wider uppercase flex items-center gap-1">
                <Sparkles size={11} /> Modul Perencanaan Anggaran
              </span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/40 text-[10px] font-bold font-mono">
                Tahun Anggaran {activeYear}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-serif tracking-tight flex items-center gap-2">
              Pembuatan Anggaran Kegiatan
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Rancang rincian kegiatan dan jadwal pelaksanaan untuk setiap pos rekening RAPB. Nilai nominal total otomatis dijumlahkan dan dibukukan langsung ke struktur anggaran desa adat.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0 flex-wrap">
            {/* Filter Tahun Quick Selector in Banner */}
            <div className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-teal-500/40 px-3 py-2 rounded-xl text-white shadow-inner transition-colors">
              <Calendar size={15} className="text-teal-400 shrink-0" />
              <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Filter Tahun:</span>
              <select
                value={activeYear}
                onChange={e => handleYearChange(e.target.value)}
                className="bg-slate-900 border border-teal-500/50 text-amber-300 rounded-lg px-2.5 py-1 text-xs font-mono font-black focus:ring-2 focus:ring-teal-400 outline-none cursor-pointer"
                title="Pilih Tahun Anggaran"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white font-mono">
                    Tahun {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Tombol Cetak PDF */}
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white border border-rose-500 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              title="Cetak dan Unduh Dokumen PDF Rencana Anggaran"
            >
              <Printer size={15} />
              <span>Cetak PDF</span>
            </button>

            {onBackToRapb && (
              <button
                type="button"
                onClick={onBackToRapb}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
                title="Buka Tabel Lengkap RAPB"
              >
                <FileSpreadsheet size={15} className="text-teal-400" />
                <span>Lihat Tabel RAPB</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER TAHUN BAR */}
      <div className="bg-white border border-gray-300 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl border border-teal-200 shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-black text-gray-500 tracking-wider flex items-center gap-1.5">
              <span>Filter Tahun Anggaran</span>
              <span className="text-teal-700 font-normal">| Perencanaan &amp; Pembukuan RAPB</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs font-bold text-gray-700">Pilih Tahun:</span>
              <select
                value={activeYear}
                onChange={e => handleYearChange(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-black text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer shadow-xs"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    Tahun Anggaran {y} {y === new Date().getFullYear().toString() ? '(Tahun Berjalan)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-1.5 pl-0 sm:pl-3 sm:border-l sm:border-gray-200 flex-wrap pt-1 sm:pt-0">
            <span className="text-[11px] font-bold text-gray-400 mr-1 hidden sm:inline">Pilihan Cepat:</span>
            {availableYears.map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => handleYearChange(yr)}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeYear === yr
                    ? 'bg-teal-700 text-white shadow-xs scale-105'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Current Filter Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <span className="text-xs font-medium text-gray-500">Status Perencanaan:</span>
          <span className="px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-mono font-black flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>RAPB TA {activeYear}</span>
          </span>
        </div>
      </div>

      {/* RINGKASAN KALKULATOR TOTAL PAGU ANGGARAN & SINKRONISASI KE TABEL RAPB */}
      <div className="bg-white border border-teal-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Kalkulator &amp; Penetapan Pagu RAPB</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-300 font-bold">
                  TA {activeYear}
                </span>
              </h3>
              <p className="text-[11px] text-gray-500">
                Menghitung total pagu dari rincian kegiatan akun untuk langsung dibukukan ke tabel RAPB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold font-mono border flex items-center gap-1.5 shadow-2xs ${
              isSyncedWithRapb
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}>
              {isSyncedWithRapb ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Sparkles size={13} className="text-amber-600" />}
              <span>
                {isSyncedWithRapb ? '✓ Pagu Tersinkron ke RAPB' : 'Perlu Simpan ke Pos Anggaran'}
              </span>
            </span>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Akun Terpilih */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Akun Rekening Terpilih</span>
              <span className="text-teal-700 font-bold text-[10px]">{currentCategoryConfig.badge}</span>
            </div>
            <div className="text-base font-black font-mono text-slate-900 mt-1 truncate" title={selectedAccountInfo.name}>
              [{selectedKode}] {selectedAccountInfo.name}
            </div>
            <div className="text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200 flex items-center justify-between">
              <span>Kelompok Akun:</span>
              <span className="font-semibold text-slate-800">{selectedAccountInfo.groupTitle}</span>
            </div>
          </div>

          {/* Card 2: Total Pagu Terhitung Dari Rincian Kegiatan */}
          <div className="p-4 rounded-xl bg-teal-50/80 border-2 border-teal-300">
            <div className="text-[10px] font-bold text-teal-800 uppercase tracking-wider flex items-center justify-between">
              <span>Total Pagu Terhitung (Rincian)</span>
              <span className="text-teal-900 font-bold text-[10px] font-mono">{currentKegiatanList.length} Rincian Kegiatan</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-teal-950 mt-1">
              {formatCurrency(totalNominalAnggaran)}
            </div>
            <div className="text-[11px] text-teal-800 mt-1.5 pt-1.5 border-t border-teal-200/80 flex items-center justify-between">
              <span>Formula:</span>
              <span className="font-mono font-bold text-teal-950">
                {currentKegiatanList.length > 0 
                  ? `${currentKegiatanList.length} Rincian Kegiatan Dijumlahkan` 
                  : 'Belum ada rincian'}
              </span>
            </div>
          </div>

          {/* Card 3: Status di Master RAPB */}
          <div className={`p-4 rounded-xl border ${
            isSyncedWithRapb 
              ? 'bg-emerald-50/70 border-emerald-200' 
              : 'bg-amber-50/70 border-amber-200'
          }`}>
            <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
              <span className={isSyncedWithRapb ? 'text-emerald-800' : 'text-amber-800'}>
                Pagu Tersimpan di Master RAPB
              </span>
              <span className={`text-[10px] font-mono font-black ${isSyncedWithRapb ? 'text-emerald-900' : 'text-amber-900'}`}>
                {isSyncedWithRapb ? 'SINKRON' : 'DRAFT'}
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
              isSyncedWithRapb ? 'text-emerald-950' : 'text-amber-950'
            }`}>
              {formatCurrency(currentBudgetItem ? currentBudgetItem.jumlah : 0)}
            </div>
            <div className="text-[11px] mt-1.5 pt-1.5 border-t border-gray-200/80 flex items-center justify-between text-gray-700">
              <span>Status:</span>
              <span className={`font-mono font-bold ${isSyncedWithRapb ? 'text-emerald-800' : 'text-amber-800'}`}>
                {isSyncedWithRapb ? '✓ Sesuai dengan Rincian' : 'Klik "Simpan ke Pos Anggaran"'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
            : feedback.type === 'error' 
              ? 'bg-rose-50 text-rose-900 border-rose-300' 
              : 'bg-sky-50 text-sky-900 border-sky-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle size={18} className="text-rose-600 shrink-0" />}
            {feedback.type === 'info' && <AlertCircle size={18} className="text-sky-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button 
            type="button"
            onClick={() => setFeedback(null)} 
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. THREE PRIMARY SUBPAGE TABS (1. Perencanaan RAPB Desa Adat, 2. RAPB Hibah Provinsi, 3. RAPB Hibah Kabupaten) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SUB_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setFeedback(null);
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                isActive 
                  ? 'bg-white border-teal-600 shadow-lg ring-2 ring-teal-500/20' 
                  : 'bg-gray-50/90 border-gray-300 hover:bg-white hover:border-gray-400 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                  isActive ? 'bg-teal-100 text-teal-900 border-teal-300' : 'bg-gray-200 text-gray-700 border-gray-300'
                }`}>
                  {cat.badge}
                </span>
                <ChevronRight size={16} className={isActive ? 'text-teal-600' : 'text-gray-400'} />
              </div>

              <div className={`font-black text-sm ${isActive ? 'text-teal-950' : 'text-gray-800'}`}>
                {cat.label}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                {cat.subLabel}
              </p>
            </button>
          );
        })}
      </div>

      {/* 3. POS ANGGARAN SELECTOR CARD */}
      <div className="bg-white border border-gray-300 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-teal-600" />
              Pilih Pos Anggaran Rekening
            </div>
            <div className="text-sm font-black text-gray-900 mt-0.5">
              Kategori: {currentCategoryConfig.label}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={accountSearch}
              onChange={e => setAccountSearch(e.target.value)}
              placeholder="Cari pos (contoh: Pecanangan, 5.2.1)..."
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            {accountSearch && (
              <button 
                type="button" 
                onClick={() => setAccountSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Account Quick Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {filteredAccounts.map(acc => {
            const isSelected = selectedKode === acc.code;
            const existingItem = budgetItems.find(b => b.kode === acc.code && (!b.tahun || b.tahun === selectedYear));
            const hasLocalKegiatan = (kegiatanMap[acc.code] || []).length > 0;
            return (
              <button
                key={acc.code}
                type="button"
                onClick={() => setSelectedKode(acc.code)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-teal-50/80 border-teal-600 ring-2 ring-teal-500/20 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-teal-400 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-teal-800">
                    {acc.code}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${acc.badgeColor}`}>
                    {acc.groupTitle.split(' ')[1] || 'Pos'}
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-900 truncate" title={acc.name}>
                  {acc.name}
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                  <span>Pagu RAPB:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {existingItem ? formatCurrency(existingItem.jumlah) : (hasLocalKegiatan ? 'Draft' : 'Rp 0')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Account Focused Header */}
        <div className="p-4 bg-gradient-to-r from-teal-50/90 via-sky-50/50 to-white border-2 border-teal-200 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-sm px-2.5 py-0.5 bg-teal-800 text-white rounded-lg shadow-xs">
                {selectedAccountInfo.code}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${selectedAccountInfo.badgeColor}`}>
                {selectedAccountInfo.groupTitle}
              </span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                isSyncedWithRapb 
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {isSyncedWithRapb ? '✓ Pagu RAPB Sinkron' : '⚠ Belum Sinkron ke RAPB'}
              </span>
            </div>
            <h3 className="text-base font-black text-gray-950 mt-1">
              {selectedAccountInfo.name}
            </h3>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-gray-500">Pagu Tersimpan di RAPB</div>
              <div className="text-sm font-black font-mono text-gray-900">
                {currentBudgetItem ? formatCurrency(currentBudgetItem.jumlah) : 'Rp 0'}
              </div>
            </div>
            <div className="w-px h-8 bg-gray-300 hidden md:block" />
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-teal-700">Rencana Nominal Kegiatan</div>
              <div className="text-base font-black font-mono text-teal-900">
                {formatCurrency(totalNominalAnggaran)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TABEL PERENCANAAN KEGIATAN */}
      <div className="bg-white border border-gray-300 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/80">
          <div>
            <h4 className="font-black text-gray-900 text-sm sm:text-base flex items-center gap-2">
              <span>Tabel Perencanaan Kegiatan:</span>
              <span className="text-teal-700 font-mono">[{selectedAccountInfo.code}] {selectedAccountInfo.name}</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Daftar kegiatan, jadwal pelaksanaan, dan alokasi anggaran rincian per pos rekening.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* Duplikat dari Tahun Lain */}
            <button
              type="button"
              onClick={() => setIsCopyYearModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Salin rincian kegiatan dari tahun anggaran sebelumnya atau lainnya"
            >
              <Copy size={14} className="text-amber-700" />
              <span>Duplikat dari Tahun Lain</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Data Baru</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="relative">
          {/* Mobile Scroll Hint Banner */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 bg-teal-50/90 border-b border-teal-200/80 text-[11px] text-teal-900 font-medium">
            <span className="flex items-center gap-1.5 font-semibold">
              <ArrowRightLeft size={13} className="text-teal-700 shrink-0 animate-pulse" />
              Tabel kegiatan dapat digeser ke samping (geser layar)
            </span>
            <span className="text-[10px] text-teal-800 font-bold uppercase tracking-wider bg-teal-200/60 px-2 py-0.5 rounded-full">
              Geser ↔
            </span>
          </div>

          <div 
            className="overflow-x-auto w-full max-w-full touch-pan-x overscroll-x-contain pb-2" 
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-full min-w-[760px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-700 border-b border-gray-300 uppercase tracking-wider text-[11px] font-black">
                  <th className="py-3 px-3 w-12 text-center whitespace-nowrap">No</th>
                  <th className="py-3 px-4 min-w-[190px]">Uraian Rincian Kegiatan</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Volume &amp; Satuan</th>
                  <th className="py-3 px-3 whitespace-nowrap">Jadwal Pelaksanaan</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Harga Satuan (Rp)</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Total Anggaran (Rp)</th>
                  <th className="py-3 px-3 w-28 text-center whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-200">
              {currentKegiatanList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-gray-400">
                    <Calendar size={36} className="mx-auto mb-2 text-gray-300 opacity-60" />
                    <p className="font-bold text-gray-600">Belum ada data rincian kegiatan untuk pos ini.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Klik tombol <strong className="text-teal-700">+ Data Baru</strong> di atas untuk menambah kegiatan pertama.
                    </p>
                  </td>
                </tr>
              ) : (
                currentKegiatanList.map((keg, idx) => {
                  const vol = keg.volume || keg.frekuensiKali || 1;
                  const sat = keg.satuan || (keg.jadwal.toLowerCase().includes('bulan') ? 'Bulan' : 'Kegiatan');
                  const hargaSatuan = keg.nominalSatuan !== undefined && keg.nominalSatuan > 0 
                    ? keg.nominalSatuan 
                    : (vol > 0 ? Math.round(keg.anggaran / vol) : keg.anggaran);

                  return (
                    <tr key={keg.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="py-3.5 px-3 text-center font-bold text-gray-600">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        <div className="text-sm">{keg.namaKegiatan}</div>
                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                          Pos: [{selectedAccountInfo.code}] {selectedAccountInfo.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 text-xs">
                          {vol} {sat}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-gray-700 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                            keg.periode === 'Tahunan' || keg.jadwal.toLowerCase().includes('bulan') || sat === 'Bulan'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-blue-100 text-blue-900 border-blue-300'
                          }`}>
                            {keg.periode || (sat === 'Bulan' ? 'Tahunan' : 'Bulanan')}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-800 rounded-lg text-[11px] font-mono border border-gray-200">
                            <Calendar size={11} className="text-teal-600" />
                            {keg.jadwal}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-gray-800 text-xs whitespace-nowrap font-semibold">
                        {formatCurrency(hargaSatuan)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-teal-950 text-sm whitespace-nowrap">
                        <div>{formatCurrency(keg.anggaran)}</div>
                        <div className="text-[10px] text-gray-500 font-normal">
                          ({vol} {sat} × {formatCurrency(hargaSatuan)})
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateKegiatan(keg)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Duplikat Kegiatan Ini"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(keg)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Kegiatan"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKegiatan(keg.id, keg.namaKegiatan)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Kegiatan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

        {/* 5. SUMMARY ROW & SAVE TO BUDGET ACTION BAR */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white border-t-2 border-teal-600 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-teal-400" />
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                Jumlah Nominal Anggaran: (Menjumlahkan baris 1, 2, 3 dst)
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1 tracking-tight">
              {formatCurrency(totalNominalAnggaran)}
            </div>
            <div className="text-[11px] text-teal-200 italic mt-0.5">
              Terbilang: {numberToWords(totalNominalAnggaran)} Rupiah
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveToBudget}
              className="flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer group"
              title="Simpan total nominal ini ke Pos Anggaran RAPB"
            >
              <Save size={16} className="text-slate-950 group-hover:scale-110 transition-transform" />
              <span>Simpan ke Pos Anggaran</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. MODAL INPUT / EDIT KEGIATAN */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-gray-300 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] my-auto animate-fade-in-up">
            {/* Modal Header (Sticky Top) */}
            <div className="p-4 bg-teal-900 text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-teal-400 shrink-0" />
                <h3 className="font-bold text-sm truncate">
                  {editingKegiatanId ? 'Edit Data Kegiatan' : 'Tambah Data Baru Kegiatan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-800/60 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveKegiatan} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Body Content */}
              <div 
                className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 touch-pan-y overscroll-contain"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 p-2.5 rounded-xl font-bold">
                  Pos: [{selectedAccountInfo.code}] {selectedAccountInfo.name} ({selectedAccountInfo.groupTitle})
                </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nama Kegiatan / Uraian Rincian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNamaKegiatan}
                  onChange={e => setFormNamaKegiatan(e.target.value)}
                  placeholder="Contoh: Insentif Keliang Desa, Insentif Penyarikan, atau Pecanangan Pura"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  autoFocus
                />

                {/* Quick suggestions if available */}
                {activitySuggestions.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Pilihan Cepat Uraian:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activitySuggestions.map(sug => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            setFormNamaKegiatan(sug);
                            if (sug.toLowerCase().includes('insentif')) {
                              setFormSatuan('Bulan');
                              setFormVolume(11);
                              setFormNominalSatuan(2500000);
                              setFormAnggaran(27500000);
                              setFormPeriode('Tahunan');
                              setFormJadwal('11 Bulan');
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium transition-all cursor-pointer ${
                            formNamaKegiatan === sug
                              ? 'bg-teal-700 text-white border-teal-800 shadow-xs'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-200'
                          }`}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Kalkulator Volume, Satuan, dan Jadwal Pelaksanaan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                {/* 1. Volume */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Volume (Jumlah) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formVolume}
                    onChange={e => handleVolumeChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="11"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    {[11, 10, 12, 1, 2, 3, 6].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleVolumeChange(v)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono transition-all cursor-pointer ${
                          formVolume === v
                            ? 'bg-teal-700 text-white'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Satuan */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formSatuan}
                    onChange={e => handleSatuanChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                  >
                    <option value="Bulan">Bulan (Insentif/Gaji)</option>
                    <option value="Kegiatan">Kegiatan</option>
                    <option value="Paket">Paket</option>
                    <option value="Kali">Kali</option>
                    <option value="Orang/Bulan">Orang/Bulan</option>
                    <option value="Hari">Hari</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Contoh: {formVolume || 1} {formSatuan || 'Bulan'}
                  </p>
                </div>

                {/* 3. Jadwal Pelaksanaan */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Jadwal / Durasi <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePeriodeChange(formPeriode === 'Tahunan' ? 'Bulanan' : 'Tahunan')}
                      className="text-[9px] text-teal-700 font-bold hover:underline cursor-pointer"
                    >
                      {formPeriode === 'Tahunan' ? 'Mode Tanggal' : 'Mode Durasi'}
                    </button>
                  </div>

                  {formPeriode === 'Bulanan' ? (
                    <div>
                      <input
                        type="date"
                        required
                        value={formDateValue}
                        onChange={handleDateChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                      />
                      {formJadwal && (
                        <p className="text-[10px] text-teal-800 font-bold mt-1 truncate">
                          📅 {formJadwal}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <select
                        value={formJadwal}
                        onChange={e => setFormJadwal(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer"
                      >
                        <option value="1 Bulan">1 Bulan</option>
                        <option value="2 Bulan">2 Bulan</option>
                        <option value="3 Bulan">3 Bulan</option>
                        <option value="4 Bulan">4 Bulan</option>
                        <option value="5 Bulan">5 Bulan</option>
                        <option value="6 Bulan">6 Bulan</option>
                        <option value="7 Bulan">7 Bulan</option>
                        <option value="8 Bulan">8 Bulan</option>
                        <option value="9 Bulan">9 Bulan</option>
                        <option value="10 Bulan">10 Bulan</option>
                        <option value="11 Bulan">11 Bulan</option>
                        <option value="12 Bulan">12 Bulan</option>
                      </select>
                      <p className="text-[10px] text-amber-800 font-bold mt-1">
                        ⏱ Durasi: {formJadwal || '11 Bulan'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Harga Satuan (Rp) */}
              <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-teal-950">
                    Harga / Nominal Satuan (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                    per {formSatuan || 'Bulan'}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600">
                    Rp.
                  </span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={formNominalSatuan}
                    onChange={e => handleNominalSatuanChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Contoh: 2500000"
                    className="w-full pl-10 pr-3 py-2 border border-teal-300 rounded-xl text-xs font-mono font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>

                {/* Quick nominal buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-gray-500 font-semibold mr-1">Preset Cepat:</span>
                  {[2500000, 2000000, 1500000, 1000000, 750000, 500000].map(nom => (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => handleNominalSatuanChange(nom)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold transition-all cursor-pointer ${
                        Number(formNominalSatuan) === nom
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-white hover:bg-teal-100 text-teal-900 border border-teal-200'
                      }`}
                    >
                      {formatCurrency(nom)}
                    </button>
                  ))}
                </div>

                {formNominalSatuan !== '' && Number(formNominalSatuan) > 0 && (
                  <p className="text-[11px] text-teal-900 italic pt-0.5">
                    Terbilang: {numberToWords(Number(formNominalSatuan))} Rupiah
                  </p>
                )}
              </div>

              {/* Total Pagu Anggaran (Kalkulasi Otomatis) */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-emerald-950">
                    Total Pagu Anggaran Kegiatan (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Formula: Volume × Harga Satuan
                  </span>
                </div>

                {/* Calculation formula banner */}
                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200 flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-gray-700">
                    {formVolume || 1} {formSatuan || 'Bulan'} × {formatCurrency(Number(formNominalSatuan) || 0)}
                  </span>
                  <span className="text-emerald-800 text-sm font-black">
                    = {formatCurrency(formAnggaran !== '' ? Number(formAnggaran) : 0)}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                    Rp.
                  </span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={formAnggaran}
                    onChange={e => handleAnggaranChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Contoh: 27500000"
                    className="w-full pl-10 pr-3 py-2 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                {formAnggaran !== '' && Number(formAnggaran) > 0 && (
                  <p className="text-[11px] font-mono text-emerald-800 font-bold">
                    Terbilang: {numberToWords(Number(formAnggaran))} Rupiah
                  </p>
                )}
              </div>

              </div>

              {/* Modal Footer (Sticky Bottom Action Buttons) */}
              <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2.5 shrink-0 shadow-xs">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>Simpan Kegiatan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Duplikat dari Tahun Lain */}
      {isCopyYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Copy size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">Duplikat Rencana Kegiatan</h3>
                  <p className="text-[11px] text-gray-500">Salin kegiatan berulang dari tahun anggaran lain</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyYearModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  1. Pilih Tahun Sumber (Data Asal):
                </label>
                <select
                  value={copySourceYear}
                  onChange={e => setCopySourceYear(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {availableYears
                    .filter(y => y !== activeYear)
                    .map(y => (
                      <option key={y} value={y}>
                        Tahun Anggaran {y}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Data kegiatan dari tahun ini akan diduplikasi ke <strong className="text-teal-800 font-mono">Tahun {activeYear}</strong>.
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  2. Cakupan Pos Rekening yang Disalin:
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 border rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="copyScope"
                      checked={copyTargetScope === 'pos'}
                      onChange={() => setCopyTargetScope('pos')}
                      className="mt-0.5 accent-teal-600"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Hanya Pos Ini Saja</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        [{selectedAccountInfo.code}] {selectedAccountInfo.name}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 border rounded-xl cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="copyScope"
                      checked={copyTargetScope === 'category'}
                      onChange={() => setCopyTargetScope('category')}
                      className="mt-0.5 accent-teal-600"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Seluruh Pos Kategori Ini</div>
                      <div className="text-[11px] text-gray-500">
                        Menyalin seluruh pos di bawah sub-kategori <strong>{currentCategoryConfig.label}</strong>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUpdateYearInSchedule}
                    onChange={e => setAutoUpdateYearInSchedule(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 accent-amber-600 cursor-pointer"
                  />
                  <span className="font-bold text-amber-900 text-[11px]">
                    Perbarui angka tahun pada kolom jadwal secara otomatis menjadi {activeYear}
                  </span>
                </label>
                <p className="text-[10px] text-amber-700 mt-1 pl-6">
                  Contoh: teks &quot;23 Agustus {copySourceYear}&quot; akan otomatis disesuaikan menjadi &quot;23 Agustus {activeYear}&quot;.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCopyYearModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteCopyFromYear}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Copy size={14} />
                <span>Duplikat Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Dokumen PDF */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-200 space-y-4 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                  <Printer size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">Cetak Rencana Anggaran (PDF)</h3>
                  <p className="text-[11px] text-gray-500">Unduh dokumen resmi rencana kegiatan RAPB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">
                  Pilih Format &amp; Cakupan Laporan PDF:
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-colors ${
                    pdfScope === 'pos' ? 'bg-rose-50/50 border-rose-300' : 'hover:bg-gray-50 border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="pdfScopeRadio"
                      checked={pdfScope === 'pos'}
                      onChange={() => setPdfScope('pos')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Cetak Pos Terpilih Saja</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        [{selectedAccountInfo.code}] {selectedAccountInfo.name} ({currentKegiatanList.length} kegiatan - {formatCurrency(totalNominalAnggaran)})
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 border rounded-xl cursor-pointer transition-colors ${
                    pdfScope === 'category' ? 'bg-rose-50/50 border-rose-300' : 'hover:bg-gray-50 border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="pdfScopeRadio"
                      checked={pdfScope === 'category'}
                      onChange={() => setPdfScope('category')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div>
                      <div className="font-bold text-gray-900">Cetak Rekap Kategori Lengkap</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Seluruh pos rekening pada <strong>{currentCategoryConfig.label}</strong> ({totalKegiatanCountCategory} kegiatan - {formatCurrency(totalRencanaCategory)})
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-slate-600 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>Tahun Anggaran:</span>
                  <span className="font-mono font-bold text-slate-900">TA {activeYear}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tata Letak:</span>
                  <span className="font-bold text-slate-900">Potret (A4) dengan Kop &amp; Tanda Tangan</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={() => handleGeneratePdf(pdfScope)}
                className="px-5 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download size={14} />
                <span>{isGeneratingPdf ? 'Memproses PDF...' : 'Unduh Dokumen PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Kegiatan */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Rincian Kegiatan"
        message={`Apakah Anda yakin ingin menghapus kegiatan "${deleteTarget?.nama || ''}" dari tabel perencanaan anggaran ini?`}
      />
    </div>
  );
};

export default PembuatanAnggaranView;
