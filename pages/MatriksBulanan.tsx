import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Printer, 
  Download, 
  Scale, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Settings2, 
  Maximize2, 
  Minimize2, 
  X, 
  ChevronRight, 
  Info, 
  Sparkles, 
  FileSpreadsheet, 
  Eye, 
  EyeOff, 
  SlidersHorizontal,
  Bookmark,
  Check,
  RotateCcw,
  Percent,
  CalendarDays
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { JuDisplayRow, MonthlyData, BkuData, BudgetItem, DanaPuniaItem, UrunanItem, ManualBudgetCaps } from '../types';
import { formatCurrency } from '../utils/formatter';
import { exportElementToPdf } from '../utils/pdfExport';
import { 
  DigitalSignatures, 
  SignatureSettings, 
  getStoredSignatures, 
  getSignatureSettings, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  getSignatureScale, 
  getStampScale 
} from '../utils/signatureStorage';
import { REFERENSI_REKENING, isKasAccount } from '../constants';
import { useNotification } from '../context/NotificationContext';
import { playSyncSuccessSound, playSaveSuccessSound } from '../utils/soundEffects';

interface MatriksBulananProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  budgetItems?: BudgetItem[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
  manualBudgetCaps?: ManualBudgetCaps;
  setActivePage?: (page: string) => void;
  onOpenJurnalWithAccounts?: (debet: string, kredit: string) => void;
}

// Opsi Pilihan Penjilidan (Binding Margin)
export type BindingOption = 'none' | 'left-20' | 'left-25' | 'left-30' | 'top-25';

interface BindingConfig {
  id: BindingOption;
  label: string;
  description: string;
  leftMm: number;
  topMm: number;
  rightMm: number;
  bottomMm: number;
  holeGuide: 'none' | 'left-holes' | 'left-spiral' | 'top-holes';
}

const BINDING_OPTIONS: BindingConfig[] = [
  {
    id: 'none',
    label: 'Tanpa Penjilidan (Standar 10mm)',
    description: 'Margin simetris untuk arsip digital atau lembar lepas.',
    leftMm: 10,
    topMm: 10,
    rightMm: 10,
    bottomMm: 10,
    holeGuide: 'none'
  },
  {
    id: 'left-20',
    label: 'Jilid Kiri Standar (20mm)',
    description: 'Margin kiri ekstra 20mm untuk stapler, paper clip, atau map snelhechter.',
    leftMm: 20,
    topMm: 10,
    rightMm: 8,
    bottomMm: 10,
    holeGuide: 'left-holes'
  },
  {
    id: 'left-25',
    label: 'Jilid Kiri Spiral / Ring Kawat (25mm)',
    description: 'Standar baku jilid spiral/buku laporan pertanggungjawaban desa adat.',
    leftMm: 25,
    topMm: 10,
    rightMm: 8,
    bottomMm: 10,
    holeGuide: 'left-spiral'
  },
  {
    id: 'left-30',
    label: 'Jilid Kiri Lakban Tebal / Hard Cover (30mm)',
    description: 'Ruang ekstra 30mm aman dari lakban hitam tebal atau jilid benang/buku.',
    leftMm: 30,
    topMm: 10,
    rightMm: 8,
    bottomMm: 10,
    holeGuide: 'left-holes'
  },
  {
    id: 'top-25',
    label: 'Jilid Atas / Portrait Header (25mm)',
    description: 'Margin atas ekstra 25mm untuk penjilidan atas, clipboard, atau gantungan dokumen.',
    leftMm: 10,
    topMm: 25,
    rightMm: 10,
    bottomMm: 10,
    holeGuide: 'top-holes'
  }
];

