import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileCheck2, Printer, Download, Calculator, CheckCircle2, 
  AlertCircle, Building2, Landmark, Coins, Banknote, 
  ShieldCheck, FileSpreadsheet, RotateCcw, Edit3, Save, 
  ChevronRight, Calendar, UserCheck, Sparkles, BookOpen,
  Eye, RefreshCw, Maximize2, Minimize2, X
} from 'lucide-react';
import { formatCurrency, numberToWords, formatDate } from '../../utils/formatter';
import { 
  getStoredSignatures, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  DigitalSignatures 
} from '../../utils/signatureStorage';
import ExportPdfButton from '../shared/ExportPdfButton';
import Modal from '../shared/Modal';
import { ReportSignatureBlock } from '../shared/ReportSignatureBlock';

declare const XLSX: any;

export interface DenominationDetail {
  nominal: number;
  count: number;
  type: 'kertas' | 'logam';
}

interface RegisterPenutupanBkuProps {
  saldoBuku: number;
  saldoAwal: number;
  totalPenerimaan: number;
  totalPengeluaran: number;
  mutasiPeriode: number;
  kasTunaiBuku?: number;
  kasDesaAdatBuku?: number;
  kasJuruRaksaBuku?: number;
  kasBankBuku: number;
  kasPuraDalemBuku?: number;
  kasSasahAbuBuku: number;
  kasLainnyaBuku: number;
  kasAsetLainnyaBuku?: number;
  selectedYear: string;
  selectedMonth: string;
  keliangName: string;
  juruRaksaName: string;
  customPlace: string;
  signatureDate: string;
  onOpenSettings?: () => void;
  onBackToBku?: () => void;
  isFullScreenOpen?: boolean;
  onToggleFullScreen?: (isOpen: boolean) => void;
}

