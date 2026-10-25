import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Trash2,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Coins,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { JuDisplayRow, BkuData, BudgetItem, MonthlyData } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { generateContentWithFallback } from '../../utils/geminiClient';
import { REFERENSI_REKENING } from '../../constants';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isFallback?: boolean;
}

export interface FinancialChatbotAiProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  budgetItems?: BudgetItem[];
  monthlyChartData?: MonthlyData[];
  selectedYear: number | 'all';
  availableYears?: number[];
  bkuBalance?: number;
  totalHutang?: number;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const FinancialChatbotAi: React.FC<FinancialChatbotAiProps> = ({
  entries = [],
  bkuData = [],
  budgetItems = [],
  monthlyChartData = [],
  selectedYear,
  availableYears = [],
  bkuBalance = 0,
  totalHutang = 0
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Om Swastyastu! 🙏 Saya **Asisten AI Keuangan Desa Adat Basangalas**.\n\nSaya siap membantu Anda menelusuri data realisasi keuangan, anggaran belanja, posisi kas, dan program Tri Hita Karana (*Parhyangan, Pawongan, Palemahan*).\n\nSilakan ajukan pertanyaan atau klik saran pertanyaan di bawah ini!`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tentukan tahun aktif
  const activeYear = useMemo(() => {
    if (selectedYear !== 'all') return Number(selectedYear);
    if (availableYears.length > 0) return Math.max(...availableYears);
    return new Date().getFullYear();
  }, [selectedYear, availableYears]);

  // Ekstraksi data bulan transaksi aktif terkini (current month in context)
  const currentMonthIndex = useMemo(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const yrEntries = safeEntries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && (selectedYear === 'all' || d.getFullYear() === activeYear);
    });

    if (yrEntries.length > 0) {
      // Cari tanggal transaksi terbaru di tahun aktif
      const timestamps = yrEntries.map(e => new Date(e.date).getTime()).filter(t => !isNaN(t));
      if (timestamps.length > 0) {
        const latestDate = new Date(Math.max(...timestamps));
        return latestDate.getMonth();
      }
    }
    return new Date().getMonth();
  }, [entries, activeYear, selectedYear]);

  const currentMonthName = MONTH_NAMES_ID[currentMonthIndex];

  // Agregasi metrik komprehensif untuk konteks Chatbot
  const financialContext = useMemo(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeBku = Array.isArray(bkuData) ? bkuData : [];
    const safeBudget = Array.isArray(budgetItems) ? budgetItems : [];

    // Filter per tahun
    const yrEntries = safeEntries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && (selectedYear === 'all' || d.getFullYear() === activeYear);
    });

    let totalPendapatanTahun = 0;
    let totalBelanjaTahun = 0;
    let totalPendapatanBulanIni = 0;
    let totalBelanjaBulanIni = 0;

    // Rincian Belanja Tahunan & Bulan Ini
    const belanjaBreakdown = {
      parhyanganTahun: 0,
      parhyanganBulanIni: 0,
      pawonganTahun: 0,
      pawonganBulanIni: 0,
      palemahanTahun: 0,
      palemahanBulanIni: 0,
      insentifTahun: 0,
      insentifBulanIni: 0,
      operasionalTahun: 0,
      operasionalBulanIni: 0
    };

    // Rincian Pendapatan
    const pendapatanBreakdown = {
      danaPuniaTahun: 0,
      danaPuniaBulanIni: 0,
      hibahBkkTahun: 0,
      hibahBkkBulanIni: 0,
      asliAdatTahun: 0,
      asliAdatBulanIni: 0,
      lainLainTahun: 0,
      lainLainBulanIni: 0
    };

    yrEntries.forEach(e => {
      const rawCode = (e.kodeRekening || '').trim();
      const cleanCode = rawCode.split(' - ')[0].trim();
      const debet = Number(e.debet) || 0;
      const kredit = Number(e.kredit) || 0;

      const d = new Date(e.date);
      const isThisMonth = !isNaN(d.getTime()) && d.getMonth() === currentMonthIndex;

      // PENDAPATAN (Akun 4, 7, 6)
      if (cleanCode.startsWith('4') || cleanCode.startsWith('7') || (cleanCode.startsWith('6') && !cleanCode.startsWith('6.1.1'))) {
        const net = kredit - debet;
        totalPendapatanTahun += net;
        if (isThisMonth) totalPendapatanBulanIni += net;

        if (cleanCode.startsWith('4.1.1')) {
          pendapatanBreakdown.danaPuniaTahun += net;
          if (isThisMonth) pendapatanBreakdown.danaPuniaBulanIni += net;
        } else if (cleanCode.startsWith('7')) {
          pendapatanBreakdown.hibahBkkTahun += net;
          if (isThisMonth) pendapatanBreakdown.hibahBkkBulanIni += net;
        } else if (cleanCode.startsWith('4.1')) {
          pendapatanBreakdown.asliAdatTahun += net;
          if (isThisMonth) pendapatanBreakdown.asliAdatBulanIni += net;
        } else {
          pendapatanBreakdown.lainLainTahun += net;
          if (isThisMonth) pendapatanBreakdown.lainLainBulanIni += net;
        }
      }

      // BELANJA (Akun 5)
      if (cleanCode.startsWith('5')) {
        const net = debet - kredit;
        totalBelanjaTahun += net;
        if (isThisMonth) totalBelanjaBulanIni += net;

        if (cleanCode.startsWith('5.2')) {
          belanjaBreakdown.parhyanganTahun += net;
          if (isThisMonth) belanjaBreakdown.parhyanganBulanIni += net;
        } else if (cleanCode.startsWith('5.3')) {
          belanjaBreakdown.pawonganTahun += net;
          if (isThisMonth) belanjaBreakdown.pawonganBulanIni += net;
        } else if (cleanCode.startsWith('5.4')) {
          belanjaBreakdown.palemahanTahun += net;
          if (isThisMonth) belanjaBreakdown.palemahanBulanIni += net;
        } else if (cleanCode.startsWith('5.1.1')) {
          belanjaBreakdown.insentifTahun += net;
          if (isThisMonth) belanjaBreakdown.insentifBulanIni += net;
        } else if (cleanCode.startsWith('5.1.2')) {
          belanjaBreakdown.operasionalTahun += net;
          if (isThisMonth) belanjaBreakdown.operasionalBulanIni += net;
        }
      }
    });

    // Fallback BKU jika Jurnal Umum kosong
    if (totalPendapatanTahun === 0 && totalBelanjaTahun === 0 && safeBku.length > 0) {
      const yrBku = safeBku.filter(b => {
        if (!b.tanggal) return false;
        const d = new Date(b.tanggal);
        return !isNaN(d.getTime()) && (selectedYear === 'all' || d.getFullYear() === activeYear);
      });
      totalPendapatanTahun = yrBku.reduce((sum, b) => sum + (Number(b.penerimaan) || 0), 0);
      totalBelanjaTahun = yrBku.reduce((sum, b) => sum + (Number(b.pengeluaran) || 0), 0);

      const mBku = yrBku.filter(b => new Date(b.tanggal).getMonth() === currentMonthIndex);
      totalPendapatanBulanIni = mBku.reduce((sum, b) => sum + (Number(b.penerimaan) || 0), 0);
      totalBelanjaBulanIni = mBku.reduce((sum, b) => sum + (Number(b.pengeluaran) || 0), 0);
    }

    // Anggaran APB
    const yrBudget = safeBudget.filter(b => selectedYear === 'all' || Number(b.tahun) === activeYear);
    const paguPendapatan = yrBudget
      .filter(b => b.kategori === 'pendapatan')
      .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);
    const paguBelanja = yrBudget
      .filter(b => b.kategori && b.kategori.startsWith('belanja'))
      .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);

    const paguParhyangan = yrBudget
      .filter(b => (b.kodeRekening || '').startsWith('5.2') || (b.kategori || '').toLowerCase().includes('parhyangan'))
      .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);

    const serapanBelanjaPersen = paguBelanja > 0 ? (totalBelanjaTahun / paguBelanja) * 100 : 0;
    const surplusTahun = totalPendapatanTahun - totalBelanjaTahun;
    const surplusBulanIni = totalPendapatanBulanIni - totalBelanjaBulanIni;

    // Transaksi terbaru (5 entri terakhir)
    const recentTx = yrEntries.slice(-6).map(e => ({
      tanggal: e.date,
      rekening: e.kodeRekening,
      keterangan: e.keterangan || '-',
      debet: e.debet,
      kredit: e.kredit
    }));

    return {
      activeYear,
      currentMonthIndex,
      currentMonthName,
      totalPendapatanTahun,
      totalBelanjaTahun,
      surplusTahun,
      totalPendapatanBulanIni,
      totalBelanjaBulanIni,
      surplusBulanIni,
      paguPendapatan,
      paguBelanja,
      paguParhyangan,
      serapanBelanjaPersen,
      bkuBalance,
      totalHutang,
      belanjaBreakdown,
      pendapatanBreakdown,
      recentTx,
      totalTransaksi: yrEntries.length
    };
  }, [entries, bkuData, budgetItems, selectedYear, activeYear, currentMonthIndex, currentMonthName, bkuBalance, totalHutang]);

  // Scroll otomatis ke bawah saat ada pesan baru
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Saran Pertanyaan Cepat (Quick Suggestions)
  const quickQuestions = [
    'Berapa total realisasi belanja program parhyangan bulan ini?',
    'Bagaimana kondisi saldo kas dan likuiditas desa saat ini?',
    'Berapa persen serapan pagu anggaran belanja tahun ini?',
    'Rincikan belanja bulan ini untuk operasional dan insentif prajuru.',
    'Berapa pendapatan dari BKK dan Dana Punia tahun ini?'
  ];

  // Fallback Deterministic Answer Generator (jika Gemini API gagal/offline)
  const generateDeterministicAnswer = (query: string): string => {
    const q = query.toLowerCase();
    const ctx = financialContext;

    // 1. Pertanyaan Parhyangan
    if (q.includes('parhyangan') || q.includes('upakara') || q.includes('piodalan') || q.includes('aci')) {
      const isMonth = q.includes('bulan ini') || q.includes(ctx.currentMonthName.toLowerCase());
      if (isMonth) {
        return `Realisasi belanja **Program Parhyangan** pada bulan **${ctx.currentMonthName} ${ctx.activeYear}** adalah **${formatCurrency(ctx.belanjaBreakdown.parhyanganBulanIni)}**.\n\nAkumulasi belanja Parhyangan sepanjang TA ${ctx.activeYear} telah mencapai **${formatCurrency(ctx.belanjaBreakdown.parhyanganTahun)}**${
          ctx.paguParhyangan > 0 ? ` dari pagu alokasi ${formatCurrency(ctx.paguParhyangan)} (${((ctx.belanjaBreakdown.parhyanganTahun / ctx.paguParhyangan) * 100).toFixed(1)}%).` : '.'
        }`;
      }
      return `Total realisasi belanja **Program Parhyangan** (Aci, Piodalan, & Pura) TA ${ctx.activeYear} tercatat sebesar **${formatCurrency(ctx.belanjaBreakdown.parhyanganTahun)}**.\n\nKhusus pada bulan **${ctx.currentMonthName}**, pengeluaran Parhyangan adalah sebesar **${formatCurrency(ctx.belanjaBreakdown.parhyanganBulanIni)}**.`;
    }

    // 2. Pertanyaan Kas / Saldo / Likuiditas
    if (q.includes('kas') || q.includes('saldo') || q.includes('likuiditas') || q.includes('bku')) {
      return `Posisi **Saldo Kas Riil** Desa Adat Basangalas saat ini adalah **${formatCurrency(ctx.bkuBalance)}**.\n\nKondisi operasional TA ${ctx.activeYear}:\n- **Total Pendapatan:** ${formatCurrency(ctx.totalPendapatanTahun)}\n- **Total Belanja:** ${formatCurrency(ctx.totalBelanjaTahun)}\n- **Surplus/Defisit Kas:** ${formatCurrency(ctx.surplusTahun)} (${ctx.surplusTahun >= 0 ? 'Surplus Aman' : 'Defisit Terkendali'})\n- **Kewajiban Hutang Tercatat:** ${formatCurrency(ctx.totalHutang)}`;
    }

    // 3. Pertanyaan Serapan / Pagu Anggaran
    if (q.includes('serapan') || q.includes('pagu') || q.includes('anggaran') || q.includes('apb') || q.includes('efisiensi')) {
      return `Realisasi serapan belanja Desa Adat Basangalas TA ${ctx.activeYear} adalah **${ctx.serapanBelanjaPersen.toFixed(1)}%**.\n\n- **Total Pagu Anggaran Belanja:** ${formatCurrency(ctx.paguBelanja)}\n- **Realisasi Belanja Riil:** ${formatCurrency(ctx.totalBelanjaTahun)}\n- **Sisa Pagu Belanja Tersedia:** ${formatCurrency(Math.max(0, ctx.paguBelanja - ctx.totalBelanjaTahun))}\n\nPenggunaan anggaran belanja berjalan sesuai peruntukan pos APB.`;
    }

    // 4. Pertanyaan Pawongan / Palemahan / Insentif
    if (q.includes('pawongan')) {
      return `Realisasi belanja **Program Pawongan** (Pasraman, Seni, & Krama) TA ${ctx.activeYear} adalah **${formatCurrency(ctx.belanjaBreakdown.pawonganTahun)}** (Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.belanjaBreakdown.pawonganBulanIni)}).`;
    }
    if (q.includes('palemahan') || q.includes('lingkungan') || q.includes('setra') || q.includes('kebersihan')) {
      return `Realisasi belanja **Program Palemahan** (Kebersihan, Setra, & Wantilan) TA ${ctx.activeYear} adalah **${formatCurrency(ctx.belanjaBreakdown.palemahanTahun)}** (Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.belanjaBreakdown.palemahanBulanIni)}).`;
    }
    if (q.includes('insentif') || q.includes('prajuru') || q.includes('serati') || q.includes('pecalang')) {
      return `Realisasi belanja **Beban Insentif Prajuru, Serati & Pecalang** TA ${ctx.activeYear} adalah **${formatCurrency(ctx.belanjaBreakdown.insentifTahun)}** (Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.belanjaBreakdown.insentifBulanIni)}).`;
    }
    if (q.includes('operasional') || q.includes('kantor') || q.includes('atk')) {
      return `Realisasi belanja **Operasional Kantor & Kesekretariatan** TA ${ctx.activeYear} adalah **${formatCurrency(ctx.belanjaBreakdown.operasionalTahun)}** (Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.belanjaBreakdown.operasionalBulanIni)}).`;
    }

    // 5. Pertanyaan Pendapatan / BKK / Punia
    if (q.includes('pendapatan') || q.includes('punia') || q.includes('bkk') || q.includes('hibah')) {
      return `Ringkasan **Penerimaan Pendapatan** Desa Adat Basangalas TA ${ctx.activeYear}:\n- **Total Pendapatan:** ${formatCurrency(ctx.totalPendapatanTahun)}\n- **Hibah BKK Provinsi/Kabupaten:** ${formatCurrency(ctx.pendapatanBreakdown.hibahBkkTahun)}\n- **Dana Punia & Urunan Krama:** ${formatCurrency(ctx.pendapatanBreakdown.danaPuniaTahun + ctx.pendapatanBreakdown.asliAdatTahun)}\n- **Penerimaan Bulan ${ctx.currentMonthName}:** ${formatCurrency(ctx.totalPendapatanBulanIni)}`;
    }

    // Default general summary
    return `Berikut ringkasan kondisi keuangan Desa Adat Basangalas TA ${ctx.activeYear}:\n\n` +
      `• **Pendapatan TA ${ctx.activeYear}:** ${formatCurrency(ctx.totalPendapatanTahun)} (Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.totalPendapatanBulanIni)})\n` +
      `• **Belanja TA ${ctx.activeYear}:** ${formatCurrency(ctx.totalBelanjaTahun)} (Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.totalBelanjaBulanIni)})\n` +
      `• **Surplus/Defisit Bersih:** ${formatCurrency(ctx.surplusTahun)}\n` +
      `• **Saldo Kas Riil (BKU):** ${formatCurrency(ctx.bkuBalance)}\n` +
      `• **Realisasi Belanja Parhyangan Bulan Ini:** ${formatCurrency(ctx.belanjaBreakdown.parhyanganBulanIni)}\n\n` +
      `Ada rincian pos rekening atau pos belanja adat lain yang ingin Anda ketahui?`;
  };

  // Kirim Pertanyaan ke Chatbot
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    const ctx = financialContext;

    // Prompt dengan System Instruction kaya konteks akuntansi adat Bali
    const systemInstruction = `Anda adalah "Asisten AI Keuangan Desa Adat Basangalas", bertugas menjawab pertanyaan Prajuru, Krama, dan Pemeriksa Keuangan seputar tata kelola keuangan desa adat.
