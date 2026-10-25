import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Download, 
  Upload, 
  Users, 
  BellRing, 
  Database,
  FileSpreadsheet,
  FileUp,
  FileDown,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  Lock,
  Trash2,
  Plus,
  Cloud,
  HardDrive,
  Clock,
  CalendarCheck,
  RotateCcw,
  Sparkles,
  PenTool,
  FileSignature,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Stamp,
  Filter,
  FileCheck
} from 'lucide-react';
import Notification from '../components/shared/Notification';
import DigitalSignaturePadModal from '../components/shared/DigitalSignaturePadModal';
import {
  download7ModulesXLSX,
  downloadSingleModuleXLSX,
  downloadModuleTemplateXLSX,
  parseExcelFile,
  Export7ModulesData
} from '../utils/excelExportHelper';
import {
  getStoredSignatures,
  saveStoredSignatures,
  getSignatureSettings,
  saveSignatureSettings,
  getSignatureScale,
  setSignatureScale,
  generateDefaultDesaStamp,
  getEffectiveStamp,
  isStampOverlayEnabled,
  setStampOverlayEnabled,
  getStampScale,
  setStampScale,
  type DigitalSignatures,
  type SignatureSettings
} from '../utils/signatureStorage';
import { soundEffects, playSaveSuccessSound } from '../utils/soundEffects';
import { useNotification } from '../context/NotificationContext';
import { getGeminiApiKey, setCustomGeminiApiKey, testGeminiConnection, maskApiKey, GEMINI_MODEL_TEXT } from '../utils/geminiClient';
import { collectAllPagesBackupData, restoreAllPagesDataFromJSON, countTotalKegiatan } from '../utils/backupHelper';
import type { 
  BkuData, 
  BkpData, 
  JuDisplayRow, 
  PeminjamData, 
  SetoranData, 
  ReconciliationHistoryEntry,
  BudgetItem,
  PepesonItem,
  DanaPuniaItem,
  UrunanItem,
  ManualBudgetCaps,
  AutoBackupConfig,
  BackupHistoryItem
} from '../types';
import { auth, db } from '../firebase';
// @ts-ignore
import { doc, setDoc, getDocs, collection, writeBatch, deleteDoc } from 'firebase/firestore';
import {
  getAutoBackupConfig,
  saveAutoBackupConfig,
  getStoredBackupHistory,
  getSnapshotsFromIndexedDB,
  runDailyAutoBackup,
  downloadSnapshotAsFile,
  getFullPayloadFromSnapshot,
  deleteSnapshotFromIndexedDB,
  saveStoredBackupHistory
} from '../services/autoBackupService';
import UserLogView from '../components/settings/UserLogView';

interface PengaturanProps {
  bkuData?: BkuData[];
  bkpData?: BkpData[];
  juData?: JuDisplayRow[];
  budgetItems?: BudgetItem[];
  pepesonItems?: PepesonItem[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
  manualBudgetCaps?: ManualBudgetCaps;
  penyetoranPajak?: number;
  peminjamData?: PeminjamData[];
  setoranData?: SetoranData[];
  reconciliationHistory?: ReconciliationHistoryEntry[];
  printYear?: string;
  setPrintYear?: (year: string) => void;
  onRestoreData?: (file: File) => Promise<void> | void;
  onResetAllData?: () => Promise<void>;
}

export const Pengaturan: React.FC<PengaturanProps> = ({
  bkuData = [],
  bkpData = [],
  juData = [],
  budgetItems = [],
  pepesonItems = [],
  danaPuniaItems = [],
  urunanItems = [],
  manualBudgetCaps,
  penyetoranPajak = 0,
  peminjamData = [],
  setoranData = [],
  reconciliationHistory = [],
  printYear = '2026',
  setPrintYear = (_year: string) => {},
  onRestoreData,
  onResetAllData,
}) => {
  const { showPermissionDenied } = useNotification();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Active Menu Tab: 'system' (Pengaturan Sistem) | 'user_logs' (Log User)
  const [settingActiveMenu, setSettingActiveMenu] = useState<'system' | 'user_logs'>('system');

  const addNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setNotification({ message, type });
  };

  // Profile Form States
  const [namaDesa, setNamaDesa] = useState('Desa Adat Basangalas');
  const [alamat, setAlamat] = useState('Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali');
  const [telepon, setTelepon] = useState('085237025068');
  const [namaKetua, setNamaKetua] = useState('I Made Mudita');
  const [namaBendahara, setNamaBendahara] = useState('I Putu Gede Sutrana');
  const [emailPengawas, setEmailPengawas] = useState('Basangalasjururaksa@gmail.com');
  const [modalAwal, setModalAwal] = useState<number>(0);
  const [tanggalTtd, setTanggalTtd] = useState('');

