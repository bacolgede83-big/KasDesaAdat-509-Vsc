import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Scale, 
  Wallet, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  MapPin, 
  Info, 
  BookOpen, 
  ArrowRight, 
  HeartHandshake,
  FileSpreadsheet,
  ArrowRightLeft,
  Layers,
  TrendingUp,
  Receipt,
  Copy,
  Check,
  Settings,
  RefreshCw,
  Eye,
  FileCheck,
  MessageSquareText,
  Sparkles,
  ThumbsUp,
  Menu,
  Users,
  Lightbulb,
  ChevronDown,
  ScrollText
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatter';
import { getStoredSignatures, getSignatureSettings, getEffectiveStamp } from '../utils/signatureStorage';
import ExportPdfButton from '../components/shared/ExportPdfButton';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import { REFERENSI_REKENING } from '../constants';
import type { BkuData, JuDisplayRow, DanaPuniaItem, UrunanItem } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import FormulirNaratifKalkulasi from '../components/neraca/FormulirNaratifKalkulasi';
import TabNaskahSidang from '../components/neraca/TabNaskahSidang';

interface DokumenNeracaProps {
  bkuData?: BkuData[];
  entries?: JuDisplayRow[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
}

export const DokumenNeraca: React.FC<DokumenNeracaProps> = ({
  bkuData = [],
  entries = [],
  danaPuniaItems = [],
  urunanItems = []
}) => {
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'dokumen' | 'komparasi' | 'naskah' | 'rincian'>('dokumen');
  const [copied, setCopied] = useState(false);
  const [copiedAwam, setCopiedAwam] = useState(false);
  const [speechTab, setSpeechTab] = useState<'awam' | 'resmi'>('awam');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isNaratifModalOpen, setIsNaratifModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Names & Document Settings
  const [keliangName, setKeliangName] = useState(() => localStorage.getItem('neraca_keliangName') || 'I Made Mudita');
  const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('neraca_juruRaksaName') || 'I Putu Gede Sutrana');
  const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('neraca_customPlace') || 'Basangalas');
  const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('neraca_signatureDate') || new Date().toISOString().split('T')[0]);
  const [institutionName, setInstitutionName] = useState(() => localStorage.getItem('neraca_institutionName') || 'DESA ADAT BASANGALAS');
  const [upakaraName, setUpakaraName] = useState(() => localStorage.getItem('neraca_upakaraName') || 'Tata kelola Kas Desa Adat');
  const [address, setAddress] = useState(() => localStorage.getItem('neraca_address') || 'Jln.Raya Basangalas, Desa Tribuana, Kecamatan Abang, Kabupaten Karangasem, Bali');
  const [contact, setContact] = useState(() => localStorage.getItem('neraca_contact') || '0852-3702-5068');
  const [email, setEmail] = useState(() => localStorage.getItem('neraca_email') || 'Basangalasjururaksa@gmail.com');
  const [saldoShuLpd, setSaldoShuLpd] = useState(() => localStorage.getItem('neraca_saldo_shulpd') || '');
  const [saldoTempekan, setSaldoTempekan] = useState(() => localStorage.getItem('neraca_saldo_tempekan') || '');

  const [tempKeliangName, setTempKeliangName] = useState(keliangName);
  const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
  const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
  const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
  const [tempInstitutionName, setTempInstitutionName] = useState(institutionName);
  const [tempUpakaraName, setTempUpakaraName] = useState(upakaraName);
  const [tempAddress, setTempAddress] = useState(address);
  const [tempContact, setTempContact] = useState(contact);
  const [tempEmail, setTempEmail] = useState(email);
  const [tempSaldoShuLpd, setTempSaldoShuLpd] = useState(saldoShuLpd);
  const [tempSaldoTempekan, setTempSaldoTempekan] = useState(saldoTempekan);

  // Digital Signatures and Settings
  const [signatures, setSignatures] = useState(getStoredSignatures());
  const [sigSettings, setSigSettings] = useState(getSignatureSettings());

  useEffect(() => {
    const handleSigUpdate = () => {
      setSignatures(getStoredSignatures());
      setSigSettings(getSignatureSettings());
    };
    window.addEventListener('signatures-updated', handleSigUpdate);
    window.addEventListener('storage', handleSigUpdate);
    return () => {
      window.removeEventListener('signatures-updated', handleSigUpdate);
      window.removeEventListener('storage', handleSigUpdate);
    };
  }, []);

  const effectiveStamp = getEffectiveStamp(signatures, institutionName || 'DESA ADAT BASANGALAS');

  const handleOpenSettings = () => {
    setTempKeliangName(keliangName);
    setTempJuruRaksaName(juruRaksaName);
    setTempCustomPlace(customPlace);
    setTempSignatureDate(signatureDate);
    setTempInstitutionName(institutionName);
    setTempUpakaraName(upakaraName);
    setTempAddress(address);
    setTempContact(contact);
    setTempEmail(email);
    setTempSaldoShuLpd(saldoShuLpd);
    setTempSaldoTempekan(saldoTempekan);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    setKeliangName(tempKeliangName);
    setJuruRaksaName(tempJuruRaksaName);
    setCustomPlace(tempCustomPlace);
    setSignatureDate(tempSignatureDate);
    setInstitutionName(tempInstitutionName);
    setUpakaraName(tempUpakaraName);
    setAddress(tempAddress);
    setContact(tempContact);
    setEmail(tempEmail);
    setSaldoShuLpd(tempSaldoShuLpd);
    setSaldoTempekan(tempSaldoTempekan);

    localStorage.setItem('neraca_keliangName', tempKeliangName);
    localStorage.setItem('neraca_juruRaksaName', tempJuruRaksaName);
    localStorage.setItem('neraca_customPlace', tempCustomPlace);
    localStorage.setItem('neraca_signatureDate', tempSignatureDate);
    localStorage.setItem('neraca_institutionName', tempInstitutionName);
    localStorage.setItem('neraca_upakaraName', tempUpakaraName);
    localStorage.setItem('neraca_address', tempAddress);
    localStorage.setItem('neraca_contact', tempContact);
    localStorage.setItem('neraca_email', tempEmail);

    if (tempSaldoShuLpd) localStorage.setItem('neraca_saldo_shulpd', tempSaldoShuLpd);
    else localStorage.removeItem('neraca_saldo_shulpd');

    if (tempSaldoTempekan) localStorage.setItem('neraca_saldo_tempekan', tempSaldoTempekan);
    else localStorage.removeItem('neraca_saldo_tempekan');

    setIsSettingsOpen(false);
    setNotification({ type: 'success', message: 'Pengaturan kop surat, saldo & tanda tangan berhasil disimpan!' });
  };

  const getAccountName = (code: string) => {
    const acc = REFERENSI_REKENING.find(r => r.code === code);
    return acc ? acc.name : code;
  };

  useEffect(() => {
    const handleSigUpdate = () => {
      setSignatures(getStoredSignatures());
      setSigSettings(getSignatureSettings());
    };
    window.addEventListener('signatures-updated', handleSigUpdate);
    return () => window.removeEventListener('signatures-updated', handleSigUpdate);
  }, []);

  // 1. Calculate Standard Neraca Financial Report
  const financialReport = useMemo(() => {
    const filteredEntries = (entries || []).filter(e => e.date && e.date <= reportDate);
    const balances: { [key: string]: number } = {};

    filteredEntries.forEach(entry => {
      const rawCode = (entry.kodeRekening || '').trim();
      if (!rawCode) return;
      const cleanCode = rawCode.split(' - ')[0].trim();
      const debet = Number(entry.debet) || 0;
      const kredit = Number(entry.kredit) || 0;

      if (!balances[cleanCode]) balances[cleanCode] = 0;
      if (rawCode !== cleanCode && !balances[rawCode]) balances[rawCode] = 0;

      if (cleanCode.startsWith('1')) {
        balances[cleanCode] += (debet - kredit);
        if (rawCode !== cleanCode) balances[rawCode] += (debet - kredit);
      } else if (cleanCode.startsWith('2') || cleanCode.startsWith('3')) {
        balances[cleanCode] += (kredit - debet);
        if (rawCode !== cleanCode) balances[rawCode] += (kredit - debet);
      }
    });

    // Standard Revenue/Expense calculation for Surplus/Defisit
    let pendapatan = 0;
    let belanja = 0;
    let sumberDana = 0;
    let silpa = 0;

    filteredEntries.forEach(e => {
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;
      const code = (e.kodeRekening || '').trim();
      if (code.startsWith('4')) pendapatan += (kreditVal - debetVal);
      if (code.startsWith('5')) belanja += (debetVal - kreditVal);
      if (code.startsWith('7')) sumberDana += (kreditVal - debetVal);
      if (code.startsWith('6')) silpa += (kreditVal - debetVal);
    });
    const surplusDefisit = (pendapatan + sumberDana + silpa) - belanja;

    // Aset Kas & Setara Kas (1.1.1.x)
    const asetKasItems = Object.keys(balances)
      .filter(code => code.startsWith('1.1.1') && !code.includes(' - '))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.01);
    const totalAsetKas = asetKasItems.reduce((s, i) => s + i.saldo, 0);

    // Kas Juru Raksa Tunai (1.1.1.02)
    const kasJuruRaksaTunai = { code: '1.1.1.02', name: getAccountName('1.1.1.02'), saldo: balances['1.1.1.02'] || 0 };
    const totalKasDesaAdat = Math.max(0, totalAsetKas - kasJuruRaksaTunai.saldo);

    // Helper to find special cash balances with fallback to text search & localStorage setting
    const getSpecialKasBalance = (targetCode: string, nameKeywords: string[], storageKey: string) => {
      if (balances[targetCode] !== undefined && balances[targetCode] !== 0) {
        return balances[targetCode];
      }
      for (const k of Object.keys(balances)) {
        if (k.split(' - ')[0].trim() === targetCode && balances[k]) {
          return balances[k];
        }
      }
      let textSum = 0;
      filteredEntries.forEach(e => {
        const c = (e.kodeRekening || '').split(' - ')[0].trim();
        const u = (e.uraian || '').toLowerCase();
        if (c.startsWith('1.1.2') && nameKeywords.some(kw => u.includes(kw))) {
          textSum += (Number(e.debet) || 0) - (Number(e.kredit) || 0);
        }
      });
      if (textSum !== 0) return textSum;

      const savedVal = Number(localStorage.getItem(storageKey)) || 0;
      return savedVal;
    };

    const saldoTempekanVal = getSpecialKasBalance('1.1.2.07', ['tempekan'], 'neraca_saldo_tempekan');
    const saldoDPDVal = getSpecialKasBalance('1.1.2.06', ['pembangunan desa', 'shu lpd', 'shu-lpd'], 'neraca_saldo_shulpd');

    // Kas Tempekan (1.1.2.07)
    const kasTempekan = { code: '1.1.2.07', name: getAccountName('1.1.2.07'), saldo: saldoTempekanVal };

    // Kas Saldo Karya-18 (1.1.2.01)
    const kasKarya18 = { code: '1.1.2.01', name: getAccountName('1.1.2.01'), saldo: balances['1.1.2.01'] || 0 };
    const kasDPD = { code: '1.1.2.06', name: getAccountName('1.1.2.06'), saldo: saldoDPDVal };
    const totalkasAdat2 = (Number(kasDPD.saldo) || 0) + (Number(kasKarya18.saldo) || 0);
   
    // Kas Program & Hibah (1.1.2.x)
    const kasHibahProvLPD = { code: '1.1.2.02', name: getAccountName('1.1.2.02'), saldo: balances['1.1.2.02'] || 0 };
    const kasHibahKabLPD = { code: '1.1.2.03', name: getAccountName('1.1.2.03'), saldo: balances['1.1.2.03'] || 0 };
    const kasDanaKematian = { code: '1.1.2.05', name: getAccountName('1.1.2.05'), saldo: balances['1.1.2.05'] || 0 };

    const totalKasHibah = (Number(kasHibahProvLPD.saldo) || 0) + (Number(kasHibahKabLPD.saldo) || 0);

    const asetKasProgram = Object.keys(balances)
      .filter(code => code.startsWith('1.1.2') && !code.includes(' - '))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.01);
    const calculatedKasProgram = asetKasProgram.reduce((s, i) => s + i.saldo, 0);
    const totalAsetKasProgram = Math.max(calculatedKasProgram, saldoDPDVal + saldoTempekanVal);

    // Piutang (1.2.x)
    const asetPiutang = Object.keys(balances)
      .filter(code => code.startsWith('1.2'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.01);
    const totalAsetPiutang = asetPiutang.reduce((s, i) => s + i.saldo, 0);

    // Aset Lainnya (1.x lainnya di luar 1.1.1, 1.1.2, dan 1.2)
    const asetLainnya = Object.keys(balances)
      .filter(code => code.startsWith('1.1.2'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.01);
    const totalAsetLainnya = asetLainnya.reduce((s, i) => s + i.saldo, 0);

    const totalKasLPD = totalKasDesaAdat + totalAsetLainnya;

    // Total Aset Aktif
    const totalAsetAktif = totalAsetKas + totalAsetKasProgram + totalAsetPiutang;

    // Sumber Dana Masuk (7.x / 4.1.2.x Urunan)
    let totalSumberDanaMasuk = 0;
    const sumberDanaMap: Record<string, { code: string; name: string; saldo: number }> = {};
    filteredEntries.forEach(e => {
      const code = (e.kodeRekening || '').trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;
      if (code.startsWith('7') || code.startsWith('4.1.2')) {
        const incoming = (kreditVal - debetVal);
        if (incoming > 0) {
          if (!sumberDanaMap[code]) {
            sumberDanaMap[code] = { code, name: getAccountName(code), saldo: 0 };
          }
          sumberDanaMap[code].saldo += incoming;
          totalSumberDanaMasuk += incoming;
        }
      }
    });
    const urunanTotal = (urunanItems || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
    if (totalSumberDanaMasuk === 0 && urunanTotal > 0) {
      totalSumberDanaMasuk = urunanTotal;
    }
    const asetsumberDana = Object.values(sumberDanaMap);
    const totalAsetsumberDana = totalSumberDanaMasuk;

    // Penerimaan Dana Punia & Pendapatan Asli Desa Adat (4.1.1.x atau 4.x lainnya di luar 4.1.2 dan 4.1.3)
    let totalPenerimaanPunia = 0;
    const danaPuniaMap: Record<string, { code: string; name: string; saldo: number }> = {};
    
    // Penerimaan Hibah (4.1.3.x): Hibah Provinsi (4.1.3.01) & Hibah Kabupaten (4.1.3.02)
    let totalHibahProvMasuk = 0;
    let totalHibahKabMasuk = 0;
    let totalHibahLainnyaMasuk = 0;
    const danaHibahMap: Record<string, { code: string; name: string; saldo: number }> = {};

    filteredEntries.forEach(e => {
      const code = (e.kodeRekening || '').trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;

      // 1. Akun Hibah (4.1.3.x)
      if (code.startsWith('4.1.3')) {
        const incoming = (kreditVal - debetVal);
        if (incoming > 0) {
          if (!danaHibahMap[code]) {
            danaHibahMap[code] = { code, name: getAccountName(code), saldo: 0 };
          }
          danaHibahMap[code].saldo += incoming;
          if (code === '4.1.3.01') {
            totalHibahProvMasuk += incoming;
          } else if (code === '4.1.3.02') {
            totalHibahKabMasuk += incoming;
          } else {
            totalHibahLainnyaMasuk += incoming;
          }
        }
      }
      // 2. Akun Punia & Pendapatan Asli (4.1.1.01)
      if (code.startsWith('4') && !code.startsWith('4.1.2') && !code.startsWith('4.1.3')) {
        const incoming = (kreditVal - debetVal);
        if (incoming > 0) {
          if (!danaPuniaMap[code]) {
            danaPuniaMap[code] = { code, name: getAccountName(code), saldo: 0 };
          }
          danaPuniaMap[code].saldo += incoming;
          totalPenerimaanPunia += incoming;
        }
      }
    });

    if (danaPuniaItems && danaPuniaItems.length > 0) {
      const puniaFiltered = danaPuniaItems.filter((i: any) => !i.date || i.date <= reportDate);
      const puniaItemsTotal = puniaFiltered.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
      if (puniaItemsTotal > totalPenerimaanPunia) {
        totalPenerimaanPunia = puniaItemsTotal;
      }
    }
    const asetDanaPunia = Object.values(danaPuniaMap);
    const totalAsetDanaPunia = totalPenerimaanPunia;

    const asetDanaHibah = Object.values(danaHibahMap);
    const totalPendapatanHibah = totalHibahProvMasuk + totalHibahKabMasuk + totalHibahLainnyaMasuk;

    // Pasiva
    const kewajiban = Object.keys(balances)
      .filter(code => code.startsWith('2'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.01);
    const totalKewajiban = kewajiban.reduce((s, i) => s + i.saldo, 0);

    const ekuitas = Object.keys(balances)
      .filter(code => code.startsWith('3') && code !== '3.1.1.07')
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.01);

    const manualSurplusBalance = balances['3.1.1.07'] || 0;
    const totalEkuitasModal = ekuitas.reduce((s, i) => s + i.saldo, 0) + manualSurplusBalance;
    const totalEkuitas = totalEkuitasModal + surplusDefisit;
    const totalPasiva = totalKewajiban + totalEkuitas;
    const isBalanced = Math.abs(totalAsetAktif - totalPasiva) < 1;
    const selisih = Math.abs(totalAsetAktif - totalPasiva);

    return {
      entryCount: filteredEntries.length,
      asetPada: asetKasItems,
      kasJuruRaksaTunai,
      totalAsetKas,
      totalKasDesaAdat,
      totalKasLPD,
      asetKasProgram,
      totalAsetKasProgram,
      kasHibahProvLPD,
      kasHibahKabLPD,
      kasDPD,
      kasKarya18,
      kasDanaKematian,
      kasTempekan,
      totalKasHibah,
      totalkasAdat2,
      totalKasAdat2: totalkasAdat2,
      totalAsetTempekan: Number(kasTempekan.saldo) || 0,
      totalAsetKasTempekan: Number(kasTempekan.saldo) || 0,
      totalKasKarya18: Number(kasKarya18.saldo) || 0,
      totalKasDPD: Number(kasDPD.saldo) || 0,
      totalAsetKasSHULPD: Number(kasDPD.saldo) || 0,
      totalKasDanaKematian: Number(kasDanaKematian.saldo) || 0,
      asetTempekan: [kasTempekan],
      totalAsetAktif,
      asetPiutang,
      totalAsetPiutang,
      asetLainnya,
      totalAsetLainnya,
      asetDanaPunia,
      totalAsetDanaPunia,
      asetsumberDana,
      totalAsetsumberDana,
      totalAsetSumberDana: totalAsetsumberDana,
      totalAsetDanaAci: totalAsetsumberDana,
      asetDanaHibah,
      totalPendapatanHibah,
      totalHibahProvMasuk,
      totalHibahKabMasuk,
      kewajiban,
      totalKewajiban,
      ekuitas,
      totalEkuitasModal,
      surplusDefisit,
      manualSurplusBalance,
      totalJuruRaksaTunai: Number(kasJuruRaksaTunai.saldo) || 0,
      totalAsetLPD: totalKasLPD,
      totalAsetKasBank: totalAsetKas + totalAsetLainnya,
      totalKasBank: totalKasDesaAdat,
      totalPiutangDesaAdat: 0,
      totalAset: totalAsetAktif,
      totalEkuitas,
      totalPasiva,
      isBalanced,
      selisih
    };
  }, [entries, reportDate, danaPuniaItems, urunanItems]);

  // 2. Analisis Komparasi Pengeluaran Jurnal vs Belanja Detail & Punia Barang
  const expenditureAnalysis = useMemo(() => {
    const effectiveEntries = (entries || []).filter((e: any) => e.date && e.date <= reportDate);
    
    // Total Kas Keluar Jurnal Riil
    let totalKasKeluarJurnal = 0;
    if (effectiveEntries.length > 0) {
      effectiveEntries.forEach((e: any) => {
        const code = (e.kodeRekening || '').trim();
        const isCashAccount = code.startsWith('1.1.1') || code.startsWith('1.1.2');
        if (!isCashAccount) return;

        // Skip mutasi antar kas internal
        const relatedRows = effectiveEntries.filter((r: any) => r.idTransaksi === e.idTransaksi);
        const debetKasRows = relatedRows.filter((r: any) => r.rowType === 'debet' && (r.kodeRekening?.startsWith('1.1.1') || r.kodeRekening?.startsWith('1.1.2')));
        const kreditKasRows = relatedRows.filter((r: any) => r.rowType === 'kredit' && (r.kodeRekening?.startsWith('1.1.1') || r.kodeRekening?.startsWith('1.1.2')));
        
        if (debetKasRows.length > 0 && kreditKasRows.length > 0) return;

        if ((Number(e.kredit) || 0) > 0) {
          totalKasKeluarJurnal += (Number(e.kredit) || 0);
        }
      });
    }

    // Fallback ke BKU jika pengeluaran kas di jurnal 0 tapi ada data pengeluaran BKU
    if (totalKasKeluarJurnal === 0 && bkuData && bkuData.length > 0) {
      totalKasKeluarJurnal = bkuData
        .filter((b: any) => b.tanggal && b.tanggal <= reportDate)
        .reduce((sum: number, b: any) => sum + (Number(b.pengeluaran) || 0), 0);
    }

    // Detail Realisasi Belanja berdasarkan Bagan Akun (CoA) constants.tsx
    let totalInsentif = 0;           // 5.1.1 & 5.1.4: Beban Insentif Prajuru & Pengurus
    let totalOperasional = 0;        // 5.1.2: Beban Operasional Kantor & Daya (ATK, Konsumsi, Listrik, PDAM)
    let totalTransportBebanAdat = 0; // 5.1.5: Perjalanan Dinas / Saku Prajuru, Admin Bank & Beban Adat
    let totalParhyangan = 0;         // 5.2.*: Program Parhyangan (Aci, Upakara, Pecanangan, Renovasi Pura)
    let totalPawongan = 0;           // 5.3.*: Program Pawongan (Pasraman, Seni Wali, SIPANDU, Kapasitas Prajuru)
    let totalPalemahan = 0;          // 5.4.*: Program Palemahan (Wantilan, Sampah, Hutan, Setra, LPD)
    let totalBelanjaLainnya = 0;

    interface ActiveExpenseItem {
      code: string;
      name: string;
      amount: number;
      category: string;
    }
    const itemMap: Record<string, ActiveExpenseItem> = {};

    effectiveEntries.forEach((e: any) => {
      const code = (e.kodeRekening || '').trim();
      if (!code.startsWith('5')) return;
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;
      const amount = debetVal - kreditVal;
      if (amount <= 0) return;

      const accInfo = REFERENSI_REKENING.find(r => r.code === code);
      const accName = accInfo?.name || e.namaRekening || `Belanja ${code}`;

      let cat = 'Lainnya';
      if (code.startsWith('5.1.1') || code.startsWith('5.1.4')) {
        totalInsentif += amount;
        cat = 'Insentif Prajuru';
      } else if (code.startsWith('5.1.2')) {
        totalOperasional += amount;
        cat = 'Operasional Kantor & Daya';
      } else if (code.startsWith('5.1')) {
        totalTransportBebanAdat += amount;
        cat = 'Operasional & Beban Adat';
      } else if (code.startsWith('5.2')) {
        totalParhyangan += amount;
        cat = 'Parhyangan';
      } else if (code.startsWith('5.3')) {
        totalPawongan += amount;
        cat = 'Pawongan';
      } else if (code.startsWith('5.4')) {
        totalPalemahan += amount;
        cat = 'Palemahan';
      } else {
        totalBelanjaLainnya += amount;
      }

      if (!itemMap[code]) {
        itemMap[code] = { code, name: accName, amount: 0, category: cat };
      }
      itemMap[code].amount += amount;
    });

    // Jika Jurnal belum mencatat belanja 5.x tapi BKU memiliki data pengeluaran
    if (Object.keys(itemMap).length === 0 && bkuData && bkuData.length > 0) {
      bkuData
        .filter((b: any) => b.tanggal && b.tanggal <= reportDate && (Number(b.pengeluaran) || 0) > 0)
        .forEach((b: any) => {
          const code = (b.kode || '').trim();
          const amount = Number(b.pengeluaran) || 0;
          const name = b.uraian || 'Pengeluaran BKU';
          let cat = 'Operasional';

          if (code.startsWith('5.1.1') || code.startsWith('5.1.4') || b.kategori === 'Beban Insentif Prajuru') {
            totalInsentif += amount;
            cat = 'Insentif Prajuru';
          } else if (code.startsWith('5.1.2') || b.kategori === 'Beban Operasional Kantor') {
            totalOperasional += amount;
            cat = 'Operasional Kantor & Daya';
          } else if (code.startsWith('5.1.5') || b.kategori === 'Beban Operasional' || b.kategori === 'Beban Operasional Adat') {
            totalTransportBebanAdat += amount;
            cat = 'Operasional & Beban Adat';
          } else if (code.startsWith('5.2') || b.kategori === 'Parhyangan') {
            totalParhyangan += amount;
            cat = 'Program Parhyangan';
          } else if (code.startsWith('5.3') || b.kategori === 'Pawongan') {
            totalPawongan += amount;
            cat = 'Program Pawongan';
          } else if (code.startsWith('5.4') || b.kategori === 'Palemahan') {
            totalPalemahan += amount;
            cat = 'Program Palemahan';
          } else {
            totalBelanjaLainnya += amount;
          }

          const itemKey = code || name;
          if (!itemMap[itemKey]) {
            itemMap[itemKey] = { code: code || '5.x', name, amount: 0, category: cat };
          }
          itemMap[itemKey].amount += amount;
        });
    }

    const totalBelanja5Pos = totalInsentif + totalOperasional + totalTransportBebanAdat + totalParhyangan + totalPawongan + totalPalemahan + totalBelanjaLainnya;
    const activeExpenseList = Object.values(itemMap).sort((a, b) => b.amount - a.amount);

    // Nilai Punia Barang Non-Kas (dari 1.1.1.06 atau 4.1.1.04)
    let totalPuniaBarang = 0;
    effectiveEntries.forEach((e: any) => {
      const code = (e.kodeRekening || '').trim();
      if (code === '1.1.1.06' || code === '4.1.1.04') {
        totalPuniaBarang += Math.max(Number(e.debet) || 0, Number(e.kredit) || 0);
      }
    });
    if (totalPuniaBarang === 0) {
      const barangItem = financialReport.asetDanaPunia.find(p => p.code === '1.1.1.06' || p.name.toLowerCase().includes('barang'));
      if (barangItem) {
        totalPuniaBarang = Math.abs(barangItem.saldo);
      }
    }

    const selisihKasVsPos = totalKasKeluarJurnal - totalBelanja5Pos;
    const totalRealisasiYadnya = totalBelanja5Pos + totalPuniaBarang;
    const selisihNetto = totalRealisasiYadnya - totalKasKeluarJurnal;

    return {
      totalKasKeluarJurnal,
      totalBelanja5Pos,
      totalInsentif,
      totalOperasional,
      totalTransportBebanAdat,
      totalParhyangan,
      totalPawongan,
      totalPalemahan,
      totalBelanjaLainnya,
      activeExpenseList,
      totalPuniaBarang,
      selisihKasVsPos,
      totalRealisasiYadnya,
      selisihNetto,
      // Alias kompatibilitas
      totalBebantenan: totalParhyangan,
      totalKonsumsi: 0,
      totalCaru: 0,
      totalWewalungan: 0,
      pos512: totalOperasional,
      pos513: totalTransportBebanAdat,
      totalAsetSumberDana: financialReport.totalAsetsumberDana
    };
  }, [entries, bkuData, reportDate, financialReport]);

  const totalHutang = Math.abs(financialReport.totalKewajiban);
  const isBebasHutang = totalHutang === 0;
  const surplusBersih = financialReport.surplusDefisit + (financialReport.manualSurplusBalance || 0);
  const isSurplus = surplusBersih >= 0;

  const formattedReportDate = new Date(reportDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const effectiveSigDate = signatureDate || reportDate || new Date().toISOString().split('T')[0];
  const formattedSigDate = new Date(effectiveSigDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const awamNarrativeText = useMemo(() => {
    const bankLpd = Math.max(0, financialReport.totalAsetKas - financialReport.kasJuruRaksaTunai.saldo);
    const hasBarang = (expenditureAnalysis?.totalPuniaBarang || 0) > 0;
    const desaName = institutionName || 'DESA ADAT BASANGALAS';

    return `PENJELASAN RINGKAS KEUANGAN UNTUK KRAMA ${desaName.toUpperCase()}
(Disampaikan Dalam Bahasa Awam & Terbuka pada Paruman Banjar / Desa)
Posisi Data: Per ${formattedReportDate}

Om Swastyastu,
Bapak, Ibu, lan Prajuru Krama ${desaName} sane wangiang titiang,

Puji syukur kita panjatkan ke hadapan Ida Sang Hyang Widhi Wasa / Tuhan Yang Maha Esa, seluruh rangkaian karya yadnya ${upakaraName || 'Desa Adat'} telah terselenggara dengan lancar, tertib, dan labda karya berkat ketulusan gotong royong kita bersama.

Agar seluruh krama desa dapat memahami laporan keuangan ini dengan terang, jelas, dan tanpa istilah yang membingungkan, berikut kami sampaikan ${hasBarang ? '5' : '4'} pokok pertanggungjawaban keuangan kita:

1. DARI MANA ASAL UANG YANG DIKUMPULKAN?
Total dana kas yang terkumpul bersumber dari:
- Urunan / Peturunan Warga Krama: ${formatCurrency(financialReport.totalAsetsumberDana)}
- Dana Punia Sukarela & PAD Adat: ${formatCurrency(financialReport.totalAsetDanaPunia)}${financialReport.totalPendapatanHibah > 0 ? `\n- Penerimaan Dana Hibah (Provinsi & Kabupaten): ${formatCurrency(financialReport.totalPendapatanHibah)} (Hibah Prov: ${formatCurrency(financialReport.totalHibahProvMasuk)}, Hibah Kab: ${formatCurrency(financialReport.totalHibahKabMasuk)})` : ''}
Semua dana yang diserahkan krama dan pihak pemberi bantuan telah dicatat satu per satu ke dalam pembukuan resmi, tidak ada dana yang tercecer atau tidak tercatat.

2. UANG KAS DIPAKAI UNTUK APA SAJA?
Uang kas keluar riil yang dibelanjakan untuk keperluan desa adat dan karya adalah ${formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}, dengan rincian realisasi belanja:
- Operasional & Beban Adat (5.1.5): ${formatCurrency(expenditureAnalysis.totalTransportBebanAdat)}
- Program Parhyangan / Aci Upakara (5.2): ${formatCurrency(expenditureAnalysis.totalParhyangan)}
- Program Pawongan / Krama (5.3): ${formatCurrency(expenditureAnalysis.totalPawongan)}
- Program Palemahan / Lingkungan (5.4): ${formatCurrency(expenditureAnalysis.totalPalemahan)}${hasBarang ? `

3. GOTONG ROYONG BARANG LANGSUNG (PUNIA NON-KAS)
Selain menyerahkan uang tunai, krama dan pamedek yang tulus berdana punia dalam bentuk barang langsung (seperti beras, babi, kelapa, buah-buahan) senilai ${formatCurrency(expenditureAnalysis.totalPuniaBarang)}. Barang-barang ini telah langsung habis terpakai untuk kelancaran upakara. Dengan demikian, nilai pengorbanan suci yadnya kita secara keseluruhan bernilai ${formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}.` : ''}

${hasBarang ? '4' : '3'}. APAKAH DESA ADAT KITA MEMILIKI UTANG ATAU BON TERTUNGGAK?
Prajuru menegaskan kepada seluruh krama: ${isBebasHutang ? 'DESA ADAT KITA SAAT INI 100% BEBAS DARI HUTANG (Nol Bon Tertunggak). Seluruh belanja ke warung dan pihak luar sudah diselesaikan lunas tanpa beban kewajiban.' : `Masih tercatat kewajiban belanja yang dalam proses penyelesaian sebesar ${formatCurrency(totalHutang)}.`}

${hasBarang ? '5' : '4'}. BERAPA SISA UANG KITA HARI INI DAN DISIMPAN DI MANA?
Desa kita membukukan Sisa Kas Lebih (Surplus) sebesar ${formatCurrency(surplusBersih)}.
Seluruh uang sisa ini tersimpan secara aman dan jelas lokasinya:
- Uang Tunai dipegang Juru Raksa Desa: ${formatCurrency(financialReport.kasJuruRaksaTunai.saldo)} (siap digunakan sewaktu-waktu bila ada kebutuhan adat mendadak).
- Uang Kas Tersimpan Aman di Rekening LPD / Bank: ${formatCurrency(bankLpd)}.
Sisa uang ini menjadi tabungan kas cadangan milik krama ${desaName} untuk menyongsong upakara dan operasional berikutnya.

Matur suksma atas pasikian, ketulusan, dan rasa gotong royong seluruh krama desa.
Om Santih, Santih, Santih, Om.`;
  }, [financialReport, expenditureAnalysis, formattedReportDate, upakaraName, isBebasHutang, totalHutang, surplusBersih, institutionName]);

  const handleCopyAwamNarrative = () => {
    navigator.clipboard.writeText(awamNarrativeText);
    setCopiedAwam(true);
    setTimeout(() => setCopiedAwam(false), 2500);
    setNotification({ type: 'success', message: 'Naskah narasi bahasa awam berhasil disalin ke clipboard!' });
  };

  const handleCopyNarrative = () => {
    const text = `LAPORAN PERTANGGUNGJAWABAN & PENJELASAN NERACA KEUANGAN DESA ADAT BASANGALAS
Periode Pelaporan: Per ${formattedReportDate}

Om Swastyastu,

Puji syukur kita panjatkan ke hadapan Ida Sang Hyang Widhi Wasa / Tuhan Yang Maha Esa atas terselenggaranya seluruh rangkaian upakara dan operasional dengan lancar, transparan, dan akuntabel.

I. POSISI ASET KAS DAN AKTIVA
Total Saldo Aset Kas & Setara Kas saat ini tercatat sebesar ${formatCurrency(financialReport.totalAsetKas)}, dengan rincian saldo Kas di Juru Raksa (Tunai) sebesar ${formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}. Total Aset Aktif secara keseluruhan adalah ${formatCurrency(financialReport.totalAsetAktif)}.

II. ANALISIS REALISASI BELANJA KAS VS PENYERAPAN YADNYA
1. Total Pengeluaran Kas Riil (Jurnal Umum): ${formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}
2. Rincian Realisasi Belanja Kas Sesuai Bagan Akun (CoA): ${formatCurrency(expenditureAnalysis.totalBelanja5Pos)}
   - Operasional & Beban Adat (5.1.5): ${formatCurrency(expenditureAnalysis.totalTransportBebanAdat)}
   - Program Parhyangan / Upakara & Pura (5.2): ${formatCurrency(expenditureAnalysis.totalParhyangan)}
   - Program Pawongan / Krama (5.3): ${formatCurrency(expenditureAnalysis.totalPawongan)}
   - Program Palemahan / Lingkungan & Wilayah (5.4): ${formatCurrency(expenditureAnalysis.totalPalemahan)}${expenditureAnalysis.totalPuniaBarang > 0 ? `\n3. Penyerapan Dana Punia Barang (Non-Kas): ${formatCurrency(expenditureAnalysis.totalPuniaBarang)}\n4. Total Realisasi Yadnya Gabungan: ${formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}` : ''}

III. STATUS KEWAJIBAN & SURPLUS
Desa Adat Basangalas dalam posisi ${isBebasHutang ? 'BEBAS HUTANG (0 Kewajiban)' : `Kewajiban ${formatCurrency(totalHutang)}`} dengan Surplus Bersih Periode Berjalan sebesar ${formatCurrency(surplusBersih)}.

Om Santih, Santih, Santih, Om.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    setNotification({ type: 'success', message: 'Naskah narasi berhasil disalin ke clipboard!' });
  };

  // Generate Formal PDF using jsPDF + autoTable
  const generateFormalPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Kop Surat
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(institutionName.toUpperCase(), 105, 15, { align: 'center' });

      if (upakaraName) {
        doc.setFontSize(11);
        doc.text(upakaraName.toUpperCase(), 105, 20.5, { align: 'center' });
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(address, 105, 25.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(`Kontak: ${contact} | Email: ${email}`, 105, 29.5, { align: 'center' });
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(address, 105, 21, { align: 'center' });
        doc.setFontSize(8);
        doc.text(`Kontak: ${contact} | Email: ${email}`, 105, 26, { align: 'center' });
      }

      // Garis Ganda Kop
      doc.setLineWidth(0.8);
      doc.line(15, 32.5, 195, 32.5);
      doc.setLineWidth(0.2);
      doc.line(15, 34, 195, 34);

      // Judul Laporan
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DOKUMEN PENJELASAN NARATIF & KALKULASI NERACA', 105, 41, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`Posisi Per Tanggal: ${formattedReportDate}`, 105, 46, { align: 'center' });

      // Tabel Ringkasan
      const showStatusPemulihan = isBebasHutang && surplusBersih > 0;
      const hasKasProgram = financialReport.totalAsetKasProgram > 0;
      const hasHibahMasuk = financialReport.totalPendapatanHibah > 0;
      const hasPuniaBarang = (Number(expenditureAnalysis.totalPuniaBarang) || 0) > 0;
      let counter = 1;
      const summaryRows: string[][] = [
        [String(counter++), 'Total Saldo Aset Kas & Setara Kas (1.1.1.x)', 'Kas Aktif', formatCurrency(financialReport.totalAsetKas)],
        [String(counter++), 'Kas di Juru Raksa (Tunai Siap Pakai 1.1.1.02)', 'Likuiditas', formatCurrency(financialReport.kasJuruRaksaTunai.saldo)],
        [String(counter++), 'Kas di Rekening Bank / LPD (1.1.1.03)', 'Simpanan', formatCurrency(financialReport.totalKasDesaAdat)],
        ...(hasKasProgram ? [[String(counter++), `Kas Program & Hibah (1.1.2.x) [Prov: ${formatCurrency(financialReport.totalKasAdat2)} | Kab: ${formatCurrency(financialReport.totalKasHibah)}]`, 'Kas Program', formatCurrency(financialReport.totalAsetKasProgram)]] : []),
        [String(counter++), 'Penerimaan Urunan / Peturunan Krama (7.x / 4.1.2.x)', 'Penerimaan Modal', formatCurrency(financialReport.totalAsetsumberDana)],
        [String(counter++), 'Penerimaan Dana Punia & PAD Adat (4.1.1.x)', 'Pendapatan Asli', formatCurrency(financialReport.totalAsetDanaPunia)],
        ...(hasHibahMasuk ? [[String(counter++), `Penerimaan Hibah (4.1.3.x) [Prov: ${formatCurrency(financialReport.totalHibahProvMasuk)} | Kab: ${formatCurrency(financialReport.totalHibahKabMasuk)}]`, 'Pendapatan Hibah', formatCurrency(financialReport.totalPendapatanHibah)]] : []),
        [String(counter++), 'Total Pengeluaran Kas Jurnal Umum / BKU', 'Arus Kas Keluar', formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)],
        [String(counter++), 'Total Realisasi Belanja Kas Langsung (Akun 5)', 'Realisasi Kas', formatCurrency(expenditureAnalysis.totalBelanja5Pos)],
        ...(hasPuniaBarang ? [
          [String(counter++), 'Penerimaan Dana Punia Barang (Non-Kas Terpakai)', 'Barang Yadnya', formatCurrency(expenditureAnalysis.totalPuniaBarang)],
          [String(counter++), 'Total Realisasi Penyerapan Yadnya Gabungan', 'Kas + Barang', formatCurrency(expenditureAnalysis.totalRealisasiYadnya)]
        ] : []),
        [String(counter++), 'Total Kewajiban / Hutang Pihak Ketiga', isBebasHutang ? 'Nihil / Lunas' : 'Ada Hutang', isBebasHutang ? 'Rp 0 (BEBAS HUTANG)' : formatCurrency(totalHutang)],
        ...(showStatusPemulihan ? [[String(counter++), 'Status Pemulihan Kas Pendapatan (Opsi 3)', 'Surplus Kas Utuh', '100% Utuh / Terpulihkan']] : []),
        [String(counter++), 'Surplus / Defisit Bersih Periode Berjalan', isSurplus ? 'Surplus Berjalan' : 'Defisit', formatCurrency(surplusBersih)],
      ];

      autoTable(doc, {
        startY: 51,
        head: [['No', 'Indikator / Pos Neraca', 'Kategori', 'Jumlah Saldo (Rp)']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2.2 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 95 },
          2: { cellWidth: 35 },
          3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        }
      });

      // Tabel Rincian Pos Belanja
      const lastY = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Rincian Pos Belanja Kas Berdasarkan Standar Bagan Akun (CoA):', 15, lastY);

      const belanjaRows = [
        ['1', '5.1.5', 'Operasional & Beban Adat', formatCurrency(expenditureAnalysis.totalTransportBebanAdat)],
        ['2', '5.2', 'Program Parhyangan (Aci, Upakara, Pecanangan & Pura)', formatCurrency(expenditureAnalysis.totalParhyangan)],
        ['3', '5.3', 'Program Pawongan (Krama)', formatCurrency(expenditureAnalysis.totalPawongan)],
        ['4', '5.4', 'Program Palemahan (Renovasi, Sampah & Setra)', formatCurrency(expenditureAnalysis.totalPalemahan)],
        ...(expenditureAnalysis.totalBelanjaLainnya > 0 ? [['7', '5.x', 'Belanja Program Adat Lainnya', formatCurrency(expenditureAnalysis.totalBelanjaLainnya)]] : []),
        ['', 'TOTAL', 'Subtotal Belanja Kas Langsung (Akun 5)', formatCurrency(expenditureAnalysis.totalBelanja5Pos)],
        ...(hasPuniaBarang ? [
          ['', 'NON-KAS', 'Punia Barang Habis Terpakai', formatCurrency(expenditureAnalysis.totalPuniaBarang)],
          ['', 'TOTAL REALISASI', 'Total Penyerapan Gabungan (Kas + Non-Kas)', formatCurrency(expenditureAnalysis.totalRealisasiYadnya)]
        ] : [])
      ];

      autoTable(doc, {
        startY: lastY + 3,
        head: [['No', 'Kode', 'Uraian Pos Anggaran & Belanja', 'Realisasi (Rp)']],
        body: belanjaRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 25 },
          2: { cellWidth: 105 },
          3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        }
      });

      // Penjelasan Ringkas untuk Krama Desa (Bahasa Awam)
      const afterBelanjaY = (doc as any).lastAutoTable.finalY + 6;
      const needNewPageForAwam = afterBelanjaY > 215;
      if (needNewPageForAwam) {
        doc.addPage();
      }
      const narasiY = needNewPageForAwam ? 18 : afterBelanjaY;
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Penjelasan Ringkas untuk Krama Desa (Bahasa Awam):', 15, narasiY);

      const awamRows: string[][] = [];
      let awamNum = 1;
      awamRows.push([`${awamNum++}. Asal Dana`, `Terkumpul dari Urunan Krama (${formatCurrency(financialReport.totalAsetsumberDana)}), Dana Punia Sukarela (${formatCurrency(financialReport.totalAsetDanaPunia)})${financialReport.totalPendapatanHibah > 0 ? `, dan Penerimaan Hibah (${formatCurrency(financialReport.totalPendapatanHibah)})` : ''}. Semua tercatat tertib.`]);
      awamRows.push([`${awamNum++}. Belanja Nyata`, `Kas keluar riil ${formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)} untuk Insentif Prajuru (${formatCurrency(expenditureAnalysis.totalInsentif)}), Operasional Kantor & Daya (${formatCurrency(expenditureAnalysis.totalOperasional)}), Perjalanan/Adat (${formatCurrency(expenditureAnalysis.totalTransportBebanAdat)}), Parhyangan (${formatCurrency(expenditureAnalysis.totalParhyangan)}), Pawongan (${formatCurrency(expenditureAnalysis.totalPawongan)}), Palemahan (${formatCurrency(expenditureAnalysis.totalPalemahan)}).`]);
      if (hasPuniaBarang) {
        awamRows.push([`${awamNum++}. Punia Barang`, `Menerima gotong royong barang langsung senilai ${formatCurrency(expenditureAnalysis.totalPuniaBarang)} yang habis terpakai langsung untuk upakara yadnya.`]);
      }
      awamRows.push([`${awamNum++}. Status Utang`, isBebasHutang ? 'BEBAS DARI SEGALA BENTUK HUTANG (Lunas 100%, nihil bon tertunggak di warung maupun rekanan).' : `Tercatat kewajiban berjalan sebesar ${formatCurrency(totalHutang)}.`]);
      awamRows.push([`${awamNum++}. Sisa Kas Nyata`, `Sisa kas lebih (surplus) sebesar ${formatCurrency(surplusBersih)}, tersimpan aman di Kas Tunai Juru Raksa (${formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}) dan Rekening LPD/Bank (${formatCurrency(financialReport.totalKasDesaAdat)}) sebagai cadangan kas desa.`]);

      autoTable(doc, {
        startY: narasiY + 3,
        head: [['Poin', 'Uraian Sederhana untuk Paruman Krama Desa']],
        body: awamRows,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.2, cellPadding: 1.8 },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: 'bold' },
          1: { cellWidth: 148 }
        }
      });

      // Tanda Tangan
      const sigY = (doc as any).lastAutoTable.finalY + 12;
      if (sigY > 230) {
        doc.addPage();
      }
      const finalSigY = sigY > 230 ? 25 : sigY;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ditetapkan di : ${customPlace}`, 140, finalSigY);
      doc.text(`Pada Tanggal : ${formattedSigDate}`, 140, finalSigY + 5);

      // Keliang
      doc.text('Mengetahui / Mengesahkan,', 30, finalSigY + 14, { align: 'center' });
      doc.text('Keliang Desa Adat', 30, finalSigY + 19, { align: 'center' });

      // Stempel Resmi Desa Adat jika ON
      if (sigSettings.showStampOverlay && effectiveStamp) {
        try {
          doc.addImage(effectiveStamp, 'PNG', 12, finalSigY + 16, 26, 26);
        } catch (e) {
          // ignore error
        }
      }

      // TTD Keliang jika ON
      if (sigSettings.autoEmbed && signatures.keliang) {
        try {
          doc.addImage(signatures.keliang, 'PNG', 16, finalSigY + 20, 28, 18);
        } catch (e) {
          // ignore error
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`( ${keliangName} )`, 30, finalSigY + 45, { align: 'center' });

      // Juru Raksa
      doc.setFont('helvetica', 'normal');
      doc.text('Juru Raksa / Bendahara,', 160, finalSigY + 14, { align: 'center' });
      doc.text('Juru Raksa Desa', 160, finalSigY + 19, { align: 'center' });

      // TTD Juru Raksa jika ON
      if (sigSettings.autoEmbed && signatures.juruRaksa) {
        try {
          doc.addImage(signatures.juruRaksa, 'PNG', 146, finalSigY + 20, 28, 18);
        } catch (e) {
          // ignore error
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`( ${juruRaksaName} )`, 160, finalSigY + 45, { align: 'center' });

      doc.save(`Dokumen_Naratif_Neraca_${reportDate}.pdf`);
      setNotification({ type: 'success', message: 'PDF Formal Neraca berhasil diunduh!' });
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', message: 'Gagal membuat file PDF. Silakan gunakan tombol Unduh PDF Lengkap.' });
    }
  };

  return (
    <div className="space-y-6 relative min-h-screen pb-20">
      {notification && (
        <div className="no-print">
          <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}

      {/* Global & Print CSS Rules */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
          .no-print, nav, aside, header, .sidebar, button, input, select {
            display: none !important;
          }
          ${(activeTab === 'naskah' || activeTab === 'rincian') ? `
          #printable-naratif-area {
            display: none !important;
          }
          #printable-naskah-sidang-area {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          #printable-naskah-sidang-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          ` : `
          #printable-naratif-area {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }
          #printable-naratif-area * {
            visibility: visible !important;
          }
          #printable-naskah-sidang-area {
            display: none !important;
          }
          `}
          body.print-naskah-mode #printable-naratif-area {
            display: none !important;
          }
          body.print-naskah-mode #printable-naskah-sidang-area {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          body.print-naskah-mode #printable-naskah-sidang-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: auto !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            page-break-inside: auto;
          }
          table th, table td {
            border: 1px solid #94a3b8 !important;
          }
          .bg-slate-900, .bg-slate-800, .bg-slate-700 {
            background-color: #f8fafc !important;
            color: #0f172a !important;
          }
          .text-white {
            color: #0f172a !important;
          }
        }
      `}</style>

      {/* Top Header Card */}
      <div className="no-print bg-white border-b-4 border-teal-500 rounded-2xl p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-500 border border-indigo-500/50 rounded-full text-xs font-bold tracking-wider uppercase">
              <FileCheck size={14} className="text-indigo-400" />
              <span>DOKUMEN RESMI & ANALISIS KALKULASI</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              Dokumen Neraca Keuangan
            </h1>
            <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
              Pusat analisis penjelasan naratif, rekonsiliasi kas keluar vs belanja, rincian aktiva-pasiva, naskah sidang pertanggungjawaban, dan lembar pengesahan resmi.
            </p>
          </div>

          <div className="flex flex-wrap justify-end items-center gap-3">
            {/* Status Otomatisasi Tanda Tangan & Stempel */}
            <div 
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-bold text-white shadow-xs"
              title="Status Otomatisasi Tanda Tangan & Stempel Resmi (Sesuai Pengaturan Sistem)"
            >
              <ShieldCheck size={14} className="text-teal-400" />
              <span className={sigSettings.autoEmbed ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                TTD: {sigSettings.autoEmbed ? 'ON' : 'OFF'}
              </span>
              <span className="text-slate-500">•</span>
              <span className={sigSettings.showStampOverlay ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                Stempel: {sigSettings.showStampOverlay ? 'ON' : 'OFF'}
              </span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
              <Calendar size={16} className="text-teal-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-black">Tanggal Laporan</span>
                <input 
                  type="date" 
                  value={reportDate} 
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* TOMBOL MENU TERPADU (NAVIGASI, UNDUH PDF, CETAK, SETTING) */}
            <div className="relative" ref={menuRef}>
              <button 
                id="dokumen-header-menu-button"
                type="button"
                onClick={() => setIsMenuOpen(prev => !prev)}
                className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white font-bold py-4 px-4 rounded-xl shadow-md transition-all text-xs border border-teal-700 active:scale-95 cursor-pointer"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                title="Buka Menu Dokumen Neraca"
              >
                <Menu size={16} className="text-teal-300" />
                <span className="tracking-wide">Menu</span>
                <ChevronDown size={14} className={`transition-transform duration-200 text-teal-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMenuOpen && (
                <div 
                  id="dokumen-header-menu-dropdown"
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100"
                >                 
                  {/* 1. Ekspor & Dokumen (Unduh PDF, Unduh PDF Formal, Cetak Dokumen) */}
                  <div className="p-1.5">
                    <div className="px-3 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400">
                      Dokumen, Cetak &amp; Ekspor
                    </div>

                    {/* Unduh PDF (Dokumen Neraca) */}
                    {/* Cetak Dokumen */}
                    <button
                      type="button"
                      onClick={() => {
                        handlePrint();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-teal-50 transition-colors group cursor-pointer"
                    >
                      <div className="p-2 bg-teal-100 text-teal-800 rounded-lg group-hover:bg-teal-200 transition-colors">
                        <Printer size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900">Cetak Dokumen</div>
                        <div className="text-[11px] text-slate-500 truncate">Cetak dokumen fisik (A4/Folio)</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsPdfModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-emerald-50 transition-colors group cursor-pointer"
                    >
                      <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg group-hover:bg-emerald-200 transition-colors">
                        <Download size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900">Unduh PDF</div>
                        <div className="text-[11px] text-slate-500 truncate">Atur orientasi &amp; download PDF dokumen</div>
                      </div>
                    </button>

                    {/* Unduh PDF Formal Standar */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        generateFormalPdf();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left rounded-xl hover:bg-rose-50 transition-colors group cursor-pointer"
                    >
                      <div className="p-2 bg-rose-100 text-rose-800 rounded-lg group-hover:bg-rose-200 transition-colors">
                        <FileCheck size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900">Unduh PDF Formal</div>
                        <div className="text-[11px] text-slate-500 truncate">Format tabel standar resmi &amp; TTD</div>
                      </div>
                    </button>
                  </div>

                  {/* 2. Pengaturan Tanda Tangan & Kop */}
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
                        <div className="font-bold text-slate-900">Setting TTD &amp; Kop</div>
                        <div className="text-[11px] text-slate-500">
                          Atur nama Keliang, Juru Raksa, tempat &amp; tgl</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigasi Tab Dokumen, Analisis, Naskah, Rincian */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2 bg-slate-100 border border-slate-400 rounded-xl p-2 shadow-lg flex items-center justify-between">
          {/* Dokumen Siap Cetak */}
          <button
            type="button"
            onClick={() => setActiveTab('dokumen')}
            className={`w-full flex items-center border border-slate-300 shadow-lg gap-3 px-3 py-1 text-xs text-left rounded-xl transition-colors group cursor-pointer ${activeTab === 'dokumen' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
              }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'dokumen' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
              }`}>
              <FileText size={15} />
            </div>
            <div className="flex-1 min-w-0 w-auto">
              <div className="font-bold truncate">Dokumen Siap Cetak</div>
            </div>
            {activeTab === 'dokumen' && <Check size={14} className="text-indigo-600 shrink-0" />}
          </button>
          {/* Analisis Komparasi */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('komparasi');
              setIsMenuOpen(false);
            }}
            className={`w-full flex items-center border border-slate-300 shadow-lg gap-3 px-3 py-1 text-xs text-left rounded-xl transition-colors group cursor-pointer ${activeTab === 'komparasi' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
              }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'komparasi' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
              }`}>
              <ArrowRightLeft size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">Analisis Komparasi</div>
            </div>
            {activeTab === 'komparasi' && <Check size={14} className="text-indigo-600 shrink-0" />}
          </button>
          {/* Naskah Narasi */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('naskah');
              setIsMenuOpen(false);
            }}
            className={`w-full flex items-center border border-slate-300 shadow-lg gap-3 px-3 py-1 text-xs text-left rounded-xl transition-colors group cursor-pointer ${activeTab === 'naskah' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
              }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'naskah' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
              }`}>
              <BookOpen size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">Naskah Narasi</div>
            </div>
            {activeTab === 'naskah' && <Check size={14} className="text-indigo-600 shrink-0" />}
          </button>
          {/* Rincian Formula */}
          <button
            type="button"
            onClick={() => {
              setIsNaratifModalOpen(true);
              setIsMenuOpen(false);
            }}
            className={`w-full flex items-center border border-slate-300 shadow-lg gap-3 px-3 py-1 text-xs text-left rounded-xl transition-colors group cursor-pointer ${activeTab === 'rincian' ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
              }`}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'rincian' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
              }`}>
              <Layers size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">Formulir Naratif</div>
            </div>
            {activeTab === 'rincian' && <Check size={14} className="text-indigo-600 shrink-0" />}
          </button>
        </div>
      </div>

      {/* Metric Cards Banner (Screen View) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-100 border border-slate-800 rounded-2xl p-4 gap-6 shadow-lg flex items-center">
          <div>  
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                <Coins size={22} className="text-emerald-600" />Total Aset Kas & Setara Kas
              </span>
            </div>
              <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(financialReport.totalAsetKas)}</p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Kas Aktif Terdistribusi</span>
            </div>
        </div>

        <div className="bg-slate-100 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-6">
          <div>
            <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-2">
              <Wallet size={22} /> Kas Juru Raksa (Tunai)
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-600"></p>
              <p className="text-xl font-black text-cyan-600 mt-1">{formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}</p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Likuiditas Langsung</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-100 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-6">
          <div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={22} /> Kas Keluar Jurnal (Riil)
                </span>
              </div>
              <div>    
                <p className="text-xl font-black text-rose-600 mt-1">{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</p>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Total Pengeluaran Kas</span>
              </div>
          </div>
        </div>

        <div className="bg-slate-100 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-6">
          <div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={22} /> Status Kewajiban / Hutang
              </span>
            </div>
            <div>
              <p className={`text-xl font-black mt-1 ${isBebasHutang ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isBebasHutang ? 'BEBAS HUTANG' : formatCurrency(totalHutang)}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">{isBebasHutang ? 'Nol Kewajiban Pihak Ke-3' : 'Kewajiban Belanja'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 2: Interactive Komparasi Belanja View */}
      {activeTab === 'komparasi' && (
        <div className="no-print space-y-6">
          <div className="bg-gradient-to-r from-slate-50 to-slate-200 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-600">
                  Transparansi Penyerapan Anggaran</span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Komparasi Kas Keluar vs Belanja Non-Kas
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Penjelasan logis mengapa pengeluaran kas riil di buku kas berbeda dengan total nilai yang terlaksana.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('dokumen')}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all self-start md:self-auto"
              >
                <FileText size={14} />
                <span>Lihat Format Lembar Cetak</span>
              </button>
            </div>

            {/* Visual Explainer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-4 bg-slate-200/60 border border-slate-400 rounded-xl">
                <p className="text-[11px] font-bold text-slate-500 uppercase">
                  1. Kas Keluar Riil (Jurnal)</p>
                <p className="text-xl font-black text-rose-700 mt-1">{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</p>
                <p className="text-[11px] text-slate-500 mt-2">
                  Total seluruh uang fisik/transfer kas yang keluar tercatat di Buku Kas Umum (BKU) dan Jurnal.
                </p>
              </div>

              <div className="p-4 bg-slate-200/60 border border-slate-400 rounded-xl">
                <p className="text-[11px] font-bold text-slate-500 uppercase">
                  2. Rincian Pos Belanja</p>
                <p className="text-xl font-black text-blue-700 mt-1">{formatCurrency(expenditureAnalysis.totalBelanja5Pos)}</p>
                <p className="text-[11px] text-slate-500 mt-2">
                  Alokasi uang kas langsung untuk operasional desa adat.
                </p>
              </div>

              <div className="p-4 bg-emerald-200/40 border border-emerald-600/30 rounded-xl">
                <p className="text-[11px] font-bold text-emerald-400 uppercase">
                  3. Punia Barang</p>
                <p className="text-xl font-black text-emerald-700 mt-1">{formatCurrency(expenditureAnalysis.totalPuniaBarang)}</p>
                <p className="text-[11px] text-emerald-400/80 mt-2">
                  Sumbangan sukarela krama berwujud barang langsung yang habis terpakai.
                </p>
              </div>

              <div className="p-4 bg-indigo-200/40 border border-indigo-600/30 rounded-xl">
                <p className="text-[11px] font-bold text-indigo-600 uppercase">
                  4. Total Nilai Operasional & beban Desa Adat</p>
                <p className="text-xl font-black text-indigo-700 mt-1">{formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}</p>
                <p className="text-[11px] text-indigo-500 mt-2">
                  Nilai riil total operasional: Gabungan belanja kas langsung ditambah punia barang non-kas.
                </p>
              </div>
            </div>

            {/* Layperson explanation callout */}
            {expenditureAnalysis.totalPuniaBarang > 0 && (
              <div className="mt-6 p-4 bg-gradient-to-r from-amber-400/20 to-amber-600/20 border border-slate-700/80 rounded-xl flex items-start gap-3">
                <Lightbulb size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                  <p className="font-bold text-slate-900">
                    💡Mengapa Nilai Operasional ({formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}) Lebih Besar Dari Pengeluaran Kas ({formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)})?
                  </p>
                  <p>
                    Dalam tradisi desa adat di Bali, banyak warga krama atau pamedek yang berdana punia tidak dengan uang kertas, melainkan langsung membawa <strong>karung beras, ayam caru, kelapa daksina, babi guling, atau buah-buahan</strong>.
                  </p>
                  <p>
                    Barang-barang ini <strong>tidak menggunakan uang kas desa untuk membelinya</strong>, namun langsung dinikmati dan dipakai bersama untuk kelancaran yadnya. Dengan mencatat nilai barang punia sebesar <strong>{formatCurrency(expenditureAnalysis.totalPuniaBarang)}</strong>, desa adat menghargai ketulusan setiap warga dan memperlihatkan nilai pengorbanan suci yang sesungguhnya secara adil dan transparan.
                  </p>
                </div>
              </div>
            )}

            {/* CoA Belanja Breakdown */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Rincian Realisasi Belanja Kas Sesuai Bagan Akun (CoA Standard)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-100 border border-slate-700/60 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">
                      1. Operasional & beban Adat</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-700 rounded-full font-mono font-bold">5.1.5</span>
                  </div>
                  <p className="px-4 text-base font-black text-amber-600 tracking-wide">{formatCurrency(expenditureAnalysis.totalTransportBebanAdat)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Operasional & Beban yang harus ditanggung oleh adat.</p>
                </div>

                <div className="p-3 bg-slate-100 border border-slate-700/60 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">2. Program Parhyangan</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-700 rounded-full font-mono font-bold">5.2</span>
                  </div>
                  <p className="px-4 text-base font-black text-emerald-600 tracking-wide">{formatCurrency(expenditureAnalysis.totalParhyangan)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Aci piodalan, upakara yadnya, sarana bebantenan, pecanangan, dan pemeliharaan pura.</p>
                </div>

                <div className="p-3 bg-slate-100 border border-slate-700/60 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">3. Program Pawongan</span>
                    <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-700 rounded-full font-mono font-bold">5.3</span>
                  </div>
                  <p className="px-4 text-base font-black text-purple-600 tracking-wide">{formatCurrency(expenditureAnalysis.totalPawongan)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Dana Kematian & Bulan Bahasa.</p>
                </div>

                <div className="p-3 bg-slate-100 border border-slate-700/60 rounded-xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-600">4. Program Palemahan</span>
                    <span className="text-[10px] px-2 py-0.5 bg-teal-500/20 text-teal-700 rounded-full font-mono font-bold">5.4</span>
                  </div>
                  <p className="px-4 text-base font-black text-teal-600 tracking-wide">{formatCurrency(expenditureAnalysis.totalPalemahan)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Renovasi Pelinggih, Pengelolaan sampah, Penataan setra.</p>
                </div>
              </div>

              {/* Rincian Transaksi Belanja Aktif (dari Jurnal/BKU/BKP) */}
              {expenditureAnalysis.activeExpenseList.length > 0 && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-400 rounded-xl">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText size={14} className="text-indigo-500" />
                    <span>Daftar Transaksi Belanja Riil Tercatat (Jurnal & BKU)</span>
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-500 border-b border-slate-700/60">
                        <tr>
                          <th className="py-2 pr-3">Kode</th>
                          <th className="py-2 pr-3">Nama Akun Belanja</th>
                          <th className="py-2 pr-3">Kategori</th>
                          <th className="py-2 px-4 text-right">Realisasi (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-slate-700">
                        {expenditureAnalysis.activeExpenseList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-100 transition-colors">
                            <td className="py-2 pr-3 font-mono text-indigo-400">{item.code}</td>
                            <td className="py-2 pr-1 font-medium">{item.name}</td>
                            <td className="py-2 pr-3 text-[11px] font-semibold text-slate-500">{item.category}</td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-slate-700">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Naskah Sidang Paruman (Basa Bali Alus Juru Raksa) */}
      {(activeTab === 'naskah' || activeTab === 'rincian') && (
        <div className="space-y-6">
          <TabNaskahSidang
            financialReport={financialReport}
            expenditureAnalysis={expenditureAnalysis}
            reportDate={reportDate}
            formattedReportDate={formattedReportDate}
            customPlace={customPlace}
            institutionName={institutionName}
            upakaraName={upakaraName}
            keliangName={keliangName}
            juruRaksaName={juruRaksaName}
            signatureDate={signatureDate}
            formattedSigDate={formattedSigDate}
            onSwitchToDokumen={() => setActiveTab('dokumen')}
          />
        </div>
      )}

      {/* Main Printable Document Area */}
      <div 
        id="printable-naratif-area" 
        className={`${activeTab === 'dokumen' ? 'block' : 'hidden print:hidden'} bg-white text-slate-900 rounded-2xl shadow-inline border border-slate-500 p-6 lg:p-10 transition-all font-sans`}
      >
        {/* Kop Surat Resmi */}
        <div className="border-b-4 border-double border-slate-900 pb-4 mb-6 text-center page-break-avoid">
          <h2 className="text-xl lg:text-2xl font-black uppercase tracking-widest font-serif text-slate-900">
            {institutionName}
          </h2>
          {upakaraName && (
            <h3 className="text-[12px] lg:text-base uppercase font-black tracking-wider text-slate-800 font-serif mt-1">
              {upakaraName}
            </h3>
          )}
          <p className="text-xs lg:text-sm font-medium text-slate-700 mt-1">
            {address}
          </p>
        </div>

        {/* Dokumen Header */}
        <div className="text-center mb-8 page-break-avoid">
          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-black text-xs uppercase tracking-widest rounded border border-slate-300 mb-2">
            LAMPIRAN RESMI LAPORAN PERTANGGUNGJAWABAN
          </span>
          <h3 className="text-lg lg:text-xl font-black uppercase tracking-wide text-slate-900 font-serif">
            DOKUMEN KALKULASI NERACA KEUANGAN
          </h3>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            Posisi Transaksi & Saldo Per Tanggal: <span className="font-bold text-slate-900">{formattedReportDate}</span>
          </p>
        </div>

        {/* Section I: Executive Financial Position */}
        <div className="mb-8 page-break-avoid">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1 mb-3">
            <div className="w-2.5 h-2.5 bg-slate-900 rounded-full"></div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 font-serif">
              I. RINGKASAN POSISI KEUANGAN & LIKUIDITAS KAS
            </h4>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 border border-slate-400 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Total Aset Kas & Setara Kas</span>
              <span className="text-base font-black text-emerald-700 block mt-1">{formatCurrency(financialReport.totalAsetKas)}</span>
              <span className="text-[10px] text-slate-500">Saldo seluruh kas aktif</span>
            </div>
            <div className="bg-slate-50 border border-slate-400 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Kas di Juru Raksa (Tunai)</span>
              <span className="text-base font-black text-blue-700 block mt-1">{formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}</span>
              <span className="text-[10px] text-slate-500">Likuiditas siap pakai bendahara</span>
            </div>
            <div className="bg-slate-50 border border-slate-400 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Kewajiban / Hutang</span>
              <span className="text-base font-black text-emerald-700 block mt-1">{isBebasHutang ? 'Rp 0 (BEBAS HUTANG)' : formatCurrency(totalHutang)}</span>
              <span className="text-[10px] text-slate-500">{isBebasHutang ? 'Lunas tanpa beban hutang' : 'Tercatat kewajiban'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-400 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Surplus Periode Berjalan</span>
              <span className="text-base font-black text-indigo-700 block mt-1">{formatCurrency(surplusBersih)}</span>
              <span className="text-[10px] text-slate-500">Akumulasi pendapatan vs beban</span>
            </div>
          </div>

          {/* Table of Financial Position */}
          <table className="w-full text-left text-xs border border-slate-400 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-900 border-b border-slate-400 font-bold">
              <tr>
                <th className="p-2.5 border-r border-slate-400 w-12 text-center">No</th>
                <th className="p-2.5 border-r border-slate-400">Pos / Komponen Neraca</th>
                <th className="p-2.5 border-r border-slate-400 w-36">Klasifikasi</th>
                <th className="p-2.5 px-2 text-right w-44">Nilai Tercatat (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-400">
              <tr>
                <td className="p-2 border-r border-slate-400 text-center font-bold">1</td>
                <td className="p-2 border-r border-slate-400 font-medium">Aset Lancar Kas & Setara Kas (Rekening 1.1.1.x)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Aktiva Lancar</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-slate-900 text-[15px] text-blue-700">{formatCurrency(financialReport.totalAsetKas)}</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-400 text-center font-bold"></td>
                <td className="p-2 border-r border-slate-400 font-medium">Kas Desa Adat (Akun 1.1.1.01)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Kas Desa Roban</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(financialReport.totalKasDesaAdat)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-2 border-r border-slate-400 text-center font-bold"></td>
                <td className="p-2 border-r border-slate-400 font-medium">Kas di Juru Raksa Tunai (Akun 1.1.1.02)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Kas Likuid</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}</td>
              </tr>
              <tr className="bg-blue-50 text-blue-700">
                <td className="p-2 border-r border-slate-400 text-center font-bold">2</td>
                <td className="p-2 border-r border-slate-400 font-medium">Kas Tempekan (Akun 1.1.2.07)</td>
                <td className="p-2 border-r border-slate-400 text-blue-600">Kas Desa Roban</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-blue-700 text-[15px]">{formatCurrency(financialReport.kasTempekan.saldo)}</td>
              </tr> 
              <tr className="bg-slate-50/50">
                <td className="p-2 border-r border-slate-400 text-center font-bold">3</td>
                <td className="p-2 border-r border-slate-400 font-medium">Kas Saldo Karya-18 & DPD (Rekening 1.1.2.x)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Kas Khusus</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-blue-700 text-[15px]">{formatCurrency(financialReport.totalkasAdat2)}</td>
              </tr>
              {financialReport.kasKarya18.saldo > 0 && (
                <tr className="bg-slate-50/50">
                  <td className="p-2 border-r border-slate-400 text-center font-bold"></td>
                  <td className="p-2 border-r border-slate-400 font-medium">
                    <div>Kas Saldo Karya-18 (Rekening 1.1.2.01)</div>
                  </td>
                  <td className="p-2 border-r border-slate-400 text-slate-600">Kas Khusus</td>
                  <td className="p-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(financialReport.kasKarya18.saldo)}</td>
                </tr>
              )}
              {financialReport.kasDPD.saldo > 0 && (
                <tr className="bg-slate-50/50">
                  <td className="p-2 border-r border-slate-400 text-center font-bold"></td>
                  <td className="p-2 border-r border-slate-400 font-medium">Kas Dana Pembangunan Desa (Rekening 1.1.2.06)</td>
                  <td className="p-2 border-r border-slate-400 text-slate-600">Kas Khusus</td>
                  <td className="p-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(financialReport.kasDPD.saldo)}</td>
                </tr>
              )}
              <tr className="bg-slate-500/10">
                <td className="p-2 border-r border-slate-400 text-center font-bold">4</td>
                <td className="p-2 border-r border-slate-400 font-medium">Total Penerimaan Sumber Dana/ Urunan (Akun 7.x)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Penerimaan Modal</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-slate-900">{formatCurrency(financialReport.totalAsetsumberDana)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-2 border-r border-slate-400 text-center font-bold">5</td>
                <td className="p-2 border-r border-slate-400 font-medium">Total Penerimaan & PAD Adat (Akun 4.1.1.x)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Pendapatan</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-slate-900 text-[15px]">{formatCurrency(financialReport.totalAsetDanaPunia)}</td>
              </tr>
              <tr className="bg-amber-50/70">
                <td className="p-2 border-r border-slate-400 text-center text-amber-700 font-bold">6</td>
                <td className="p-2 border-r border-slate-400 font-medium text-amber-700">Total Beban & Operasional (Akun 5.x)</td>
                <td className="p-2 border-r border-slate-400 text-amber-700">Pengeluaran</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-amber-700">{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-2 border-r border-slate-400 text-center font-bold">7</td>
                <td className="p-2 border-r border-slate-400 font-medium">Total Kewajiban / Hutang Belanja (Akun 2.x)</td>
                <td className="p-2 border-r border-slate-400 text-slate-600">Kewajiban</td>
                <td className="p-2 px-2 text-right font-mono font-bold text-slate-900">{isBebasHutang ? 'Rp 0' : formatCurrency(totalHutang)}</td>
              </tr>
              <tr className="bg-indigo-50/60 font-bold border-t-2 border-slate-400">
                <td colSpan={3} className="p-2.5 text-slate-900 uppercase">TOTAL SURPLUS BERSIH PERIODE BERJALAN</td>
                <td className="p-2.5 text-right font-mono font-black text-indigo-900 text-sm">{formatCurrency(surplusBersih)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section II: Comparison Analysis Table */}
        <div className="mb-8 page-break-avoid">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1 mb-3">
            <div className="w-2.5 h-2.5 bg-slate-900 rounded-full"></div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 font-serif">
              II. ANALISIS KOMPARASI KAS KELUAR VS REALISASI BELANJA (CoA)
            </h4>
          </div>

          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            Tabel rekonsiliasi berikut membandingkan total arus kas keluar riil dari Buku Kas/Jurnal Umum terhadap rincian realisasi pos belanja kas desa adat dan penyerapan Dana Punia Barang (non-kas).
          </p>

          <table className="w-full text-left text-xs border border-slate-400 rounded-lg overflow-hidden">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="p-2.5 w-12 text-center">No</th>
                <th className="p-2.5">Indikator Komparasi Pengeluaran</th>
                <th className="p-2.5 w-44">Basis Pencatatan</th>
                <th className="p-2.5 text-right w-44">Jumlah Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-rose-50/70 font-semibold">
                <td className="p-2.5 border-r border-slate-300 text-center font-bold text-rose-900">A</td>
                <td className="p-2.5 border-r border-slate-300 text-rose-900">TOTAL KAS KELUAR JURNAL UMUM / BKU</td>
                <td className="p-2.5 border-r border-slate-300 text-rose-800 text-[11px]">Kredit Kas 1.1.x Riil</td>
                <td className="p-2.5 text-right font-mono font-black text-rose-700 text-sm">{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</td>
              </tr>
              <tr className="bg-blue-50/70 font-semibold">
                <td className="p-2.5 border-r border-slate-300 text-center font-bold text-blue-900">B</td>
                <td className="p-2.5 border-r border-slate-300 text-blue-900">TOTAL BELANJA KAS DESA ADAT</td>
                <td className="p-2.5 border-r border-slate-300 text-blue-800 text-[11px]">Rincian Akun Belanja (CoA 5)</td>
                <td className="p-2.5 text-right font-mono font-black text-blue-700 text-sm">{formatCurrency(expenditureAnalysis.totalBelanja5Pos)}</td>
              </tr>
              <tr className="bg-amber-50/70">
                <td className="p-2 border-r border-slate-300 text-center font-bold text-amber-900">C</td>
                <td className="p-2 border-r border-slate-300 font-medium text-amber-900">Selisih Alokasi (Kas Keluar Jurnal - Belanja Program)</td>
                <td className="p-2 border-r border-slate-300 text-amber-800 text-[11px]">Selisih Operasional/Rekanan</td>
                <td className="p-2 text-right font-mono font-bold text-amber-800">{formatCurrency(expenditureAnalysis.selisihKasVsPos)}</td>
              </tr>
              {expenditureAnalysis.totalPuniaBarang > 0 && (
                <>
                  <tr className="bg-emerald-50/70">
                    <td className="p-2 border-r border-slate-300 text-center font-bold text-emerald-900">D</td>
                    <td className="p-2 border-r border-slate-300 font-medium text-emerald-900">Penyerapan Dana Punia Barang (Non-Kas Habis Terpakai)</td>
                    <td className="p-2 border-r border-slate-300 text-emerald-800 text-[11px]">Barang Yadnya Terpakai</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-800">{formatCurrency(expenditureAnalysis.totalPuniaBarang)}</td>
                  </tr>
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-400">
                    <td className="p-2.5 border-r border-slate-300 text-center font-bold text-slate-900">E</td>
                    <td className="p-2.5 border-r border-slate-300 text-slate-900 uppercase">TOTAL REALISASI PENYERAPAN YADNYA (B + D)</td>
                    <td className="p-2.5 border-r border-slate-300 text-slate-700 text-[11px]">Gabungan Kas + Non-Kas</td>
                    <td className="p-2.5 text-right font-mono font-black text-slate-900 text-sm">{formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}</td>
                  </tr>
                  <tr className="bg-teal-50 font-bold">
                    <td className="p-2 border-r border-slate-300 text-center text-teal-900">F</td>
                    <td className="p-2 border-r border-slate-300 text-teal-900">Selisih Netto Yadnya vs Kas Jurnal (E - A)</td>
                    <td className="p-2 border-r border-slate-300 text-teal-800 text-[11px]">Surplus Nilai Barang</td>
                    <td className="p-2 text-right font-mono font-bold text-teal-700">+{formatCurrency(expenditureAnalysis.selisihNetto)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <div className="mt-3 p-3 bg-slate-50 border border-slate-400 rounded-lg text-xs text-slate-700 leading-relaxed">
            <strong className="text-slate-900 font-bold">Catatan Penjelasan Rekonsiliasi:</strong> Arus kas keluar riil dari pembukuan kas/jurnal tercatat sebesar <em>{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</em>.{expenditureAnalysis.totalPuniaBarang > 0 ? ` Sedangkan penyerapan Dana Punia Barang sebesar ${formatCurrency(expenditureAnalysis.totalPuniaBarang)} merupakan sarana non-kas yang langsung terpakai, sehingga total nilai manfaat yang terealisasi mencapai ${formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}.` : ' Seluruh realisasi belanja program dan operasional dibiayai langsung dari dana kas desa adat.'}
          </div>
        </div>

        {/* Section III: Realisasi Belanja Kas Breakdown (CoA) */}
        <div className="mb-8 page-break-avoid">
          <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1 mb-3">
            <div className="w-2.5 h-2.5 bg-slate-900 rounded-full"></div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 font-serif">
              III. RINCIAN REALISASI BELANJA KAS DESA ADAT SESUAI BAGAN AKUN (CoA)
            </h4>
          </div>

          <table className="w-full text-left text-xs border border-slate-400 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <tr>
                <th className="p-2 border-r border-slate-300 w-12 text-center">No</th>
                <th className="p-2 border-r border-slate-300 w-28">Kode Akun</th>
                <th className="p-2 border-r border-slate-300">Uraian Pos Belanja & Program Desa Adat</th>
                <th className="p-2 text-right w-44">Realisasi (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 border-r border-slate-200 text-center font-bold">1</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-700">5.1</td>
                <td className="p-2 border-r border-slate-200">
                  <span className="font-bold text-slate-900 block">Beban Operasional Adat</span>
                  <span className="text-[11px] text-slate-500">Operasional kegiatan adat</span>
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(expenditureAnalysis.totalTransportBebanAdat)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-2 border-r border-slate-200 text-center font-bold">2</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-700">5.2</td>
                <td className="p-2 border-r border-slate-200">
                  <span className="font-bold text-slate-900 block">Parhyangan (Aci & Pura)</span>
                  <span className="text-[11px] text-slate-500">Aci piodalan, upakara yadnya, sarana bebantenan, sesari, dan pemeliharaan pura</span>
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(expenditureAnalysis.totalParhyangan)}</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-slate-200 text-center font-bold">3</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-700">5.3</td>
                <td className="p-2 border-r border-slate-200">
                  <span className="font-bold text-slate-900 block">Pawongan (Krama)</span>
                  <span className="text-[11px] text-slate-500">Dana Kematian, Bulan Bahasa</span>
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(expenditureAnalysis.totalPawongan)}</td>
              </tr>
              <tr className="bg-slate-50/50">
                <td className="p-2 border-r border-slate-200 text-center font-bold">4</td>
                <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-700">5.4</td>
                <td className="p-2 border-r border-slate-200">
                  <span className="font-bold text-slate-900 block">Palemahan (Lingkungan & Bangunan)</span>
                  <span className="text-[11px] text-slate-500">Pembangunan Renovasi, pengelolaan sampah pura, penataan setra</span>
                </td>
                <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(expenditureAnalysis.totalPalemahan)}</td>
              </tr>
              <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                <td colSpan={3} className="p-2.5 text-slate-900 uppercase">SUBTOTAL REALISASI BELANJA KAS PROGRAM</td>
                <td className="p-2.5 text-right font-mono font-black text-blue-900 text-sm">{formatCurrency(expenditureAnalysis.totalBelanja5Pos)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section IV: Naskah Narasi Resmi */}
        <div className="mb-8 page-break-avoid">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-slate-900 rounded-full"></div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 font-serif">
                IV. NASKAH NARASI RESMI PERTANGGUNGJAWABAN SIDANG DESA ADAT
              </h4>
            </div>
            <button
              onClick={handleCopyNarrative}
              className="no-print flex items-center gap-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded font-bold transition-all"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-400 rounded-xl p-4 text-xs text-slate-800 leading-relaxed font-serif space-y-3">
            <p className="font-bold text-slate-900">Om Swastyastu,</p>
            <p>
              Puji syukur kita haturkan ke hadapan Ida Sang Hyang Widhi Wasa atas terselenggaranya seluruh rangkaian kegiatan Desa Adat Basangalas dalam keadaan labda karya dan paripurna.
            </p>
            <p>
              Berdasarkan penutupan pembukuan dan neraca per tanggal <strong>{formattedReportDate}</strong>, posisi likuiditas Aset Kas & Setara Kas tercatat sebesar <strong>{formatCurrency(financialReport.totalAsetKas)}</strong>, dengan saldo Kas di Juru Raksa (Tunai) siap pakai sebesar <strong>{formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}</strong>.
            </p>
            <p>
              Realisasi pengeluaran kas tercatat sebesar <strong>{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</strong>, yang terserap secara akuntabel ke dalam pos belanja program desa adat {expenditureAnalysis.totalPuniaBarang > 0 && `sebesar <strong>${formatCurrency(expenditureAnalysis.totalBelanja5Pos)}</strong>`} {expenditureAnalysis.totalPuniaBarang > 0 && `dan didukung penyerapan Dana Punia Barang sebesar <strong>${formatCurrency(expenditureAnalysis.totalPuniaBarang)}</strong>`}. Dengan demikian, total realisasi Operasional & Beban Desa Adat bernilai <strong>{formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}</strong>.
            </p>
            <p>
              Desa Adat Basangalas berada pada posisi <strong className="text-emerald-800">{isBebasHutang ? 'BEBAS HUTANG (0 Kewajiban Pihak Ketiga)' : `Kewajiban Rp ${formatCurrency(totalHutang)}`}</strong> dan membukukan {isSurplus ? 'Surplus' : 'Defisit'} Bersih Periode Berjalan sebesar <strong>{formatCurrency(surplusBersih)}</strong>.
            </p>
            <p className="font-bold text-slate-900">Om Santih, Santih, Santih, Om.</p>
          </div>
        </div>

        {/* Section V: Penjelasan Ringkas Bahasa Awam untuk Krama Desa */}
        <div className="mb-8 page-break-avoid">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></div>
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 font-serif">
                V. PENJELASAN RINGKAS UNTUK KRAMA DESA (TRANSPARANSI PARUMAN)
              </h4>
            </div>
            <button
              onClick={handleCopyAwamNarrative}
              className="no-print flex items-center gap-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded font-bold transition-all"
            >
              {copiedAwam ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
              <span>{copiedAwam ? 'Tersalin' : 'Salin Narasi'}</span>
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-400 rounded-xl p-4 text-xs text-slate-800 leading-relaxed space-y-4">
            <p className="italic text-slate-600 border-b border-slate-200 pb-2">
              Penjelasan berikut disusun dengan bahasa yang terang, jujur, dan mudah dipahami oleh seluruh krama desa tanpa istilah akuntansi yang rumit, sebagai wujud keterbukaan (transparansi) kepengurusan prajuru:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Box 1: Asal Uang */}
              <div className="p-3 bg-white border border-slate-300 rounded-lg">
                <div className="flex items-center gap-2 mb-1 text-slate-900 font-bold">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-800 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>Dari Mana Asal Uang Kita?</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Dana Desa Berasal dari kas desa adat yang terkumpul dari {(financialReport.totalAsetsumberDana > 0 || expenditureAnalysis.totalAsetSumberDana > 0) ? 'iuran krama, ' : ''}punia yadnya, Pendapatan, dan silpa. Total penerimaan kas periode ini tercatat sebesar <strong>{formatCurrency(financialReport.totalAsetDanaPunia)}</strong> yang bersumber dari pos Pendapatan & PAD Adat (Akun 4.1.1.x).
                </p>
              </div>

              {/* Box 2: Uang Belanja */}
              <div className="p-3 bg-white border border-slate-300 rounded-lg">
                <div className="flex items-center gap-2 mb-1 text-slate-900 font-bold">
                  <span className="w-5 h-5 bg-rose-100 text-rose-800 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>Dipakai Untuk Apa Saja Uang Tersebut?</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Total uang kas yang keluar adalah <strong>{formatCurrency(expenditureAnalysis.totalKasKeluarJurnal)}</strong> untuk membiayai pos belanja resmi desa: Operasional & Beban Desa Adat ({formatCurrency(expenditureAnalysis.totalTransportBebanAdat)}), Parhyangan ({formatCurrency(expenditureAnalysis.totalParhyangan)}), Pawongan ({formatCurrency(expenditureAnalysis.totalPawongan)}), serta Palemahan ({formatCurrency(expenditureAnalysis.totalPalemahan)}).
                </p>
              </div>

              {/* Box 3: Bebas Hutang */}
              <div className="p-3 bg-white border border-slate-300 rounded-lg">
                <div className="flex items-center gap-2 mb-1 text-slate-900 font-bold">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>Apakah Desa Punya Utang / Bon?</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  {isBebasHutang ? (
                    <span className="text-emerald-800 font-medium">
                      <strong>Lunas 100% dan Bebas Hutang.</strong> Tidak ada sisa bon di warung, tagihan rekanan, ataupun pinjaman pihak luar yang membebani desa adat.
                    </span>
                  ) : (
                    <span>
                      Masih tercatat kewajiban belanja yang sedang diselesaikan sebesar <strong>{formatCurrency(totalHutang)}</strong>.
                    </span>
                  )}
                </p>
              </div>

              {/* Box 4: Sisa Kas */}
              <div className="p-3 bg-white border border-slate-300 rounded-lg">
                <div className="flex items-center gap-2 mb-1 text-slate-900 font-bold">
                  <span className="w-5 h-5 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
                  <span>Berapa Sisa Uang & Di Mana Disimpan?</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Tersisa dana kas lebih (surplus) sebesar <strong>{formatCurrency(surplusBersih)}</strong>. Dari saldo ini, sebesar <strong>{formatCurrency(financialReport.kasJuruRaksaTunai.saldo)}</strong> dipegang tunai oleh Juru Raksa untuk kebutuhan mendadak, dan sebesar <strong>{formatCurrency(financialReport.totalKasLPD)}</strong> tersimpan aman di rekening LPD sebagai tabungan cadangan krama.
                </p>
              </div>
            </div>

            {expenditureAnalysis.totalPuniaBarang > 0 && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-[11px] text-emerald-950 flex items-start gap-2">
              <HeartHandshake size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong>Apresiasi Gotong Royong Punia Barang Non-Kas:</strong> Selain uang tunai, krama desa juga berdana punia dalam bentuk barang langsung (beras, babi, kelapa, buah, upakara) senilai <strong>{formatCurrency(expenditureAnalysis.totalPuniaBarang)}</strong> yang telah langsung habis terpakai. Sehingga total nilai yadnya yang terlaksana mencapai <strong>{formatCurrency(expenditureAnalysis.totalRealisasiYadnya)}</strong>.
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Section VI: Lembar Pengesahan & Tanda Tangan Resmi */}
        <div className="pt-6 border-t-2 border-slate-400 page-break-avoid">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 bg-slate-900 rounded-full"></div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 font-serif">
              VI. LEMBAR PENGESAHAN & PENETAPAN RESMI
            </h4>
          </div>

          <div className="flex justify-end mb-6 text-xs text-slate-700">
            <div className="text-right">
              <p>Ditetapkan di: <span className="font-bold text-slate-900">{customPlace}</span></p>
              <p>Pada Tanggal: <span className="font-bold text-slate-900">{formattedSigDate}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs">
            {/* Keliang */}
            <div className="flex flex-col items-center justify-between min-h-[140px] relative">
              <div>
                <p className="text-slate-600">Mengetahui / Mengesahkan,</p>
                <p className="font-bold text-slate-900 uppercase">Keliang Desa Adat</p>
              </div>

              <div className="relative flex flex-col items-center justify-center my-2 h-16 w-full">
                {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, bukan di Juru Raksa, mengambil tempat setengah nama Keliang Adat ke kiri, ukuran standar mengenai tanda tangan dan label pejabat */}
                {sigSettings.showStampOverlay && effectiveStamp && (
                  <div 
                    className="absolute pointer-events-none select-none z-0"
                    style={{
                      left: '30%',
                      top: '50%',
                      transform: 'translate(-50%, -46%)',
                      opacity: 0.92,
                      filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                    }}
                  >
                    <img 
                      src={effectiveStamp} 
                      alt="Stempel Resmi Desa Adat" 
                      className="w-24 h-24 sm:w-28 sm:h-28 print:w-24 print:h-24 object-contain max-w-none mix-blend-multiply" 
                      style={{
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact'
                      }}
                    />
                  </div>
                )}
                {signatures.keliang && sigSettings.autoEmbed ? (
                  <img
                    src={signatures.keliang}
                    alt="TTD Keliang"
                    className="max-h-16 max-w-[140px] object-contain relative z-10"
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}
                  />
                ) : (
                  <div className="text-[10px] text-slate-400 italic print:hidden">( Tanda Tangan )</div>
                )}
              </div>

              <div className="border-b border-slate-900 w-48 pb-1 relative z-10">
                <p className="font-black text-slate-900 uppercase font-serif text-sm">
                  {keliangName}
                </p>
              </div>
            </div>

            {/* Juru Raksa */}
            <div className="flex flex-col items-center justify-between min-h-[140px]">
              <div>
                <p className="text-slate-600">Juru Raksa / Bendahara,</p>
                <p className="font-bold text-slate-900 uppercase">Juru Raksa Desa</p>
              </div>

              <div className="relative flex flex-col items-center justify-center my-2 h-16 w-full">
                {signatures.juruRaksa && sigSettings.autoEmbed ? (
                  <img
                    src={signatures.juruRaksa}
                    alt="TTD Juru Raksa"
                    className="max-h-16 max-w-[140px] object-contain relative z-10"
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}
                  />
                ) : (
                  <div className="text-[10px] text-slate-400 italic print:hidden">( Tanda Tangan )</div>
                )}
              </div>

              <div className="border-b border-slate-900 w-48 pb-1 relative z-10">
                <p className="font-black text-slate-900 uppercase font-serif text-sm">
                  {juruRaksaName}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <span>Sistem Informasi Akuntansi & Data Keuangan Kas Desa Adat</span>
            <span>Dicetak secara elektronik pada {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Kop Surat & Tanda Tangan" className="max-w-lg">
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">Atur informasi lembaga adat, nama Pos, pejabat penandatangan, dan tanggal pengesahan dokumen.</p>
          
          <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-700">
            <h5 className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">Informasi Lembaga & Upakara</h5>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Nama Lembaga Adat</label>
              <input 
                type="text" 
                value={tempInstitutionName} 
                onChange={(e) => setTempInstitutionName(e.target.value)}
                className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Nama Pos Keuangan</label>
              <input 
                type="text" 
                value={tempUpakaraName} 
                onChange={(e) => setTempUpakaraName(e.target.value)}
                placeholder="Contoh: Kas Desa Adat"
                className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold uppercase mb-1">Alamat Lembaga</label>
              <input 
                type="text" 
                value={tempAddress} 
                onChange={(e) => setTempAddress(e.target.value)}
                className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Nomor Kontak / Telepon</label>
                <input 
                  type="text" 
                  value={tempContact} 
                  onChange={(e) => setTempContact(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Email Resmi</label>
                <input 
                  type="text" 
                  value={tempEmail} 
                  onChange={(e) => setTempEmail(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 bg-emerald-50/80 p-3 rounded-xl border border-emerald-300">
            <h5 className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>Saldo Kas Program Khusus Desa Adat</span>
              <span className="text-[10px] text-emerald-700 font-normal lowercase">(otomatis / manual override)</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-emerald-950 font-bold uppercase mb-1 text-[10px]">
                  Kas SHU LPD (Akun 1.1.2.06)
                </label>
                <input 
                  type="number" 
                  value={tempSaldoShuLpd} 
                  onChange={(e) => setTempSaldoShuLpd(e.target.value)}
                  placeholder="Contoh: 15000000"
                  className="w-full bg-white border border-emerald-400 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs outline-none focus:border-emerald-600" 
                />
              </div>
              <div>
                <label className="block text-emerald-950 font-bold uppercase mb-1 text-[10px]">
                  Kas Tempekan (Akun 1.1.2.07)
                </label>
                <input 
                  type="number" 
                  value={tempSaldoTempekan} 
                  onChange={(e) => setTempSaldoTempekan(e.target.value)}
                  placeholder="Contoh: 5000000"
                  className="w-full bg-white border border-emerald-400 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs outline-none focus:border-emerald-600" 
                />
              </div>
            </div>
            <p className="text-[10px] text-emerald-800 italic">
              *Jika telah tercatat transaksi jurnal akun 1.1.2.06 atau 1.1.2.07, sistem memprioritaskan saldo riil jurnal secara otomatis.
            </p>
          </div>

          <div className="space-y-3 bg-amber-500/60 p-3 rounded-xl border border-slate-700">
            <h5 className="font-bold text-indigo-800 uppercase tracking-wider text-[11px]">Pejabat & Tempat Pengesahan</h5>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Tempat / Kota</label>
                <input 
                  type="text" 
                  value={tempCustomPlace} 
                  onChange={(e) => setTempCustomPlace(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold uppercase mb-1">Tanggal Tanda Tangan</label>
                <input 
                  type="date" 
                  value={tempSignatureDate} 
                  onChange={(e) => setTempSignatureDate(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1">Nama Keliang Desa (Pihak 1)</label>
              <input 
                type="text" 
                value={tempKeliangName} 
                onChange={(e) => setTempKeliangName(e.target.value)}
                className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold uppercase mb-1">Nama Juru Raksa (Pihak 2)</label>
              <input 
                type="text" 
                value={tempJuruRaksaName} 
                onChange={(e) => setTempJuruRaksaName(e.target.value)}
                className="w-full bg-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-indigo-500" 
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-1/3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl uppercase tracking-wider text-xs transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleSaveSettings}
              className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl uppercase tracking-wider text-xs shadow-lg transition-all"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </Modal>

      {/* Formulir Naratif Kalkulasi Modal */}
      <FormulirNaratifKalkulasi
        financialReport={financialReport}
        reportDate={reportDate}
        customPlace={customPlace}
        signatureDate={signatureDate}
        keliangName={keliangName}
        juruRaksaName={juruRaksaName}
        isBalanced={financialReport.isBalanced}
        isOpen={isNaratifModalOpen}
        onClose={() => setIsNaratifModalOpen(false)}
        hideTriggerCard={true}
      />
    </div>
  );
};

export default DokumenNeraca;
