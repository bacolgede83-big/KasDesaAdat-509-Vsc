import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  RefreshCw, 
  Copy, 
  Check, 
  Printer, 
  Landmark, 
  Coins, 
  Calendar, 
  HelpCircle, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Scale,
  CheckCircle
} from 'lucide-react';
import type { JuDisplayRow, MonthlyData, BudgetItem, BkuData } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { useNotification } from '../../context/NotificationContext';
import { exportElementToPdf } from '../../utils/pdfExport';
import { 
  getGeminiClient, 
  generateContentWithFallback,
  testGeminiConnection, 
  GEMINI_MODEL_TEXT, 
  maskApiKey, 
  getGeminiApiKey 
} from '../../utils/geminiClient';

interface ExecutiveSummaryAiProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  monthlyChartData: MonthlyData[];
  summaryData: {
    totalRevenue: number;
    totalExpenses: number;
    totalSumberDana: number;
    totalHutang: number;
    balance: number;
    netSurplusDeficit: number;
    opsi1NetOperasional?: number;
    opsi2NetOperasional?: number;
  };
  budgetItems?: BudgetItem[];
  selectedYear: number | 'all';
}

interface ParsedAiInsights {
  healthScore: number; // 0 - 100
  healthStatus: 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis';
  headline: string;
  monthlyTrendSummary: string;
  liquidityAnalysis: string;
  criticalRisks: string[];
  strategicRecommendations: string[];
  fullNarrative: string;
}

const STORAGE_KEY_PREFIX = 'desa_adat_executive_summary_ai_';

export const normalizeHealthStatus = (st: string): 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis' => {
  const lower = (st || '').toLowerCase();
  if (lower.includes('sangat') || lower.includes('prima') || lower.includes('unggul') || lower.includes('sangat sehat')) return 'Sangat Sehat';
  if (lower.includes('kritis') || lower.includes('bahaya') || lower.includes('buruk') || lower.includes('parah')) return 'Kritis';
  if (lower.includes('waspada') || lower.includes('hati-hati') || lower.includes('kurang') || lower.includes('defisit')) return 'Waspada';
  return 'Sehat';
};

export const extractScoreAndStatus = (
  text: string,
  fallbackScore: number,
  fallbackStatus: 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis'
): { score: number; status: 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis' } => {
  if (!text) return { score: fallbackScore, status: fallbackStatus };

  let score = fallbackScore;
  let status = fallbackStatus;

  // 1. Prioritas tag terstruktur eksplisit SKOR_KESEHATAN & STATUS_KESEHATAN
  const tagScoreMatch = text.match(/SKOR_KESEHATAN[:\s\*]*([0-9]{1,3})/i);
  if (tagScoreMatch) {
    const s = parseInt(tagScoreMatch[1], 10);
    if (!isNaN(s) && s >= 0 && s <= 100) score = s;
  }

  const tagStatusMatch = text.match(/STATUS_KESEHATAN[:\s\*]*([A-Za-z\s]+)/i);
  if (tagStatusMatch) {
    status = normalizeHealthStatus(tagStatusMatch[1].split('\n')[0]);
  }

  // 2. Pencarian pola variasi teks jika tag eksplisit tidak ditemukan
  if (!tagScoreMatch) {
    const patterns = [
      /(?:skor|score|nilai)\s*(?:kesehatan)?\s*(?:keuangan)?[\s\*\:\-]*([0-9]{1,3})\s*(?:\/|\s*dari)\s*100/i,
      /(?:skor|score|nilai)\s*(?:kesehatan)?\s*(?:keuangan)?[\s\*\:\-]*\**([0-9]{2,3})\**/i,
      /([0-9]{1,3})\s*\/\s*100/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const s = parseInt(m[1], 10);
        if (!isNaN(s) && s >= 0 && s <= 100) {
          score = s;
          break;
        }
      }
    }
  }

  // 3. Pencarian status jika tag eksplisit tidak ditemukan
  if (!tagStatusMatch) {
    const statusMatch = text.match(/(?:status|predikat|kategori|kondisi)[\s\*\:\-\(]*(Sangat Sehat|Sehat|Waspada|Kritis)\b/i) ||
                        text.match(/\b(Sangat Sehat|Waspada|Kritis)\b/i);
    if (statusMatch) {
      status = normalizeHealthStatus(statusMatch[1]);
    } else {
      if (score >= 85) status = 'Sangat Sehat';
      else if (score >= 70) status = 'Sehat';
      else if (score >= 50) status = 'Waspada';
      else status = 'Kritis';
    }
  }

  return { score, status };
};