export const MatriksBulanan: React.FC<MatriksBulananProps> = ({
  entries = [],
  bkuData = [],
  budgetItems = [],
  danaPuniaItems = [],
  urunanItems = [],
  manualBudgetCaps,
  setActivePage,
  onOpenJurnalWithAccounts
}) => {
  const { showNotification } = useNotification();

  // State Filter Tahun
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    entries.forEach(e => {
      if (e.date) {
        const d = new Date(e.date);
        if (!isNaN(d.getTime())) years.add(d.getFullYear());
      }
    });
    bkuData.forEach(b => {
      if (b.tanggal) {
        const d = new Date(b.tanggal);
        if (!isNaN(d.getTime())) years.add(d.getFullYear());
      }
    });
    budgetItems.forEach(b => {
      if (b.tahun && !isNaN(Number(b.tahun))) {
        years.add(Number(b.tahun));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [entries, bkuData, budgetItems]);

  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // Mode Tampilan: 'interactive' (tabel & kartu kerja) atau 'document' (format siap cetak dengan KOP & jilid)
  const [viewMode, setViewMode] = useState<'document' | 'interactive'>('interactive');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Penjilidan Configuration State
  const [selectedBinding, setSelectedBinding] = useState<BindingOption>(() => {
    return (localStorage.getItem('matriks_binding_option') as BindingOption) || 'left-25';
  });
  const [showHoleGuides, setShowHoleGuides] = useState<boolean>(() => {
    return localStorage.getItem('matriks_show_hole_guide') !== 'false';
  });
  const [isBindingModalOpen, setIsBindingModalOpen] = useState(false);

  // Pejabat & Signatures Configuration State
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [signatureSettings, setSignatureSettings] = useState<SignatureSettings>(() => getSignatureSettings());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStamp, setShowStamp] = useState<boolean>(() => isStampOverlayEnabled());
  const [sigScale, setSigScale] = useState<number>(() => getSignatureScale());
  const [stampScaleVal, setStampScaleVal] = useState<number>(() => getStampScale());
  const [isSignerModalOpen, setIsSignerModalOpen] = useState(false);

  // Data Profil Desa Adat
  const [villageProfile, setVillageProfile] = useState(() => {
    const saved = localStorage.getItem('basangalas_profile') || localStorage.getItem('village_profile') || localStorage.getItem('tigalikur_profile');
    const defaultData = {
      namaDesa: 'DESA ADAT BASANGALAS',
      alamat: 'Sekretariat: Jln. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852',
      namaKetua: localStorage.getItem('bku_keliangName') || 'I Made Mudita',
      namaBendahara: localStorage.getItem('bku_juruRaksaName') || 'I Putu Gede Sutrana',
      namaSekretaris: localStorage.getItem('bku_penyarikanName') || ' ',
      tempat: localStorage.getItem('bku_customPlace') || 'Basangalas',
      tanggalLaporan: new Date().toISOString().split('T')[0]
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultData,
          namaDesa: parsed.namaDesa || defaultData.namaDesa,
          alamat: parsed.alamat || defaultData.alamat,
          namaKetua: parsed.namaKetua || defaultData.namaKetua,
          namaBendahara: parsed.namaBendahara || defaultData.namaBendahara,
          namaSekretaris: parsed.namaSekretaris || defaultData.namaSekretaris
        };
      } catch (e) {
        console.error('Error parsing profile in MatriksBulanan:', e);
      }
    }
    return defaultData;
  });

  // Temporary Form Data untuk Modal Pengaturan Pejabat
  const [tempProfile, setTempProfile] = useState(villageProfile);

  // Listener Pembaruan Tanda Tangan & Stempel Digital dari modul lain
  useEffect(() => {
    const handleSigsChanged = () => {
      setSignatures(getStoredSignatures());
      setSignatureSettings(getSignatureSettings());
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
      setSigScale(getSignatureScale());
      setStampScaleVal(getStampScale());
    };

    window.addEventListener('signatures-updated', handleSigsChanged);
    return () => window.removeEventListener('signatures-updated', handleSigsChanged);
  }, []);

  // Cleanup print class after print
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-matriks-bulanan-mode');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-matriks-bulanan-mode');
    };
  }, []);

  // Save binding selection to localStorage
  const handleSelectBinding = (opt: BindingOption) => {
    setSelectedBinding(opt);
    localStorage.setItem('matriks_binding_option', opt);
    showNotification(`Format penjilidan diatur ke: ${BINDING_OPTIONS.find(b => b.id === opt)?.label}`, 'info');
  };

  const handleToggleHoleGuide = (val: boolean) => {
    setShowHoleGuides(val);
    localStorage.setItem('matriks_show_hole_guide', String(val));
  };

  // Simpan Pengaturan Pejabat Penandatangan
  const handleSaveSigners = () => {
    setVillageProfile(tempProfile);
    localStorage.setItem('bku_keliangName', tempProfile.namaKetua);
    localStorage.setItem('bku_juruRaksaName', tempProfile.namaBendahara);
    localStorage.setItem('bku_penyarikanName', tempProfile.namaSekretaris);
    localStorage.setItem('bku_customPlace', tempProfile.tempat);
    
    // Simpan juga ke profile bersama
    try {
      const saved = localStorage.getItem('basangalas_profile') || '{}';
      const parsed = JSON.parse(saved);
      parsed.namaDesa = tempProfile.namaDesa;
      parsed.alamat = tempProfile.alamat;
      parsed.namaKetua = tempProfile.namaKetua;
      parsed.namaBendahara = tempProfile.namaBendahara;
      parsed.namaSekretaris = tempProfile.namaSekretaris;
      localStorage.setItem('basangalas_profile', JSON.stringify(parsed));
    } catch (e) {}

    playSaveSuccessSound();
    setIsSignerModalOpen(false);
    showNotification('Data pejabat penandatangan berhasil diperbarui.', 'success');
  };

  // --- KALKULASI DATA MATRIKS REKAPITULASI FINANSIAL BULANAN ---
  // Logika sinkron dengan Ringkasan Eksekutif & Neraca
  const matrixMonthlyData: MonthlyData[] = useMemo(() => {
    const monthly: { [key: string]: { penerimaan: number; realisasi: number } } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    
    if (selectedYear !== 'all') {
      monthNames.forEach(m => {
        const key = `${m} ${selectedYear}`;
        monthly[key] = { penerimaan: 0, realisasi: 0 };
      });
    }

    const targetEntries = selectedYear === 'all' 
      ? entries 
      : entries.filter(e => {
          if (!e.date) return false;
          const d = new Date(e.date);
          return !isNaN(d.getTime()) && d.getFullYear() === Number(selectedYear);
        });

    targetEntries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const key = selectedYear === 'all' ? `${monthNames[monthIndex]} ${year}` : `${monthNames[monthIndex]} ${selectedYear}`;
      
      if (!monthly[key]) {
        monthly[key] = { penerimaan: 0, realisasi: 0 };
      }

      const rawCode = e.kodeRekening || '';
      const cleanCode = rawCode.split(' - ')[0].trim();
      const kreditVal = Number(e.kredit) || 0;
      const debetVal = Number(e.debet) || 0;

      // Bila filter per tahun aktif, kecualikan akun SiLPA (6.1.1.01) dari penerimaan bulanan berjalan
      // agar tidak terhitung ganda dengan baris khusus "SILPA TAHUN LALU"
      const isSilpaAccount = cleanCode === '6.1.1.01' || cleanCode.startsWith('6.1.1');
      if (selectedYear !== 'all' && isSilpaAccount) {
        return;
      }

      // Penerimaan: Kelompok 4 (Pendapatan), Kelompok 7 (Sumber Dana/Hibah), Kelompok 6 (Pembiayaan)
      if (cleanCode.startsWith('4') || cleanCode.startsWith('7') || cleanCode.startsWith('6')) {
        monthly[key].penerimaan += (kreditVal - debetVal);
      }
      // Pengeluaran: Kelompok 5 (Belanja)
      if (cleanCode.startsWith('5')) {
        monthly[key].realisasi += (debetVal - kreditVal);
      }
    });

    return Object.entries(monthly)
      .map(([name, values]) => ({ name, ...values }))
      .sort((a,b) => {
        const [mA, yA] = a.name.split(' ');
        const [mB, yB] = b.name.split(' ');
        if (yA !== yB) return Number(yA) - Number(yB);
        return monthNames.indexOf(mA) - monthNames.indexOf(mB);
      });
  }, [entries, selectedYear]);

  // Perhitungan Silpa Tahun Lalu dan Saldo Akhir Komulatif
  const { 
    matrixSilpaTahunLalu, 
    matrixSaldoAkhir, 
    matrixTotalPenerimaan, 
    matrixTotalRealisasi, 
    matrixSurplusDefisit 
  } = useMemo(() => {
    const totalPenerimaan = matrixMonthlyData.reduce((acc, m) => acc + m.penerimaan, 0);
    const totalRealisasi = matrixMonthlyData.reduce((acc, m) => acc + m.realisasi, 0);
    const surplusDefisit = totalPenerimaan - totalRealisasi;

    if (selectedYear === 'all') {
      return {
        matrixSilpaTahunLalu: 0,
        matrixSaldoAkhir: surplusDefisit,
        matrixTotalPenerimaan: totalPenerimaan,
        matrixTotalRealisasi: totalRealisasi,
        matrixSurplusDefisit: surplusDefisit
      };
    }

    const numYear = Number(selectedYear);
    let priorCashBalance = 0;
    let hasPriorEntries = false;

    // 1. Akumulasi saldo kas riil dari Jurnal Umum sebelum tahun selectedYear (Akun 1.1.*)
    entries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() < numYear) {
        const code = (e.kodeRekening || '').trim();
        if (isKasAccount(code) || code.startsWith('1.1')) {
          hasPriorEntries = true;
          priorCashBalance += ((Number(e.debet) || 0) - (Number(e.kredit) || 0));
        }
      }
    });

    // 2. Jika belum ada entri jurnal di tahun sebelumnya, gunakan data BKU
    if (!hasPriorEntries && bkuData.length > 0) {
      bkuData.forEach(b => {
        if (!b.tanggal) return;
        const d = new Date(b.tanggal);
        if (isNaN(d.getTime())) return;
        if (d.getFullYear() < numYear) {
          priorCashBalance += ((Number(b.penerimaan) || 0) - (Number(b.pengeluaran) || 0));
        }
      });
    }

    // 3. Periksa akun SiLPA (6.1.1.01) tercatat di tahun berjalan jika ada
    let explicitSilpaInYear = 0;
    entries.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() === numYear) {
        const rawCode = (e.kodeRekening || '').trim();
        const cleanCode = rawCode.split(' - ')[0].trim();
        if (cleanCode === '6.1.1.01' || cleanCode.startsWith('6.1.1')) {
          explicitSilpaInYear += (Number(e.kredit) || 0) - (Number(e.debet) || 0);
        }
      }
    });

    const silpaTahunLalu = priorCashBalance !== 0 ? priorCashBalance : explicitSilpaInYear;
    const saldoAkhir = silpaTahunLalu + surplusDefisit;

    return {
      matrixSilpaTahunLalu: silpaTahunLalu,
      matrixSaldoAkhir: saldoAkhir,
      matrixTotalPenerimaan: totalPenerimaan,
      matrixTotalRealisasi: totalRealisasi,
      matrixSurplusDefisit: surplusDefisit
    };
  }, [entries, bkuData, matrixMonthlyData, selectedYear]);

  // Overall serapan rasio
  const overallSerapanRate = matrixTotalPenerimaan > 0 
    ? (matrixTotalRealisasi / matrixTotalPenerimaan) * 100 
    : 0;

  // Stempel & Tanda Tangan Dimension Ratios
  const effectiveStamp = useMemo(() => {
    return getEffectiveStamp(signatures, villageProfile.namaDesa);
  }, [signatures, villageProfile.namaDesa]);

  const scaleRatio = Math.max(0.5, Math.min(1.8, sigScale / 100));
  const stampRatio = Math.max(0.5, Math.min(1.8, stampScaleVal / 100));
  const sigImgHeight = Math.round(52 * scaleRatio);
  const sigImgMaxWidth = Math.round(135 * scaleRatio);
  const stampBoxSize = Math.round(78 * stampRatio);

  // Active Binding Config
  const activeBindingConfig = useMemo(() => {
    return BINDING_OPTIONS.find(b => b.id === selectedBinding) || BINDING_OPTIONS[2];
  }, [selectedBinding]);

  // Handler Cetak Kertas Fisik (dengan mode penjilidan)
  const handlePrintDocument = () => {
    if (viewMode !== 'document') {
      setViewMode('document');
    }
    document.body.classList.add('print-matriks-bulanan-mode');
    showNotification('Mempersiapkan dokumen cetak matriks bulanan...', 'info');
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Handler Unduh PDF Resmi
  const handleDownloadPdf = async () => {
    if (viewMode !== 'document') {
      setViewMode('document');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    setIsExportingPdf(true);
    const yearLabel = selectedYear === 'all' ? 'Semua_Tahun' : `TA_${selectedYear}`;
    const filename = `Matriks_Realisasi_Finansial_Bulanan_${yearLabel}.pdf`;

    try {
      showNotification('Menyusun PDF beresolusi tinggi dengan penjilidan presisi...', 'info');
      // Terapkan margin penjilidan sesuai pilihan
      const marginArr: [number, number, number, number] = [
        activeBindingConfig.topMm,
        activeBindingConfig.rightMm,
        activeBindingConfig.bottomMm,
        activeBindingConfig.leftMm
      ];

      await exportElementToPdf('printable-matriks-bulanan-doc', {
        filename,
        orientation: 'portrait',
        format: 'a4',
        margin: marginArr,
        scale: 2.5,
        enableWatermark: true,
        watermarkText: villageProfile.namaDesa || 'Desa Adat Basangalas'
      });

      playSyncSuccessSound();
      showNotification('Dokumen PDF Matriks Bulanan berhasil diunduh.', 'success');
    } catch (err) {
      console.error('Failed to export PDF Matriks Bulanan:', err);
      showNotification('Gagal mengekspor PDF. Silakan coba kembali.', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handler Ekspor ke Spreadsheet Excel (.xlsx)
  const handleExportXlsx = () => {
    try {
      const yearLabel = selectedYear === 'all' ? 'Semua Tahun (Komulatif)' : `Tahun Anggaran ${selectedYear}`;
      
      const rows: any[] = [
        [villageProfile.namaDesa.toUpperCase()],
        ['KECAMATAN ABANG, KABUPATEN KARANGASEM - BALI'],
        [villageProfile.alamat],
        [''],
        ['MATRIKS REKAPITULASI REALISASI FINANSIAL BULANAN'],
        [`Periode: ${yearLabel}`],
        [`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
        [''],
        ['No', 'Bulan / Periode', 'Penerimaan Kas (Rp)', 'Realisasi Belanja (Rp)', 'Surplus / (Defisit) (Rp)', 'Rasio Serapan (%)', 'Status Fiskal']
      ];

      matrixMonthlyData.forEach((m, idx) => {
        const diff = m.penerimaan - m.realisasi;
        const rate = m.penerimaan > 0 ? (m.realisasi / m.penerimaan) * 100 : 0;
        rows.push([
          idx + 1,
          m.name,
          m.penerimaan,
          m.realisasi,
          diff,
          Number(rate.toFixed(1)),
          diff >= 0 ? 'Surplus' : 'Defisit'
        ]);
      });

      rows.push(['']);
      rows.push([
        '',
        'TOTAL KOMULATIF',
        matrixTotalPenerimaan,
        matrixTotalRealisasi,
        matrixSurplusDefisit,
        Number(overallSerapanRate.toFixed(1)),
        matrixSurplusDefisit >= 0 ? 'Surplus' : 'Defisit'
      ]);

      if (selectedYear !== 'all') {
        rows.push(['', 'SILPA TAHUN LALU', '', '', matrixSilpaTahunLalu, '', 'SiLPA']);
        rows.push(['', 'SALDO AKHIR KAS (KOMULATIF)', '', '', matrixSaldoAkhir, '', 'Saldo Akhir']);
      }

      rows.push(['']);
      rows.push(['Lembar Pengesahan:']);
      rows.push(['Keliang Adat:', villageProfile.namaKetua, 'Petengen / Bendahara:', villageProfile.namaBendahara, 'Penyarikan / Sekretaris:', villageProfile.namaSekretaris]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 16 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Matriks Bulanan');
      XLSX.writeFile(wb, `Matriks_Bulanan_${selectedYear === 'all' ? 'Semua_Tahun' : selectedYear}.xlsx`);

      playSyncSuccessSound();
      showNotification('File Excel Matriks Bulanan berhasil diunduh.', 'success');
    } catch (e) {
      console.error('Export XLSX error:', e);
      showNotification('Gagal mengekspor berkas Excel.', 'error');
    }
  };

  const periodeLabel = selectedYear === 'all' ? 'Semua Tahun (Komulatif)' : `Tahun Anggaran ${selectedYear}`;
  const currentDateFormatted = new Date(villageProfile.tanggalLaporan).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const sigSettings = signatureSettings;
  const keliangName = villageProfile.namaKetua || 'I Made Mudita';
  const juruRaksaName = villageProfile.namaBendahara || 'I Putu Gede Sutrana';
  const customPlace = villageProfile.tempat || 'Basangalas';
  const formattedSigDate = currentDateFormatted;

  return (
    <div className="space-y-6 pb-12">
      {/* --- HEADER UTAMA HALAMAN --- */}
      <div className="no-print bg-white border-b-4 border-teal-800/40 rounded-2xl p-4 sm:p-6 relative overflow-hidden">

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-teal-500/20 border border-teal-400/30 rounded-2xl text-teal-300 shadow-inner">
              <CalendarDays size={28} className="text-teal-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-wide font-serif">
                  Matriks Bulanan
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  {periodeLabel}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                Tabel matriks komparasi realisasi penerimaan kas dan belanja per bulan secara kronologis, dilengkapi fitur penjilidan berkas rapi, tanda tangan otomatis, dan ekspor PDF resmi.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Filter Tahun */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-1.5">
              <Calendar size={14} className="text-teal-400 shrink-0" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
                title="Pilih Tahun Anggaran"
              >
                <option value="all" className="bg-slate-900 text-white">Semua Tahun</option>
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">Tahun {y}</option>
                ))}
              </select>
            </div>

            {/* Toggle View Mode */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'interactive'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Tampilan Tabel Interaktif & Kartu Metrik"
              >
                <Layers size={13} />
                <span>Interaktif</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('document')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'document'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Tampilan Format Dokumen Resmi Siap Cetak (A4 Portrait dengan Penjilidan)"
              >
                <FileText size={13} />
                <span>Dokumen Cetak</span>
              </button>
            </div>

            {/* Opsi Penjilidan Button */}
            <button
              type="button"
              onClick={() => setIsBindingModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
              title="Atur margin penjilidan (stapler, spiral, lakban, lubang perforasi)"
            >
              <Bookmark size={14} className="text-indigo-400" />
              <span className="hidden sm:inline">Jilid:</span>
              <span className="text-white font-mono text-[11px] truncate max-w-[85px]">
                {activeBindingConfig.leftMm > 10 ? `Kiri ${activeBindingConfig.leftMm}mm` : activeBindingConfig.topMm > 10 ? `Atas ${activeBindingConfig.topMm}mm` : '10mm'}
              </span>
            </button>

            {/* Opsi Pejabat Penandatangan Button */}
            <button
              type="button"
              onClick={() => {
                setTempProfile(villageProfile);
                setIsSignerModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
              title="Sesuaikan nama pejabat, tempat, dan tanggal pengesahan"
            >
              <Settings2 size={14} className="text-slate-400" />
              <span className="hidden sm:inline">Prajuru</span>
            </button>

            {/* Ekspor Excel */}
            <button
              type="button"
              onClick={handleExportXlsx}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Ekspor ke lembar kerja Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            {/* Unduh PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Unduh dokumen matriks bulanan ke berkas PDF A4 Portrait dengan penjilidan"
            >
              {isExportingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Proses PDF...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Tombol Cetak Dokumen */}
            <button
              type="button"
              onClick={handlePrintDocument}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
              title="Buka dialog printer untuk cetak langsung ke kertas fisik atau Print to PDF"
            >
              <Printer size={14} />
              <span>Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- BANNER STATUS PENJILIDAN & TANDA TANGAN OTOMATIS --- */}
      <div className="no-print bg-slate-50 border border-slate-700/80 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <Bookmark size={15} className="text-indigo-500" />
            <span className="text-slate-500">Format Penjilidan:</span>
            <strong className="text-white font-mono bg-indigo-950/70 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/60">
              {activeBindingConfig.label}
            </strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Margin:</span>
            <span className="font-mono text-slate-500">
              Kiri: {activeBindingConfig.leftMm}mm • Atas: {activeBindingConfig.topMm}mm • Kanan: {activeBindingConfig.rightMm}mm • Bawah: {activeBindingConfig.bottomMm}mm
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* TTD Digital Status */}
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className={embedSignatures ? "text-emerald-400" : "text-slate-500"} />
            <span className="text-slate-500">TTD Digital:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
              embedSignatures ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-slate-700 text-slate-400"
            }`}>
              {embedSignatures ? "Otomatis Aktif" : "Nonaktif"}
            </span>
          </div>

          {/* Stempel Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Stempel Resmi:</span>
            <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
              showStamp ? "bg-rose-950 text-rose-300 border border-rose-800" : "bg-slate-700 text-slate-400"
            }`}>
              {showStamp ? "Otomatis Aktif" : "Nonaktif"}
            </span>
          </div>

          {/* Quick toggle hole guide */}
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-white select-none">
            <input 
              type="checkbox" 
              checked={showHoleGuides} 
              onChange={(e) => handleToggleHoleGuide(e.target.checked)}
              className="rounded border-slate-600 text-teal-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px]">Panduan Jilid</span>
          </label>
        </div>
      </div>

      {/* --- 4 KARTU METRIK KPI UTAMA (Ringkasan Eksekutif Finansial) --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
        {/* 1. Total Penerimaan */}
        <div className="bg-slate-50 border border-emerald-500/30 rounded-2xl p-4 shadow-xl hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Total Penerimaan
            </span>
            <TrendingUp size={16} />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-emerald-300">
            {formatCurrency(matrixTotalPenerimaan)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Kas masuk operasional, hibah &amp; punia ({matrixMonthlyData.length} periode)
          </p>
        </div>

        {/* 2. Total Realisasi Belanja */}
        <div className="bg-slate-50 border border-rose-500/50 rounded-2xl p-4 shadow-xl hover:border-slate-500/60 transition-all">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Total Realisasi Belanja
            </span>
            <TrendingDown size={16} />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-rose-700">
            {formatCurrency(matrixTotalRealisasi)}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
            <span>Serapan Anggaran</span>
            <span className="font-bold font-mono text-rose-700">{overallSerapanRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* 3. Surplus / Defisit Berjalan */}
        <div className={`bg-slate-50 border rounded-2xl p-4 shadow-xl transition-all ${
          matrixSurplusDefisit >= 0 ? 'border-teal-500/30 hover:border-teal-500/60' : 'border-amber-500/30 hover:border-amber-500/60'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              matrixSurplusDefisit >= 0 ? 'text-teal-300' : 'text-amber-300'
            }`}>
              Surplus / (Defisit)
            </span>
            <Scale size={16} className={matrixSurplusDefisit >= 0 ? 'text-teal-400' : 'text-amber-400'} />
          </div>
          <p className={`text-lg sm:text-xl font-black font-mono ${
            matrixSurplusDefisit >= 0 ? 'text-teal-300' : 'text-rose-400'
          }`}>
            {matrixSurplusDefisit >= 0 ? `+${formatCurrency(matrixSurplusDefisit)}` : formatCurrency(matrixSurplusDefisit)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {matrixSurplusDefisit >= 0 ? 'Surplus operasional tahun berjalan' : 'Defisit operasional tahun berjalan'}
          </p>
        </div>

        {/* 4. Saldo Kas Akhir */}
        <div className="bg-slate-50 border border-sky-500/30 rounded-2xl p-4 shadow-xl hover:border-sky-500/60 transition-all">
          <div className="flex items-center justify-between text-sky-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
              {selectedYear === 'all' ? 'Kas Netto Komulatif' : 'Saldo Akhir Kas'}
            </span>
            <Wallet size={16} />
          </div>
          <p className="text-lg sm:text-xl font-black font-mono text-sky-300">
            {formatCurrency(matrixSaldoAkhir)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {selectedYear === 'all' ? 'Akumulasi kas riil bersih' : `Termasuk SiLPA: ${formatCurrency(matrixSilpaTahunLalu)}`}
          </p>
        </div>
      </div>

      {/* --- MODE INTERAKTIF: TABEL WEB DENGAN FILTER & GRAFIK MINI --- */}
      {viewMode === 'interactive' && (
        <div className="no-print bg-white border border-slate-400 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-800 font-serif tracking-wide flex items-center gap-2">
                <span>Tabel Realisasi Finansial Bulanan</span>
                <span className="text-xs font-mono font-normal text-slate-500">
                  ({matrixMonthlyData.length} Bulan/Periode Tercatat)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan rinci penerimaan dan penyerapan belanja bulanan
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('document')}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-100 hover:text-teal-300 bg-teal-950/60 hover:bg-teal-900/60 border border-teal-800/60 px-3 py-1.5 rounded-lg transition-all"
              >
                <span>Beralih ke Dokumen Cetak Penjilidan</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/90 text-slate-100 font-black uppercase text-[10px] tracking-wider border-b border-slate-700">
                  <th className="py-3 px-3.5 text-center w-12">No</th>
                  <th className="py-3 px-4">Bulan / Periode</th>
                  <th className="py-3 px-4 text-right">Penerimaan Kas (Rp)</th>
                  <th className="py-3 px-4 text-right">Realisasi Belanja (Rp)</th>
                  <th className="py-3 px-4 text-right">Surplus / (Defisit) (Rp)</th>
                  <th className="py-3 px-4 text-center w-28">Serapan (%)</th>
                  <th className="py-3 px-4 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {matrixMonthlyData.map((m, idx) => {
                  const diff = m.penerimaan - m.realisasi;
                  const rate = m.penerimaan > 0 ? (m.realisasi / m.penerimaan) * 100 : 0;
                  const cappedRate = Math.min(100, Math.max(0, rate));

                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-slate-400/50 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50' : 'bg-slate-100'
                      }`}
                    >
                      <td className="py-2.5 px-3.5 text-center text-slate-700 font-sans">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 tracking-wide font-sans">
                        {m.name}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-500">
                        {formatCurrency(m.penerimaan)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-rose-800">
                        {formatCurrency(m.realisasi)}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-black ${
                        diff >= 0 ? 'text-teal-400' : 'text-amber-700'
                      }`}>
                        {diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 bg-slate-300 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                rate > 100 ? 'bg-rose-500' : rate > 75 ? 'bg-amber-500' : 'bg-teal-300'
                              }`} 
                              style={{ width: `${cappedRate}%` }} 
                            />
                          </div>
                          <span className="text-[10px] text-slate-700 min-w-[32px] text-right">
                            {rate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          diff >= 0 
                            ? 'bg-teal-950 text-teal-200 border border-teal-800' 
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {diff >= 0 ? 'Surplus' : 'Defisit'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {/* Baris Total Komulatif */}
                <tr className="bg-slate-800 border-t-2 border-slate-600 font-black text-white font-mono text-xs">
                  <td colSpan={2} className="py-3 px-4 uppercase tracking-wider font-sans">
                    TOTAL KOMULATIF {selectedYear !== 'all' ? `(TA ${selectedYear})` : ''}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-200 font-black">
                    {formatCurrency(matrixTotalPenerimaan)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-300 font-black">
                    {formatCurrency(matrixTotalRealisasi)}
                  </td>
                  <td className={`py-3 px-4 text-right font-black ${
                    matrixSurplusDefisit >= 0 ? 'text-teal-200' : 'text-rose-300'
                  }`}>
                    {matrixSurplusDefisit >= 0 ? `+${formatCurrency(matrixSurplusDefisit)}` : formatCurrency(matrixSurplusDefisit)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-teal-200 font-bold">{overallSerapanRate.toFixed(1)}%</span>
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      matrixSurplusDefisit >= 0 ? 'bg-teal-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {matrixSurplusDefisit >= 0 ? 'Surplus' : 'Defisit'}
                    </span>
                  </td>
                </tr>

                {/* Baris SiLPA & Saldo Kas jika filter per tahun */}
                {selectedYear !== 'all' && (
                  <>
                    <tr className="bg-amber-950/20 border-t border-amber-900/60 font-mono text-xs text-slate-900">
                      <td colSpan={2} className="py-2.5 px-4 font-bold uppercase font-sans">
                        SILPA TAHUN LALU
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">-</td>
                      <td className="py-2.5 px-4 text-right text-slate-500">-</td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(matrixSilpaTahunLalu)}
                      </td>
                      <td className="py-2.5 px-4 text-center text-slate-500">-</td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        <span className="px-2 py-0.5 rounded bg-amber-900/80 text-amber-200 border border-amber-700 text-[9px] font-black uppercase">
                          SiLPA
                        </span>
                      </td>
                    </tr>

                    <tr className="bg-teal-950/60 border-t-2 border-teal-600 font-black text-white font-mono text-xs">
                      <td colSpan={2} className="py-3 px-4 uppercase font-sans tracking-wide text-teal-100">
                        SALDO AKHIR KAS (KOMULATIF)
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">-</td>
                      <td className="py-3 px-4 text-right text-slate-300">-</td>
                      <td className="py-3 px-4 text-right font-black text-teal-100 text-sm">
                        {formatCurrency(matrixSaldoAkhir)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">-</td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-[9px] font-black uppercase tracking-wider">
                          Saldo Kas
                        </span>
                      </td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* --- MODE DOKUMEN RESMI SIAP CETAK (A4 PORTRAIT DENGAN FITUR PENJILIDAN) --- */}
      {viewMode === 'document' && (
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-2 sm:p-6 rounded-2xl border border-slate-800 shadow-xl overflow-x-auto">
        <div className="max-w-[210mm] mx-auto">
          {/* On-screen Binding Info Helper */}
          <div className="no-print mb-3 flex items-center justify-between text-xs text-slate-400 px-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              <span>
                Pratinjau Kertas A4 Portrait dengan <strong>{activeBindingConfig.label}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">
                Gutter / Margin Jilid: <strong className="text-white">{activeBindingConfig.leftMm}mm Kiri</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsBindingModalOpen(true)}
                className="text-indigo-400 hover:text-indigo-300 underline font-bold"
              >
                Ubah Format Jilid
              </button>

              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer active:scale-95"
                title="Beralih kembali ke tampilan tabel interaktif"
              >
                <Layers size={13} />
                <span>Tabel Interaktif</span>
              </button>

              {/* Tombol Cetak Dokumen */}
              <button
                type="button"
                onClick={handlePrintDocument}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
                title="Buka dialog printer untuk cetak langsung ke kertas fisik atau Print to PDF"
              >
                <Printer size={14} />
                <span>Cetak</span>
              </button>
            </div>
          </div>

          {/* DOKUMEN CETAK UTAMA DENGAN ID 'printable-matriks-bulanan-doc' */}
          <div 
            id="printable-matriks-bulanan-doc"
            className="bg-white text-slate-900 rounded-xl shadow-2xl relative transition-all border border-slate-300 print:border-none print:shadow-none print:rounded-none w-full"
            style={{
              paddingLeft: `${activeBindingConfig.leftMm}mm`,
              paddingTop: `${activeBindingConfig.topMm}mm`,
              paddingRight: `${activeBindingConfig.rightMm}mm`,
              paddingBottom: `${activeBindingConfig.bottomMm}mm`,
              minHeight: '297mm',
              boxSizing: 'border-box'
            }}
          >
            {/* PANDUAN PENJILIDAN VISUAL (HOLE PUNCH & BINDING STRIP GUIDES) */}
            {showHoleGuides && activeBindingConfig.id !== 'none' && (
              <div 
                className="absolute inset-y-0 left-0 pointer-events-none select-none no-print border-r-2 border-dashed border-indigo-400/40 flex flex-col justify-between items-center py-10"
                style={{ width: `${activeBindingConfig.leftMm}mm` }}
                title="Area margin penjilidan (Aman untuk staples, spiral, atau lakban)"
              >
                {/* Binding Strip Label */}
                <span className="text-[8.5px] font-mono font-bold text-indigo-500 uppercase tracking-widest -rotate-90 origin-center whitespace-nowrap opacity-60">
                  BATAS PENJILIDAN ({activeBindingConfig.leftMm}MM)
                </span>

                {/* Perforation Punch Hole Guides */}
                {activeBindingConfig.holeGuide === 'left-holes' && (
                  <div className="flex flex-col gap-24 items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-indigo-400 bg-indigo-50/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-indigo-400 bg-indigo-50/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    </div>
                  </div>
                )}

                {/* Spiral Ring Guides */}
                {activeBindingConfig.holeGuide === 'left-spiral' && (
                  <div className="flex flex-col gap-3 items-center opacity-70">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className="w-2.5 h-1.5 rounded-xs border border-indigo-400 bg-indigo-100/60" />
                    ))}
                  </div>
                )}

                <span className="text-[8px] font-mono text-indigo-400 opacity-60">
                  GUTTER
                </span>
              </div>
            )}

            {/* KOP RESMI DOKUMEN DESA ADAT */}
            <div className="border-b-4 border-double border-slate-900 pb-3 mb-5 text-center">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="p-2 bg-slate-100 border border-slate-600 rounded-lg text-slate-900 print:border-slate-900">
                  <Building2 size={24} />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-serif font-black tracking-wider uppercase text-slate-950 m-0 leading-tight">
                    {villageProfile.namaDesa}
                  </h1>
                  <p className="text-xs sm:text-sm font-serif font-bold text-slate-800 uppercase tracking-widest m-0">
                    Tata Kelola Keuangan Desa Adat
                  </p>
                </div>
              </div>
              <p className="text-[11px] font-sans text-slate-600 italic mt-0.5">
                {villageProfile.alamat}
              </p>
            </div>

            {/* JUDUL DOKUMEN & IDENTITAS LAPORAN */}
            <div className="text-center mb-5">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-950 font-serif underline decoration-2 underline-offset-4">
                MATRIKS REKAPITULASI REALISASI FINANSIAL BULANAN
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-600 mt-1.5">
              <p className="text-xs font-mono font-bold text-slate-800 mt-1 uppercase">
                Periode: {periodeLabel}
              </p>
                <span>
                  Status Fiskal: <strong className={matrixSurplusDefisit >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                    {matrixSurplusDefisit >= 0 ? 'SURPLUS OPERASIONAL' : 'DEFISIT OPERASIONAL'}
                  </strong>
                </span>
              </div>
            </div>

            {/* 4 KARTU RINGKASAN METRIK DALAM DOKUMEN CETAK */}
            <div className="grid grid-cols-4 gap-2.5 mb-4 text-slate-900">
              {/* Total Penerimaan */}
              <div className="p-2 rounded-lg border border-slate-400 bg-slate-50/80 print:bg-white">
                <span className="text-[8.5px] print:text-[8px] font-bold uppercase text-slate-700 tracking-wider block">
                  Total Penerimaan
                </span>
                <p className="text-xs sm:text-sm print:text-xs font-black font-mono text-emerald-900 mt-0.5 truncate">
                  {formatCurrency(matrixTotalPenerimaan)}
                </p>
                <span className="text-[8px] text-slate-500 font-sans block truncate">
                  Penerimaan Kas &amp; Punia
                </span>
              </div>

              {/* Total Realisasi Belanja */}
              <div className="p-2 rounded-lg border border-slate-400 bg-slate-50/80 print:bg-white">
                <span className="text-[8.5px] print:text-[8px] font-bold uppercase text-slate-700 tracking-wider block">
                  Total Realisasi Belanja
                </span>
                <p className="text-xs sm:text-sm print:text-xs font-black font-mono text-rose-900 mt-0.5 truncate">
                  {formatCurrency(matrixTotalRealisasi)}
                </p>
                <span className="text-[8px] text-slate-500 font-sans block truncate">
                  Rasio Serapan: {overallSerapanRate.toFixed(1)}%
                </span>
              </div>

              {/* Surplus / (Defisit) */}
              <div className="p-2 rounded-lg border border-slate-400 bg-slate-50/80 print:bg-white">
                <span className="text-[8.5px] print:text-[8px] font-bold uppercase text-slate-700 tracking-wider block">
                  Surplus / (Defisit)
                </span>
                <p className={`text-xs sm:text-sm print:text-xs font-black font-mono mt-0.5 truncate ${
                  matrixSurplusDefisit >= 0 ? 'text-teal-950' : 'text-rose-950'
                }`}>
                  {matrixSurplusDefisit >= 0 ? `+${formatCurrency(matrixSurplusDefisit)}` : formatCurrency(matrixSurplusDefisit)}
                </p>
                <span className="text-[8px] text-slate-500 font-sans block truncate">
                  Selisih Kas Berjalan
                </span>
              </div>

              {/* Saldo Akhir Kas */}
              <div className="p-2 rounded-lg border border-slate-400 bg-slate-50/80 print:bg-white">
                <span className="text-[8.5px] print:text-[8px] font-bold uppercase text-slate-700 tracking-wider block">
                  {selectedYear === 'all' ? 'Kas Netto' : 'Saldo Akhir Kas'}
                </span>
                <p className="text-xs sm:text-sm print:text-xs font-black font-mono text-sky-950 mt-0.5 truncate">
                  {formatCurrency(matrixSaldoAkhir)}
                </p>
                <span className="text-[8px] text-slate-500 font-sans block truncate">
                  {selectedYear === 'all' ? 'Akumulasi Kas Riil' : `SiLPA: ${formatCurrency(matrixSilpaTahunLalu)}`}
                </span>
              </div>
            </div>

            {/* TABEL MATRIKS BULANAN UTAMA SIAP CETAK */}
            <div className="overflow-x-auto mb-4">
              <table className="matrix-print-table w-full text-left text-xs border border-slate-500 border-collapse print:text-[8.5px]">
                <thead>
                  <tr className="bg-slate-200 border-b-2 border-slate-500 text-slate-950 font-black uppercase text-[9px] print:text-[8px] tracking-wider print:bg-slate-100">
                    <th className="py-2 px-1.5 border-r border-slate-400 text-center w-8 print:w-7">No</th>
                    <th className="py-2 px-2 border-r border-slate-400">Bulan / Periode</th>
                    <th className="py-2 px-2 border-r border-slate-400 text-right whitespace-nowrap">Penerimaan Kas (Rp)</th>
                    <th className="py-2 px-2 border-r border-slate-400 text-right whitespace-nowrap">Realisasi Belanja (Rp)</th>
                    <th className="py-2 px-2 border-r border-slate-400 text-right whitespace-nowrap">Surplus / (Defisit) (Rp)</th>
                    <th className="py-2 px-1.5 border-r border-slate-400 text-center w-14 print:w-12">Serapan</th>
                    <th className="py-2 px-1.5 text-center w-16 print:w-14">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-mono text-[10.5px] print:text-[8.5px]">
                  {matrixMonthlyData.map((m, idx) => {
                    const diff = m.penerimaan - m.realisasi;
                    const monthlyRate = m.penerimaan > 0 ? (m.realisasi / m.penerimaan) * 100 : 0;
                    return (
                      <tr 
                        key={idx} 
                        className={idx % 2 === 1 ? 'bg-slate-50/90 print:bg-slate-50' : 'bg-white'}
                      >
                        <td className="py-1.5 px-1.5 border-r border-slate-300 text-center font-mono text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 font-bold text-slate-900 font-mono whitespace-nowrap">
                          {m.name}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-emerald-900 font-semibold whitespace-nowrap">
                          {formatCurrency(m.penerimaan)}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-rose-900 font-semibold whitespace-nowrap">
                          {formatCurrency(m.realisasi)}
                        </td>
                        <td className={`py-1.5 px-2 border-r border-slate-300 text-right font-mono font-black whitespace-nowrap ${
                          diff >= 0 ? 'text-teal-950' : 'text-rose-950'
                        }`}>
                          {diff >= 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
                        </td>
                        <td className="py-1.5 px-1.5 border-r border-slate-300 text-center font-mono text-[9px] print:text-[8px] text-slate-700 whitespace-nowrap">
                          {monthlyRate.toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase print:border print:border-slate-500 whitespace-nowrap ${
                            diff >= 0 
                              ? 'bg-teal-100 text-teal-950 border border-teal-300' 
                              : 'bg-rose-100 text-rose-950 border border-rose-300'
                          }`}>
                            {diff >= 0 ? 'Surplus' : 'Defisit'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="print:table-row-group">
                  {/* BARIS TOTAL KOMULATIF */}
                  <tr className="bg-slate-200 border-t-2 border-slate-600 font-black text-slate-950 font-mono text-xs print:text-[8.5px] print:bg-slate-200">
                    <td colSpan={2} className="py-2 px-2 border-r border-slate-400 uppercase tracking-wider font-sans whitespace-nowrap">
                      TOTAL KOMULATIF
                    </td>
                    <td className="py-2 px-2 border-r border-slate-400 text-right text-emerald-950 font-black whitespace-nowrap">
                      {formatCurrency(matrixTotalPenerimaan)}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-400 text-right text-rose-950 font-black whitespace-nowrap">
                      {formatCurrency(matrixTotalRealisasi)}
                    </td>
                    <td className={`py-2 px-2 border-r border-slate-400 text-right font-black whitespace-nowrap ${
                      matrixSurplusDefisit >= 0 ? 'text-teal-950' : 'text-rose-950'
                    }`}>
                      {matrixSurplusDefisit >= 0 ? `+${formatCurrency(matrixSurplusDefisit)}` : formatCurrency(matrixSurplusDefisit)}
                    </td>
                    <td className="py-2 px-1.5 border-r border-slate-400 text-center font-black whitespace-nowrap text-[9px] print:text-[8px]">
                      {overallSerapanRate.toFixed(1)}%
                    </td>
                    <td className="py-2 px-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase whitespace-nowrap ${
                        matrixSurplusDefisit >= 0 ? 'bg-teal-700 text-white' : 'bg-rose-700 text-white'
                      }`}>
                        {matrixSurplusDefisit >= 0 ? 'Surplus' : 'Defisit'}
                      </span>
                    </td>
                  </tr>

                  {/* BARIS SILPA & SALDO AKHIR (Hanya untuk tahun spesifik) */}
                  {selectedYear !== 'all' && (
                    <>
                      <tr className="bg-amber-50 border-t border-amber-300 font-mono text-xs print:text-[8.5px] print:bg-amber-50">
                        <td colSpan={2} className="py-2 px-2 border-r border-slate-400 font-black text-amber-950 uppercase font-sans whitespace-nowrap">
                          SILPA TAHUN LALU
                        </td>
                        <td className="py-2 px-2 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2 px-2 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2 px-2 border-r border-slate-400 text-right font-black text-amber-950 whitespace-nowrap">
                          {formatCurrency(matrixSilpaTahunLalu)}
                        </td>
                        <td className="py-2 px-1.5 border-r border-slate-400 text-center text-slate-400">-</td>
                        <td className="py-2 px-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-400 text-[8px] font-black uppercase whitespace-nowrap">
                            SiLPA
                          </span>
                        </td>
                      </tr>

                      <tr className="bg-teal-100 border-t-2 border-teal-600 font-black text-slate-950 font-mono text-xs print:text-[8.5px] print:bg-teal-50">
                        <td colSpan={2} className="py-2 px-2 border-r border-slate-400 font-black text-teal-950 uppercase font-sans whitespace-wrap">
                          SALDO AKHIR KAS (KOMULATIF)
                        </td>
                        <td className="py-2 px-2 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2 px-2 border-r border-slate-400 text-right text-slate-400">-</td>
                        <td className="py-2 px-2 border-r border-slate-400 text-right font-black text-teal-950 text-xs sm:text-sm print:text-xs whitespace-nowrap">
                          {formatCurrency(matrixSaldoAkhir)}
                        </td>
                        <td className="py-2 px-1.5 border-r border-slate-400 text-center text-slate-400">-</td>
                        <td className="py-2 px-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-teal-800 text-white text-[8px] font-black uppercase tracking-wider whitespace-nowrap">
                            Saldo Kas
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>

            {/* IKHTISAR DAN CATATAN EVALUASI RESMI */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-xs text-slate-800 mb-6 print:bg-transparent print:border-slate-400">
              <div className="flex items-start gap-2">
                <span className="font-black uppercase text-[11px] text-slate-900 font-mono shrink-0">
                  Catatan Evaluasi:
                </span>
                <p className="m-0 leading-relaxed text-[11px]">
                  Berdasarkan matriks rekapitulasi realisasi finansial berjalan {periodeLabel}, total penerimaan kas terhimpun sebesar <strong>{formatCurrency(matrixTotalPenerimaan)}</strong> dengan penyerapan belanja operasional &amp; program sebesar <strong>{formatCurrency(matrixTotalRealisasi)}</strong> (efisiensi serapan <strong>{overallSerapanRate.toFixed(1)}%</strong>). Buku kas mencatatkan posisi <strong>{matrixSurplusDefisit >= 0 ? 'Surplus' : 'Defisit'}</strong> sebesar <strong>{formatCurrency(Math.abs(matrixSurplusDefisit))}</strong> dengan saldo akhir kas tersedia <strong>{formatCurrency(matrixSaldoAkhir)}</strong>.
                </p>
              </div>
            </div>

            {/* LEMBAR PENGESAHAN TANDA TANGAN RESMI */}
              <div className="grid grid-cols-2 gap-6 text-center text-xs sm:text-sm text-slate-900 font-serif">
                {/* Sisi Kiri: Mengetahui Keliang Adat */}
                <div className="space-y-1">
                  <p className="not-italic text-slate-700">Mengetahui,</p>
                  <p className="font-bold text-slate-950 text-sm sm:text-base relative z-10">Keliang Adat Basangalas</p>
                  <div className="h-16 sm:h-20 flex items-center justify-center relative">
                    {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, mengambil tempat setengah nama Keliang Adat ke kiri, mengenai tanda tangan dan label pejabat */}
                    {showStamp && effectiveStamp && (
                      <div 
                        className="absolute pointer-events-none select-none z-0"
                        style={{
                          left: '20%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          opacity: 0.92,
                          filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                        }}
                      >
                        <img 
                          src={effectiveStamp} 
                          alt="Stempel Resmi Desa Adat" 
                          className="w-24 h-24 sm:w-28 sm:h-28 object-contain max-w-none mix-blend-multiply" 
                          style={{
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                            transform: `scale(${((sigSettings.stampScale || 100) / 100) * 1.3})`
                          }}
                        />
                      </div>
                    )}
                    {embedSignatures && signatures?.keliang ? (
                      <img 
                        src={signatures.keliang} 
                        alt="TTD Keliang" 
                        className="max-h-16 sm:max-h-20 object-contain relative z-10" 
                        style={{
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact'
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic select-none no-print">[ Tanda Tangan ]</span>
                    )}
                  </div>
                  <p className="font-bold border-b-2 border-slate-900 uppercase pb-0.5 inline-block min-w-[150px] sm:min-w-[220px] text-slate-950 relative z-10">
                    {keliangName}
                  </p>
                </div>

                {/* Sisi Kanan: Juru Raksa */}
                <div className="space-y-1">
                  <p className="not-italic text-slate-700">{customPlace}, {formattedSigDate}</p>
                  <p className="font-bold text-slate-950 text-sm sm:text-base">Juru Raksa</p>
                  <div className="h-16 sm:h-20 flex items-center justify-center relative">
                    {embedSignatures && signatures?.juruRaksa ? (
                      <img 
                        src={signatures.juruRaksa} 
                        alt="TTD Juru Raksa" 
                        className="max-h-16 sm:max-h-20 object-contain relative z-10" 
                        style={{
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact'
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic select-none no-print">[ Tanda Tangan ]</span>
                    )}
                  </div>
                  <p className="font-bold border-b-2 border-slate-900 uppercase pb-0.5 inline-block min-w-[150px] sm:min-w-[220px] text-slate-950">
                    {juruRaksaName}
                  </p>
                </div>
              </div>
          </div>
        </div>
      </div>
      )}

      {/* --- MODAL PENGATURAN PENJILIDAN (BINDING MARGIN) --- */}
      {isBindingModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[99999] flex justify-center items-center p-4 overflow-y-auto"
          onClick={() => setIsBindingModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-400/30">
                  <Bookmark size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Pengaturan Penjilidan &amp; Margin Kertas
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pilih format penjilidan agar teks &amp; tabel tidak terpotong saat dibinding
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBindingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {BINDING_OPTIONS.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => handleSelectBinding(opt.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                    selectedBinding === opt.id
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white">{opt.label}</span>
                      {selectedBinding === opt.id && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded bg-indigo-500 text-white">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {opt.description}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-indigo-300 pt-0.5">
                      <span>Margin Kiri: {opt.leftMm}mm</span>
                      <span>•</span>
                      <span>Atas: {opt.topMm}mm</span>
                      <span>•</span>
                      <span>Kanan: {opt.rightMm}mm</span>
                      <span>•</span>
                      <span>Bawah: {opt.bottomMm}mm</span>
                    </div>
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedBinding === opt.id
                      ? 'border-indigo-400 bg-indigo-500 text-white'
                      : 'border-slate-600 bg-slate-800 text-transparent'
                  }`}>
                    <Check size={12} />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={showHoleGuides}
                  onChange={(e) => handleToggleHoleGuide(e.target.checked)}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Tampilkan Garis Panduan Lubang Jilid di Pratinjau</span>
              </label>

              <button
                type="button"
                onClick={() => setIsBindingModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PENGATURAN PEJABAT PENANDATANGAN & TANGGAL --- */}
      {isSignerModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[99999] flex justify-center items-center p-4 overflow-y-auto"
          onClick={() => setIsSignerModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-400/30">
                  <Settings2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    Pejabat Penandatangan &amp; Titimangsa
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sesuaikan nama pengesah dokumen, tempat, dan tanggal pengesahan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSignerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Nama Desa Adat / Lembaga
                </label>
                <input
                  type="text"
                  value={tempProfile.namaDesa}
                  onChange={(e) => setTempProfile({ ...tempProfile, namaDesa: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Alamat Sekretariat Desa
                </label>
                <input
                  type="text"
                  value={tempProfile.alamat}
                  onChange={(e) => setTempProfile({ ...tempProfile, alamat: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Tempat Pembuatan
                  </label>
                  <input
                    type="text"
                    value={tempProfile.tempat}
                    onChange={(e) => setTempProfile({ ...tempProfile, tempat: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                    placeholder="Contoh: Basangalas"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Tanggal Laporan
                  </label>
                  <input
                    type="date"
                    value={tempProfile.tanggalLaporan}
                    onChange={(e) => setTempProfile({ ...tempProfile, tanggalLaporan: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-3">
                <span className="block font-black text-slate-400 uppercase text-[10px] tracking-wider">
                  Susunan Prajuru / Pejabat Resmi
                </span>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    1. Keliang Adat / Keliang Desa (Mengetahui &amp; Menyetujui)
                  </label>
                  <input
                    type="text"
                    value={tempProfile.namaKetua}
                    onChange={(e) => setTempProfile({ ...tempProfile, namaKetua: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    2. Petengen / Bendahara Adat (Diverifikasi Oleh)
                  </label>
                  <input
                    type="text"
                    value={tempProfile.namaBendahara}
                    onChange={(e) => setTempProfile({ ...tempProfile, namaBendahara: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    3. Penyarikan / Sekretaris Adat (Dicatat &amp; Disusun Oleh)
                  </label>
                  <input
                    type="text"
                    value={tempProfile.namaSekretaris}
                    onChange={(e) => setTempProfile({ ...tempProfile, namaSekretaris: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSignerModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSigners}
                className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs"
              >
                Simpan Pejabat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLES KHUSUS PRINT A4 PORTRAIT DENGAN MARGIN PENJILIDAN */}
      <style>{`
        @media print {
          body.print-matriks-bulanan-mode * {
            visibility: hidden;
          }
          body.print-matriks-bulanan-mode #printable-matriks-bulanan-doc,
          body.print-matriks-bulanan-mode #printable-matriks-bulanan-doc * {
            visibility: visible;
          }
          body.print-matriks-bulanan-mode #printable-matriks-bulanan-doc {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 210mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* Row Total Komulatif hanya ditampilkan paling bawah tabel di atas signature saat tabel melebihi satu halaman cetak */
          body.print-matriks-bulanan-mode #printable-matriks-bulanan-doc table tfoot,
          body.print-matriks-bulanan-mode .matrix-print-table tfoot,
          #printable-matriks-bulanan-doc tfoot {
            display: table-row-group !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          body.print-matriks-bulanan-mode #printable-matriks-bulanan-doc table tfoot tr,
          body.print-matriks-bulanan-mode .matrix-print-table tfoot tr,
          #printable-matriks-bulanan-doc tfoot tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          body.print-matriks-bulanan-mode .signature-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          body.print-matriks-bulanan-mode .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
};

export default MatriksBulanan;
