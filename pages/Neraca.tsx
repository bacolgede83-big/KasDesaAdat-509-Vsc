
import React, { useMemo, useState, useEffect } from 'react';
import type { BkuData, JuDisplayRow } from '../types';
import { formatCurrency, formatDate } from '../utils/formatter';
import { Printer, Scale, Calendar, Download, Settings, RotateCcw, Wallet, Filter, Search, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, FileText, FileDown, Calculator, Eye, EyeOff, CheckCircle2, TrendingUp, ShieldCheck, ArrowRightLeft, Layers, Info } from 'lucide-react';
import Modal from '../components/shared/Modal';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import { REFERENSI_REKENING } from '../constants';
import ExportPdfButton from '../components/shared/ExportPdfButton';
import FormulirNaratifKalkulasi from '../components/neraca/FormulirNaratifKalkulasi';
import type { OpsiPerhitunganData } from '../components/neraca/OpsiPerhitunganNeraca';
import { 
    getStoredSignatures, 
    getSignatureSettings, 
    getEffectiveStamp, 
    DigitalSignatures, 
    SignatureSettings 
} from '../utils/signatureStorage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare const XLSX: any;

interface NeracaProps {
    bkuData: BkuData[];
    entries: JuDisplayRow[];
}

const Neraca: React.FC<NeracaProps> = ({ bkuData, entries }) => {
    const { showPermissionDenied } = useNotification();
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFilename, setExportFilename] = useState('');
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('neraca_keliangName') || 'I Made Mudita');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('neraca_juruRaksaName') || 'I Putu Gede Sutrana');
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('neraca_customPlace') || 'Basangalas');
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('neraca_signatureDate') || new Date().toISOString().split('T')[0]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Digital Signatures & Official Stamp from global settings
    const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
    const [sigSettings, setSigSettings] = useState<SignatureSettings>(() => getSignatureSettings());

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

    const embedSignatures = sigSettings.autoEmbed !== false;
    const showStamp = sigSettings.showStampOverlay !== false;
    const effectiveStamp = getEffectiveStamp(signatures, 'DESA ADAT BASANGALAS');
    const [showSuspects, setShowSuspects] = useState(true);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [showRingkasanSingkat, setShowRingkasanSingkat] = useState(true);
    const [showKalkulasi, setShowKalkulasi] = useState(false);

    const [showOpsiPerhitungan, setShowOpsiPerhitungan] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('neraca_show_opsi_perhitungan');
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    const toggleOpsiPerhitungan = () => {
        setShowOpsiPerhitungan(prev => {
            const next = !prev;
            try {
                localStorage.setItem('neraca_show_opsi_perhitungan', JSON.stringify(next));
            } catch (e) {
                console.error(e);
            }
            return next;
        });
    };

    const [tempKeliangName, setTempKeliangName] = useState(keliangName);
    const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
    const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
    const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);

    const handleOpenSettings = () => {
        setTempKeliangName(keliangName);
        setTempJuruRaksaName(juruRaksaName);
        setTempCustomPlace(customPlace);
        setTempSignatureDate(signatureDate);
        setIsSettingsOpen(true);
    };

    const handleSaveSettings = () => {
        setKeliangName(tempKeliangName);
        setJuruRaksaName(tempJuruRaksaName);
        setCustomPlace(tempCustomPlace);
        setSignatureDate(tempSignatureDate);

        localStorage.setItem('neraca_keliangName', tempKeliangName);
        localStorage.setItem('neraca_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('neraca_customPlace', tempCustomPlace);
        localStorage.setItem('neraca_signatureDate', tempSignatureDate);

        setIsSettingsOpen(false);
        setNotification({ message: 'Pengaturan tanda tangan Neraca berhasil disimpan!', type: 'success' });
    };

    // Sync reportDate when Month/Year changes
    useEffect(() => {
        if (selectedMonth && selectedYear) {
            // Set to last day of the selected month
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);
            const lastDay = new Date(year, month, 0).getDate();
            const formattedDate = `${year}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
            setReportDate(formattedDate);
        }
    }, [selectedMonth, selectedYear]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        years.add(new Date().getFullYear().toString());
        entries.forEach(e => {
            if (e.date) {
                const y = e.date.split('-')[0];
                if (y) years.add(y);
            }
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [entries]);

    const monthsList = [
        { val: '01', label: 'Januari' }, { val: '02', label: 'Februari' }, { val: '03', label: 'Maret' },
        { val: '04', label: 'April' }, { val: '05', label: 'Mei' }, { val: '06', label: 'Juni' },
        { val: '07', label: 'Juli' }, { val: '08', label: 'Agustus' }, { val: '09', label: 'September' },
        { val: '10', label: 'Oktober' }, { val: '11', label: 'November' }, { val: '12', label: 'Desember' }
    ];

    const handleResetFilter = () => {
        const today = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear().toString();
        setSelectedYear(currentYear);
        setSelectedMonth('');
        setReportDate(today);
        setIsRefreshing(true);
        setTimeout(() => {
            setIsRefreshing(false);
            setNotification({ 
                message: `Filter tanggal Neraca berhasil direset ke tanggal sistem saat ini (${formatDate(today)}).`, 
                type: 'success' 
            });
        }, 400);
    };

    const financialReport = useMemo(() => {
        const balances: Record<string, number> = {};
        const filteredEntries = entries.filter(e => e.date && e.date <= reportDate);

        // Calculate standard balances for all accounts
        filteredEntries.forEach(e => {
            const rawCode = (e.kodeRekening || '').trim();
            if (!rawCode) return;
            const cleanCode = rawCode.split(' - ')[0].trim();
            if (!balances[cleanCode]) balances[cleanCode] = 0;
            if (rawCode !== cleanCode && !balances[rawCode]) balances[rawCode] = 0;
            const debetVal = Number(e.debet) || 0;
            const kreditVal = Number(e.kredit) || 0;

            if (cleanCode.startsWith('1')) {
                balances[cleanCode] += (debetVal - kreditVal);
                if (rawCode !== cleanCode) balances[rawCode] += (debetVal - kreditVal);
            } else if (cleanCode.startsWith('2') || cleanCode.startsWith('3')) {
                balances[cleanCode] += (kreditVal - debetVal);
                if (rawCode !== cleanCode) balances[rawCode] += (kreditVal - debetVal);
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

        const getAccountName = (code: string) => REFERENSI_REKENING.find(r => r.code === code.trim())?.name || `Akun ${code}`;
        
        // 1. Aset Desa Adat
        const asetPada = Object.keys(balances)
            .filter(code => code.startsWith('1.1.1'))
            .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
            .filter(i => Math.abs(i.saldo) > 0.1);
            
        const totalAsetKas = asetPada.reduce((s, i) => s + i.saldo, 0);

        // Piutang (All 1.2)
        const asetPiutang = Object.keys(balances)
            .filter(code => code.startsWith('1.2'))
            .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
            .filter(i => Math.abs(i.saldo) > 0.1);
        const totalAsetPiutang = asetPiutang.reduce((s, i) => s + i.saldo, 0);

        // Aset Lainnya (Other 1.x)
        const asetLainnya = Object.keys(balances)
            .filter(code => code.startsWith('1.1.2'))
            .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
            .filter(i => Math.abs(i.saldo) > 0.1);
        const totalAsetLainnya = asetLainnya.reduce((s, i) => s + i.saldo, 0);

        // 2. Kas Total Juru Raksa(Tunai)
        const kasJuruRaksaTunai = { code: '1.1.1.02', name: getAccountName('1.1.1.02'), saldo: balances['1.1.1.02'] || 0 };
        const totalJuruRaksaTunai = Number(kasJuruRaksaTunai.saldo) || 0;
        
        const totalAsetAktif = totalAsetKas + totalAsetPiutang + totalAsetLainnya;

        // Special Kas Program (Tempekan & SHU LPD / Dana Pembangunan Desa)
        const saldoTempekanVal = balances['1.1.2.07'] || Number(localStorage.getItem('neraca_saldo_tempekan')) || 0;
        const saldoDPDVal = balances['1.1.2.06'] || Number(localStorage.getItem('neraca_saldo_shulpd')) || 0;

        const kasTempekan = { code: '1.1.2.07', name: getAccountName('1.1.2.07'), saldo: saldoTempekanVal };
        const kasDPD = { code: '1.1.2.06', name: getAccountName('1.1.2.06'), saldo: saldoDPDVal };
        const totalAsetTempekan = saldoTempekanVal;
        const totalAsetKasTempekan = saldoTempekanVal;
        const totalKasDPD = saldoDPDVal;
        const totalAsetKasSHULPD = saldoDPDVal;

        const kasPiutangDesaAdat = { code: '1.2.1.01', name: getAccountName('1.2.1.01'), saldo: balances['1.2.1.01'] || 0 };
        const totalPiutangDesaAdat = Number(kasPiutangDesaAdat.saldo) || 0;
        
        // Kalkulasi
        const totalKasBank = totalAsetKas - (Number(kasJuruRaksaTunai.saldo) || 0);
        const totalAsetLPD = totalKasBank + totalAsetLainnya;
        const totalAsetKasBank = totalAsetKas + totalAsetLainnya;
        
        // Pasiva (Kewajiban & Ekuitas)
        // Kewajiban (All 2.x)
        const kewajiban = Object.keys(balances)
            .filter(code => code.startsWith('2'))
            .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
            .filter(i => Math.abs(i.saldo) > 0.1);

        // Ekuitas (All 3.x except the surplus account itself if it was manually posted, to avoid conflict)
        const ekuitas = Object.keys(balances)
            .filter(code => code.startsWith('3') && code !== '3.1.1.07')
            .map(code => ({ code, name: getAccountName(code), saldo: balances[code] || 0 }))
            .filter(i => Math.abs(i.saldo) > 0.1);

        const totalKewajiban = kewajiban.reduce((s, i) => s + i.saldo, 0);
        // Add manual surplus account balance if exists, then add calculated surplus
        const manualSurplusBalance = balances['3.1.1.07'] || 0;
        const totalEkuitas = ekuitas.reduce((s, i) => s + i.saldo, 0) + manualSurplusBalance + surplusDefisit;

        return { 
            entryCount: filteredEntries.length,
            asetPada,
            kasJuruRaksaTunai,
            totalJuruRaksaTunai,
            totalAsetKas,
            totalAsetAktif,
            totalAsetKasBank,
            asetPiutang, 
            totalAsetPiutang,
            totalPiutangDesaAdat,
            asetLainnya,
            totalAsetLainnya,
            totalKasBank,
            totalAsetLPD,
            kasTempekan,
            totalAsetTempekan,
            totalAsetKasTempekan,
            kasDPD,
            totalKasDPD,
            totalAsetKasSHULPD,
            asetTempekan: [kasTempekan],
            kewajiban, totalKewajiban, ekuitas, surplusDefisit, manualSurplusBalance, 
            totalAset: totalAsetAktif, totalEkuitas, totalPasiva: totalKewajiban + totalEkuitas
        };
    }, [entries, reportDate]);

    const opsiPerhitunganData: OpsiPerhitunganData = useMemo(() => {
        const filteredEntries = entries.filter(e => e.date && e.date <= reportDate);
        const totalHutang = Math.abs(financialReport.totalKewajiban);

        // Akun kas penerimaan pendapatan (Punia Tunai 1.1.1.04, Transfer 1.1.1.05, Sasah Abu 1.1.1.03, Barang 1.1.1.06, Lainnya 1.1.1.09)
        const revenueCashCodes = ['1.1.1.03', '1.1.1.04', '1.1.1.05', '1.1.1.06', '1.1.1.09'];
        let pendapatanMasukKas = 0;
        let pendapatanTerpakai = 0;

        filteredEntries.forEach(e => {
            const code = (e.kodeRekening || '').trim();
            const debetVal = Number(e.debet) || 0;
            const kreditVal = Number(e.kredit) || 0;

            if (revenueCashCodes.includes(code)) {
                pendapatanMasukKas += debetVal;
                pendapatanTerpakai += kreditVal;
            }
        });

        // Total pendapatan dari akun 4.x
        let totalPendapatanAkun4 = 0;
        let totalBelanja = 0;
        let totalSumberDana = 0;

        filteredEntries.forEach(e => {
            const code = (e.kodeRekening || '').trim();
            const debetVal = Number(e.debet) || 0;
            const kreditVal = Number(e.kredit) || 0;

            if (code.startsWith('4')) totalPendapatanAkun4 += (kreditVal - debetVal);
            if (code.startsWith('5')) totalBelanja += (debetVal - kreditVal);
            if (code.startsWith('7')) totalSumberDana += (kreditVal - debetVal);
        });

        const totalPendapatan = Math.max(pendapatanMasukKas, totalPendapatanAkun4);
        const saldoKasPendapatan = Math.max(0, pendapatanMasukKas - pendapatanTerpakai);
        const saldoKasJuruRaksa = financialReport.kasJuruRaksaTunai.saldo;

        // Estimasi Kebutuhan Sumber Dana
        const estimasiSumberDana = pendapatanTerpakai > 0
            ? pendapatanTerpakai
            : (totalBelanja > totalSumberDana ? (totalBelanja - totalSumberDana) : totalBelanja);

        return {
            totalHutang,
            hasHutang: totalHutang > 0,
            totalPendapatan,
            pendapatanTerpakai,
            saldoKasPendapatan,
            totalBelanja,
            totalSumberDana,
            saldoKasJuruRaksa,
            estimasiSumberDana,
            kewajibanList: financialReport.kewajiban
        };
    }, [entries, reportDate, financialReport]);

    const absSelisih = Math.abs(financialReport.totalAset - financialReport.totalPasiva);
    const isBalanced = absSelisih < 1;

    const suspectTransactions = useMemo(() => {
        if (isBalanced) return [];

        const filteredEntries = entries.filter(e => e.date && e.date <= reportDate);
        const suspects: Array<{
            id: string;
            idTransaksi?: string;
            date: string;
            uraian: string;
            kodeRekening?: string;
            debet: number;
            kredit: number;
            reason: string;
        }> = [];

        // Group entries by idTransaksi or rowId
        const grouped = new Map<string, JuDisplayRow[]>();
        filteredEntries.forEach(e => {
            const key = e.idTransaksi || e.rowId;
            const list = grouped.get(key) || [];
            list.push(e);
            grouped.set(key, list);
        });

        // 1. Check groups where sum(debet) !== sum(kredit)
        grouped.forEach((rows, key) => {
            const totalDebet = rows.reduce((s, r) => s + (Number(r.debet) || 0), 0);
            const totalKredit = rows.reduce((s, r) => s + (Number(r.kredit) || 0), 0);
            const diff = Math.abs(totalDebet - totalKredit);

            if (diff > 0.01) {
                const firstRow = rows[0];
                suspects.push({
                    id: key,
                    idTransaksi: firstRow?.idTransaksi,
                    date: firstRow?.date || '-',
                    uraian: rows.map(r => r.uraian).filter(Boolean).join(' / ') || 'Transaksi Jurnal',
                    kodeRekening: Array.from(new Set(rows.map(r => r.kodeRekening).filter(Boolean))).join(', '),
                    debet: totalDebet,
                    kredit: totalKredit,
                    reason: `Debet (${formatCurrency(totalDebet)}) ≠ Kredit (${formatCurrency(totalKredit)}) - Selisih ${formatCurrency(diff)}`
                });
            }
        });

        // 2. Check individual rows with missing or non-standard account codes
        filteredEntries.forEach(row => {
            const code = (row.kodeRekening || '').trim();
            const debetVal = Number(row.debet) || 0;
            const kreditVal = Number(row.kredit) || 0;

            if (!code) {
                suspects.push({
                    id: row.rowId || Math.random().toString(),
                    idTransaksi: row.idTransaksi,
                    date: row.date || '-',
                    uraian: row.uraian || 'Tanpa Keterangan',
                    kodeRekening: 'Kosong',
                    debet: debetVal,
                    kredit: kreditVal,
                    reason: 'Kode Rekening belum diisi (data tidak terhitung di Neraca)'
                });
            } else if (!/^[1-7]/.test(code)) {
                suspects.push({
                    id: row.rowId || Math.random().toString(),
                    idTransaksi: row.idTransaksi,
                    date: row.date || '-',
                    uraian: row.uraian,
                    kodeRekening: code,
                    debet: debetVal,
                    kredit: kreditVal,
                    reason: `Kode Rekening '${code}' tidak standar (harus diawali 1-7)`
                });
            }
        });

        // Deduplicate suspects
        const seen = new Set<string>();
        return suspects.filter(s => {
            const k = `${s.id}-${s.reason}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [entries, reportDate, isBalanced]);

    const [printMode, setPrintMode] = useState<'all' | 'opsi'>('all');

    useEffect(() => {
        const handleAfterPrint = () => {
            setPrintMode('all');
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

    const handlePrintNeraca = () => {
        setPrintMode('all');
        setTimeout(() => window.print(), 50);
    };

    const handlePrintOpsi = () => {
        setShowOpsiPerhitungan(true);
        setPrintMode('opsi');
        setTimeout(() => window.print(), 50);
    };

    const handlePrint = handlePrintNeraca;

    const generatePdfReport = () => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const formattedDate = new Date(reportDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            // 1. Formal Kop Surat Header (Matching Jurnal Umum Header)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.text('DESA ADAT BASANGALAS', 105, 14, { align: 'center' });

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text('Aci Usaba Dalem', 105, 19.5, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 65, 85);
            doc.text('Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali', 105, 24, { align: 'center' });

            // Kop Surat Double Border Line
            doc.setLineWidth(0.8);
            doc.setDrawColor(15, 23, 42);
            doc.line(14, 27, 196, 27);
            doc.setLineWidth(0.2);
            doc.line(14, 28, 196, 28);

            // Document Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.text('LAPORAN NERACA KEUANGAN', 105, 34, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(`Per Tanggal: ${formattedDate}`, 105, 39, { align: 'center' });

            // 2. Status Box Summary
            const isOk = isBalanced;
            let startY = 44;

            if (isOk) {
                doc.setFillColor(240, 253, 244);
                doc.setDrawColor(16, 185, 129);
            } else {
                doc.setFillColor(254, 242, 242);
                doc.setDrawColor(239, 68, 68);
            }
            doc.setLineWidth(0.6);
            doc.roundedRect(14, startY, 182, 24, 3, 3, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            if (isOk) {
                doc.setTextColor(6, 95, 70);
                doc.text('STATUS KESEIMBANGAN: SEIMBANG (BALANCED)', 18, startY + 6);
            } else {
                doc.setTextColor(153, 27, 27);
                doc.text('STATUS KESEIMBANGAN: TIDAK SEIMBANG (UNBALANCED)', 18, startY + 6);
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(40, 40, 40);
            doc.text(`Total Aktiva: ${formatCurrency(financialReport.totalAset)}`, 18, startY + 13);
            doc.text(`Total Pasiva: ${formatCurrency(financialReport.totalPasiva)}`, 85, startY + 13);

            if (!isOk) {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(220, 38, 38);
                doc.text(`Selisih: ${formatCurrency(absSelisih)}`, 150, startY + 13);
            } else {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(16, 185, 129);
                doc.text('Selisih: Rp 0 (Pas)', 150, startY + 13);
            }

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Tanggal Diunduh: ${new Date().toLocaleString('id-ID')}`, 18, startY + 19);

            startY += 30;

            // 3. Table Aktiva (Aset)
            const aktivaRows: (string | number)[][] = [
                ['1. Aset Desa Adat', ''],
                ...financialReport.asetPada.map(i => [`   • ${i.name}`, formatCurrency(i.saldo)]),
                ['   Total Aset Desa Adat', formatCurrency(financialReport.totalAsetKas)],
                ...(financialReport.asetLainnya.length > 0 ? [
                    ['Aset Lainnya', ''],
                    ...financialReport.asetLainnya.map(i => [`   • ${i.name}`, formatCurrency(i.saldo)])
                ] : []),
                ['2. Piutang', ''],
                ...financialReport.asetPiutang.map(i => [`   • ${i.name}`, formatCurrency(i.saldo)]),
                ['3. Kas Total Juru Raksa (Tunai)', formatCurrency(financialReport.totalJuruRaksaTunai)],
            ];

            autoTable(doc, {
                startY: startY,
                head: [['RINCIAN AKTIVA (ASET)', 'JUMLAH (Rp)']],
                body: aktivaRows,
                foot: [['TOTAL AKTIVA (ASET)', formatCurrency(financialReport.totalAset)]],
                theme: 'grid',
                headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                footStyles: { fillColor: [240, 253, 250], textColor: [15, 118, 110], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { textColor: 30, fontSize: 8.5 },
                columnStyles: { 0: { cellWidth: 122 }, 1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' } },
                margin: { left: 14, right: 14 }
            });

            let currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : startY + 60;

            // 4. Table Pasiva (Kewajiban & Ekuitas)
            const pasivaRows: (string | number)[][] = [
                ['1. Kewajiban / Utang', ''],
                ...financialReport.kewajiban.map(i => [`   • ${i.name}`, formatCurrency(Math.abs(i.saldo))]),
                ['   Subtotal Kewajiban', formatCurrency(Math.abs(financialReport.totalKewajiban))],
                ['2. Ekuitas', ''],
                ...financialReport.ekuitas.map(i => [`   • ${i.name}`, formatCurrency(i.saldo)]),
                ['   Surplus/Defisit Periode Berjalan', formatCurrency(financialReport.surplusDefisit + financialReport.manualSurplusBalance)],
            ];

            autoTable(doc, {
                startY: currentY,
                head: [['RINCIAN PASIVA (KEWAJIBAN & EKUITAS)', 'JUMLAH (Rp)']],
                body: pasivaRows,
                foot: [['TOTAL PASIVA (KEWAJIBAN & EKUITAS)', formatCurrency(financialReport.totalPasiva)]],
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                footStyles: { fillColor: [239, 246, 255], textColor: [30, 58, 138], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { textColor: 30, fontSize: 8.5 },
                columnStyles: { 0: { cellWidth: 122 }, 1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' } },
                margin: { left: 14, right: 14 }
            });

            currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 60;

            // 4.5. Table Ringkasan Opsi Perhitungan & Rekonsiliasi
            const hasHutangPdf = Math.abs(financialReport.totalKewajiban) > 0;
            const opsiRows: (string | number)[][] = hasHutangPdf ? [
                ['OPSI 1: Pelunasan Hutang & Pemulihan Utuh Pendapatan', ''],
                ['   • Total Hutang / Kewajiban yang Harus Dilunasi', formatCurrency(Math.abs(financialReport.totalKewajiban))],
                ['   • Pendapatan Terpakai (Mutasi Kas Juru Raksa)', formatCurrency(opsiPerhitunganData.pendapatanTerpakai)],
                ['   • Total Kebutuhan Dana dari Sumber Dana Pokok (= Hutang + Pendapatan Terpakai)', formatCurrency(Math.abs(financialReport.totalKewajiban) + opsiPerhitunganData.pendapatanTerpakai)],
                ['OPSI 2: Pelunasan Hutang dari Hasil Pendapatan + Estimasi Sumber Dana', ''],
                ['   • Total Hutang yang Harus Dilunasi', formatCurrency(Math.abs(financialReport.totalKewajiban))],
                ['   • Alokasi Terpakai dari Hasil Pendapatan', formatCurrency(Math.min(opsiPerhitunganData.saldoKasPendapatan > 0 ? opsiPerhitunganData.saldoKasPendapatan : opsiPerhitunganData.totalPendapatan, Math.abs(financialReport.totalKewajiban)))],
                ['   • Estimasi Kekurangan yang Dibutuhkan dari Sumber Dana', formatCurrency(Math.max(0, Math.abs(financialReport.totalKewajiban) - Math.min(opsiPerhitunganData.saldoKasPendapatan > 0 ? opsiPerhitunganData.saldoKasPendapatan : opsiPerhitunganData.totalPendapatan, Math.abs(financialReport.totalKewajiban))))],
            ] : [
                ['OPSI 3: Tanpa Hutang — Hasil Pendapatan Dijaga Utuh 100%', ''],
                ['   • Status Posisi Kewajiban / Hutang', 'Rp 0 (Nihil / Lunas)'],
                ['   • Pendapatan Dijaga Utuh (Punia / Sasah Abu)', formatCurrency(opsiPerhitunganData.pendapatanTerpakai > 0 ? opsiPerhitunganData.pendapatanTerpakai : opsiPerhitunganData.totalPendapatan)],
                ['   • Total Estimasi Pembiayaan Pokok dari Sumber Dana', formatCurrency(opsiPerhitunganData.estimasiSumberDana)],
            ];

            if (currentY > 215) {
                doc.addPage();
                currentY = 20;
            }

            autoTable(doc, {
                startY: currentY,
                head: [[hasHutangPdf ? 'RINGKASAN OPSI PERHITUNGAN REKONSILIASI HUTANG' : 'RINGKASAN ESTIMASI SUMBER DANA (TANPA HUTANG)', 'NILAI (Rp)']],
                body: opsiRows,
                theme: 'grid',
                headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
                bodyStyles: { textColor: 30, fontSize: 8 },
                columnStyles: { 0: { cellWidth: 122 }, 1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' } },
                margin: { left: 14, right: 14 }
            });

            currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : currentY + 60;

            if (currentY > 235) {
                doc.addPage();
                currentY = 25;
            }

            // 5. Signatures
            const signatureDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(30, 30, 30);

            // Left: Keliang Adat
            doc.text('Mengetahui,', 40, currentY, { align: 'center' });
            doc.text('Keliang Adat Basangalas', 40, currentY + 5, { align: 'center' });

            // STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, bukan di Juru Raksa, mengambil tempat setengah nama Keliang Adat ke kiri
            if (showStamp && effectiveStamp) {
                try {
                    doc.addImage(effectiveStamp, 'PNG', 18, currentY + 4, 25, 25);
                } catch (e) {
                    // Ignore image add failure gracefully
                }
            }

            if (embedSignatures && signatures?.keliang) {
                try {
                    doc.addImage(signatures.keliang, 'PNG', 26, currentY + 7, 28, 16);
                } catch (e) {
                    // Ignore image add failure gracefully
                }
            }

            doc.setFont('helvetica', 'bold');
            doc.text(keliangName, 40, currentY + 26, { align: 'center' });

            // Right: Juru Raksa
            doc.setFont('helvetica', 'normal');
            doc.text(`${customPlace}, ${signatureDate}`, 165, currentY, { align: 'center' });
            doc.text('Juru Raksa', 165, currentY + 5, { align: 'center' });

            if (embedSignatures && signatures?.juruRaksa) {
                try {
                    doc.addImage(signatures.juruRaksa, 'PNG', 151, currentY + 7, 28, 16);
                } catch (e) {
                    // Ignore image add failure gracefully
                }
            }

            doc.setFont('helvetica', 'bold');
            doc.text(juruRaksaName, 165, currentY + 26, { align: 'center' });

            doc.save(`Laporan_Neraca_${reportDate}.pdf`);
            setNotification({ message: 'Laporan Neraca berhasil diunduh sebagai PDF!', type: 'success' });
        } catch (err) {
            console.error("Gagal mengunduh PDF:", err);
            setNotification({ message: 'Gagal membuat file PDF. Silakan coba lagi.', type: 'error' });
        }
    };

    const processExport = () => {
        if (typeof XLSX === 'undefined') return;
        
        const data = [
            ["NERACA DATA KEUANGAN DESA"],
            [`Per Tanggal: ${reportDate}`],
            [],
            ["URAIAN", "SALDO (Rp)"],
            ["ASET (AKTIVA)", ""],
            ["1. Aset Desa Adat", ""],
            ...financialReport.asetPada.map(i => [i.name, i.saldo]),
            ["Total Aset Desa Adat", financialReport.totalAsetKas],
            ...(financialReport.asetLainnya.length > 0 ? [["Aset Lainnya", ""], ...financialReport.asetLainnya.map(i => [i.name, i.saldo])] : []),
            ["Piutang", ""],
            ...financialReport.asetPiutang.map(i => [i.name, i.saldo]),
            ["3. Kas Juru Raksa Tunai", financialReport.totalJuruRaksaTunai],
            ["TOTAL AKTIVA (ASET)", financialReport.totalAset],
            [],
            ["KEWAJIBAN & EKUITAS (PASIVA)", ""],
            ["Kewajiban / Utang", ""],
            ...financialReport.kewajiban.map(i => [i.name, Math.abs(i.saldo)]),
            ["Total Kewajiban / Utang", Math.abs(financialReport.totalKewajiban)],
            ["Ekuitas", ""],
            ...financialReport.ekuitas.map(i => [i.name, i.saldo]),
            ["Surplus/Defisit Periode Berjalan", financialReport.surplusDefisit + financialReport.manualSurplusBalance],
            ["TOTAL KEWAJIBAN & EKUITAS", financialReport.totalPasiva],
            [],
            ...(Math.abs(financialReport.totalKewajiban) > 0 ? [
                ["OPSI PERHITUNGAN REKONSILIASI PELUNASAN HUTANG", ""],
                ["1. Opsi 1 (Ada Hutang: Pelunasan Hutang + Pengembalian Pendapatan Terpakai)", ""],
                ["   • Total Hutang / Kewajiban", Math.abs(financialReport.totalKewajiban)],
                ["   • Pendapatan Terpakai (Mutasi Kas)", opsiPerhitunganData.pendapatanTerpakai],
                ["   • Total Dana yang Dibutuhkan dari Sumber Dana", Math.abs(financialReport.totalKewajiban) + opsiPerhitunganData.pendapatanTerpakai],
                ["2. Opsi 2 (Ada Hutang: Pelunasan via Pendapatan + Estimasi Sumber Dana)", ""],
                ["   • Total Hutang yang Harus Dilunasi", Math.abs(financialReport.totalKewajiban)],
                ["   • Alokasi dari Hasil Pendapatan", Math.min(opsiPerhitunganData.saldoKasPendapatan > 0 ? opsiPerhitunganData.saldoKasPendapatan : opsiPerhitunganData.totalPendapatan, Math.abs(financialReport.totalKewajiban))],
                ["   • Estimasi Tambahan dari Sumber Dana", Math.max(0, Math.abs(financialReport.totalKewajiban) - Math.min(opsiPerhitunganData.saldoKasPendapatan > 0 ? opsiPerhitunganData.saldoKasPendapatan : opsiPerhitunganData.totalPendapatan, Math.abs(financialReport.totalKewajiban)))],
            ] : [
                ["OPSI PERHITUNGAN ESTIMASI SUMBER DANA (TANPA HUTANG)", ""],
                ["Opsi 3 (Tanpa Hutang: Hasil Pendapatan Utuh)", ""],
                ["   • Status Hutang", "Nihil (Rp 0)"],
                ["   • Estimasi Kebutuhan Pokok dari Sumber Dana", opsiPerhitunganData.estimasiSumberDana],
                ["   • Total Dana yang Dibutuhkan (= Estimasi Sumber Dana)", opsiPerhitunganData.estimasiSumberDana]
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Neraca");
        XLSX.writeFile(wb, exportFilename.endsWith('.xlsx') ? exportFilename : `${exportFilename}.xlsx`);
        setIsExportModalOpen(false);
    };

    // Generate random particles
    const particles = useMemo(() => {
      return Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        duration: `${10 + Math.random() * 15}s`,
        delay: `${Math.random() * 10}s`,
        size: `${2 + Math.random() * 4}px`,
        opacity: 0.1 + Math.random() * 0.3
      }));
    }, []);
    
    return (
        <div className={`neraca-container space-y-6 ${printMode === 'opsi' ? 'print-opsi-only' : 'print-all'}`} id="printable-area">
            {/* Falling Particles */}
            {particles.map((p) => (
              <div 
                key={p.id}
                className="absolute bg-slate-400 rounded-full animate-falling"
                style={{
                  left: p.left,
                  width: p.size,
                  height: p.size,
                  opacity: p.opacity,
                  animationDuration: p.duration,
                  animationDelay: p.delay,
                  top: '-5vh'
                }}
              />
            ))}
           
            <style>{`
                @media print {
                    *, *:before, *:after {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    body {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    #printable-area { 
                        position: static !important; 
                        width: 100% !important; 
                        max-width: 100% !important;
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: #ffffff !important; 
                        color: #0f172a !important; 
                        display: block !important; 
                        box-sizing: border-box !important;
                    }
                    @page { 
                        size: portrait; 
                        margin: 12mm 14mm 14mm 14mm; 
                    }
                    .no-print, .animate-falling, [class*="animate-"] { 
                        display: none !important; 
                    }
                    .break-inside-avoid,
                    .signature-section,
                    .opsi-standalone-signature,
                    .opsi-standalone-footer {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .neraca-main-signature {
                        display: flex !important;
                        position: relative !important;
                        width: 100% !important;
                        margin-top: 1.5rem !important;
                        margin-bottom: 0.25rem !important;
                        clear: both !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .neraca-main-footer {
                        display: flex !important;
                        position: relative !important;
                        width: 100% !important;
                        margin-top: 0.75rem !important;
                        clear: both !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    /* Lembar ke - 2: Pemisah Halaman & Aturan Cetak Ringkasan Singkat */
                    .neraca-page-break {
                        display: block !important;
                        page-break-before: always !important;
                        break-before: page !important;
                        clear: both !important;
                        height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                    }
                    .neraca-sheet-2 {
                        display: block !important;
                        page-break-before: always !important;
                        break-before: page !important;
                        margin-top: 0 !important;
                        padding-top: 0 !important;
                        overflow: visible !important;
                    }
                    .neraca-sheet-2,
                    .neraca-sheet-2 * {
                        overflow: visible !important;
                    }
                    .neraca-snapshot-cards {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    /* Tabel boleh terpotong antarahalaman jika panjang, namun data baris & sel tidak boleh terpotong */
                    .neraca-sheet-2 table,
                    .neraca-comparison-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    .neraca-sheet-2 thead,
                    .neraca-comparison-table thead {
                        display: table-header-group !important;
                    }
                    .neraca-sheet-2 tbody,
                    .neraca-comparison-table tbody {
                        display: table-row-group !important;
                    }
                    .neraca-sheet-2 tr,
                    .neraca-comparison-table tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .neraca-sheet-2 td,
                    .neraca-sheet-2 th,
                    .neraca-comparison-table td,
                    .neraca-comparison-table th {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        word-break: normal !important;
                        white-space: normal !important;
                        overflow: visible !important;
                        vertical-align: top !important;
                    }

                    /* Print Opsi Only Mode: Hide standard Neraca Kop, tables, signatures, sheet-2, and footer */
                    .print-opsi-only .neraca-main-print-header,
                    .print-opsi-only .neraca-main-content,
                    .print-opsi-only .neraca-sheet-2,
                    .print-opsi-only .neraca-page-break,
                    .print-opsi-only .neraca-main-signature,
                    .print-opsi-only .neraca-main-footer {
                        display: none !important;
                    }

                    /* Print All Mode: Hide Opsi-specific calculation container, Kop, signature, and footer */
                    .print-all .opsi-perhitungan-container,
                    .print-all .opsi-standalone-header,
                    .print-all .opsi-standalone-signature,
                    .print-all .opsi-standalone-footer {
                        display: none !important;
                    }
                }

                @keyframes falling {
                    0% { transform: translateY(0) translateX(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(110vh) translateX(20px); opacity: 0; }
                }
                .animate-falling {
                    animation: falling linear infinite;
                }
            `}</style>
            
            {notification && <div className="no-print"><Notification {...notification} onClose={() => setNotification(null)} /></div>}

            <div className="neraca-main-print-header hidden print:block text-slate-900 mb-6">
                <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                        DESA ADAT BASANGALAS
                    </h2>
                    <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
                        Laporan Kas Desa Adat
                    </p>
                    <p className="text-xs font-semibold text-slate-700 font-serif m-0">
                        Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                    </p>
                </div>

                <div className="text-center mb-2">
                    <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                        LAPORAN NERACA KEUANGAN
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                        Per Tanggal: {new Date(reportDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                    </p>
                </div>
            </div>

            {/* Header & Controls */}
            <div className="bg-white text-gray-900 border-b-4 border-emerald-500 p-4 no-print my-6 relative print:border-none print:shadow-none print:bg-white print:rounded-none print:p-0 print:m-0">
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
                    <div className="absolute -right-0 -bottom-0 opacity-10 text-emerald-600 pointer-events-none">
                        <Scale size={130} />
                    </div>
                </div>
            
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4  no-print rounded-t-xl">                
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-teal-900/30 rounded-full border border-teal-500/30 mt-0.5 shrink-0">
                            <Scale className="w-8 h-8 text-teal-700" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-6">
                                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif">
                                    Neraca Keuangan</h2>
                                <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-300">
                                    Posisi Keuangan (Balance Sheet)
                                </span>
                            </div>
                            <p className="text-emerald-600 text-xs italic font-bold">Sampai Tgl: {formatDate(reportDate)}</p>
                            <div className="mt-2 text-xs text-teal-700  w-full flex items-start gap-2 shadow-2xs">
                                <p className="leading-snug">
                                    <strong className="text-teal-950 font-bold">Definisi Akuntansi:</strong> Laporan posisi keuangan yang menyajikan nilai kekayaan bersih secara berimbang antara seluruh Aset (Kas, Bank, Piutang) terhadap Kewajiban (Hutang) dan Ekuitas Adat pada titik tanggal pelaporan tertentu.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex items-center gap-2 flex-wrap justify-end">
                        {/* Tombol Menu Dropdown Ekspor & Cetak */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsExportMenuOpen(prev => !prev)} 
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-xl shadow-md transition-all text-xs active:scale-95 border border-emerald-500"
                                title="Menu Pilihan Ekspor & Cetak Dokumen Neraca"
                            >
                                <FileDown size={16} />
                                <span>Menu</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
    
                            {isExportMenuOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setIsExportMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white border border-slate-700 rounded-2xl shadow-2xl z-50 py-1.5 divide-y divide-slate-800 animate-fade-in origin-top-right">
                                        <div className="px-3.5 py-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                            <span>Pilihan Format Dokumen</span>
                                            <Scale size={13} className="text-teal-400" />
                                        </div>
                                        <div className="py-1">
                                            {/* 1. PDF Langsung */}
                                            <button
                                                onClick={() => {
                                                    setIsExportMenuOpen(false);
                                                    generatePdfReport();
                                                }}
                                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-rose-300 hover:bg-rose-950/60 hover:text-slate-200 transition-colors text-left font-medium"
                                            >
                                                <FileText size={16} className="text-rose-700 shrink-0" />
                                                <div>
                                                    <div className="font-bold text-slate-600 hover:text-slate-200">PDF Langsung</div>
                                                    <div className="text-[10px] text-slate-500">Generate &amp; Preview PDF Otomatis</div>
                                                </div>
                                            </button>
    
                                            {/* 2. Unduh PDF */}
                                            <div className="px-1.5 py-0.5">
                                                <ExportPdfButton 
                                                    elementId="printable-area" 
                                                    filename={`Laporan_Neraca_Desa_${reportDate}.pdf`} 
                                                    buttonText="Unduh PDF Resmi" 
                                                    defaultOrientation="portrait"
                                                    options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                                                    className="w-full !justify-start !bg-transparent hover:!bg-teal-950/60 !text-teal-300 hover:!text-teal-200 !border-0 !shadow-none !px-2.5 !py-2 !text-xs !font-semibold"
                                                />
                                            </div>
    
                                            {/* 3. Export Excel */}
                                            <button
                                                onClick={() => {
                                                    setIsExportMenuOpen(false);
                                                    setExportFilename(`Neraca_Desa_${reportDate}`);
                                                    setIsExportModalOpen(true);
                                                }}
                                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs text-emerald-300 hover:bg-emerald-950/60 hover:text-emerald-200 transition-colors text-left font-medium"
                                            >
                                                <Download size={16} className="text-emerald-400 shrink-0" />
                                                <div>
                                                    <div className="font-bold text-slate-500 hover:text-slate-300">Export Excel</div>
                                                    <div className="text-[10px] text-slate-400 hover:text-slate-300">Unduh Data Spreadsheet (.xlsx)</div>
                                                </div>
                                            </button>
                                        </div>
    
                                        {/* 4. Cetak Neraca */}
                                        <div className="py-1">
                                            <button
                                                onClick={() => {
                                                    setIsExportMenuOpen(false);
                                                    handlePrint();
                                                }}
                                                className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-sky-300 hover:bg-sky-950/60 hover:text-sky-200 transition-colors text-left font-medium"
                                            >
                                                <Printer size={16} className="text-sky-400 shrink-0 hover:text-slate-300" />
                                                <span className="text-slate-600 font-bold hover:text-slate-300">Cetak / Print Dialog</span>
                                            </button>
                                        </div>
    
                                        {/* 5. Pengaturan Tanda Tangan */}
                                        <div className="py-1">
                                            <button
                                                onClick={() => {
                                                    setIsExportMenuOpen(false);
                                                    handleOpenSettings();
                                                }}
                                                className="w-full flex items-center gap-3 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left font-medium"
                                            >
                                                <Settings size={16} className="text-slate-600 shrink-0 hover:text-slate-300" />
                                                <span className="text-slate-600 font-bold hover:text-slate-300">Atur Tanda Tangan</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="flex flex-wrap bg-amber-50/80 border border-slate-300 rounded-xl p-3 justify-between items-center gap-3 no-print shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-700">
                        <Filter className="h-4 w-4 text-gray-400 ml-2" />
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)} 
                            className="bg-gray-900 text-xs text-gray-100 focus:outline-none py-1.5 px-2 border-r border-gray-700 font-bold"
                        >
                            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)} 
                            className="bg-gray-900 text-xs text-gray-100 focus:outline-none py-1.5 px-2 font-bold"
                        >
                            <option value="">Pilih Bulan</option>
                            {monthsList.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700">
                        <Calendar size={14} className="text-gray-300" />
                        <input 
                            type="date" 
                            value={reportDate} 
                            onChange={(e) => setReportDate(e.target.value)} 
                            className="bg-gray-900 text-xs text-gray-100 font-bold focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleResetFilter} className={`flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-700 text-teal-700 hover:text-teal-300 font-bold rounded-lg shadow transition-all text-xs active:scale-95 border border-slate-400 hover:border-slate-700 ${isRefreshing ? 'animate-spin' : ''}`} title="Reset Filter ke Tanggal Sistem Hari Ini"><RotateCcw size={16} /><span>Reset Filter</span></button>
                    <button 
                        onClick={toggleOpsiPerhitungan} 
                        className={`flex items-center gap-1.5 px-3 py-2 ${showOpsiPerhitungan ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-600' : 'bg-slate-800 hover:bg-slate-700 text-emerald-200 border-slate-700'} font-bold rounded-lg shadow transition-all text-xs active:scale-95 border`}
                        title={showOpsiPerhitungan ? "Sembunyikan Bantuan Opsi Perhitungan" : "Tampilkan Bantuan Opsi Perhitungan"}
                    >
                        {showOpsiPerhitungan ? <EyeOff size={16} /> : <Eye size={16} />}
                        <span>{showOpsiPerhitungan ? 'Opsi : ON' : 'Opsi : OFF'}</span>
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow transition-all text-xs active:scale-95 border border-teal-500" title="Cetak Neraca"><Printer size={16} /><span>Cetak Neraca</span></button>
                </div>
            </div>

            {/* Banner Peringatan Otomatis jika Neraca Tidak Seimbang */}
            {!isBalanced && (
                <div className="no-print bg-gradient-to-r from-rose-950/80 via-red-900/60 to-rose-950/80 border-2 border-rose-500/80 rounded-2xl p-5 shadow-2xl text-white space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-rose-500/30 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-500/20 rounded-xl border border-rose-500/40 text-rose-300">
                                <AlertTriangle className="w-7 h-7 text-rose-400 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-wide text-rose-200 uppercase flex items-center gap-2">
                                    <span>Peringatan: Neraca Tidak Seimbang</span>
                                </h3>
                                <p className="text-xs text-rose-200/80 mt-0.5">
                                    Terdapat selisih sebesar <span className="font-mono font-bold text-rose-300 text-sm px-1.5 py-0.5 bg-rose-950/80 rounded border border-rose-500/50">{formatCurrency(absSelisih)}</span> antara Total Aktiva dan Total Pasiva.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                            <button 
                                onClick={generatePdfReport}
                                className="flex items-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold px-3 py-2 rounded-xl border border-rose-500/40 transition-all shadow"
                            >
                                <FileDown size={14} />
                                <span>Unduh PDF Neraca</span>
                            </button>
                            <button 
                                onClick={() => setShowSuspects(!showSuspects)}
                                className="flex items-center gap-2 bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-xs font-bold px-4 py-2 rounded-xl border border-rose-400/50 transition-all shadow"
                            >
                                <span>{showSuspects ? 'Sembunyikan Detail Analisis' : 'Lihat Transaksi Penyebab'}</span>
                                {showSuspects ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Rincian Perbandingan Ringkas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-900/70 p-3 rounded-xl border border-rose-500/20">
                            <span className="text-slate-400 font-medium block mb-1">Total Aktiva (Aset)</span>
                            <span className="text-base font-bold font-mono text-teal-300">{formatCurrency(financialReport.totalAset)}</span>
                        </div>
                        <div className="bg-slate-900/70 p-3 rounded-xl border border-rose-500/20">
                            <span className="text-slate-400 font-medium block mb-1">Total Pasiva (Kewajiban + Ekuitas)</span>
                            <span className="text-base font-bold font-mono text-blue-300">{formatCurrency(financialReport.totalPasiva)}</span>
                        </div>
                        <div className="bg-rose-950/70 p-3 rounded-xl border border-rose-500/40">
                            <span className="text-rose-300 font-medium block mb-1">Selisih ({financialReport.totalAset > financialReport.totalPasiva ? 'Aktiva > Pasiva' : 'Pasiva > Aktiva'})</span>
                            <span className="text-base font-bold font-mono text-rose-300">{formatCurrency(absSelisih)}</span>
                        </div>
                    </div>

                    {/* Daftar Transaksi Penyebab Selisih */}
                    {showSuspects && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-200 flex items-center gap-2">
                                    <AlertCircle size={14} className="text-rose-400" />
                                    <span>Daftar Transaksi Potensial Penyebab Selisih ({suspectTransactions.length})</span>
                                </h4>
                            </div>

                            {suspectTransactions.length === 0 ? (
                                <div className="p-4 bg-slate-900/80 rounded-xl text-center text-xs text-slate-300 border border-slate-700">
                                    Tidak ditemukan transaksi jurnal tunggal dengan debet/kredit yang tidak seimbang secara langsung. Selisih kemungkinan berasal dari akumulasi posting atau saldo awal. Silakan periksa kembali Jurnal Umum.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-rose-500/30 bg-slate-950/90 max-h-72 overflow-y-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-rose-950 text-rose-200 border-b border-rose-800/60 sticky top-0 uppercase tracking-wider font-semibold">
                                                <th className="p-2.5">Tanggal</th>
                                                <th className="p-2.5">ID / Ref</th>
                                                <th className="p-2.5">Uraian Transaksi</th>
                                                <th className="p-2.5">Kode Rek.</th>
                                                <th className="p-2.5 text-right">Debet</th>
                                                <th className="p-2.5 text-right">Kredit</th>
                                                <th className="p-2.5">Indikasi Masalah</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rose-900/30 text-slate-200">
                                            {suspectTransactions.map((tx, idx) => (
                                                <tr key={tx.id + idx} className="hover:bg-rose-900/20 transition-colors">
                                                    <td className="p-2.5 font-mono text-slate-300 whitespace-nowrap">{tx.date}</td>
                                                    <td className="p-2.5 font-mono text-xs text-slate-400">{tx.idTransaksi || tx.id}</td>
                                                    <td className="p-2.5 font-medium max-w-xs truncate">{tx.uraian}</td>
                                                    <td className="p-2.5 font-mono text-amber-300">{tx.kodeRekening || '-'}</td>
                                                    <td className="p-2.5 text-right font-mono">{formatCurrency(tx.debet)}</td>
                                                    <td className="p-2.5 text-right font-mono">{formatCurrency(tx.kredit)}</td>
                                                    <td className="p-2.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                            {tx.reason}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4">
                {/* ASET */}
                <div className="bg-white rounded-xl overflow-hidden border border-gray-500 shadow-lg print:border print:border-slate-800 print:shadow-none print:rounded-none">
                    <div>
                        <h3 className="bg-gray-800 text-lg font-bold text-white p-4 uppercase tracking-wider border-b border-gray-500 text-center print:bg-slate-200 print:text-slate-900 print:border-slate-800 print:py-2 print:text-sm">ASET (AKTIVA)</h3>
                    </div>
                    <div className="p-6 print:p-3 space-y-6 print:space-y-3">
                        {/* 1. PADA */}
                        <div>
                            <h4 className="text-teal-600 font-bold mb-3 uppercase text-xs border-b border-gray-500 pb-2 print:text-slate-900 print:border-slate-900 print:mb-1.5 print:pb-1">
                                1. Kas & Bank
                            </h4>
                            <div className="space-y-1">
                                {financialReport.asetPada.length > 0 && (
                                    <div className="pt-2 print:pt-1">
                                        <h5 className="text-teal-500 font-black text-[10px] border-b border-teal-500 uppercase mb-1 ml-2 print:text-slate-800 print:border-slate-400">Aset Desa Adat :</h5>
                                        {financialReport.asetPada.map(item => (
                                        <div key={item.code} className="flex justify-between items-center py-1.5 print:py-0.5 text-gray-900 px-2 hover:bg-gray-200 rounded transition-colors">
                                            <span className="text-sm print:text-xs print:text-black">{item.name}</span>
                                            <span className="font-arial text-sm print:text-xs print:text-black">{formatCurrency(item.saldo)}</span>
                                        </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-1 px-2 mt-2 print:mt-1 bg-teal-900/10 border-t border-teal-800/40 rounded print:bg-slate-100 print:border-slate-800">
                                    <span className="text-sm print:text-xs font-bold text-teal-800 print:text-black">Total Aset Desa Adat</span>
                                    <span className="font-arial text-sm print:text-xs font-bold text-teal-800 print:text-black">{formatCurrency(financialReport.totalAsetKas)}</span>
                                </div>
                                
                                {financialReport.asetLainnya.length > 0 && (
                                    <div className="pt-2 print:pt-1">
                                        <h5 className="text-teal-500 font-black text-[10px] border-b border-teal-500 uppercase mb-1 ml-2 print:text-slate-800 print:border-slate-400">Aset Lainnya</h5>
                                        {financialReport.asetLainnya.map(item => (
                                            <div key={item.code} className="flex justify-between items-center py-1.5 print:py-0.5 text-gray-900 px-2 hover:bg-gray-200 rounded transition-colors">
                                                <span className="text-sm print:text-xs print:text-black">{item.name}</span>
                                                <span className="font-arial text-sm print:text-xs print:text-black">{formatCurrency(item.saldo)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between items-center py-1 px-2 mt-2 print:mt-1 bg-teal-900/10 border-t border-teal-800/40 rounded print:bg-slate-100 print:border-slate-800">
                                    <span className="text-sm print:text-xs font-bold text-teal-800 print:text-black">Total Aset Lainnya</span>
                                    <span className="font-arial text-sm print:text-xs font-bold text-teal-800 print:text-black">{formatCurrency(financialReport.totalAsetLainnya)}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* 2. Piutang */}
                            {financialReport.asetPiutang.length > 0 && (
                                <div className="pt-2 print:pt-1">
                                    <h5 className="text-amber-800 font-black text-xs uppercase border-b border-amber-800 pb-2 print:pb-1 mb-3 print:mb-1.5 ml-0 print:text-slate-800 print:border-slate-400">2. Piutang</h5>
                                    {financialReport.asetPiutang.map(item => (
                                        <div key={item.code} className="flex justify-between items-center py-2 print:py-0.5 text-amber-800 px-2 bg-amber-900/20 rounded-lg border-l-2 border-amber-700/50 mb-1 print:text-black print:border-slate-500 print:bg-slate-50">
                                            <span className="text-sm print:text-xs font-medium">{item.name}</span>
                                            <span className="font-arial text-sm print:text-xs font-medium">{formatCurrency(item.saldo)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                        {/*  Total Kas Tunai / Kalkulasi */}
                        <div className="bg-slate-100 dark:bg-slate-800/80 py-2.5 px-3 rounded-xl border border-teal-300 dark:border-teal-700 shadow-inner no-print transition-all">
                            <div 
                                onClick={() => setShowKalkulasi(prev => !prev)}
                                className="flex items-center justify-between cursor-pointer select-none py-1 group"
                            >
                                <div className="flex items-center gap-2">
                                    <Calculator size={15} className="text-emerald-600 dark:text-emerald-400" />
                                    <h4 className="text-emerald-700 dark:text-emerald-300 font-bold uppercase text-xs">
                                        Kalkulasi :
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-200/80 dark:bg-emerald-950/80 hover:bg-emerald-300 px-2.5 py-1 rounded-lg transition-colors border border-emerald-400 dark:border-emerald-700 shadow-2xs"
                                >
                                    {showKalkulasi ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    <span>{showKalkulasi ? 'Sembunyikan' : 'Tampilkan'}</span>
                                </button>
                            </div>
                            {showKalkulasi && (
                                <div className="space-y-1 mt-2 pt-2 border-t border-slate-300 dark:border-slate-700 animate-fade-in">
                                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 transition-colors py-0.5 border-b border-amber-500/40 pb-1.5">
                                        <span className="text-xs font-semibold">Aset Desa Adat</span>
                                        <span className="font-arial text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(financialReport.totalAsetKas)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 transition-colors py-0.5 border-b border-amber-500/40 pb-1.5">
                                        <span className="text-xs font-semibold">Aset Lainnya</span>
                                        <span className="font-arial text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(financialReport.totalAsetLainnya)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-teal-700 dark:text-teal-300 transition-colors py-0.5">
                                        <span className="text-xs font-semibold">Total Kas & Bank</span>
                                        <span className="font-arial text-xs font-bold">{formatCurrency(financialReport.totalAsetKasBank)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-teal-700 dark:text-teal-300 transition-colors py-0.5">
                                        <span className="text-xs font-semibold">Total Piutang</span>
                                        <span className="font-arial text-xs font-bold">{formatCurrency(financialReport.totalAsetPiutang)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-teal-700 dark:text-teal-300 transition-colors py-0.5">
                                        <span className="text-xs font-semibold">Total Aset Desa Adat</span>
                                        <span className="font-arial text-xs font-bold">{formatCurrency(financialReport.totalAsetAktif)}</span>
                                    </div>

                                    {/* Formulir Penjelasan Naratif Hasil Kalkulasi (Header Desa & Signature) */}
                                    <FormulirNaratifKalkulasi
                                        financialReport={financialReport}
                                        reportDate={reportDate}
                                        customPlace={customPlace}
                                        signatureDate={signatureDate}
                                        keliangName={keliangName}
                                        juruRaksaName={juruRaksaName}
                                        isBalanced={isBalanced}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-teal-900/20 p-5 print:p-2.5 border-t-4 border-teal-600 font-bold print:bg-slate-100 print:border-t-2 print:border-slate-900">
                        <div className="flex justify-between items-center text-gray-900 print:text-black">
                            <span className="text-sm print:text-xs uppercase tracking-[0.2em] font-black">TOTAL AKTIVA (ASET)</span>
                            <span className="text-2xl print:text-sm font-arial text-teal-600 print:text-black font-black">{formatCurrency(financialReport.totalAset)}</span>
                        </div>
                    </div>
                </div>

                {/* KEWAJIBAN & EKUITAS */}
                <div className="space-y-8 print:space-y-0">
                    <div className="bg-white rounded-xl overflow-hidden border border-gray-500 shadow-lg print:border print:border-slate-800 print:shadow-none print:rounded-none">
                        <div>
                            <h3 className="bg-gray-700 p-4 text-lg font-bold text-white uppercase tracking-wider text-center border-b border-gray-900 print:bg-slate-200 print:text-slate-900 print:border-slate-800 print:py-2 print:text-sm">KEWAJIBAN & EKUITAS (PASIVA)</h3>
                        </div>
                        <div className="p-6 print:p-3 space-y-8 print:space-y-3">
                            <div>
                                <h4 className="text-red-600 font-bold mb-3 uppercase text-xs border-b border-gray-800 pb-2 print:text-slate-900 print:border-slate-900 print:mb-1.5 print:pb-1">Kewajiban / Utang</h4>
                                {financialReport.kewajiban.map(item => (
                                    <div key={item.code} className="flex justify-between items-center py-2 print:py-0.5 text-gray-900 px-2 rounded">
                                        <span className="text-sm print:text-xs print:text-black">{item.name}</span>
                                        <span className="font-arial text-sm print:text-xs print:text-black">{formatCurrency(Math.abs(item.saldo))}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center py-2 print:py-1 px-2 mt-2 print:mt-1 bg-red-900/10 border-t border-red-800/50 print:bg-slate-100 print:border-slate-800">
                                    <span className="text-sm print:text-xs font-bold text-red-600 print:text-black">Total Kewajiban / Utang</span>
                                    <span className="font-arial text-sm print:text-xs font-bold text-red-600 print:text-black">{formatCurrency(Math.abs(financialReport.totalKewajiban))}</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-blue-600 font-bold mb-3 uppercase text-xs border-b border-gray-500 pb-2 print:text-slate-900 print:border-slate-900 print:mb-1.5 print:pb-1">Ekuitas Desa</h4>
                                {financialReport.ekuitas.map(item => (
                                    <div key={item.code} className="flex justify-between items-center py-2 print:py-0.5 text-gray-900 px-2 rounded">
                                        <span className="text-sm print:text-xs print:text-black">{item.name}</span>
                                        <span className="font-arial text-sm print:text-xs print:text-black">{formatCurrency(item.saldo)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center py-2.5 print:py-1 text-teal-600 px-2 rounded italic bg-teal-900/10 mt-2 print:mt-1 print:bg-slate-100 print:text-black">
                                    <span className="text-sm print:text-xs font-bold print:text-black">Surplus/Defisit Periode Berjalan</span>
                                    <span className={`font-arial text-sm print:text-xs text-teal-500 font-black print:text-black ${financialReport.surplusDefisit + financialReport.manualSurplusBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(financialReport.surplusDefisit + financialReport.manualSurplusBalance)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-400/10 p-5 print:p-2.5 border-t-4 border-gray-500 font-bold print:bg-slate-100 print:border-t-2 print:border-slate-900">
                            <div className="flex justify-between items-center text-gray-900 print:text-black">
                                <span className="text-sm print:text-xs uppercase tracking-[0.2em] font-black">TOTAL PASIVA</span>
                                <span className="text-2xl print:text-sm font-arial print:text-black font-black">{formatCurrency(financialReport.totalPasiva)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`p-4 rounded-xl text-center font-bold text-sm border-2 ${Math.abs(financialReport.totalAset - financialReport.totalPasiva) < 1 ? 'bg-green-900/20 text-green-600 border-green-800/50' : 'bg-red-900/20 text-red-600 border-red-800/50'} no-print`}>
                {Math.abs(financialReport.totalAset - financialReport.totalPasiva) < 1 ? "✅ NERACA SEIMBANG (BALANCED)" : `⚠️ NERACA TIDAK SEIMBANG (Selisih: ${formatCurrency(Math.abs(financialReport.totalAset - financialReport.totalPasiva))})`}
            </div>

            <div className="neraca-main-signature signature-section hidden print:flex justify-between items-start mt-8 print:mt-4 pt-4 print:pt-2 px-8 print:px-2 text-slate-900 text-xs font-serif w-full break-inside-avoid">
                {/* Sisi Kiri: Mengetahui Keliang Adat */}
                <div className="text-center w-64 space-y-1">
                    <p className="not-italic leading-relaxed text-slate-700">
                        Mengetahui,<br/>
                        <span className="font-bold text-slate-950">Keliang Adat Basangalas</span>
                    </p>
                    <div className="h-16 sm:h-20 print:h-16 flex items-center justify-center relative my-1">
                        {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, bukan di Juru Raksa, mengambil tempat setengah nama Keliang Adat ke kiri, ukuran standar mengenai tanda tangan dan label pejabat */}
                        {showStamp && effectiveStamp && (
                            <div 
                                className="absolute pointer-events-none select-none z-0"
                                style={{
                                    right: '30%',
                                    top: '50%',
                                    transform: 'translate(-30%, -50%)',
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
                        {embedSignatures && signatures?.keliang ? (
                            <img 
                                src={signatures.keliang} 
                                alt="TTD Keliang Adat" 
                                className="max-h-16 sm:max-h-20 print:max-h-16 object-contain relative z-10" 
                                style={{
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact'
                                }}
                            />
                        ) : (
                            <div className="h-16 print:h-12" />
                        )}
                    </div>
                    <p className="font-bold border-b border-slate-900 uppercase pb-0.5 inline-block min-w-[180px] not-italic relative z-10">
                        {keliangName}
                    </p>
                </div>

                {/* Sisi Kanan: Juru Raksa */}
                <div className="text-center w-64 space-y-1">
                    <p className="not-italic leading-relaxed text-slate-700">
                        {customPlace}, {new Date(signatureDate || reportDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br/>
                        <span className="font-bold text-slate-950">Juru Raksa</span>
                    </p>
                    <div className="h-16 sm:h-20 print:h-16 flex items-center justify-center relative my-1">
                        {embedSignatures && signatures?.juruRaksa ? (
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
                            <div className="h-16 print:h-12" />
                        )}
                    </div>
                    <p className="font-bold border-b border-slate-900 uppercase pb-0.5 inline-block min-w-[180px] not-italic relative z-10">
                        {juruRaksaName}
                    </p>
                </div>
            </div>

            {/* Selesai Lembar 1: Footer Lembar 1 */}
            <div className="hidden print:flex justify-between items-center text-[10px] text-slate-500 font-serif pt-3 border-t border-slate-300 mt-4 break-inside-avoid">
                <span className="italic">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas</span>
                <span className="font-bold text-slate-700 font-mono">Lembar 1 dari 2</span>
            </div>

            {/* PEMISAH HALAMAN MENUJU LEMBAR KE-2 */}
            <div className="neraca-page-break hidden print:block" style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />

            {/* LEMBAR KE-2: MAIN BALANCE SHEET CONTENT (Ringkasan Singkat: Total Aset vs Total Hutang) */}
            <div className="neraca-main-content neraca-sheet-2 space-y-6 print:space-y-4">
                {/* Header Formal Lembar Ke - 2 saat Cetak */}
                <div className="hidden print:block text-slate-900 pb-3 mb-2 border-b-2 border-slate-900">
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-base font-black uppercase tracking-wider text-slate-900 font-serif m-0">
                                DESA ADAT BASANGALAS
                            </h2>
                            <p className="text-xs font-bold text-slate-800 font-serif my-0.5">
                                Lampiran Neraca Keuangan : Ringkasan Singkat Total Aset vs Total Hutang
                            </p>
                            <p className="text-[10px] text-slate-600 font-serif m-0">
                                Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-[11px] font-semibold text-slate-700 font-mono">
                                Per Tanggal: {formatDate(reportDate)}
                            </div>
                            <div className="inline-block px-2.5 py-0.5 mt-1 rounded bg-slate-100 border border-slate-400 text-[10px] font-bold font-mono text-slate-900">
                                Lembar Ke - 2
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABEL RINGKASAN SINGKAT: TOTAL ASET VS TOTAL HUTANG (Snapshot Cepat Sebelum Cetak) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-xl overflow-hidden print:overflow-visible print:border-none print:shadow-none print:p-0">
                    {/* Header Ringkasan */}
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 sm:p-5 border-b border-slate-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30 print:bg-slate-800 print:text-teal-300 print:border-slate-700">
                                <Scale className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-teal-300 print:text-white flex items-center gap-2">
                                    <span>Ringkasan Singkat: Total Aset vs Total Hutang</span>
                                </h3>
                                <p className="text-xs text-slate-300 print:text-slate-200 font-medium">
                                    Snapshot posisi likuiditas, kewajiban, dan aset bersih per {formatDate(reportDate)}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                Math.abs(financialReport.totalKewajiban) === 0 
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 print:bg-slate-800 print:text-emerald-300 print:border-slate-700' 
                                    : 'bg-amber-950/80 text-amber-300 border-amber-500/50 print:bg-slate-800 print:text-amber-300 print:border-slate-700'
                            }`}>
                                <ShieldCheck size={14} />
                                <span>{Math.abs(financialReport.totalKewajiban) === 0 ? 'Status: Bebas Hutang (Nihil)' : 'Status: Ada Kewajiban'}</span>
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                                isBalanced 
                                    ? 'bg-teal-950/80 text-teal-300 border-teal-500/50 print:bg-slate-800 print:text-teal-300 print:border-slate-700' 
                                    : 'bg-rose-950/80 text-rose-300 border-rose-500/50 print:bg-slate-800 print:text-rose-300 print:border-slate-700'
                            }`}>
                                {isBalanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                                <span>{isBalanced ? 'Neraca: Seimbang' : 'Neraca: Selisih'}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowRingkasanSingkat(prev => !prev)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/50 transition-all shadow active:scale-95 ml-1"
                                title={showRingkasanSingkat ? "Sembunyikan Ringkasan Singkat" : "Tampilkan Ringkasan Singkat"}
                            >
                                {showRingkasanSingkat ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                <span>{showRingkasanSingkat ? 'Sembunyikan' : 'Tampilkan Ringkasan'}</span>
                            </button>
                        </div>
                    </div>

                {/* 3 Metric Snapshot Cards */}
                <div className={`p-4 sm:p-5 space-y-2 print:p-0 print:space-y-3 ${showRingkasanSingkat ? 'block' : 'hidden print:block'}`}>
                    <div className="hidden print:block text-left mb-1">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-serif border-b border-slate-300 pb-1">
                            Snapshot Posisi Saldo Neraca (Aset, Kewajiban &amp; Kekayaan Bersih)
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 neraca-snapshot-cards print:grid-cols-3 print:gap-3">
                        {/* 1. Total Aset */}
                        <div className="bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 rounded-xl p-3.5 print:bg-teal-50/60 print:border-slate-400">
                            <div className="flex items-center justify-between text-teal-800 dark:text-teal-300 text-xs font-bold uppercase tracking-wider mb-1 print:text-slate-900">
                                <span className="flex items-center gap-1.5">
                                    <Wallet size={14} />
                                    <span>Total Aset (Aktiva)</span>
                                </span>
                                <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/50 px-1.5 py-0.5 rounded print:bg-teal-100 print:text-teal-900 print:border print:border-teal-300">
                                    100%
                                </span>
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono text-teal-700 dark:text-teal-300 print:text-slate-950">
                                {formatCurrency(financialReport.totalAset)}
                            </div>
                            <div className="mt-1.5 text-[11px] text-teal-900/70 dark:text-teal-300/70 font-medium flex items-center justify-between print:text-slate-700">
                                <span>Aset Desa Adat</span>
                                <span className="font-bold font-mono">{formatCurrency(financialReport.totalAsetKas)}</span>
                            </div>
                        </div>

                        {/* 2. Total Hutang */}
                        <div className={`border rounded-xl p-3.5 ${
                            Math.abs(financialReport.totalKewajiban) > 0 
                                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500 dark:border-rose-800/60 print:bg-rose-50/60 print:border-slate-400' 
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 print:bg-slate-50 print:border-slate-400'
                        }`}>
                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-1">
                                <span className={`flex items-center gap-1.5 ${Math.abs(financialReport.totalKewajiban) > 0 ? 'text-rose-800 dark:text-rose-300 print:text-slate-900' : 'text-slate-700 dark:text-slate-300 print:text-slate-900'}`}>
                                    <AlertCircle size={14} />
                                    <span>Total Hutang (Kewajiban)</span>
                                </span>
                                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                    Math.abs(financialReport.totalKewajiban) > 0 
                                        ? 'bg-rose-300 text-rose-900 dark:bg-rose-900/50 dark:text-rose-300 print:bg-rose-100 print:text-rose-900 print:border print:border-rose-300' 
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 print:bg-emerald-100 print:text-emerald-900 print:border print:border-emerald-300'
                                }`}>
                                    {Math.abs(financialReport.totalKewajiban) > 0 ? `${((Math.abs(financialReport.totalKewajiban) / (financialReport.totalAset || 1)) * 100).toFixed(1)}% Aset` : 'Nihil (0%)'}
                                </span>
                            </div>
                            <div className={`text-xl sm:text-2xl font-black font-mono ${
                                Math.abs(financialReport.totalKewajiban) > 0 
                                    ? 'text-rose-800 dark:text-rose-400 print:text-slate-950' 
                                    : 'text-slate-700 dark:text-slate-300 print:text-slate-950'
                            }`}>
                                {formatCurrency(Math.abs(financialReport.totalKewajiban))}
                            </div>
                            <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between print:text-slate-700">
                                <span>Pos Hutang Tercatat</span>
                                <span className="font-bold">{financialReport.kewajiban.length > 0 ? `${financialReport.kewajiban.length} Akun` : 'Rp 0 (Lunas)'}</span>
                            </div>
                        </div>

                        {/* 3. Aset Bersih (Net Assets) */}
                        <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3.5 print:bg-blue-50/60 print:border-slate-400">
                            <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-1 print:text-slate-900">
                                <span className="flex items-center gap-1.5">
                                    <TrendingUp size={14} />
                                    <span>Aset Bersih (Net Asset)</span>
                                </span>
                                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded print:bg-blue-100 print:text-blue-900 print:border print:border-blue-300">
                                    Aset - Hutang
                                </span>
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono text-blue-700 dark:text-blue-300 print:text-slate-950">
                                {formatCurrency(financialReport.totalAset - Math.abs(financialReport.totalKewajiban))}
                            </div>
                            <div className="mt-1.5 text-[11px] text-blue-900/70 dark:text-blue-300/70 font-medium flex items-center justify-between print:text-slate-700">
                                <span>Solvabilitas Keuangan</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-800">
                                    {financialReport.totalAset >= Math.abs(financialReport.totalKewajiban) ? 'Solven & Aman' : 'Defisit'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tabel Perbandingan Terstruktur */}
                    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/60 print:border-none print:rounded-none overflow-visible">
                        <table className="w-full text-left text-xs border-collapse neraca-comparison-table">
                            <thead>
                                <tr className="bg-slate-900 dark:bg-slate-900 text-white border-b-2 border-slate-900 uppercase tracking-wider font-bold print:bg-slate-100 print:text-emerald-600 border border-slate-100 print:border-slate-300">
                                    <th className="p-3 text-center w-12 print:border-r print:border-slate-300">No</th>
                                    <th className="p-3 w-48 sm:w-60 print:border-r print:border-slate-300">Komponen Pos Neraca</th>
                                    <th className="p-3 print:border-r print:border-slate-300">Rincian Komposisi & Sumber Akun</th>
                                    <th className="p-3 text-right w-44 print:border-r print:border-slate-300">Jumlah (Rp)</th>
                                    <th className="p-3 text-center w-36">Status & Rasio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium print:divide-slate-400">
                                {/* Baris 1: Total Aset */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors border border-slate-100 print:border-slate-300">
                                    <td className="p-3 text-center font-bold text-slate-400 print:text-slate-800 print:border-r print:border-slate-300">1</td>
                                    <td className="p-3 print:border-r print:border-slate-300">
                                        <div className="font-bold text-teal-700 dark:text-teal-400 text-sm flex items-center gap-1.5 print:text-black">
                                            <Wallet size={15} />
                                            <span>TOTAL ASET (AKTIVA)</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">Seluruh kas, rekening bank, & piutang</span>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 print:text-slate-800 print:border-r print:border-slate-300">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span>• Aset Desa Adat (1.1.1):</span>
                                                <span className="font-mono font-bold">{formatCurrency(financialReport.totalAsetKas)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span>• Aset Lainnya (1.1.2):</span>
                                                <span className="font-mono font-bold">{formatCurrency(financialReport.totalAsetLainnya)}</span>
                                            </div>
                                            {(financialReport.totalAsetPiutang > 0 || financialReport.totalAsetPiutang > 0) && (
                                                <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-400 print:text-amber-800">
                                                    <span>• Piutang (1.2):</span>
                                                    <span className="font-mono font-bold">{formatCurrency(financialReport.totalAsetPiutang)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-sm text-teal-700 dark:text-teal-300 print:text-black print:border-r print:border-slate-300">
                                        {formatCurrency(financialReport.totalAset)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300 dark:border-teal-800 print:bg-teal-100 print:text-teal-900 print:border-teal-400">
                                            100% Aktiva
                                        </span>
                                    </td>
                                </tr>

                                {/* Baris 2: Total Hutang */}
                                <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors border border-slate-100 print:border-slate-300">
                                    <td className="p-3 text-center font-bold text-slate-400 print:text-slate-800 print:border-r print:border-slate-300">2</td>
                                    <td className="p-3 print:border-r print:border-slate-300">
                                        <div className={`font-bold text-sm flex items-center gap-1.5 ${
                                            Math.abs(financialReport.totalKewajiban) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                                        } print:text-black`}>
                                            <AlertCircle size={15} />
                                            <span>TOTAL HUTANG (KEWAJIBAN)</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">Kewajiban pihak ketiga yang harus diselesaikan</span>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 print:text-slate-800 print:border-r print:border-slate-300">
                                        {financialReport.kewajiban.length > 0 ? (
                                            <div className="space-y-1">
                                                {financialReport.kewajiban.map(k => (
                                                    <div key={k.code} className="flex items-center justify-between text-[11px]">
                                                        <span>• {k.name}:</span>
                                                        <span className="font-mono font-bold text-rose-700 dark:text-rose-400 print:text-rose-800">{formatCurrency(Math.abs(k.saldo))}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-emerald-600 dark:text-emerald-400 print:text-emerald-800 text-xs italic font-semibold">
                                                Tidak ada catatan saldo hutang / kewajiban yang belum diselesaikan (Lunas)
                                            </span>
                                        )}
                                    </td>
                                    <td className={`p-3 text-right font-mono font-black text-sm ${
                                        Math.abs(financialReport.totalKewajiban) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
                                    } print:text-black print:border-r print:border-slate-300`}>
                                        {formatCurrency(Math.abs(financialReport.totalKewajiban))}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                                            Math.abs(financialReport.totalKewajiban) === 0
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 print:bg-emerald-100 print:text-emerald-900 print:border-emerald-400'
                                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-500 dark:border-rose-800 print:bg-rose-100 print:text-rose-900 print:border-rose-400'
                                        }`}>
                                            {Math.abs(financialReport.totalKewajiban) === 0 ? '0% (Nihil)' : `${((Math.abs(financialReport.totalKewajiban) / (financialReport.totalAset || 1)) * 100).toFixed(1)}% Rasio`}
                                        </span>
                                    </td>
                                </tr>   

                                {/* Baris 3: Posisi Aset Bersih */}
                                <tr className="bg-slate-50/70 dark:bg-slate-900/60 font-bold print:bg-white border border-slate-100 print:border-slate-300">
                                    <td className="p-3 text-center text-slate-400 print:text-slate-800 print:border-r print:border-slate-300">3</td>
                                    <td className="p-3 print:border-r print:border-slate-300">
                                        <div className="text-blue-700 dark:text-blue-400 text-sm flex items-center gap-1.5 print:text-black">
                                            <TrendingUp size={15} />
                                            <span>POSISI ASET BERSIH</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 font-normal">Kekayaan bersih kas & aset (Aset - Hutang)</span>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 font-normal print:text-slate-800 print:border-r print:border-slate-300">
                                        <span className="text-xs">
                                            Saldo kas & likuiditas bersih yang tersedia penuh untuk kegiatan adat setelah menutup semua kewajiban
                                        </span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-sm text-blue-700 dark:text-blue-300 print:text-black print:border-r print:border-slate-300">
                                        {formatCurrency(financialReport.totalAset - Math.abs(financialReport.totalKewajiban))}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 print:bg-blue-100 print:text-blue-900 print:border-blue-400">
                                            {financialReport.totalAset >= Math.abs(financialReport.totalKewajiban) ? 'Solven / Kuat' : 'Defisit'}
                                        </span>
                                    </td>
                                </tr>

                                {/* Baris 4: Keseimbangan Pasiva */}
                                <tr className="bg-white dark:bg-teal-950/20 font-bold dark:border-slate-700 border-b border-slate-100 print:border-b  border border-slate-100 print:bg-white print:border-slate-300">
                                    <td className="p-3 text-center text-slate-400 print:text-slate-800 print:border-r print:border-slate-300">4</td>
                                    <td className="p-3 print:border-r print:border-slate-300">
                                        <div className="text-slate-900 dark:text-white text-sm flex items-center gap-1.5 print:text-black">
                                            <Layers size={15} />
                                            <span>TOTAL PASIVA (HUTANG + EKUITAS)</span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 font-normal">Kewajiban + Ekuitas Desa & Surplus Berjalan</span>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300 font-normal print:text-slate-800 print:border-r print:border-slate-300">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span>• Ekuitas + Surplus Berjalan:</span>
                                            <span className="font-mono font-bold">{formatCurrency(financialReport.totalEkuitas)}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-sm text-slate-900 dark:text-white print:text-black print:border-r print:border-slate-300">
                                        {formatCurrency(financialReport.totalPasiva)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                                            isBalanced
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 print:bg-emerald-100 print:text-emerald-900 print:border-emerald-400'
                                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800 print:bg-rose-100 print:text-rose-900 print:border-rose-400'
                                        }`}>
                                            {isBalanced ? '✅ Seimbang (Pas)' : '⚠️ Selisih'}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            </div>

            {/* Formal Footer Layout (Lembar Ke-2) */}
            <div className="neraca-main-footer justify-between items-center mt-6 print:mt-4 pt-2 border-t border-slate-300 print:px-2 text-slate-900 break-inside-avoid">
                <div>
                    <p className="font-semibold print:text-[11px] print:text-slate-500">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                    <p className="print:text-[9px] text-slate-500 print:text-slate-400">Transparansi dan integritas data keuangan terjamin &amp; terautentikasi secara digital.</p>
                </div>
                <div className="text-right font-mono print:text-[9px] text-slate-500 print:text-slate-700">
                    <p className="hidden print:block font-bold">Lembar 2 dari 2 • Dokumen Lengkap</p>
                    <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Laporan Neraca" className="max-w-md">
                <div className="space-y-4">
                    {/* Status TTD & Stempel dari Pengaturan Global */}
                    <div className="p-3 bg-gray-800/90 rounded-xl border border-gray-700 text-xs space-y-1.5">
                        <div className="font-bold text-gray-200 flex items-center justify-between">
                            <span>Status TTD &amp; Stempel Cetak:</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${embedSignatures ? 'bg-teal-900/80 text-teal-300 border border-teal-700' : 'bg-gray-700 text-gray-400'}`}>
                                {embedSignatures ? 'OTOMATIS (ON)' : 'MANUAL (OFF)'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                            {embedSignatures 
                                ? 'Tanda tangan digital dan stempel dinas resmi akan otomatis disematkan saat mencetak laporan Neraca.' 
                                : 'Penyematan otomatis dimatikan di menu Pengaturan. Hasil cetak akan menyediakan ruang kosong untuk tanda tangan basah.'}
                        </p>
                        {embedSignatures && (
                            <div className="text-[11px] text-gray-300 flex items-center gap-1.5 pt-0.5">
                                <span>Posisi Stempel:</span>
                                <span className={showStamp ? 'text-rose-400 font-semibold' : 'text-gray-500'}>
                                    {showStamp ? 'Keliang Adat (1/2 nama ke kiri)' : 'Nonaktif'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Tempat Laporan</label>
                        <input type="text" value={tempCustomPlace} onChange={e => setTempCustomPlace(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Tanggal Laporan (Tanda Tangan)</label>
                        <input type="date" value={tempSignatureDate} onChange={e => setTempSignatureDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Nama Keliang Adat</label>
                        <input type="text" value={tempKeliangName} onChange={e => setTempKeliangName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2">Nama Juru Raksa</label>
                        <input type="text" value={tempJuruRaksaName} onChange={e => setTempJuruRaksaName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <button onClick={handleSaveSettings} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest">Simpan Perubahan</button>
                </div>
            </Modal>

            <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Neraca ke Excel" className="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Nama File</label>
                        <input type="text" value={exportFilename} onChange={(e) => setExportFilename(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Neraca_2024.xlsx" autoFocus />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsExportModalOpen(false)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors text-xs">Batal</button>
                        <button onClick={processExport} className="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition-all text-xs"><Download size={16} /> DOWNLOAD</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Neraca;