Karakter: Sopan, profesional, akuntabel, menjunjung etika tata kelola Bali, berbasis data angka riil yang disediakan.
Gunakan format mata uang Rupiah (Rp) yang rapi, cetak tebal angka-angka penting, dan gunakan bullet points jika ada rincian pos.
Jika ditanya tentang "bulan ini", jawablah berdasarkan data Bulan ${ctx.currentMonthName} ${ctx.activeYear}.
Gunakan istilah keuangan adat seperti Parhyangan (Aci, Piodalan), Pawongan, Palemahan, Dana Punia, BKK, SiLPA, BKU secara akurat.`;

    const dataContextPrompt = `KONTEKS DATA KEUANGAN DESA ADAT BASANGALAS (Tahun Anggaran ${ctx.activeYear}):
- Bulan Analisis Terkini: ${ctx.currentMonthName} ${ctx.activeYear}
- Total Pendapatan TA ${ctx.activeYear}: ${formatCurrency(ctx.totalPendapatanTahun)}
- Total Pendapatan Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.totalPendapatanBulanIni)}
- Total Belanja TA ${ctx.activeYear}: ${formatCurrency(ctx.totalBelanjaTahun)}
- Total Belanja Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.totalBelanjaBulanIni)}
- Surplus/Defisit TA ${ctx.activeYear}: ${formatCurrency(ctx.surplusTahun)}
- Surplus/Defisit Bulan ${ctx.currentMonthName}: ${formatCurrency(ctx.surplusBulanIni)}