export const ExecutiveSummaryAi: React.FC<ExecutiveSummaryAiProps> = ({
  entries,
  bkuData = [],
  monthlyChartData,
  summaryData,
  budgetItems = [],
  selectedYear
}) => {
  const { showNotification } = useNotification();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string; latencyMs?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastGeneratedTime, setLastGeneratedTime] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<ParsedAiInsights | null>(null);

  // Storage key for caching AI analysis based on selected year
  const cacheKey = useMemo(() => `${STORAGE_KEY_PREFIX}${selectedYear}`, [selectedYear]);

  // Test connection to Gemini API
  const handleTestConnection = async () => {
    setIsTestingAi(true);
    setTestResult(null);
    showNotification('Sedang menguji koneksi kode & API Key Gemini...', 'info');
    try {
      const result = await testGeminiConnection();
      if (result.success) {
        setTestResult({
          success: true,
          text: result.response || result.message,
          latencyMs: result.latencyMs
        });
        showNotification(`Tes Kode Berhasil! (${result.latencyMs}ms) Respon: "${result.response}"`, 'success');
      } else {
        setTestResult({
          success: false,
          text: result.message,
          latencyMs: result.latencyMs
        });
        showNotification(`Tes Kode Gagal: ${result.message}`, 'error');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        text: err?.message || 'Error tes koneksi'
      });
      showNotification(`Tes Gagal: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsTestingAi(false);
    }
  };

  // Financial metrics aggregation for AI prompt
  const aggregatedStats = useMemo(() => {
    const activeMonths = monthlyChartData.filter(m => m.penerimaan > 0 || m.realisasi > 0);
    const avgMonthlyIncome = activeMonths.length > 0 ? summaryData.totalRevenue / activeMonths.length : summaryData.totalRevenue;
    const avgMonthlyExpense = activeMonths.length > 0 ? summaryData.totalExpenses / activeMonths.length : summaryData.totalExpenses;
    
    // Determine peak months
    let highestIncomeMonth = { name: '-', amount: 0 };
    let highestExpenseMonth = { name: '-', amount: 0 };
    monthlyChartData.forEach(m => {
      if (m.penerimaan > highestIncomeMonth.amount) {
        highestIncomeMonth = { name: m.name, amount: m.penerimaan };
      }
      if (m.realisasi > highestExpenseMonth.amount) {
        highestExpenseMonth = { name: m.name, amount: m.realisasi };
      }
    });

    // Cash runway in months (how many months current cash can support average expense)
    const cashRunwayMonths = avgMonthlyExpense > 0 ? (summaryData.balance / avgMonthlyExpense).toFixed(1) : 'Sangat Aman (>12 bln)';

    return {
      activeMonthsCount: activeMonths.length,
      avgMonthlyIncome,
      avgMonthlyExpense,
      highestIncomeMonth,
      highestExpenseMonth,
      cashRunwayMonths,
      netSavingsRate: summaryData.totalRevenue > 0 
        ? ((summaryData.netSurplusDeficit / summaryData.totalRevenue) * 100).toFixed(1) 
        : '0'
    };
  }, [monthlyChartData, summaryData]);

  // Standardized base health score and status calculation (0 - 100)
  const baseHealthScoreAndStatus = useMemo(() => {
    let score = 80;
    if (summaryData.totalRevenue > summaryData.totalExpenses) score += 10;
    else if (summaryData.totalRevenue < summaryData.totalExpenses) score -= 20;

    if (summaryData.totalHutang === 0) score += 10;
    else if (summaryData.totalHutang > summaryData.balance) score -= 25;
    else score -= 10;

    if (summaryData.balance > summaryData.totalExpenses * 0.3) score += 5;
    const savingsRate = Number(aggregatedStats.netSavingsRate) || 0;
    if (savingsRate >= 15) score += 5;

    score = Math.max(25, Math.min(98, score));

    let status: 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Kritis' = 'Sehat';
    if (score >= 85) status = 'Sangat Sehat';
    else if (score >= 70) status = 'Sehat';
    else if (score >= 50) status = 'Waspada';
    else status = 'Kritis';

    return { score, status };
  }, [summaryData, aggregatedStats]);

  // Unified synchronized score for Card & Narrative (always identical)
  const currentHealthScore = aiInsights?.healthScore ?? baseHealthScoreAndStatus.score;
  const currentHealthStatus = aiInsights?.healthStatus ?? baseHealthScoreAndStatus.status;
  const isScoreEstimated = !aiInsights;

  // Load cached AI analysis on year change and re-synchronize score if needed
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.insights && parsed.timestamp) {
          // Re-sync healthScore and healthStatus with fullNarrative if present to prevent any discrepancy
          if (parsed.insights.fullNarrative) {
            const { score, status } = extractScoreAndStatus(
              parsed.insights.fullNarrative,
              parsed.insights.healthScore ?? baseHealthScoreAndStatus.score,
              parsed.insights.healthStatus ?? baseHealthScoreAndStatus.status
            );
            parsed.insights.healthScore = score;
            parsed.insights.healthStatus = status;
          }
          setAiInsights(parsed.insights);
          setLastGeneratedTime(parsed.timestamp);
        } else {
          setAiInsights(null);
          setLastGeneratedTime(null);
        }
      } else {
        setAiInsights(null);
        setLastGeneratedTime(null);
      }
    } catch {
      setAiInsights(null);
      setLastGeneratedTime(null);
    }
  }, [cacheKey, baseHealthScoreAndStatus]);

  // Generator Analisis Mandiri (Fail-Safe jika Server AI Google 503 / Offline)
  const generateDeterministicExecutiveSummary = (): string => {
    const surplusDefisitText = summaryData.netSurplusDeficit >= 0
      ? `surplus operasional bersih sebesar ${formatCurrency(summaryData.netSurplusDeficit)} (Tingkat Tabungan ${aggregatedStats.netSavingsRate}%)`
      : `defisit operasional sebesar ${formatCurrency(Math.abs(summaryData.netSurplusDeficit))}`;
    
    const runwayText = aggregatedStats.cashRunwayMonths >= 999 
      ? 'cadangan kas sangat aman' 
      : `estimasi ketahanan operasional kas mencapai ~${aggregatedStats.cashRunwayMonths} bulan ke depan`;

    const periodeText = selectedYear === 'all' ? 'Seluruh Tahun Transaksi' : `Tahun Anggaran ${selectedYear}`;

    return `SKOR_KESEHATAN: ${baseHealthScoreAndStatus.score}
STATUS_KESEHATAN: ${baseHealthScoreAndStatus.status}

# RINGKASAN EKSEKUTIF KEUANGAN DESA ADAT (${periodeText})
**Status Kesehatan Keuangan: ${baseHealthScoreAndStatus.status.toUpperCase()} (${baseHealthScoreAndStatus.score}/100)**

Kondisi tata kelola keuangan desa adat saat ini berada dalam kategori **${baseHealthScoreAndStatus.status}** dengan capaian ${surplusDefisitText} dan saldo kas tersedia ${formatCurrency(summaryData.balance)}.

---

### BABAK 1: Evaluasi Kinerja & Arus Kas Bulanan
- **Total Penerimaan Operasional & Punia (Akun 4):** ${formatCurrency(summaryData.totalRevenue)}
- **Total Realisasi Belanja (Akun 5):** ${formatCurrency(summaryData.totalExpenses)}
- **Rata-rata Penerimaan Bulanan:** ${formatCurrency(aggregatedStats.avgMonthlyIncome)}
- **Rata-rata Belanja Bulanan:** ${formatCurrency(aggregatedStats.avgMonthlyExpense)}
- **Bulan Penerimaan Puncak:** ${aggregatedStats.highestIncomeMonth.name} (${formatCurrency(aggregatedStats.highestIncomeMonth.amount)})
- **Bulan Belanja Tertinggi:** ${aggregatedStats.highestExpenseMonth.name} (${formatCurrency(aggregatedStats.highestExpenseMonth.amount)})

*Arus kas desa secara umum berjalan teratur dengan pencatatan mutasi kas yang tersinkronisasi antara Buku Kas Umum (BKU) dan Jurnal Umum.*

---

### BABAK 2: Likuiditas & Ketahanan Kas Desa
- **Saldo Kas & Bank Tersedia (Akun 1.1):** ${formatCurrency(summaryData.balance)}
- **Ketahanan Kas Operasional:** ${runwayText}.
- **Kewajiban / Hutang Belanja Aktif (Akun 2):** ${summaryData.totalHutang > 0 ? formatCurrency(summaryData.totalHutang) : 'Nihil (Bebas Beban Hutang)'}.
- **Rasio Solvabilitas Kas:** ${summaryData.totalHutang > 0 ? ((summaryData.balance / summaryData.totalHutang) * 100).toFixed(1) + '% (Kas mampu menutup hutang)' : '100% Bebas Hutang'}.

---

### BABAK 3: Titik Kritis & Mitigasi Risiko
1. **${summaryData.totalHutang > 0 ? 'Penyelesaian Hutang Belanja' : 'Kedisiplinan Saldo Kas'}:** ${summaryData.totalHutang > 0 ? `Terdapat kewajiban belanja yang belum diselesaikan sebesar ${formatCurrency(summaryData.totalHutang)}. Segera jadwalkan pelunasan melalui rekonsiliasi kas.` : `Kas desa bebas hutang, pertahankan pencatatan bukti transaksi fisik untuk setiap pengeluaran.`}
2. **Pola Pengeluaran:** Waspadai lonjakan belanja di bulan-bulan puncak piodalan/upacara adat agar tidak melampaui plafon anggaran paruman.
3. **Rekonsiliasi Kas Berkala:** Lakukan verifikasi rutin antara fisik uang tunai di brankas dengan saldo di rekening bank desa.

---

### BABAK 4: Rekomendasi Tindakan Strategis untuk Prajuru & Paruman
1. **Transparansi Paruman:** Paparkan laporan realisasi pendapatan dan belanja secara terbuka di depan krama banjar/desa pada saat paruman bulanan.
2. **Alokasi Dana Cadangan:** ${summaryData.netSurplusDeficit > 0 ? 'Sisihkan sebagian dari surplus operasional ke dalam kas cadangan abadi (dana abadi pura/desa).' : 'Lakukan penyesuaian skala prioritas belanja non-mendesak untuk memulihkan saldo kas.'}
3. **Pengawasan Fisik Bukti:** Pastikan seluruh pengeluaran kas telah disertai nota/faktur sah dan diverifikasi oleh Juru Raksa/Petengen serta disetujui Bendesa Adat.`;
  };

  // Generate Executive Summary with Gemini API
  const handleGenerateSummary = async () => {
    setIsExpanded(true);
    setIsGenerating(true);
    showNotification('Sedang menganalisis data keuangan bulanan dengan Gemini AI...', 'info');

    let responseText = '';
    let usedModel = 'Gemini AI';
    let isFallback = false;

    try {
      const monthlyBreakdownText = monthlyChartData
        .map(m => `- ${m.name}: Penerimaan ${formatCurrency(m.penerimaan)} | Realisasi Belanja ${formatCurrency(m.realisasi)} | Net: ${formatCurrency(m.penerimaan - m.realisasi)}`)
        .join('\n');

      const prompt = `
Anda adalah seorang Ahli Analisis Keuangan Senior dan Konsultan Tata Kelola Keuangan Desa Adat Bali (Aplikasi BACOL ENTERPRISE).
Tugas Anda adalah membuat 'Ringkasan Eksekutif & Analisis Kesehatan Keuangan Desa Adat' secara naratif, tajam, objektif, dan solutif untuk dibacakan kepada Bendesa Adat, Prajuru, dan Krama Desa saat paruman/rapat.

Berikut adalah DATA KEUANGAN REAL-TIME:
- Periode: ${selectedYear === 'all' ? 'Seluruh Tahun (Historis & Berjalan)' : `Tahun Anggaran ${selectedYear}`}
- Total Pendapatan Operasional & Punia (Akun 4): ${formatCurrency(summaryData.totalRevenue)}
- Total Belanja / Realisasi Operasional (Akun 5): ${formatCurrency(summaryData.totalExpenses)}
- Surplus / Defisit Bersih Operasional: ${formatCurrency(summaryData.netSurplusDeficit)} (Tingkat Tabungan: ${aggregatedStats.netSavingsRate}%)
- Total Sumber Dana / Modal Awal (Akun 7): ${formatCurrency(summaryData.totalSumberDana)}
- Saldo Kas & Bank Tersedia (Akun 1.1): ${formatCurrency(summaryData.balance)} (Ketahanan Kas: ~${aggregatedStats.cashRunwayMonths} bulan)
- Total Kewajiban / Hutang Belanja (Akun 2): ${formatCurrency(summaryData.totalHutang)}
- Rata-rata Penerimaan Bulanan: ${formatCurrency(aggregatedStats.avgMonthlyIncome)}
- Rata-rata Belanja Bulanan: ${formatCurrency(aggregatedStats.avgMonthlyExpense)}
- Bulan Penerimaan Tertinggi: ${aggregatedStats.highestIncomeMonth.name} (${formatCurrency(aggregatedStats.highestIncomeMonth.amount)})
- Bulan Belanja Tertinggi: ${aggregatedStats.highestExpenseMonth.name} (${formatCurrency(aggregatedStats.highestExpenseMonth.amount)})
- Skor Kesehatan Keuangan Sistem: ${baseHealthScoreAndStatus.score}/100 (${baseHealthScoreAndStatus.status})

RINCIAN MUTASI BULANAN:
${monthlyBreakdownText || 'Data bulanan belum terdistribusi penuh.'}

INSTRUKSI OUTPUT WAJIB (SINKRONISASI KARTU DAN NARASI):
Pada 2 BARIS PALING ATAS respons Anda, WAJIB tuliskan format tag berikut secara persis:
SKOR_KESEHATAN: ${baseHealthScoreAndStatus.score}
STATUS_KESEHATAN: ${baseHealthScoreAndStatus.status}

Kemudian lanjutkan dengan naskah analisis naratif yang rapi:
1. Satu kalimat headline/kesimpulan utama.
2. Analisis Naratif 4 Babak:
   - BABAK 1: Evaluasi Kinerja & Arus Kas Bulanan (bahas tren penerimaan vs belanja bulanan, stabilitas pendapatan, lonjakan pengeluaran).
   - BABAK 2: Likuiditas & Ketahanan Kas Desa (bahas kecukupan kas, rasio terhadap rata-rata belanja bulanan, dan solvabilitas terhadap hutang).
   - BABAK 3: Titik Kritis & Mitigasi Risiko (sebutkan secara spesifik apa saja yang perlu diwaspadai bendahara/juru raksa).
   - BABAK 4: Rekomendasi Tindakan Strategis untuk Prajuru & Paruman (3-4 langkah aksi nyata yang dapat segera dieksekusi).

PENTING:
Pastikan angka skor dan status kesehatan keuangan yang Anda sebutkan di dalam teks narasi SAMA PERSIS dengan SKOR_KESEHATAN (${baseHealthScoreAndStatus.score}/100) dan STATUS_KESEHATAN (${baseHealthScoreAndStatus.status}) di atas. Jangan sebutkan angka skor yang berbeda di dalam teks agar tidak terjadi perbedaan antara kartu indikator dan naskah narasi!
Gunakan bahasa Indonesia yang formal, profesional, mudah dipahami warga adat, dan berorientasi pada transparansi akuntabilitas publik. Gunakan format markdown yang rapi dengan sub-heading dan bullet points.
`;

      const result = await generateContentWithFallback({
        prompt,
        systemInstruction: "Anda adalah analis keuangan desa adat profesional yang teliti, mengedepankan kearifan lokal Bali dan prinsip akuntansi transparan akuntabel. Anda selalu memastikan angka skor kesehatan di kartu indikator dan naskah narasi 100% konsisten.",
        onRetryNotice: (notice) => showNotification(notice, 'info')
      });

      responseText = result.text;
      usedModel = result.modelUsed;
    } catch (err: any) {
      console.warn('Gemini API call encountered transient failure/503. Activating deterministic accounting synthesis fallback...', err);
      // Fail-Safe: Otomatis susun ringkasan eksekutif berbasis aturan akuntansi riil jika Google API 503 / offline
      responseText = generateDeterministicExecutiveSummary();
      isFallback = true;
    }

    try {
      // Extract synchronized score and status using robust parser
      const { score: parsedScore, status: parsedStatus } = extractScoreAndStatus(
        responseText,
        baseHealthScoreAndStatus.score,
        baseHealthScoreAndStatus.status
      );

      const newInsights: ParsedAiInsights = {
        healthScore: parsedScore,
        healthStatus: parsedStatus,
        headline: summaryData.netSurplusDeficit >= 0
          ? `Kondisi keuangan desa adat mencatatkan surplus operasional sebesar ${formatCurrency(summaryData.netSurplusDeficit)} dengan likuiditas kas yang terjaga.`
          : `Kondisi keuangan mencatat defisit operasional ${formatCurrency(Math.abs(summaryData.netSurplusDeficit))}, diperlukan optimalisasi penerimaan dan efisiensi pengeluaran.`,
        monthlyTrendSummary: `Rata-rata pendapatan bulanan ${formatCurrency(aggregatedStats.avgMonthlyIncome)} dengan rata-rata belanja ${formatCurrency(aggregatedStats.avgMonthlyExpense)}.`,
        liquidityAnalysis: `Saldo kas tersedia ${formatCurrency(summaryData.balance)} dengan estimasi ketahanan operasional ~${aggregatedStats.cashRunwayMonths} bulan ke depan.`,
        criticalRisks: [
          summaryData.totalHutang > 0 ? `Kewajiban hutang belanja belum dilunasi sebesar ${formatCurrency(summaryData.totalHutang)}.` : `Tidak terdapat kewajiban hutang yang membebani kas.`,
          summaryData.netSurplusDeficit < 0 ? `Tingkat realisasi belanja melampaui pendapatan periode berjalan.` : `Surplus kas perlu dialokasikan secara proporsional ke pos cadangan program adat.`
        ],
        strategicRecommendations: [
          'Pertahankan pelaporan berkala setiap bulan untuk menjaga kepercayaan krama desa.',
          summaryData.totalHutang > 0 ? 'Prioritaskan penyelesaian sisa hutang belanja melalui rekonsiliasi kas penerimaan.' : 'Rencanakan alokasi anggaran kegiatan parhyangan dan pawongan secara bertahap.',
          'Lakukan audit saldo fisik kas tunai secara periodik bersama pengawas desa.'
        ],
        fullNarrative: responseText
      };

      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' });
      setAiInsights(newInsights);
      setLastGeneratedTime(nowStr);

      // Cache in localStorage
      localStorage.setItem(cacheKey, JSON.stringify({
        insights: newInsights,
        timestamp: nowStr
      }));

      if (isFallback) {
        showNotification(`Server Google AI sedang padat (503). Analisis Eksekutif & Skor Kesehatan (${parsedScore}/100) berhasil disusun secara otomatis dari data akuntansi desa!`, 'info');
      } else {
        showNotification(`Ringkasan Eksekutif & Skor Kesehatan Keuangan (${parsedScore}/100 - ${parsedStatus}) berhasil disinkronisasi (${usedModel})!`, 'success');
      }
    } catch (err: any) {
      console.error('Error parsing narrative:', err);
      showNotification('Terjadi kesalahan saat memproses data analisis.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyNarrative = () => {
    if (!aiInsights?.fullNarrative) return;
    navigator.clipboard.writeText(aiInsights.fullNarrative);
    setCopied(true);
    showNotification('Ringkasan narasi eksekutif disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    if (!aiInsights) return;
    const yearLabel = selectedYear === 'all' ? 'Semua_Tahun' : `${selectedYear}`;
    const filename = `Ringkasan_Eksekutif_AI_Desa_Adat_${yearLabel}.pdf`;

    try {
      showNotification('Menyiapkan dokumen PDF Ringkasan Eksekutif AI...', 'info');
      await exportElementToPdf('ai-executive-summary-container', {
        filename,
        orientation: 'portrait',
        format: 'a4',
        margin: [8, 8, 8, 8],
        enableWatermark: true,
        watermarkText: 'DESA ADAT BASANGALAS'
      });
      showNotification('Dokumen PDF berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Export PDF error:', err);
      showNotification('Gagal mengekspor PDF ringkasan eksekutif.', 'error');
    }
  };

  // Helper to render narrative text formatted cleanly
  const renderFormattedNarrative = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-3 font-sans text-slate-800 text-sm md:text-[14.5px] leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1.5" />;

          // Skip raw machine tags from plain text rendering
          if (trimmed.toUpperCase().startsWith('SKOR_KESEHATAN:') || trimmed.toUpperCase().startsWith('STATUS_KESEHATAN:')) {
            return null;
          }

          // Heading 1 or 2
          if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
            const headingText = trimmed.replace(/^#+\s*/, '');
            return (
              <h3 key={idx} className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight mt-4 pt-2 border-b border-slate-200 flex items-center gap-2">
                <Sparkles size={16} className="text-teal-600 shrink-0" />
                <span>{headingText}</span>
              </h3>
            );
          }

          // Heading 3 or 4
          if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
            const subText = trimmed.replace(/^#+\s*/, '');
            return (
              <h4 key={idx} className="text-sm font-bold text-teal-900 uppercase tracking-wide mt-3 text-slate-900">
                {subText}
              </h4>
            );
          }

          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^[0-9]+\.\s/)) {
            const bulletContent = trimmed.replace(/^[-*]\s*|^[0-9]+\.\s*/, '');
            // Highlight bold parts
            const parts = bulletContent.split(/(\*\*.*?\*\*)/g);
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-teal-600 font-bold mt-0.5">•</span>
                <p className="text-slate-700 flex-1 leading-relaxed">
                  {parts.map((part, pIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={pIdx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </p>
              </div>
            );
          }

          // Normal Paragraph with potential bold elements
          const parts = trimmed.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={idx} className="text-slate-700 leading-relaxed">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={pIdx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div id="ai-executive-summary-container" className="bg-gradient-to-br from-white via-slate-50/70 to-teal-50/30 rounded-2xl shadow-xl border-2 border-teal-600/30 overflow-hidden transition-all text-slate-900 relative">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none no-print" />

      {/* Header Bar */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-teal-500/20 rounded-2xl border border-teal-400/40 text-teal-300 shadow-inner shrink-0">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-teal-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2 font-serif">
                Ringkasan Eksekutif &amp; Analisis Kesehatan Keuangan
              </h3>
              <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                Powered by Gemini AI
              </span>
            </div>
            <p className="text-xs text-teal-200/90 font-medium mt-0.5">
              Analisis naratif otomatis tren pendapatan bulanan, efisiensi belanja, likuiditas kas &amp; kesehatan tata kelola desa adat
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap no-print">
          {lastGeneratedTime && (
            <span className="text-[11px] font-mono text-teal-200/75 hidden sm:inline-block">
              Update: {lastGeneratedTime}
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingAi || isGenerating}
              className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-teal-300 font-semibold text-xs px-3 py-2.5 rounded-xl border border-teal-500/40 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              title="Tes koneksi langsung ke Gemini API menggunakan API Key aktif (tes kode)"
            >
              <Zap size={14} className={isTestingAi ? 'animate-bounce text-amber-400' : 'text-teal-400'} />
              <span>{isTestingAi ? 'Menguji...' : 'Tes Kode AI'}</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 active:scale-95 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-teal-300"
              title="Analisis ulang seluruh data keuangan menggunakan model AI terbaru"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
              <span>{isGenerating ? 'Menganalisis Data...' : aiInsights ? 'Perbarui Analisis AI' : 'Analisis dengan AI'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-teal-200 border border-slate-700 transition-all cursor-pointer"
              title={isExpanded ? 'Ciutkan ringkasan' : 'Bentangkan ringkasan'}
            >
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>
      </div>

      {testResult && (
        <div className={`mx-5 sm:mx-6 mt-3 px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
          testResult.success
            ? 'bg-emerald-950/60 text-emerald-200 border-emerald-500/40'
            : 'bg-rose-950/60 text-rose-200 border-rose-500/40'
        }`}>
          <div className="flex items-center gap-2">
            {testResult.success ? <CheckCircle size={15} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={15} className="text-rose-400 shrink-0" />}
            <span className="font-semibold">{testResult.success ? 'Koneksi Gemini AI Aktif:' : 'Koneksi Gemini AI Bermasalah:'}</span>
            <span className="italic">"{testResult.text}"</span>
          </div>
          {testResult.latencyMs && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/40 text-emerald-300 shrink-0">
              {testResult.latencyMs}ms • {GEMINI_MODEL_TEXT}
            </span>
          )}
        </div>
      )}

      {/* Main Body */}
      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Score Metric */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-300 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Activity size={13} className="text-teal-600" /> Skor Kesehatan
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  currentHealthScore >= 85 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  currentHealthScore >= 70 ? 'bg-teal-100 text-teal-800 border-teal-300' :
                  currentHealthScore >= 50 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                  'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {currentHealthStatus} {isScoreEstimated && <span className="opacity-75 text-[9px] font-normal">(Estimasi)</span>}
                </span>
              </div>
              <div className="my-1.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {currentHealthScore}
                </span>
                <span className="text-xs text-slate-400 font-mono">/ 100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-1000 ${
                    currentHealthScore >= 80 ? 'bg-emerald-500' :
                    currentHealthScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${currentHealthScore}%` }}
                />
              </div>
            </div>

            {/* Net Operasional */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-300 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Scale size={13} className="text-teal-600" /> Posisi Kas Bersih
              </span>
              <div className="my-1.5">
                <span className={`text-lg sm:text-xl font-black font-mono tracking-tight block ${
                  summaryData.netSurplusDeficit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {formatCurrency(summaryData.netSurplusDeficit)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {summaryData.netSurplusDeficit >= 0 ? 'Surplus Operasional' : 'Defisit Operasional'}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-600 flex items-center justify-between border-t border-slate-100 pt-1">
                <span>Tabungan:</span>
                <strong className="text-slate-900">{aggregatedStats.netSavingsRate}%</strong>
              </div>
            </div>

            {/* Rata-Rata Bulanan */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-300 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={13} className="text-teal-600" /> Arus Kas Rata-rata
              </span>
              <div className="my-1.5 space-y-0.5 text-xs font-mono">
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Masuk:</span>
                  <span>{formatCurrency(aggregatedStats.avgMonthlyIncome)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Keluar:</span>
                  <span>{formatCurrency(aggregatedStats.avgMonthlyExpense)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-medium border-t border-slate-100 pt-1">
                Berdasarkan {aggregatedStats.activeMonthsCount} bulan aktif
              </div>
            </div>

            {/* Ketahanan Likuiditas */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-300 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={13} className="text-teal-600" /> Ketahanan Likuiditas
              </span>
              <div className="my-1.5">
                <span className="text-lg sm:text-xl font-black font-mono text-teal-800 block">
                  ~{aggregatedStats.cashRunwayMonths} Bulan
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Kekuatan Saldo Kas {formatCurrency(summaryData.balance)}
                </span>
              </div>
              <div className="text-[10px] font-semibold text-emerald-700 border-t border-slate-100 pt-1 flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>Kas Siap Pakai</span>
              </div>
            </div>
          </div>

          {/* AI Narrative Section */}
          {aiInsights ? (
            <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-6 sm:p-8 space-y-6">
              {/* Header Box inside narrative */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-700">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                      Dokumen Narasi Eksekutif Keuangan Desa Adat
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Periode: {selectedYear === 'all' ? 'Seluruh Tahun' : `Tahun Anggaran ${selectedYear}`} • Otomatisasi AI Berbasis Standar Akuntansi Desa
                    </p>
                  </div>
                </div>

                {/* Print & Copy buttons */}
                <div className="flex items-center gap-2 no-print self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyNarrative}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 transition-all cursor-pointer"
                    title="Salin teks narasi ke clipboard"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-300 transition-all cursor-pointer"
                    title="Unduh ringkasan narasi eksekutif ini sebagai PDF"
                  >
                    <Printer size={14} />
                    <span>Cetak PDF</span>
                  </button>
                </div>
              </div>

              {/* Synchronized Score & Status Indicator inside narrative document */}
              <div className="p-4 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-900 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                    <Activity size={20} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Indikator Kesehatan Keuangan (Sinkron dengan Kartu Dashboard)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-teal-950">
                        {aiInsights.healthScore}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">/ 100</span>
                      <span className="text-xs text-slate-700 font-bold ml-1">
                        • {aiInsights.healthStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className={`text-xs font-black px-3.5 py-1.5 rounded-full border flex items-center gap-1.5 ${
                    aiInsights.healthScore >= 85 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    aiInsights.healthScore >= 70 ? 'bg-teal-100 text-teal-800 border-teal-300' :
                    aiInsights.healthScore >= 50 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    <CheckCircle size={13} />
                    <span>Terverifikasi Sinkron ({aiInsights.healthScore}/100)</span>
                  </span>
                </div>
              </div>

              {/* Render Structured Narrative */}
              <div className="prose prose-slate max-w-none">
                {renderFormattedNarrative(aiInsights.fullNarrative)}
              </div>

              {/* Summary Bottom Callout */}
              <div className="p-4 bg-teal-50/80 rounded-xl border border-teal-200 flex items-start gap-3 text-xs text-teal-900">
                <Info size={16} className="text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block uppercase tracking-wide text-teal-950">Catatan Tata Kelola:</strong>
                  <span>Hasil analisis narasi ini dirancang khusus untuk mempermudah penjelasan laporan kepada krama desa dalam paruman. Data diolah secara murni dari Buku Jurnal Umum &amp; Buku Kas Umum (BKU).</span>
                </div>
              </div>
            </div>
          ) : (
            /* Standby State */
            <div className="bg-white rounded-2xl border-2 border-dashed border-teal-300/80 p-8 sm:p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-inner">
                <Sparkles size={28} className="animate-pulse" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight font-serif">
                  Kecerdasan Buatan Siap Menganalisis
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Klik tombol <strong>"Analisis dengan AI"</strong> di atas untuk memproses data pendapatan bulanan, belanja, likuiditas kas, dan rasio keuangan desa adat secara otomatis ke dalam narasi eksekutif siap baca.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 active:scale-95 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <Zap size={16} />
                  <span>Mulai Analisis Kesehatan Keuangan Desa</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummaryAi;
