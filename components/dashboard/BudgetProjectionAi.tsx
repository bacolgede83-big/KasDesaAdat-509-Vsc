import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  DollarSign,
  Copy,
  Check,
  Printer,
  RefreshCw,
  AlertTriangle,
  Sliders,
  ChevronRight,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Scale,
  Landmark,
  FileText
} from 'lucide-react';
import type { JuDisplayRow, BkuData, BudgetItem } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { useNotification } from '../../context/NotificationContext';
import { generateContentWithFallback, GEMINI_MODEL_TEXT } from '../../utils/geminiClient';

export interface BudgetProjectionAiProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  budgetItems?: BudgetItem[];
  availableYears: number[];
  selectedYear?: number | 'all';
  setActivePage?: (page: string) => void;
}

export interface YearHistoricalSummary {
  year: number;
  pendapatan: number;
  belanja: number;
  surplusDefisit: number;
  insentif: number;
  operasional: number;
  parhyangan: number;
  pawongan: number;
  palemahan: number;
  anggaranBelanja: number;
  anggaranPendapatan: number;
  hasData: boolean;
}

export interface ProjectionItem {
  kode?: string;
  nama: string;
  nominal: number;
  persenAlokasi?: number;
  justifikasi?: string;
  alasan?: string;
}

export interface AllocationRecommendation {
  pilar: string;
  persenAlokasi: number;
  nominal: number;
  alasan: string;
  langkahImplementasi: string;
}

export interface AiProjectionResult {
  ringkasanAnalisis: string;
  proyeksiPendapatan: {
    total: number;
    pertumbuhanPersen: number;
    rincian: ProjectionItem[];
  };
  proyeksiBelanja: {
    total: number;
    pertumbuhanPersen: number;
    rincian: ProjectionItem[];
  };
  proyeksiSilpa: number;
  rekomendasiAlokasi: AllocationRecommendation[];
  mitigasiRisiko: string[];
  arahanKebijakanPrajuru: string[];
  generatedAt: string;
  modelUsed: string;
  scenario: 'moderat' | 'konservatif' | 'optimis';
}

const STORAGE_KEY_PREFIX = 'desa_adat_budget_projection_ai_';