RINCIAN BELANJA (TA ${ctx.activeYear} & Bulan ${ctx.currentMonthName}):
- Program Parhyangan (5.2): TA = ${formatCurrency(ctx.belanjaBreakdown.parhyanganTahun)} | Bulan Ini = ${formatCurrency(ctx.belanjaBreakdown.parhyanganBulanIni)} (Pagu = ${formatCurrency(ctx.paguParhyangan)})
- Program Pawongan (5.3): TA = ${formatCurrency(ctx.belanjaBreakdown.pawonganTahun)} | Bulan Ini = ${formatCurrency(ctx.belanjaBreakdown.pawonganBulanIni)}
- Program Palemahan (5.4): TA = ${formatCurrency(ctx.belanjaBreakdown.palemahanTahun)} | Bulan Ini = ${formatCurrency(ctx.belanjaBreakdown.palemahanBulanIni)}
- Insentif Prajuru, Serati & Pecalang (5.1.1): TA = ${formatCurrency(ctx.belanjaBreakdown.insentifTahun)} | Bulan Ini = ${formatCurrency(ctx.belanjaBreakdown.insentifBulanIni)}
- Operasional Kantor & ATK (5.1.2): TA = ${formatCurrency(ctx.belanjaBreakdown.operasionalTahun)} | Bulan Ini = ${formatCurrency(ctx.belanjaBreakdown.operasionalBulanIni)}