  // Verification modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Custom confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'clear_demo' | 'clear_all' | 'load_demo' | 'execute_import' | 'restore_snapshot' | null;
    title: string;
    description: string;
    requireTextMatch?: boolean;
    matchText?: string;
    inputText?: string;
  }>({
    isOpen: false,
    type: null,
    title: '',
    description: '',
    requireTextMatch: false,
    matchText: '',
    inputText: ''
  });

  const pendingSnapshotToRestore = useRef<BackupHistoryItem | null>(null);

  // Auto Backup System States
  const [autoBackupConfig, setAutoBackupConfig] = useState<AutoBackupConfig>(() => getAutoBackupConfig());
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Load snapshot history
  useEffect(() => {
    const loadHistory = async () => {
      const storedMeta = getStoredBackupHistory();
      try {
        const indexedDbSnapshots = await getSnapshotsFromIndexedDB();
        const map = new Map<string, BackupHistoryItem>();
        indexedDbSnapshots.forEach(item => map.set(item.id, item));
        storedMeta.forEach(item => {
          if (!map.has(item.id)) map.set(item.id, item);
        });
        const combined = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        setBackupHistory(combined);
      } catch (err) {
        setBackupHistory(storedMeta);
      }
    };
    loadHistory();
  }, []);

  const handleUpdateAutoBackupConfig = (updates: Partial<AutoBackupConfig>) => {
    const updated = saveAutoBackupConfig(updates);
    setAutoBackupConfig(updated);
    addNotification('Pengaturan jadwal backup otomatis berhasil diperbarui.', 'success');
  };

  const handleTriggerManualBackupNow = async () => {
    setIsBackingUpNow(true);
    try {
      const res = await runDailyAutoBackup({
        userId: auth?.currentUser?.uid,
        source: {
          bkuData,
          bkpData,
          juData,
          budgetItems,
          pepesonItems,
          danaPuniaItems,
          urunanItems,
          manualBudgetCaps,
          penyetoranPajak,
          profile: {
            namaDesa,
            alamat,
            telepon,
            namaKetua,
            namaBendahara,
            emailPengawas,
            modalAwal,
            tanggalTtd,
            printYear
          },
          peminjamData,
          setoranData,
          reconciliationHistory
        },
        force: true
      });

      if (res.executed && res.item) {
        setBackupHistory(prev => [res.item!, ...prev.filter(p => p.id !== res.item!.id)]);
        setAutoBackupConfig(getAutoBackupConfig());
        addNotification(`Cadangan baru berhasil dibuat! (${res.message})`, 'success');
      } else {
        addNotification(res.message, 'info');
      }
    } catch (err: any) {
      addNotification(`Gagal membuat cadangan: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsBackingUpNow(false);
    }
  };

  const handleDownloadSnapshotItem = async (item: BackupHistoryItem) => {
    const ok = await downloadSnapshotAsFile(item);
    if (ok) {
      addNotification(`File cadangan ${item.dateKey} berhasil diunduh.`, 'success');
    } else {
      addNotification(`Gagal mengunduh file cadangan ${item.dateKey}.`, 'error');
    }
  };

  const handleRestoreFromSnapshotItem = (item: BackupHistoryItem) => {
    if (!onRestoreData) {
      showPermissionDenied();
      return;
    }
    pendingSnapshotToRestore.current = item;
    setConfirmModal({
      isOpen: true,
      type: 'restore_snapshot',
      title: `Pulihkan Data dari Cadangan (${item.formattedDate})`,
      description: `PERINGATAN: Tindakan ini akan menimpa data pembukuan saat ini dengan data dari cadangan tanggal ${item.formattedDate}. Ketik "PULIHKAN" untuk konfirmasi.`,
      requireTextMatch: true,
      matchText: 'PULIHKAN',
      inputText: ''
    });
  };

  const handleDeleteSnapshotItem = async (id: string) => {
    try {
      await deleteSnapshotFromIndexedDB(id);
      const updated = backupHistory.filter(h => h.id !== id);
      setBackupHistory(updated);
      saveStoredBackupHistory(updated);
      addNotification('Cadangan berhasil dihapus dari riwayat.', 'success');
    } catch (err) {
      addNotification('Gagal menghapus cadangan.', 'error');
    }
  };


  // Users role management state
  const [users, setUsers] = useState([
    { id: '1', username: 'keliang_adat', role: 'Ketua / Pengawas', active: true },
    { id: '2', username: 'juru_raksa', role: 'Bendahara / Juru Raksa', active: true },
    { id: '3', username: 'pengayah_audit', role: 'Petugas Kolektor', active: true },
  ]);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('Petugas Kolektor');

  // App preferences
  const [soundEnabled, setSoundEnabled] = useState(() => soundEffects.isEnabled());
  const [waAutoSend, setWaAutoSend] = useState(true);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    soundEffects.setEnabled(enabled);
    if (enabled) {
      playSaveSuccessSound();
      addNotification('Efek suara diaktifkan.', 'info');
    } else {
      addNotification('Efek suara dinonaktifkan.', 'info');
    }
  };

  // --- EXCEL & CSV IMPORT/EXPORT SYSTEM STATES ---
  const [excelTab, setExcelTab] = useState<'export' | 'import'>('export');
  const [csvDelimiter, setCsvDelimiter] = useState<';' | ','>(';');
  const [importTarget, setImportTarget] = useState<'bku' | 'bkp' | 'anggaran' | 'dana_punia' | 'urunan' | 'jurnal' | 'pepeson'>('bku');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [exportYearFilter, setExportYearFilter] = useState<'all' | string>('all');
  
  // Available years computed from loaded records
  const availableExportYears = React.useMemo(() => {
    const years = new Set<string>();
    if (printYear) years.add(String(printYear));
    bkuData.forEach(b => {
      if (b.tanggal) {
        const y = b.tanggal.split('-')[0];
        if (y && y.length === 4) years.add(y);
      }
    });
    bkpData.forEach(b => {
      if (b.tanggal) {
        const y = b.tanggal.split('-')[0];
        if (y && y.length === 4) years.add(y);
      }
    });
    juData.forEach(j => {
      if (j.date) {
        const y = j.date.split('-')[0];
        if (y && y.length === 4) years.add(y);
      }
    });
    budgetItems.forEach(b => {
      if (b.tahun) years.add(String(b.tahun));
    });
    danaPuniaItems.forEach(d => {
      if (d.date) {
        const y = d.date.split('-')[0];
        if (y && y.length === 4) years.add(y);
      }
    });
    urunanItems.forEach(u => {
      if (u.date) {
        const y = u.date.split('-')[0];
        if (y && y.length === 4) years.add(y);
      }
    });
    return Array.from(years).sort().reverse();
  }, [bkuData, bkpData, juData, budgetItems, danaPuniaItems, urunanItems, printYear]);

  const formatRp = (n: number) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

  const filteredModuleStats = React.useMemo(() => {
    const isMatch = (dateStr?: string, yearNum?: number) => {
      if (exportYearFilter === 'all') return true;
      if (yearNum && String(yearNum) === exportYearFilter) return true;
      if (dateStr && dateStr.startsWith(exportYearFilter)) return true;
      return false;
    };

    const bku = bkuData.filter(b => isMatch(b.tanggal));
    const bkp = bkpData.filter(b => isMatch(b.tanggal));
    const anggaran = budgetItems.filter(b => isMatch(undefined, b.tahun));
    const punia = danaPuniaItems.filter(d => isMatch(d.date || (d as any).tanggal));
    const urunan = urunanItems.filter(u => isMatch(u.date || (u as any).tanggal));
    const jurnal = juData.filter(j => isMatch(j.date || (j as any).tanggal));
    const pepeson = pepesonItems;

    return {
      bkuCount: bku.length,
      bkuSaldo: bku.length > 0 ? (bku[bku.length - 1].saldo || 0) : 0,
      bkpCount: bkp.length,
      bkpTotal: bkp.reduce((s, i) => s + (Number(i.kredit) || 0), 0),
      anggaranCount: anggaran.length,
      anggaranTotal: anggaran.reduce((s, i) => s + (Number(i.jumlah) || 0), 0),
      puniaCount: punia.length,
      puniaTotal: punia.reduce((s, i) => s + (Number(i.total || i.jumlah) || 0), 0),
      urunanCount: urunan.length,
      urunanTotal: urunan.reduce((s, i) => s + (Number(i.total || i.jumlah) || 0), 0),
      jurnalCount: jurnal.length,
      jurnalTotal: jurnal.reduce((s, i) => s + (Number(i.debet) || 0), 0),
      pepesonCount: pepeson.length,
      pepesonTotal: pepeson.reduce((s, i) => s + (Number(i.total) || 0), 0),
      totalRows: bku.length + bkp.length + anggaran.length + punia.length + urunan.length + jurnal.length + pepeson.length
    };
  }, [bkuData, bkpData, budgetItems, danaPuniaItems, urunanItems, juData, pepesonItems, exportYearFilter]);
  
  // Parsed File Preview State
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [validatedData, setValidatedData] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const restoreJsonInputRef = useRef<HTMLInputElement>(null);

  // Digital Signatures State
  const [digitalSignatures, setDigitalSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [signatureSettings, setSignatureSettings] = useState<SignatureSettings>(() => getSignatureSettings());
  const [signatureModalConfig, setSignatureModalConfig] = useState<{
    isOpen: boolean;
    role: 'keliang' | 'juruRaksa' | 'pembuat' | 'penyetor' | 'stempel';
    title: string;
    roleName: string;
    initialSignature?: string;
  }>({
    isOpen: false,
    role: 'keliang',
    title: '',
    roleName: ''
  });

  // Gemini AI Settings & Testing State
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>(() => getGeminiApiKey());
  const [showFullApiKey, setShowFullApiKey] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    success: boolean;
    message: string;
    response?: string;
    latencyMs?: number;
  } | null>(null);

  const handleTestGeminiKey = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);
    addNotification(`Menguji koneksi ke Gemini API (${GEMINI_MODEL_TEXT})...`, 'info');
    try {
      const res = await testGeminiConnection(geminiKeyInput);
      setGeminiTestResult({
        success: res.success,
        message: res.message,
        response: res.response,
        latencyMs: res.latencyMs
      });
      if (res.success) {
        addNotification(`Koneksi Gemini AI Berhasil! Latensi: ${res.latencyMs}ms.`, 'success');
      } else {
        addNotification(`Koneksi Gemini AI Gagal: ${res.message}`, 'error');
      }
    } catch (e: any) {
      setGeminiTestResult({
        success: false,
        message: e?.message || 'Gagal terhubung ke Gemini API'
      });
      addNotification(`Koneksi Gemini AI Gagal: ${e?.message || 'Error'}`, 'error');
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSaveGeminiKey = () => {
    setCustomGeminiApiKey(geminiKeyInput);
    addNotification('API Key Gemini berhasil disimpan!', 'success');
  };

  const handleResetGeminiKey = () => {
    setCustomGeminiApiKey('');
    setGeminiKeyInput(getGeminiApiKey());
    addNotification('API Key tersimpan dihapus. Konfigurasi environment akan digunakan jika tersedia.', 'info');
  };

  // Listen to signature storage updates
  useEffect(() => {
    const handleSignaturesChanged = () => {
      setDigitalSignatures(getStoredSignatures());
      setSignatureSettings(getSignatureSettings());
    };
    window.addEventListener('signatures-updated', handleSignaturesChanged);
    return () => window.removeEventListener('signatures-updated', handleSignaturesChanged);
  }, []);

  const handleOpenSignatureModal = (role: 'keliang' | 'juruRaksa' | 'pembuat' | 'penyetor' | 'stempel', roleName: string) => {
    const roleTitles: Record<string, string> = {
      keliang: 'Tanda Tangan Keliang Adat (Ketua / Mengetahui)',
      juruRaksa: 'Tanda Tangan Juru Raksa (Bendahara / Penerima)',
      pembuat: 'Tanda Tangan Petugas Pembuat Dokumen',
      penyetor: 'Tanda Tangan Penyetor / Petugas Kolektor',
      stempel: 'Stempel Resmi Desa Adat (Cap Basah)'
    };
    setSignatureModalConfig({
      isOpen: true,
      role,
      title: roleTitles[role] || 'Tanda Tangan / Stempel Digital',
      roleName: roleName || (role === 'keliang' ? namaKetua : role === 'juruRaksa' ? namaBendahara : role === 'stempel' ? (namaDesa || 'DESA ADAT BASANGALAS') : 'Petugas Desa'),
      initialSignature: digitalSignatures[role]
    });
  };

  const handleSaveSignatureResult = (dataUrl: string) => {
    const role = signatureModalConfig.role;
    const updated = {
      ...digitalSignatures,
      [role]: dataUrl
    };
    saveStoredSignatures(updated);
    setDigitalSignatures(updated);
    setSignatureModalConfig(prev => ({ ...prev, isOpen: false }));
    addNotification(`${role === 'stempel' ? 'Stempel resmi' : 'Tanda tangan ' + (signatureModalConfig.roleName || role)} berhasil disimpan & siap digunakan!`, 'success');
  };

  const handleDeleteSignatureRole = (role: keyof DigitalSignatures, label: string) => {
    const updated = {
      ...digitalSignatures,
      [role]: undefined
    };
    saveStoredSignatures(updated);
    setDigitalSignatures(updated);
    addNotification(`${role === 'stempel' ? 'Stempel kustom' : 'Tanda tangan digital ' + label} telah dihapus. ${role === 'stempel' ? 'Sistem akan menggunakan stempel standar resmi Desa Adat.' : ''}`, 'info');
  };

  const handleGenerateStandardStamp = () => {
    const defaultStamp = generateDefaultDesaStamp(namaDesa || 'DESA ADAT BASANGALAS');
    const updated = {
      ...digitalSignatures,
      stempel: defaultStamp
    };
    saveStoredSignatures(updated);
    setDigitalSignatures(updated);
    addNotification('Stempel resmi standar Desa Adat Basangalas berhasil dibuat & diaktifkan.', 'success');
  };

  const handleToggleAutoEmbedSignatures = (enabled: boolean) => {
    const updated = saveSignatureSettings({ autoEmbed: enabled });
    setSignatureSettings(updated);
    addNotification(
      enabled 
        ? 'Tanda tangan digital akan otomatis disematkan saat mencetak Kwitansi & Nota Belanja.'
        : 'Penyematan tanda tangan digital otomatis dinonaktifkan.',
      'info'
    );
  };

  const handleToggleStampOverlay = (enabled: boolean) => {
    const updated = setStampOverlayEnabled(enabled);
    setSignatureSettings(updated);
    addNotification(
      enabled 
        ? 'Stempel resmi Desa Adat akan otomatis tampil di atas tanda tangan Keliang Adat.'
        : 'Penampilan stempel resmi dinonaktifkan.',
      'info'
    );
  };

  const handleUpdateGlobalScale = (newScale: number) => {
    const clamped = Math.max(50, Math.min(180, Math.round(newScale)));
    const updated = setSignatureScale(clamped);
    setSignatureSettings(updated);
  };

  const handleUpdateStampScale = (newScale: number) => {
    const clamped = Math.max(50, Math.min(180, Math.round(newScale)));
    const updated = setStampScale(clamped);
    setSignatureSettings(updated);
  };

  const handleDownloadSignaturePNG = (role: keyof DigitalSignatures, signerName: string) => {
    const dataUrl = digitalSignatures[role] || (role === 'stempel' ? generateDefaultDesaStamp(namaDesa || 'DESA ADAT BASANGALAS') : undefined);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${role === 'stempel' ? 'STEMPEL' : 'TTD'}_${role}_${(signerName || 'Desa_Basangalas').replace(/\s+/g, '_')}.png`;
    link.click();
    addNotification(`Berkas gambar ${role === 'stempel' ? 'stempel' : 'tanda tangan ' + signerName} berhasil diunduh.`, 'success');
  };

  // Load profile from localStorage / Firestore
  useEffect(() => {
    const savedProfile = localStorage.getItem('basangalas_profile') || localStorage.getItem('tigalikur_profile');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.namaDesa) setNamaDesa(parsed.namaDesa);
        if (parsed.alamat) setAlamat(parsed.alamat);
        if (parsed.telepon) {
          setTelepon(parsed.telepon === '081234567890' ? '085237025068' : parsed.telepon);
        }
        if (parsed.namaKetua) {
          setNamaKetua(parsed.namaKetua === 'I Made Jeromangku' ? 'I Made Mudita' : parsed.namaKetua);
        }
        if (parsed.namaBendahara) {
          setNamaBendahara(parsed.namaBendahara === 'I Wayan Juru Raksa' ? 'I Putu Gede Sutrana' : parsed.namaBendahara);
        }
        if (parsed.emailPengawas) {
          setEmailPengawas(parsed.emailPengawas === 'pengawas@basangalas.desa.id' ? 'Basangalasjururaksa@gmail.com' : parsed.emailPengawas);
        }
        if (parsed.modalAwal !== undefined) {
          setModalAwal(parsed.modalAwal === 500000000 ? 0 : parsed.modalAwal);
        }
        if (parsed.tanggalTtd) setTanggalTtd(parsed.tanggalTtd);
      } catch (e) {
        console.error('Error loading local profile:', e);
      }
    }
  }, []);

  const handleSaveProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPasswordModal(true);
  };

  const handleConfirmSaveProfile = () => {
    setShowPasswordModal(false);
    const profileData = {
      namaDesa,
      alamat,
      telepon,
      namaKetua,
      namaBendahara,
      emailPengawas,
      modalAwal,
      tanggalTtd,
      printYear
    };
    localStorage.setItem('basangalas_profile', JSON.stringify(profileData));
    localStorage.setItem('tigalikur_profile', JSON.stringify(profileData));
    addNotification('Konfirmasi berhasil! Identitas Desa Adat & Pengaturan Laporan telah disimpan.', 'success');
  };

  // BACKUP FUNCTIONALITY: Generate a complete JSON backup of all pages and sub-pages
  const handleDownloadBackup = () => {
    try {
      const backupData = collectAllPagesBackupData({
        bkuData,
        bkpData,
        juData,
        budgetItems,
        pepesonItems,
        danaPuniaItems,
        urunanItems,
        settings: {
          penyetoranPajak,
          manualBudgetCaps
        },
        profile: { namaDesa, alamat, telepon, namaKetua, namaBendahara, emailPengawas, modalAwal, tanggalTtd, printYear },
        peminjamData,
        setoranData,
        reconciliationHistory
      });

      const backupString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `KAS_DESA_ADAT_BACKUP_${namaDesa.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      const totalKegiatan = countTotalKegiatan(backupData.pembuatan_anggaran_kegiatan);
      const pageConfigCount = Object.keys(backupData.page_signatures_and_settings || {}).length;

      addNotification(
        `Backup JSON Seluruh Halaman berhasil diunduh! (${budgetItems.length} Anggaran Kas, ${totalKegiatan} Rincian Kegiatan Pembuatan Anggaran, ${danaPuniaItems.length} Dana Punia Semua Sub-Page, ${bkuData.length} BKU, ${bkpData.length} BKP, ${juData.length} Jurnal Umum, serta ${pageConfigCount} Pengaturan Halaman).`, 
        'success'
      );
    } catch (e: any) {
      console.error("Backup JSON Error in Pengaturan:", e);
      addNotification("Gagal membuat backup JSON: " + (e?.message || "Kesalahan struktur"), "error");
    }
  };

  // RESTORE FUNCTIONALITY: Read JSON and update states
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onRestoreData) {
      try {
        await onRestoreData(file);
        // Also parse profile and digitalSignatures to update local fields immediately
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const data = JSON.parse(content);
            if (data.profile) {
              if (data.profile.namaDesa) setNamaDesa(data.profile.namaDesa);
              if (data.profile.alamat) setAlamat(data.profile.alamat);
              if (data.profile.telepon) setTelepon(data.profile.telepon);
              if (data.profile.namaKetua) setNamaKetua(data.profile.namaKetua);
              if (data.profile.namaBendahara) setNamaBendahara(data.profile.namaBendahara);
              if (data.profile.emailPengawas) setEmailPengawas(data.profile.emailPengawas);
              if (data.profile.modalAwal) setModalAwal(data.profile.modalAwal);
              if (data.profile.tanggalTtd) setTanggalTtd(data.profile.tanggalTtd);
            }
            if (data.digitalSignatures) {
              saveStoredSignatures(data.digitalSignatures);
              setDigitalSignatures(data.digitalSignatures);
            }
            if (data.signatureSettings) {
              saveSignatureSettings(data.signatureSettings);
              setSignatureSettings(data.signatureSettings);
            }
          } catch (err) {
            console.warn("Could not parse profile from backup:", err);
          }
        };
        reader.readAsText(file);
      } catch (err: any) {
        addNotification(`Gagal memulihkan backup JSON: ${err?.message || 'Format tidak valid'}`, 'error');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          if (data.profile) {
            localStorage.setItem('basangalas_profile', JSON.stringify(data.profile));
            localStorage.setItem('tigalikur_profile', JSON.stringify(data.profile));
            if (data.profile.namaDesa) setNamaDesa(data.profile.namaDesa);
            if (data.profile.alamat) setAlamat(data.profile.alamat);
            if (data.profile.telepon) setTelepon(data.profile.telepon);
            if (data.profile.namaKetua) setNamaKetua(data.profile.namaKetua);
            if (data.profile.namaBendahara) setNamaBendahara(data.profile.namaBendahara);
            if (data.profile.emailPengawas) setEmailPengawas(data.profile.emailPengawas);
            if (data.profile.modalAwal) setModalAwal(data.profile.modalAwal);
            if (data.profile.tanggalTtd) setTanggalTtd(data.profile.tanggalTtd);
          }
          if (data.digitalSignatures) {
            saveStoredSignatures(data.digitalSignatures);
            setDigitalSignatures(data.digitalSignatures);
          }
          if (data.signatureSettings) {
            saveSignatureSettings(data.signatureSettings);
            setSignatureSettings(data.signatureSettings);
          }
          addNotification('Restorasi profil berhasil dari file JSON.', 'success');
        } catch (err) {
          addNotification('Gagal membaca file JSON backup. Pastikan file terformat JSON dengan benar.', 'error');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const newUser = {
      id: Date.now().toString(),
      username: newUsername.toLowerCase().trim(),
      role: newRole,
      active: true,
    };
    setUsers([...users, newUser]);
    setNewUsername('');
    addNotification(`Otoritas pengguna @${newUser.username} (${newUser.role}) berhasil ditambahkan!`, 'success');
  };

  const handleDeleteUser = (id: string, username: string) => {
    setUsers(users.filter((u) => u.id !== id));
    addNotification(`Akses otorisasi pengguna @${username} berhasil dicabut!`, 'success');
  };

  const executeConfirmedAction = async () => {
    const { type, requireTextMatch, matchText, inputText } = confirmModal;
    if (requireTextMatch && matchText && (inputText || '').trim() !== matchText) {
      addNotification("Peringatan: Teks konfirmasi tidak sesuai. Tindakan dibatalkan.", "warning");
      return;
    }

    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    if (type === 'clear_demo') {
      localStorage.setItem('use_real_data', 'true');
      addNotification("Data contoh dibersihkan. Memuat ulang sistem dalam mode data riil...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else if (type === 'clear_all') {
      addNotification("Memulai proses pembersihan data cloud & lokal...", "info");
      if (onResetAllData) {
        await onResetAllData();
      }
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else if (type === 'load_demo') {
      localStorage.removeItem('use_real_data');
      addNotification("Memuat ulang data simulasi/demo...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else if (type === 'execute_import') {
      (async () => {
        try {
          const cleanNumber = (val: any) => {
            if (typeof val === 'number') return val;
            const cleaned = String(val || '0').replace(/[^0-9.-]+/g, '');
            return Number(cleaned) || 0;
          };

          const target = importTarget;
          const now = Date.now();
          const importedItems: any[] = [];

          validatedData.forEach((row, idx) => {
            if (!row || row.length === 0 || (row.length === 1 && !row[0])) return;
            
            if (target === 'bku') {
              const bkuItem: BkuData = {
                id: `bku-imp-${now}-${idx}`,
                tanggal: row[1] || new Date().toISOString().split('T')[0],
                kode: row[2] || '1.1.1.01',
                uraian: row[3] || 'Transaksi BKU',
                kategori: row[4] || 'Kas',
                penerimaan: cleanNumber(row[5]),
                pengeluaran: cleanNumber(row[6]),
                saldo: cleanNumber(row[7]),
                createdAt: now + idx
              };
              importedItems.push(bkuItem);
            } else if (target === 'bkp') {
              const bkpItem: BkpData = {
                id: `bkp-imp-${now}-${idx}`,
                tanggal: row[1] || new Date().toISOString().split('T')[0],
                bukti: row[2] || `NOTA-${idx + 1}`,
                uraian: row[3] || 'Belanja BKP',
                kategori: row[4] || 'Operasional',
                debet: cleanNumber(row[5]),
                kredit: cleanNumber(row[6]),
                saldo: cleanNumber(row[7]),
                createdAt: now + idx
              };
              importedItems.push(bkpItem);
            } else if (target === 'anggaran') {
              const budgetItem: BudgetItem = {
                id: `bg-imp-${now}-${idx}`,
                kode: row[0] || `5.${idx + 1}.1.01`,
                uraian: row[1] || 'Uraian Anggaran',
                type: row[2] || 'belanja-program-parhyangan',
                volume: cleanNumber(row[3]) || 1,
                satuan: row[4] || 'Kegiatan',
                hargaSatuan: cleanNumber(row[5]),
                jumlah: cleanNumber(row[6]) || (cleanNumber(row[3]) * cleanNumber(row[5])),
                keterangan: row[7] || ''
              };
              importedItems.push(budgetItem);
            } else if (target === 'dana_punia') {
              const pTypeRaw = (row[2] || '').toLowerCase();
              let pType: 'transfer' | 'tunai' | 'barang' | 'sasah-abu' | 'lainnya' = 'tunai';
              if (pTypeRaw.includes('transfer')) pType = 'transfer';
              else if (pTypeRaw.includes('barang')) pType = 'barang';
              else if (pTypeRaw.includes('sasah')) pType = 'sasah-abu';
              else if (pTypeRaw.includes('lain')) pType = 'lainnya';

              const puniaItem: DanaPuniaItem = {
                id: `punia-imp-${now}-${idx}`,
                date: row[0] || new Date().toISOString().split('T')[0],
                nama: row[1] || 'Donatur',
                type: pType,
                alamat: row[3] || '',
                uraian: row[4] || 'Punia',
                qty: cleanNumber(row[5]) || 1,
                satuan: row[6] || 'Paket',
                jumlah: cleanNumber(row[7]),
                total: cleanNumber(row[8]) || (cleanNumber(row[5]) * cleanNumber(row[7])) || cleanNumber(row[7])
              };
              importedItems.push(puniaItem);
            } else if (target === 'urunan') {
              const urunanItem: UrunanItem = {
                id: `urunan-imp-${now}-${idx}`,
                date: row[0] || new Date().toISOString().split('T')[0],
                nama: row[1] || 'Krama Banjar',
                uraian: row[2] || 'Urunan Krama',
                jumlah: cleanNumber(row[3]),
                total: cleanNumber(row[4]) || cleanNumber(row[3])
              };
              importedItems.push(urunanItem);
            } else if (target === 'jurnal') {
              const deb = cleanNumber(row[4]);
              const kre = cleanNumber(row[5]);
              const rTypeRaw = (row[6] || '').toLowerCase();
              const rType = rTypeRaw.includes('kredit') ? 'kredit' : 'debet';

              const juItem: JuDisplayRow = {
                rowId: row[0] || `ju-imp-${now}-${idx}`,
                date: row[1] || new Date().toISOString().split('T')[0],
                kodeRekening: row[2] || '1.1.1.01',
                uraian: row[3] || 'Jurnal Transaksi',
                debet: deb,
                kredit: kre,
                rowType: rType as 'debet' | 'kredit',
                createdAt: now + idx
              };
              importedItems.push(juItem);
            } else if (target === 'pepeson') {
              const pepesonItem: PepesonItem = {
                id: `pepeson-imp-${now}-${idx}`,
                nama: row[0] || 'Pos Barang',
                krama: row[1] || 'Krama Penerima',
                qty: cleanNumber(row[2]),
                satuan: row[3] || 'Orang',
                jumlahKrama: cleanNumber(row[4]),
                total: cleanNumber(row[5])
              };
              importedItems.push(pepesonItem);
            }
          });

          if (importedItems.length === 0) {
            addNotification('Tidak ada baris data valid yang berhasil diproses dari file.', 'warning');
            return;
          }

          const userUid = auth?.currentUser?.uid;
          if (userUid) {
            const colNameMap: Record<string, string> = {
              bku: 'bku',
              bkp: 'bkp',
              anggaran: 'anggaran',
              dana_punia: 'dana_punia',
              urunan: 'urunan',
              jurnal: 'jurnal_umum',
              pepeson: 'pepeson'
            };
            const firestoreCol = colNameMap[target] || target;

            if (importMode === 'replace') {
              const snap = await getDocs(collection(db, 'users', userUid, firestoreCol));
              let delBatch = writeBatch(db);
              let delCount = 0;
              for (const docSnap of snap.docs) {
                delBatch.delete(docSnap.ref);
                delCount++;
                if (delCount >= 400) {
                  await delBatch.commit();
                  delBatch = writeBatch(db);
                  delCount = 0;
                }
              }
              if (delCount > 0) {
                await delBatch.commit();
              }
            }

            const chunkSize = 400;
            for (let i = 0; i < importedItems.length; i += chunkSize) {
              const chunk = importedItems.slice(i, i + chunkSize);
              const currentBatch = writeBatch(db);
              chunk.forEach((item) => {
                const docId = String(item.id || item.rowId || `${firestoreCol}-${now}-${Math.random().toString(36).substr(2, 9)}`);
                const docRef = doc(db, 'users', userUid, firestoreCol, docId);
                currentBatch.set(docRef, item);
              });
              await currentBatch.commit();
            }
          }

          const targetLabels: Record<string, string> = {
            bku: 'Buku Kas Umum (BKU)',
            bkp: 'Buku Kas Pembantu (BKP)',
            anggaran: 'Anggaran APBDes',
            dana_punia: 'Dana Punia',
            urunan: 'Urunan Krama',
            jurnal: 'Buku Jurnal Umum',
            pepeson: 'Pepeson Desa'
          };

          addNotification(`Sukses! Berhasil mengimpor ${importedItems.length} baris data ke ${targetLabels[target] || target} (${importMode === 'replace' ? 'Mode Timpa' : 'Mode Gabung'}).`, 'success');
        } catch (err: any) {
          console.error('Import error:', err);
          addNotification(`Gagal mengimpor data: ${err?.message || 'Terjadi kesalahan sistem'}`, 'error');
        } finally {
          setParsedHeaders([]);
          setParsedRows([]);
          setValidatedData([]);
          setFileName('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      })();
    } else if (type === 'restore_snapshot' && pendingSnapshotToRestore.current) {
      const snap = pendingSnapshotToRestore.current;
      addNotification(`Memuat data dari cadangan ${snap.formattedDate}...`, 'info');
      try {
        const payload = await getFullPayloadFromSnapshot(snap);
        if (!payload) {
          throw new Error('Berkas cadangan tidak dapat ditemukan di penyimpanan.');
        }
        const jsonString = JSON.stringify(payload, null, 2);
        const file = new File([jsonString], `backup_${snap.dateKey}.json`, { type: 'application/json' });
        if (onRestoreData) {
          await onRestoreData(file);
          addNotification(`Pemulihan seluruh data dari cadangan ${snap.formattedDate} berhasil diselesaikan!`, 'success');
        }
      } catch (err: any) {
        addNotification(`Gagal memulihkan cadangan: ${err?.message || 'Format tidak sesuai'}`, 'error');
      } finally {
        pendingSnapshotToRestore.current = null;
      }
    }
  };


  // EXCEL XML MULTI-SHEET EXPORTER & UTILITIES
  const escapeXml = (unsafe: string): string => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  const generateMultiSheetExcelXML = (
    sheets: {
      name: string;
      headers: string[];
      rows: any[][];
    }[]
  ): string => {
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Sistem Keuangan Desa Adat</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0D9488" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="&quot;Rp&quot;#,##0"/>
  </Style>
 </Styles>
`;

    sheets.forEach((sheet) => {
      xml += ` <Worksheet ss:Name="${escapeXml(sheet.name)}">
  <Table>
   <Row ss:StyleID="Header">
`;
      sheet.headers.forEach((h) => {
        xml += `    <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;

      sheet.rows.forEach((row) => {
        xml += `   <Row>\n`;
        row.forEach((cell) => {
          let type = 'String';
          let styleAttr = '';
          let val = cell;
          
          if (typeof cell === 'number') {
            type = 'Number';
            styleAttr = ' ss:StyleID="Currency"';
          } else if (typeof cell === 'boolean') {
            val = cell ? 'Ya' : 'Tidak';
          } else if (cell === null || cell === undefined) {
            val = '';
          }
          
          xml += `    <Cell${styleAttr}><Data ss:Type="${type}">${escapeXml(String(val))}</Data></Cell>\n`;
        });
        xml += `   </Row>\n`;
      });

      xml += `  </Table>
 </Worksheet>\n`;
    });

    xml += `</Workbook>`;
    return xml;
  };

  const handleExportAllToExcelXML = () => {
    // 1. Buku Kas Umum (BKU)
    const sheetBku = {
      name: 'Buku Kas Umum (BKU)',
      headers: ['Nomor', 'Tanggal', 'Kode Rekening', 'Uraian Transaksi', 'Kategori', 'Penerimaan', 'Pengeluaran', 'Saldo Kas'],
      rows: bkuData.map((b, idx) => [
        idx + 1,
        b.tanggal || '',
        b.kode || (b as any).kodeRekening || '',
        b.uraian || '',
        b.kategori || '',
        b.penerimaan || 0,
        b.pengeluaran || 0,
        b.saldo || 0
      ])
    };

    // 2. Buku Kas Pembantu (BKP)
    const sheetBkp = {
      name: 'Buku Kas Pembantu (BKP)',
      headers: ['Nomor', 'Tanggal', 'No Bukti Nota', 'Uraian Belanja', 'Kategori', 'Debet', 'Kredit / Belanja', 'Saldo'],
      rows: bkpData.map((b, idx) => [
        idx + 1,
        b.tanggal || '',
        b.bukti || '',
        b.uraian || '',
        b.kategori || '',
        b.debet || 0,
        b.kredit || 0,
        b.saldo || 0
      ])
    };

    // 3. Anggaran APBDes
    const sheetAnggaran = {
      name: 'Anggaran APBDes',
      headers: ['Kode Rekening', 'Uraian Anggaran', 'Bidang / Kategori', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah Pagu', 'Keterangan'],
      rows: budgetItems.map((item) => [
        item.kode || (item as any).kodeRekening || '',
        item.uraian || '',
        item.type || (item as any).kategori || '',
        item.volume !== undefined ? item.volume : (item as any).qty || 1,
        item.satuan || 'Kegiatan',
        item.hargaSatuan || 0,
        item.jumlah || 0,
        item.keterangan || ''
      ])
    };

    // 4. Dana Punia
    const sheetDanaPunia = {
      name: 'Dana Punia',
      headers: ['Tanggal', 'Nama Donatur', 'Jenis Punia', 'Alamat', 'Uraian', 'Qty', 'Satuan', 'Nominal', 'Total'],
      rows: danaPuniaItems.map((item) => {
        const pType = item.type === 'transfer' ? 'Transfer' : item.type === 'tunai' || item.type === 'uang' ? 'Tunai' : item.type === 'barang' ? 'Barang' : item.type === 'sasah-abu' ? 'Sasah-Abu' : (item.type || 'Lainnya');
        return [
          item.date || (item as any).tanggal || '',
          item.nama || '',
          pType,
          item.alamat || '-',
          item.uraian || '',
          item.qty || 1,
          item.satuan || 'Paket',
          item.hargaSatuan || item.jumlah || 0,
          item.total || item.jumlah || 0
        ];
      })
    };

    // 5. Urunan Krama
    const sheetUrunan = {
      name: 'Urunan Krama',
      headers: ['Tanggal', 'Nama Krama / Banjar', 'Uraian', 'Nominal', 'Total'],
      rows: urunanItems.map((item) => [
        item.date || (item as any).tanggal || '',
        item.nama || (item as any).krama || '',
        item.uraian || '',
        item.jumlah || (item as any).iuran || 0,
        item.total || item.jumlah || 0
      ])
    };

    // 6. Buku Jurnal Umum
    const sheetJurnal = {
      name: 'Buku Jurnal Umum',
      headers: ['Row ID', 'Tanggal Jurnal', 'Kode Rekening', 'Uraian Akun', 'Debet', 'Kredit', 'Tipe Baris'],
      rows: juData.map((j) => [
        j.rowId || '',
        j.date || (j as any).tanggal || '',
        j.kodeRekening || '',
        j.uraian || '',
        j.debet || 0,
        j.kredit || 0,
        j.rowType || (j.debet > 0 ? 'debet' : 'kredit')
      ])
    };

    // 7. Pepeson Desa
    const sheetPepeson = {
      name: 'Pepeson Desa',
      headers: ['Nama Pos / Barang', 'Krama Penerima', 'Qty', 'Satuan', 'Jumlah Krama', 'Total'],
      rows: pepesonItems.map((p) => [
        p.nama || (p as any).namaPos || '',
        p.krama || (p as any).kramaPenerima || '',
        p.qty || 0,
        p.satuan || 'Orang',
        p.jumlahKrama || 0,
        p.total || 0
      ])
    };

    const xmlContent = generateMultiSheetExcelXML([
      sheetBku,
      sheetBkp,
      sheetAnggaran,
      sheetDanaPunia,
      sheetUrunan,
      sheetJurnal,
      sheetPepeson
    ]);
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `LAPORAN_LENGKAP_7_MODUL_${namaDesa.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    
    addNotification('Paket Multi-Sheet Excel Legacy (.xls) berhasil diekspor dengan 7 lembar kerja pembukuan Desa Adat!', 'success');
  };

  // Modern Multi-Sheet Excel (.xlsx) Exporter
  const handleExportAllToXLSX = () => {
    try {
      const payload: Export7ModulesData = {
        bkuData,
        bkpData,
        budgetItems,
        danaPuniaItems,
        urunanItems,
        juData,
        pepesonItems,
        villageProfile: {
          namaDesa,
          alamat,
          namaKetua,
          namaBendahara
        }
      };
      const res = download7ModulesXLSX(payload, {
        yearFilter: exportYearFilter,
        villageName: namaDesa
      });
      addNotification(
        `Paket Excel 7 Modul (${res.filename}) berhasil diunduh! Total ${res.totalRecords} baris data disajikan lengkap dalam 8 lembar kerja resmi.`,
        'success'
      );
    } catch (err: any) {
      addNotification(`Gagal mengekspor Excel: ${err?.message || 'Terjadi kesalahan sistem'}`, 'error');
    }
  };

  // Modern Single-Module Excel (.xlsx) Exporter
  const handleExportSingleXLSX = (type: 'bku' | 'bkp' | 'anggaran' | 'dana_punia' | 'urunan' | 'jurnal' | 'pepeson') => {
    try {
      const payload: Export7ModulesData = {
        bkuData,
        bkpData,
        budgetItems,
        danaPuniaItems,
        urunanItems,
        juData,
        pepesonItems,
        villageProfile: {
          namaDesa,
          alamat,
          namaKetua,
          namaBendahara
        }
      };
      const res = downloadSingleModuleXLSX(type, payload, {
        yearFilter: exportYearFilter,
        villageName: namaDesa
      });
      addNotification(`File Excel ${type.toUpperCase()} (${res.filename}) berhasil diunduh (${res.count} baris data).`, 'success');
    } catch (err: any) {
      addNotification(`Gagal mengunduh Excel: ${err?.message || 'Error'}`, 'error');
    }
  };

  // Template Excel (.xlsx) Download
  const handleDownloadTemplateXLSX = () => {
    try {
      downloadModuleTemplateXLSX(importTarget);
      addNotification(`Template Excel (.xlsx) untuk ${importTarget.toUpperCase()} berhasil diunduh!`, 'info');
    } catch (err: any) {
      addNotification(`Gagal mengunduh template Excel: ${err?.message || 'Error'}`, 'error');
    }
  };


  const convertToCSV = <T extends Record<string, any>>(
    data: T[],
    headers: { key: keyof T; label: string }[]
  ): string => {
    const delimiter = csvDelimiter;
    const headerLine = headers.map((h) => `"${String(h.label).replace(/"/g, '""')}"`).join(delimiter);
    const rows = data.map((item) => {
      return headers
        .map((h) => {
          const val: any = item[h.key];
          let valStr = '';
          if (val === undefined || val === null) {
            valStr = '';
          } else if (Array.isArray(val)) {
            valStr = val.join(', ');
          } else if (typeof val === 'boolean') {
            valStr = val ? 'Ya' : 'Tidak';
          } else {
            valStr = String(val);
          }
          return `"${valStr.replace(/"/g, '""')}"`;
        })
        .join(delimiter);
    });
    return [headerLine, ...rows].join('\r\n');
  };

  const handleExportSingleCSV = (type: 'bku' | 'bkp' | 'anggaran' | 'dana_punia' | 'urunan' | 'jurnal' | 'pepeson') => {
    let csvContent = '';
    let defaultFileName = '';
    const d = csvDelimiter;

    if (type === 'bku') {
      const headerLine = ['Nomor', 'Tanggal', 'Kode Rekening', 'Uraian Transaksi', 'Kategori', 'Penerimaan', 'Pengeluaran', 'Saldo Kas']
        .map(h => `"${h}"`).join(d);
      const rows = bkuData.map((b, idx) => [
        idx + 1,
        b.tanggal || '',
        b.kode || (b as any).kodeRekening || '',
        b.uraian || '',
        b.kategori || '',
        b.penerimaan || 0,
        b.pengeluaran || 0,
        b.saldo || 0
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d));
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `BKU_${namaDesa.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'bkp') {
      const headerLine = ['Nomor', 'Tanggal', 'No Bukti Nota', 'Uraian Belanja', 'Kategori', 'Debet', 'Kredit / Belanja', 'Saldo']
        .map(h => `"${h}"`).join(d);
      const rows = bkpData.map((b, idx) => [
        idx + 1,
        b.tanggal || '',
        b.bukti || '',
        b.uraian || '',
        b.kategori || '',
        b.debet || 0,
        b.kredit || 0,
        b.saldo || 0
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d));
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `BKP_${namaDesa.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'anggaran') {
      const headerLine = ['Kode Rekening', 'Uraian Anggaran', 'Bidang / Kategori', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah Pagu', 'Keterangan']
        .map(h => `"${h}"`).join(d);
      const rows = budgetItems.map(item => [
        item.kode || (item as any).kodeRekening || '',
        item.uraian || '',
        item.type || (item as any).kategori || '',
        item.volume !== undefined ? item.volume : (item as any).qty || 1,
        item.satuan || 'Kegiatan',
        item.hargaSatuan || 0,
        item.jumlah || 0,
        item.keterangan || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d));
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `ANGGARAN_APBDES_${namaDesa.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'dana_punia') {
      const headerLine = ['Tanggal', 'Nama Donatur', 'Jenis Punia', 'Alamat', 'Uraian', 'Qty', 'Satuan', 'Nominal', 'Total']
        .map(h => `"${h}"`).join(d);
      const rows = danaPuniaItems.map(item => {
        const pType = item.type === 'transfer' ? 'Transfer' : item.type === 'tunai' || item.type === 'uang' ? 'Tunai' : item.type === 'barang' ? 'Barang' : item.type === 'sasah-abu' ? 'Sasah-Abu' : (item.type || 'Lainnya');
        return [
          item.date || (item as any).tanggal || '',
          item.nama || '',
          pType,
          item.alamat || '-',
          item.uraian || '',
          item.qty || 1,
          item.satuan || 'Paket',
          item.hargaSatuan || item.jumlah || 0,
          item.total || item.jumlah || 0
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d);
      });
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `DANA_PUNIA_${namaDesa.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'urunan') {
      const headerLine = ['Tanggal', 'Nama Krama / Banjar', 'Uraian', 'Nominal', 'Total']
        .map(h => `"${h}"`).join(d);
      const rows = urunanItems.map(item => [
        item.date || (item as any).tanggal || '',
        item.nama || (item as any).krama || '',
        item.uraian || '',
        item.jumlah || (item as any).iuran || 0,
        item.total || item.jumlah || 0
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d));
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `URUNAN_KRAMA_${namaDesa.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'jurnal') {
      const headerLine = ['Row ID', 'Tanggal Jurnal', 'Kode Rekening', 'Uraian Akun', 'Debet', 'Kredit', 'Tipe Baris']
        .map(h => `"${h}"`).join(d);
      const rows = juData.map(j => [
        j.rowId || '',
        j.date || (j as any).tanggal || '',
        j.kodeRekening || '',
        j.uraian || '',
        j.debet || 0,
        j.kredit || 0,
        j.rowType || (j.debet > 0 ? 'debet' : 'kredit')
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d));
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `JURNAL_UMUM_${namaDesa.replace(/\s+/g, '_')}.csv`;
    } else if (type === 'pepeson') {
      const headerLine = ['Nama Pos / Barang', 'Krama Penerima', 'Qty', 'Satuan', 'Jumlah Krama', 'Total']
        .map(h => `"${h}"`).join(d);
      const rows = pepesonItems.map(p => [
        p.nama || (p as any).namaPos || '',
        p.krama || (p as any).kramaPenerima || '',
        p.qty || 0,
        p.satuan || 'Orang',
        p.jumlahKrama || 0,
        p.total || 0
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(d));
      csvContent = [headerLine, ...rows].join('\r\n');
      defaultFileName = `PEPESON_DESA_${namaDesa.replace(/\s+/g, '_')}.csv`;
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFileName;
    link.click();
    addNotification(`Ekspor CSV ${type.toUpperCase()} berhasil diunduh!`, 'success');
  };

  const handleDownloadTemplate = () => {
    let templateText = '';
    let tName = '';
    const d = csvDelimiter;

    if (importTarget === 'bku') {
      templateText = `Nomor${d}Tanggal${d}Kode Rekening${d}Uraian Transaksi${d}Kategori${d}Penerimaan${d}Pengeluaran${d}Saldo Kas\r\n` +
                     `1${d}2026-07-01${d}4.1.1.01${d}Penerimaan Dana Punia Karya Piodalan${d}Pendapatan${d}15000000${d}0${d}15000000\r\n` +
                     `2${d}2026-07-05${d}5.1.1.01${d}Belanja Pembelian Janur dan Upakara${d}Belanja Rutin${d}0${d}3500000${d}11500000`;
      tName = `TEMPLATE_IMPOR_BKU.csv`;
    } else if (importTarget === 'bkp') {
      templateText = `Nomor${d}Tanggal${d}No Bukti Nota${d}Uraian Belanja${d}Kategori${d}Debet${d}Kredit / Belanja${d}Saldo\r\n` +
                     `1${d}2026-07-05${d}NOTA-001${d}Pembelian Wastra dan Perlengkapan Pura${d}Operasional${d}0${d}2500000${d}2500000\r\n` +
                     `2${d}2026-07-08${d}NOTA-002${d}Konsumsi Gotong Royong Krama Banjar${d}Kegiatan Pawongan${d}0${d}1200000${d}3700000`;
      tName = `TEMPLATE_IMPOR_BKP.csv`;
    } else if (importTarget === 'anggaran') {
      templateText = `Kode Rekening${d}Uraian Anggaran${d}Bidang / Kategori${d}Volume${d}Satuan${d}Harga Satuan${d}Jumlah Pagu${d}Keterangan\r\n` +
                     `5.1.2.01${d}Pemeliharaan Pura Penataran Agung${d}belanja-program-parhyangan${d}1${d}Paket${d}25000000${d}25000000${d}Pembangunan Pagar & Kori\r\n` +
                     `5.2.1.01${d}Insentif Pemangku & Prajuru Desa${d}belanja-rutin-insentif${d}12${d}Bulan${d}1500000${d}18000000${d}Operasional Bulanan`;
      tName = `TEMPLATE_IMPOR_ANGGARAN_APBDES.csv`;
    } else if (importTarget === 'dana_punia') {
      templateText = `Tanggal${d}Nama Donatur${d}Jenis Punia${d}Alamat${d}Uraian${d}Qty${d}Satuan${d}Nominal${d}Total\r\n` +
                     `2026-07-02${d}I Wayan Sudarma${d}Transfer${d}Br. Kangin${d}Punia Piodalan Agung${d}1${d}Transfer${d}1000000${d}1000000\r\n` +
                     `2026-07-03${d}Ni Ketut Artini${d}Barang${d}Br. Kauh${d}Punia Beras & Minyak Kelapa${d}5${d}Karung${d}350000${d}1750000`;
      tName = `TEMPLATE_IMPOR_DANA_PUNIA.csv`;
    } else if (importTarget === 'urunan') {
      templateText = `Tanggal${d}Nama Krama / Banjar${d}Uraian${d}Nominal${d}Total\r\n` +
                     `2026-07-01${d}Banjar Adat Kaja${d}Urunan Gotong Royong Karya Pura${d}150000${d}15000000\r\n` +
                     `2026-07-01${d}Banjar Adat Kelod${d}Urunan Wajib Krama Mipil${d}150000${d}13500000`;
      tName = `TEMPLATE_IMPOR_URUNAN_KRAMA.csv`;
    } else if (importTarget === 'jurnal') {
      templateText = `Row ID${d}Tanggal Jurnal${d}Kode Rekening${d}Uraian Akun${d}Debet${d}Kredit${d}Tipe Baris\r\n` +
                     `ju-001-d${d}2026-07-10${d}1.1.1.01${d}Penerimaan Kas Dana Punia Pura${d}5000000${d}0${d}debet\r\n` +
                     `ju-001-k${d}2026-07-10${d}4.1.1.01${d}Pendapatan Dana Punia Pura${d}0${d}5000000${d}kredit`;
      tName = `TEMPLATE_IMPOR_JURNAL_UMUM.csv`;
    } else if (importTarget === 'pepeson') {
      templateText = `Nama Pos / Barang${d}Krama Penerima${d}Qty${d}Satuan${d}Jumlah Krama${d}Total\r\n` +
                     `Insentif Kerja Bakti Banjar${d}Krama Banjar Kaja${d}50${d}Orang${d}50${d}2500000\r\n` +
                     `Beras & Dupa Upacara${d}Prajuru & Pemangku${d}12${d}Paket${d}12${d}1800000`;
      tName = `TEMPLATE_IMPOR_PEPESON_DESA.csv`;
    }

    const blob = new Blob([templateText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = tName;
    link.click();
    addNotification(`Template CSV untuk ${importTarget.toUpperCase()} berhasil diunduh!`, 'info');
  };

  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    
    const firstLine = text.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentValue += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentValue += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          row.push(currentValue.trim());
          currentValue = '';
        } else if (char === '\n' || char === '\r') {
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
          row.push(currentValue.trim());
          lines.push(row);
          row = [];
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
    }
    if (row.length > 0 || currentValue !== '') {
      row.push(currentValue.trim());
      lines.push(row);
    }
    return lines.filter((r) => r.length > 0 && r.some((cell) => cell !== ''));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      try {
        const res = await parseExcelFile(file);
        if (res.rows.length === 0) {
          addNotification('File Excel kosong atau tidak memiliki baris data.', 'error');
          setIsParsing(false);
          return;
        }
        setParsedHeaders(res.headers);
        setParsedRows(res.rows);
        setValidatedData(res.rows);
        addNotification(`File Excel "${file.name}" berhasil dianalisis (${res.rows.length} baris data).`, 'success');
      } catch (err: any) {
        addNotification(`Gagal membaca file Excel: ${err?.message || 'Pastikan format file sesuai.'}`, 'error');
      } finally {
        setIsParsing(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const allLines = parseCSV(text);
          if (allLines.length === 0) {
            addNotification('File CSV kosong atau tidak memiliki baris data.', 'error');
            setIsParsing(false);
            return;
          }

          const headers = allLines[0];
          const dataRows = allLines.slice(1);

          setParsedHeaders(headers);
          setParsedRows(dataRows);
          setValidatedData(dataRows);
          addNotification(`File CSV "${file.name}" berhasil dianalisis (${dataRows.length} baris data).`, 'success');
        } catch (err) {
          addNotification('Gagal membaca file CSV. Pastikan format file valid.', 'error');
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExecuteImport = () => {
    if (validatedData.length === 0) {
      addNotification('Tidak ada baris data valid yang siap di-impor.', 'warning');
      return;
    }

    const title = importMode === 'replace' ? 'Konfirmasi Timpa Data (Replace)' : 'Konfirmasi Impor Data';
    const confirmMsg = importMode === 'replace' 
      ? `PERINGATAN BAHAYA: Anda memilih MODE TIMPA (REPLACE). Semua data ${importTarget.toUpperCase()} yang ada saat ini akan diganti dengan data dari file ini. Apakah Anda yakin?`
      : `Anda akan mengimpor ${validatedData.length} baris data baru ke dalam database ${importTarget.toUpperCase()}. Lanjutkan?`;

    setConfirmModal({
      isOpen: true,
      title,
      description: confirmMsg,
      type: 'execute_import',
      requireTextMatch: importMode === 'replace',
      matchText: importMode === 'replace' ? 'TIMPA DATA' : '',
      inputText: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-teal-400 text-xs uppercase font-bold tracking-wider mb-1">
            <Settings className="w-4 h-4" /> MENU SETTING
          </div>
          <h2 className="text-xl font-bold font-serif text-slate-100">
            Pengaturan System & Administrasi
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pengelolaan identitas desa adat, hak akses pengurus, backup data, serta integrasi spreadsheet Excel.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span className="text-slate-300">Bacol Enterprise Engine v.4.5</span>
        </div>
      </div>

      {notification && <div className="no-print"><Notification {...notification} onClose={() => setNotification(null)} /></div>}

      {/* MENU NAVIGASI: PENGATURAN SISTEM vs LOG USER */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl no-print shadow-sm">
        <button
          type="button"
          onClick={() => setSettingActiveMenu('system')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            settingActiveMenu === 'system'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-900/40 border border-teal-400/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Settings size={15} />
          <span>Pengaturan Sistem & Database</span>
        </button>

        <button
          type="button"
          onClick={() => setSettingActiveMenu('user_logs')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
            settingActiveMenu === 'user_logs'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-950/40 border border-amber-300 font-extrabold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users size={15} />
          <span>Log User</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-normal ${
            settingActiveMenu === 'user_logs'
              ? 'bg-black/20 text-slate-950'
              : 'bg-amber-400/10 text-amber-400 border border-amber-400/30'
          }`}>
            Aktivitas
          </span>
        </button>
      </div>

      {settingActiveMenu === 'user_logs' && (
        <UserLogView onNotify={addNotification} />
      )}

      {settingActiveMenu === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. PROFIL DESA FORM */}
        <div className="lg:col-span-2 space-y-6">

          {/* GEMINI AI INTEGRATION CARD */}
          <div className="p-6 bg-gradient-to-br from-slate-50 to-teal-100 border border-teal-500/40 rounded-xl shadow-md text-slate-100 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-teal-500/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-500 flex items-center gap-2">
                    Integrasi Gemini AI &amp; Tes Kode
                  </h3>
                  <p className="text-xs text-slate-700">
                    Mesin analisis kecerdasan buatan untuk Ringkasan Eksekutif, LRA Naratif, Neraca &amp; Pelaporan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-teal-900/40 border border-teal-400/30 text-white font-semibold tracking-wider">
                  Model: {GEMINI_MODEL_TEXT}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase font-bold text-teal-300 font-mono mb-1.5 flex items-center justify-between">
                  <span>Gemini API Key (VITE_GEMINI_API_KEY)</span>
                  <span className="text-slate-500 font-normal normal-case">
                    Kunci aktif: <span className="font-mono text-emerald-600 font-semibold">{maskApiKey(geminiKeyInput)}</span>
                  </span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showFullApiKey ? 'text' : 'password'}
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      placeholder="Masukkan Gemini API Key"
                      className="w-full bg-slate-950/90 border border-teal-500/30 rounded-lg p-2.5 pr-10 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-teal-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFullApiKey(!showFullApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-teal-300/80 hover:text-teal-200 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      {showFullApiKey ? 'Sembunyikan' : 'Lihat'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={isTestingGemini}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-teal-200 to-emerald-400 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md shrink-0"
                    title="Jalankan tes kode dan koneksi live ke Gemini AI"
                  >
                    <RefreshCw size={13} className={isTestingGemini ? 'animate-spin' : ''} />
                    <span>{isTestingGemini ? 'Menguji...' : 'Tes Kode (Live Ping)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveGeminiKey}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg border border-teal-500/40 transition-all cursor-pointer shrink-0"
                    title="Simpan API Key ke penyimpanan lokal browser"
                  >
                    Simpan
                  </button>

                  <button
                    type="button"
                    onClick={handleResetGeminiKey}
                    className="bg-slate-800/60 hover:bg-slate-700 text-slate-100 hover:text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 transition-all cursor-pointer shrink-0"
                    title="Reset kembali ke API Key bawaan"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {geminiTestResult && (
                <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                  geminiTestResult.success
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                }`}>
                  <div className="flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-2">
                      {geminiTestResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      <span>{geminiTestResult.message}</span>
                    </div>
                    {geminiTestResult.latencyMs && (
                      <span className="font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded text-emerald-300">
                        {geminiTestResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  {geminiTestResult.response && (
                    <div className="bg-black/30 p-2 rounded text-slate-200 font-mono text-[11px] border border-white/5">
                      <span className="text-teal-300">Respon Model:</span> "{geminiTestResult.response}"
                    </div>
                  )}
                </div>
              )}

              {/* Modul yang terhubung ke Gemini AI */}
              <div className="pt-2 border-t border-teal-500/20">
                <p className="text-[11px] uppercase font-mono font-bold text-teal-400/90 mb-2">
                  Modul yang otomatis menggunakan analisis Gemini AI:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-50 border border-teal-500/20 text-slate-700">
                    <span className="text-teal-400 font-bold block">1. Dashboard AI</span>
                    Ringkasan eksekutif arus kas bulanan
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-teal-500/20 text-slate-700">
                    <span className="text-teal-400 font-bold block">2. LRA Naratif</span>
                    Telaah naskah pidato Paruman Desa
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-teal-500/20 text-slate-700">
                    <span className="text-teal-400 font-bold block">3. Formulir Neraca</span>
                    Kesehatan aktiva &amp; pos belanja
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-teal-500/20 text-slate-700">
                    <span className="text-teal-400 font-bold block">4. Pelaporan Digital</span>
                    Strategi transparansi publik krama
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-800 rounded-xl shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-800 dark:text-teal-400 mb-5 flex items-center gap-2 border-b-2 border-emerald-400 pb-2">
              <Settings className="w-4 h-4" /> Identitas Desa Adat & Lembaga
            </h3>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Nama Desa Adat</label>
                  <input
                    type="text"
                    value={namaDesa}
                    onChange={(e) => setNamaDesa(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Alamat Kantor</label>
                  <input
                    type="text"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    value={telepon}
                    onChange={(e) => setTelepon(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Email Pengawas Keuangan</label>
                  <input
                    type="email"
                    value={emailPengawas}
                    onChange={(e) => setEmailPengawas(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 font-mono mb-1">
                    Nama Keliang Adat</label>
                  <input
                    type="text"
                    value={namaKetua}
                    onChange={(e) => setNamaKetua(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 font-mono mb-1">
                    Nama Juru Raksa</label>
                  <input
                    type="text"
                    value={namaBendahara}
                    onChange={(e) => setNamaBendahara(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Modal Awal Kas Adat (Rp)</label>
                  <input
                    type="number"
                    value={modalAwal}
                    onChange={(e) => setModalAwal(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs font-mono font-bold text-teal-600 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Tanggal Tanda Tangan Laporan</label>
                  <input
                    type="text"
                    value={tanggalTtd}
                    onChange={(e) => setTanggalTtd(e.target.value)}
                    placeholder="Contoh: 31 Desember 2026 (Kosongkan untuk tanggal hari ini)"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-500 font-mono mb-1">
                    Tahun Laporan Default (Print)</label>
                  <input
                    type="text"
                    value={printYear}
                    onChange={(e) => setPrintYear(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs shadow-md shadow-teal-600/20 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Simpan Identitas Desa Adat
                </button>
              </div>
            </form>
          </div>

          {/* 2. TANDA TANGAN DIGITAL PEJABAT & DOKUMEN (CANVAS & UPLOAD) */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-emerald-400 pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-800 dark:text-teal-400 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Tanda Tangan Digital Pejabat & Dokumen
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Goreskan tanda tangan pada kanvas atau unggah gambar untuk otomatis tersemat pada Kwitansi, Nota Belanja, & Buku Kas.
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {Object.values(digitalSignatures).filter(Boolean).length} TTD Terpasang
                </span>
              </div>
            </div>

            {/* Auto Embed Switch */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 rounded-lg shrink-0 mt-0.5">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Otomatis Sematkan Tanda Tangan saat Mencetak Dokumen
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Saat Kwitansi Dana Punia, Nota Belanja, atau Buku Kas dicetak/diekspor ke PDF, tanda tangan yang tersimpan akan langsung muncul di atas nama pejabat.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={signatureSettings.autoEmbed}
                  onChange={(e) => handleToggleAutoEmbedSignatures(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {/* Stamp Overlay Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg shrink-0 mt-0.5">
                  <Stamp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Tampilkan Stempel Resmi di atas Tanda Tangan Keliang Adat</span>
                    <span className="text-[10px] bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded font-mono font-bold">Cap Basah</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Membubuhkan cap stempel resmi Desa Adat Basangalas secara proporsional dan elegan di atas tanda tangan Keliang Adat pada Nota Belanja & Kwitansi.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={signatureSettings.showStampOverlay !== false}
                  onChange={(e) => handleToggleStampOverlay(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Sizing Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Signature Sizing / Proportion Controller */}
              <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono uppercase">
                      Ukuran Tanda Tangan
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                    {signatureSettings.scale || 100}%
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateGlobalScale((signatureSettings.scale || 100) - 10)}
                    disabled={(signatureSettings.scale || 100) <= 50}
                    className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title="Perkecil (-10%)"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    step="5"
                    value={signatureSettings.scale || 100}
                    onChange={(e) => handleUpdateGlobalScale(Number(e.target.value))}
                    className="w-full accent-teal-600 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateGlobalScale((signatureSettings.scale || 100) + 10)}
                    disabled={(signatureSettings.scale || 100) >= 180}
                    className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title="Perbesar (+10%)"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  {[75, 100, 125, 150].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleUpdateGlobalScale(val)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                        (signatureSettings.scale || 100) === val
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stamp Sizing Controller */}
              <div className="bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stamp className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono uppercase">
                      Ukuran / Skala Stempel
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                    {signatureSettings.stampScale || 100}%
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateStampScale((signatureSettings.stampScale || 100) - 10)}
                    disabled={(signatureSettings.stampScale || 100) <= 50}
                    className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title="Perkecil (-10%)"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    step="5"
                    value={signatureSettings.stampScale || 100}
                    onChange={(e) => handleUpdateStampScale(Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdateStampScale((signatureSettings.stampScale || 100) + 10)}
                    disabled={(signatureSettings.stampScale || 100) >= 180}
                    className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    title="Perbesar (+10%)"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  {[75, 100, 125, 150].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleUpdateStampScale(val)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                        (signatureSettings.stampScale || 100) === val
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Combined Preview Box */}
            <div className="p-4 bg-amber-50/60 dark:bg-slate-950 border border-amber-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-amber-900 dark:text-amber-300 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Simulasi Tampilan Gabungan (TTD + Stempel Resmi Keliang Adat)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Live Render</span>
              </div>
              <div className="h-32 bg-white rounded-lg border border-slate-200 shadow-inner flex flex-col items-center justify-center relative overflow-hidden p-2">
                <div className="text-center font-serif text-[10px] text-slate-700 font-bold mb-1">
                  Mengetahui, Keliang Adat
                </div>
                
                {/* Signature + Stamp Container */}
                <div className="relative flex items-center justify-center w-48 h-16">
                  {/* Stempel Overlay */}
                  {signatureSettings.showStampOverlay !== false && (
                    <div 
                      className="absolute pointer-events-none z-10 flex items-center justify-center transition-all"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `translate(-65%, -50%) rotate(-6deg) scale(${((signatureSettings.stampScale || 100) / 100) * 0.85})`,
                        width: '84px',
                        height: '84px',
                        opacity: 0.88,
                        mixBlendMode: 'multiply'
                      }}
                    >
                      <img 
                        src={getEffectiveStamp(digitalSignatures, namaDesa || 'DESA ADAT BASANGALAS')} 
                        alt="Stempel Desa Adat"
                        className="w-full h-full object-contain filter contrast-125" 
                      />
                    </div>
                  )}

                  {/* Keliang Signature */}
                  {digitalSignatures.keliang ? (
                    <img 
                      src={digitalSignatures.keliang} 
                      alt="TTD Keliang" 
                      style={{
                        height: `${Math.round(48 * ((signatureSettings.scale || 100) / 100))}px`,
                        maxWidth: '130px'
                      }}
                      className="object-contain relative z-0" 
                    />
                  ) : (
                    <div className="text-[10px] text-slate-400 italic border-b border-dotted border-slate-400 pb-0.5">
                      (Tanda Tangan Belum Diset)
                    </div>
                  )}
                </div>

                <div className="text-center font-serif text-[10px] font-bold text-slate-900 underline mt-1">
                  ({namaKetua || 'I Made Mudita'})
                </div>
              </div>
            </div>

            {/* Signers & Stamp Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* CARD 1: KELIANG ADAT */}
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">
                      Mengetahui / Pimpinan
                    </span>
                    {digitalSignatures.keliang ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle className="w-3 h-3" /> Tersedia
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Belum diset</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    Keliang Adat ({namaKetua || 'I Made Mudita'})
                  </div>
                </div>

                {/* Signature Preview Canvas Box */}
                <div className="h-28 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center p-2 relative overflow-hidden group">
                  {digitalSignatures.keliang ? (
                    <div className="w-full h-full flex items-center justify-center relative">
                      <img
                        src={digitalSignatures.keliang}
                        alt="TTD Keliang Adat"
                        className="max-h-full max-w-full object-contain filter dark:invert"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 space-y-1">
                      <PenTool className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600" />
                      <div className="text-[10px]">Klik tombol di bawah untuk menggambar / mengunggah</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenSignatureModal('keliang', namaKetua)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{digitalSignatures.keliang ? 'Ganti TTD' : 'Gores / Unggah TTD'}</span>
                  </button>
                  {digitalSignatures.keliang && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownloadSignaturePNG('keliang', namaKetua)}
                        className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Unduh PNG Transparan"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSignatureRole('keliang', 'Keliang Adat')}
                        className="p-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Hapus Tanda Tangan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* CARD 2: JURU RAKSA */}
              <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-teal-700 dark:text-teal-400">
                      Bendahara / Penerima
                    </span>
                    {digitalSignatures.juruRaksa ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle className="w-3 h-3" /> Tersedia
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Belum diset</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    Juru Raksa ({namaBendahara || 'I Putu Gede Sutrana'})
                  </div>
                </div>

                {/* Signature Preview Canvas Box */}
                <div className="h-28 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center p-2 relative overflow-hidden group">
                  {digitalSignatures.juruRaksa ? (
                    <div className="w-full h-full flex items-center justify-center relative">
                      <img
                        src={digitalSignatures.juruRaksa}
                        alt="TTD Juru Raksa"
                        className="max-h-full max-w-full object-contain filter dark:invert"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 space-y-1">
                      <PenTool className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600" />
                      <div className="text-[10px]">Klik tombol di bawah untuk menggambar / mengunggah</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenSignatureModal('juruRaksa', namaBendahara)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{digitalSignatures.juruRaksa ? 'Ganti TTD' : 'Gores / Unggah TTD'}</span>
                  </button>
                  {digitalSignatures.juruRaksa && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownloadSignaturePNG('juruRaksa', namaBendahara)}
                        className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Unduh PNG Transparan"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSignatureRole('juruRaksa', 'Juru Raksa')}
                        className="p-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Hapus Tanda Tangan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* CARD 3: STEMPEL RESMI DESA ADAT */}
              <div className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <Stamp className="w-3 h-3" /> Cap Lembaga
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                      <CheckCircle className="w-3 h-3" /> {digitalSignatures.stempel ? 'Stempel Kustom' : 'Standar Otomatis'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    Stempel Resmi {namaDesa || 'Desa Adat Basangalas'}
                  </div>
                </div>

                {/* Stamp Preview Canvas Box */}
                <div className="h-28 bg-white dark:bg-slate-900 border border-dashed border-rose-300 dark:border-rose-800 rounded-lg flex items-center justify-center p-2 relative overflow-hidden group">
                  <div className="w-full h-full flex items-center justify-center relative">
                    <img
                      src={getEffectiveStamp(digitalSignatures, namaDesa || 'DESA ADAT BASANGALAS')}
                      alt="Stempel Resmi Desa Adat"
                      className="max-h-full max-w-full object-contain filter contrast-125"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenSignatureModal('stempel', namaDesa || 'DESA ADAT BASANGALAS')}
                    className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                    title="Gores atau Unggah Stempel"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Unggah/Gores</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateStandardStamp}
                    className="flex-1 flex items-center justify-center px-2 py-1 gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Buat Otomatis Cap Standar Resmi Desa Adat"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> 
                    <span>Buat Otomatis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSignaturePNG('stempel', namaDesa || 'Desa_Basangalas')}
                    className="flex-1 flex items-center justify-center px-2 py-1 gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                    title="Unduh PNG Transparan"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PNG</span>
                  </button>
                  {digitalSignatures.stempel && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSignatureRole('stempel', 'Stempel Resmi')}
                      className="flex-1 flex items-center justify-center px-2 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg text-xs transition-colors cursor-pointer"
                      title="Reset ke Stempel Standar"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset ke Standar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Helpful Note */}
            <div className="text-[11px] bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 p-3 rounded-lg flex items-start gap-2 border border-slate-200 dark:border-slate-700/60">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Tips Stempel & Tanda Tangan:</strong> Cap stempel resmi diposisikan secara proporsional dan realistis menimpa tanda tangan Keliang Adat dengan teknik <em>multiply ink-blending</em>. Anda dapat menyesuaikan ukuran tanda tangan maupun stempel secara terpisah sesuai kebutuhan dokumen resmi.
              </span>
            </div>
          </div>

        </div>

        {/* 3. RIGHT COLUMN: BACKUP DATABASE & PREFERENCES */}
        <div className="space-y-6">
          {/* JADWAL BACKUP OTOMATIS HARIAN (FIREBASE STORAGE & LOKAL) */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-900/60 rounded-xl shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-800 dark:text-teal-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Jadwal Backup Otomatis Harian
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Mencadangkan data ke Firebase Storage & Snapshot Lokal saat pertama kali login setiap hari.
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 ${
                autoBackupConfig.enabled 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${autoBackupConfig.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {autoBackupConfig.enabled ? 'Aktif Harian' : 'Nonaktif'}
              </span>
            </div>

            {/* Toggle Active & Target Options */}
            <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 rounded-lg border border-teal-100 dark:border-teal-900/40 space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-teal-600" /> Otomatis Cadangkan Saat Login
                </span>
                <input
                  type="checkbox"
                  checked={autoBackupConfig.enabled}
                  onChange={(e) => handleUpdateAutoBackupConfig({ enabled: e.target.checked })}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
              </label>

              <div className="border-t border-teal-100/80 dark:border-teal-900/40 pt-2 space-y-2 text-[11px]">
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.targetCloud}
                    onChange={(e) => handleUpdateAutoBackupConfig({ targetCloud: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  <Cloud className="w-3.5 h-3.5 text-sky-500" />
                  <span>Simpan ke <strong>Firebase Storage</strong> (Penyimpanan Cloud)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.targetLocal}
                    onChange={(e) => handleUpdateAutoBackupConfig({ targetLocal: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Simpan ke <strong>Snapshot Lokal Perangkat</strong> (IndexedDB)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoBackupConfig.autoDownload}
                    onChange={(e) => handleUpdateAutoBackupConfig({ autoDownload: e.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                  />
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>Otomatis unduh berkas .json ke perangkat saat login</span>
                </label>
              </div>
            </div>

            {/* Last Backup Info & Manual Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Terakhir Dicadangkan:</span>
                <span>{autoBackupConfig.lastBackupTime || 'Belum ada cadangan hari ini'}</span>
              </div>

              <button
                type="button"
                onClick={handleTriggerManualBackupNow}
                disabled={isBackingUpNow}
                className="py-2 px-3.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition cursor-pointer self-start sm:self-auto"
              >
                {isBackingUpNow ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Cadangkan Sekarang
                  </>
                )}
              </button>
            </div>

            {/* Riwayat Snapshot Backup List */}
            {backupHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500 dark:text-slate-400">
                    Riwayat Cadangan ({backupHistory.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="text-[11px] text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                  >
                    {isHistoryExpanded ? 'Sembunyikan' : 'Tampilkan Semua'}
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {(isHistoryExpanded ? backupHistory : backupHistory.slice(0, 3)).map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {item.formattedDate}
                          </span>
                          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">
                            {Math.round(item.sizeBytes / 1024)} KB
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span>BKU: {item.recordCounts.bku}</span> •
                          <span>BKP: {item.recordCounts.bkp}</span> •
                          <span>Jurnal: {item.recordCounts.ju}</span> •
                          <span>Anggaran: {item.recordCounts.anggaran}</span> •
                          <span>Punia: {item.recordCounts.danaPunia}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {item.storageTargets.includes('firebase_storage') && (
                            <span className="text-[9px] bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                              <Cloud className="w-2.5 h-2.5" /> Firebase Storage
                            </span>
                          )}
                          {item.storageTargets.includes('local_indexeddb') && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                              <HardDrive className="w-2.5 h-2.5" /> Snapshot Lokal
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleDownloadSnapshotItem(item)}
                          title="Unduh File JSON Cadangan Ini"
                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950 hover:text-teal-600 rounded text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreFromSnapshotItem(item)}
                          title="Pulihkan Seluruh Data ke Versi Cadangan Ini"
                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950 hover:text-amber-600 rounded text-slate-600 dark:text-slate-300 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Pulihkan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSnapshotItem(item.id)}
                          title="Hapus dari Riwayat"
                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 rounded text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BACKUP EXPORT & RESTORE MANUAL BOX */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-800 dark:text-teal-400 flex items-center gap-2">
              <Database className="w-4 h-4" /> Amankan Database (.json)
            </h3>


            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Unduh salinan lengkap seluruh data Anggaran Kas, Dana Punia (Transfer, Tunai, Barang, Sasah Abu, Lainnya), Urunan Krama, BKU, BKP, Jurnal Umum, Pepeson, dan Profil Desa dalam format JSON untuk proteksi dan migrasi data.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleDownloadBackup}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-md shadow-teal-600/10 transition cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Backup JSON
              </button>

              <input
                type="file"
                ref={restoreJsonInputRef}
                accept=".json"
                onChange={handleRestoreBackup}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => restoreJsonInputRef.current?.click()}
                className="w-full py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Upload className="w-4 h-4" /> Pulihkan Backup JSON
              </button>
            </div>
          </div>

          {/* APPLICATION CONFIGURATION PREFERENCES */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-800 dark:text-teal-400 flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Preferensi & Notifikasi
            </h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => handleToggleSound(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Aktifkan efek suara transaksi</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waAutoSend}
                  onChange={(e) => setWaAutoSend(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Buka WhatsApp API otomatis saat simpan nota</span>
              </label>
            </div>
          </div>

          {/* TATA KELOLA & PENGHAPUSAN DATA */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-red-500 dark:border-red-950 rounded-xl shadow-sm space-y-4 text-xs">
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Pembersihan & Reset Data
            </h3>

            <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              Fitur reset data memungkinkan Anda menghapus seluruh data transaksi untuk memulai pembukuan dari nol.
            </p>

            <button
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: 'Hapus Seluruh Data Transaksi',
                  description: 'PERINGATAN BAHAYA: Anda akan menghapus seluruh data transaksi dari sistem secara permanen. Ketik "HAPUS DATA" untuk mengonfirmasi.',
                  type: 'clear_all',
                  requireTextMatch: true,
                  matchText: 'HAPUS DATA',
                  inputText: ''
                });
              }}
              className="w-full py-2.5 border border-red-500/50 hover:border-red-500 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition cursor-pointer"
            >
              ⚠️ Hapus Seluruh Data Transaksi
            </button>
          </div>

          {/* CATATAN PENTING & INFORMASI PROYEK */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-300 dark:border-slate-800 p-3">
              <ul className="text-sm list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-300">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Catatan :</span>
                <li>Pastikan berkas Excel atau CSV yang diunggah sesuai dengan template resmi untuk menghindari kesalahan format.</li>
                <li>Jika memilih opsi "Timpa (Replace)", seluruh data lama pada modul yang dipilih akan dihapus dan digantikan dengan data baru.</li>
                <li>Proses impor dapat memakan waktu tergantung pada jumlah baris data yang diunggah.</li>
                <li>Selalu lakukan backup data sebelum melakukan impor untuk menghindari kehilangan data penting.</li>
              </ul>
          </div>

          {/* PROJECT INFORMATION CARD */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-teal-100 to-blue-50 rounded-xl border border-slate-300 dark:border-slate-800 p-3">
              <ul className="h-full text-sm list-disc pl-5 space-y-1 text-slate-800 dark:text-slate-300">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Informasi Proyek :</span>
                <li>idProjectGAI : <strong>DesaAdatV.5.0.8 (DT)</strong></li>
                <li>FbProjectId : <strong>bacolenterprise50</strong></li>
              </ul>
          </div>
        </div>
      </div>

      {/* EXCEL INTEGRATION CONTROL PANEL */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="p-1.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-lg font-bold">📊</span> 
              Integrasi Excel & Impor / Ekspor Spreadsheet (.xls / .csv)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ekspor seluruh data akuntansi ke spreadsheet multi-sheet atau impor data keuangan masal dari file Excel.
            </p>
          </div>
          
          <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-lg self-start sm:self-center font-mono text-[11px] font-bold">
            <button
              onClick={() => setExcelTab('export')}
              className={`px-4 py-1.5 rounded-md transition duration-200 flex items-center gap-1 cursor-pointer ${
                excelTab === 'export' 
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileDown className="w-3.5 h-3.5" /> Ekspor ke Excel
            </button>
            <button
              onClick={() => setExcelTab('import')}
              className={`px-4 py-1.5 rounded-md transition duration-200 flex items-center gap-1 cursor-pointer ${
                excelTab === 'import' 
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" /> Impor dari Excel
            </button>
          </div>
        </div>

        {excelTab === 'export' ? (
          /* EKSPOR DATA PANEL */
          <div className="space-y-6">
            {/* Top Multi-Sheet Download Banner */}
            <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-teal-100/40 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 rounded-2xl border border-teal-200 dark:border-teal-800 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold font-mono uppercase tracking-wide shadow-sm">
                      <FileSpreadsheet className="w-3 h-3" /> Paket Resmi 7 Modul (.xlsx)
                    </span>
                    <span className="text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded font-bold font-mono">
                      8 Lembar Kerja Terpadu
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Download Paket Multi-Sheet Excel Penuh (.xlsx)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Menyajikan 8 lembar kerja pembukuan Desa Adat lengkap: Cover Rekapitulasi Eksekutif, BKU, BKP, Anggaran APBDes, Dana Punia, Urunan Krama, Buku Jurnal Umum, dan Pepeson Desa. Dilengkapi format angka akuntansi (Rupiah), lebar kolom proporsional otomatis, serta verifikasi matematis saldo.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  <button
                    onClick={handleExportAllToXLSX}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-emerald-600/25 transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Download Excel 7 Modul (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleExportAllToExcelXML}
                    title="Unduh format lama berbasis XML Spreadsheet (.xls)"
                    className="px-3.5 py-3 border border-teal-300 dark:border-teal-700 bg-white/80 dark:bg-slate-900/80 hover:bg-teal-50 dark:hover:bg-teal-950 text-teal-800 dark:text-teal-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Legacy (.xls)</span>
                  </button>
                </div>
              </div>

              {/* Year Filter & Metrics Bar */}
              <div className="pt-3 border-t border-teal-200/70 dark:border-teal-800/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                    <Filter className="w-3.5 h-3.5 text-teal-600" /> Periode Ekspor:
                  </span>
                  <select
                    value={exportYearFilter}
                    onChange={(e) => setExportYearFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg px-3 py-1.5 shadow-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">Semua Tahun (Konsolidasi Seluruh Periode)</option>
                    {availableExportYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Tahun Anggaran {yr}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total siap ekspor: <strong className="text-emerald-700 dark:text-emerald-400">{filteredModuleStats.totalRows} baris</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    BKU: <strong>{filteredModuleStats.bkuCount}</strong>
                  </span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    BKP: <strong>{filteredModuleStats.bkpCount}</strong>
                  </span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    Anggaran: <strong>{filteredModuleStats.anggaranCount}</strong>
                  </span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    Punia: <strong>{filteredModuleStats.puniaCount}</strong>
                  </span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    Urunan: <strong>{filteredModuleStats.urunanCount}</strong>
                  </span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    Jurnal: <strong>{filteredModuleStats.jurnalCount}</strong>
                  </span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    Pepeson: <strong>{filteredModuleStats.pepesonCount}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Delimiter preference selector */}
            <div className="flex items-center gap-4 text-xs border-b border-slate-100 dark:border-slate-800 pb-4">
              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase">Pembagi CSV:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                <input
                  type="radio"
                  name="delimiter"
                  checked={csvDelimiter === ';'}
                  onChange={() => setCsvDelimiter(';')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                Titik Koma ( ; ) <span className="text-[10px] text-slate-400 font-normal">(Excel Indonesia)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                <input
                  type="radio"
                  name="delimiter"
                  checked={csvDelimiter === ','}
                  onChange={() => setCsvDelimiter(',')}
                  className="text-teal-600 focus:ring-teal-500"
                />
                Koma ( , ) <span className="text-[10px] text-slate-400 font-normal">(Standard US)</span>
              </label>
            </div>

            {/* Grid list of individual table exports for 7 modules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* 1. BKU */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">1. Buku Kas Umum (BKU)</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.bkuCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Penerimaan, pengeluaran kas, kode rekening, kategori, dan saldo akhir kas.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Saldo Kas: <strong>{formatRp(filteredModuleStats.bkuSaldo)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('bku')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('bku')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* 2. BKP */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">2. Buku Kas Pembantu (BKP)</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.bkpCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">No bukti nota belanja, debet, kredit/belanja riil, dan saldo kas pembantu.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Total Belanja: <strong>{formatRp(filteredModuleStats.bkpTotal)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('bkp')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('bkp')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* 3. Anggaran APBDes */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">3. Anggaran APBDes</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.anggaranCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Kode rekening, bidang, volume, satuan, harga satuan, pagu anggaran.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Total Pagu: <strong>{formatRp(filteredModuleStats.anggaranTotal)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('anggaran')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('anggaran')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* 4. Dana Punia */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">4. Dana Punia</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.puniaCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Donatur, jenis punia (transfer, tunai, barang, sasah-abu), qty, nominal.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Total Donasi: <strong>{formatRp(filteredModuleStats.puniaTotal)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('dana_punia')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('dana_punia')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* 5. Urunan Krama */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">5. Urunan Krama</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.urunanCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Nama krama/banjar, uraian urunan karya/piodalan, nominal & total.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Total Setoran: <strong>{formatRp(filteredModuleStats.urunanTotal)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('urunan')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('urunan')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* 6. Buku Jurnal Umum */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">6. Buku Jurnal Umum</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.jurnalCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Row ID, kode rekening, uraian akun, debet, kredit, tipe baris.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Total Debet: <strong>{formatRp(filteredModuleStats.jurnalTotal)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('jurnal')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('jurnal')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>

              {/* 7. Pepeson Desa */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-700 transition">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">7. Pepeson Desa</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold font-mono">{filteredModuleStats.pepesonCount} baris</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Nama pos/barang, krama penerima, qty, satuan, jumlah krama & total.</p>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
                    Total Nilai: <strong>{formatRp(filteredModuleStats.pepesonTotal)}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleExportSingleXLSX('pepeson')}
                    className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExportSingleCSV('pepeson')}
                    className="py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg font-semibold text-[11px] transition text-slate-700 dark:text-slate-300 cursor-pointer text-center"
                  >
                    CSV (.csv)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* IMPOR DATA PANEL */
          <div className="space-y-6">
            <div className="p-4 bg-teal-50 dark:bg-teal-950/20 rounded-xl border border-teal-200 dark:border-teal-800 flex items-start gap-3">
              <span className="text-teal-600 dark:text-teal-400 font-bold">ℹ️</span>
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-slate-800 dark:text-slate-200">Panduan Impor Data Spreadsheet 7 Modul:</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">Pilih salah satu dari 7 modul pembukuan Desa Adat, unduh template resmi format Excel (.xlsx) atau CSV untuk memastikan susunan kolom sesuai, lalu upload berkas hasil pengisian Anda.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="lg:col-span-6">
                <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1.5">1. Pilih Modul Pembukuan Yang Ingin Di-Impor</label>
                <select
                  value={importTarget}
                  onChange={(e) => {
                    setImportTarget(e.target.value as any);
                    setParsedHeaders([]);
                    setParsedRows([]);
                    setValidatedData([]);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-bold"
                >
                  <option value="bku">1. Buku Kas Umum (BKU)</option>
                  <option value="bkp">2. Buku Kas Pembantu (BKP)</option>
                  <option value="anggaran">3. Anggaran APBDes</option>
                  <option value="dana_punia">4. Dana Punia</option>
                  <option value="urunan">5. Urunan Krama</option>
                  <option value="jurnal">6. Buku Jurnal Umum</option>
                  <option value="pepeson">7. Pepeson Desa</option>
                </select>
              </div>

              <div className="lg:col-span-6 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleDownloadTemplateXLSX}
                  className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Template Excel (.xlsx)
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-500" /> Template CSV (.csv)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 font-mono mb-1.5">2. Upload File Excel atau CSV</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:dark:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-950/40"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv, .txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <FileSpreadsheet className="w-9 h-9 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {fileName ? `File terpilih: ${fileName}` : 'Klik untuk menjelajahi berkas Excel (.xlsx / .xls) atau CSV dari komputer'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Format file didukung: Microsoft Excel (.xlsx, .xls) atau CSV / Teks (.csv, .txt)</p>
              </div>
            </div>

            {isParsing && (
              <div className="flex justify-center items-center py-8 gap-2 text-xs font-mono text-emerald-600">
                <RefreshCw className="w-4 h-4 animate-spin" /> Membaca & Menganalisis Berkas Spreadsheet...
              </div>
            )}

            {!isParsing && parsedHeaders.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" /> 
                      Pratinjau Data Impor ({validatedData.length} baris)
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="font-mono text-[9px] font-bold text-slate-400 uppercase pl-1">Aksi:</span>
                    <label className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Gabung (Append)
                    </label>
                    <label className="flex items-center gap-1 font-bold text-red-500 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-red-500 focus:ring-red-500"
                      />
                      Timpa (Replace)
                    </label>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-950/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-mono text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-2.5">Baris</th>
                          {parsedHeaders.map((h, i) => (
                            <th key={i} className="p-2.5 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedRows.slice(0, 5).map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            <td className="p-2.5 font-mono text-slate-400 font-bold">{rowIndex + 2}</td>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="p-2.5 text-slate-800 dark:text-slate-300 truncate max-w-[200px]" title={cell}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleExecuteImport}
                    disabled={validatedData.length === 0}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow transition cursor-pointer ${
                      validatedData.length === 0
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : importMode === 'replace'
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-teal-600 hover:bg-teal-500 text-white'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {importMode === 'replace' ? 'Timpa Database' : `Konfirmasi Impor ${validatedData.length} Data`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2 font-mono">
              <Lock className="w-4 h-4 text-teal-600" /> Verifikasi Pengurus
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Simpan perubahan identitas Desa Adat Basangalas.
            </p>

            <div className="space-y-4">
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveProfile}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Konfirmasi & Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative text-slate-800 dark:text-slate-200">
            <button
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-lg shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight uppercase font-mono tracking-wide">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            {confirmModal.requireTextMatch && confirmModal.matchText && (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-4 text-xs">
                <p className="text-slate-500 dark:text-slate-400 mb-2">
                  Ketik kata kunci untuk konfirmasi:
                </p>
                <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 font-mono font-bold text-red-600 text-center select-all mb-3 text-xs">
                  {confirmModal.matchText}
                </div>
                <input
                  type="text"
                  value={confirmModal.inputText || ''}
                  onChange={(e) => setConfirmModal(prev => ({ ...prev, inputText: e.target.value }))}
                  placeholder={`Ketik '${confirmModal.matchText}'`}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono text-center"
                  autoFocus
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                disabled={confirmModal.requireTextMatch && confirmModal.inputText !== confirmModal.matchText}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 text-white ${
                  confirmModal.requireTextMatch && confirmModal.inputText !== confirmModal.matchText
                    ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed text-slate-500'
                    : 'bg-red-600 hover:bg-red-500 cursor-pointer shadow-sm'
                }`}
              >
                Konfirmasi Tindakan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE PAD & UPLOAD MODAL */}
      <DigitalSignaturePadModal
        isOpen={signatureModalConfig.isOpen}
        onClose={() => setSignatureModalConfig(prev => ({ ...prev, isOpen: false }))}
        onSave={handleSaveSignatureResult}
        title={signatureModalConfig.title}
        roleName={signatureModalConfig.roleName}
        initialSignature={signatureModalConfig.initialSignature}
      />
    </div>
  );
};

export default Pengaturan;