export const BudgetProjectionAi: React.FC<BudgetProjectionAiProps> = ({
  entries = [],
  bkuData = [],
  budgetItems = [],
  availableYears = [],
  selectedYear = 'all',
  setActivePage
}) => {
  const { showNotification } = useNotification();

  // Tentukan anchorYear (Tahun Acuan) dari data yang ada
  const defaultAnchor = useMemo(() => {
    if (selectedYear !== 'all') return selectedYear;
    if (availableYears.length > 0) return Math.max(...availableYears);
    return new Date().getFullYear();
  }, [selectedYear, availableYears]);

  const [anchorYear, setAnchorYear] = useState<number>(defaultAnchor);
  const [scenario, setScenario] = useState<'moderat' | 'konservatif' | 'optimis'>('moderat');
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'recommendations'>('overview');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [storedAiResult, setStoredAiResult] = useState<AiProjectionResult | null>(null);

  // Sinkronkan anchorYear jika selectedYear berubah dari filter global
  useEffect(() => {
    if (selectedYear !== 'all') {
      setAnchorYear(selectedYear);
    }
  }, [selectedYear]);

  // Tahun Proyeksi Mendatang adalah T + 1
  const projectionYear = anchorYear + 1;
  const targetThreeYears = useMemo(() => {
    return [anchorYear - 2, anchorYear - 1, anchorYear];
  }, [anchorYear]);

  // Kalkulasi data historis 3 tahun terakhir secara detail
  const historical3Years: YearHistoricalSummary[] = useMemo(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const safeBku = Array.isArray(bkuData) ? bkuData : [];
    const safeBudget = Array.isArray(budgetItems) ? budgetItems : [];

    return targetThreeYears.map((yr) => {
      const yrEntries = safeEntries.filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d.getFullYear() === yr;
      });

      let pendapatanJU = 0;
      let belanjaJU = 0;
      let insentif = 0;
      let operasional = 0;
      let parhyangan = 0;
      let pawongan = 0;
      let palemahan = 0;

      yrEntries.forEach((e) => {
        const rawCode = (e.kodeRekening || '').trim();
        const cleanCode = rawCode.split(' - ')[0].trim();
        const debetVal = Number(e.debet) || 0;
        const kreditVal = Number(e.kredit) || 0;

        if (cleanCode.startsWith('4') || cleanCode.startsWith('7')) {
          pendapatanJU += (kreditVal - debetVal);
        } else if (cleanCode.startsWith('6') && !cleanCode.startsWith('6.1.1')) {
          pendapatanJU += (kreditVal - debetVal);
        }

        if (cleanCode.startsWith('5')) {
          const netBelanja = debetVal - kreditVal;
          belanjaJU += netBelanja;

          if (cleanCode.startsWith('5.1.1')) insentif += netBelanja;
          else if (cleanCode.startsWith('5.1.2') || cleanCode.startsWith('5.1.3') || cleanCode.startsWith('5.1.4')) operasional += netBelanja;
          else if (cleanCode.startsWith('5.2')) parhyangan += netBelanja;
          else if (cleanCode.startsWith('5.3')) pawongan += netBelanja;
          else if (cleanCode.startsWith('5.4')) palemahan += netBelanja;
        }
      });

      // Data BKU sebagai fallback
      const yrBku = safeBku.filter((b) => {
        if (!b.tanggal) return false;
        const d = new Date(b.tanggal);
        return !isNaN(d.getTime()) && d.getFullYear() === yr;
      });

      const bkuPenerimaan = yrBku.reduce((sum, b) => sum + (Number(b.penerimaan) || 0), 0);
      const bkuPengeluaran = yrBku.reduce((sum, b) => sum + (Number(b.pengeluaran) || 0), 0);

      const hasJurnal = yrEntries.length > 0;
      const hasBku = yrBku.length > 0;
      const pendapatan = hasJurnal ? pendapatanJU : (hasBku ? bkuPenerimaan : 0);
      const belanja = hasJurnal ? belanjaJU : (hasBku ? bkuPengeluaran : 0);

      // Anggaran
      const yrBudget = safeBudget.filter((b) => Number(b.tahun) === yr);
      const anggaranPendapatan = yrBudget
        .filter((b) => b.kategori === 'pendapatan')
        .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);
      const anggaranBelanja = yrBudget
        .filter((b) => b.kategori && b.kategori.startsWith('belanja'))
        .reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);

      return {
        year: yr,
        pendapatan,
        belanja,
        surplusDefisit: pendapatan - belanja,
        insentif,
        operasional,
        parhyangan,
        pawongan,
        palemahan,
        anggaranBelanja,
        anggaranPendapatan,
        hasData: pendapatan > 0 || belanja > 0 || yrEntries.length > 0 || yrBku.length > 0
      };
    });
  }, [entries, bkuData, budgetItems, targetThreeYears]);

  // Statistik agregasi 3 tahun
  const stats3Years = useMemo(() => {
    const validYears = historical3Years.filter(y => y.hasData);
    const count = validYears.length || 1;

    const avgPendapatan = validYears.reduce((sum, y) => sum + y.pendapatan, 0) / count;
    const avgBelanja = validYears.reduce((sum, y) => sum + y.belanja, 0) / count;
    const avgSurplus = validYears.reduce((sum, y) => sum + y.surplusDefisit, 0) / count;

    // Rata-rata belanja pos
    const avgInsentif = validYears.reduce((sum, y) => sum + y.insentif, 0) / count;
    const avgOperasional = validYears.reduce((sum, y) => sum + y.operasional, 0) / count;
    const avgParhyangan = validYears.reduce((sum, y) => sum + y.parhyangan, 0) / count;
    const avgPawongan = validYears.reduce((sum, y) => sum + y.pawongan, 0) / count;
    const avgPalemahan = validYears.reduce((sum, y) => sum + y.palemahan, 0) / count;

    // Hitung rata-rata pertumbuhan pendapatan & belanja (YoY Growth Rate)
    let sumGrowthRev = 0;
    let sumGrowthExp = 0;
    let growthCount = 0;

    for (let i = 1; i < historical3Years.length; i++) {
      const prev = historical3Years[i - 1];
      const curr = historical3Years[i];
      if (prev.pendapatan > 0 && curr.pendapatan > 0) {
        sumGrowthRev += ((curr.pendapatan - prev.pendapatan) / prev.pendapatan) * 100;
      }
      if (prev.belanja > 0 && curr.belanja > 0) {
        sumGrowthExp += ((curr.belanja - prev.belanja) / prev.belanja) * 100;
        growthCount++;
      }
    }

    const avgGrowthRev = growthCount > 0 ? (sumGrowthRev / growthCount) : 5.0; // default 5%
    const avgGrowthExp = growthCount > 0 ? (sumGrowthExp / growthCount) : 4.5;

    return {
      avgPendapatan,
      avgBelanja,
      avgSurplus,
      avgInsentif,
      avgOperasional,
      avgParhyangan,
      avgPawongan,
      avgPalemahan,
      avgGrowthRev,
      avgGrowthExp,
      validYearsCount: validYears.length
    };
  }, [historical3Years]);

  // Baseline Proyeksi Deterministik Cerdas (Tampil Instan sebelum AI selesai)
  const deterministicProjection: AiProjectionResult = useMemo(() => {
    // Pengali skenario
    let revMultiplier = 1.05; // moderat default +5%
    let expMultiplier = 1.05;

    if (scenario === 'konservatif') {
      revMultiplier = 1.00; // konservatif: pendapatan stagnan
      expMultiplier = 0.96; // efisiensi belanja -4%
    } else if (scenario === 'optimis') {
      revMultiplier = 1.10; // optimis: pendapatan +10%
      expMultiplier = 1.07; // belanja +7%
    }

    // Ambil basis nilai dari tahun terakhir atau rata-rata jika tahun terakhir kosong
    const latestHistorical = historical3Years[historical3Years.length - 1];
    const baseRev = latestHistorical.pendapatan > 0 ? latestHistorical.pendapatan : stats3Years.avgPendapatan;
    const baseExp = latestHistorical.belanja > 0 ? latestHistorical.belanja : stats3Years.avgBelanja;

    const projectedRevenue = Math.round(baseRev * revMultiplier);
    const projectedExpense = Math.round(baseExp * expMultiplier);
    const projectedSilpa = projectedRevenue - projectedExpense;

    // Alokasi proporsional pos belanja
    const totalPosBase = (stats3Years.avgInsentif + stats3Years.avgOperasional + stats3Years.avgParhyangan + stats3Years.avgPawongan + stats3Years.avgPalemahan) || 1;
    
    // Normalisasi bobot default khas APB Desa Adat Bali
    const weightParhyangan = stats3Years.avgParhyangan > 0 ? (stats3Years.avgParhyangan / totalPosBase) : 0.38;
    const weightInsentif = stats3Years.avgInsentif > 0 ? (stats3Years.avgInsentif / totalPosBase) : 0.20;
    const weightOperasional = stats3Years.avgOperasional > 0 ? (stats3Years.avgOperasional / totalPosBase) : 0.14;
    const weightPawongan = stats3Years.avgPawongan > 0 ? (stats3Years.avgPawongan / totalPosBase) : 0.16;
    const weightPalemahan = stats3Years.avgPalemahan > 0 ? (stats3Years.avgPalemahan / totalPosBase) : 0.12;

    const allocParhyangan = Math.round(projectedExpense * weightParhyangan);
    const allocInsentif = Math.round(projectedExpense * weightInsentif);
    const allocOperasional = Math.round(projectedExpense * weightOperasional);
    const allocPawongan = Math.round(projectedExpense * weightPawongan);
    const allocPalemahan = Math.round(projectedExpense * weightPalemahan);

    const growthRevPct = ((projectedRevenue - baseRev) / (baseRev || 1)) * 100;
    const growthExpPct = ((projectedExpense - baseExp) / (baseExp || 1)) * 100;

    return {
      ringkasanAnalisis: `Proyeksi Anggaran TA ${projectionYear} disusun berdasarkan tren realisasi 3 tahun terakhir (${targetThreeYears.join(', ')}). Rata-rata penerimaan tahunan tercatat ${formatCurrency(stats3Years.avgPendapatan)} dengan rata-rata belanja ${formatCurrency(stats3Years.avgBelanja)}. Dengan pendekatan ${scenario.toUpperCase()}, total pendapatan diproyeksikan mencapai ${formatCurrency(projectedRevenue)} dan pagu belanja ${formatCurrency(projectedExpense)}, menghasilkan potensi cadangan SiLPA sebesar ${formatCurrency(projectedSilpa)}.`,
      proyeksiPendapatan: {
        total: projectedRevenue,
        pertumbuhanPersen: Number(growthRevPct.toFixed(1)),
        rincian: [
          { nama: 'BKK / Hibah Provinsi & Kabupaten Bali', nominal: Math.round(projectedRevenue * 0.58), alasan: 'Alokasi bantuan keuangan khusus pemerintah provinsi/kabupaten yang stabil' },
          { nama: 'Pendapatan Asli Desa Adat & Dana Punia', nominal: Math.round(projectedRevenue * 0.32), alasan: 'Penerimaan sukarela krama, dana punia piodalan, dan urunan upacara' },
          { nama: 'Pendapatan Usaha Adat, Bunga LPD & Lain-lain', nominal: Math.round(projectedRevenue * 0.10), alasan: 'Bagi hasil LPD, sewa wantilan/aset adat, dan jasa giro' }
        ]
      },
      proyeksiBelanja: {
        total: projectedExpense,
        pertumbuhanPersen: Number(growthExpPct.toFixed(1)),
        rincian: [
          { kode: '5.2', nama: 'Program Parhyangan (Aci, Piodalan & Pelestarian Pura)', nominal: allocParhyangan, persenAlokasi: Number((weightParhyangan * 100).toFixed(1)), justifikasi: 'Menjamin kelancaran piodalan rutin, pemeliharaan pura khayangan tiga, dan sarana upakara' },
          { kode: '5.1.1', nama: 'Beban Insentif Prajuru, Serati & Petugas Adat', nominal: allocInsentif, persenAlokasi: Number((weightInsentif * 100).toFixed(1)), justifikasi: 'Kesejahteraan prajuru adat, pecalang, pemangku, serati banten, dan staf administrasi' },
          { kode: '5.3', nama: 'Program Pawongan (Pasraman, Seni Tari & Kesejahteraan Krama)', nominal: allocPawongan, persenAlokasi: Number((weightPawongan * 100).toFixed(1)), justifikasi: 'Pelestarian seni wali, pembinaan sekaa teruna, pesantian, serta dana duka kematian krama' },
          { kode: '5.1.2', nama: 'Belanja Operasional Kantor & Kesekretariatan', nominal: allocOperasional, persenAlokasi: Number((weightOperasional * 100).toFixed(1)), justifikasi: 'Kebutuhan ATK, konsumsi paruman adat, langganan internet, listrik, dan rapat dinas' },
          { kode: '5.4', nama: 'Program Palemahan (Kebersihan Lingkungan, Wantilan & Setra)', nominal: allocPalemahan, persenAlokasi: Number((weightPalemahan * 100).toFixed(1)), justifikasi: 'Pengelolaan sampah terpadu banjar adat, pemeliharaan wantilan, dan penataan setra adat' }
        ]
      },
      proyeksiSilpa: projectedSilpa,
      rekomendasiAlokasi: [
        {
          pilar: '1. Prioritas Utama: Anggaran Parhyangan & Dana Aci Piodalan',
          persenAlokasi: Number((weightParhyangan * 100).toFixed(1)),
          nominal: allocParhyangan,
          alasan: 'Ritual keagamaan merupakan pilar sentral adat dengan porsi biaya terbesar yang harus dijamin ketersediaan dananya sejak awal tahun.',
          langkahImplementasi: 'Buat kalender upakara setahun penuh dan amankan pagu aci sebelum melaksanakan belanja fisik atau program sekunder.'
        },
        {
          pilar: '2. Penguatan Insentif & Kinerja Prajuru / Pecalang',
          persenAlokasi: Number((weightInsentif * 100).toFixed(1)),
          nominal: allocInsentif,
          alasan: 'Mempertahankan konsistensi pelayanan adat, keamanan banjar oleh pecalang, dan akuntabilitas pencatatan keuangan.',
          langkahImplementasi: 'Tertibkan penyaluran insentif secara terjadwal bulanan melalui rekening bank/LPD desa adat.'
        },
        {
          pilar: '3. Edukasi Budaya & Kepemudaan (Program Pawongan)',
          persenAlokasi: Number((weightPawongan * 100).toFixed(1)),
          nominal: allocPawongan,
          alasan: 'Mencegah degradasi budaya pada generasi muda melalui penguatan pasraman kilat, bulan bahasa Bali, dan sekaa gong/tari.',
          langkahImplementasi: 'Kolaborasikan kegiatan pasraman saat libur sekolah dengan pendanaan dari pos 5.3.'
        },
        {
          pilar: '4. Pembentukan Cadangan Kas Darurat Upakara (SiLPA Safeguard)',
          persenAlokasi: Math.max(5, Math.round((projectedSilpa / projectedRevenue) * 100)),
          nominal: Math.max(projectedSilpa, Math.round(projectedRevenue * 0.05)),
          alasan: 'Menjaga likuiditas kas desa adat saat terjadi karya agung mendadak atau keterlambatan pencairan dana hibah BKK.',
          langkahImplementasi: 'Sisihkan minimal 5-10% penerimaan ke rekening tabungan khusus cadangan kas tidak terikat di LPD/Bank.'
        }
      ],
      mitigasiRisiko: [
        'Keterlambatan Pencairan Hibah BKK: Antisipasi dengan cadangan kas awal tahun minimal setara 2 bulan biaya operasional rutin.',
        'Lonjakan Harga Bahan Upakara (Banten & Wewalungan): Terapkan sistem kontrak pengadaan atau belanja banten terencana pada paruman piodalan.',
        'Fluktuasi Penerimaan Dana Punia: Jangan gunakan estimasi dana punia untuk membiayai belanja wajib/tetap (insentif prajuru).'
      ],
      arahanKebijakanPrajuru: [
        'Tetapkan RAPB Desa Adat selambat-lambatnya bulan Desember sebelum tahun anggaran berjalan.',
        'Lakukan evaluasi penyerapan anggaran per triwulan dalam Pesangkepan Prajuru Adat.',
        'Prioritaskan transparansi anggaran kepada Krama melalui papan informasi dan Ringkasan Eksekutif ini.'
      ],
      generatedAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      modelUsed: 'Formula Prediktif Deterministik',
      scenario
    };
  }, [scenario, historical3Years, stats3Years, projectionYear, targetThreeYears]);

  // Key untuk penyimpanan lokal
  const cacheKey = `${STORAGE_KEY_PREFIX}${anchorYear}_${scenario}`;

  // Membaca cache penyimpanan lokal saat komponen dimuat atau anchorYear/scenario berubah
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.proyeksiPendapatan && parsed.proyeksiBelanja) {
          setStoredAiResult(parsed);
          return;
        }
      }
      setStoredAiResult(null);
    } catch {
      setStoredAiResult(null);
    }
  }, [cacheKey]);

  // Hasil aktif yang ditampilkan (Prioritas: Hasil AI Gemini > Hasil Deterministik)
  const activeProjection: AiProjectionResult = storedAiResult || deterministicProjection;

  // Handler Generator AI Gemini
  const handleGenerateAiProjection = async () => {
    setIsLoadingAi(true);
    setRetryNotice(null);

    const promptText = `Anda adalah Ahli Perencanaan Anggaran & Keuangan Desa Adat Bali berpengalaman tinggi.
Tugas Anda adalah melakukan ANALISIS TREN HISTORIS 3 TAHUN TERAKHIR dan menyusun PROYEKSI ANGGARAN & REKOMENDASI ALOKASI DANA untuk Tahun Anggaran ${projectionYear} (Skenario: ${scenario.toUpperCase()}) bagi Desa Adat Basangalas.

DATA HISTORIS 3 TAHUN TERAKHIR (${targetThreeYears.join(', ')}):
${historical3Years.map(h => `- TA ${h.year}: Pendapatan Realisasi = ${formatCurrency(h.pendapatan)}, Belanja Realisasi = ${formatCurrency(h.belanja)}, Surplus/Defisit = ${formatCurrency(h.surplusDefisit)} (Rincian Belanja: Insentif=${formatCurrency(h.insentif)}, Operasional=${formatCurrency(h.operasional)}, Parhyangan=${formatCurrency(h.parhyangan)}, Pawongan=${formatCurrency(h.pawongan)}, Palemahan=${formatCurrency(h.palemahan)})`).join('\n')}

METRIK RATA-RATA 3 TAHUN:
- Rerata Pendapatan: ${formatCurrency(stats3Years.avgPendapatan)} (Pertumbuhan Tren: ${stats3Years.avgGrowthRev.toFixed(1)}%)
- Rerata Belanja: ${formatCurrency(stats3Years.avgBelanja)} (Pertumbuhan Tren: ${stats3Years.avgGrowthExp.toFixed(1)}%)
- Rerata Pos Parhyangan: ${formatCurrency(stats3Years.avgParhyangan)}
- Rerata Pos Insentif: ${formatCurrency(stats3Years.avgInsentif)}
- Rerata Pos Pawongan: ${formatCurrency(stats3Years.avgPawongan)}
- Rerata Pos Palemahan: ${formatCurrency(stats3Years.avgPalemahan)}

INSTRUKSI:
Berikan output DALAM FORMAT JSON VALID yang persis mengikuti skema di bawah ini tanpa teks pengantar atau penutup lain:
\`\`\`json
{
  "ringkasanAnalisis": "Analisis mendalam mengapa angka proyeksi ini dipilih berdasarkan tren 3 tahun...",
  "proyeksiPendapatan": {
    "total": 350000000,
    "pertumbuhanPersen": 5.2,
    "rincian": [
      { "nama": "BKK / Bantuan Keuangan Khusus Provinsi & Kabupaten", "nominal": 200000000, "alasan": "..." },
      { "nama": "Pendapatan Asli Desa Adat & Dana Punia", "nominal": 120000000, "alasan": "..." },
      { "nama": "Pendapatan Lain-lain & Bagi Hasil LPD", "nominal": 30000000, "alasan": "..." }
    ]
  },
  "proyeksiBelanja": {
    "total": 320000000,
    "pertumbuhanPersen": 4.8,
    "rincian": [
      { "kode": "5.2", "nama": "Program Parhyangan (Aci, Piodalan & Pura)", "nominal": 125000000, "persenAlokasi": 39.0, "justifikasi": "..." },
      { "kode": "5.1.1", "nama": "Beban Insentif Prajuru, Serati & Pecalang", "nominal": 65000000, "persenAlokasi": 20.3, "justifikasi": "..." },
      { "kode": "5.3", "nama": "Program Pawongan (Pasraman, Seni & Santunan Kematian)", "nominal": 50000000, "persenAlokasi": 15.6, "justifikasi": "..." },
      { "kode": "5.1.2", "nama": "Belanja Operasional Kantor & Rapat Paruman", "nominal": 45000000, "persenAlokasi": 14.1, "justifikasi": "..." },
      { "kode": "5.4", "nama": "Program Palemahan (Lingkungan, Sampah & Wantilan)", "nominal": 35000000, "persenAlokasi": 11.0, "justifikasi": "..." }
    ]
  },
  "proyeksiSilpa": 30000000,
  "rekomendasiAlokasi": [
    {
      "pilar": "1. Prioritas Utama: ...",
      "persenAlokasi": 39.0,
      "nominal": 125000000,
      "alasan": "...",
      "langkahImplementasi": "..."
    },
    {
      "pilar": "2. ...",
      "persenAlokasi": 20.3,
      "nominal": 65000000,
      "alasan": "...",
      "langkahImplementasi": "..."
    },
    {
      "pilar": "3. ...",
      "persenAlokasi": 15.6,
      "nominal": 50000000,
      "alasan": "...",
      "langkahImplementasi": "..."
    },
    {
      "pilar": "4. Cadangan Kas Tak Terduga (Safety Buffer)",
      "persenAlokasi": 9.4,
      "nominal": 30000000,
      "alasan": "...",
      "langkahImplementasi": "..."
    }
  ],
  "mitigasiRisiko": [
    "Poin risiko 1 dan cara mitigasinya...",
    "Poin risiko 2...",
    "Poin risiko 3..."
  ],
  "arahanKebijakanPrajuru": [
    "Arahan kebijakan 1 untuk Paruman...",
    "Arahan kebijakan 2..."
  ]
}
\`\`\``;

    try {
      const response = await generateContentWithFallback({
        prompt: promptText,
        systemInstruction: 'Anda adalah konsultan ahli tata kelola keuangan Desa Adat Bali. Kembalikan HANYA JSON valid sesuai format permintaan.',
        onRetryNotice: (msg) => setRetryNotice(msg)
      });

      const rawText = response.text || '';
      // Ekstrak JSON
      let jsonStr = rawText;
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      }

      const parsedData = JSON.parse(jsonStr.trim());

      const fullResult: AiProjectionResult = {
        ringkasanAnalisis: parsedData.ringkasanAnalisis || deterministicProjection.ringkasanAnalisis,
        proyeksiPendapatan: {
          total: Number(parsedData.proyeksiPendapatan?.total) || deterministicProjection.proyeksiPendapatan.total,
          pertumbuhanPersen: Number(parsedData.proyeksiPendapatan?.pertumbuhanPersen) || deterministicProjection.proyeksiPendapatan.pertumbuhanPersen,
          rincian: Array.isArray(parsedData.proyeksiPendapatan?.rincian) ? parsedData.proyeksiPendapatan.rincian : deterministicProjection.proyeksiPendapatan.rincian
        },
        proyeksiBelanja: {
          total: Number(parsedData.proyeksiBelanja?.total) || deterministicProjection.proyeksiBelanja.total,
          pertumbuhanPersen: Number(parsedData.proyeksiBelanja?.pertumbuhanPersen) || deterministicProjection.proyeksiBelanja.pertumbuhanPersen,
          rincian: Array.isArray(parsedData.proyeksiBelanja?.rincian) ? parsedData.proyeksiBelanja.rincian : deterministicProjection.proyeksiBelanja.rincian
        },
        proyeksiSilpa: Number(parsedData.proyeksiSilpa) || (parsedData.proyeksiPendapatan?.total - parsedData.proyeksiBelanja?.total) || deterministicProjection.proyeksiSilpa,
        rekomendasiAlokasi: Array.isArray(parsedData.rekomendasiAlokasi) ? parsedData.rekomendasiAlokasi : deterministicProjection.rekomendasiAlokasi,
        mitigasiRisiko: Array.isArray(parsedData.mitigasiRisiko) ? parsedData.mitigasiRisiko : deterministicProjection.mitigasiRisiko,
        arahanKebijakanPrajuru: Array.isArray(parsedData.arahanKebijakanPrajuru) ? parsedData.arahanKebijakanPrajuru : deterministicProjection.arahanKebijakanPrajuru,
        generatedAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        modelUsed: response.modelUsed || GEMINI_MODEL_TEXT,
        scenario
      };

      setStoredAiResult(fullResult);
      localStorage.setItem(cacheKey, JSON.stringify(fullResult));
      showNotification('Proyeksi Anggaran AI berhasil dihitung & dioptimalkan!', 'success');
    } catch (err: any) {
      console.warn('Gagal memproses JSON Gemini API, menggunakan kalkulasi deterministik:', err);
      // Simpan kalkulasi deterministik dengan stempel waktu
      const fallbackResult: AiProjectionResult = {
        ...deterministicProjection,
        modelUsed: `${GEMINI_MODEL_TEXT} (Formula Standar Keuangan Desa Adat)`,
        generatedAt: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      };
      setStoredAiResult(fallbackResult);
      localStorage.setItem(cacheKey, JSON.stringify(fallbackResult));
      showNotification('Proyeksi Anggaran berhasil dihitung menggunakan formula statistik keuangan adat.', 'info');
    } finally {
      setIsLoadingAi(false);
      setRetryNotice(null);
    }
  };

  // Salin ringkasan proyeksi ke clipboard
  const handleCopyProjection = () => {
    const text = `PROYEKSI ANGGARAN & REKOMENDASI ALOKASI DANA TA ${projectionYear}
DESA ADAT BASANGALAS
Skenario: ${scenario.toUpperCase()} | Model AI: ${activeProjection.modelUsed}

1. RINGKASAN PROYEKSI UTAMA:
- Proyeksi Pendapatan: ${formatCurrency(activeProjection.proyeksiPendapatan.total)} (${activeProjection.proyeksiPendapatan.pertumbuhanPersen >= 0 ? '+' : ''}${activeProjection.proyeksiPendapatan.pertumbuhanPersen}% YoY)
- Proyeksi Pagu Belanja: ${formatCurrency(activeProjection.proyeksiBelanja.total)} (${activeProjection.proyeksiBelanja.pertumbuhanPersen >= 0 ? '+' : ''}${activeProjection.proyeksiBelanja.pertumbuhanPersen}% YoY)
- Proyeksi Cadangan SiLPA: ${formatCurrency(activeProjection.proyeksiSilpa)}

2. REKOMENDASI ALOKASI DANA STRATEGIS:
${activeProjection.rekomendasiAlokasi.map((r, i) => `${i + 1}. ${r.pilar}: ${formatCurrency(r.nominal)} (${r.persenAlokasi}%)\n   Alasan: ${r.alasan}\n   Langkah: ${r.langkahImplementasi}`).join('\n\n')}

3. MITIGASI RISIKO FINANSIAL:
${activeProjection.mitigasiRisiko.map((m, i) => `• ${m}`).join('\n')}

Dibuat otomatis oleh Sistem Keuangan Cerdas Desa Adat (${activeProjection.generatedAt})`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showNotification('Ringkasan Proyeksi Anggaran AI berhasil disalin!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Data komparasi 4 tahun (3 tahun historis + 1 tahun proyeksi AI) untuk Recharts BarChart
  const chartData = useMemo(() => {
    const historical = historical3Years.map((h) => ({
      name: `TA ${h.year}`,
      year: h.year,
      pendapatan: h.pendapatan,
      belanja: h.belanja,
      silpa: h.surplusDefisit,
      isProjection: false
    }));

    const projected = {
      name: `Proyeksi ${projectionYear} (AI)`,
      year: projectionYear,
      pendapatan: activeProjection.proyeksiPendapatan.total,
      belanja: activeProjection.proyeksiBelanja.total,
      silpa: activeProjection.proyeksiSilpa,
      isProjection: true
    };

    return [...historical, projected];
  }, [historical3Years, projectionYear, activeProjection]);

  return (
    <div
      id="budget-projection-ai-section"
      className="bg-white rounded-2xl border-2 border-indigo-200 shadow-md p-6 transition-all relative overflow-hidden"
    >
      {/* Decorative Gradient Background Aura */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-bl from-indigo-100/60 via-purple-50/40 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none blur-2xl" />

      {/* --- HEADER FITUR PROYEKSI AI --- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-indigo-100 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-linear-to-br from-indigo-600 to-purple-600 text-white rounded-2xl shadow-sm shrink-0">
            <Sparkles size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight font-serif">
                Proyeksi Anggaran Mendatang &amp; Rekomendasi Alokasi Dana
              </h3>
              <span className="bg-linear-to-r from-indigo-600 to-purple-600 text-white text-[11px] font-black font-mono px-2.5 py-0.5 rounded-full shadow-2xs">
                Gemini AI Forecast
              </span>
              <span className="bg-indigo-100 text-indigo-900 text-[11px] font-bold px-2 py-0.5 rounded-md border border-indigo-300">
                RAPB TA {projectionYear}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Analisis cerdas tren realisasi 3 tahun terakhir ({targetThreeYears.join(', ')}) untuk menyusun estimasi pendapatan, pagu belanja, dan rekomendasi alokasi dana periode berikutnya.
            </p>
          </div>
        </div>

        {/* Kontrol Aksi: Selector Tahun, Skenario, & Tombol Analisis AI */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto no-print">
          {/* Pilih Tahun Acuan (Anchor Year) */}
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300">
            <Calendar size={14} className="text-indigo-600" />
            <span className="text-[11px] text-slate-600 font-mono">Tahun Basis:</span>
            <select
              value={anchorYear}
              onChange={(e) => setAnchorYear(Number(e.target.value))}
              className="bg-transparent text-slate-900 font-black focus:outline-none cursor-pointer text-xs"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  TA {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Skenario Proyeksi */}
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300">
            <Sliders size={14} className="text-purple-600" />
            <span className="text-[11px] text-slate-600 font-mono">Skenario:</span>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as any)}
              className="bg-transparent text-slate-900 font-black focus:outline-none cursor-pointer text-xs"
            >
              <option value="moderat">Moderat (Seimbang)</option>
              <option value="konservatif">Konservatif (Hemat & Kas)</option>
              <option value="optimis">Optimis (Ekspansi Program)</option>
            </select>
          </div>

          {/* Tombol Analisis AI */}
          <button
            type="button"
            onClick={handleGenerateAiProjection}
            disabled={isLoadingAi}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            title="Jalankan analisis mendalam menggunakan Gemini AI"
          >
            <RefreshCw size={14} className={isLoadingAi ? 'animate-spin' : ''} />
            <span>{isLoadingAi ? 'Menganalisis...' : 'Analisis AI'}</span>
          </button>

          {/* Tombol Salin */}
          <button
            type="button"
            onClick={handleCopyProjection}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-300 cursor-pointer"
            title="Salin ringkasan proyeksi dan rekomendasi alokasi"
          >
            {isCopied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
          </button>

          {/* Tombol Cetak / PDF */}
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-300 cursor-pointer"
            title="Cetak proyeksi ini"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* Notice Banner jika Server AI Sedang Menunggu Retry */}
      {retryNotice && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span>{retryNotice}</span>
        </div>
      )}

      {/* --- 4 KARTU METRIK UTAMA PROYEKSI TA {projectionYear} --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Card 1: Proyeksi Pendapatan */}
        <div className="bg-emerald-50/80 p-4 rounded-xl border-2 border-emerald-300 hover:border-emerald-500 transition-all shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight size={16} className="text-emerald-700" /> Proyeksi Pendapatan
            </span>
            <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full border border-emerald-400">
              TA {projectionYear}
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-900 font-mono tracking-tight my-1">
            {formatCurrency(activeProjection.proyeksiPendapatan.total)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-emerald-900 mt-2 pt-2 border-t border-emerald-200 font-semibold">
            <span>Estimasi Pertumbuhan:</span>
            <span className="font-mono font-bold bg-emerald-200/80 px-1.5 py-0.5 rounded">
              {activeProjection.proyeksiPendapatan.pertumbuhanPersen >= 0 ? '+' : ''}
              {activeProjection.proyeksiPendapatan.pertumbuhanPersen}% YoY
            </span>
          </div>
        </div>

        {/* Card 2: Proyeksi Belanja */}
        <div className="bg-rose-50/80 p-4 rounded-xl border-2 border-rose-300 hover:border-rose-500 transition-all shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft size={16} className="text-rose-700" /> Proyeksi Pagu Belanja
            </span>
            <span className="text-[10px] font-mono font-bold bg-rose-200 text-rose-950 px-2 py-0.5 rounded-full border border-rose-400">
              Alokasi APB
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-900 font-mono tracking-tight my-1">
            {formatCurrency(activeProjection.proyeksiBelanja.total)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-rose-900 mt-2 pt-2 border-t border-rose-200 font-semibold">
            <span>Kebutuhan Belanja:</span>
            <span className="font-mono font-bold bg-rose-200/80 px-1.5 py-0.5 rounded">
              {activeProjection.proyeksiBelanja.pertumbuhanPersen >= 0 ? '+' : ''}
              {activeProjection.proyeksiBelanja.pertumbuhanPersen}% YoY
            </span>
          </div>
        </div>

        {/* Card 3: Proyeksi SiLPA / Surplus Operasional Terencana */}
        <div className="bg-indigo-50/80 p-4 rounded-xl border-2 border-indigo-300 hover:border-indigo-500 transition-all shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <Scale size={16} className="text-indigo-700" /> Proyeksi SiLPA / Surplus
            </span>
            <span className="text-[10px] font-mono font-bold bg-indigo-200 text-indigo-950 px-2 py-0.5 rounded-full border border-indigo-400">
              Terencana
            </span>
          </div>
          <p className={`text-xl sm:text-2xl font-black font-mono tracking-tight my-1 ${activeProjection.proyeksiSilpa >= 0 ? 'text-indigo-900' : 'text-amber-900'}`}>
            {formatCurrency(activeProjection.proyeksiSilpa)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-indigo-900 mt-2 pt-2 border-t border-indigo-200 font-semibold">
            <span>Rasio Cadangan Kas:</span>
            <span className="font-mono font-bold bg-indigo-200/80 px-1.5 py-0.5 rounded">
              {activeProjection.proyeksiPendapatan.total > 0
                ? `${((activeProjection.proyeksiSilpa / activeProjection.proyeksiPendapatan.total) * 100).toFixed(1)}%`
                : '0.0%'}
            </span>
          </div>
        </div>

        {/* Card 4: Model Status & Rekomendasi Alokasi Terbanyak */}
        <div className="bg-purple-50/80 p-4 rounded-xl border-2 border-purple-300 hover:border-purple-500 transition-all shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <Target size={16} className="text-purple-700" /> Prioritas Alokasi #1
              </span>
              <span className="text-[10px] font-mono font-bold bg-purple-200 text-purple-950 px-2 py-0.5 rounded-full border border-purple-400">
                Pilar Utama
              </span>
            </div>
            <p className="text-base font-black text-purple-900 tracking-tight my-1 line-clamp-1">
              {activeProjection.rekomendasiAlokasi[0]?.pilar.split(':')[1] || 'Program Parhyangan'}
            </p>
            <p className="text-[11px] text-purple-800 leading-tight">
              Porsi Alokasi: <strong className="font-mono">{activeProjection.rekomendasiAlokasi[0]?.persenAlokasi || 38}%</strong> dari Pagu Belanja
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between text-[10px] font-mono text-purple-900">
            <span>Engine: {activeProjection.modelUsed.includes('flash') ? 'Gemini AI' : 'Statistik'}</span>
            <span className="font-bold uppercase">{scenario}</span>
          </div>
        </div>
      </div>

      {/* --- TAB VIEW CONTROLS --- */}
      <div className="flex items-center gap-2 mt-6 border-b border-slate-200 pb-2 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Visualisasi Tren 3 Tahun vs Proyeksi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('breakdown')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'breakdown'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Rincian Proyeksi Pos APB
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recommendations')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'recommendations'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Rekomendasi Alokasi Strategis ({activeProjection.rekomendasiAlokasi.length})
        </button>
      </div>

      {/* --- TAB 1: VISUALISASI TREN HISTORIS 3 TAHUN VS PROYEKSI AI --- */}
      {activeTab === 'overview' && (
        <div className="mt-5">
          {/* Narasi Ringkasan AI */}
          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 mb-5 text-xs text-slate-800 leading-relaxed">
            <div className="flex items-center gap-2 mb-1.5 font-bold text-indigo-900 font-mono text-[11px] uppercase tracking-wider">
              <Sparkles size={14} className="text-indigo-600" />
              <span>Narasi Analisis Tren &amp; Dasar Proyeksi:</span>
            </div>
            <p>{activeProjection.ringkasanAnalisis}</p>
          </div>

          {/* Bar Chart Komparasi 4 Tahun (3 Historis + 1 Proyeksi) */}
          <div className="h-72 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => {
                    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
                    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}Jt`;
                    return String(val);
                  }}
                />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    formatCurrency(Number(val)),
                    name === 'pendapatan' ? 'Pendapatan' : name === 'belanja' ? 'Belanja' : 'Surplus / SiLPA'
                  ]}
                  labelFormatter={(label) => `Periode: ${label}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    borderColor: '#cbd5e1',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '11px'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) => {
                    if (value === 'pendapatan') return 'Pendapatan (Riil / Proyeksi)';
                    if (value === 'belanja') return 'Belanja (Riil / Pagu)';
                    return 'Surplus / SiLPA';
                  }}
                />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="pendapatan" fill="#059669" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-rev-${index}`}
                      fill={entry.isProjection ? '#10b981' : '#047857'}
                      stroke={entry.isProjection ? '#065f46' : 'none'}
                      strokeWidth={entry.isProjection ? 1.5 : 0}
                      strokeDasharray={entry.isProjection ? '4 2' : 'none'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="belanja" fill="#e11d48" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-exp-${index}`}
                      fill={entry.isProjection ? '#f43f5e' : '#be123c'}
                      stroke={entry.isProjection ? '#881337' : 'none'}
                      strokeWidth={entry.isProjection ? 1.5 : 0}
                      strokeDasharray={entry.isProjection ? '4 2' : 'none'}
                    />
                  ))}
                </Bar>
                <Bar dataKey="silpa" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-silpa-${index}`}
                      fill={entry.isProjection ? '#818cf8' : '#4f46e5'}
                      stroke={entry.isProjection ? '#3730a3' : 'none'}
                      strokeWidth={entry.isProjection ? 1.5 : 0}
                      strokeDasharray={entry.isProjection ? '4 2' : 'none'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Solid: Realisasi Historis 3 Tahun
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-700 inline-block ml-3" /> Berpola / Bergaris: Rekomendasi Proyeksi Mendatang
            </span>
            <span>Anchor: TA {anchorYear} &rarr; Target: TA {projectionYear}</span>
          </div>
        </div>
      )}

      {/* --- TAB 2: RINCIAN POS PROYEKSI APB DESA ADAT --- */}
      {activeTab === 'breakdown' && (
        <div className="mt-5 space-y-5">
          {/* Rincian Pos Belanja yang Direkomendasikan */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono mb-2 flex items-center gap-1.5">
              <ArrowDownLeft size={15} className="text-rose-600" /> Rincian Rekomendasi Pagu Belanja (Akun 5.x)
            </h4>
            <div className="overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Kode</th>
                    <th className="p-2.5">Nama Pos Belanja</th>
                    <th className="p-2.5 text-right">Rekomendasi Pagu</th>
                    <th className="p-2.5 text-center">Porsi (%)</th>
                    <th className="p-2.5">Justifikasi Perencanaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeProjection.proyeksiBelanja.rincian.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {item.kode || `5.${idx + 1}`}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {item.nama}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-rose-900 whitespace-nowrap">
                        {formatCurrency(item.nominal)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="bg-rose-100 text-rose-900 font-mono font-bold px-2 py-0.5 rounded-full border border-rose-200 text-[10px]">
                          {item.persenAlokasi ? `${item.persenAlokasi}%` : '-'}
                        </span>
                      </td>
                      <td className="p-2.5 text-[11px] text-slate-600 leading-tight">
                        {item.justifikasi || item.alasan || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-rose-50/70 font-black border-t-2 border-rose-300 text-rose-950 font-mono text-xs">
                  <tr>
                    <td colSpan={2} className="p-2.5 text-left uppercase">
                      Total Rekomendasi Pagu Belanja TA {projectionYear}
                    </td>
                    <td className="p-2.5 text-right font-black text-sm">
                      {formatCurrency(activeProjection.proyeksiBelanja.total)}
                    </td>
                    <td className="p-2.5 text-center">100%</td>
                    <td className="p-2.5 text-[10px] font-normal text-slate-600">Estimasi Kebutuhan Belanja Tahunan</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Rincian Pos Pendapatan Proyeksi */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono mb-2 flex items-center gap-1.5">
              <ArrowUpRight size={15} className="text-emerald-600" /> Estimasi Sumber Pendapatan (Akun 4.x &amp; 7.x)
            </h4>
            <div className="overflow-x-auto border border-slate-300 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Sumber Penerimaan</th>
                    <th className="p-2.5 text-right">Estimasi Nominal</th>
                    <th className="p-2.5 text-center">Porsi (%)</th>
                    <th className="p-2.5">Dasar Estimasi Tren</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeProjection.proyeksiPendapatan.rincian.map((item, idx) => {
                    const pct = activeProjection.proyeksiPendapatan.total > 0
                      ? ((item.nominal / activeProjection.proyeksiPendapatan.total) * 100).toFixed(1)
                      : '0';
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-semibold text-slate-900">
                          {item.nama}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-900 whitespace-nowrap">
                          {formatCurrency(item.nominal)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="bg-emerald-100 text-emerald-900 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                            {pct}%
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600 leading-tight">
                          {item.alasan || item.justifikasi || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-emerald-50/70 font-black border-t-2 border-emerald-300 text-emerald-950 font-mono text-xs">
                  <tr>
                    <td className="p-2.5 text-left uppercase">
                      Total Target Pendapatan Proyeksi TA {projectionYear}
                    </td>
                    <td className="p-2.5 text-right font-black text-sm">
                      {formatCurrency(activeProjection.proyeksiPendapatan.total)}
                    </td>
                    <td className="p-2.5 text-center">100%</td>
                    <td className="p-2.5 text-[10px] font-normal text-slate-600">Estimasi Penerimaan Masuk Kas</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: REKOMENDASI ALOKASI STRATEGIS & MITIGASI RISIKO --- */}
      {activeTab === 'recommendations' && (
        <div className="mt-5 space-y-5">
          {/* Kartu Prioritas Alokasi Dana */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProjection.rekomendasiAlokasi.map((rec, index) => (
              <div
                key={index}
                className="bg-slate-50/80 p-4 rounded-xl border border-indigo-200 hover:border-indigo-400 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-tight line-clamp-1">
                      {rec.pilar}
                    </span>
                    <span className="text-xs font-mono font-black bg-indigo-200 text-indigo-950 px-2 py-0.5 rounded-full border border-indigo-400 shrink-0">
                      {rec.persenAlokasi}% Alokasi
                    </span>
                  </div>
                  <p className="text-lg font-black font-mono text-slate-900 mb-2">
                    {formatCurrency(rec.nominal)}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed mb-3">
                    {rec.alasan}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-indigo-950 bg-indigo-50/50 p-2 rounded-lg">
                  <strong className="font-semibold block mb-0.5 text-indigo-900">Langkah Implementasi:</strong>
                  <span>{rec.langkahImplementasi}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bagian Mitigasi Risiko & Arahan Prajuru */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Mitigasi Risiko Finansial */}
            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-300">
              <h5 className="text-xs font-black uppercase tracking-wider text-amber-950 font-mono mb-2.5 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-amber-700" />
                Mitigasi Risiko Finansial Adat
              </h5>
              <ul className="space-y-2 text-xs text-slate-800">
                {activeProjection.mitigasiRisiko.map((m, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0 mt-1.5" />
                    <span className="leading-tight">{m}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Arahan Kebijakan untuk Prajuru */}
            <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-300">
              <h5 className="text-xs font-black uppercase tracking-wider text-teal-950 font-mono mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-teal-700" />
                Arahan Paruman Prajuru &amp; Krama
              </h5>
              <ul className="space-y-2 text-xs text-slate-800">
                {activeProjection.arahanKebijakanPrajuru.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0 mt-1.5" />
                    <span className="leading-tight">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- FOOTER KETERANGAN & TAUTAN KELOLA PAGU --- */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-indigo-600 shrink-0" />
          <span>
            Diperbarui: <strong className="text-slate-800">{activeProjection.generatedAt}</strong> • Engine: <strong className="text-slate-800">{activeProjection.modelUsed}</strong>
          </span>
        </div>

        {setActivePage && (
          <button
            type="button"
            onClick={() => setActivePage('Anggaran')}
            className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-bold hover:underline cursor-pointer no-print"
          >
            <span>Terapkan ke Pagu Anggaran TA {projectionYear}</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default BudgetProjectionAi;