RINCIAN PENDAPATAN:
- Dana Punia & Urunan (4.1.1 & 4.1): TA = ${formatCurrency(ctx.pendapatanBreakdown.danaPuniaTahun + ctx.pendapatanBreakdown.asliAdatTahun)} | Bulan Ini = ${formatCurrency(ctx.pendapatanBreakdown.danaPuniaBulanIni + ctx.pendapatanBreakdown.asliAdatBulanIni)}
- BKK Hibah Pemprov/Pemkab (7): TA = ${formatCurrency(ctx.pendapatanBreakdown.hibahBkkTahun)} | Bulan Ini = ${formatCurrency(ctx.pendapatanBreakdown.hibahBkkBulanIni)}
- Pendapatan Lain-lain (4.2/6): TA = ${formatCurrency(ctx.pendapatanBreakdown.lainLainTahun)}

STATUS APB & KAS:
- Total Pagu Belanja APB: ${formatCurrency(ctx.paguBelanja)} (Serapan: ${ctx.serapanBelanjaPersen.toFixed(1)}%)
- Saldo Kas Riil (BKU): ${formatCurrency(ctx.bkuBalance)}
- Total Kewajiban Hutang: ${formatCurrency(ctx.totalHutang)}

PERTANYAAN PENGGUNA:
"${textToSend}"

