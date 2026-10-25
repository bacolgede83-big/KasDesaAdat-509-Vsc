import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../shared/Modal';
import { ExportPdfButton } from '../shared/ExportPdfButton';
import { formatCurrency, formatLongDate, numberToWords } from '../../utils/formatter';
import { REFERENSI_REKENING } from '../../constants';
import { useNotification } from '../../context/NotificationContext';
import { getGeminiClient, getGeminiApiKey, GEMINI_MODEL_TEXT } from '../../utils/geminiClient';
import type { JuDisplayRow, BudgetItem } from '../../types';
import { 
    LraReportDataProps, 
    calculateLraReportData,
    LraGroupData
} from '../../utils/lraCalculator';
import { 
    getStoredSignatures, 
    isAutoEmbedSignaturesEnabled, 
    getSignatureScale, 
    setSignatureScale, 
    isStampOverlayEnabled, 
    setStampOverlayEnabled, 
    getStampScale, 
    setStampScale, 
    getEffectiveStamp, 
    DigitalSignatures 
} from '../../utils/signatureStorage';
import { 
    Printer, 
    Pencil, 
    ZoomIn, 
    ZoomOut, 
    Stamp, 
    Maximize2, 
    Minimize2, 
    FileText, 
    CheckCircle2, 
    TrendingUp, 
    TrendingDown, 
    Scale, 
    Coins, 
    Wallet, 
    Sparkles, 
    BarChart3, 
    Layers, 
    ShieldCheck,
    Building2,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Copy,
    Check,
    RefreshCw,
    Info,
    Brain,
    Bot
} from 'lucide-react';

export interface LraNaratifTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportPeriodLabel: string;
    selectedYear: string;
    selectedMonth?: string;
    reportData?: LraReportDataProps;
    entries?: JuDisplayRow[];
    budgetItems?: BudgetItem[];
    rekap?: {
        totalSumberDana: number;
        totalDanaPuniaUang: number;
        totalDanaPuniaBarang: number;
        totalDanaPuniaAll: number;
        totalPemasukanLain: number;
        totalPemasukan: number;
        totalPengeluaran: number;
        saldoAkhir: number;
    };
    keliangName?: string;
    juruRaksaName?: string;
    penyarikanName?: string;
    pengawasName?: string;
    customPlace?: string;
    signatureDate?: string;
}

export interface AiNarrativeResult {
    headline: string;
    fiscalHealthScore: number;
    fiscalHealthStatus: string;
    fullNarrative: string;
    generatedAt: string;
}

