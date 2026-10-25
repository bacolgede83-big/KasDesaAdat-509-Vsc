import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Scale, 
  Calendar,
  BookOpen, 
  Copy, 
  Check, 
  Settings, 
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Building2,
  TrendingUp,
  Receipt,
  Layers,
  ArrowRight,
  TrendingDown,
  Info,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatter';
import { getStoredSignatures, getSignatureSettings, getEffectiveStamp } from '../utils/signatureStorage';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import { REFERENSI_REKENING } from '../constants';
import type { BkuData, JuDisplayRow, DanaPuniaItem, UrunanItem, BudgetItem } from '../types';
import { exportElementToPdf } from '../utils/pdfExport';
import { FormulirNeracaModal } from '../components/formulirNeraca/FormulirNeracaModal';
import { getGeminiClient, GEMINI_MODEL_TEXT } from '../utils/geminiClient';

interface FormulirNeracaProps {
  entries?: JuDisplayRow[];
  bkuData?: BkuData[];
  bkpData?: any[];
  budgetItems?: BudgetItem[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
}

export interface PosBelanjaItem {
  code: string;
  name: string;
  amount: number;
}

export interface PosBelanjaGroup {
  title: string;
  total: number;
  items: PosBelanjaItem[];
}

export interface AiNeracaInsights {
  healthScore: number;
  healthStatus: 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis';
  headline: string;
  ringkasanPerjalanan: string;
  analisisPengeluaran: string;
  analisisLikuiditas: string;
  rekomendasi: string[];
  fullNarrative: string;
}

const AI_STORAGE_KEY_PREFIX = 'formulir_neraca_ai_insights_';

export const FormulirNeraca: React.FC<FormulirNeracaProps> = ({
  entries = [],
  bkuData = [],
  bkpData = [],
  budgetItems = [],
  danaPuniaItems = [],
  urunanItems = []
}) => {
  const { showNotification } = useNotification();
  
  // Tanggal Laporan Neraca (Default ke hari ini)
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  // Tab Aktif
  const [activeTab, setActiveTab] = useState<'neraca' | 'ai-narasi' | 'belanja' | 'cetak'>('neraca');
  
  // State Dokumen & Kop Surat
  const [institutionName, setInstitutionName] = useState(() => localStorage.getItem('neraca_institutionName') || 'DESA ADAT BASANGALAS');
  const [upakaraName, setUpakaraName] = useState(() => localStorage.getItem('neraca_upakaraName') || 'Laporan Pertanggungjawaban Keuangan');
  const [keliangName, setKeliangName] = useState(() => localStorage.getItem('neraca_keliangName') || 'I Made Mudita');
  const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('neraca_juruRaksaName') || 'I Putu Gede Sutrana');
  const [penyarikanName, setPenyarikanName] = useState(() => localStorage.getItem('neraca_penyarikanName') || 'I Wayan Sudarma');
  const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('neraca_customPlace') || 'Basangalas');
  const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('neraca_signatureDate') || new Date().toISOString().split('T')[0]);
  const [address, setAddress] = useState(() => localStorage.getItem('neraca_address') || 'Jln. Raya Basangalas, Desa Tribuana, Kecamatan Abang, Kabupaten Karangasem, Bali');
  const [contact, setContact] = useState(() => localStorage.getItem('neraca_contact') || '0852-3702-5068');
  const [email, setEmail] = useState(() => localStorage.getItem('neraca_email') || 'Basangalasjururaksa@gmail.com');

  // Modal Pengaturan
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempInstitutionName, setTempInstitutionName] = useState(institutionName);
  const [tempUpakaraName, setTempUpakaraName] = useState(upakaraName);
  const [tempKeliangName, setTempKeliangName] = useState(keliangName);
  const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
  const [tempPenyarikanName, setTempPenyarikanName] = useState(penyarikanName);
  const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
  const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
  const [tempAddress, setTempAddress] = useState(address);
  const [tempContact, setTempContact] = useState(contact);
  const [tempEmail, setTempEmail] = useState(email);

  // Digital Signatures
  const [signatures, setSignatures] = useState(getStoredSignatures());
  const [sigSettings, setSigSettings] = useState(getSignatureSettings());
  
  // Modal Preview Cepat
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  
  // State AI
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiNeracaInsights | null>(null);
  const [aiTimestamp, setAiTimestamp] = useState<string | null>(null);
  const [copiedNarrative, setCopiedNarrative] = useState(false);

  // Ref cetak
  const printableAreaRef = useRef<HTMLDivElement>(null);

  // Storage key cache AI berdasarkan tanggal laporan
  const aiCacheKey = useMemo(() => `${AI_STORAGE_KEY_PREFIX}${reportDate}`, [reportDate]);

  // Load cached AI insights
  useEffect(() => {
    try {
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.insights && parsed?.timestamp) {
          setAiInsights(parsed.insights);
          setAiTimestamp(parsed.timestamp);
          return;
        }
      }
      setAiInsights(null);
      setAiTimestamp(null);
    } catch {
      setAiInsights(null);
      setAiTimestamp(null);
    }
  }, [aiCacheKey]);

  // Listener tanda tangan
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

  // Simpan Pengaturan
  const handleOpenSettings = () => {
    setTempInstitutionName(institutionName);
    setTempUpakaraName(upakaraName);
    setTempKeliangName(keliangName);
    setTempJuruRaksaName(juruRaksaName);
    setTempPenyarikanName(penyarikanName);
    setTempCustomPlace(customPlace);
    setTempSignatureDate(signatureDate);
    setTempAddress(address);
    setTempContact(contact);
    setTempEmail(email);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    setInstitutionName(tempInstitutionName);
    setUpakaraName(tempUpakaraName);
    setKeliangName(tempKeliangName);
    setJuruRaksaName(tempJuruRaksaName);
    setPenyarikanName(tempPenyarikanName);
    setCustomPlace(tempCustomPlace);
    setSignatureDate(tempSignatureDate);
    setAddress(tempAddress);
    setContact(tempContact);
    setEmail(tempEmail);

    localStorage.setItem('neraca_institutionName', tempInstitutionName);
    localStorage.setItem('neraca_upakaraName', tempUpakaraName);
    localStorage.setItem('neraca_keliangName', tempKeliangName);
    localStorage.setItem('neraca_juruRaksaName', tempJuruRaksaName);
    localStorage.setItem('neraca_penyarikanName', tempPenyarikanName);
    localStorage.setItem('neraca_customPlace', tempCustomPlace);
    localStorage.setItem('neraca_signatureDate', tempSignatureDate);
    localStorage.setItem('neraca_address', tempAddress);
    localStorage.setItem('neraca_contact', tempContact);
    localStorage.setItem('neraca_email', tempEmail);

    setIsSettingsOpen(false);
    showNotification('Pengaturan Kop Surat & Penandatangan berhasil disimpan!', 'success');
  };

  // ==========================================
  // KALKULASI RESMI NERACA BERDASARKAN CONSTANT
  // ==========================================
  const financialReport = useMemo(() => {
    const balances: Record<string, number> = {};
    const filteredEntries = entries.filter(e => e.date && e.date <= reportDate);

    // Hitung saldo debit-kredit untuk setiap akun
    filteredEntries.forEach(e => {
      const code = (e.kodeRekening || '').trim();
      if (!code) return;
      if (!balances[code]) balances[code] = 0;
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;

      if (code.startsWith('1')) {
        // ASET (Normal Debit)
        balances[code] += (debetVal - kreditVal);
      } else if (code.startsWith('2') || code.startsWith('3')) {
        // KEWAJIBAN & EKUITAS (Normal Kredit)
        balances[code] += (kreditVal - debetVal);
      }
    });

    // Hitung Pendapatan (4), Belanja (5), SiLPA (6), Sumber Dana (7) untuk menentukan Surplus / Defisit
    let totalPendapatan4 = 0;
    let totalBelanja5 = 0;
    let totalSumberDana7 = 0;
    let totalSilpa6 = 0;

    filteredEntries.forEach(e => {
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;
      const code = (e.kodeRekening || '').trim();

      if (code.startsWith('4')) totalPendapatan4 += (kreditVal - debetVal);
      if (code.startsWith('5')) totalBelanja5 += (debetVal - kreditVal);
      if (code.startsWith('7')) totalSumberDana7 += (kreditVal - debetVal);
      if (code.startsWith('6')) totalSilpa6 += (kreditVal - debetVal);
    });

    const surplusDefisitBerjalan = (totalPendapatan4 + totalSumberDana7 + totalSilpa6) - totalBelanja5;

    const getAccountName = (code: string) => {
      const found = REFERENSI_REKENING.find(r => r.code === code.trim());
      return found ? found.name : `Akun ${code}`;
    };

    // 1. ASET (AKTIVA)
    // 1.1 Kas & Setara Kas (1.1.1.*)
    const asetKas = Object.keys(balances)
      .filter(code => code.startsWith('1.1.1'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.1);
    
    // 1.1.2 Kas Program & Hibah
    const asetKasProgram = Object.keys(balances)
      .filter(code => code.startsWith('1.1.2'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.1);

    const totalAsetKas = asetKas.reduce((s, i) => s + i.saldo, 0);
    const totalAsetKasProgram = asetKasProgram.reduce((s, i) => s + i.saldo, 0);

    // 1.2 Piutang (1.2.*)
    const asetPiutang = Object.keys(balances)
      .filter(code => code.startsWith('1.2'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.1);
    const totalAsetPiutang = asetPiutang.reduce((s, i) => s + i.saldo, 0);

    // Total Seluruh Aktiva
    const totalAset = totalAsetKas + totalAsetKasProgram + totalAsetPiutang;

    // 2. KEWAJIBAN / LIABILITAS (2.1.1.*)
    const kewajiban = Object.keys(balances)
      .filter(code => code.startsWith('2'))
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.1);
    const totalKewajiban = kewajiban.reduce((s, i) => s + i.saldo, 0);

    // 3. EKUITAS (3.1.1.*)
    const ekuitas = Object.keys(balances)
      .filter(code => code.startsWith('3') && code !== '3.1.1.07')
      .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
      .filter(i => Math.abs(i.saldo) > 0.1);

    const manualSurplusBalance = balances['3.1.1.07'] || 0;
    const totalEkuitasModal = ekuitas.reduce((s, i) => s + i.saldo, 0) + manualSurplusBalance;
    const totalEkuitas = totalEkuitasModal + surplusDefisitBerjalan;

    // TOTAL PASIVA
    const totalPasiva = totalKewajiban + totalEkuitas;

    // STATUS KESEIMBANGAN
    const selisih = Math.abs(totalAset - totalPasiva);
    const isBalanced = selisih < 1;

    // Rincian Akun Belanja (5) per Kategori Constant
    const posBelanjaBreakdown: Record<string, PosBelanjaGroup> = {
      insentifProvinsi: { title: 'Beban Insentif Prajuru Provinsi (5.1.1)', total: 0, items: [] },
      insentifKabupaten: { title: 'Beban Insentif Prajuru Kabupaten (5.1.4)', total: 0, items: [] },
      operasional: { title: 'Belanja Operasional & Kantor (5.1.2)', total: 0, items: [] },
      transport: { title: 'Perjalanan Dinas & Saku (5.1.3)', total: 0, items: [] },
      bebanAdatLain: { title: 'Beban Adat Lainnya (5.1.5)', total: 0, items: [] },
      parhyangan: { title: 'Program Parhyangan (5.2)', total: 0, items: [] },
      pawongan: { title: 'Program Pawongan (5.3)', total: 0, items: [] },
      palemahan: { title: 'Program Palemahan (5.4)', total: 0, items: [] },
    };

    const expenseMap: Record<string, number> = {};
    filteredEntries.forEach(e => {
      const code = (e.kodeRekening || '').trim();
      if (!code.startsWith('5')) return;
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;
      const net = debetVal - kreditVal;
      expenseMap[code] = (expenseMap[code] || 0) + net;
    });

    Object.keys(expenseMap).forEach(code => {
      const amount = expenseMap[code];
      if (amount <= 0) return;
      const name = getAccountName(code);
      const item = { code, name, amount };

      if (code.startsWith('5.1.1')) {
        posBelanjaBreakdown.insentifProvinsi.items.push(item);
        posBelanjaBreakdown.insentifProvinsi.total += amount;
      } else if (code.startsWith('5.1.4')) {
        posBelanjaBreakdown.insentifKabupaten.items.push(item);
        posBelanjaBreakdown.insentifKabupaten.total += amount;
      } else if (code.startsWith('5.1.2')) {
        posBelanjaBreakdown.operasional.items.push(item);
        posBelanjaBreakdown.operasional.total += amount;
      } else if (code.startsWith('5.1.3')) {
        posBelanjaBreakdown.transport.items.push(item);
        posBelanjaBreakdown.transport.total += amount;
      } else if (code.startsWith('5.1.5')) {
        posBelanjaBreakdown.bebanAdatLain.items.push(item);
        posBelanjaBreakdown.bebanAdatLain.total += amount;
      } else if (code.startsWith('5.2')) {
        posBelanjaBreakdown.parhyangan.items.push(item);
        posBelanjaBreakdown.parhyangan.total += amount;
      } else if (code.startsWith('5.3')) {
        posBelanjaBreakdown.pawongan.items.push(item);
        posBelanjaBreakdown.pawongan.total += amount;
      } else if (code.startsWith('5.4')) {
        posBelanjaBreakdown.palemahan.items.push(item);
        posBelanjaBreakdown.palemahan.total += amount;
      }
    });

    return {
      filteredCount: filteredEntries.length,
      totalAsetKas,
      totalAsetKasProgram,
      totalAsetPiutang,
      totalAset,
      totalKewajiban,
      totalEkuitas,
      totalEkuitasModal,
      totalPasiva,
      surplusDefisitBerjalan,
      totalPendapatan4,
      totalBelanja5,
      totalSumberDana7,
      totalSilpa6,
      asetKas,
      asetKasProgram,
      asetPiutang,
      kewajiban,
      ekuitas,
      selisih,
      isBalanced,
      posBelanjaBreakdown
    };
  }, [entries, reportDate]);

  // ==========================================
  // GENERATOR ANALISIS PERJALANAN KEUANGAN & PENGELUARAN GEMINI AI
  // ==========================================
  const handleGenerateAiAnalysis = async () => {
    setIsGeneratingAi(true);
    showNotification('Menghubungkan ke Gemini AI untuk menganalisis neraca dan menyusun naskah perjalanan keuangan...', 'info');

    try {
      const ai = getGeminiClient();

      const assetListText = [...financialReport.asetKas, ...financialReport.asetKasProgram, ...financialReport.asetPiutang]
        .map(a => `- ${a.code} ${a.name}: ${formatCurrency(a.saldo)}`)
        .join('\n');

      const liabilitiesListText = financialReport.kewajiban.length > 0
        ? financialReport.kewajiban.map(k => `- ${k.code} ${k.name}: ${formatCurrency(k.saldo)}`).join('\n')
        : '- Nihil (Bebas Hutang / Tidak ada kewajiban tertunggak)';

      const expensesListText = (Object.values(financialReport.posBelanjaBreakdown) as PosBelanjaGroup[])
        .filter(b => b.total > 0)
        .map(b => `• ${b.title}: ${formatCurrency(b.total)}`)
        .join('\n');

      const prompt = `
Anda adalah seorang Auditor Keuangan Senior dan Penasihat Kebijakan Adat Bali yang bertugas menganalisis Neraca Keuangan resmi "${institutionName}".
Tugas Anda:
1. Menyusun 'Naskah Narasi Ringkasan Perjalanan Keuangan Desa Adat' yang berwibawa, formal, dan komprehensif untuk dibacakan langsung di hadapan Bendesa Adat, Prajuru, dan Paruman Krama Desa.
2. Melakukan 'Analisis Pengeluaran Berstandar AI' secara tajam mengenai efisiensi pos-pos belanja (Akun 5: Insentif, Operasional, Parhyangan, Pawongan, Palemahan) serta kesehatan posisi aktiva vs pasiva.

DATA NERACA PER TANGGAL ${formatDate(reportDate)}:
- Nama Institusi: ${institutionName}
- Total Aktiva (Aset Lancar & Kas): ${formatCurrency(financialReport.totalAset)}
  * Kas & Setara Kas (1.1.1): ${formatCurrency(financialReport.totalAsetKas)}
  * Kas Hibah & Program (1.1.2): ${formatCurrency(financialReport.totalAsetKasProgram)}
  * Piutang Desa Adat (1.2): ${formatCurrency(financialReport.totalAsetPiutang)}
- Total Pasiva: ${formatCurrency(financialReport.totalPasiva)}
  * Total Kewajiban / Hutang (2.1): ${formatCurrency(financialReport.totalKewajiban)}
  * Ekuitas / Modal Awal (3.1.1.06): ${formatCurrency(financialReport.totalEkuitasModal)}
  * Surplus / Defisit Periode Berjalan: ${formatCurrency(financialReport.surplusDefisitBerjalan)}
- Status Keseimbangan Neraca: ${financialReport.isBalanced ? 'SEIMBANG (Balance Rp 0)' : `Terdapat Selisih Rp ${financialReport.selisih}`}
- Total Pendapatan Operasional & Punia (Akun 4 + 7): ${formatCurrency(financialReport.totalPendapatan4 + financialReport.totalSumberDana7)}
- Total Realisasi Belanja (Akun 5): ${formatCurrency(financialReport.totalBelanja5)}

RINCIAN SALDO ASET (AKTIVA):
${assetListText || '- Belum ada saldo aset terisi'}

RINCIAN KEWAJIBAN (PASIVA):
${liabilitiesListText}

REKAPITULASI REALISASI PENGELUARAN (AKUN 5):
${expensesListText || '- Belum ada realisasi belanja tercatat'}

FORMAT JAWABAN YANG DIHARAPKAN (WAJIB TERSTRUKTUR):
1. Tentukan Skor Kesehatan Keuangan (0 - 100) dan Status ('Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis').
2. Tuliskan 1 kalimat Headline Ringkasan Eksekutif Neraca.
3. BAGIAN 1: NASKAH NARASI PERJALANAN KEUANGAN DESA ADAT
   (Uraikan secara runut perjalanan kas, asal muasal dana, perputaran kas untuk menopang upakara/yadnya dan operasional, posisi kas fisik di Juru Raksa serta di Bank/LPD, dan jaminan transparansi akuntabilitas).
4. BAGIAN 2: ANALISIS PENGELUARAN BERSTANDAR AI
   (Analisis proporsi belanja rutin operasional vs belanja program adat yadnya, efisiensi alokasi pos-pos pengeluaran, evaluasi beban kewajiban hutang, dan deteksi potensi pemborosan bila ada).
5. BAGIAN 3: ANALISIS LIKUIDITAS & DAYA TAHAN NERACA
   (Analisis kemampuan kas melunasi kewajiban jangka pendek serta estimasi ketahanan kas operasional).
6. BAGIAN 4: REKOMENDASI STRATEGIS UNTUK PARUMAN
   (Berikan 4 butir rekomendasi konkret, solutif, dan realistis untuk Bendesa Adat dan Juru Raksa).

Gunakan bahasa Indonesia yang santun, elegan, baku, dan mencerminkan kearifan lokal tata kelola Desa Adat di Bali.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: "Anda adalah auditor keuangan senior dan konsultan tata kelola keuangan desa adat Bali yang ahli dalam akuntansi, transparansi, dan efisiensi anggaran adat."
        }
      });

      const responseText = response.text || '';
      if (!responseText) throw new Error('Respon teks kosong dari Gemini AI');

      // Parsing Skor & Status secara otomatis
      let parsedScore = 85;
      const scoreMatch = responseText.match(/(?:Skor|Score|Kesehatan)[:\s]*([0-9]{2,3})/i);
      if (scoreMatch && !isNaN(Number(scoreMatch[1]))) {
        const val = Number(scoreMatch[1]);
        if (val >= 0 && val <= 100) parsedScore = val;
      } else {
        if (financialReport.isBalanced) parsedScore += 5;
        if (financialReport.totalKewajiban === 0) parsedScore += 5;
        if (financialReport.surplusDefisitBerjalan >= 0) parsedScore += 5;
      }

      let parsedStatus: 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis' = 'Sehat';
      if (parsedScore >= 88) parsedStatus = 'Sangat Sehat';
      else if (parsedScore >= 72) parsedStatus = 'Sehat';
      else if (parsedScore >= 55) parsedStatus = 'Waspada';
      else parsedStatus = 'Kritis';

      // Ekstrak bagian narasi
      const extractSection = (headerPattern: RegExp, nextHeaderPattern: RegExp, fallback: string) => {
        const match = responseText.match(new RegExp(`${headerPattern.source}([\\s\\S]*?)(?=${nextHeaderPattern.source}|$)`, 'i'));
        return match ? match[1].trim() : fallback;
      };

      const narasiPerjalanan = extractSection(
        /(?:BAGIAN 1|NASKAH NARASI|Ringkasan Perjalanan)[:\s]*/,
        /(?:BAGIAN 2|ANALISIS PENGELUARAN)/,
        `Perjalanan keuangan ${institutionName} per tanggal ${formatDate(reportDate)} mencatatkan total aktiva sebesar ${formatCurrency(financialReport.totalAset)} dengan posisi kas dan setara kas yang solid. Seluruh penerimaan dana punia, urunan, dan pendapatan desa teradministrasikan dengan tertib guna menopang keberlangsungan yadnya serta operasional desa adat.`
      );

      const analisisPengeluaran = extractSection(
        /(?:BAGIAN 2|ANALISIS PENGELUARAN)[:\s]*/,
        /(?:BAGIAN 3|ANALISIS LIKUIDITAS)/,
        `Realisasi belanja periode berjalan mencapai ${formatCurrency(financialReport.totalBelanja5)}. Alokasi belanja didominasi oleh kegiatan upakara parhyangan dan operasional kelembagaan. Rasio belanja terhadap cadangan kas menunjukkan efisiensi yang terkendali.`
      );

      const analisisLikuiditas = extractSection(
        /(?:BAGIAN 3|ANALISIS LIKUIDITAS)[:\s]*/,
        /(?:BAGIAN 4|REKOMENDASI)/,
        `Likuiditas desa berada pada kondisi ${parsedStatus}, didukung oleh ketiadaan tekanan hutang yang signifikan serta ketersediaan saldo kas yang mencukupi untuk kebutuhan operasional mendatang.`
      );

      // Rekomendasi
      const rekomendasiList: string[] = [];
      const recoSection = extractSection(/(?:BAGIAN 4|REKOMENDASI)[:\s]*/, /$/, '');
      const bulletMatches = recoSection.match(/(?:^|\n)(?:[-*•]|\d+\.)\s*([^\n]+)/g);
      if (bulletMatches && bulletMatches.length > 0) {
        bulletMatches.forEach(b => {
          const cleaned = b.replace(/^[\s\n]*[-*•\d.]+\s*/, '').trim();
          if (cleaned.length > 5) rekomendasiList.push(cleaned);
        });
      }

      if (rekomendasiList.length === 0) {
        rekomendasiList.push(
          'Pertahankan pencatatan kas berlapis antara kas fisik Juru Raksa dan kas rekening LPD/Bank.',
          'Lakukan rekonsiliasi berkala sebelum paruman bulanan krama desa.',
          'Alokasikan sebagian surplus berjalan ke dana abadi pemeliharaan pura dan wantilan.',
          'Tingkatkan transparansi publik dengan membacakan formulir neraca resmi di setiap pasangkepan.'
        );
      }

      const headlineText = financialReport.surplusDefisitBerjalan >= 0
        ? `Neraca keuangan ${institutionName} berada dalam kondisi ${parsedStatus} dengan surplus periode berjalan sebesar ${formatCurrency(financialReport.surplusDefisitBerjalan)} dan status neraca berimbang.`
        : `Neraca keuangan ${institutionName} mencatatkan defisit sementara sebesar ${formatCurrency(Math.abs(financialReport.surplusDefisitBerjalan))}, diperlukan penyesuaian belanja paruman.`;

      const generatedInsights: AiNeracaInsights = {
        healthScore: parsedScore,
        healthStatus: parsedStatus,
        headline: headlineText,
        ringkasanPerjalanan: narasiPerjalanan,
        analisisPengeluaran: analisisPengeluaran,
        analisisLikuiditas: analisisLikuiditas,
        rekomendasi: rekomendasiList.slice(0, 5),
        fullNarrative: responseText
      };

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' });
      setAiInsights(generatedInsights);
      setAiTimestamp(nowStr);

      // Simpan ke Cache
      localStorage.setItem(aiCacheKey, JSON.stringify({
        insights: generatedInsights,
        timestamp: nowStr
      }));

      showNotification('Analisis perjalanan keuangan & evaluasi pengeluaran AI berhasil dibuat!', 'success');
      setActiveTab('ai-narasi');
    } catch (err: any) {
      console.error('AI Neraca Analysis error:', err);
      // Buat Intelligent Fallback yang tetap valid dan berkualitas tinggi
      const fallbackInsights: AiNeracaInsights = {
        healthScore: financialReport.isBalanced ? 85 : 70,
        healthStatus: financialReport.isBalanced ? 'Sangat Sehat' : 'Waspada',
        headline: `Neraca keuangan ${institutionName} mencatatkan total aktiva ${formatCurrency(financialReport.totalAset)} dengan surplus operasional ${formatCurrency(financialReport.surplusDefisitBerjalan)}.`,
        ringkasanPerjalanan: `Posisi neraca per tanggal ${formatDate(reportDate)} menunjukkan total aktiva lancar sebesar ${formatCurrency(financialReport.totalAset)} yang bersumber dari Kas & Setara Kas (${formatCurrency(financialReport.totalAsetKas)}) serta Kas Program (${formatCurrency(financialReport.totalAsetKasProgram)}). Arus dana telah dipergunakan secara tertib untuk membiayai kebutuhan upakara yadnya, insentif prajuru, serta operasional kantor desa adat.`,
        analisisPengeluaran: `Total pengeluaran yang telah terealisasi tercatat sebesar ${formatCurrency(financialReport.totalBelanja5)}. Rasio belanja terbesar dialokasikan untuk pemenuhan yadnya parhyangan dan operasional. Kewajiban tercatat sebesar ${formatCurrency(financialReport.totalKewajiban)}, menunjukkan struktur permodalan yang aman.`,
        analisisLikuiditas: `Dengan cadangan kas tersedia sebesar ${formatCurrency(financialReport.totalAsetKas)}, desa adat memiliki daya tahan likuiditas yang kuat untuk mendanai agenda yadnya mendatang tanpa bergantung pada pinjaman pihak ketiga.`,
        rekomendasi: [
          'Pertahankan pencatatan kas berlapis antara kas fisik Juru Raksa dan kas rekening LPD/Bank.',
          'Lakukan rekonsiliasi berkala sebelum paruman bulanan krama desa.',
          'Alokasikan sebagian surplus berjalan ke dana cadangan upakara karya agung.',
          'Sampaikan salinan neraca resmi kepada para kelian tempek dan tokoh adat.'
        ],
        fullNarrative: 'Analisis disusun berdasarkan data neraca real-time.'
      };

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' });
      setAiInsights(fallbackInsights);
      setAiTimestamp(nowStr);
      showNotification('Analisis standar neraca berhasil dimuat (Gemini AI Offline Fallback).', 'info');
      setActiveTab('ai-narasi');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Salin Naskah Narasi
  const handleCopyNarrative = () => {
    if (!aiInsights) return;
    const text = `LAPORAN FORMULIR NERACA & ANALISIS PERJALANAN KEUANGAN\n${institutionName}\nPer Tanggal: ${formatDate(reportDate)}\n\n` +
      `Ringkasan Eksekutif:\n${aiInsights.headline}\n\n` +
      `1. RINGKASAN PERJALANAN KEUANGAN DESA ADAT:\n${aiInsights.ringkasanPerjalanan}\n\n` +
      `2. ANALISIS PENGELUARAN BERSTANDAR AI:\n${aiInsights.analisisPengeluaran}\n\n` +
      `3. ANALISIS LIKUIDITAS & DAYA TAHAN KAS:\n${aiInsights.analisisLikuiditas}\n\n` +
      `4. REKOMENDASI STRATEGIS PARUMAN:\n` + aiInsights.rekomendasi.map((r, i) => `${i + 1}. ${r}`).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedNarrative(true);
    showNotification('Naskah narasi berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedNarrative(false), 2000);
  };

  // Cetak Dokumen
  const handlePrint = () => {
    window.print();
  };

  // Ekspor PDF
  const handleExportPdf = async () => {
    if (!printableAreaRef.current) return;
    showNotification('Menyiapkan berkas PDF Formulir Neraca...', 'info');
    const success = await exportElementToPdf(printableAreaRef.current, {
      filename: `Formulir_Neraca_${institutionName.replace(/\s+/g, '_')}_${reportDate}.pdf`,
      orientation: 'portrait',
      format: 'a4'
    });
    if (success) {
      showNotification('Dokumen PDF Formulir Neraca berhasil diunduh!', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* =======================================================
          TOP BAR & HEADER
      ======================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded-full bg-emerald-100 text-emerald-800 tracking-wider">
              Standar Akuntansi Desa Adat
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Chart of Accounts (CoA) Baku</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Formulir Neraca & Analisis Perjalanan Keuangan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Menyajikan posisi saldo aktiva, pasiva, dan evaluasi pengeluaran dana adat berbasis AI secara transparan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tombol Analisis AI Gemini */}
          <button
            type="button"
            onClick={handleGenerateAiAnalysis}
            disabled={isGeneratingAi}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs text-white shadow-xs flex items-center gap-2 transition-all duration-200 ${
              isGeneratingAi 
                ? 'bg-indigo-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 hover:shadow-indigo-200'
            }`}
          >
            {isGeneratingAi ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            )}
            <span>{isGeneratingAi ? 'Menganalisis dengan Gemini AI...' : 'Analisis dengan Gemini AI'}</span>
          </button>

          {/* Tombol Cetak Dokumen */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Dokumen</span>
          </button>

          {/* Tombol Ekspor PDF */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor PDF</span>
          </button>

          {/* Pengaturan Kop & TTD */}
          <button
            type="button"
            onClick={handleOpenSettings}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Pengaturan Kop Surat & Tanda Tangan"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =======================================================
          FILTER TANGGAL LAPORAN & STATUS BANNER
      ======================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <label htmlFor="report-date-input" className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
              Posisi Neraca Per Tanggal:
            </label>
            <input
              id="report-date-input"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="mt-0.5 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setReportDate(new Date().toISOString().split('T')[0])}
            className="mt-4 px-2.5 py-1 text-2xs font-medium rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            Hari Ini
          </button>
        </div>

        {/* Indikator Balance & Jumlah Transaksi */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xs text-slate-400 uppercase tracking-wider">Basis Data Jurnal</div>
            <div className="text-xs font-bold text-slate-700">{financialReport.filteredCount} Transaksi Terekam</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            {financialReport.isBalanced ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Neraca Seimbang (Rp 0)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Selisih: {formatCurrency(financialReport.selisih)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* =======================================================
          METRIC CARDS RINGKASAN NERACA
      ======================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Aktiva */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Aktiva (Aset)</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-extrabold text-slate-900">{formatCurrency(financialReport.totalAset)}</div>
            <p className="text-2xs text-slate-500 mt-0.5">
              Kas: {formatCurrency(financialReport.totalAsetKas)} | Hibah: {formatCurrency(financialReport.totalAsetKasProgram)}
            </p>
          </div>
        </div>

        {/* Total Kewajiban */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Kewajiban (Hutang)</span>
            <div className={`p-2 rounded-lg ${financialReport.totalKewajiban === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-extrabold ${financialReport.totalKewajiban === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {financialReport.totalKewajiban === 0 ? 'Rp 0 (Bebas Hutang)' : formatCurrency(financialReport.totalKewajiban)}
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              {financialReport.totalKewajiban === 0 ? 'Tidak ada kewajiban belanja tertunggak' : `${financialReport.kewajiban.length} pos kewajiban tercatat`}
            </p>
          </div>
        </div>

        {/* Surplus / Defisit Berjalan */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Surplus / Defisit Berjalan</span>
            <div className={`p-2 rounded-lg ${financialReport.surplusDefisitBerjalan >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {financialReport.surplusDefisitBerjalan >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-extrabold ${financialReport.surplusDefisitBerjalan >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(financialReport.surplusDefisitBerjalan)}
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              Pendapatan {formatCurrency(financialReport.totalPendapatan4 + financialReport.totalSumberDana7)} - Belanja {formatCurrency(financialReport.totalBelanja5)}
            </p>
          </div>
        </div>

        {/* Skor AI Insight */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Indeks Kesehatan AI</span>
            <div className="p-1.5 rounded-lg bg-indigo-800 text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-300">{aiInsights ? `${aiInsights.healthScore}/100` : '--/100'}</span>
              <span className="text-xs font-semibold text-indigo-100">
                {aiInsights ? aiInsights.healthStatus : 'Belum dianalisis'}
              </span>
            </div>
            <p className="text-2xs text-indigo-300 mt-1 truncate">
              {aiInsights ? `Terakhir diperbarui: ${aiTimestamp || 'Hari ini'}` : 'Klik tombol Analisis Gemini AI di atas'}
            </p>
          </div>
        </div>
      </div>

      {/* =======================================================
          TAB NAVIGATION
      ======================================================= */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('neraca')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'neraca'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Formulir Neraca Standar (Aktiva vs Pasiva)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai-narasi')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'ai-narasi'
              ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Naskah Narasi & Analisis AI</span>
          {aiInsights && (
            <span className="px-2 py-0.5 text-2xs rounded-full bg-indigo-100 text-indigo-700 font-bold">
              Tersedia
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('belanja')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'belanja'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Rincian Pos Belanja (Akun 5)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cetak')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'cetak'
              ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Pratinjau Format Cetak Dokumen</span>
        </button>
      </div>

      {/* =======================================================
          TAB 1: FORMULIR NERACA STANDAR (2 KOLOM: AKTIVA VS PASIVA)
      ======================================================= */}
      {activeTab === 'neraca' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* KOLOM KIRI: AKTIVA (ASET) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm uppercase tracking-wide">AKTIVA (ASET)</span>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-300">
                {formatCurrency(financialReport.totalAset)}
              </span>
            </div>

            <div className="p-5 space-y-6 flex-1">
              {/* 1.1 KAS & SETARA KAS (1.1.1) */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    A. Kas & Setara Kas (1.1.1)
                  </span>
                  <span className="text-xs font-semibold font-mono text-slate-700">
                    {formatCurrency(financialReport.totalAsetKas)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {financialReport.asetKas.length > 0 ? (
                    financialReport.asetKas.map((item) => (
                      <div key={item.code} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-mono text-slate-400">{item.code}</span>
                          <span className="text-slate-700 font-medium">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900 shrink-0">
                          {formatCurrency(item.saldo)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-center py-2">Belum ada saldo kas tercatat</div>
                  )}
                </div>
              </div>

              {/* 1.1.2 KAS PROGRAM & HIBAH */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    B. Kas Program & Hibah (1.1.2)
                  </span>
                  <span className="text-xs font-semibold font-mono text-slate-700">
                    {formatCurrency(financialReport.totalAsetKasProgram)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {financialReport.asetKasProgram.length > 0 ? (
                    financialReport.asetKasProgram.map((item) => (
                      <div key={item.code} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-mono text-slate-400">{item.code}</span>
                          <span className="text-slate-700 font-medium">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900 shrink-0">
                          {formatCurrency(item.saldo)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-center py-2">Tidak ada saldo kas program aktif</div>
                  )}
                </div>
              </div>

              {/* 1.2 PIUTANG (1.2.*) */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    C. Piutang Desa Adat (1.2)
                  </span>
                  <span className="text-xs font-semibold font-mono text-slate-700">
                    {formatCurrency(financialReport.totalAsetPiutang)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {financialReport.asetPiutang.length > 0 ? (
                    financialReport.asetPiutang.map((item) => (
                      <div key={item.code} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-mono text-slate-400">{item.code}</span>
                          <span className="text-slate-700 font-medium">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-900 shrink-0">
                          {formatCurrency(item.saldo)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic text-center py-2">Tidak ada piutang beredar</div>
                  )}
                </div>
              </div>
            </div>

            {/* Total Aktiva Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold text-sm">
              <span className="text-slate-800 uppercase tracking-wider">TOTAL AKTIVA (ASET)</span>
              <span className="font-mono text-emerald-700 text-base">{formatCurrency(financialReport.totalAset)}</span>
            </div>
          </div>

          {/* KOLOM KANAN: PASIVA (KEWAJIBAN & EKUITAS) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm uppercase tracking-wide">PASIVA (KEWAJIBAN & MODAL)</span>
              </div>
              <span className="text-xs font-mono font-semibold text-emerald-300">
                {formatCurrency(financialReport.totalPasiva)}
              </span>
            </div>

            <div className="p-5 space-y-6 flex-1">
              {/* 2.1 KEWAJIBAN / HUTANG */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    A. Kewajiban / Liabilitas (2.1)
                  </span>
                  <span className="text-xs font-semibold font-mono text-slate-700">
                    {formatCurrency(financialReport.totalKewajiban)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {financialReport.kewajiban.length > 0 ? (
                    financialReport.kewajiban.map((item) => (
                      <div key={item.code} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-mono text-slate-400">{item.code}</span>
                          <span className="text-slate-700 font-medium">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-rose-700 shrink-0">
                          {formatCurrency(item.saldo)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-center font-medium">
                      ✓ Bebas Kewajiban / Hutang Nihil
                    </div>
                  )}
                </div>
              </div>

              {/* 3.1 EKUITAS & MODAL */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    B. Ekuitas & Modal Desa (3.1)
                  </span>
                  <span className="text-xs font-semibold font-mono text-slate-700">
                    {formatCurrency(financialReport.totalEkuitas)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {financialReport.ekuitas.map((item) => (
                    <div key={item.code} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-mono text-slate-400">{item.code}</span>
                        <span className="text-slate-700 font-medium">{item.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 shrink-0">
                        {formatCurrency(item.saldo)}
                      </span>
                    </div>
                  ))}

                  {/* Surplus / Defisit Periode Berjalan */}
                  <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="font-mono text-emerald-600 font-bold">3.1.1.07</span>
                      <span className="text-slate-900 font-semibold">Surplus / Defisit Periode Berjalan</span>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${
                      financialReport.surplusDefisitBerjalan >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {formatCurrency(financialReport.surplusDefisitBerjalan)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Keseimbangan Alert */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Validasi Persamaan Akuntansi:</span>
                  <span className="font-mono font-bold text-slate-800">
                    Aktiva = Kewajiban + Ekuitas
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1.5">
                  <span className="text-slate-500">Selisih Keseimbangan:</span>
                  <span className={`font-bold font-mono ${financialReport.isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {financialReport.isBalanced ? 'Rp 0 (SEIMBANG)' : formatCurrency(financialReport.selisih)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Pasiva Footer */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold text-sm">
              <span className="text-slate-800 uppercase tracking-wider">TOTAL PASIVA (KEWAJIBAN + EKUITAS)</span>
              <span className="font-mono text-emerald-700 text-base">{formatCurrency(financialReport.totalPasiva)}</span>
            </div>
          </div>

        </div>
      )}

      {/* =======================================================
          TAB 2: NASKAH NARASI & ANALISIS PENGELUARAN GEMINI AI
      ======================================================= */}
      {activeTab === 'ai-narasi' && (
        <div className="space-y-6">
          {aiInsights ? (
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-xs overflow-hidden">
              
              {/* Banner Atas AI */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-700 text-amber-300">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          Analisis Gemini AI Terverifikasi
                        </span>
                        <span className="text-xs text-indigo-400">•</span>
                        <span className="text-xs text-indigo-200">Per Tanggal {formatDate(reportDate)}</span>
                      </div>
                      <h2 className="text-xl font-extrabold text-white mt-0.5">
                        Ringkasan Perjalanan Keuangan & Evaluasi Pengeluaran
                      </h2>
                    </div>
                  </div>

                  {/* Badges & Actions */}
                  <div className="flex items-center gap-2.5">
                    <div className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-xs flex items-center gap-2">
                      <span className="text-xs text-indigo-200">Skor:</span>
                      <span className="text-sm font-black text-amber-300">{aiInsights.healthScore}/100</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300">
                        {aiInsights.healthStatus}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyNarrative}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white border border-white/20 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedNarrative ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedNarrative ? 'Tersalin' : 'Salin Naskah'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateAiAnalysis}
                      disabled={isGeneratingAi}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-colors"
                      title="Analisis Ulang"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Headline */}
                <div className="mt-4 pt-4 border-t border-indigo-700/50 text-indigo-100 text-sm font-medium italic">
                  "{aiInsights.headline}"
                </div>
              </div>

              {/* Konten Narasi 4 Babak */}
              <div className="p-6 space-y-6">
                
                {/* 1. Ringkasan Perjalanan Keuangan */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-base mb-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-black">
                      1
                    </span>
                    <h3>Ringkasan Perjalanan Keuangan Desa Adat</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiInsights.ringkasanPerjalanan}
                  </p>
                </div>

                {/* 2. Analisis Pengeluaran Berstandar AI */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-base mb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs flex items-center justify-center font-black">
                      2
                    </span>
                    <h3>Analisis Pengeluaran Berstandar AI (Evaluasi Akun 5)</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiInsights.analisisPengeluaran}
                  </p>
                </div>

                {/* 3. Likuiditas & Ketahanan Neraca */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-base mb-2">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-black">
                      3
                    </span>
                    <h3>Likuiditas & Ketahanan Neraca</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {aiInsights.analisisLikuiditas}
                  </p>
                </div>

                {/* 4. Rekomendasi Paruman */}
                <div className="p-5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-base mb-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-900 text-xs flex items-center justify-center font-black">
                      4
                    </span>
                    <h3>Rekomendasi Strategis untuk Prajuru & Paruman Krama</h3>
                  </div>
                  <div className="space-y-2">
                    {aiInsights.rekomendasi.map((rek, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-sm text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{rek}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Naskah Narasi AI Belum Dibuat</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Klik tombol di bawah untuk mengaktifkan Gemini AI dan membuat formulir narasi perjalanan keuangan resmi beserta analisis pengeluaran berstandar AI.
              </p>
              <button
                type="button"
                onClick={handleGenerateAiAnalysis}
                disabled={isGeneratingAi}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-indigo-200 transition-all inline-flex items-center gap-2"
              >
                {isGeneratingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                <span>{isGeneratingAi ? 'Sedang Menganalisis...' : 'Buat Naskah Narasi & Analisis AI Sekarang'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* =======================================================
          TAB 3: RINCIAN POS BELANJA (AKUN 5 SESUAI CONSTANT)
      ======================================================= */}
      {activeTab === 'belanja' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rekapitulasi Realisasi Pos Belanja Desa Adat (Akun 5)
                </h3>
                <p className="text-xs text-slate-500">
                  Pengelompokan otomatis berdasarkan Chart of Accounts (CoA) Baku `REFERENSI_REKENING`.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase font-semibold">Total Realisasi Belanja</div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {formatCurrency(financialReport.totalBelanja5)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.entries(financialReport.posBelanjaBreakdown) as [string, PosBelanjaGroup][]).map(([key, group]) => (
                <div key={key} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {group.title}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {formatCurrency(group.total)}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {group.items.length > 0 ? (
                      group.items.map(item => (
                        <div key={item.code} className="flex items-center justify-between py-1 text-slate-600">
                          <span className="truncate pr-2">{item.code} {item.name}</span>
                          <span className="font-mono font-medium text-slate-800 shrink-0">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 italic py-1">Nihil / Belum ada realisasi</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          TAB 4 & PRINTABLE AREA: PRATINJAU FORMAT CETAK DOKUMEN RESMI
      ======================================================= */}
      <div className={activeTab === 'cetak' ? 'block' : 'hidden print:block'}>
        <div 
          ref={printableAreaRef}
          id="printable-formulir-neraca"
          className="bg-white p-8 lg:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6 print:p-0 print:border-none print:shadow-none print:max-w-none text-slate-900"
        >
          {/* KOP SURAT RESMI */}
          <div className="text-center border-b-4 border-double border-slate-900 pb-4">
            <h1 className="text-2xl font-black tracking-wide text-slate-900 uppercase">
              {institutionName}
            </h1>
            <h2 className="text-base font-bold text-slate-800 tracking-wider uppercase mt-1">
              FORMULIR NERACA & NASKAH PERJALANAN KEUANGAN
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {address}
            </p>
            <p className="text-2xs text-slate-500 mt-0.5">
              Telp: {contact} | Email: {email}
            </p>
          </div>

          {/* Metadata Laporan */}
          <div className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-200 pb-2">
            <div>
              <span className="font-semibold text-slate-800">Perihal:</span> {upakaraName}
            </div>
            <div>
              <span className="font-semibold text-slate-800">Posisi Per Tanggal:</span> {formatDate(reportDate)}
            </div>
          </div>

          {/* Ringkasan Narasi Eksekutif jika ada */}
          {aiInsights && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs space-y-2">
              <div className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
                Ringkasan Perjalanan Keuangan (AI Insight):
              </div>
              <p className="text-slate-700 leading-relaxed italic">"{aiInsights.headline}"</p>
              <p className="text-slate-700 leading-relaxed">{aiInsights.ringkasanPerjalanan}</p>
            </div>
          )}

          {/* TABEL NERACA CETAK */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            {/* SISI AKTIVA */}
            <div className="border border-slate-400 rounded-lg overflow-hidden">
              <div className="bg-slate-100 font-bold px-3 py-2 border-b border-slate-400 flex justify-between">
                <span>AKTIVA (ASET)</span>
                <span>JUMLAH</span>
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <div className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-0.5">1.1 Kas & Setara Kas</div>
                  {financialReport.asetKas.map(i => (
                    <div key={i.code} className="flex justify-between py-0.5">
                      <span className="truncate pr-1">{i.code} {i.name}</span>
                      <span className="font-mono">{formatCurrency(i.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 mt-1">
                    <span>Subtotal Kas & Bank</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalAsetKas)}</span>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-0.5">1.1.2 Kas Program & Hibah</div>
                  {financialReport.asetKasProgram.length > 0 ? (
                    financialReport.asetKasProgram.map(i => (
                      <div key={i.code} className="flex justify-between py-0.5">
                        <span className="truncate pr-1">{i.code} {i.name}</span>
                        <span className="font-mono">{formatCurrency(i.saldo)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic">Nihil</div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 mt-1">
                    <span>Subtotal Kas Program</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalAsetKasProgram)}</span>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-0.5">1.2 Piutang</div>
                  {financialReport.asetPiutang.length > 0 ? (
                    financialReport.asetPiutang.map(i => (
                      <div key={i.code} className="flex justify-between py-0.5">
                        <span className="truncate pr-1">{i.code} {i.name}</span>
                        <span className="font-mono">{formatCurrency(i.saldo)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 italic">Nihil</div>
                  )}
                </div>
              </div>
              <div className="bg-slate-100 font-black px-3 py-2 border-t border-slate-400 flex justify-between">
                <span>TOTAL AKTIVA</span>
                <span className="font-mono">{formatCurrency(financialReport.totalAset)}</span>
              </div>
            </div>

            {/* SISI PASIVA */}
            <div className="border border-slate-400 rounded-lg overflow-hidden">
              <div className="bg-slate-100 font-bold px-3 py-2 border-b border-slate-400 flex justify-between">
                <span>PASIVA (KEWAJIBAN & EKUITAS)</span>
                <span>JUMLAH</span>
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <div className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-0.5">2.1 Kewajiban / Hutang</div>
                  {financialReport.kewajiban.length > 0 ? (
                    financialReport.kewajiban.map(i => (
                      <div key={i.code} className="flex justify-between py-0.5">
                        <span className="truncate pr-1">{i.code} {i.name}</span>
                        <span className="font-mono text-rose-700">{formatCurrency(i.saldo)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-emerald-700 italic">✓ Nihil (Bebas Hutang)</div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 mt-1">
                    <span>Subtotal Kewajiban</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalKewajiban)}</span>
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-700 mb-1 border-b border-slate-200 pb-0.5">3.1 Ekuitas & Modal</div>
                  {financialReport.ekuitas.map(i => (
                    <div key={i.code} className="flex justify-between py-0.5">
                      <span className="truncate pr-1">{i.code} {i.name}</span>
                      <span className="font-mono">{formatCurrency(i.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-0.5">
                    <span>Surplus/Defisit Berjalan</span>
                    <span className="font-mono">{formatCurrency(financialReport.surplusDefisitBerjalan)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-200 mt-1">
                    <span>Subtotal Ekuitas</span>
                    <span className="font-mono">{formatCurrency(financialReport.totalEkuitas)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-100 font-black px-3 py-2 border-t border-slate-400 flex justify-between">
                <span>TOTAL PASIVA</span>
                <span className="font-mono">{formatCurrency(financialReport.totalPasiva)}</span>
              </div>
            </div>
          </div>

          {/* TANDA TANGAN & PENGESAHAN DOKUMEN */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs print:pt-4">
            <div className="space-y-1">
              <p className="text-slate-600 mb-2">
                Mengetahui,<br />
                <span className="font-bold text-slate-900">Keliang Desa Adat</span>
              </p>
              <div className="h-16 sm:h-20 print:h-16 flex items-center justify-center relative my-1">
                {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, bukan di Juru Raksa, mengambil tempat setengah nama Keliang Adat ke kiri */}
                {sigSettings.autoEmbed && sigSettings.showStampOverlay && effectiveStamp && (
                  <div 
                    className="absolute pointer-events-none select-none z-0"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-68%, -46%)',
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
                    className="max-h-16 sm:max-h-20 print:max-h-16 object-contain relative z-10" 
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}
                  />
                ) : (
                  <div className="h-14 print:h-12" />
                )}
              </div>
              <p className="font-black text-slate-900 underline relative z-10">{keliangName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-slate-600 mb-2">
                {customPlace}, {formatDate(signatureDate)}<br />
                <span className="font-bold text-slate-900">Juru Raksa / Bendahara</span>
              </p>
              <div className="h-16 sm:h-20 print:h-16 flex items-center justify-center relative my-1">
                {signatures.juruRaksa && sigSettings.autoEmbed ? (
                  <img 
                    src={signatures.juruRaksa} 
                    alt="TTD Juru Raksa" 
                    className="max-h-16 sm:max-h-20 print:max-h-16 object-contain relative z-10" 
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact'
                    }}
                  />
                ) : (
                  <div className="h-14 print:h-12" />
                )}
              </div>
              <p className="font-black text-slate-900 underline relative z-10">{juruRaksaName}</p>
            </div>
          </div>

        </div>
      </div>

      {/* =======================================================
          MODAL PENGATURAN KOP & PENANDATANGAN
      ======================================================= */}
      {isSettingsOpen && (
        <Modal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          title="Pengaturan Kop Surat & Tanda Tangan Formulir Neraca"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nama Desa Adat</label>
              <input
                type="text"
                value={tempInstitutionName}
                onChange={(e) => setTempInstitutionName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Nama Kegiatan / Upakara</label>
              <input
                type="text"
                value={tempUpakaraName}
                onChange={(e) => setTempUpakaraName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Keliang Desa Adat</label>
                <input
                  type="text"
                  value={tempKeliangName}
                  onChange={(e) => setTempKeliangName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Juru Raksa / Bendahara</label>
                <input
                  type="text"
                  value={tempJuruRaksaName}
                  onChange={(e) => setTempJuruRaksaName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tempat Penetapan</label>
                <input
                  type="text"
                  value={tempCustomPlace}
                  onChange={(e) => setTempCustomPlace(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tanggal Tanda Tangan</label>
                <input
                  type="date"
                  value={tempSignatureDate}
                  onChange={(e) => setTempSignatureDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Alamat Kantor</label>
              <input
                type="text"
                value={tempAddress}
                onChange={(e) => setTempAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
              >
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =======================================================
          MODAL PREVIEW CEPAT
      ======================================================= */}
      <FormulirNeracaModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        reportDate={reportDate}
        financialReport={{
          asetKas: [...financialReport.asetKas, ...financialReport.asetKasProgram],
          asetPiutang: financialReport.asetPiutang,
          kewajiban: financialReport.kewajiban,
          ekuitas: financialReport.ekuitas,
          totalAsetKas: financialReport.totalAsetKas + financialReport.totalAsetKasProgram,
          totalAsetPiutang: financialReport.totalAsetPiutang,
          totalAset: financialReport.totalAset,
          totalKewajiban: financialReport.totalKewajiban,
          totalEkuitas: financialReport.totalEkuitas,
          totalPasiva: financialReport.totalPasiva,
          surplusDefisit: financialReport.surplusDefisitBerjalan,
          isBalanced: financialReport.isBalanced,
          selisih: financialReport.selisih
        }}
        aiAnalysis={aiInsights ? {
          healthScore: aiInsights.healthScore,
          healthStatus: aiInsights.healthStatus,
          headline: aiInsights.headline,
          ringkasanPerjalanan: aiInsights.ringkasanPerjalanan,
          analisisPengeluaran: aiInsights.analisisPengeluaran,
          rekomendasi: aiInsights.rekomendasi
        } : null}
        institutionName={institutionName}
        customPlace={customPlace}
        keliangName={keliangName}
        juruRaksaName={juruRaksaName}
      />

    </div>
  );
};

export default FormulirNeraca;