INSTRUKSI JAWABAN:
Jawab secara tepat, ringkas, informatif, dan langsung menjawab inti pertanyaan dengan data riil di atas.`;

    try {
      const response = await generateContentWithFallback({
        prompt: dataContextPrompt,
        systemInstruction
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.warn('Gemini Chatbot fallback used:', err);
      // Fallback deterministic logic jika API offline
      const fallbackText = generateDeterministicAnswer(textToSend);
      const fallbackMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date(),
        isFallback: true
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Percakapan telah diatur ulang. Ada informasi kondisi keuangan atau program adat Desa Adat Basangalas yang ingin Anda tanyakan?`,
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div
      id="financial-chatbot-ai-card"
      className="bg-gradient-to-tl from-slate-50 to-slate-500 rounded-2xl border border-slate-300 shadow-xl overflow-hidden transition-all duration-300 mb-8"
    >
      {/* --- HEADER BANNER --- */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-5 text-white flex items-center justify-between gap-4 border-b border-teal-800/40">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-2xl shadow-inner flex items-center justify-center">
            <Bot size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight font-serif text-white">
                Chatbot AI Keuangan Desa Adat
              </h3>
              <span className="bg-teal-500/20 text-teal-300 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border border-teal-500/40 flex items-center gap-1">
                <Sparkles size={11} className="text-teal-300" /> Gemini AI
              </span>
            </div>
            <p className="text-xs text-teal-200/80 mt-0.5">
              Tanyakan secara instan realisasi program upakara, posisi saldo kas, serapan anggaran, atau rincian belanja adat.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-2 bg-slate-800/70 hover:bg-slate-700/80 text-teal-200 rounded-xl border border-slate-700 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
            title="Bersihkan riwayat obrolan"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-slate-800/70 hover:bg-slate-700/80 text-teal-200 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title={isExpanded ? 'Kecilkan panel' : 'Buka panel'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* --- CHAT BODY (JIKA TERBUKA) --- */}
      {isExpanded && (
        <div className="flex flex-col h-[520px] bg-slate-50/50">
          {/* Quick Context Ticker */}
          <div className="bg-teal-50/90 px-5 py-2.5 border-b border-teal-200/70 flex flex-wrap items-center justify-between text-[11px] font-mono text-teal-950 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span>
                Konteks Aktif: <strong>TA {financialContext.activeYear}</strong> | Bulan Acuan: <strong>{financialContext.currentMonthName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-700">
              <span>Kas Riil: <strong className="text-teal-800">{formatCurrency(financialContext.bkuBalance)}</strong></span>
              <span>Parhyangan ({financialContext.currentMonthName}): <strong className="text-slate-900">{formatCurrency(financialContext.belanjaBreakdown.parhyanganBulanIni)}</strong></span>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[88%] sm:max-w-[80%] ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-teal-700'
                      : 'bg-linear-to-br from-slate-900 to-teal-900 border border-teal-500/40 text-teal-300'
                  }`}
                >
                  {msg.sender === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`relative p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-teal-700 text-white rounded-tr-xs'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  {/* Content with basic formatting */}
                  <div className="whitespace-pre-line space-y-1">
                    {msg.text.split('\n').map((line, lIdx) => {
                      // Check for bold syntax
                      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                      return (
                        <p
                          key={lIdx}
                          dangerouslySetInnerHTML={{ __html: formattedLine }}
                          className={line.startsWith('•') || line.startsWith('-') ? 'pl-2 text-slate-800' : ''}
                        />
                      );
                    })}
                  </div>

                  {/* Bubble Footer */}
                  <div
                    className={`mt-2 pt-1 border-t flex items-center justify-between text-[10px] ${
                      msg.sender === 'user'
                        ? 'border-teal-600/60 text-teal-200'
                        : 'border-slate-100 text-slate-600'
                    }`}
                  >
                    <span>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.isFallback && ' • Mode Cerdas Lokal'}
                    </span>
                    {msg.sender === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="hover:text-teal-700 flex items-center gap-1 transition-colors cursor-pointer ml-3"
                        title="Salin jawaban"
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
                        <span>{copiedId === msg.id ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-3 mr-auto max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-slate-900 to-teal-900 border border-teal-500/40 text-teal-300 flex items-center justify-center shrink-0">
                  <Bot size={15} />
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl rounded-tl-xs shadow-xs text-xs text-slate-700 flex items-center gap-2">
                  <Sparkles size={14} className="text-teal-700 animate-spin" />
                  <span>Menganalisis data keuangan desa...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-4 py-2 bg-white border-t border-slate-200">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Zap size={11} className="text-amber-500" /> Saran Pertanyaan Cepat:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 text-slate-700 text-[11px] rounded-lg border border-slate-200 transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik pertanyaan (cth: Berapa total realisasi belanja program parhyangan bulan ini?)..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:bg-white transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Kirim</span>
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default FinancialChatbotAi;