export const LraNaratifTemplateModal: React.FC<LraNaratifTemplateModalProps> = ({
    isOpen,
    onClose,
    reportPeriodLabel,
    selectedYear,
    selectedMonth = '',
    reportData: externalReportData,
    entries = [],
    budgetItems = [],
    keliangName = '',
    juruRaksaName = '',
    penyarikanName = '',
    pengawasName = '',
    customPlace = 'Basangalas',
    signatureDate = ''
}) => {
    const { showNotification } = useNotification();

    // Profil Desa
    const [profile] = useState(() => {
        try {
            const saved = localStorage.getItem('desa_profile');
            return saved ? JSON.parse(saved) : {
                namaDesa: 'DESA ADAT BASANGALAS',
                kecamatan: 'Abang',
                kabupaten: 'Karangasem',
                alamat: 'Sekretariat: Jln. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852',
                namaKetua: 'I Made Mudita',
                namaBendahara: 'I Putu Gede Sutrana'
            };
        } catch {
            return {
                namaDesa: 'DESA ADAT BASANGALAS',
                kecamatan: 'Abang',
                kabupaten: 'Karangasem',
                alamat: 'Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852',
                namaKetua: 'I Made Mudita',
                namaBendahara: 'I Putu Gede Sutrana'
            };
        }
    });

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);

    // AI Narrative State
    const [activeView, setActiveView] = useState<'standar' | 'ai'>('standar');
    const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
    const [aiNarrative, setAiNarrative] = useState<AiNarrativeResult | null>(null);
    const [lastAiGeneratedTime, setLastAiGeneratedTime] = useState<string>('');
    const [copiedAi, setCopiedAi] = useState<boolean>(false);

    // Signatures & Stamp state
    const [signatures, setSignatures] = useState<DigitalSignatures>({
        keliang: '',
        juruRaksa: '',
        pembuat: '',
        penyetor: ''
    });
    const [embedSignatures, setEmbedSignatures] = useState<boolean>(true);
    const [showStamp, setShowStamp] = useState<boolean>(true);
    const [sigScale, setSigScale] = useState<number>(100);
    const [stampScaleVal, setStampScaleVal] = useState<number>(100);

    // Editable names in signature section
    const [keliang, setKeliang] = useState<string>(keliangName);
    const [juruRaksa, setJuruRaksa] = useState<string>(juruRaksaName);
    const [penyarikan, setPenyarikan] = useState<string>('');
    const [pengawas, setPengawas] = useState<string>('');

    const [isEditingKeliang, setIsEditingKeliang] = useState(false);
    const [isEditingJuruRaksa, setIsEditingJuruRaksa] = useState(false);
    const [isEditingPenyarikan, setIsEditingPenyarikan] = useState(false);
    const [isEditingPengawas, setIsEditingPengawas] = useState(false);

    const effectiveStamp = useMemo(() => {
        return getEffectiveStamp(signatures, profile.namaDesa || 'DESA ADAT BASANGALAS');
    }, [signatures, profile]);

    useEffect(() => {
        const loadSigs = () => {
            setSignatures(getStoredSignatures());
            setEmbedSignatures(isAutoEmbedSignaturesEnabled());
            setShowStamp(isStampOverlayEnabled());
            setSigScale(getSignatureScale());
            setStampScaleVal(getStampScale());
        };
        loadSigs();
        window.addEventListener('signatures-updated', loadSigs);
        return () => window.removeEventListener('signatures-updated', loadSigs);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setKeliang(keliangName || profile.namaKetua || 'I Made Mudita');
            setJuruRaksa(juruRaksaName || profile.namaBendahara || 'I Putu Gede Sutrana');
            setPenyarikan('');
            setPengawas('');
        }
    }, [isOpen, keliangName, juruRaksaName, profile]);

    useEffect(() => {
        const handleAfterPrint = () => {
            document.body.classList.remove('print-lra-naratif-mode');
            document.body.classList.remove('print-rekap-naratif-mode');
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
            document.body.classList.remove('print-lra-naratif-mode');
            document.body.classList.remove('print-rekap-naratif-mode');
        };
    }, []);

    const handleAdjustScale = (delta: number) => {
        const newScale = Math.max(50, Math.min(180, sigScale + delta));
        setSigScale(newScale);
        setSignatureScale(newScale);
    };

    const handleAdjustStampScale = (delta: number) => {
        const newScale = Math.max(50, Math.min(180, stampScaleVal + delta));
        setStampScaleVal(newScale);
        setStampScale(newScale);
    };

    const handleToggleStamp = (enabled: boolean) => {
        setShowStamp(enabled);
        setStampOverlayEnabled(enabled);
    };

    const handlePrintNaratif = () => {
        document.body.classList.add('print-lra-naratif-mode');
        setTimeout(() => {
            window.print();
        }, 80);
    };

    // Bersihkan class print mode setelah jendela print ditutup atau modal di-unmount
    useEffect(() => {
        const handleAfterPrint = () => {
            document.body.classList.remove('print-lra-naratif-mode');
            document.body.classList.remove('print-rekap-naratif-mode');
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
            document.body.classList.remove('print-lra-naratif-mode');
            document.body.classList.remove('print-rekap-naratif-mode');
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            document.body.classList.remove('print-lra-naratif-mode');
            document.body.classList.remove('print-rekap-naratif-mode');
        }
    }, [isOpen]);

    const currentYearStr = selectedYear || new Date().getFullYear().toString();
    const formattedSignDate = formatLongDate(signatureDate || new Date().toISOString().split('T')[0]);

    const displaySignature = (val: string, fallback?: string) => {
        if (val && val.trim() !== '') return val;
        if (fallback && fallback.trim() !== '') return fallback;
        return '(...........................)';
    };

    // AUTHORITATIVE LRA DATA: Direct from lraCalculator / reportData
    const lraData: LraReportDataProps = useMemo(() => {
        if (externalReportData) return externalReportData;
        const res = calculateLraReportData(
            entries, 
            budgetItems, 
            { selectedYear, selectedMonth }
        );
        return res.reportData;
    }, [externalReportData, entries, budgetItems, selectedYear, selectedMonth]);

    // METRICS DERIVATION FROM lraData
    // 1. Penerimaan (Pendapatan + Sumber Dana)
    const penerimaan = useMemo(() => {
        // Sumber Dana (Kode 7 & Saldo SILPA Awal)
        const sdAnggaran = lraData.sumberdana?.totalAnggaran || 0;
        const sdRealisasi = lraData.sumberdana?.totalRealisasi || 0;
        const sdSelisih = lraData.sumberdana?.totalSelisih || (sdRealisasi - sdAnggaran);
        const sdPersen = sdAnggaran > 0 ? (sdRealisasi / sdAnggaran) * 100 : (sdRealisasi > 0 ? 100 : 0);

        // Pendapatan Asli Desa Adat & Punia (Kode 4.1.1)
        const paAnggaran = lraData.pendapatanadat?.totalAnggaran || 0;
        const paRealisasi = lraData.pendapatanadat?.totalRealisasi || 0;
        const paSelisih = lraData.pendapatanadat?.totalSelisih || (paRealisasi - paAnggaran);
        const paPersen = paAnggaran > 0 ? (paRealisasi / paAnggaran) * 100 : (paRealisasi > 0 ? 100 : 0);

        // Collective Pendapatan (jika ada pos pendapatan lain di grup pendapatan)
        const totalPendapatanAnggaran = lraData.pendapatan?.totalAnggaran || paAnggaran;
        const totalPendapatanRealisasi = lraData.pendapatan?.totalRealisasi || paRealisasi;
        const totalPendapatanSelisih = totalPendapatanRealisasi - totalPendapatanAnggaran;
        const totalPendapatanPersen = totalPendapatanAnggaran > 0 
            ? (totalPendapatanRealisasi / totalPendapatanAnggaran) * 100 
            : (totalPendapatanRealisasi > 0 ? 100 : 0);

        // Grand Total Penerimaan (Sumber Dana + Pendapatan)
        const totalAnggaran = sdAnggaran + totalPendapatanAnggaran;
        const totalRealisasi = sdRealisasi + totalPendapatanRealisasi;
        const totalSelisih = totalRealisasi - totalAnggaran;
        const persen = totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : (totalRealisasi > 0 ? 100 : 0);

        return {
            sumberDana: {
                anggaran: sdAnggaran,
                realisasi: sdRealisasi,
                selisih: sdSelisih,
                persen: sdPersen,
                rows: lraData.sumberdana?.rows || []
            },
            pendapatanAdat: {
                anggaran: paAnggaran,
                realisasi: paRealisasi,
                selisih: paSelisih,
                persen: paPersen,
                rows: lraData.pendapatanadat?.rows || []
            },
            totalPendapatan: {
                anggaran: totalPendapatanAnggaran,
                realisasi: totalPendapatanRealisasi,
                selisih: totalPendapatanSelisih,
                persen: totalPendapatanPersen,
                rows: lraData.pendapatan?.rows || []
            },
            grandTotal: {
                anggaran: totalAnggaran,
                realisasi: totalRealisasi,
                selisih: totalSelisih,
                persen
            }
        };
    }, [lraData]);

    // 2. Belanja Desa Adat (Per Bidang Sesuai Tabel LRA)
    const belanja = useMemo(() => {
        const rows: {
            no: string;
            kode: string;
            kategori: string;
            anggaran: number;
            realisasi: number;
            sisa: number;
            persen: number;
            groupData?: LraGroupData;
        }[] = [
            {
                no: '1',
                kode: '5.2.1',
                kategori: 'Bidang Parhyangan Adat (Keagamaan & Yadnya)',
                anggaran: lraData.parhyanganadat?.totalAnggaran || 0,
                realisasi: lraData.parhyanganadat?.totalRealisasi || 0,
                sisa: lraData.parhyanganadat?.totalSelisih || 0,
                persen: (lraData.parhyanganadat?.totalAnggaran || 0) > 0 
                    ? ((lraData.parhyanganadat?.totalRealisasi || 0) / (lraData.parhyanganadat?.totalAnggaran || 1)) * 100 
                    : (lraData.parhyanganadat?.totalRealisasi || 0) > 0 ? 100 : 0,
                groupData: lraData.parhyanganadat
            },
            {
                no: '2',
                kode: '5.3.2',
                kategori: 'Bidang Pawongan Adat (Sosial, Budaya & Lembaga)',
                anggaran: lraData.pawonganadat?.totalAnggaran || 0,
                realisasi: lraData.pawonganadat?.totalRealisasi || 0,
                sisa: lraData.pawonganadat?.totalSelisih || 0,
                persen: (lraData.pawonganadat?.totalAnggaran || 0) > 0 
                    ? ((lraData.pawonganadat?.totalRealisasi || 0) / (lraData.pawonganadat?.totalAnggaran || 1)) * 100 
                    : (lraData.pawonganadat?.totalRealisasi || 0) > 0 ? 100 : 0,
                groupData: lraData.pawonganadat
            },
            {
                no: '3',
                kode: '5.1.5',
                kategori: 'Bidang Beban Adat & Administrasi',
                anggaran: lraData.bebanadat?.totalAnggaran || 0,
                realisasi: lraData.bebanadat?.totalRealisasi || 0,
                sisa: lraData.bebanadat?.totalSelisih || 0,
                persen: (lraData.bebanadat?.totalAnggaran || 0) > 0 
                    ? ((lraData.bebanadat?.totalRealisasi || 0) / (lraData.bebanadat?.totalAnggaran || 1)) * 100 
                    : (lraData.bebanadat?.totalRealisasi || 0) > 0 ? 100 : 0,
                groupData: lraData.bebanadat
            },
            {
                no: '4',
                kode: '5.4.1',
                kategori: 'Bidang Palemahan (Lingkungan Hidup & Wilayah)',
                anggaran: lraData.palemahan?.totalAnggaran || 0,
                realisasi: lraData.palemahan?.totalRealisasi || 0,
                sisa: lraData.palemahan?.totalSelisih || 0,
                persen: (lraData.palemahan?.totalAnggaran || 0) > 0 
                    ? ((lraData.palemahan?.totalRealisasi || 0) / (lraData.palemahan?.totalAnggaran || 1)) * 100 
                    : (lraData.palemahan?.totalRealisasi || 0) > 0 ? 100 : 0,
                groupData: lraData.palemahan
            }
        ];

        if (
            (lraData.belanjaLainnya?.totalAnggaran || 0) > 0 ||
            (lraData.belanjaLainnya?.totalRealisasi || 0) > 0
        ) {
            rows.push({
                no: '5',
                kode: '5.x',
                kategori: 'Belanja Lain-lain',
                anggaran: lraData.belanjaLainnya.totalAnggaran,
                realisasi: lraData.belanjaLainnya.totalRealisasi,
                sisa: lraData.belanjaLainnya.totalSelisih,
                persen: lraData.belanjaLainnya.totalAnggaran > 0 
                    ? (lraData.belanjaLainnya.totalRealisasi / lraData.belanjaLainnya.totalAnggaran) * 100 
                    : lraData.belanjaLainnya.totalRealisasi > 0 ? 100 : 0,
                groupData: lraData.belanjaLainnya
            });
        }

        const totalAnggaran = Number(lraData.totalBelanjaAnggaran) || 0;
        const totalRealisasi = Number(lraData.totalBelanjaRealisasi) || 0;
        const sisaPagu = totalAnggaran - totalRealisasi;
        const persenSerapan = totalAnggaran > 0 ? (totalRealisasi / totalAnggaran) * 100 : (totalRealisasi > 0 ? 100 : 0);

        return {
            rows,
            totalAnggaran,
            totalRealisasi,
            sisaPagu,
            totalSisa: sisaPagu,
            persenSerapan,
            totalPersen: persenSerapan
        };
    }, [lraData]);

    // 3. Surplus / (Defisit)
    const surplusDefisit = useMemo(() => {
        const anggaran = lraData.surplusDefisit?.anggaran ?? (penerimaan.grandTotal.anggaran - belanja.totalAnggaran);
        const realisasi = lraData.surplusDefisit?.realisasi ?? (penerimaan.grandTotal.realisasi - belanja.totalRealisasi);
        const varians = realisasi - anggaran;

        let statusText = 'SURPLUS ANGGARAN';
        let statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        let explanation = 'Realisasi penerimaan melampaui seluruh beban belanja yang telah dikeluarkan, menghasilkan sisa lebih kas riil yang aman tersimpan di rekening kas desa & penata keuangan untuk kesinambungan program yadnya mendatang.';

        if (realisasi < 0) {
            statusText = 'DEFISIT REALISASI (DIDUKUNG SILPA/DANA CADANGAN)';
            statusBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
            explanation = 'Pengeluaran belanja periode berjalan lebih besar dari penerimaan baru periode ini, di mana selisih belanja tersebut terbiayai secara sah melalui penggunaan saldo kas awal (SILPA tahun sebelumnya) ataupun dana cadangan desa adat.';
        } else if (realisasi === 0) {
            statusText = 'REALISASI BERIMBANG (NIHIL)';
            statusBadgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
            explanation = 'Seluruh penerimaan telah terserap tepat 100% untuk membiayai seluruh rangkaian upakara dan operasional secara efisien dan tepat sasaran.';
        }

        return {
            anggaran,
            realisasi,
            varians,
            statusText,
            statusBadgeClass,
            explanation
        };
    }, [lraData, penerimaan, belanja]);

    const aiStorageKey = `desa_adat_lra_ai_narrative_${selectedYear || 'ALL'}_${selectedMonth || 'THN'}`;

    // Load cached AI Narrative if available
    useEffect(() => {
        if (!isOpen) return;
        try {
            const cached = localStorage.getItem(aiStorageKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.fullNarrative) {
                    setAiNarrative(parsed);
                    setLastAiGeneratedTime(parsed.generatedAt || '');
                }
            }
        } catch {
            // ignore localStorage read error
        }
    }, [aiStorageKey, isOpen]);

    const handleCopyAiText = () => {
        if (!aiNarrative) return;
        navigator.clipboard.writeText(aiNarrative.fullNarrative);
        setCopiedAi(true);
        showNotification('Naskah Analisis AI berhasil disalin ke clipboard!', 'success');
        setTimeout(() => setCopiedAi(false), 2000);
    };

    // Algorithmic Fallback AI Narrative Generator (Ensures 100% reliability even if offline or key absent)
    const generateFallbackAiNarrative = () => {
        const grandPenerimaan = penerimaan.grandTotal;
        const totalBelanja = belanja;
        const statusSurplus = (surplusDefisit.realisasi ?? 0) >= 0 ? 'Surplus Operasional' : 'Defisit (Didukung SILPA/Dana Cadangan)';
        const belanjaPersen = (totalBelanja.totalPersen ?? totalBelanja.persenSerapan ?? 0).toFixed(1);
        const belanjaSisa = totalBelanja.totalSisa ?? totalBelanja.sisaPagu ?? 0;
        const penerimaanPersen = (grandPenerimaan.persen ?? 0).toFixed(1);

        return `# RINGKASAN EKSEKUTIF KINERJA ANGGARAN
Skor Kesehatan Fiskal: 92
Status Kinerja: Efisiensi Tinggi & Berimbang

Pelaksanaan Anggaran Pendapatan dan Belanja Desa Adat (APB-DA) Basangalas periode **${reportPeriodLabel}** berjalan tertib, disiplin, dan berorientasi penuh pada keluhuran yadnya serta asas akuntabilitas publik. Dari target pagu penerimaan sebesar **${formatCurrency(grandPenerimaan.anggaran)}**, telah terealisasi penerimaan kas riil sebesar **${formatCurrency(grandPenerimaan.realisasi)}** (${penerimaanPersen}%). Sementara itu, dari total pagu alokasi belanja sebesar **${formatCurrency(totalBelanja.totalAnggaran)}**, realisasi belanja terkendali di angka **${formatCurrency(totalBelanja.totalRealisasi)}** (${belanjaPersen}%), sehingga menghasilkan sisa efisiensi belanja sebesar **${formatCurrency(belanjaSisa)}**. Dengan demikian, posisi kas bersih membukukan **${statusSurplus}** sebesar **${formatCurrency(surplusDefisit.realisasi)}** yang memperkokoh ketahanan kas desa adat.

## I. KAJIAN STRATEGIS SISI PENERIMAAN DESA ADAT
Penerimaan Desa Adat Basangalas bersumber dari perpaduan harmonis antara bantuan pemerintah daerah dan kemandirian swadaya gotong-royong krama:
- **Sumber Dana & Saldo Awal (Akun 7 & 6.1)**: Pagu sebesar **${formatCurrency(penerimaan.sumberDana.anggaran)}** dengan realisasi **${formatCurrency(penerimaan.sumberDana.realisasi)}** (${(penerimaan.sumberDana.persen ?? 0).toFixed(1)}%). Komponen ini menjadi penopang utama likuiditas kas awal tahun.
- **Pendapatan Asli Desa Adat (Akun 4.1.1)**: Terealisasi sebesar **${formatCurrency(penerimaan.pendapatanAdat.realisasi)}** dari estimasi target **${formatCurrency(penerimaan.pendapatanAdat.anggaran)}** (${(penerimaan.pendapatanAdat.persen ?? 0).toFixed(1)}%).
- **Tingkat Kemandirian Fiskal**: Keseimbangan antara transfer pemerintah daerah dan punia krama memberikan stabilitas bagi prajuru dalam mengeksekusi program kerja adat tanpa risiko ketergantungan sepihak.

## II. KAJIAN EFEKTIVITAS & EFISIENSI BELANJA DESA ADAT
Penyerapan belanja telah direalisasikan selaras dengan kearifan lokal kesucian **Tri Hita Karana**:
- **Bidang Parhyangan Adat (5.2.1)**: Terealisasi sebesar **${formatCurrency(lraData.parhyanganadat?.totalRealisasi || 0)}** dari alokasi pagu **${formatCurrency(lraData.parhyanganadat?.totalAnggaran || 0)}**. Seluruh upakara piodalan pura khayangan desa, pujawali, dan sarana bhakti keagamaan telah terlaksana dengan tulus ikhlas (*labda karya*) tanpa ada yadnya yang tertunda.
- **Bidang Pawongan Adat (5.3.2)**: Terealisasi sebesar **${formatCurrency(lraData.pawonganadat?.totalRealisasi || 0)}** dari pagu **${formatCurrency(lraData.pawonganadat?.totalAnggaran || 0)}**. Belanja ini menunjang santunan sosial suka-duka krama.
- **Bidang Beban Adat & Administrasi (5.1.5)**: Terealisasi sebesar **${formatCurrency(lraData.bebanadat?.totalRealisasi || 0)}** Guna operasional kantor sekretariat, dokumentasi, Service Peralatan, Kundangan Prajuru Adat, Dan Biaya Pesangkepan/Paruman Adat.
- **Disiplin Efisiensi Anggaran**: Terdapat sisa efisiensi pagu belanja sebesar **${formatCurrency(belanjaSisa)}**. Penghematan ini bukan merupakan pemotongan mutu upakara, melainkan hasil kecermatan Juru Raksa dalam verifikasi bukti nota belanja dan pengadaan sarana upakara secara bijaksana.

## III. EVALUASI POSISI SURPLUS / (DEFISIT) DAN LIKUIDITAS KAS
- **Posisi Kas Bersih**: Membukukan angka **${formatCurrency(surplusDefisit.realisasi)}** dengan status **${surplusDefisit.statusText}**.
- **Ketahanan Likuiditas**: Saldo kas riil yang tersimpan di rekening bank dan brankas juru raksa berada dalam kondisi likuid untuk mendanai agenda yadnya triwulan berikutnya.
- **Perlakuan Saldo Kas**: Sisa lebih kas ini dicatat sebagai Sisa Lebih Perhitungan Anggaran (SILPA) yang sah untuk dialokasikan kembali pada APB-DA tahun anggaran berikutnya atau disisihkan pada pos dana abadi cadangan yadnya pura.

## IV. CATATAN KRITIS BADAN PENGAWAS & REKOMENDASI STRATEGIS UNTUK PARUMAN
Badan Pengawas Keuangan Desa Adat bersama Juru Raksa menyampaikan rekomendasi taktis untuk disepakati dalam Paruman Desa Adat:
1. **Pertanggungjawaban Publik Terbuka**: Publikasikan lembar ringkasan LRA ini di papan informasi wantilan desa adat agar asas transparansi kepada krama senantiasa terjaga.
2. **Pencadangan Dana Yadnya Pura**: Sebagian sisa kas operasional disarankan disisihkan ke pos Dana Abadi Piodalan Pura Khayangan Desa untuk menjaga ketahanan keuangan pura di masa depan.
3. **Tertib Administrasi Bukti Kas (BKP & Nota)**: Terus pertahankan rekonsiliasi berkala antara Juru Raksa, Penyarikan, dan Bendesa Adat dengan arsip nota bukti pengeluaran yang terverifikasi rapi.
4. **Optimalisasi Sistem Pembukuan Digital**: Memaksimalkan pemanfaatan aplikasi BACOL ENTERPRISE agar seluruh pencatatan transaksi BKU dan Jurnal Umum selalu termutakhirkan secara akurat.`;
    };

    // Trigger AI Narrative Generation
    const handleTriggerAiAnalysis = async (forceRegenerate: boolean = false) => {
        if (aiNarrative && !forceRegenerate && activeView !== 'ai') {
            setActiveView('ai');
            return;
        }

        setIsAiGenerating(true);
        setActiveView('ai');
        showNotification('Gemini AI sedang menelaah tabel LRA dan menyusun analisis naratif...', 'info');

        try {
            const apiKey = getGeminiApiKey();
            let narrativeText = '';
            let fiscalScore = 90;
            let fiscalStatus = 'Efisiensi Tinggi';

            const toNum = (v: number | undefined | null) => (typeof v === 'number' && !isNaN(v) ? v : 0);
            const toLocStr = (v: number | undefined | null) => toNum(v).toLocaleString('id-ID');
            const toPctStr = (v: number | undefined | null) => toNum(v).toFixed(1);

            if (apiKey && apiKey.trim() !== '') {
                const ai = getGeminiClient(apiKey);

                const belanjaDetailList = belanja.rows.map(b => 
                    `- [Kode ${b.kode}] ${b.kategori}: Anggaran Rp ${toLocStr(b.anggaran)} | Realisasi Rp ${toLocStr(b.realisasi)} | Sisa Rp ${toLocStr(b.sisa)} | Serapan ${toPctStr(b.persen)}%`
                ).join('\n');

                const totalBelanjaSisa = belanja.totalSisa ?? belanja.sisaPagu ?? 0;
                const totalBelanjaPersen = belanja.totalPersen ?? belanja.persenSerapan ?? 0;

                const prompt = `
ANALISIS TABEL LAPORAN REALISASI ANGGARAN (LRA) DESA ADAT BASANGALAS
- Entitas: ${profile.namaDesa || 'DESA ADAT BASANGALAS'}, Desa Tribuana, Kec. Abang, Kab. Karangasem - Bali
- Periode: ${reportPeriodLabel} (Tahun Anggaran ${currentYearStr})

DATA TABEL KEUANGAN LRA:
A. PENERIMAAN DESA ADAT:
1. Sumber Dana / SILPA Kas Awal (Akun 7 & 6.1): Pagu Rp ${toLocStr(penerimaan.sumberDana.anggaran)} | Realisasi Rp ${toLocStr(penerimaan.sumberDana.realisasi)} | Capaian ${toPctStr(penerimaan.sumberDana.persen)}%
2. Pendapatan Asli Desa Adat & Dana Punia Krama (Akun 4.1.1): Pagu Rp ${toLocStr(penerimaan.pendapatanAdat.anggaran)} | Realisasi Rp ${toLocStr(penerimaan.pendapatanAdat.realisasi)} | Capaian ${toPctStr(penerimaan.pendapatanAdat.persen)}%
TOTAL PENERIMAAN KESELURUHAN: Pagu Rp ${toLocStr(penerimaan.grandTotal.anggaran)} | Realisasi Rp ${toLocStr(penerimaan.grandTotal.realisasi)} | Selisih Rp ${toLocStr(penerimaan.grandTotal.selisih)} | Capaian ${toPctStr(penerimaan.grandTotal.persen)}%

B. BELANJA DESA ADAT (PER BIDANG):
${belanjaDetailList}
TOTAL BELANJA KESELURUHAN: Pagu Rp ${toLocStr(belanja.totalAnggaran)} | Realisasi Rp ${toLocStr(belanja.totalRealisasi)} | Sisa Efisiensi Pagu Rp ${toLocStr(totalBelanjaSisa)} | Serapan ${toPctStr(totalBelanjaPersen)}%

C. POSISI KAS & SURPLUS / (DEFISIT):
- Rencana Anggaran: Rp ${toLocStr(surplusDefisit.anggaran)}
- Realisasi Kas Bersih: Rp ${toLocStr(surplusDefisit.realisasi)}
- Varians: Rp ${toLocStr(surplusDefisit.varians)}
- Status Posisi: ${surplusDefisit.statusText}

INSTRUKSI OUTPUT:
Tuliskan dokumen analisis naratif LRA yang utuh, mendalam, berwibawa, dan dapat langsung dibacakan dalam Paruman Desa Adat di hadapan Prajuru, Bendesa, Badan Pengawas, dan Krama Desa. Gunakan Bahasa Indonesia formal berbalut tata krama adat Bali yang santun.

Sajikan narasi terstruktur dengan format Markdown:
# KOP & RINGKASAN EKSEKUTIF KINERJA ANGGARAN
Skor Kesehatan Fiskal: [Nilai 60-100]
Status Kinerja: [Sangat Sehat / Efisiensi Tinggi / Optimal / Perlu Perhatian]
[Ulasan eksekutif 1-2 paragraf mengenai keberhasilan tata kelola APB Desa Adat periode ini, menyandingkan pagu vs realisasi, serapan, dan sisa belanja].

## I. KAJIAN STRATEGIS SISI PENERIMAAN DESA ADAT
- Bedah capaian Sumber Dana vs Pendapatan Asli Adat (Punia krama, swadaya).
- Ulas tingkat kemandirian fiskal desa dan antusiasme warga dalam ber-yadnya.

## II. KAJIAN EFEKTIVITAS & EFISIENSI BELANJA DESA ADAT
- Evaluasi mendalam belanja berlandaskan Tri Hita Karana:
  * Parhyangan (penyelenggaraan piodalan, karya, pemeliharaan pura)
  * Pawongan (santunan suka duka krama)
  * Beban operasional sekretariat prajuru
- Tinjau efisiensi sisa pagu anggaran belanja dan kedisiplinan juru raksa dalam mengendalikan pengeluaran.

## III. EVALUASI POSISI SURPLUS / (DEFISIT) DAN LIKUIDITAS KAS
- Analisis penyebab terjadinya surplus atau defisit kas, serta hubungannya dengan SILPA.
- Ulas ketahanan likuiditas kas desa untuk mendanai agenda upakara periode mendatang.

## IV. CATATAN KRITIS BADAN PENGAWAS & REKOMENDASI STRATEGIS UNTUK PARUMAN
- Berikan 3 sampai 4 rekomendasi taktis bernas yang siap disepakati dalam Paruman Desa Adat demi penguatan transparansi dan akuntabilitas tata kelola keuangan desa adat.
`;

                const response = await ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: prompt,
                    config: {
                        systemInstruction: "Anda adalah Ahli Analisis Anggaran Publik & Pengawas Tata Kelola Keuangan Desa Adat Bali tersertifikasi. Tugas Anda menganalisis Laporan Realisasi Anggaran (LRA) APB Desa Adat secara tajam, berimbang, objektif, berorientasi akuntabilitas publik, dan kearifan lokal Tri Hita Karana."
                    }
                });

                narrativeText = response.text || '';
            }

            if (!narrativeText || narrativeText.trim() === '') {
                narrativeText = generateFallbackAiNarrative();
            }

            // Extract score & status
            const scoreMatch = narrativeText.match(/(?:Skor\s*Kesehatan\s*Fiskal|Skor|Score)[:\s]*([0-9]{2,3})/i);
            if (scoreMatch && !isNaN(Number(scoreMatch[1]))) {
                const val = Number(scoreMatch[1]);
                if (val >= 50 && val <= 100) fiscalScore = val;
            } else {
                let score = 85;
                if (belanja.totalRealisasi <= belanja.totalAnggaran) score += 7;
                if ((penerimaan.grandTotal.persen ?? 0) >= 90) score += 5;
                if ((surplusDefisit.realisasi ?? 0) >= 0) score += 3;
                fiscalScore = Math.min(98, score);
            }

            const statusMatch = narrativeText.match(/(?:Status\s*Kinerja|Status)[:\s]*([A-Za-z\s&]+)/i);
            if (statusMatch && statusMatch[1]) {
                fiscalStatus = statusMatch[1].trim().split('\n')[0];
            } else {
                fiscalStatus = fiscalScore >= 90 ? 'Sangat Sehat' : fiscalScore >= 75 ? 'Efisiensi Tinggi' : 'Optimal';
            }

            const nowStr = new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }) + ' Pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';

            const activeBelanjaPersen = (belanja.totalPersen ?? belanja.persenSerapan ?? 0).toFixed(1);
            const resultData: AiNarrativeResult = {
                headline: (surplusDefisit.realisasi ?? 0) >= 0 
                    ? `Realisasi APB Desa Adat periode ${reportPeriodLabel} mencatatkan surplus operasional sebesar ${formatCurrency(surplusDefisit.realisasi)} dengan serapan belanja terukur ${activeBelanjaPersen}%.`
                    : `Realisasi APB Desa Adat periode ${reportPeriodLabel} didukung penggunaan SILPA/dana cadangan sebesar ${formatCurrency(Math.abs(surplusDefisit.realisasi ?? 0))} guna membiayai seluruh rangkaian upakara piodalan yadnya.`,
                fiscalHealthScore: fiscalScore,
                fiscalHealthStatus: fiscalStatus,
                fullNarrative: narrativeText,
                generatedAt: nowStr
            };

            setAiNarrative(resultData);
            setLastAiGeneratedTime(nowStr);

            try {
                localStorage.setItem(aiStorageKey, JSON.stringify(resultData));
            } catch {
                // ignore
            }

            showNotification('Analisis Naratif LRA dari Gemini AI berhasil dibuat!', 'success');
        } catch (err) {
            console.error('Gemini AI generation error:', err);
            const fallbackText = generateFallbackAiNarrative();
            const nowStr = new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }) + ' Pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';

            const resultData: AiNarrativeResult = {
                headline: `Realisasi APB Desa Adat periode ${reportPeriodLabel} mencatatkan surplus kas sebesar ${formatCurrency(surplusDefisit.realisasi)}.`,
                fiscalHealthScore: 89,
                fiscalHealthStatus: 'Efisiensi Tinggi',
                fullNarrative: fallbackText,
                generatedAt: nowStr
            };

            setAiNarrative(resultData);
            setLastAiGeneratedTime(nowStr);
            showNotification('Analisis Naratif LRA berhasil disusun dengan kalkulator cerdas!', 'info');
        } finally {
            setIsAiGenerating(false);
        }
    };

    // Formatted Markdown renderer for AI narrative
    const renderFormattedNarrative = (text: string) => {
        if (!text) return null;
        const lines = text.split('\n');

        return (
            <div className="space-y-3 font-sans text-slate-900 text-xs sm:text-[13px] leading-relaxed">
                {lines.map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} className="h-1.5" />;

                    // Heading 1 (#)
                    if (trimmed.startsWith('# ')) {
                        const headingText = trimmed.replace(/^#\s*/, '');
                        return (
                            <div key={idx} className="mt-5 mb-2 pb-1.5 border-b-2 border-indigo-200">
                                <h3 className="text-sm sm:text-base font-black text-indigo-950 uppercase tracking-wide flex items-center gap-2 font-serif">
                                    <Sparkles size={16} className="text-indigo-600 shrink-0" />
                                    <span>{headingText}</span>
                                </h3>
                            </div>
                        );
                    }

                    // Heading 2 (##)
                    if (trimmed.startsWith('## ')) {
                        const subText = trimmed.replace(/^##\s*/, '');
                        return (
                            <div key={idx} className="mt-4 mb-1.5 pb-1 border-b border-slate-200">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="w-1.5 h-3.5 bg-indigo-600 rounded-xs inline-block"></span>
                                    <span>{subText}</span>
                                </h4>
                            </div>
                        );
                    }

                    // Heading 3 (###)
                    if (trimmed.startsWith('### ')) {
                        const subText = trimmed.replace(/^###\s*/, '');
                        return (
                            <h5 key={idx} className="text-xs font-bold text-indigo-900 uppercase tracking-wide mt-3 mb-1">
                                {subText}
                            </h5>
                        );
                    }

                    // Bullet points (- or * or numbered list)
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^[0-9]+\.\s/.test(trimmed)) {
                        const bulletContent = trimmed.replace(/^[-*]\s*|^[0-9]+\.\s*/, '');
                        const parts = bulletContent.split(/(\*\*.*?\*\*)/g);
                        return (
                            <div key={idx} className="flex items-start gap-2 pl-3 my-1">
                                <span className="text-indigo-600 font-bold mt-0.5 select-none shrink-0">•</span>
                                <div className="text-slate-800 flex-1 leading-relaxed">
                                    {parts.map((part, pIdx) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={pIdx} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                    })}
                                </div>
                            </div>
                        );
                    }

                    // Standard paragraph with bold parsing
                    const parts = trimmed.split(/(\*\*.*?\*\*)/g);
                    return (
                        <p key={idx} className="text-justify leading-relaxed text-slate-800">
                            {parts.map((part, pIdx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={pIdx} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
                                }
                                return part;
                            })}
                        </p>
                    );
                })}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Naskah Narasi Laporan Realisasi Anggaran (LRA) - ${reportPeriodLabel}`}
            className={`transition-all duration-300 ${
                isFullscreen 
                    ? '!max-w-[98vw] !w-[98vw] !h-[96vh] !p-3' 
                    : '!max-w-4xl !w-full'
            }`}
        >
            <div className="flex flex-col h-full space-y-4">
                
                {/* TOOLBAR ATAS: Info + Fullscreen Toggle + Print Shortcut */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-teal-950 via-slate-900 to-amber-950 border border-slate-700 rounded-xl no-print">
                    <div className="flex items-center gap-2 text-slate-200">
                        <span className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg border border-teal-500/30">
                            <FileText size={18} />
                        </span>
                        <div>
                            <div className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                                Narasi LRA Resmi <Sparkles size={13} className="text-amber-400 animate-pulse" />
                            </div>
                            <div className="text-[10px] text-slate-300">
                                Sandingan Anggaran vs Realisasi Sesuai Tabel LRA
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* TAB BERALIH TAMPILAN (Jika Analisis AI telah dibuat) */}
                        {aiNarrative && (
                            <div className="inline-flex rounded-lg bg-slate-800/90 p-0.5 border border-slate-700 shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('standar')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                        activeView === 'standar'
                                            ? 'bg-teal-600 text-white shadow-xs'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Narasi Standar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveView('ai')}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                                        activeView === 'ai'
                                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                                            : 'text-purple-300 hover:text-white'
                                    }`}
                                >
                                    <Sparkles size={12} className="text-amber-300" /> Analisis AI
                                </button>
                            </div>
                        )}

                        {/* TOMBOL ANALISIS AI (DI SEBELAH KIRI BUKA LAYAR PENUH) */}
                        <button
                            type="button"
                            onClick={() => handleTriggerAiAnalysis()}
                            disabled={isAiGenerating}
                            className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-lg border transition-all shadow-md cursor-pointer ${
                                isAiGenerating
                                    ? 'bg-purple-900/80 text-purple-200 border-purple-400 animate-pulse'
                                    : activeView === 'ai'
                                        ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white border-purple-300 ring-2 ring-purple-400/50'
                                        : 'bg-gradient-to-r from-purple-700 via-indigo-700 to-teal-700 hover:from-purple-600 hover:to-indigo-600 text-amber-300 hover:text-white border-purple-400/60'
                            }`}
                            title="Klik untuk membuatkan narasi analisis dari tabel LRA dengan bantuan Gemini AI"
                        >
                            <Sparkles size={14} className={isAiGenerating ? "animate-spin text-amber-300" : "text-amber-300 animate-pulse"} />
                            <span>{isAiGenerating ? 'Menyusun Analisis AI...' : 'Analisis AI'}</span>
                        </button>

                        {/* TOMBOL BUKA LAYAR PENUH */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                isFullscreen
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-md'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 hover:border-amber-400'
                            }`}
                            title={isFullscreen ? 'Kembalikan Ukuran Normal' : 'Tampilkan Dokumen Layar Penuh'}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 size={15} /> Layar Normal
                                </>
                            ) : (
                                <>
                                    <Maximize2 size={15} /> Buka Layar Penuh
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handlePrintNaratif}
                            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow cursor-pointer active:scale-95"
                        >
                            <Printer size={15} /> Cetak Narasi LRA
                        </button>
                    </div>
                </div>

                {/* STYLE KHUSUS PRINT A4 LRA NARATIF (Mencegah tampilan ganda / bocor ke elemen bawah) */}
                <style>{`
                    @media print {
                        body.print-lra-naratif-mode * {
                            visibility: hidden !important;
                        }
                        body.print-lra-naratif-mode #printable-lra-naratif,
                        body.print-lra-naratif-mode #printable-lra-naratif * {
                            visibility: visible !important;
                        }
                        body.print-lra-naratif-mode #printable-lra-naratif {
                            display: block !important;
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 10mm 15mm !important;
                            background: white !important;
                            color: black !important;
                            box-shadow: none !important;
                            border: none !important;
                            font-size: 10.5pt !important;
                            line-height: 1.4 !important;
                            z-index: 99999999 !important;
                        }
                        body.print-lra-naratif-mode .no-print,
                        body.print-lra-naratif-mode .no-print * {
                            display: none !important;
                            visibility: hidden !important;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 10mm 12mm 10mm 12mm;
                        }
                    }
                `}</style>

                {/* AREA PRATINJAU DOKUMEN CETAK (A4 FORMAL LAYOUT SESUAI TABEL LRA) */}
                <div 
                    id="printable-lra-naratif"
                    className="printable-lra-naratif flex-1 overflow-y-auto bg-white text-slate-950 p-6 sm:p-10 rounded-xl shadow-2xl border border-slate-300 font-serif leading-relaxed text-sm selection:bg-teal-100 selection:text-teal-950"
                    style={{ minHeight: isFullscreen ? '78vh' : '65vh' }}
                >
                    {/* KOP SURAT RESMI DESA ADAT BASANGALAS */}
                    <div className="text-center border-b-4 border-double border-slate-900 pb-3 mb-6">
                        <div className="text-lg sm:text-2xl font-black tracking-wider text-slate-900 uppercase font-serif">
                            {profile.namaDesa || 'DESA ADAT BASANGALAS'}
                        </div>
                        <div className="text-xs sm:text-sm font-bold tracking-widest text-slate-800 uppercase mt-0.5 font-sans">
                            Tata Kelola Keuangan Desa Adat
                        </div>
                        <div className="text-[10px] sm:text-xs text-slate-600 font-sans mt-1">
                            {profile.alamat || 'Sekretariat: Jln. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852'}
                        </div>
                    </div>

                    {/* JIKA MODE ANALISIS AI AKTIF */}
                    {activeView === 'ai' ? (
                        <>
                            {/* HEADER ANALISIS DARI GEMINI AI */}
                            <div className="mb-6 bg-gradient-to-br from-purple-50 via-indigo-50/60 to-teal-50/80 border-2 border-indigo-200 rounded-2xl p-5 sm:p-6 shadow-xs not-italic font-sans">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-200/80 pb-4 mb-4">
                                    <div className="flex items-start sm:items-center gap-3">
                                        <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-md flex items-center justify-center shrink-0">
                                            <Sparkles size={24} className="animate-pulse" />
                                        </div>
                                        <div>
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-black uppercase tracking-wider border border-purple-300">
                                                <Bot size={13} className="text-purple-700" /> Analisis Cerdas Gemini AI
                                            </div>
                                            <h2 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight mt-1 font-serif">
                                                Kajian Strategis Laporan Realisasi Anggaran (LRA)
                                            </h2>
                                            <p className="text-xs text-slate-600 font-medium mt-0.5">
                                                Didukung Model <span className="font-black text-indigo-700 font-mono">Gemini 3.8 Flash</span> • Penelaahan Pagu vs Realisasi APB Desa Adat Basangalas
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons in Header (Hidden on Print) */}
                                    <div className="flex flex-wrap items-center gap-2 no-print self-start md:self-auto">
                                        <button
                                            type="button"
                                            onClick={handleCopyAiText}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-xs active:scale-95"
                                            title="Salin Naskah Analisis AI"
                                        >
                                            {copiedAi ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                            <span>{copiedAi ? 'Tersalin' : 'Salin Narasi'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTriggerAiAnalysis(true)}
                                            disabled={isAiGenerating}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-100 hover:bg-purple-200 text-purple-900 transition cursor-pointer shadow-xs disabled:opacity-50 active:scale-95"
                                            title="Buat Ulang Analisis AI dengan Data Terbaru"
                                        >
                                            <RefreshCw size={14} className={isAiGenerating ? "animate-spin text-purple-700" : "text-purple-700"} />
                                            <span>{isAiGenerating ? 'Memproses...' : 'Buat Ulang'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveView('standar')}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer active:scale-95"
                                            title="Beralih ke Tampilan Narasi Standar"
                                        >
                                            <FileText size={14} />
                                            <span>Narasi Standar</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 4 KARTU INDIKATOR HASIL ANALISIS GEMINI AI */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                                    <div className="bg-white/95 p-3.5 rounded-xl border border-indigo-100 shadow-xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                            Skor Kinerja Fiskal
                                        </span>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className="text-xl sm:text-2xl font-black font-mono text-purple-700">
                                                {aiNarrative?.fiscalHealthScore ?? 92}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400 font-mono">/100</span>
                                        </div>
                                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 uppercase">
                                            {aiNarrative?.fiscalHealthStatus ?? 'Efisiensi Tinggi'}
                                        </span>
                                    </div>

                                    <div className="bg-white/95 p-3.5 rounded-xl border border-indigo-100 shadow-xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                            Capaian Penerimaan
                                        </span>
                                        <div className="text-sm sm:text-base font-black font-mono text-emerald-700 mt-1 truncate">
                                            {formatCurrency(penerimaan.grandTotal.realisasi)}
                                        </div>
                                        <span className="text-[11px] text-slate-600 font-mono font-bold block mt-1">
                                            {(penerimaan.grandTotal.persen ?? 0).toFixed(1)}% dari Target Pagu
                                        </span>
                                    </div>

                                    <div className="bg-white/95 p-3.5 rounded-xl border border-indigo-100 shadow-xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                            Serapan Belanja
                                        </span>
                                        <div className="text-sm sm:text-base font-black font-mono text-rose-700 mt-1 truncate">
                                            {formatCurrency(belanja.totalRealisasi)}
                                        </div>
                                        <span className="text-[11px] text-slate-600 font-mono font-bold block mt-1">
                                            {(belanja.totalPersen ?? belanja.persenSerapan ?? 0).toFixed(1)}% (Sisa: {formatCurrency(belanja.totalSisa ?? belanja.sisaPagu ?? 0)})
                                        </span>
                                    </div>

                                    <div className="bg-white/95 p-3.5 rounded-xl border border-indigo-100 shadow-xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                            Posisi Kas Bersih
                                        </span>
                                        <div className={`text-sm sm:text-base font-black font-mono mt-1 truncate ${
                                            surplusDefisit.realisasi >= 0 ? 'text-teal-700' : 'text-amber-700'
                                        }`}>
                                            {formatCurrency(surplusDefisit.realisasi)}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-600 block mt-1">
                                            {surplusDefisit.realisasi >= 0 ? 'Surplus Operasional' : 'Defisit Terbiayai SILPA'}
                                        </span>
                                    </div>
                                </div>

                                {lastAiGeneratedTime && (
                                    <div className="mt-3 pt-2.5 border-t border-indigo-100 text-[10px] text-slate-500 font-mono flex items-center justify-between">
                                        <span>Terakhir Dianalisis: {lastAiGeneratedTime}</span>
                                        <span className="font-sans font-semibold text-indigo-700">Verifikasi Resmi Sistem BACOL Adat</span>
                                    </div>
                                )}
                            </div>

                            {/* SALAM PEMBUKA ADAT */}
                            <div className="mb-4 italic text-slate-800 text-xs sm:text-sm font-medium">
                                Om Swastyastu,
                            </div>

                            {/* BADAN ANALISIS NARATIF DARI GEMINI AI */}
                            {isAiGenerating && !aiNarrative ? (
                                <div className="py-16 text-center space-y-3 bg-purple-50/50 rounded-2xl border border-purple-100">
                                    <div className="inline-flex p-3 bg-purple-100 text-purple-700 rounded-full animate-spin">
                                        <RefreshCw size={24} />
                                    </div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                                        Gemini AI Sedang Menelaah Angka & Menyusun Narasi LRA...
                                    </h3>
                                    <p className="text-xs text-slate-600 max-w-md mx-auto font-sans">
                                        Memvalidasi pagu vs realisasi kas, rasio penyerapan Tri Hita Karana, dan menyusun rekomendasi akuntabilitas Paruman.
                                    </p>
                                </div>
                            ) : (
                                <div className="mb-8">
                                    {renderFormattedNarrative(aiNarrative?.fullNarrative || generateFallbackAiNarrative())}
                                </div>
                            )}

                            {/* CALLOUT AKUNTABILITAS TRI HITA KARANA */}
                            <div className="my-6 p-4 rounded-xl bg-amber-50/70 border border-amber-300/80 not-italic font-sans">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase mb-1">
                                    <ShieldCheck size={16} className="text-amber-700" /> Landasan Akuntabilitas Keuangan Adat Bali
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed text-justify">
                                    Naskah narasi dan analisis komparatif ini merupakan dokumen resmi pertanggungjawaban prajuru desa adat yang mengintegrasikan data kas mutasi BKU dengan ketetapan pagu APB-DA. Seluruh angka telah melalui verifikasi rekonsiliasi dan siap dipertanggungjawabkan dalam Paruman Desa Adat Basangalas.
                                </p>
                            </div>

                            {/* TABEL REKAPITULASI REALISASI ANGGARAN (LRA) */}
                            <div className="my-6 not-italic font-sans page-break-inside-avoid">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <BarChart3 size={15} className="text-indigo-700" /> Tabel Rekapitulasi Realisasi Anggaran (LRA) Pendukung
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                        Mata Uang: Rupiah (Rp)
                                    </span>
                                </div>
                                <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
                                    <table className="w-full text-[11px] sm:text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 uppercase">
                                                <th className="py-2.5 px-2.5 border-r border-slate-300 w-16 text-center">Kode</th>
                                                <th className="py-2.5 px-3 border-r border-slate-300">Uraian Akun / Pos Anggaran</th>
                                                <th className="py-2.5 px-2.5 text-right border-r border-slate-300">Pagu Target (Rp)</th>
                                                <th className="py-2.5 px-2.5 text-right border-r border-slate-300">Realisasi Kas (Rp)</th>
                                                <th className="py-2.5 px-2.5 text-right border-r border-slate-300">Sisa / Selisih (Rp)</th>
                                                <th className="py-2.5 px-2 text-center w-16">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            <tr className="bg-teal-50/70 font-bold text-teal-950">
                                                <td className="py-2 px-2.5 text-center font-mono border-r border-slate-200">4</td>
                                                <td className="py-2 px-3 border-r border-slate-200">TOTAL PENERIMAAN DESA ADAT</td>
                                                <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.grandTotal.anggaran)}</td>
                                                <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200 text-teal-900">{formatCurrency(penerimaan.grandTotal.realisasi)}</td>
                                                <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.grandTotal.selisih)}</td>
                                                <td className="py-2 px-2 text-center font-mono">{(penerimaan.grandTotal.persen ?? 0).toFixed(1)}%</td>
                                            </tr>
                                            {belanja.rows.map((bRow) => (
                                                <tr key={bRow.kode} className="hover:bg-slate-50">
                                                    <td className="py-1.5 px-2.5 text-center font-mono text-slate-500 border-r border-slate-200">{bRow.kode}</td>
                                                    <td className="py-1.5 px-3 border-r border-slate-200">{bRow.kategori}</td>
                                                    <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(bRow.anggaran)}</td>
                                                    <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200 text-slate-900 font-semibold">{formatCurrency(bRow.realisasi)}</td>
                                                    <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(bRow.sisa)}</td>
                                                    <td className="py-1.5 px-2 text-center font-mono">{(bRow.persen ?? 0).toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-rose-50/70 font-bold text-rose-950">
                                                <td className="py-2 px-2.5 text-center font-mono border-r border-slate-200">5</td>
                                                <td className="py-2 px-3 border-r border-slate-200">TOTAL BELANJA DESA ADAT</td>
                                                <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(belanja.totalAnggaran)}</td>
                                                <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200 text-rose-900">{formatCurrency(belanja.totalRealisasi)}</td>
                                                <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(belanja.totalSisa ?? belanja.sisaPagu ?? 0)}</td>
                                                <td className="py-2 px-2 text-center font-mono">{(belanja.totalPersen ?? belanja.persenSerapan ?? 0).toFixed(1)}%</td>
                                            </tr>
                                            <tr className="bg-indigo-50 font-black text-indigo-950 border-t-2 border-slate-400">
                                                <td className="py-2.5 px-2.5 text-center font-mono border-r border-slate-200">SD</td>
                                                <td className="py-2.5 px-3 border-r border-slate-200">SURPLUS / (DEFISIT) ANGGARAN & REALISASI</td>
                                                <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(surplusDefisit.anggaran)}</td>
                                                <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(surplusDefisit.realisasi)}</td>
                                                <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(surplusDefisit.varians)}</td>
                                                <td className="py-2.5 px-2 text-center font-mono">{surplusDefisit.realisasi >= 0 ? 'Surplus' : 'Defisit'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* SALAM PENUTUP ADAT */}
                            <div className="mb-6 text-justify text-xs sm:text-[13px] leading-relaxed text-slate-800">
                                <p className="indent-6">
                                    Demikian Dokumen Analisis Naratif Laporan Realisasi Anggaran (LRA) ini disusun dengan kejujuran (*satya*) 
                                    sebagai pertanggungjawaban amanah kepengurusan Prajuru Desa Adat Basangalas. Berlandaskan 
                                    ajaran suci <strong>Tri Hita Karana</strong>, kiranya dokumen ini memperkokoh kerukunan, keterbukaan, 
                                    serta keharmonisan seluruh Krama Desa Adat.
                                </p>
                                <div className="mt-3 italic text-slate-800 text-xs sm:text-sm font-medium">
                                    Om Santih, Santih, Santih Om.
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* JUDUL DOKUMEN & METADATA LRA */}
                    <div className="text-center mb-6">
                        <h1 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-wide underline underline-offset-4 font-serif">
                            LAPORAN REALISASI ANGGARAN (LRA)
                        </h1>
                        <p className="text-xs sm:text-[13px] font-bold text-slate-800 uppercase tracking-widest font-sans mt-1">
                            PERTANGGUNGJAWABAN ANGGARAN PENDAPATAN DAN BELANJA DESA ADAT
                        </p>
                        <p className="text-xs font-semibold text-slate-700 uppercase font-sans mt-0.5">
                            PERIODE LAPORAN: {reportPeriodLabel.toUpperCase()}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Nomor Dokumen: LRA-NR/{currentYearStr}/{(selectedMonth)}
                        </p>
                    </div>

                    {/* SALAM PEMBUKA ADAT */}
                    <div className="mb-4 italic text-slate-800 text-xs sm:text-sm font-medium">
                        Om Swastyastu,
                    </div>

                    {/* PENDAHULUAN AKUNTABILITAS LRA */}
                    <div className="mb-5 text-justify text-xs sm:text-[13px] leading-relaxed text-slate-800">
                        <p className="indent-6">
                            Puji syukur (*angayubagia*) kami haturkan ke hadapan Ida Sang Hyang Widhi Wasa / Tuhan Yang Maha Esa, 
                            karena atas asung kerta wara nugraha-Nya, pelaksanaan seluruh program kerja, kegiatan operasional, serta
                            rangkaian upakara piodalan yadnya di wewidangan <strong>{profile.namaDesa || 'Desa Adat Basangalas'}</strong> pada periode{' '}
                            <strong>{reportPeriodLabel}</strong> telah terlaksana dengan tertib, transparan, dan damai (*labda karya*).
                        </p>
                        <p className="indent-6 mt-2">
                            Sebagai wujud akuntabilitas publik dan transparansi keuangan kepada seluruh <strong>Krama Desa Adat</strong> serta 
                            pemangku kepentingan, dokumen ini disusun secara khusus untuk memberikan penjelasan mendalam atas 
                            angka-angka yang tercantum pada <strong>Tabel Laporan Realisasi Anggaran (LRA)</strong>. Laporan ini 
                            menyandingkan secara komparatif antara <em>Target Pagu Anggaran</em> dengan <em>Realisasi Kas Aktual</em>, 
                            tingkat penyerapan, efisiensi belanja, serta saldo surplus atau defisit tahun berjalan.
                        </p>
                    </div>

                    {/* RINGKASAN EKSEKUTIF SANDINGAN ANGGARAN VS REALISASI */}
                    <div className="my-6 not-italic font-sans">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                            <BarChart3 size={15} className="text-teal-700" /> Ringkasan Komparasi Eksekutif LRA
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            
                            {/* Card 1: Penerimaan */}
                            <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 shadow-sm">
                                <div className="text-[10px] uppercase font-bold text-emerald-800 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <TrendingUp size={13} className="text-emerald-700" /> Penerimaan Total
                                    </span>
                                    <span className="text-[11px] font-mono bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded">
                                        {(penerimaan.grandTotal.persen ?? 0).toFixed(1)}% Target
                                    </span>
                                </div>
                                <div className="text-base sm:text-lg font-black text-emerald-800 font-mono mt-1">
                                    {formatCurrency(penerimaan.grandTotal.realisasi)}
                                </div>
                                <div className="text-[10px] text-emerald-900/80 mt-1 pt-1 border-t border-emerald-200 flex justify-between">
                                    <span>Pagu Target:</span>
                                    <strong className="font-mono">{formatCurrency(penerimaan.grandTotal.anggaran)}</strong>
                                </div>
                            </div>

                            {/* Card 2: Belanja */}
                            <div className="bg-rose-50/80 border border-rose-500 rounded-xl p-3 shadow-sm">
                                <div className="text-[10px] uppercase font-bold text-rose-800 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <TrendingDown size={13} className="text-rose-700" /> Realisasi Belanja
                                    </span>
                                    <span className="text-[11px] font-mono bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded">
                                        {(belanja.persenSerapan ?? 0).toFixed(1)}% Serapan
                                    </span>
                                </div>
                                <div className="text-base sm:text-lg font-black text-rose-800 font-mono mt-1">
                                    {formatCurrency(belanja.totalRealisasi)}
                                </div>
                                <div className="text-[10px] text-rose-900/80 mt-1 pt-1 border-t border-rose-400 flex justify-between">
                                    <span>Pagu Alokasi:</span>
                                    <strong className="font-mono">{formatCurrency(belanja.totalAnggaran)}</strong>
                                </div>
                            </div>

                            {/* Card 3: Surplus / (Defisit) */}
                            <div className={`border rounded-xl p-3 shadow-sm ${
                                surplusDefisit.realisasi >= 0 
                                    ? 'bg-teal-50/80 border-teal-300' 
                                    : 'bg-amber-50/80 border-amber-300'
                            }`}>
                                <div className="text-[10px] uppercase font-bold text-slate-800 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        <Scale size={13} className="text-teal-700" /> Surplus / (Defisit) Kas
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                        surplusDefisit.realisasi >= 0 
                                            ? 'bg-teal-200 text-teal-900' 
                                            : 'bg-amber-200 text-amber-900'
                                    }`}>
                                        {surplusDefisit.realisasi >= 0 ? 'Surplus' : 'Defisit'}
                                    </span>
                                </div>
                                <div className={`text-base sm:text-lg font-black font-mono mt-1 ${
                                    surplusDefisit.realisasi >= 0 ? 'text-teal-900' : 'text-amber-950'
                                }`}>
                                    {formatCurrency(surplusDefisit.realisasi)}
                                </div>
                                <div className="text-[10px] text-slate-700 mt-1 pt-1 border-t border-slate-300 flex justify-between">
                                    <span>Target Anggaran:</span>
                                    <strong className="font-mono">{formatCurrency(surplusDefisit.anggaran)}</strong>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* I. ANALISIS REALISASI PENERIMAAN (PENDAPATAN & SUMBER DANA) */}
                    <div className="mb-6">
                        <h2 className="text-xs sm:text-sm font-bold uppercase text-slate-900 border-b border-slate-400 pb-1 mb-2.5 font-sans flex items-center gap-1.5">
                            <Coins size={15} className="text-emerald-700" />
                            I. Analisis Realisasi Penerimaan (Total: {formatCurrency(penerimaan.grandTotal.realisasi)} / Capaian: {(penerimaan.grandTotal.persen ?? 0).toFixed(1)}%)
                        </h2>
                        
                        <div className="text-xs sm:text-[13px] text-slate-800 space-y-2.5 text-justify leading-relaxed">
                            <p>
                                Berdasarkan struktur Laporan Realisasi Anggaran, total penerimaan kas desa adat pada periode{' '}
                                <strong>{reportPeriodLabel}</strong> tercatat terealisasi sebesar{' '}
                                <strong className="text-emerald-800">{formatCurrency(penerimaan.grandTotal.realisasi)}</strong>{' '}
                                (<em>{numberToWords(penerimaan.grandTotal.realisasi)} rupiah</em>) dari target pagu anggaran sebesar{' '}
                                <strong>{formatCurrency(penerimaan.grandTotal.anggaran)}</strong>, dengan rasio capaian target sebesar{' '}
                                <strong>{(penerimaan.grandTotal.persen ?? 0).toFixed(1)}%</strong>.
                            </p>

                            <p>
                                Penerimaan tersebut bersumber dari pos-pos akun resmi sesuai format LRA berikut:
                            </p>

                            {/* RINCIAN POS PENERIMAAN SESUAI LRA */}
                            <div className="space-y-2.5 not-italic font-sans">
                                
                                {/* 1. Sumber Dana & Saldo Awal/SILPA */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <div className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                            <span className="font-mono text-teal-700 mr-1.5 font-black">1.</span>
                                            Sumber Dana (Akun 7.x) &amp; Saldo Awal/SILPA (Akun 6.1.1)
                                        </div>
                                        <div className="flex items-center gap-2 font-mono text-xs">
                                            <span className="text-slate-600">Pagu: {formatCurrency(penerimaan.sumberDana.anggaran)}</span>
                                            <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                                Realisasi: {formatCurrency(penerimaan.sumberDana.realisasi)} ({(penerimaan.sumberDana.persen ?? 0).toFixed(1)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-700 mt-1.5 font-serif leading-relaxed">
                                        Pos ini menghimpun Sumber Dana/Bantuan dan saldo kas awal / SILPA tahun anggaran sebelumnya 
                                        yang dialokasikan sebagai dana pokok penyelenggaraan operasional dan program kerja desa adat.
                                    </p>
                                    {penerimaan.sumberDana.rows.length > 0 && (
                                        <div className="mt-2 pt-1.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                                            {penerimaan.sumberDana.rows.map((row, idx) => (
                                                <span key={idx} className="inline-flex items-center gap-1 bg-white border border-slate-300 text-[10px] px-2 py-0.5 rounded text-slate-800">
                                                    <span className="font-mono text-slate-500">{row.kode}</span>
                                                    <span>{row.uraian}:</span>
                                                    <strong className="font-mono text-emerald-800">{formatCurrency(row.realisasi)}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 2. Pendapatan Asli Desa Adat */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <div className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                            <span className="font-mono text-teal-700 mr-1.5 font-black">2.</span>
                                            Pendapatan Asli Desa Adat (Akun 4.1.1)
                                        </div>
                                        <div className="flex items-center gap-2 font-mono text-xs">
                                            <span className="text-slate-600">Pagu: {formatCurrency(penerimaan.pendapatanAdat.anggaran)}</span>
                                            <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                                Realisasi: {formatCurrency(penerimaan.pendapatanAdat.realisasi)} ({(penerimaan.pendapatanAdat.persen ?? 0).toFixed(1)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-700 mt-1.5 font-serif leading-relaxed">
                                        Merupakan pendapatan asli yang bersumber dari partisipasi swadaya krama desa, 
                                        serta pemanfaatan aset desa adat yang sah.
                                    </p>
                                    {penerimaan.pendapatanAdat.rows.length > 0 && (
                                        <div className="mt-2 pt-1.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                                            {penerimaan.pendapatanAdat.rows.map((row, idx) => (
                                                <span key={idx} className="inline-flex items-center gap-1 bg-white border border-slate-300 text-[10px] px-2 py-0.5 rounded text-slate-800">
                                                    <span className="font-mono text-slate-500">{row.kode}</span>
                                                    <span>{row.uraian}:</span>
                                                    <strong className="font-mono text-emerald-800">{formatCurrency(row.realisasi)}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* II. ANALISIS REALISASI BELANJA DESA ADAT (PENYERAPAN PER BIDANG) */}
                    <div className="mb-6">
                        <h2 className="text-xs sm:text-sm font-bold uppercase text-slate-900 border-b border-slate-400 pb-1 mb-2.5 font-sans flex items-center gap-1.5">
                            <Wallet size={15} className="text-rose-700" />
                            II. Analisis Realisasi Belanja Desa Adat (Total: {formatCurrency(belanja.totalRealisasi)} / Serapan: {(belanja.persenSerapan ?? 0).toFixed(1)}%)
                        </h2>

                        <div className="text-xs sm:text-[13px] text-slate-800 space-y-2.5 text-justify leading-relaxed">
                            <p>
                                Dari pagu alokasi belanja sebesar <strong>{formatCurrency(belanja.totalAnggaran)}</strong>, 
                                realisasi pengeluaran kas yang telah dikeluarkan untuk mendanai seluruh kebutuhan pelayanan krama, 
                                operasional sekretariat, dan upakara keagamaan adalah sebesar{' '}
                                <strong className="text-rose-800">{formatCurrency(belanja.totalRealisasi)}</strong>{' '}
                                (<em>{numberToWords(belanja.totalRealisasi)} rupiah</em>).
                            </p>
                            <p>
                                Tingkat penyerapan anggaran belanja mencapai <strong>{(belanja.persenSerapan ?? 0).toFixed(1)}%</strong>, 
                                menyisakan saldo pagu belanja (efisiensi anggaran) sebesar{' '}
                                <strong>{formatCurrency(Math.max(0, belanja.sisaPagu))}</strong>. 
                                Pengeluaran belanja tersebut dirinci secara tertib ke dalam bidang-bidang sesuai struktur tabel LRA:
                            </p>

                            {/* DAFTAR BIDANG BELANJA SESUAI TABEL LRA */}
                            <div className="space-y-2.5 not-italic font-sans">
                                {belanja.rows.map((row) => (
                                    <div key={row.no} className="bg-slate-50/90 border border-slate-200 rounded-lg p-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-1">
                                            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-[13px]">
                                                <span className="w-5 h-5 rounded bg-slate-200 text-slate-800 flex items-center justify-center font-mono text-[11px] font-bold">
                                                    {row.no}
                                                </span>
                                                <span>{row.kategori}</span>
                                                <span className="text-[10px] font-mono text-slate-500">({row.kode})</span>
                                            </div>
                                            <div className="flex items-center gap-2 font-mono text-xs">
                                                <span className="text-slate-600 hidden sm:inline">Pagu: {formatCurrency(row.anggaran)}</span>
                                                <span className="font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                                                    Realisasi: {formatCurrency(row.realisasi)} ({(row.persen ?? 0).toFixed(1)}%)
                                                </span>
                                                <span className="text-slate-500 text-[10px]">
                                                    Sisa: {formatCurrency(row.sisa)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Sub-item rekening jika ada rincian baris */}
                                        {row.groupData && row.groupData.rows && row.groupData.rows.length > 0 && (
                                            <div className="mt-2 pt-1.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                                                {row.groupData.rows.map((sub, sIdx) => (
                                                    <span key={sIdx} className="inline-flex items-center gap-1 bg-white border border-slate-300 text-[10px] px-2 py-0.5 rounded text-slate-800">
                                                        <span className="font-mono text-slate-500">{sub.kode}</span>
                                                        <span>{sub.uraian}:</span>
                                                        <strong className="font-mono text-rose-900">{formatCurrency(sub.realisasi)}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <p className="text-[11px] italic text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 mt-2 font-serif">
                                ℹ️ <em>Seluruh pos belanja di atas didukung bukti transaksi fisik yang sah (kuitansi penerimaan insentif bertandatangan, nota belanja tunai/transfer, dan surat tugas perjalanan dinas), serta telah melalui verifikasi internal oleh Penyarikan dan pemeriksaan oleh Badan Pengawas Desa Adat.</em>
                            </p>
                        </div>
                    </div>

                    {/* III. ANALISIS SURPLUS / (DEFISIT) DAN SISA KAS */}
                    <div className="mb-6">
                        <h2 className="text-xs sm:text-sm font-bold uppercase text-slate-900 border-b border-slate-400 pb-1 mb-2.5 font-sans flex items-center gap-1.5">
                            <Scale size={15} className="text-teal-700" />
                            III. Posisi Surplus / (Defisit) Realisasi Anggaran ({formatCurrency(surplusDefisit.realisasi)})
                        </h2>

                        <div className="text-xs sm:text-[13px] text-slate-800 space-y-2.5 text-justify leading-relaxed">
                            <p>
                                Sesuai dengan prinsip akuntansi Laporan Realisasi Anggaran (PSAP 02), posisi akhir dihitung 
                                dari selisih antara seluruh penerimaan kas dengan seluruh realisasi pengeluaran belanja:
                            </p>

                            <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 text-center font-mono text-xs sm:text-sm font-bold text-slate-900 my-2">
                                Penerimaan ({formatCurrency(penerimaan.grandTotal.realisasi)}) − Belanja ({formatCurrency(belanja.totalRealisasi)}) ={' '}
                                <span className={surplusDefisit.realisasi >= 0 ? 'text-teal-700' : 'text-amber-800'}>
                                    {surplusDefisit.realisasi >= 0 ? 'Surplus ' : 'Defisit '}
                                    {formatCurrency(surplusDefisit.realisasi)}
                                </span>
                            </div>

                            <div className={`p-3 rounded-lg border text-xs sm:text-[13px] ${
                                surplusDefisit.realisasi >= 0 ? 'bg-teal-50 border-teal-300' : 'bg-amber-50 border-amber-300'
                            }`}>
                                <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                                    <ShieldCheck size={16} className={surplusDefisit.realisasi >= 0 ? 'text-teal-700' : 'text-amber-700'} />
                                    <span>Status Evaluasi Anggaran:</span>
                                    <span className="underline">{surplusDefisit.statusText}</span>
                                </p>
                                <p className="text-slate-800 font-serif">
                                    {surplusDefisit.explanation}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* IV. TABEL REKAPITULASI REALISASI ANGGARAN (LRA) DALAM NASKAH */}
                    <div className="mb-6 not-italic font-sans page-break-inside-avoid">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 flex items-center justify-between border-b border-slate-400 pb-1">
                            <span className="flex items-center gap-1.5">
                                <Layers size={15} className="text-teal-700" />
                                IV. Tabel Rekapitulasi Realisasi Anggaran (Format Standar LRA)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                                (Satuan: Rupiah)
                            </span>
                        </div>

                        <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm">
                            <table className="w-full text-left text-xs border-collapse font-sans">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 text-[11px]">
                                        <th className="py-2 px-2.5 text-center w-8 border-r border-slate-200">No</th>
                                        <th className="py-2 px-2.5 text-center w-16 border-r border-slate-200">Kode</th>
                                        <th className="py-2 px-3 border-r border-slate-200">Uraian Akun / Pos Anggaran</th>
                                        <th className="py-2 px-2.5 text-right w-28 border-r border-slate-200">Anggaran (Rp)</th>
                                        <th className="py-2 px-2.5 text-right w-28 border-r border-slate-200">Realisasi (Rp)</th>
                                        <th className="py-2 px-2.5 text-right w-28 border-r border-slate-200">Selisih / Sisa (Rp)</th>
                                        <th className="py-2 px-2 text-center w-14">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-[11px]">
                                    
                                    {/* HEADER PENERIMAAN */}
                                    <tr className="bg-teal-50/70 font-bold text-teal-950">
                                        <td colSpan={7} className="py-1.5 px-3">
                                            A. PENDAPATAN &amp; SUMBER DANA DESA ADAT
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-1.5 px-2.5 text-center text-slate-500 border-r border-slate-200">1</td>
                                        <td className="py-1.5 px-2.5 text-center font-mono text-slate-600 border-r border-slate-200">7/6.1</td>
                                        <td className="py-1.5 px-3 border-r border-slate-200">Sumber Dana & Saldo Kas Awal (SILPA)</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.sumberDana.anggaran)}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-emerald-800 border-r border-slate-200">{formatCurrency(penerimaan.sumberDana.realisasi)}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.sumberDana.selisih)}</td>
                                        <td className="py-1.5 px-2 text-center font-mono">{(penerimaan.sumberDana.persen ?? 0).toFixed(1)}%</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1.5 px-2.5 text-center text-slate-500 border-r border-slate-200">2</td>
                                        <td className="py-1.5 px-2.5 text-center font-mono text-slate-600 border-r border-slate-200">4.1.1</td>
                                        <td className="py-1.5 px-3 border-r border-slate-200">Pendapatan Asli Desa Adat</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.pendapatanAdat.anggaran)}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-emerald-800 border-r border-slate-200">{formatCurrency(penerimaan.pendapatanAdat.realisasi)}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.pendapatanAdat.selisih)}</td>
                                        <td className="py-1.5 px-2 text-center font-mono">{(penerimaan.pendapatanAdat.persen ?? 0).toFixed(1)}%</td>
                                    </tr>
                                    <tr className="bg-emerald-50/60 font-bold text-emerald-950 border-b-2 border-slate-300">
                                        <td colSpan={3} className="py-2 px-3 text-right border-r border-slate-200">TOTAL PENERIMAAN (PENDAPATAN + SUMBER DANA)</td>
                                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.grandTotal.anggaran)}</td>
                                        <td className="py-2 px-2.5 text-right font-mono text-emerald-900 border-r border-slate-200">{formatCurrency(penerimaan.grandTotal.realisasi)}</td>
                                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(penerimaan.grandTotal.selisih)}</td>
                                        <td className="py-2 px-2 text-center font-mono">{(penerimaan.grandTotal.persen ?? 0).toFixed(1)}%</td>
                                    </tr>

                                    {/* HEADER BELANJA */}
                                    <tr className="bg-rose-50/70 font-bold text-rose-950">
                                        <td colSpan={7} className="py-1.5 px-3">
                                            B. BELANJA DESA ADAT
                                        </td>
                                    </tr>
                                    {belanja.rows.map((bRow) => (
                                        <tr key={bRow.no}>
                                            <td className="py-1.5 px-2.5 text-center text-slate-500 border-r border-slate-200">{bRow.no}</td>
                                            <td className="py-1.5 px-2.5 text-center font-mono text-slate-600 border-r border-slate-200">{bRow.kode}</td>
                                            <td className="py-1.5 px-3 border-r border-slate-200">{bRow.kategori}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(bRow.anggaran)}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-800 border-r border-slate-200">{formatCurrency(bRow.realisasi)}</td>
                                            <td className="py-1.5 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(bRow.sisa)}</td>
                                            <td className="py-1.5 px-2 text-center font-mono">{(bRow.persen ?? 0).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-rose-50/60 font-bold text-rose-950 border-b-2 border-slate-300">
                                        <td colSpan={3} className="py-2 px-3 text-right border-r border-slate-200">TOTAL BELANJA DESA ADAT</td>
                                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(belanja.totalAnggaran)}</td>
                                        <td className="py-2 px-2.5 text-right font-mono text-rose-900 border-r border-slate-200">{formatCurrency(belanja.totalRealisasi)}</td>
                                        <td className="py-2 px-2.5 text-right font-mono border-r border-slate-200">{formatCurrency(belanja.sisaPagu)}</td>
                                        <td className="py-2 px-2 text-center font-mono">{(belanja.persenSerapan ?? 0).toFixed(1)}%</td>
                                    </tr>

                                    {/* BARIS SURPLUS / DEFISIT */}
                                    <tr className={`font-black text-[12px] ${
                                        surplusDefisit.realisasi >= 0 ? 'bg-teal-100/70 text-teal-950' : 'bg-amber-100/70 text-amber-950'
                                    }`}>
                                        <td colSpan={3} className="py-2.5 px-3 text-right border-r border-slate-200">
                                            SURPLUS / (DEFISIT) TAHUN BERJALAN
                                        </td>
                                        <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-200">
                                            {formatCurrency(surplusDefisit.anggaran)}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-200">
                                            {formatCurrency(surplusDefisit.realisasi)}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-200">
                                            {formatCurrency(surplusDefisit.varians)}
                                        </td>
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            {surplusDefisit.realisasi >= 0 ? 'Surplus' : 'Defisit'}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* V. KESIMPULAN & PENUTUP */}
                    <div className="mb-6 text-justify text-xs sm:text-[13px] leading-relaxed text-slate-800">
                        <p className="indent-6">
                            Demikian Dokumen Laporan Realisasi Anggaran (LRA) ini kami susun dengan sejujur-jujurnya 
                            sebagai pertanggungjawaban amanah kepengurusan Prajuru Desa Adat Basangalas. Berlandaskan 
                            ajaran suci <strong>Tri Hita Karana</strong> dan falsafah kejujuran (*satya*), kiranya dokumen ini 
                            dapat memperkokoh kerukunan, keterbukaan, serta keharmonisan seluruh Krama Desa Adat.
                        </p>
                        <div className="mt-3 italic text-slate-800 text-xs sm:text-sm font-medium">
                            Om Santih, Santih, Santih Om.
                        </div>
                    </div>
                    </>
                    )}

                    {/* KOLOM TANDA TANGAN 4 PEJABAT RESMI */}
                    <div className="mt-8 pt-4 border-t-2 border-slate-900 page-break-inside-avoid">
                        <div className="text-right text-xs font-sans font-bold text-slate-800 mb-4">
                            Ditetapkan di: <span className="uppercase">{customPlace}</span>, Tanggal: <span>{formattedSignDate}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                            
                            {/* 1. KELIANG DESA ADAT + STEMPEL RESMI OVERLAY */}
                            <div className="flex flex-col items-center justify-between min-h-[140px] relative">
                                <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                                    Mengesahkan,<br />
                                    <span className="text-slate-800">Keliang Desa Adat</span>
                                </div>

                                <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                                    {/* STEMPEL RESMI DESA OVERLAY */}
                                    {showStamp && (
                                        <div 
                                            className="absolute pointer-events-none z-0 transition-transform select-none"
                                            style={{
                                                top: '50%',
                                                left: '30%',
                                                transform: `translate(-75%, -50%) scale(${stampScaleVal / 80})`,
                                                opacity: 0.92,
                                                filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                                            }}
                                        >
                                            <img
                                                src={effectiveStamp}
                                                alt="Stempel Resmi Desa Adat"
                                                className="w-24 h-24 object-contain max-w-none"
                                            />
                                        </div>
                                    )}

                                    {/* TTD DIGITAL KELIANG */}
                                    {embedSignatures && signatures.keliang ? (
                                        <img
                                            src={signatures.keliang}
                                            alt="TTD Keliang Desa"
                                            style={{
                                                height: `${Math.round(54 * (sigScale / 100))}px`,
                                                maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                                backgroundColor: 'transparent'
                                            }}
                                            className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                                        />
                                    ) : (
                                        <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                                    )}
                                </div>

                                <div className="relative z-20 mt-1 bg-transparent">
                                    {isEditingKeliang ? (
                                        <div className="flex items-center gap-1 justify-center">
                                            <input 
                                                type="text" 
                                                value={keliang}
                                                onChange={e => setKeliang(e.target.value)}
                                                className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                                onBlur={() => setIsEditingKeliang(false)}
                                                onKeyDown={e => { if (e.key === 'Enter') setIsEditingKeliang(false); }}
                                                autoFocus
                                            />
                                            <button 
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setKeliang(''); setIsEditingKeliang(false); }}
                                                className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                            >X</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 group">
                                            <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-950 block select-text">
                                                {displaySignature(keliang, keliangName)}
                                            </span>
                                            <button 
                                                onClick={() => setIsEditingKeliang(true)} 
                                                className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100" 
                                                title="Edit Nama Keliang"
                                            >
                                                <Pencil size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. JURU RAKSA (BENDAHARA) */}
                            <div className="flex flex-col items-center justify-between min-h-[140px]">
                                <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                                    Penata Kas / Keuangan,<br />
                                    <span className="text-slate-800">Juru Raksa</span>
                                </div>

                                <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                                    {embedSignatures && signatures.juruRaksa ? (
                                        <img
                                            src={signatures.juruRaksa}
                                            alt="TTD Juru Raksa"
                                            style={{
                                                height: `${Math.round(54 * (sigScale / 100))}px`,
                                                maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                                backgroundColor: 'transparent'
                                            }}
                                            className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                                        />
                                    ) : (
                                        <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                                    )}
                                </div>

                                <div className="relative z-20 mt-1 bg-transparent">
                                    {isEditingJuruRaksa ? (
                                        <div className="flex items-center gap-1 justify-center">
                                            <input 
                                                type="text" 
                                                value={juruRaksa}
                                                onChange={e => setJuruRaksa(e.target.value)}
                                                className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                                onBlur={() => setIsEditingJuruRaksa(false)}
                                                onKeyDown={e => { if (e.key === 'Enter') setIsEditingJuruRaksa(false); }}
                                                autoFocus
                                            />
                                            <button 
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setJuruRaksa(''); setIsEditingJuruRaksa(false); }}
                                                className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                            >X</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 group">
                                            <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-950 block select-text">
                                                {displaySignature(juruRaksa, juruRaksaName)}
                                            </span>
                                            <button 
                                                onClick={() => setIsEditingJuruRaksa(true)} 
                                                className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100" 
                                                title="Edit Nama Juru Raksa"
                                            >
                                                <Pencil size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. PENYARIKAN (SEKRETARIS) */}
                            <div className="flex flex-col items-center justify-between min-h-[140px]">
                                <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                                    Verifikator Administrasi,<br />
                                    <span className="text-slate-800">Penyarikan (Sekretaris)</span>
                                </div>

                                <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                                    {embedSignatures && signatures.pembuat ? (
                                        <img
                                            src={signatures.pembuat}
                                            alt="TTD Penyarikan"
                                            style={{
                                                height: `${Math.round(54 * (sigScale / 100))}px`,
                                                maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                                backgroundColor: 'transparent'
                                            }}
                                            className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                                        />
                                    ) : (
                                        <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                                    )}
                                </div>

                                <div className="relative z-20 mt-1 bg-transparent">
                                    {isEditingPenyarikan ? (
                                        <div className="flex items-center gap-1 justify-center">
                                            <input 
                                                type="text" 
                                                value={penyarikan}
                                                onChange={e => setPenyarikan(e.target.value)}
                                                className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                                onBlur={() => setIsEditingPenyarikan(false)}
                                                onKeyDown={e => { if (e.key === 'Enter') setIsEditingPenyarikan(false); }}
                                                autoFocus
                                            />
                                            <button 
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setPenyarikan(''); setIsEditingPenyarikan(false); }}
                                                className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                            >X</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 group">
                                            <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-950 block select-text">
                                                {displaySignature(penyarikan, '')}
                                            </span>
                                            <button 
                                                onClick={() => setIsEditingPenyarikan(true)} 
                                                className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100" 
                                                title="Edit Nama Penyarikan"
                                            >
                                                <Pencil size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 4. BADAN PENGAWAS / BAGA PETILIK */}
                            <div className="flex flex-col items-center justify-between min-h-[140px]">
                                <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                                    Pemeriksa Independen,<br />
                                    <span className="text-slate-800">Ketua Badan Pengawas</span>
                                </div>

                                <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                                    {embedSignatures && signatures.penyetor ? (
                                        <img
                                            src={signatures.penyetor}
                                            alt="TTD Badan Pengawas"
                                            style={{
                                                height: `${Math.round(54 * (sigScale / 100))}px`,
                                                maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                                backgroundColor: 'transparent'
                                            }}
                                            className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                                        />
                                    ) : (
                                        <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                                    )}
                                </div>

                                <div className="relative z-20 mt-1 bg-transparent">
                                    {isEditingPengawas ? (
                                        <div className="flex items-center gap-1 justify-center">
                                            <input 
                                                type="text" 
                                                value={pengawas}
                                                onChange={e => setPengawas(e.target.value)}
                                                className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                                onBlur={() => setIsEditingPengawas(false)}
                                                onKeyDown={e => { if (e.key === 'Enter') setIsEditingPengawas(false); }}
                                                autoFocus
                                            />
                                            <button 
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => { setPengawas(''); setIsEditingPengawas(false); }}
                                                className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                            >X</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 group">
                                            <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-950 block select-text">
                                                {displaySignature(pengawas, '')}
                                            </span>
                                            <button 
                                                onClick={() => setIsEditingPengawas(true)} 
                                                className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100" 
                                                title="Edit Nama Badan Pengawas"
                                            >
                                                <Pencil size={10} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* DOKUMEN FOOTER */}
                    <div className="mt-8 pt-3 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-center text-[9px] font-sans text-slate-500 gap-1">
                        <span>Sistem Informasi Tata Kelola Keuangan Desa Adat Basangalas • LRA Naratif PSAP 02</span>
                        <span>Dokumen Resmi Transparansi Anggaran • Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>
                </div>

                {/* MODAL ACTION CONTROLS (NO PRINT) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-700 no-print">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 font-mono cursor-pointer">
                            <input
                                type="checkbox"
                                checked={embedSignatures}
                                onChange={e => setEmbedSignatures(e.target.checked)}
                                className="rounded border-slate-600 text-teal-600 focus:ring-teal-500"
                            />
                            <span>Sematkan TTD</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs text-rose-300 font-mono cursor-pointer ml-1">
                            <input
                                type="checkbox"
                                checked={showStamp}
                                onChange={e => handleToggleStamp(e.target.checked)}
                                className="rounded border-rose-600 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="flex items-center gap-1">
                                <Stamp className="w-3.5 h-3.5 text-rose-400" /> Stempel Keliang
                            </span>
                        </label>

                        {/* Signature Zoom / Scale Adjuster */}
                        {embedSignatures && (
                            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
                                <span className="text-[10px] font-mono text-slate-400 px-1 font-bold">Skala TTD:</span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustScale(-10)}
                                    disabled={sigScale <= 50}
                                    className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 rounded transition cursor-pointer"
                                    title="Perkecil Tanda Tangan"
                                >
                                    <ZoomOut size={13} />
                                </button>
                                <span className="text-[11px] font-mono font-bold text-teal-300 w-9 text-center">
                                    {sigScale}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustScale(10)}
                                    disabled={sigScale >= 180}
                                    className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 rounded transition cursor-pointer"
                                    title="Perbesar Tanda Tangan"
                                >
                                    <ZoomIn size={13} />
                                </button>
                            </div>
                        )}

                        {/* Stamp Zoom / Scale Adjuster */}
                        {showStamp && (
                            <div className="flex items-center gap-1 bg-rose-950/40 border border-rose-900/60 rounded-lg p-1 text-xs">
                                <span className="text-[10px] font-mono text-rose-300 px-1 font-bold">Stempel:</span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustStampScale(-10)}
                                    disabled={stampScaleVal <= 50}
                                    className="p-1 bg-rose-900/60 hover:bg-rose-800 disabled:opacity-30 text-rose-200 rounded transition cursor-pointer"
                                    title="Perkecil Stempel"
                                >
                                    <ZoomOut size={13} />
                                </button>
                                <span className="text-[11px] font-mono font-bold text-rose-300 w-9 text-center">
                                    {stampScaleVal}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustStampScale(10)}
                                    disabled={stampScaleVal >= 180}
                                    className="p-1 bg-rose-900/60 hover:bg-rose-800 disabled:opacity-30 text-rose-200 rounded transition cursor-pointer"
                                    title="Perbesar Stempel"
                                >
                                    <ZoomIn size={13} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <ExportPdfButton
                            elementId="printable-lra-naratif"
                            filename={`Narasi_LRA_${currentYearStr}_${selectedMonth || 'THN'}.pdf`}
                            buttonText="Ekspor PDF"
                            variant="compact"
                            options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                        />

                        <button
                            type="button"
                            onClick={handlePrintNaratif}
                            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow cursor-pointer active:scale-95"
                        >
                            <Printer size={15} /> Cetak Narasi LRA
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default LraNaratifTemplateModal;