export const RegisterPenutupanBku: React.FC<RegisterPenutupanBkuProps> = ({
  saldoBuku,
  saldoAwal,
  totalPenerimaan,
  totalPengeluaran,
  mutasiPeriode,
  kasTunaiBuku = 0,
  kasDesaAdatBuku,
  kasJuruRaksaBuku,
  kasBankBuku,
  kasPuraDalemBuku = 0,
  kasSasahAbuBuku,
  kasLainnyaBuku,
  kasAsetLainnyaBuku = 0,
  selectedYear,
  selectedMonth,
  keliangName,
  juruRaksaName,
  customPlace,
  signatureDate,
  onOpenSettings,
  onBackToBku,
  isFullScreenOpen,
  onToggleFullScreen
}) => {
  const currentPeriodKey = `reg_penutupan_${selectedYear || 'all'}_${selectedMonth || 'all'}`;
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Nomor Register Penutupan Kas
  const [nomorRegister, setNomorRegister] = useState(() => {
    const saved = localStorage.getItem(`${currentPeriodKey}_nomorRegister`);
    if (saved) return saved;
    const y = selectedYear || new Date().getFullYear();
    const m = selectedMonth ? selectedMonth.padStart(2, '0') : '12';
    return `REG.BKU/${y}/${m}/001`;
  });

  // Catatan Berita Acara / Keterangan Sebab Selisih
  const [catatanPenutupan, setCatatanPenutupan] = useState(() => {
    return localStorage.getItem(`${currentPeriodKey}_catatan`) || 
      'Buku Kas Umum telah diperiksa, ditutup dengan tertib, dan seluruh saldo kas fisik berada dalam penguasaan Juru Raksa dalam keadaan baik dan lengkap.';
  });

  // Rincian Uang Kertas & Logam
  const defaultBanknotes: DenominationDetail[] = [
    { nominal: 100000, count: 0, type: 'kertas' },
    { nominal: 50000, count: 0, type: 'kertas' },
    { nominal: 20000, count: 0, type: 'kertas' },
    { nominal: 10000, count: 0, type: 'kertas' },
    { nominal: 5000, count: 0, type: 'kertas' },
    { nominal: 2000, count: 0, type: 'kertas' },
    { nominal: 1000, count: 0, type: 'kertas' },
  ];

  const defaultCoins: DenominationDetail[] = [
    { nominal: 1000, count: 0, type: 'logam' },
    { nominal: 500, count: 0, type: 'logam' },
    { nominal: 200, count: 0, type: 'logam' },
    { nominal: 100, count: 0, type: 'logam' },
  ];

  const [banknotes, setBanknotes] = useState<DenominationDetail[]>(() => {
    const saved = localStorage.getItem(`${currentPeriodKey}_banknotes`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return defaultBanknotes;
  });

  const [coins, setCoins] = useState<DenominationDetail[]>(() => {
    const saved = localStorage.getItem(`${currentPeriodKey}_coins`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return defaultCoins;
  });

  const displayKasDesaAdat = kasDesaAdatBuku !== undefined ? kasDesaAdatBuku : kasPuraDalemBuku;
  const computedCashTunai = kasTunaiBuku || (displayKasDesaAdat + (kasJuruRaksaBuku || 0));

  // Saldo Bank & Kas Khusus Fisik (Default diambil dari saldo buku, tapi user bisa sesuaikan)
  const [bankPhysical, setBankPhysical] = useState<number>(() => {
    const saved = localStorage.getItem(`${currentPeriodKey}_bankPhysical`);
    return saved !== null ? Number(saved) : kasBankBuku;
  });

  const [bankAccountName, setBankAccountName] = useState(() => {
    return localStorage.getItem(`${currentPeriodKey}_bankAccountName`) || 'BPD Bali Cab. Karangasem (Rek. Desa Adat Basangalas)';
  });

  const [bankAccountNumber, setBankAccountNumber] = useState(() => {
    return localStorage.getItem(`${currentPeriodKey}_bankAccountNumber`) || '014.02.02.12345-6';
  });

  const [kasKhususPhysical, setKasKhususPhysical] = useState<number>(() => {
    const saved = localStorage.getItem(`${currentPeriodKey}_kasKhususPhysical`);
    return saved !== null ? Number(saved) : (kasAsetLainnyaBuku + kasSasahAbuBuku + kasLainnyaBuku);
  });

  const [isExportExcelOpen, setIsExportExcelOpen] = useState(false);
  const [exportExcelFilename, setExportExcelFilename] = useState('');
  const [showNotificationToast, setShowNotificationToast] = useState<string | null>(null);

  // Full Screen Mode state
  const [isFullScreen, setIsFullScreen] = useState(isFullScreenOpen || false);

  useEffect(() => {
    if (isFullScreenOpen !== undefined) {
      setIsFullScreen(isFullScreenOpen);
    }
  }, [isFullScreenOpen]);

  const handleOpenFullScreen = () => {
    setIsFullScreen(true);
    if (onToggleFullScreen) onToggleFullScreen(true);
  };

  const handleCloseFullScreen = () => {
    setIsFullScreen(false);
    if (onToggleFullScreen) onToggleFullScreen(false);
  };

  // Tutup fullscreen dengan tombol Escape keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        handleCloseFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Digital Signatures state
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStamp, setShowStamp] = useState<boolean>(() => isStampOverlayEnabled());

  useEffect(() => {
    const handleUpdateSigs = () => {
      setSignatures(getStoredSignatures());
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
    };
    window.addEventListener('signatures-updated', handleUpdateSigs);
    return () => window.removeEventListener('signatures-updated', handleUpdateSigs);
  }, []);

  // Sync saat periode berganti
  useEffect(() => {
    const savedReg = localStorage.getItem(`${currentPeriodKey}_nomorRegister`);
    const y = selectedYear || new Date().getFullYear();
    const m = selectedMonth ? selectedMonth.padStart(2, '0') : '12';
    setNomorRegister(savedReg || `REG.BKU/${y}/${m}/001`);

    const savedCat = localStorage.getItem(`${currentPeriodKey}_catatan`);
    if (savedCat) setCatatanPenutupan(savedCat);

    const savedNotes = localStorage.getItem(`${currentPeriodKey}_banknotes`);
    if (savedNotes) {
      try { setBanknotes(JSON.parse(savedNotes)); } catch (e) {}
    } else {
      // Auto breakdown kas tunai jika belum diset
      autoBreakdownCash(kasTunaiBuku);
    }

    const savedCoins = localStorage.getItem(`${currentPeriodKey}_coins`);
    if (savedCoins) {
      try { setCoins(JSON.parse(savedCoins)); } catch (e) {}
    }

    const savedBank = localStorage.getItem(`${currentPeriodKey}_bankPhysical`);
    setBankPhysical(savedBank !== null ? Number(savedBank) : kasBankBuku);

    const savedKhusus = localStorage.getItem(`${currentPeriodKey}_kasKhususPhysical`);
    setKasKhususPhysical(savedKhusus !== null ? Number(savedKhusus) : (kasAsetLainnyaBuku + kasSasahAbuBuku + kasLainnyaBuku));
  }, [currentPeriodKey, computedCashTunai, kasBankBuku, displayKasDesaAdat, kasSasahAbuBuku, kasLainnyaBuku, kasAsetLainnyaBuku]);

  // Fungsi Cerdas: Auto Pecahan Kas Tunai
  const autoBreakdownCash = (targetAmount: number) => {
    let remaining = Math.max(0, targetAmount);
    const newNotes = defaultBanknotes.map(n => ({ ...n, count: 0 }));
    const newCoins = defaultCoins.map(c => ({ ...c, count: 0 }));

    // Isi lembaran uang kertas terbesar
    for (const note of newNotes) {
      if (remaining >= note.nominal) {
        const count = Math.floor(remaining / note.nominal);
        note.count = count;
        remaining %= note.nominal;
      }
    }

    // Sisanya uang koin
    for (const coin of newCoins) {
      if (remaining >= coin.nominal) {
        const count = Math.floor(remaining / coin.nominal);
        coin.count = count;
        remaining %= coin.nominal;
      }
    }

    setBanknotes(newNotes);
    setCoins(newCoins);
  };

  const handleAutoFillCash = () => {
    autoBreakdownCash(computedCashTunai);
    setBankPhysical(kasBankBuku);
    setKasKhususPhysical(kasAsetLainnyaBuku + kasSasahAbuBuku + kasLainnyaBuku);
    showToast('Pecahan kas fisik diselaraskan otomatis dengan saldo Buku Kas!');
  };

  const showToast = (msg: string) => {
    setShowNotificationToast(msg);
    setTimeout(() => setShowNotificationToast(null), 3500);
  };

  // Simpan data fisik kas ke localStorage
  const handleSaveRegisterData = () => {
    localStorage.setItem(`${currentPeriodKey}_nomorRegister`, nomorRegister);
    localStorage.setItem(`${currentPeriodKey}_catatan`, catatanPenutupan);
    localStorage.setItem(`${currentPeriodKey}_banknotes`, JSON.stringify(banknotes));
    localStorage.setItem(`${currentPeriodKey}_coins`, JSON.stringify(coins));
    localStorage.setItem(`${currentPeriodKey}_bankPhysical`, String(bankPhysical));
    localStorage.setItem(`${currentPeriodKey}_bankAccountName`, bankAccountName);
    localStorage.setItem(`${currentPeriodKey}_bankAccountNumber`, bankAccountNumber);
    localStorage.setItem(`${currentPeriodKey}_kasKhususPhysical`, String(kasKhususPhysical));
    showToast('Data Register Penutupan & Pemeriksaan Kas berhasil disimpan!');
  };

  // Hitung Total Uang Kertas Fisik
  const totalBanknotes = useMemo(() => {
    return banknotes.reduce((acc, item) => acc + (item.nominal * (item.count || 0)), 0);
  }, [banknotes]);

  // Hitung Total Uang Logam Fisik
  const totalCoins = useMemo(() => {
    return coins.reduce((acc, item) => acc + (item.nominal * (item.count || 0)), 0);
  }, [coins]);

  // Total Kas Tunai Fisik
  const totalKasTunaiFisik = useMemo(() => {
    return totalBanknotes + totalCoins;
  }, [totalBanknotes, totalCoins]);

  // Total Kas Nyata / Fisik Keseluruhan
  const totalKasNyataFisik = useMemo(() => {
    return totalKasTunaiFisik + Number(bankPhysical || 0) + Number(kasKhususPhysical || 0);
  }, [totalKasTunaiFisik, bankPhysical, kasKhususPhysical]);

  // Selisih Kas (Fisik Nyata - Saldo Buku Kas Umum)
  const selisihKas = useMemo(() => {
    return totalKasNyataFisik - saldoBuku;
  }, [totalKasNyataFisik, saldoBuku]);

  const updateBanknoteCount = (nominal: number, count: number) => {
    setBanknotes(prev => prev.map(n => n.nominal === nominal ? { ...n, count: Math.max(0, count) } : n));
  };

  const updateCoinCount = (nominal: number, count: number) => {
    setCoins(prev => prev.map(c => c.nominal === nominal ? { ...c, count: Math.max(0, count) } : c));
  };

  const formatMonthName = (m: string) => {
    if (!m) return 'Semua Bulan';
    const date = new Date(2000, Number(m) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long' });
  };

  const formatPeriodFull = () => {
    if (selectedMonth && selectedYear) {
      return `${formatMonthName(selectedMonth)} ${selectedYear}`;
    }
    if (selectedYear) {
      return `Tahun Anggaran ${selectedYear}`;
    }
    return 'Seluruh Periode Berjalan';
  };

  // =========================================================================
  // CETAK BERITA ACARA RESMI (ISOLATED IFRAME PRINT - 100% BULLETPROOF)
  // =========================================================================
  const handlePrintBeritaAcara = () => {
    const printEl = document.getElementById('printable-register-penutupan-bku');
    if (!printEl) {
      window.print();
      return;
    }

    // Buat iframe sementara untuk mencetak hanya Berita Acara tanpa gangguan elemen web lain
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const effectiveStamp = getEffectiveStamp(signatures, 'DESA ADAT BASANGALAS');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Register Penutupan & Berita Acara Kas BKU - Desa Adat Basangalas</title>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 12mm 15mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 11pt;
              line-height: 1.35;
            }
            .kop-container {
              text-align: center;
              border-bottom: 3px double #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .kop-title {
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 0;
            }
            .kop-sub {
              font-size: 10.5pt;
              font-weight: bold;
              text-transform: uppercase;
              margin: 2px 0;
            }
            .kop-address {
              font-size: 9pt;
              font-style: italic;
              color: #333;
              margin: 0;
            }
            .doc-header {
              text-align: center;
              margin-bottom: 12px;
            }
            .doc-title {
              font-size: 11.5pt;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
              margin: 0 0 3px 0;
            }
            .doc-meta {
              font-size: 9pt;
              font-weight: bold;
              margin: 2px 0;
            }
            .intro-text {
              font-size: 9.5pt;
              text-align: justify;
              margin-bottom: 10px;
              line-height: 1.4;
            }
            .section-title {
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
              margin: 8px 0 4px 0;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 8px;
              font-size: 9pt;
            }
            th, td {
              border: 1px solid #000;
              padding: 3.5px 5px;
            }
            th {
              background-color: #f2f2f2 !important;
              font-weight: bold;
              text-align: center;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .font-mono { font-family: 'Courier New', Courier, monospace; }
            .bg-highlight { background-color: #e6e6e6 !important; }
            .bg-success { background-color: #eafaf1 !important; }
            .terbilang-box {
              font-size: 8.5pt;
              font-style: italic;
              margin-top: -4px;
              margin-bottom: 8px;
              padding-left: 2px;
            }
            .cash-split-grid {
              display: table;
              width: 100%;
              table-layout: fixed;
              margin-bottom: 6px;
            }
            .cash-split-col {
              display: table-cell;
              width: 50%;
              vertical-align: top;
            }
            .cash-split-col:first-child {
              padding-right: 4px;
            }
            .cash-split-col:last-child {
              padding-left: 4px;
            }
            .notes-box {
              border: 1px solid #000;
              padding: 6px 8px;
              font-size: 9pt;
              font-style: italic;
              line-height: 1.35;
              margin-bottom: 12px;
              background-color: #fafafa;
            }
            .signature-table {
              width: 100%;
              border: none !important;
              margin-top: 14px;
              page-break-inside: avoid;
            }
            .signature-table td {
              border: none !important;
              text-align: center;
              vertical-align: top;
              padding: 0;
              width: 50%;
            }
            .sig-title {
              font-size: 9.5pt;
              margin: 0;
            }
            .sig-role {
              font-size: 9.5pt;
              font-weight: bold;
              text-transform: uppercase;
              margin: 2px 0 0 0;
            }
            .sig-space {
              height: 55px;
            }
            .sig-name {
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
              margin: 0;
            }
            .doc-footer {
              margin-top: 14px;
              border-top: 1px solid #777;
              padding-top: 3px;
              font-size: 7.5pt;
              color: #555;
              display: flex;
              justify-content: space-between;
            }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          <!-- KOP INSTANSI RESMI -->
          <div class="kop-container">
            <h1 class="kop-title">DESA ADAT BASANGALAS</h1>
            <p class="kop-sub">KECAMATAN ABANG, KABUPATEN KARANGASEM - BALI</p>
            <p class="kop-address">Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Abang, Karangasem, Bali 80852</p>
          </div>

          <!-- JUDUL BERITA ACARA -->
          <div class="doc-header">
            <h2 class="doc-title">REGISTER PENUTUPAN BUKU KAS UMUM & BERITA ACARA PEMERIKSAAN KAS</h2>
            <div class="doc-meta">Nomor Register: <span class="font-mono">${nomorRegister}</span></div>
            <div class="doc-meta" style="font-weight: normal; font-size: 8.5pt;">
              Periode: <strong>${formatPeriodFull()}</strong> &nbsp;|&nbsp; Tanggal Penutupan: <strong>${formatDate(signatureDate)}</strong> &nbsp;|&nbsp; Format Permendagri No. 20/2018 (Lampiran D.1)
            </div>
          </div>

          <!-- PENGANTAR BERITA ACARA -->
          <div class="intro-text">
            Pada hari ini, tanggal <strong>${formatDate(signatureDate)}</strong>, bertempat di <strong>${customPlace}</strong>, telah dilakukan penutupan Buku Kas Umum (BKU) dan pemeriksaan kas (<em>cash opname</em>) penatausahaan keuangan Desa Adat Basangalas untuk periode <strong>${formatPeriodFull()}</strong> oleh pejabat yang berwenang dengan hasil sebagai berikut:
          </div>

          <!-- I. POSISI BUKU KAS UMUM -->
          <div class="section-title">I. Posisi Kas Menurut Buku Kas Umum (BKU)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th>Uraian Komponen Pembukuan Kas</th>
                <th style="width: 170px;">Jumlah Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono">1</td>
                <td>Saldo Awal / Pindahan Kas (Kumulatif Periode Lalu)</td>
                <td class="text-right font-mono">${formatCurrency(saldoAwal)}</td>
              </tr>
              <tr>
                <td class="text-center font-mono">2</td>
                <td>Jumlah Penerimaan Kas (Debet) Periode Ini</td>
                <td class="text-right font-mono font-bold">${formatCurrency(totalPenerimaan)}</td>
              </tr>
              <tr>
                <td class="text-center font-mono">3</td>
                <td>Jumlah Pengeluaran Kas (Kredit) Periode Ini</td>
                <td class="text-right font-mono font-bold">${formatCurrency(totalPengeluaran)}</td>
              </tr>
              <tr>
                <td class="text-center font-mono">4</td>
                <td>Jumlah Mutasi Bersih Kas Periode Ini (Penerimaan - Pengeluaran)</td>
                <td class="text-right font-mono">${formatCurrency(mutasiPeriode)}</td>
              </tr>
              <tr class="bg-highlight font-bold">
                <td colspan="2" style="text-transform: uppercase;">A. SALDO AKHIR MENURUT BUKU KAS UMUM (PER TANGGAL PENUTUPAN)</td>
                <td class="text-right font-mono" style="font-size: 10pt;">${formatCurrency(saldoBuku)}</td>
              </tr>
            </tbody>
          </table>
          <div class="terbilang-box">
            Terbilang: <strong>${numberToWords(Math.abs(saldoBuku))} Rupiah</strong>
          </div>

          <!-- II. HASIL PEMERIKSAAN KAS NYATA / FISIK KAS -->
          <div class="section-title">II. Hasil Pemeriksaan Kas Fisik / Kas Nyata (Cash Opname)</div>
          
          <div class="cash-split-grid">
            <!-- Kolom Uang Kertas -->
            <div class="cash-split-col">
              <div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 2px;">A. Rincian Uang Kertas</div>
              <table>
                <thead>
                  <tr>
                    <th>Pecahan</th>
                    <th style="width: 50px;">Lembar</th>
                    <th style="width: 90px;">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  ${banknotes.map(n => `
                    <tr>
                      <td class="font-mono">Rp ${n.nominal.toLocaleString('id-ID')}</td>
                      <td class="text-center font-mono font-bold">${n.count}</td>
                      <td class="text-right font-mono">${formatCurrency(n.nominal * n.count)}</td>
                    </tr>
                  `).join('')}
                  <tr class="bg-highlight font-bold">
                    <td colspan="2">Subtotal Uang Kertas</td>
                    <td class="text-right font-mono">${formatCurrency(totalBanknotes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Kolom Uang Logam -->
            <div class="cash-split-col">
              <div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 2px;">B. Rincian Uang Logam</div>
              <table>
                <thead>
                  <tr>
                    <th>Pecahan</th>
                    <th style="width: 50px;">Keping</th>
                    <th style="width: 90px;">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  ${coins.map(c => `
                    <tr>
                      <td class="font-mono">Rp ${c.nominal.toLocaleString('id-ID')}</td>
                      <td class="text-center font-mono font-bold">${c.count}</td>
                      <td class="text-right font-mono">${formatCurrency(c.nominal * c.count)}</td>
                    </tr>
                  `).join('')}
                  <tr class="bg-highlight font-bold">
                    <td colspan="2">Subtotal Uang Logam</td>
                    <td class="text-right font-mono">${formatCurrency(totalCoins)}</td>
                  </tr>
                </tbody>
              </table>

              <div style="background-color: #f2f2f2; border: 1px solid #000; padding: 4px 6px; font-weight: bold; font-size: 8.5pt; display: flex; justify-content: space-between;">
                <span>Total Kas Tunai (A + B):</span>
                <span class="font-mono">${formatCurrency(totalKasTunaiFisik)}</span>
              </div>
            </div>
          </div>

          <!-- Tabel Kas Bank & Kas Khusus -->
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th>Komponen Saldo Kas Bukan Tunai / Rekening Khusus</th>
                <th style="width: 170px;">Jumlah Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center font-mono">1</td>
                <td>
                  <strong>C. Saldo Kas di Bank</strong><br>
                  <span style="font-size: 8pt; color: #333;">${bankAccountName} (No. Rek: ${bankAccountNumber})</span>
                </td>
                <td class="text-right font-mono font-bold">${formatCurrency(bankPhysical)}</td>
              </tr>
              <tr>
                <td class="text-center font-mono">2</td>
                <td>
                  <strong>D. Saldo Kas Khusus / Kas Aset Lainnya</strong><br>
                  <span style="font-size: 8pt; color: #333;">Kas Aset Lainnya (1.1.2.*): ${formatCurrency(kasAsetLainnyaBuku)} | Sasah Abu: ${formatCurrency(kasSasahAbuBuku)} | Lainnya: ${formatCurrency(kasLainnyaBuku)}</span>
                </td>
                <td class="text-right font-mono font-bold">${formatCurrency(kasKhususPhysical)}</td>
              </tr>
              <tr class="bg-highlight font-bold">
                <td colspan="2" style="text-transform: uppercase;">B. TOTAL KAS NYATA / FISIK KESELURUHAN (TUNAI + BANK + KHUSUS)</td>
                <td class="text-right font-mono" style="font-size: 10pt;">${formatCurrency(totalKasNyataFisik)}</td>
              </tr>
            </tbody>
          </table>

          <!-- III. REKONSILIASI & STATUS SELISIH KAS -->
          <div class="section-title">III. Rekonsiliasi & Hasil Selisih Kas</div>
          <table>
            <tbody>
              <tr>
                <td style="width: 65%;">1. Saldo Kas Menurut Buku Kas Umum (A)</td>
                <td class="text-right font-mono font-bold">${formatCurrency(saldoBuku)}</td>
              </tr>
              <tr>
                <td>2. Total Saldo Kas Nyata / Fisik Kas (B)</td>
                <td class="text-right font-mono font-bold">${formatCurrency(totalKasNyataFisik)}</td>
              </tr>
              <tr class="bg-highlight font-bold" style="font-size: 9.5pt;">
                <td>SELISIH KAS (FISIK NYATA B - BUKU KAS A)</td>
                <td class="text-right font-mono">
                  ${selisihKas === 0 ? 'Rp 0 (NIHIL / COCOK)' : formatCurrency(selisihKas)}
                </td>
              </tr>
              <tr>
                <td style="font-size: 8.5pt;">Status Keseimbangan Kas</td>
                <td class="text-right font-bold" style="font-size: 9pt;">
                  ${selisihKas === 0 ? '✓ SEIMBANG / COCOK (NIHIL)' : (selisihKas > 0 ? '⚠ LEBIH KAS (SURPLUS)' : '⚠ KURANG KAS (DEFISIT)')}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- IV. BERITA ACARA PERNYATAAN PENUTUPAN -->
          <div class="section-title">IV. Berita Acara Pernyataan Penutupan Kas</div>
          <div class="notes-box">
            "${catatanPenutupan}"
          </div>

          <!-- LEMBAR PENGESAHAN TANDA TANGAN -->
          <table class="signature-table">
            <tr>
              <td>
                <p class="sig-title">Mengetahui & Mengesahkan,</p>
                <p class="sig-role">Keliang Adat Basangalas</p>
                <div class="sig-space" style="position: relative; height: 60px;">
                  ${embedSignatures && signatures.keliang ? `<img src="${signatures.keliang}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block; position: relative; z-index: 2;" />` : ''}
                  ${showStamp ? `<img src="${effectiveStamp}" style="position: absolute; right: 15px; top: -5px; max-height: 65px; max-width: 75px; object-fit: contain; opacity: 0.85; z-index: 3; pointer-events: none;" />` : ''}
                </div>
                <p class="sig-name">( ${keliangName} )</p>
              </td>
              <td>
                <p class="sig-title">${customPlace}, ${formatDate(signatureDate)}</p>
                <p class="sig-role">Juru Raksa Desa Adat (Bendahara)</p>
                <div class="sig-space" style="height: 60px;">
                  ${embedSignatures && signatures.juruRaksa ? `<img src="${signatures.juruRaksa}" style="max-height: 55px; max-width: 140px; object-fit: contain; margin: 0 auto; display: block;" />` : ''}
                </div>
                <p class="sig-name">( ${juruRaksaName} )</p>
              </td>
            </tr>
          </table>

          <div class="doc-footer">
            <span>Register Penutupan BKU Format Resmi Permendagri No. 20/2018 (Lampiran D.1)</span>
            <span>Desa Adat Basangalas • Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1500);
    }, 400);
  };

  // Export Excel Register Penutupan Kas
  const handleExportExcel = () => {
    setExportExcelFilename(`Register_Penutupan_BKU_${selectedYear || 'All'}_${selectedMonth || 'All'}`);
    setIsExportExcelOpen(true);
  };

  const processExportExcel = () => {
    if (typeof XLSX === 'undefined') return;

    const dataRows = [
      ["PEMERINTAH DESA ADAT BASANGALAS"],
      ["REGISTER PENUTUPAN BUKU KAS UMUM & BERITA ACARA PEMERIKSAAN KAS"],
      ["STANDAR NASIONAL PENATAUSAHAAN KEUANGAN DESA (PERMENDAGRI NO. 20/2018)"],
      [],
      ["Nomor Register", `: ${nomorRegister}`],
      ["Periode Pembukuan", `: ${formatPeriodFull()}`],
      ["Tanggal Penutupan", `: ${formatDate(signatureDate)}`],
      ["Tempat Penutupan", `: ${customPlace}`],
      [],
      ["I. POSISI BUKU KAS UMUM (BKU)", "", "", "", "JUMLAH (RP)"],
      ["1. Saldo Awal Periode Lalu", "", "", "", saldoAwal],
      ["2. Jumlah Penerimaan (Debet) Periode Ini", "", "", "", totalPenerimaan],
      ["3. Jumlah Pengeluaran (Kredit) Periode Ini", "", "", "", totalPengeluaran],
      ["4. Jumlah Mutasi Periode Ini", "", "", "", mutasiPeriode],
      ["5. SALDO AKHIR MENURUT BUKU KAS UMUM (A)", "", "", "", saldoBuku],
      [],
      ["II. HASIL PEMERIKSAAN KAS NYATA / FISIK KAS", "", "PECAHAN (RP)", "JUMLAH", "TOTAL NOMINAL (RP)"],
      ["A. Uang Kertas:", "", "", "", ""],
      ...banknotes.map(n => [
        "", "", `Rp ${n.nominal.toLocaleString('id-ID')}`, `${n.count} Lembar`, n.nominal * n.count
      ]),
      ["Subtotal Uang Kertas", "", "", "", totalBanknotes],
      [],
      ["B. Uang Logam:", "", "", "", ""],
      ...coins.map(c => [
        "", "", `Rp ${c.nominal.toLocaleString('id-ID')}`, `${c.count} Keping`, c.nominal * c.count
      ]),
      ["Subtotal Uang Logam", "", "", "", totalCoins],
      ["TOTAL KAS TUNAI FISIK (A + B)", "", "", "", totalKasTunaiFisik],
      [],
      ["C. Saldo Kas di Bank:", "", "", "", ""],
      [`• ${bankAccountName} (No. ${bankAccountNumber})`, "", "", "", bankPhysical],
      [],
      ["D. Kas Khusus / Kas Aset Lainnya (1.1.2.*):", "", "", "", ""],
      ["• Kas Aset Lainnya, Sasah Abu & Khusus Lainnya", "", "", "", kasKhususPhysical],
      [],
      ["TOTAL KAS NYATA / FISIK KESELURUHAN (B)", "", "", "", totalKasNyataFisik],
      [],
      ["III. REKONSILIASI & STATUS SELISIH KAS", "", "", "", ""],
      ["1. Saldo Menurut Buku Kas Umum (A)", "", "", "", saldoBuku],
      ["2. Total Kas Nyata / Fisik (B)", "", "", "", totalKasNyataFisik],
      ["3. Selisih Kas (B - A)", "", "", "", selisihKas],
      ["4. Status Selisih", `: ${selisihKas === 0 ? 'NIHIL / COCOK (SEIMBANG)' : (selisihKas > 0 ? 'LEBIH KAS' : 'KURANG KAS')}`],
      [],
      ["IV. BERITA ACARA PERNYATAAN PENUTUPAN KAS"],
      [`"${catatanPenutupan}"`],
      [`Terbilang: ${numberToWords(Math.abs(saldoBuku))} Rupiah.`],
      [],
      ["", "Mengetahui & Mengesahkan,", "", "", `${customPlace}, ${formatDate(signatureDate)}`],
      ["", "Keliang Adat Basangalas", "", "", "Juru Raksa Desa Adat (Bendahara)"],
      [],
      [],
      ["", `( ${keliangName} )`, "", "", `( ${juruRaksaName} )`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Register Penutupan BKU");

    let fname = exportExcelFilename.trim();
    if (!fname.endsWith('.xlsx')) fname += '.xlsx';
    XLSX.writeFile(wb, fname);

    setIsExportExcelOpen(false);
    showToast('File Excel Register Penutupan BKU berhasil diunduh!');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notifikasi */}
      {showNotificationToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-teal-500 animate-bounce no-print">
          <CheckCircle2 size={18} className="text-teal-400" />
          <span className="text-xs font-bold">{showNotificationToast}</span>
        </div>
      )}

      {/* BANNER AKSI ATAS & TOMBOL BUKA LAYAR PENUH (MODAL) */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 text-white p-4 rounded-2xl border border-teal-500/40 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30 shrink-0">
            <FileCheck2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-white">
                Register Penutupan &amp; Berita Acara BKU
              </h3>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full">
                Permendagri No. 20/2018 Lampiran D.1
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Berita acara pemeriksaan fisik kas &amp; rekonsiliasi kas tunai dan bank.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={handleAutoFillCash}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-800/80 hover:bg-teal-700 text-teal-100 text-xs font-bold rounded-xl border border-teal-600 transition-all cursor-pointer"
            title="Hitung proporsional lembar pecahan otomatis"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>Auto Hitung</span>
          </button>

          <button
            type="button"
            onClick={handleSaveRegisterData}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl border border-emerald-500 transition-all cursor-pointer"
            title="Simpan data pemeriksaan fisik"
          >
            <Save size={14} />
            <span>Simpan</span>
          </button>

          {/* Tombol Buka Layar Penuh (Modal) */}
          <button
            id="register-penutupan-btn-fullscreen-top"
            type="button"
            onClick={handleOpenFullScreen}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-md transition-all active:scale-95 border border-indigo-400/50 cursor-pointer"
            title="Buka Register Penutupan BKU dalam Tampilan Layar Penuh (Modal)"
          >
            <Maximize2 size={15} />
            <span>Buka Layar Penuh (Modal)</span>
          </button>
        </div>
      </div>

      {/* Styles Cetak Khusus Lembar Register Penutupan Kas */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-register-penutupan-bku, #printable-register-penutupan-bku * { visibility: visible !important; }
          #printable-register-penutupan-bku { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 15mm 12mm !important; 
            display: block !important; 
            background: white !important; 
            color: black !important; 
            font-family: 'Times New Roman', serif !important;
          }
          .no-print { display: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 10.5pt !important; }
          th, td { border: 1px solid #000 !important; padding: 8px 6px !important; color: black !important; }
          .reg-header-box { border-bottom: 3px double #000 !important; }
          .signature-box { page-break-inside: avoid !important; margin-top: 20px !important; }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* TEMPLATE RESMI: REGISTER PENUTUPAN & PENGESAHAN BKU */}
      {/* ========================================================================= */}
      <div 
        ref={printContainerRef}
        id="printable-register-penutupan-bku" 
        className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-400 shadow-sm space-y-6 print:p-0 print:border-none print:shadow-none"
      >
        {/* KOP RESMI DOKUMEN PEMERINTAH DESA ADAT */}
        <div className="reg-header-box text-center border-b-4 border-double border-slate-900 pb-4">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 font-serif m-0">
            DESA ADAT BASANGALAS
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-800 font-serif my-0.5 uppercase tracking-wide">
            Kecamatan Abang, Kabupaten Karangasem - Bali
          </p>
          <p className="text-[11px] text-slate-600 font-serif m-0">
            Sekretariat: Jl. Raya Basangalas, Tribuana, Abang, Karangasem, Bali 80852
          </p>
        </div>

        {/* JUDUL DOKUMEN & REGISTER NOMOR */}
        <div className="text-center space-y-1">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-900 font-serif">
            REGISTER PENUTUPAN BUKU KAS UMUM & BERITA ACARA PEMERIKSAAN KAS
          </h3>
          <p className="text-xs font-mono font-bold text-slate-700">
            Nomor Register: <span className="text-slate-950 font-black">{nomorRegister}</span>
          </p>
          <div className="flex justify-center items-center gap-3 text-xs font-semibold text-slate-600 flex-wrap">
            <span>Periode: <strong>{formatPeriodFull()}</strong></span>
            <span>•</span>
            <span>Tanggal Penutupan: <strong>{formatDate(signatureDate)}</strong></span>
            <span>•</span>
            <span>Format: <strong>Permendagri No. 20/2018 (Lampiran D.1)</strong></span>
          </div>
        </div>

        {/* TEKS PEMBUKA BERITA ACARA */}
        <div className="text-xs sm:text-sm leading-relaxed text-slate-800 text-justify bg-slate-50 print:bg-transparent p-3 rounded-lg border border-slate-200 print:border-none print:p-0">
          Pada hari ini, tanggal <strong>{formatDate(signatureDate)}</strong>, bertempat di <strong>{customPlace}</strong>, telah dilakukan pemeriksaan kas (<em>cash opname</em>) serta penutupan <strong>Buku Kas Umum (BKU)</strong> penatausahaan keuangan Desa Adat Basangalas untuk periode <strong>{formatPeriodFull()}</strong>, dengan rincian dan posisi kas sebagai berikut:
        </div>

        {/* I. POSISI BUKU KAS UMUM (MENURUT PEMBUKUAN) */}
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">I</span>
            Posisi Kas Menurut Buku Kas Umum (BKU)
          </h4>
          <table className="w-full text-xs text-left border-collapse border border-slate-400">
            <thead className="bg-slate-100 font-bold">
              <tr>
                <th className="p-2 border border-slate-400 w-10 text-center">No</th>
                <th className="p-2 border border-slate-400">Uraian Transaksi Kas</th>
                <th className="p-2 border border-slate-400 text-right w-44">Jumlah Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-400 text-center font-mono">1</td>
                <td className="p-2 border border-slate-400">Saldo Awal Kas (Periode Lalu / Pindahan)</td>
                <td className="p-2 border border-slate-400 text-right font-mono">{formatCurrency(saldoAwal)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-400 text-center font-mono">2</td>
                <td className="p-2 border border-slate-400">Jumlah Penerimaan Kas (Debet) Periode Ini</td>
                <td className="p-2 border border-slate-400 text-right font-mono text-emerald-800 font-semibold">{formatCurrency(totalPenerimaan)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-400 text-center font-mono">3</td>
                <td className="p-2 border border-slate-400">Jumlah Pengeluaran Kas (Kredit) Periode Ini</td>
                <td className="p-2 border border-slate-400 text-right font-mono text-rose-800 font-semibold">{formatCurrency(totalPengeluaran)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-400 text-center font-mono">4</td>
                <td className="p-2 border border-slate-400">Jumlah Mutasi Bersih Kas Periode Ini (Penerimaan - Pengeluaran)</td>
                <td className="p-2 border border-slate-400 text-right font-mono font-semibold">{formatCurrency(mutasiPeriode)}</td>
              </tr>
              <tr className="bg-slate-200 font-black">
                <td colSpan={2} className="p-2.5 border border-slate-400 uppercase text-slate-900">
                  A. SALDO AKHIR MENURUT BUKU KAS UMUM (PER TANGGAL PENUTUPAN)
                </td>
                <td className="p-2.5 border border-slate-400 text-right text-sm font-black font-mono text-slate-950 bg-slate-300/80">
                  {formatCurrency(saldoBuku)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] italic text-slate-600 px-1">
            Terbilang: <strong>{numberToWords(Math.abs(saldoBuku))} Rupiah</strong>
          </p>
        </div>

        {/* II. HASIL PEMERIKSAAN KAS FISIK / KAS NYATA */}
        <div className="space-y-3">
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">II</span>
            Hasil Pemeriksaan Kas Nyata / Fisik Kas (Cash Opname)
          </h4>

          {/* Grid Tabel Pecahan Uang Kertas & Uang Logam */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tabel Pecahan Uang Kertas */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center bg-slate-100 p-1.5 rounded border border-slate-300 font-bold text-xs">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <Banknote size={14} className="text-emerald-700" />
                  A. Rincian Uang Kertas
                </span>
                <span className="font-mono text-emerald-800 font-black">{formatCurrency(totalBanknotes)}</span>
              </div>
              <table className="w-full text-xs text-left border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-slate-50 font-bold text-[10px] text-center">
                    <th className="p-1 border border-slate-400 w-24">Pecahan</th>
                    <th className="p-1 border border-slate-400 w-20">Lembar</th>
                    <th className="p-1 border border-slate-400 text-right">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {banknotes.map((n) => (
                    <tr key={n.nominal}>
                      <td className="p-1 border border-slate-400 font-mono text-[11px]">Rp {n.nominal.toLocaleString('id-ID')}</td>
                      <td className="p-0.5 border border-slate-400 text-center font-mono">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            value={n.count}
                            onChange={(e) => updateBanknoteCount(n.nominal, parseInt(e.target.value) || 0)}
                            className="w-16 text-center border border-slate-300 rounded p-0.5 font-mono text-xs focus:ring-1 focus:ring-teal-500 font-bold"
                          />
                        </div>
                      </td>
                      <td className="p-1 border border-slate-400 text-right font-mono text-[11px] font-semibold">
                        {formatCurrency(n.nominal * (n.count || 0))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-xs">
                    <td colSpan={2} className="p-1.5 border border-slate-400 uppercase">Subtotal Uang Kertas</td>
                    <td className="p-1.5 border border-slate-400 text-right font-mono text-emerald-800 font-black">
                      {formatCurrency(totalBanknotes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabel Pecahan Uang Logam */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center bg-slate-100 p-1.5 rounded border border-slate-300 font-bold text-xs">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <Coins size={14} className="text-amber-700" />
                  B. Rincian Uang Logam
                </span>
                <span className="font-mono text-amber-800 font-black">{formatCurrency(totalCoins)}</span>
              </div>
              <table className="w-full text-xs text-left border-collapse border border-slate-400">
                <thead>
                  <tr className="bg-slate-50 font-bold text-[10px] text-center">
                    <th className="p-1 border border-slate-400 w-24">Pecahan</th>
                    <th className="p-1 border border-slate-400 w-20">Keping</th>
                    <th className="p-1 border border-slate-400 text-right">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {coins.map((c) => (
                    <tr key={c.nominal}>
                      <td className="p-1 border border-slate-400 font-mono text-[11px]">Rp {c.nominal.toLocaleString('id-ID')}</td>
                      <td className="p-0.5 border border-slate-400 text-center font-mono">
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            value={c.count}
                            onChange={(e) => updateCoinCount(c.nominal, parseInt(e.target.value) || 0)}
                            className="w-16 text-center border border-slate-300 rounded p-0.5 font-mono text-xs focus:ring-1 focus:ring-teal-500 font-bold"
                          />
                        </div>
                      </td>
                      <td className="p-1 border border-slate-400 text-right font-mono text-[11px] font-semibold">
                        {formatCurrency(c.nominal * (c.count || 0))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black text-xs">
                    <td colSpan={2} className="p-1.5 border border-slate-400 uppercase">Subtotal Uang Logam</td>
                    <td className="p-1.5 border border-slate-400 text-right font-mono text-amber-800 font-black">
                      {formatCurrency(totalCoins)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Kas Tunai Fisik (Kertas + Logam) */}
              <div className="bg-emerald-50 border border-emerald-300 p-2 rounded flex justify-between items-center text-xs font-black">
                <span className="uppercase text-emerald-950">Total Kas Tunai (A + B)</span>
                <span className="font-mono text-emerald-900 text-sm font-black">{formatCurrency(totalKasTunaiFisik)}</span>
              </div>
            </div>
          </div>

          {/* Rincian Kas di Bank & Kas Khusus */}
          <div className="mt-3 space-y-2">
            <table className="w-full text-xs text-left border-collapse border border-slate-400">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="p-2 border border-slate-400 w-10 text-center">No</th>
                  <th className="p-2 border border-slate-400">Komponen Saldo Kas Bukan Tunai</th>
                  <th className="p-2 border border-slate-400 text-right w-44">Jumlah Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-slate-400 text-center font-mono">1</td>
                  <td className="p-2 border border-slate-400">
                    <div className="font-bold text-slate-900">C. Saldo Kas di Bank (Rekening Resmi Desa Adat)</div>
                    <div className="text-[11px] text-slate-600 print:text-black">
                      <span className="font-mono">{bankAccountName} (No. Rek: {bankAccountNumber})</span>
                    </div>
                  </td>
                  <td className="p-2 border border-slate-400 text-right font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      value={bankPhysical}
                      onChange={(e) => setBankPhysical(Number(e.target.value) || 0)}
                      className="w-36 text-right border border-slate-300 rounded p-1 font-mono text-xs font-bold"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-400 text-center font-mono">2</td>
                  <td className="p-2 border border-slate-400">
                    <div className="font-bold text-slate-900">D. Saldo Kas Khusus / Kas Aset Lainnya</div>
                    <div className="text-[11px] text-slate-600 print:text-black">
                      (Aset Lainnya 1.1.2.*: {formatCurrency(kasAsetLainnyaBuku)}, Sasah Abu: {formatCurrency(kasSasahAbuBuku)}, Lainnya: {formatCurrency(kasLainnyaBuku)})
                    </div>
                  </td>
                  <td className="p-2 border border-slate-400 text-right font-mono font-bold text-slate-900">
                    <input
                      type="number"
                      value={kasKhususPhysical}
                      onChange={(e) => setKasKhususPhysical(Number(e.target.value) || 0)}
                      className="w-36 text-right border border-slate-300 rounded p-1 font-mono text-xs font-bold"
                    />
                  </td>
                </tr>
                <tr className="bg-slate-200 font-black">
                  <td colSpan={2} className="p-2.5 border border-slate-400 uppercase text-slate-900">
                    B. TOTAL KAS NYATA / FISIK KESELURUHAN (TUNAI + BANK + KAS KHUSUS)
                  </td>
                  <td className="p-2.5 border border-slate-400 text-right text-sm font-black font-mono text-slate-950 bg-slate-300/80">
                    {formatCurrency(totalKasNyataFisik)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* III. REKONSILIASI & STATUS SELISIH KAS */}
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">III</span>
            Rekonsiliasi & Hasil Selisih Kas
          </h4>
          <table className="w-full text-xs text-left border-collapse border border-slate-400">
            <tbody>
              <tr>
                <td className="p-2 border border-slate-400 w-2/3">1. Saldo Kas Menurut Buku Kas Umum (A)</td>
                <td className="p-2 border border-slate-400 text-right font-mono font-bold">{formatCurrency(saldoBuku)}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-400">2. Total Saldo Kas Nyata / Fisik Kas (B)</td>
                <td className="p-2 border border-slate-400 text-right font-mono font-bold">{formatCurrency(totalKasNyataFisik)}</td>
              </tr>
              <tr className={`font-black ${selisihKas === 0 ? 'bg-emerald-100 text-emerald-950' : (selisihKas > 0 ? 'bg-amber-100 text-amber-950' : 'bg-rose-100 text-rose-950')}`}>
                <td className="p-2.5 border border-slate-400 uppercase">
                  SELISIH KAS (FISIK NYATA B - BUKU KAS A)
                </td>
                <td className="p-2.5 border border-slate-400 text-right font-mono text-sm font-black">
                  {selisihKas === 0 ? 'Rp 0 (NIHIL / COCOK)' : formatCurrency(selisihKas)}
                </td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-400 font-bold uppercase text-[11px]">Status Keseimbangan Kas</td>
                <td className="p-2 border border-slate-400 text-right font-bold text-xs uppercase">
                  {selisihKas === 0 ? (
                    <span className="text-emerald-800 font-black">✓ SEIMBANG / COCOK (NIHIL)</span>
                  ) : selisihKas > 0 ? (
                    <span className="text-amber-800 font-black">⚠ LEBIH KAS (SURPLUS FISIK)</span>
                  ) : (
                    <span className="text-rose-800 font-black">⚠ KURANG KAS (DEFISIT FISIK)</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* IV. BERITA ACARA & PERNYATAAN PENUTUPAN */}
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
            <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">IV</span>
            Berita Acara Pernyataan Penutupan Kas
          </h4>
          <div className="p-3 bg-slate-50 border border-slate-300 rounded text-xs leading-relaxed text-slate-800">
            <div className="mb-1 font-bold text-slate-600 text-[11px] flex justify-between items-center">
              <span>Catatan / Keterangan Penutupan Kas:</span>
              <span className="text-[10px] text-slate-400 italic">Dapat diedit langsung</span>
            </div>
            <textarea
              rows={2}
              value={catatanPenutupan}
              onChange={(e) => setCatatanPenutupan(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-xs text-slate-900 focus:ring-1 focus:ring-teal-500 font-medium"
            />
          </div>
        </div>

        {/* LEMBAR PENGESAHAN TANDA TANGAN RESMI */}
        <div className="signature-box pt-4 break-inside-avoid">
          <ReportSignatureBlock
            keliangName={keliangName}
            juruRaksaName={juruRaksaName}
            customPlace={customPlace}
            signatureDate={signatureDate}
            keliangTitle="Keliang Adat Basangalas"
            keliangSubtitle="Penanggung Jawab Umum"
            juruRaksaTitle="Juru Raksa Desa Adat"
            juruRaksaSubtitle="Pengelola Kas & Pembukuan"
            keliangActionText="Mengetahui & Mengesahkan,"
            namaDesa="DESA ADAT BASANGALAS"
          />

          <div className="text-center text-[10px] text-slate-500 font-mono mt-8 border-t border-slate-300 pt-2 flex justify-between items-center px-2">
            <span>Register Penutupan BKU Standar Permendagri No. 20/2018 Lampiran D.1</span>
            <span>Desa Adat Basangalas • Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL KONTROL & AKSI INTERAKTIF (ON SCREEN CONTROLS) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-4 no-print border border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
              <FileCheck2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Alat Bantu Register Penutupan & Pemeriksaan Kas</h3>
              <p className="text-xs text-slate-400">
                Sesuaikan nomor register, nominal fisik kas riil, dan simpan atau cetak berita acara resmi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoFillCash}
              className="flex items-center gap-1.5 bg-teal-600/80 hover:bg-teal-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
              title="Hitung lembar pecahan kas tunai secara proporsional"
            >
              <Sparkles size={14} />
              <span>Hitung Otomatis Pecahan</span>
            </button>

            <button
              onClick={handleSaveRegisterData}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
              title="Simpan data pemeriksaan kas fisik ke memori lokal"
            >
              <Save size={14} />
              <span>Simpan Pemeriksaan Kas</span>
            </button>
          </div>
        </div>

        {/* Input Konfigurasi Nomor & Detail Bank */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nomor Register Kas</label>
            <input
              type="text"
              value={nomorRegister}
              onChange={(e) => setNomorRegister(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:ring-1 focus:ring-teal-400 outline-none"
              placeholder="REG.BKU/2026/08/001"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nama Rekening Bank</label>
            <input
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:ring-1 focus:ring-teal-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Nomor Rekening Bank</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:ring-1 focus:ring-teal-400 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onBackToBku && (
              <button
                onClick={onBackToBku}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
              >
                <BookOpen size={14} />
                <span>Kembali ke Buku Kas Umum</span>
              </button>
            )}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
              >
                <Edit3 size={14} />
                <span>Ubah Pejabat TTD</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Tombol Buka Layar Penuh (Modal) */}
            <button
              id="register-penutupan-btn-fullscreen-bottom"
              type="button"
              onClick={handleOpenFullScreen}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all shadow-sm border border-indigo-400/50 cursor-pointer"
              title="Buka Register Penutupan BKU dalam Tampilan Layar Penuh (Modal)"
            >
              <Maximize2 size={14} />
              <span>Buka Layar Penuh (Modal)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              <span>Export Excel</span>
            </button>

            <ExportPdfButton
              elementId="printable-register-penutupan-bku"
              filename={`Register_Penutupan_BKU_${selectedYear || 'All'}_${selectedMonth || 'All'}.pdf`}
              buttonText="Unduh Berita Acara PDF"
              variant="default"
              defaultOrientation="portrait"
              options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
            />

            <button
              onClick={handlePrintBeritaAcara}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black py-2 px-4 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
            >
              <Printer size={14} />
              <span>Cetak Berita Acara</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL FULL SCREEN REGISTER PENUTUPAN BKU (RESPONSIF LAYAR BESAR & HP) */}
      {/* ========================================================================= */}
      {isFullScreen && (
        <div 
          id="modal-fullscreen-register-penutupan"
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in select-text"
          role="dialog"
          aria-modal="true"
          aria-label="Layar Penuh Register Penutupan BKU"
        >
          {/* HEADER BAR MODAL FULL SCREEN (STICKY TOP) */}
          <div className="shrink-0 bg-slate-900 border-b border-indigo-500/30 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 z-10 shadow-xl">
            <div className="grid grid-cols sm:grid-cols-2 gap-6">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/40 shrink-0">
                  <FileCheck2 size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-base font-black text-white uppercase tracking-wider truncate">
                      Register Penutupan &amp; Berita Acara BKU
                    </h3>
                    <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full font-bold">
                      Layar Penuh (Modal)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    Periode: {formatPeriodFull()} • No: {nomorRegister}
                  </p>
                </div>
              </div>
  
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between">
                <button
                  type="button"
                  onClick={handleAutoFillCash}
                  className="flex items-center gap-1.5 bg-teal-600/90 hover:bg-teal-500 text-white font-bold py-1.5 px-2.5 sm:px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                  title="Hitung proporsional lembar pecahan otomatis"
                >
                  <Sparkles size={14} className="text-amber-300" />
                  <span className="hidden md:inline">Auto Hitung</span>
                  <span className="md:hidden">Auto Hitung</span>
                </button>
  
                <button
                  type="button"
                  onClick={handleSaveRegisterData}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2.5 sm:px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                  title="Simpan data pemeriksaan fisik kas"
                >
                  <Save size={14} />
                  <span>Simpan</span>
                </button>
  
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="hidden sm:flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                  title="Export format Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span>Excel</span>
                </button>
  
                <button
                  type="button"
                  onClick={handlePrintBeritaAcara}
                  className="flex items-center gap-1.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-black py-1.5 px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                  title="Cetak Berita Acara Fisik"
                >
                  <Printer size={14} />
                  <span className="hidden sm:inline">Cetak</span>
                  <span className="sm:hidden">Cetak</span>
                </button>
  
                {/* Tombol Tutup Fullscreen */}
                <button
                  type="button"
                  onClick={handleCloseFullScreen}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                  title="Tutup Tampilan Layar Penuh (Esc)"
                >
                  <Minimize2 size={14} />
                  <span className="hidden sm:inline">Tutup Layar Penuh</span>
                  <span className="sm:hidden">Tutup</span>
                </button>
              </div>
            </div>
          </div>

          {/* BODY MODAL FULL SCREEN (SCROLLABLE & OPTIMIZED FOR LARGE SCREEN AND HP) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
            {/* QUICK STATUS BAR SUMMARY IN MODAL */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 no-print">
              <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Saldo Buku BKU</div>
                <div className="font-mono text-xs sm:text-sm font-black text-teal-300">{formatCurrency(saldoBuku)}</div>
              </div>
              <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Kas Fisik Nyata</div>
                <div className="font-mono text-xs sm:text-sm font-black text-emerald-400">{formatCurrency(totalKasNyataFisik)}</div>
              </div>
              <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Selisih Kas</div>
                <div className={`font-mono text-xs sm:text-sm font-black ${selisihKas === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selisihKas === 0 ? 'Rp 0 (NIHIL)' : formatCurrency(selisihKas)}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Status Keseimbangan</div>
                <div className="text-xs sm:text-xs font-black truncate">
                  {selisihKas === 0 ? (
                    <span className="text-emerald-400">✓ SEIMBANG / COCOK</span>
                  ) : selisihKas > 0 ? (
                    <span className="text-amber-400">⚠ LEBIH KAS</span>
                  ) : (
                    <span className="text-rose-400">⚠ KURANG KAS</span>
                  )}
                </div>
              </div>
            </div>

            {/* REGISTER PAPER CONTAINER INSIDE MODAL */}
            <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-2xl space-y-6">
              {/* KOP RESMI */}
              <div className="reg-header-box text-center border-b-4 border-double border-slate-900 pb-4">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 font-serif m-0">
                  DESA ADAT BASANGALAS
                </h2>
                <p className="text-xs sm:text-sm font-bold text-slate-800 font-serif my-0.5 uppercase tracking-wide">
                  Kecamatan Abang, Kabupaten Karangasem - Bali
                </p>
                <p className="text-[11px] text-slate-600 font-serif m-0">
                  Sekretariat: Jl. Raya Basangalas, Tribuana, Abang, Karangasem, Bali 80852
                </p>
              </div>

              {/* JUDUL */}
              <div className="text-center space-y-1">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-900 font-serif">
                  REGISTER PENUTUPAN BUKU KAS UMUM &amp; BERITA ACARA PEMERIKSAAN KAS
                </h3>
                <p className="text-xs font-mono font-bold text-slate-700">
                  Nomor Register: <span className="text-slate-950 font-black">{nomorRegister}</span>
                </p>
                <div className="flex justify-center items-center gap-3 text-xs font-semibold text-slate-600 flex-wrap">
                  <span>Periode: <strong>{formatPeriodFull()}</strong></span>
                  <span>•</span>
                  <span>Tanggal Penutupan: <strong>{formatDate(signatureDate)}</strong></span>
                  <span>•</span>
                  <span>Format: <strong>Permendagri No. 20/2018 (Lampiran D.1)</strong></span>
                </div>
              </div>

              {/* TEKS PEMBUKA */}
              <div className="text-xs sm:text-sm leading-relaxed text-slate-800 text-justify bg-slate-50 p-3 rounded-lg border border-slate-200">
                Pada hari ini, tanggal <strong>{formatDate(signatureDate)}</strong>, bertempat di <strong>{customPlace}</strong>, telah dilakukan pemeriksaan kas (<em>cash opname</em>) serta penutupan <strong>Buku Kas Umum (BKU)</strong> penatausahaan keuangan Aci Usaba Dalem Desa Adat Basangalas untuk periode <strong>{formatPeriodFull()}</strong>, dengan rincian dan posisi kas sebagai berikut:
              </div>

              {/* I. POSISI BKU */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
                  <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">I</span>
                  Posisi Kas Menurut Buku Kas Umum (BKU)
                </h4>
                <table className="w-full text-xs text-left border-collapse border border-slate-400">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2 border border-slate-400 w-10 text-center">No</th>
                      <th className="p-2 border border-slate-400">Uraian Transaksi Kas</th>
                      <th className="p-2 border border-slate-400 text-right w-44">Jumlah Nominal (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border border-slate-400 text-center font-mono">1</td>
                      <td className="p-2 border border-slate-400 font-medium">Saldo Awal Periode Lalu</td>
                      <td className="p-2 border border-slate-400 text-right font-mono font-bold">{formatCurrency(saldoAwal)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-400 text-center font-mono">2</td>
                      <td className="p-2 border border-slate-400 font-medium">Total Penerimaan (Debet) Periode Ini</td>
                      <td className="p-2 border border-slate-400 text-right font-mono font-bold text-emerald-800">+{formatCurrency(totalPenerimaan)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-400 text-center font-mono">3</td>
                      <td className="p-2 border border-slate-400 font-medium">Total Pengeluaran (Kredit) Periode Ini</td>
                      <td className="p-2 border border-slate-400 text-right font-mono font-bold text-rose-800">-{formatCurrency(totalPengeluaran)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-400 text-center font-mono">4</td>
                      <td className="p-2 border border-slate-400 font-medium">Mutasi Bersih Kas Periode Ini</td>
                      <td className="p-2 border border-slate-400 text-right font-mono font-bold">{formatCurrency(mutasiPeriode)}</td>
                    </tr>
                    <tr className="bg-slate-100 font-black">
                      <td colSpan={2} className="p-2.5 border border-slate-400 uppercase text-slate-900">
                        A. SALDO AKHIR MENURUT BUKU KAS UMUM (BKU)
                      </td>
                      <td className="p-2.5 border border-slate-400 text-right text-sm font-black font-mono text-teal-900 bg-teal-50">
                        {formatCurrency(saldoBuku)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="p-2 border border-slate-400 bg-slate-50 italic text-[11px] text-slate-700">
                        Terbilang: <strong>{numberToWords(Math.abs(saldoBuku))} Rupiah</strong> {saldoBuku < 0 ? '(Defisit)' : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* II. HASIL PEMERIKSAAN KAS FISIK */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-300 pb-1 flex-wrap gap-2">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2">
                    <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">II</span>
                    Hasil Pemeriksaan Kas Nyata / Fisik Kas (Cash Opname)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAutoFillCash}
                    className="flex items-center gap-1 text-[11px] bg-teal-700 hover:bg-teal-800 text-white px-2.5 py-1 rounded font-bold transition-colors cursor-pointer"
                  >
                    <Sparkles size={12} className="text-amber-300" />
                    <span>Auto Hitung Pecahan</span>
                  </button>
                </div>

                {/* Grid Tabel Pecahan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Uang Kertas */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-100 p-1.5 rounded border border-slate-300 font-bold text-xs">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <Banknote size={14} className="text-emerald-700" />
                        A. Rincian Uang Kertas
                      </span>
                      <span className="font-mono text-emerald-800 font-black">{formatCurrency(totalBanknotes)}</span>
                    </div>
                    <table className="w-full text-xs text-left border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-50 font-bold text-[10px] text-center">
                          <th className="p-1 border border-slate-400 w-24">Pecahan</th>
                          <th className="p-1 border border-slate-400 w-20">Lembar</th>
                          <th className="p-1 border border-slate-400 text-right">Jumlah (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {banknotes.map((n) => (
                          <tr key={n.nominal}>
                            <td className="p-1 border border-slate-400 font-mono text-[11px]">Rp {n.nominal.toLocaleString('id-ID')}</td>
                            <td className="p-0.5 border border-slate-400 text-center font-mono">
                              <input
                                type="number"
                                min="0"
                                value={n.count}
                                onChange={(e) => updateBanknoteCount(n.nominal, parseInt(e.target.value) || 0)}
                                className="w-16 text-center border border-slate-300 rounded p-0.5 font-mono text-xs focus:ring-1 focus:ring-teal-500 font-bold"
                              />
                            </td>
                            <td className="p-1 border border-slate-400 text-right font-mono text-[11px] font-semibold">
                              {formatCurrency(n.nominal * (n.count || 0))}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black text-xs">
                          <td colSpan={2} className="p-1.5 border border-slate-400 uppercase">Subtotal Uang Kertas</td>
                          <td className="p-1.5 border border-slate-400 text-right font-mono text-emerald-800 font-black">
                            {formatCurrency(totalBanknotes)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Uang Logam */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-100 p-1.5 rounded border border-slate-300 font-bold text-xs">
                      <span className="flex items-center gap-1.5 text-slate-800">
                        <Coins size={14} className="text-amber-700" />
                        B. Rincian Uang Logam
                      </span>
                      <span className="font-mono text-amber-800 font-black">{formatCurrency(totalCoins)}</span>
                    </div>
                    <table className="w-full text-xs text-left border-collapse border border-slate-400">
                      <thead>
                        <tr className="bg-slate-50 font-bold text-[10px] text-center">
                          <th className="p-1 border border-slate-400 w-24">Pecahan</th>
                          <th className="p-1 border border-slate-400 w-20">Keping</th>
                          <th className="p-1 border border-slate-400 text-right">Jumlah (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coins.map((c) => (
                          <tr key={c.nominal}>
                            <td className="p-1 border border-slate-400 font-mono text-[11px]">Rp {c.nominal.toLocaleString('id-ID')}</td>
                            <td className="p-0.5 border border-slate-400 text-center font-mono">
                              <input
                                type="number"
                                min="0"
                                value={c.count}
                                onChange={(e) => updateCoinCount(c.nominal, parseInt(e.target.value) || 0)}
                                className="w-16 text-center border border-slate-300 rounded p-0.5 font-mono text-xs focus:ring-1 focus:ring-teal-500 font-bold"
                              />
                            </td>
                            <td className="p-1 border border-slate-400 text-right font-mono text-[11px] font-semibold">
                              {formatCurrency(c.nominal * (c.count || 0))}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black text-xs">
                          <td colSpan={2} className="p-1.5 border border-slate-400 uppercase">Subtotal Uang Logam</td>
                          <td className="p-1.5 border border-slate-400 text-right font-mono text-amber-800 font-black">
                            {formatCurrency(totalCoins)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Total Tunai Fisik */}
                    <div className="bg-emerald-50 border border-emerald-300 p-2 rounded flex justify-between items-center text-xs font-black">
                      <span className="uppercase text-emerald-950">Total Kas Tunai (A + B)</span>
                      <span className="font-mono text-emerald-900 text-sm font-black">{formatCurrency(totalKasTunaiFisik)}</span>
                    </div>
                  </div>
                </div>

                {/* Bank & Kas Khusus */}
                <div className="mt-3 space-y-2">
                  <table className="w-full text-xs text-left border-collapse border border-slate-400">
                    <thead className="bg-slate-100 font-bold">
                      <tr>
                        <th className="p-2 border border-slate-400 w-10 text-center">No</th>
                        <th className="p-2 border border-slate-400">Komponen Saldo Kas Bukan Tunai</th>
                        <th className="p-2 border border-slate-400 text-right w-44">Jumlah Nominal (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-slate-400 text-center font-mono">1</td>
                        <td className="p-2 border border-slate-400">
                          <div className="font-bold text-slate-900">C. Saldo Kas di Bank (Rekening Resmi Desa Adat)</div>
                          <div className="text-[11px] text-slate-600">
                            <span className="font-mono">{bankAccountName} (No. Rek: {bankAccountNumber})</span>
                          </div>
                        </td>
                        <td className="p-2 border border-slate-400 text-right font-mono font-bold text-slate-900">
                          <input
                            type="number"
                            value={bankPhysical}
                            onChange={(e) => setBankPhysical(Number(e.target.value) || 0)}
                            className="w-36 text-right border border-slate-300 rounded p-1 font-mono text-xs font-bold"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-400 text-center font-mono">2</td>
                        <td className="p-2 border border-slate-400">
                          <div className="font-bold text-slate-900">D. Saldo Kas Khusus / Kas Aset Lainnya</div>
                          <div className="text-[11px] text-slate-600">
                            (Aset Lainnya 1.1.2.*: {formatCurrency(kasAsetLainnyaBuku)}, Sasah Abu: {formatCurrency(kasSasahAbuBuku)}, Lainnya: {formatCurrency(kasLainnyaBuku)})
                          </div>
                        </td>
                        <td className="p-2 border border-slate-400 text-right font-mono font-bold text-slate-900">
                          <input
                            type="number"
                            value={kasKhususPhysical}
                            onChange={(e) => setKasKhususPhysical(Number(e.target.value) || 0)}
                            className="w-36 text-right border border-slate-300 rounded p-1 font-mono text-xs font-bold"
                          />
                        </td>
                      </tr>
                      <tr className="bg-slate-200 font-black">
                        <td colSpan={2} className="p-2.5 border border-slate-400 uppercase text-slate-900">
                          B. TOTAL KAS NYATA / FISIK KESELURUHAN (TUNAI + BANK + KAS KHUSUS)
                        </td>
                        <td className="p-2.5 border border-slate-400 text-right text-sm font-black font-mono text-slate-950 bg-slate-300/80">
                          {formatCurrency(totalKasNyataFisik)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* III. REKONSILIASI */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
                  <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">III</span>
                  Rekonsiliasi &amp; Hasil Selisih Kas
                </h4>
                <table className="w-full text-xs text-left border-collapse border border-slate-400">
                  <tbody>
                    <tr>
                      <td className="p-2 border border-slate-400 w-2/3">1. Saldo Kas Menurut Buku Kas Umum (A)</td>
                      <td className="p-2 border border-slate-400 text-right font-mono font-bold">{formatCurrency(saldoBuku)}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-400">2. Total Saldo Kas Nyata / Fisik Kas (B)</td>
                      <td className="p-2 border border-slate-400 text-right font-mono font-bold">{formatCurrency(totalKasNyataFisik)}</td>
                    </tr>
                    <tr className={`font-black ${selisihKas === 0 ? 'bg-emerald-100 text-emerald-950' : (selisihKas > 0 ? 'bg-amber-100 text-amber-950' : 'bg-rose-100 text-rose-950')}`}>
                      <td className="p-2.5 border border-slate-400 uppercase">
                        SELISIH KAS (FISIK NYATA B - BUKU KAS A)
                      </td>
                      <td className="p-2.5 border border-slate-400 text-right font-mono text-sm font-black">
                        {selisihKas === 0 ? 'Rp 0 (NIHIL / COCOK)' : formatCurrency(selisihKas)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-400 font-bold uppercase text-[11px]">Status Keseimbangan Kas</td>
                      <td className="p-2 border border-slate-400 text-right font-bold text-xs uppercase">
                        {selisihKas === 0 ? (
                          <span className="text-emerald-800 font-black">✓ SEIMBANG / COCOK (NIHIL)</span>
                        ) : selisihKas > 0 ? (
                          <span className="text-amber-800 font-black">⚠ LEBIH KAS (SURPLUS FISIK)</span>
                        ) : (
                          <span className="text-rose-800 font-black">⚠ KURANG KAS (DEFISIT FISIK)</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* IV. BERITA ACARA PERNYATAAN */}
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-1">
                  <span className="bg-slate-900 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">IV</span>
                  Berita Acara Pernyataan Penutupan Kas
                </h4>
                <div className="space-y-1.5">
                  <textarea
                    value={catatanPenutupan}
                    onChange={(e) => setCatatanPenutupan(e.target.value)}
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-teal-500 font-sans"
                    placeholder="Tuliskan catatan hasil pemeriksaan atau penyebab terjadinya selisih kas bila ada..."
                  />
                </div>
              </div>

              {/* V. PENGESAHAN TANDA TANGAN */}
              <div className="pt-4 border-t-2 border-slate-300">
                <ReportSignatureBlock
                  keliangName={keliangName}
                  juruRaksaName={juruRaksaName}
                  customPlace={customPlace}
                  signatureDate={signatureDate}
                  keliangTitle="Keliang Adat Basangalas"
                  keliangSubtitle="Penanggung Jawab Umum"
                  juruRaksaTitle="Juru Raksa Desa Adat"
                  juruRaksaSubtitle="Pengelola Kas & Pembukuan"
                  keliangActionText="Mengetahui & Mengesahkan,"
                  namaDesa="DESA ADAT BASANGALAS"
                />
              </div>
            </div>

            {/* QUICK FOOTER IN MODAL */}
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 pb-6 border-t border-slate-800 text-xs text-slate-400 no-print">
              <div className="flex items-center gap-2">
                <span>Tekan tombol <strong>Esc</strong> atau klik Tutup untuk kembali ke tampilan biasa.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseFullScreen}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Tutup Layar Penuh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Export Excel Register */}
      <Modal 
        isOpen={isExportExcelOpen} 
        onClose={() => setIsExportExcelOpen(false)} 
        title="Export Register Penutupan BKU ke Excel" 
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nama File Excel (.xlsx)</label>
            <input
              type="text"
              value={exportExcelFilename}
              onChange={(e) => setExportExcelFilename(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              placeholder="Register_Penutupan_BKU.xlsx"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              File Excel akan mencakup Kop resmi, Posisi BKU, Lembar Cash Opname Pecahan Uang Kertas/Logam, Rekonsiliasi, dan Pengesahan Tanda Tangan.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsExportExcelOpen(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300 cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={processExportExcel}
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-xs cursor-pointer"
            >
              <Download size={14} />
              <span>Download Excel</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RegisterPenutupanBku;
