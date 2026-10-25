import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { JuDisplayRow, BkuData, BkpData, BudgetItem, UrunanItem } from '../types';
import { numberToWords, formatDate, formatCurrency } from '../utils/formatter';
import { 
  validateAndNotifyFinancialEntries, 
  validateAndNotifySingleTransaction,
  validateFinancialEntries,
  generateSequentialJuId
} from '../utils/financialValidator';
import Modal from '../components/shared/Modal';
import Spinner from '../components/shared/Spinner';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import Pagination from '../components/bku/Pagination';
import ExportPdfButton from '../components/shared/ExportPdfButton';
import KodeRekeningAutocomplete from '../components/shared/KodeRekeningAutocomplete';
import UraianDropdownInput from '../components/jurnal/UraianDropdownInput';
import { DebtRecapModal, DebtItem, DebtTransactionDetail } from '../components/jurnal/DebtRecapModal';
import { AccountPairValidationModal, analyzeAccountPair } from '../components/jurnal/AccountPairValidationModal';
import RekomendasiAkunDebet from '../components/jurnal/RekomendasiAkunDebet';
import { InputKategoriTransaksiModal, TransaksiType } from '../components/jurnal/InputKategoriTransaksiModal';
import { 
  Plus, Search, Save, ArrowRight, Pencil, Trash2, Droplets, 
  Printer, Download, Upload, RotateCcw, Scale, AlertTriangle, AlertCircle,
  Settings, Lock, MapPin, Calendar, Coins, CheckCircle2, 
  Share2, FileSpreadsheet, User, X, BookOpen, Menu, ChevronDown, 
  FileDown, Loader2, Info, Filter, Clock, Receipt, Wallet,
  ClipboardList, ArrowLeftRight, ShoppingBag, Landmark, Building2,
  CheckSquare, Eye, Maximize2, Sparkles
} from 'lucide-react';
import { REFERENSI_REKENING, getKategoriFromAccountCode, getKategoriForBkuTx, isKasAccount } from '../constants';
import { exportElementToPdf } from '../utils/pdfExport';
import { playSaveSuccessSound, playEditSuccessSound, playDeleteSuccessSound, playErrorSound, playSyncSuccessSound } from '../utils/soundEffects';

const MONTHS_LIST = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
];

const JU_COLUMNS = [
    { key: 'date', label: 'Tanggal', width: 'w-15', align: 'text-left' },
    { key: 'idTransaksi', label: 'ID Trx', width: 'w-12', align: 'text-left' },
    { key: 'uraian', label: 'Keterangan Jurnal', width: 'min-w-[210px]', align: 'text-left' },
    { key: 'akun', label: 'Akun', width: 'w-40', align: 'text-center' },
    { key: 'debet', label: 'Debet (Rp)', width: 'w-24', align: 'text-right' },
    { key: 'kredit', label: 'Kredit (Rp)', width: 'w-24', align: 'text-right' },
    { key: 'aksi', label: 'Aksi', width: 'w-24 min-w-[105px]', align: 'text-center' },
];

const ITEMS_PER_PAGE = 20;

interface JurnalUmumProps {
    entries: JuDisplayRow[];
    budgetItems: BudgetItem[];
    bkuData: BkuData[];
    bkpData: BkpData[];
    urunanItems?: UrunanItem[];
    onAddUrunan?: (item: any) => Promise<void>;
    onSaveTransaction: (juRows: JuDisplayRow[], bkuRows: Omit<BkuData, 'id' | 'saldo'>[], bkpItems: Omit<BkpData, 'id' | 'saldo'>[], oldIdTransaksi?: string) => Promise<void>;
    onDeleteTransaction: (idTransaksi: string) => Promise<void>;
    onDeleteMultipleTransactions?: (idTransaksiList: string[]) => Promise<void>;
    onBulkUpdateTransactions?: (txList: {
      idTransaksi: string;
      juRows: JuDisplayRow[];
      bkuRows: Omit<BkuData, 'id' | 'saldo'>[];
      bkpRows: Omit<BkpData, 'id' | 'saldo'>[];
    }[]) => Promise<void>;
    setActivePage?: (page: string) => void;
    initialAccounts?: { debet: string; kredit: string; autoOpen?: boolean } | null;
    onClearInitialAccounts?: () => void;
}

interface NotaItem {
    id: string;
    name: string;
    qty: number | string;
    price: number | string;
}

const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

declare const XLSX: any;

const JurnalUmum: React.FC<JurnalUmumProps> = ({ 
    entries, 
    budgetItems, 
    bkuData, 
    bkpData, 
    urunanItems,
    onAddUrunan,
    onSaveTransaction, 
    onDeleteTransaction,
    onDeleteMultipleTransactions,
    onBulkUpdateTransactions,
    setActivePage,
    initialAccounts,
    onClearInitialAccounts
}) => {
    const { showPermissionDenied } = useNotification();
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Modal Control States
    const [showKategoriModal, setShowKategoriModal] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [selectedCategoryType, setSelectedCategoryType] = useState<TransaksiType | null>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showDebtRecapModal, setShowDebtRecapModal] = useState(false);
    const [activePayingDebt, setActivePayingDebt] = useState<{
        code: string;
        name: string;
        maxAmount: number;
    } | null>(null);
    const [showDocModal, setShowDocModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [printDoc, setPrintDoc] = useState<any | null>(null);
    const [printTarget, setPrintTarget] = useState<'full' | 'nota' | 'kwitansi'>('full');
    const [docTab, setDocTab] = useState<'nota' | 'kwitansi'>('nota');
    const [showA5PreviewModal, setShowA5PreviewModal] = useState<boolean>(false);
    const [a5PreviewZoom, setA5PreviewZoom] = useState<'fit' | '100%'>('100%');
    const [showMarginGuide, setShowMarginGuide] = useState<boolean>(true);

    // Bulk Selection & Operations States
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
    const [showBulkEditModal, setShowBulkEditModal] = useState<boolean>(false);
    const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);

    // Bulk Edit Form States
    const [isBulkChangeDebet, setIsBulkChangeDebet] = useState<boolean>(false);
    const [bulkAkunDebet, setBulkAkunDebet] = useState<string>('');
    const [isBulkChangeKredit, setIsBulkChangeKredit] = useState<boolean>(false);
    const [bulkAkunKredit, setBulkAkunKredit] = useState<string>('');

    const selectAllHeaderCheckboxRef = useRef<HTMLInputElement>(null);

    // Entry Form States
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [dariKepada, setDariKepada] = useState('Masukkan Nama/Toko/dsb');
    const [showPihakKetigaSug, setShowPihakKetigaSug] = useState(false);

    const [akunDebet, setAkunDebet] = useState('');
    const [akunDebetSearch, setAkunDebetSearch] = useState('');
    const [showDebetDropdown, setShowDebetDropdown] = useState(false);

    const [akunKredit, setAkunKredit] = useState('');
    const [akunKreditSearch, setAkunKreditSearch] = useState('');
    const [showKreditDropdown, setShowKreditDropdown] = useState(false);
    const [showKasBersaldoDropdown, setShowKasBersaldoDropdown] = useState(false);
    const kasBersaldoRef = useRef<HTMLDivElement>(null);

    const [uraian, setUraian] = useState('');

    const [nominal, setNominal] = useState<number>(0);

    // Real-time calculated sequential ID based on selected date: JU-duadigittahunbulantanggalnourut (e.g. JU-26090601)
    const previewNextId = useMemo(() => {
        return generateSequentialJuId(tanggal, entries, bkuData, bkpData);
    }, [tanggal, entries, bkuData, bkpData]);

    // Document Verification Temp State
    const [tempEntry, setTempEntry] = useState<any | null>(null);

    // Edit Form States
    const [editingEntry, setEditingEntry] = useState<any | null>(null);
    const [editTanggal, setEditTanggal] = useState('');
    const [editDariKepada, setEditDariKepada] = useState('');
    const [showEditPihakKetigaSug, setShowEditPihakKetigaSug] = useState(false);

    const [editAkunDebet, setEditAkunDebet] = useState('');
    const [editAkunDebetSearch, setEditAkunDebetSearch] = useState('');
    const [showEditDebetDropdown, setShowEditDebetDropdown] = useState(false);

    const [editAkunKredit, setEditAkunKredit] = useState('');
    const [editAkunKreditSearch, setEditAkunKreditSearch] = useState('');
    const [showEditKreditDropdown, setShowEditKreditDropdown] = useState(false);

    const [editUraian, setEditUraian] = useState('');

    const [editNominal, setEditNominal] = useState<number>(0);

    // Modal Validasi Pasangan Akun Debet & Kredit
    const [showAccountValidationModal, setShowAccountValidationModal] = useState<boolean>(false);
    const [validationModalContext, setValidationModalContext] = useState<'new' | 'edit'>('new');

    // Dynamic Nota Items for Beban
    const [notaItems, setNotaItems] = useState<NotaItem[]>([{ id: '1', name: '', qty: 1, price: 0 }]);

    // Signature Settings State
    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('ju_keliangName') || 'I MADE MUDITA');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('ju_juruRaksaName') || 'I PUTU GEDE SUTRANA');
    const [penerimaName, setPenerimaName] = useState(() => localStorage.getItem('ju_penerimaName') || 'Juru Raksa Desa Adat');
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('ju_customPlace') || 'Basangalas');
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('ju_signatureDate') || new Date().toISOString().split('T')[0]);

    const [tempKeliangName, setTempKeliangName] = useState(keliangName);
    const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
    const [tempPenerimaName, setTempPenerimaName] = useState(penerimaName);
    const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
    const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);

    // Kwitansi & Nota Edit States
    const [isEditingTelahTerima, setIsEditingTelahTerima] = useState(false);
    const [isEditingPenerima, setIsEditingPenerima] = useState(false);
    const [isEditingKepada, setIsEditingKepada] = useState(false);
    const [isEditingHormatSaya, setIsEditingHormatSaya] = useState(false);
    const [isEditingDocTelahTerima, setIsEditingDocTelahTerima] = useState(false);
    const [isEditingDocPenerima, setIsEditingDocPenerima] = useState(false);
    const [isEditingDocKepada, setIsEditingDocKepada] = useState(false);
    const [isEditingDocHormatSaya, setIsEditingDocHormatSaya] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');

    // Import Excel State
    const [importFile, setImportFile] = useState<File | null>(null);
    const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterAccount, setFilterAccount] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showQuickFilter, setShowQuickFilter] = useState(false);

    // Dynamic list of available years from data
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        const curYear = new Date().getFullYear().toString();
        const prevYear = (new Date().getFullYear() - 1).toString();
        years.add(curYear);
        years.add(prevYear);
        entries.forEach(e => {
            if (e.date) {
                const yr = e.date.substring(0, 4);
                if (yr && !isNaN(Number(yr))) years.add(yr);
            }
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [entries]);

    const handleSetPeriodPreset = (preset: 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year') => {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1; // 1-12

        if (preset === 'all') {
            setFilterStartDate('');
            setFilterEndDate('');
            setSelectedMonth('');
            setSelectedYear('');
            setCurrentPage(1);
        } else if (preset === 'this_month') {
            const mStr = String(curMonth).padStart(2, '0');
            const lastDay = new Date(curYear, curMonth, 0).getDate();
            const start = `${curYear}-${mStr}-01`;
            const end = `${curYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
            setFilterStartDate(start);
            setFilterEndDate(end);
            setSelectedMonth(mStr);
            setSelectedYear(String(curYear));
            setCurrentPage(1);
        } else if (preset === 'last_month') {
            const lastMonthDate = new Date(curYear, now.getMonth() - 1, 1);
            const prevYear = lastMonthDate.getFullYear();
            const prevMonth = lastMonthDate.getMonth() + 1;
            const mStr = String(prevMonth).padStart(2, '0');
            const lastDay = new Date(prevYear, prevMonth, 0).getDate();
            const start = `${prevYear}-${mStr}-01`;
            const end = `${prevYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
            setFilterStartDate(start);
            setFilterEndDate(end);
            setSelectedMonth(mStr);
            setSelectedYear(String(prevYear));
            setCurrentPage(1);
        } else if (preset === 'this_year') {
            const start = `${curYear}-01-01`;
            const end = `${curYear}-12-31`;
            setFilterStartDate(start);
            setFilterEndDate(end);
            setSelectedMonth('');
            setSelectedYear(String(curYear));
            setCurrentPage(1);
        } else if (preset === 'last_year') {
            const lastYear = curYear - 1;
            const start = `${lastYear}-01-01`;
            const end = `${lastYear}-12-31`;
            setFilterStartDate(start);
            setFilterEndDate(end);
            setSelectedMonth('');
            setSelectedYear(String(lastYear));
            setCurrentPage(1);
        }
    };

    const handleMonthYearChange = (month: string, year: string) => {
        setSelectedMonth(month);
        setSelectedYear(year);
        setCurrentPage(1);

        if (!year && !month) {
            setFilterStartDate('');
            setFilterEndDate('');
            return;
        }

        const targetYear = year || new Date().getFullYear().toString();
        if (month) {
            const mNum = parseInt(month, 10);
            const yNum = parseInt(targetYear, 10);
            const lastDay = new Date(yNum, mNum, 0).getDate();
            setFilterStartDate(`${targetYear}-${month}-01`);
            setFilterEndDate(`${targetYear}-${month}-${String(lastDay).padStart(2, '0')}`);
            if (!year) setSelectedYear(targetYear);
        } else {
            setFilterStartDate(`${targetYear}-01-01`);
            setFilterEndDate(`${targetYear}-12-31`);
        }
    };

    const handleCustomStartDateChange = (val: string) => {
        setFilterStartDate(val);
        setSelectedMonth('');
        setCurrentPage(1);
    };

    const handleCustomEndDateChange = (val: string) => {
        setFilterEndDate(val);
        setSelectedMonth('');
        setCurrentPage(1);
    };

    const activePeriodLabel = useMemo(() => {
        if (!filterStartDate && !filterEndDate) {
            return 'Semua Periode (Keseluruhan Transaksi)';
        }
        if (filterStartDate && filterEndDate) {
            if (filterStartDate.endsWith('-01-01') && filterEndDate.endsWith('-12-31') && filterStartDate.substring(0, 4) === filterEndDate.substring(0, 4)) {
                return `Tahun ${filterStartDate.substring(0, 4)}`;
            }
            if (filterStartDate.substring(0, 7) === filterEndDate.substring(0, 7) && filterStartDate.endsWith('-01')) {
                const year = filterStartDate.substring(0, 4);
                const month = filterStartDate.substring(5, 7);
                const mObj = MONTHS_LIST.find(m => m.value === month);
                const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
                if (filterEndDate.endsWith(`-${String(lastDay).padStart(2, '0')}`)) {
                    return `Bulan ${mObj ? mObj.label : month} ${year}`;
                }
            }
            return `${formatDate(filterStartDate)} s.d. ${formatDate(filterEndDate)}`;
        }
        if (filterStartDate) {
            return `Mulai ${formatDate(filterStartDate)} s.d. Sekarang`;
        }
        return `s.d. ${formatDate(filterEndDate)}`;
    }, [filterStartDate, filterEndDate]);

    // Menu Dropdown and PDF Export State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close Kas Bersaldo dropdown when entry modal closes
    useEffect(() => {
        if (!showEntryModal) {
            setShowKasBersaldoDropdown(false);
        }
    }, [showEntryModal]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (kasBersaldoRef.current && !kasBersaldoRef.current.contains(event.target as Node)) {
                setShowKasBersaldoDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Profile object for verification / receipts
    const profile = useMemo(() => ({
        namaDesa: 'DESA ADAT BASANGALAS',
        namaBendahara: juruRaksaName || 'I PUTU GEDE SUTRANA',
        alamat: 'Jln. raya Basangalas, Tribuana, Kecamatan Abang, Kabupaten Karangasem - Bali'
    }), [juruRaksaName]);

    // Accounts with type mapping
    const ACCOUNTS = useMemo(() => {
        return REFERENSI_REKENING.map(r => {
            let type = 'Lainnya';
            if (isKasAccount(r.code)) type = 'Kas';
            else if (r.code.startsWith('1.')) type = 'Aset';
            else if (r.code.startsWith('2.')) type = 'Kewajiban';
            else if (r.code.startsWith('3.')) type = 'Ekuitas';
            else if (r.code.startsWith('4.')) type = 'Pendapatan';
            else if (r.code.startsWith('5.')) type = 'Beban';
            else if (r.code.startsWith('6.')) type = 'Pembiayaan';
            return { code: r.code, name: r.name, type };
        });
    }, []);

    // Perhitungan Pos Hutang & Kewajiban (Akun Kepala 2.)
    const debtSummary = useMemo(() => {
        const safeEntries = Array.isArray(entries) ? entries : [];
        const debtMap: Record<string, {
            code: string;
            name: string;
            totalKredit: number;
            totalDebet: number;
            txCount: number;
            lastDate?: string;
            creditors: Set<string>;
            descriptions: string[];
            transactionsMap: Record<string, DebtTransactionDetail>;
        }> = {};

        // Inisialisasi akun kewajiban dari REFERENSI_REKENING
        REFERENSI_REKENING.forEach(acc => {
            if (acc.code.startsWith('2.')) {
                debtMap[acc.code] = {
                    code: acc.code,
                    name: acc.name,
                    totalKredit: 0,
                    totalDebet: 0,
                    txCount: 0,
                    lastDate: undefined,
                    creditors: new Set(),
                    descriptions: [],
                    transactionsMap: {}
                };
            }
        });

        // Group rows by idTransaksi for multi-row context
        const txGroupMap: Record<string, JuDisplayRow[]> = {};
        safeEntries.forEach(row => {
            const txId = row.idTransaksi || row.rowId || `TX-${Math.random()}`;
            if (!txGroupMap[txId]) txGroupMap[txId] = [];
            txGroupMap[txId].push(row);
        });

        Object.entries(txGroupMap).forEach(([txId, rows]) => {
            rows.forEach(row => {
                const cleanRekening = (row.kodeRekening || (row as any).kodeAkunDebet || (row as any).kodeAkunKredit || '').split(' - ')[0].trim();
                const debetVal = Number(row.debet) || 0;
                const kreditVal = Number(row.kredit) || 0;
                const rowDate = row.date || (row as any).tanggal;
                const rowUraian = (row.uraian || '').trim();

                let creditor = ((row as any).pihakKetiga || '').trim();
                if (!creditor && rowUraian) {
                    if (rowUraian.includes(' kepada ')) {
                        creditor = rowUraian.split(' kepada ')[1].trim();
                    } else if (rowUraian.includes(' dari ')) {
                        creditor = rowUraian.split(' dari ')[1].trim();
                    }
                }

                if (cleanRekening.startsWith('2.')) {
                    if (!debtMap[cleanRekening]) {
                        const accMatch = REFERENSI_REKENING.find(r => r.code === cleanRekening);
                        debtMap[cleanRekening] = {
                            code: cleanRekening,
                            name: accMatch ? accMatch.name : (row.kodeRekening?.includes(' - ') ? row.kodeRekening.split(' - ').slice(1).join(' - ').trim() : `Kewajiban (${cleanRekening})`),
                            totalKredit: 0,
                            totalDebet: 0,
                            txCount: 0,
                            creditors: new Set(),
                            descriptions: [],
                            transactionsMap: {}
                        };
                    }

                    const item = debtMap[cleanRekening];

                    // Timbul hutang / kewajiban (Kredit)
                    if (kreditVal > 0 || row.rowType === 'kredit') {
                        const amt = kreditVal || parseNumber((row as any).nominal);
                        if (amt > 0) {
                            item.totalKredit += amt;
                            item.txCount += 1;
                            if (rowDate && (!item.lastDate || rowDate > item.lastDate)) {
                                item.lastDate = rowDate;
                            }
                            if (creditor) item.creditors.add(creditor);
                            if (rowUraian && !item.descriptions.includes(rowUraian)) {
                                item.descriptions.push(rowUraian);
                            }

                            const oppRow = rows.find(r => r !== row && ((r.kodeRekening && !r.kodeRekening.startsWith('2.')) || r.rowType === 'debet'));
                            const oppAcc = oppRow?.kodeRekening || 'Beban/Aset';

                            if (!item.transactionsMap[txId]) {
                                item.transactionsMap[txId] = {
                                    idTransaksi: txId,
                                    date: rowDate || '',
                                    uraian: rowUraian,
                                    creditor: creditor || undefined,
                                    opposingAccount: oppAcc,
                                    nominal: amt,
                                    totalKredit: amt,
                                    totalDebet: 0,
                                    sisa: amt
                                };
                            } else {
                                item.transactionsMap[txId].totalKredit += amt;
                                item.transactionsMap[txId].sisa = Math.max(0, item.transactionsMap[txId].totalKredit - item.transactionsMap[txId].totalDebet);
                            }
                        }
                    }

                    // Pelunasan hutang (Debet)
                    if (debetVal > 0 || row.rowType === 'debet') {
                        const amt = debetVal || parseNumber((row as any).nominal);
                        if (amt > 0) {
                            item.totalDebet += amt;
                            item.txCount += 1;
                            if (rowDate && (!item.lastDate || rowDate > item.lastDate)) {
                                item.lastDate = rowDate;
                            }
                            if (creditor) item.creditors.add(creditor);
                            if (rowUraian && !item.descriptions.includes(rowUraian)) {
                                item.descriptions.push(rowUraian);
                            }

                            if (item.transactionsMap[txId]) {
                                item.transactionsMap[txId].totalDebet += amt;
                                item.transactionsMap[txId].sisa = Math.max(0, item.transactionsMap[txId].totalKredit - item.transactionsMap[txId].totalDebet);
                            }
                        }
                    }
                }
            });
        });

        const list: DebtItem[] = Object.values(debtMap)
            .filter(d => d.totalKredit > 0 || d.totalDebet > 0)
            .map(d => {
                const sisa = Math.max(0, d.totalKredit - d.totalDebet);
                const creditorsArr = Array.from(d.creditors);
                const txList = Object.values(d.transactionsMap);
                return {
                    code: d.code,
                    name: d.name,
                    totalKredit: d.totalKredit,
                    totalDebet: d.totalDebet,
                    sisaHutang: sisa,
                    txCount: d.txCount,
                    lastDate: d.lastDate,
                    primaryCreditor: creditorsArr[0] || undefined,
                    allCreditors: creditorsArr,
                    recentDescriptions: d.descriptions.slice(0, 5),
                    transactions: txList
                };
            });

        const totalPenambahan = list.reduce((acc, curr) => acc + curr.totalKredit, 0);
        const totalPelunasan = list.reduce((acc, curr) => acc + curr.totalDebet, 0);
        const totalSisa = list.reduce((acc, curr) => acc + curr.sisaHutang, 0);

        return {
            debts: list,
            totalPenambahanHutang: totalPenambahan,
            totalPelunasanHutang: totalPelunasan,
            totalSisaHutang: totalSisa,
            hasOutstandingDebt: totalSisa > 0
        };
    }, [entries]);

    // Perhitungan Saldo Kas Akun 1.1.*
    const cashAccountBalances = useMemo<Record<string, { code: string; name: string; balance: number }>>(() => {
        const safeEntries = Array.isArray(entries) ? entries : [];
        const balances: Record<string, { code: string; name: string; balance: number }> = {};

        // Inisialisasi dari REFERENSI_REKENING yang merupakan akun kas
        REFERENSI_REKENING.forEach(acc => {
            if (isKasAccount(acc.code)) {
                balances[acc.code] = {
                    code: acc.code,
                    name: acc.name,
                    balance: 0
                };
            }
        });

        safeEntries.forEach(row => {
            const cleanCode = (row.kodeRekening || (row as any).kodeAkunDebet || (row as any).kodeAkunKredit || '').split(' - ')[0].trim();
            if (isKasAccount(cleanCode)) {
                if (!balances[cleanCode]) {
                    const accMatch = REFERENSI_REKENING.find(r => r.code === cleanCode);
                    balances[cleanCode] = {
                        code: cleanCode,
                        name: accMatch ? accMatch.name : (row.kodeRekening?.includes(' - ') ? row.kodeRekening.split(' - ').slice(1).join(' - ').trim() : `Kas (${cleanCode})`),
                        balance: 0
                    };
                }

                const debetVal = Number(row.debet) || 0;
                const kreditVal = Number(row.kredit) || 0;
                balances[cleanCode].balance += (debetVal - kreditVal);
            }
        });

        return balances;
    }, [entries]);

    // Helper untuk memilih akun kas terbaik yang memiliki saldo mencukupi
    const getBestCashAccountWithBalance = (preferredAmount: number = 0): { code: string; name: string; balance: number } | null => {
        const cashList: { code: string; name: string; balance: number }[] = Object.values(cashAccountBalances);
        if (preferredAmount > 0) {
            const sufficient = cashList.find(c => c.balance >= preferredAmount);
            if (sufficient) return sufficient;
        }
        const positive = cashList.find(c => c.balance > 0);
        if (positive) return positive;
        return cashList.find(c => c.code === '1.1.1.01') || cashList[0] || null;
    };

    // Daftar akun kas yang memiliki saldo > 0
    const positiveCashAccounts = useMemo(() => {
        const cashList: { code: string; name: string; balance: number }[] = Object.values(cashAccountBalances);
        return cashList
            .filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance);
    }, [cashAccountBalances]);

    const terbilang = (num: number) => {
        if (!num || num <= 0) return 'nol rupiah';
        const words = numberToWords(num);
        return `${words} rupiah`.toLowerCase();
    };

    const getAccName = (code: string) => {
        if (!code) return '-';
        const cleanCode = code.split(' - ')[0].trim();
        const acc = REFERENSI_REKENING.find(r => r.code === cleanCode);
        if (acc) return acc.name;
        const b = budgetItems?.find(item => item.kode === cleanCode);
        if (b) return b.uraian || b.keterangan || 'Pos Anggaran';
        return cleanCode;
    };

    const getBkuBkpCategory = (code: string) => {
        if (!code) return '-';
        const cleanCode = code.split(' - ')[0].trim();
        if (cleanCode === '4.1.1.01' || cleanCode === '1.1.1.01') return 'Pianak Jinah';
        const name = getAccName(cleanCode);
        if (name.toLowerCase().includes('pianak jinah')) return 'Pianak Jinah';
        return name;
    };

    const isBebanAccount = (code: string) => {
        if (!code) return false;
        const cleanCode = code.split(' - ')[0].trim();
        return cleanCode.startsWith('5.');
    };

    const getDocDefaults = (debetCode: string, kreditCode: string, boxParty?: string, defaultJuruRaksa: string = 'Juru Raksa Desa Adat') => {
        const cleanDebet = debetCode ? debetCode.split(' - ')[0].trim() : '';
        const cleanKredit = kreditCode ? kreditCode.split(' - ')[0].trim() : '';
        const isDebetKas = isKasAccount(cleanDebet);
        const isKreditKas = isKasAccount(cleanKredit);
        const isBeban = cleanDebet.startsWith('5.');
        const isPendapatan = cleanKredit.startsWith('4.');

        const party = (boxParty && boxParty.trim() !== '-' && boxParty.trim() !== '' && boxParty.trim() !== 'Masukkan Nama/Toko/dsb') ? boxParty.trim() : '';

        if (isKreditKas && isBeban) {
            // ATURAN 1:
            // Kredit adalah Kas (1.1.....) dan Debet adalah beban/Belanja (5.....):
            // - Dokumen transaksi utama: NOTA BELANJA
            // - NOTA BELANJA:
            //   - Kepada/rekanan : (default) Desa Adat Basangalas (edit)
            //   - Hormat Saya/Rekanan : (Nama di Box Kepada, edit)
            // - KWITANSI:
            //   - Telah terima dari : (default) Juru Raksa Desa Adat (edit)
            //   - Yang Menerima : (Box Kepada/Dari) edit
            return {
                primaryDocType: 'nota' as const,
                notaKepada: 'Desa Adat Basangalas',
                notaHormatSaya: party || 'Pihak Rekanan',
                kwitansiTelahTerima: defaultJuruRaksa,
                kwitansiPenerima: party || 'Pihak Rekanan'
            };
        } else if (isDebetKas && (isPendapatan || !isKreditKas)) {
            // ATURAN 2:
            // Kredit adalah Pendapatan dan Debet adalah Kas:
            // - Dokumen transaksi utama: KWITANSI
            // - KWITANSI:
            //   - Telah terima dari : (default) (Box Kepada/Dari) edit
            //   - Yang Menerima : Juru Raksa Desa Adat (bisa diedit)
            // - NOTA BELANJA:
            //   - Kepada/rekanan : (default) (Nama di Box Kepada, edit)
            //   - Hormat Saya/Rekanan : (Juru Raksa Desa Adat)
            return {
                primaryDocType: 'kwitansi' as const,
                kwitansiTelahTerima: party || 'Penyetor / Pihak Ketiga',
                kwitansiPenerima: defaultJuruRaksa,
                notaKepada: party || 'Pihak Ketiga',
                notaHormatSaya: defaultJuruRaksa
            };
        } else if (isKreditKas) {
            return {
                primaryDocType: 'nota' as const,
                notaKepada: 'Desa Adat Basangalas',
                notaHormatSaya: party || 'Pihak Rekanan',
                kwitansiTelahTerima: defaultJuruRaksa,
                kwitansiPenerima: party || 'Pihak Rekanan'
            };
        } else {
            return {
                primaryDocType: isDebetKas ? ('kwitansi' as const) : ('nota' as const),
                kwitansiTelahTerima: isDebetKas ? (party || 'Penyetor / Pihak Ketiga') : defaultJuruRaksa,
                kwitansiPenerima: isDebetKas ? defaultJuruRaksa : (party || 'Pihak Rekanan'),
                notaKepada: isDebetKas ? (party || 'Pihak Ketiga') : 'Desa Adat Basangalas',
                notaHormatSaya: isDebetKas ? defaultJuruRaksa : (party || 'Pihak Rekanan')
            };
        }
    };

    const displayPenerima = (name?: string) => {
        if (name === undefined || name === null) return '......................';
        if (name.trim() === '' || name === '-') return '......................';
        return name;
    };

    const displayRekanan = (name?: string) => {
        if (name === undefined || name === null) return '......................';
        if (name.trim() === '' || name === '-') return '......................';
        return name;
    };

    const activePrintData = useMemo(() => {
        const data = printDoc || tempEntry;
        if (!data) return null;

        const isBeban = isBebanAccount(data.akunDebet);
        const defaults = getDocDefaults(
            data.akunDebet, 
            data.akunKredit, 
            data.dariKepada || data.originalDariKepada, 
            juruRaksaName || 'Juru Raksa Desa Adat'
        );

        const notaKepadaVal = data.notaKepada !== undefined ? data.notaKepada : defaults.notaKepada;
        const notaHormatSayaVal = data.notaHormatSaya !== undefined ? data.notaHormatSaya : defaults.notaHormatSaya;
        const kwitansiTelahTerimaVal = data.kwitansiTelahTerima !== undefined ? data.kwitansiTelahTerima : defaults.kwitansiTelahTerima;
        const kwitansiPenerimaVal = data.kwitansiPenerima !== undefined ? data.kwitansiPenerima : defaults.kwitansiPenerima;

        const totalNominal = isBeban && notaItems.length > 0 && !printDoc
            ? notaItems.reduce((s, i) => s + (parseNumber(i.qty) * parseNumber(i.price)), 0)
            : (data.nominal || 0);

        return {
            id: data.id || (data.isEdit ? data.id : 'JKU-TEMP-001'),
            tanggal: data.tanggal,
            dariKepada: data.dariKepada,
            uraian: data.uraian || '-',
            akunDebet: data.akunDebet,
            akunKredit: data.akunKredit,
            nominal: totalNominal,
            terbilang: data.terbilang || terbilang(totalNominal),
            items: data.items || (isBeban ? notaItems : []),
            primaryDocType: data.primaryDocType || defaults.primaryDocType,
            notaKepada: notaKepadaVal,
            notaHormatSaya: notaHormatSayaVal,
            kwitansiTelahTerima: kwitansiTelahTerimaVal,
            kwitansiPenerima: kwitansiPenerimaVal,
        };
    }, [printDoc, tempEntry, notaItems, juruRaksaName]);

    useEffect(() => {
        const handleAfterPrint = () => {
            setPrintTarget('full');
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

    const handlePrintFullJurnal = () => {
        setPrintTarget('full');
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handlePrintNota = (customDocData?: any) => {
        if (customDocData) {
            setPrintDoc(customDocData);
        }
        setPrintTarget('nota');
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handlePrintKwitansi = (customDocData?: any) => {
        if (customDocData) {
            setPrintDoc(customDocData);
        }
        setPrintTarget('kwitansi');
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const existingPihakKetiga = useMemo(() => {
        const set = new Set<string>();
        entries.forEach(e => {
            if (e.uraian) {
                if (e.uraian.includes(' dari ')) {
                    const parts = e.uraian.split(' dari ');
                    if (parts[1]?.trim()) set.add(parts[1].trim());
                } else if (e.uraian.includes(' kepada ')) {
                    const parts = e.uraian.split(' kepada ');
                    if (parts[1]?.trim()) set.add(parts[1].trim());
                }
            }
        });
        return Array.from(set).sort();
    }, [entries]);

    const existingUraians = useMemo(() => {
        const set = new Set<string>();
        entries.forEach(e => {
            if (e.uraian) {
                let u = e.uraian;
                if (u.includes(' dari ')) u = u.split(' dari ')[0];
                if (u.includes(' kepada ')) u = u.split(' kepada ')[0];
                u = u.replace(/^Penerimaan\s+/, '').trim();
                if (u) set.add(u);
            }
        });
        return Array.from(set).sort();
    }, [entries]);

    const uniqueJuAccounts = useMemo(() => {
        const map = new Map<string, string>();
        if (!Array.isArray(entries)) return [];

        entries.forEach(e => {
            const rawCode = (e.kodeRekening || (e as any).kodeAkunDebet || (e as any).kodeAkunKredit || '').trim();
            if (!rawCode) return;

            const cleanCode = rawCode.split(' - ')[0].trim();
            if (!cleanCode) return;

            const accName = getAccName(cleanCode);
            const label = accName && accName !== cleanCode && !cleanCode.toLowerCase().includes(accName.toLowerCase())
                ? `${cleanCode} - ${accName}`
                : rawCode;

            if (!map.has(cleanCode)) {
                map.set(cleanCode, label);
            }
        });

        return Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
    }, [entries, budgetItems]);

    const filteredEntries = useMemo(() => {
        let result = entries;

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(e => {
                const accountName = getAccName(e.kodeRekening || '').toLowerCase();
                const uraianStr = (e.uraian || '').toLowerCase();
                const idTx = e.idTransaksi ? e.idTransaksi.toLowerCase() : '';
                const kodeRek = e.kodeRekening ? e.kodeRekening.toLowerCase() : '';
                return uraianStr.includes(lower) || accountName.includes(lower) || idTx.includes(lower) || kodeRek.includes(lower);
            });
        }

        if (filterStartDate) {
            result = result.filter(e => e.date && e.date >= filterStartDate);
        }
        if (filterEndDate) {
            result = result.filter(e => e.date && e.date <= filterEndDate);
        }

        if (filterAccount) {
            const selectedCode = filterAccount.split(' - ')[0].trim().toLowerCase();
            result = result.filter(e => {
                const cleanCode = (e.kodeRekening || '').split(' - ')[0].trim().toLowerCase();
                return cleanCode === selectedCode || (e.kodeRekening && e.kodeRekening.trim().toLowerCase() === selectedCode);
            });
        }

        return [...result].sort((a, b) => {
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            if (dateB !== dateA) return dateB - dateA;
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            const groupA = Math.floor(timeA / 100);
            const groupB = Math.floor(timeB / 100);
            if (groupB !== groupA) return groupB - groupA;
            if (a.rowType === 'debet' && b.rowType === 'kredit') return -1;
            if (a.rowType === 'kredit' && b.rowType === 'debet') return 1;
            return 0;
        });
    }, [entries, searchTerm, filterStartDate, filterEndDate, filterAccount]);

    const pageCount = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE) || 1;

    const paginatedEntries = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredEntries, currentPage]);

    const summary = useMemo(() => {
        const totalDebet = filteredEntries.reduce((acc, item) => acc + item.debet, 0);
        const totalKredit = filteredEntries.reduce((acc, item) => acc + item.kredit, 0);
        return { totalDebet, totalKredit };
    }, [filteredEntries]);

    // Unique transaction IDs on the current page
    const pageTxIds = useMemo(() => {
        const ids = new Set<string>();
        paginatedEntries.forEach(e => {
            if (e.idTransaksi) ids.add(e.idTransaksi);
        });
        return Array.from(ids);
    }, [paginatedEntries]);

    // Unique transaction IDs across all filtered results
    const filteredTxIds = useMemo(() => {
        const ids = new Set<string>();
        filteredEntries.forEach(e => {
            if (e.idTransaksi) ids.add(e.idTransaksi);
        });
        return Array.from(ids);
    }, [filteredEntries]);

    const isAllCurrentPageSelected = useMemo(() => {
        return pageTxIds.length > 0 && pageTxIds.every(id => selectedTxIds.has(id));
    }, [pageTxIds, selectedTxIds]);

    const isSomeCurrentPageSelected = useMemo(() => {
        return pageTxIds.some(id => selectedTxIds.has(id)) && !isAllCurrentPageSelected;
    }, [pageTxIds, selectedTxIds, isAllCurrentPageSelected]);

    // Sync indeterminate state for table header checkbox
    useEffect(() => {
        if (selectAllHeaderCheckboxRef.current) {
            selectAllHeaderCheckboxRef.current.indeterminate = isSomeCurrentPageSelected;
        }
    }, [isSomeCurrentPageSelected]);

    // List and summary of currently selected transactions
    const selectedTransactionsList = useMemo(() => {
        if (selectedTxIds.size === 0) return [];
        const map = new Map<string, {
            idTransaksi: string;
            date: string;
            uraian: string;
            nominal: number;
            akunDebet: string;
            akunKredit: string;
        }>();

        entries.forEach(e => {
            if (!e.idTransaksi || !selectedTxIds.has(e.idTransaksi)) return;
            if (!map.has(e.idTransaksi)) {
                map.set(e.idTransaksi, {
                    idTransaksi: e.idTransaksi,
                    date: e.date || '',
                    uraian: e.uraian || '',
                    nominal: e.debet || e.kredit || 0,
                    akunDebet: e.rowType === 'debet' ? e.kodeRekening : '',
                    akunKredit: e.rowType === 'kredit' ? e.kodeRekening : ''
                });
            } else {
                const item = map.get(e.idTransaksi)!;
                if (e.rowType === 'debet') {
                    item.akunDebet = e.kodeRekening;
                    if (!item.nominal) item.nominal = e.debet;
                    if (!item.uraian) item.uraian = e.uraian;
                }
                if (e.rowType === 'kredit') {
                    item.akunKredit = e.kodeRekening;
                    if (!item.nominal) item.nominal = e.kredit;
                }
            }
        });

        return Array.from(map.values());
    }, [entries, selectedTxIds]);

    const selectedTotalAmount = useMemo(() => {
        return selectedTransactionsList.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
    }, [selectedTransactionsList]);

    const handleToggleSelectTx = (idTransaksi: string) => {
        if (!idTransaksi) return;
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            if (next.has(idTransaksi)) {
                next.delete(idTransaksi);
            } else {
                next.add(idTransaksi);
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (isAllCurrentPageSelected) {
            setSelectedTxIds(prev => {
                const next = new Set(prev);
                pageTxIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedTxIds(prev => {
                const next = new Set(prev);
                pageTxIds.forEach(id => next.add(id));
                return next;
            });
        }
    };

    const handleSelectAllFiltered = () => {
        setSelectedTxIds(new Set(filteredTxIds));
    };

    const handleSelectAllCurrentPage = () => {
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            pageTxIds.forEach(id => next.add(id));
            return next;
        });
    };

    const handleDeselectAll = () => {
        setSelectedTxIds(new Set());
    };

    const handleExecuteBulkDelete = async () => {
        const idsToDelete: string[] = Array.from(selectedTxIds);
        if (idsToDelete.length === 0) return;

        setIsBulkProcessing(true);
        try {
            if (onDeleteMultipleTransactions) {
                await onDeleteMultipleTransactions(idsToDelete);
            } else {
                for (const id of idsToDelete) {
                    await onDeleteTransaction(id);
                }
            }
            playDeleteSuccessSound();
            setNotification({
                message: `Berhasil menghapus ${idsToDelete.length} transaksi sekaligus dari Jurnal Umum, BKU, dan BKP.`,
                type: 'success'
            });
            setSelectedTxIds(new Set());
            setShowBulkDeleteModal(false);
        } catch (err) {
            console.error('Bulk delete error:', err);
            playErrorSound();
            setNotification({
                message: 'Gagal menghapus beberapa transaksi massal. Silakan coba lagi.',
                type: 'error'
            });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleExecuteBulkEditAccounts = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isBulkChangeDebet && !isBulkChangeKredit) {
            setNotification({
                message: 'Pilih minimal satu opsi: Ubah Akun Debet atau Ubah Akun Kredit.',
                type: 'error'
            });
            return;
        }

        if (isBulkChangeDebet && !bulkAkunDebet) {
            setNotification({
                message: 'Harap pilih akun debet baru yang akan diterapkan.',
                type: 'error'
            });
            return;
        }

        if (isBulkChangeKredit && !bulkAkunKredit) {
            setNotification({
                message: 'Harap pilih akun kredit baru yang akan diterapkan.',
                type: 'error'
            });
            return;
        }

        if (isBulkChangeDebet && isBulkChangeKredit && bulkAkunDebet === bulkAkunKredit) {
            setNotification({
                message: 'Akun Debet dan Akun Kredit tidak boleh sama!',
                type: 'error'
            });
            return;
        }

        const idsToEdit: string[] = Array.from(selectedTxIds);
        if (idsToEdit.length === 0) return;

        setIsBulkProcessing(true);
        try {
            const txBatchList: {
                idTransaksi: string;
                juRows: JuDisplayRow[];
                bkuRows: Omit<BkuData, 'id' | 'saldo'>[];
                bkpRows: Omit<BkpData, 'id' | 'saldo'>[];
            }[] = [];

            for (const idTx of idsToEdit) {
                const relatedJu = entries.filter(e => e.idTransaksi === idTx);
                if (relatedJu.length === 0) continue;

                const debetRow = relatedJu.find(r => r.rowType === 'debet');
                const kreditRow = relatedJu.find(r => r.rowType === 'kredit');

                const origDebetCode = debetRow?.kodeRekening || '';
                const origKreditCode = kreditRow?.kodeRekening || '';
                const totalAmount = debetRow?.debet || kreditRow?.kredit || 0;
                const txDate = debetRow?.date || kreditRow?.date || new Date().toISOString().split('T')[0];
                const fullUraian = debetRow?.uraian || kreditRow?.uraian || '';

                const targetDebet = isBulkChangeDebet && bulkAkunDebet ? bulkAkunDebet : origDebetCode;
                const targetKredit = isBulkChangeKredit && bulkAkunKredit ? bulkAkunKredit : origKreditCode;

                if (!targetDebet || !targetKredit || targetDebet === targetKredit) {
                    continue;
                }

                // 1. JU Rows
                const juRows: JuDisplayRow[] = [
                    {
                        ...(debetRow || {}),
                        rowId: `${idTx}-debet`,
                        idTransaksi: idTx,
                        date: txDate,
                        kodeRekening: targetDebet,
                        uraian: fullUraian,
                        debet: totalAmount,
                        kredit: 0,
                        rowType: 'debet'
                    },
                    {
                        ...(kreditRow || {}),
                        rowId: `${idTx}-kredit`,
                        idTransaksi: idTx,
                        date: txDate,
                        kodeRekening: targetKredit,
                        uraian: fullUraian,
                        debet: 0,
                        kredit: totalAmount,
                        rowType: 'kredit'
                    }
                ];

                // 2. BKU Rows
                const bkuRows: Omit<BkuData, 'id' | 'saldo'>[] = [];
                if (isKasAccount(targetDebet)) {
                    bkuRows.push({
                        idTransaksi: idTx,
                        noBukti: idTx,
                        bukti: idTx,
                        tanggal: txDate,
                        kode: targetDebet,
                        uraian: fullUraian,
                        kategori: getKategoriForBkuTx(targetDebet, targetKredit, true),
                        penerimaan: totalAmount,
                        pengeluaran: 0
                    });
                }
                if (isKasAccount(targetKredit)) {
                    bkuRows.push({
                        idTransaksi: idTx,
                        noBukti: idTx,
                        bukti: idTx,
                        tanggal: txDate,
                        kode: targetKredit,
                        uraian: fullUraian,
                        kategori: getKategoriForBkuTx(targetDebet, targetKredit, false),
                        penerimaan: 0,
                        pengeluaran: totalAmount
                    });
                }

                // 3. BKP Rows
                const isDebetKas = isKasAccount(targetDebet);
                const mainBkpKategori = getKategoriFromAccountCode(isDebetKas ? targetKredit : targetDebet);
                const relatedBkp = bkpData.filter(b => b.idTransaksi === idTx);
                const bkpRows: Omit<BkpData, 'id' | 'saldo'>[] = [];

                if (relatedBkp.length > 0) {
                    relatedBkp.forEach(b => {
                        bkpRows.push({
                            idTransaksi: idTx,
                            tanggal: txDate,
                            bukti: targetDebet,
                            uraian: b.uraian,
                            kategori: mainBkpKategori,
                            debet: isKasAccount(targetDebet) ? (b.debet || totalAmount) : 0,
                            kredit: isKasAccount(targetKredit) ? (b.kredit || totalAmount) : 0
                        });
                    });
                } else {
                    bkpRows.push({
                        idTransaksi: idTx,
                        tanggal: txDate,
                        bukti: targetDebet,
                        uraian: fullUraian,
                        kategori: mainBkpKategori,
                        debet: isKasAccount(targetDebet) ? totalAmount : 0,
                        kredit: isKasAccount(targetKredit) ? totalAmount : 0
                    });
                }

                txBatchList.push({
                    idTransaksi: idTx,
                    juRows,
                    bkuRows,
                    bkpRows
                });
            }

            if (onBulkUpdateTransactions) {
                await onBulkUpdateTransactions(txBatchList);
            } else {
                for (const item of txBatchList) {
                    await onSaveTransaction(item.juRows, item.bkuRows, item.bkpRows, item.idTransaksi);
                }
            }

            playEditSuccessSound();
            setNotification({
                message: `Berhasil memperbarui akun untuk ${txBatchList.length} transaksi sekaligus!`,
                type: 'success'
            });
            setSelectedTxIds(new Set());
            setShowBulkEditModal(false);
            setBulkAkunDebet('');
            setBulkAkunKredit('');
            setIsBulkChangeDebet(false);
            setIsBulkChangeKredit(false);
        } catch (err) {
            console.error('Bulk edit error:', err);
            playErrorSound();
            setNotification({
                message: 'Gagal memperbarui akun transaksi massal. Silakan coba lagi.',
                type: 'error'
            });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    // Close Category Dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setShowCategoryDropdown(false);
            }
        };
        if (showCategoryDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showCategoryDropdown]);

    // Open Modals Handlers
    const handleOpenInput = () => {
        setShowCategoryDropdown(prev => !prev);
    };

    const handleOpenCategory = (type: TransaksiType) => {
        setShowCategoryDropdown(false);
        setSelectedCategoryType(type);
        setShowKategoriModal(true);
    };

    const handleDirectOpenInput = () => {
        setActivePayingDebt(null);
        setTanggal(new Date().toISOString().split('T')[0]);
        setDariKepada('Masukkan Nama/Toko/dsb');
        setAkunDebet('');
        setAkunDebetSearch('');
        setAkunKredit('');
        setAkunKreditSearch('');
        setUraian('');
        setNominal(0);
        setShowCategoryDropdown(false);
        setSelectedCategoryType(null);
        setShowKategoriModal(false);
        setShowEntryModal(true);
    };

    const handleSelectCategoryTransaction = ({ debet, kredit }: { debet: string; kredit: string }) => {
        setActivePayingDebt(null);
        setTanggal(new Date().toISOString().split('T')[0]);
        setDariKepada('Masukkan Nama/Toko/dsb');

        const cleanDebet = debet.split(' - ')[0].trim();
        const debetMatch = REFERENSI_REKENING.find(r => r.code === cleanDebet);
        setAkunDebet(cleanDebet);
        setAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : cleanDebet);

        const cleanKredit = kredit.split(' - ')[0].trim();
        const kreditMatch = REFERENSI_REKENING.find(r => r.code === cleanKredit);
        setAkunKredit(cleanKredit);
        setAkunKreditSearch(kreditMatch ? `${kreditMatch.code} - ${kreditMatch.name}` : cleanKredit);

        setUraian('');
        setNominal(0);
        setShowCategoryDropdown(false);
        setSelectedCategoryType(null);
        setShowKategoriModal(false);
        setShowEntryModal(true);
    };

    // Auto-open Entry Modal when initiated with pre-selected accounts (e.g. from Dashboard "Transaksi Baru")
    useEffect(() => {
        if (initialAccounts && initialAccounts.autoOpen) {
            setActivePayingDebt(null);
            setTanggal(new Date().toISOString().split('T')[0]);
            setDariKepada('Masukkan Nama/Toko/dsb');

            const cleanDebet = initialAccounts.debet.split(' - ')[0].trim();
            const debetMatch = REFERENSI_REKENING.find(r => r.code === cleanDebet);
            setAkunDebet(cleanDebet);
            setAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : cleanDebet);

            const cleanKredit = initialAccounts.kredit.split(' - ')[0].trim();
            const kreditMatch = REFERENSI_REKENING.find(r => r.code === cleanKredit);
            setAkunKredit(cleanKredit);
            setAkunKreditSearch(kreditMatch ? `${kreditMatch.code} - ${kreditMatch.name}` : cleanKredit);

            setUraian('');
            setNominal(0);
            setShowEntryModal(true);
            onClearInitialAccounts?.();
        }
    }, [initialAccounts, onClearInitialAccounts]);

    const handleSelectPayDebt = (debt: DebtItem, txDetail?: DebtTransactionDetail) => {
        setShowDebtRecapModal(false);
        const targetAmount = txDetail ? txDetail.sisa : debt.sisaHutang;

        setActivePayingDebt({
            code: debt.code,
            name: debt.name,
            maxAmount: targetAmount
        });

        // Set Akun Debet ke akun hutang/kewajiban yang dipilih
        const fullDebet = `${debt.code} - ${debt.name}`;
        setAkunDebet(debt.code);
        setAkunDebetSearch(fullDebet);

        // Akun Kredit: prioritaskan akun kas yang bersaldo (optional)
        const bestCash = getBestCashAccountWithBalance(targetAmount);
        if (bestCash) {
            setAkunKredit(bestCash.code);
            setAkunKreditSearch(`${bestCash.code} - ${bestCash.name}`);
        } else {
            setAkunKredit('1.1.1.01');
            setAkunKreditSearch('1.1.1.01 - Kas Di Bendahara Desa Adat');
        }

        // Isi nominal dengan sisa hutang (editable)
        setNominal(targetAmount);
        
        // Pihak ketiga / Rekanan (editable)
        const creditor = txDetail?.creditor || debt.primaryCreditor || 'Pihak Ketiga / Rekanan';
        setDariKepada(creditor);

        // Buatkan rincian otomatis (editable)
        const rawDesc = txDetail?.uraian || debt.recentDescriptions[0] || debt.name;
        const cleanDesc = rawDesc
            .replace(/^Belanja\s+/i, '')
            .replace(/^Penerimaan\s+/i, '')
            .trim();
        const autoUraian = cleanDesc.toLowerCase().startsWith('pelunasan')
            ? cleanDesc
            : `Pelunasan Hutang ${cleanDesc}`;
        setUraian(autoUraian);
        setTanggal(new Date().toISOString().split('T')[0]);

        setShowEntryModal(true);
    };

    const handleSwapModalAccounts = () => {
        if (validationModalContext === 'new') {
            const prevDebet = akunDebet;
            const prevDebetSearch = akunDebetSearch;
            setAkunDebet(akunKredit);
            setAkunDebetSearch(akunKreditSearch);
            setAkunKredit(prevDebet);
            setAkunKreditSearch(prevDebetSearch);
        } else {
            const prevDebet = editAkunDebet;
            const prevDebetSearch = editAkunDebetSearch;
            setEditAkunDebet(editAkunKredit);
            setEditAkunDebetSearch(editAkunKreditSearch);
            setEditAkunKredit(prevDebet);
            setEditAkunKreditSearch(prevDebetSearch);
        }
    };

    const handleOpenVerification = (e: React.FormEvent) => {
        e.preventDefault();

        // Jika dalam mode bayar hutang dan akun kredit dikosongkan (opsional),
        // otomatis gunakan Kas yang bersaldo (atau default Kas Di Bendahara 1.1.1.01) agar pencatatan berpasangan tetap seimbang
        let effectiveAkunKredit = akunKredit;
        if (!effectiveAkunKredit && activePayingDebt) {
            const bestCash = getBestCashAccountWithBalance(parseNumber(nominal));
            const selectedCode = bestCash ? bestCash.code : '1.1.1.01';
            const selectedName = bestCash ? bestCash.name : 'Kas Di Bendahara Desa Adat';
            effectiveAkunKredit = `${selectedCode} - ${selectedName}`;
            setAkunKredit(selectedCode);
            setAkunKreditSearch(effectiveAkunKredit);
        }

        // Cek apakah nominal pembayaran melebihi sisa hutang
        if (activePayingDebt) {
            const cleanDebet = akunDebet.split(' - ')[0].trim();
            if (cleanDebet === activePayingDebt.code) {
                const enteredNominal = parseNumber(nominal);
                if (enteredNominal > activePayingDebt.maxAmount) {
                    setNotification({
                        message: `⚠️ Peringatan: Nominal pembayaran (Rp ${formatCurrency(enteredNominal)}) melebihi sisa hutang (Rp ${formatCurrency(activePayingDebt.maxAmount)})! Silahkan sesuaikan nominal pembayaran.`,
                        type: 'error'
                    });
                    return;
                }
            }
        }

        const isValid = validateAndNotifySingleTransaction(
            { akunDebet, akunKredit: effectiveAkunKredit, nominal, tanggal, uraian },
            (msg, type) => setNotification({ message: msg, type: type || 'error' })
        );
        if (!isValid) return;

        // Validasi Alur Pasangan Akun Debet & Kredit
        const pairAnalysis = analyzeAccountPair(akunDebet, effectiveAkunKredit);
        if (pairAnalysis.status === 'error') {
            setNotification({
                message: `❌ ${pairAnalysis.title}: ${pairAnalysis.detailedNote}`,
                type: 'error'
            });
            playErrorSound();
            setShowAccountValidationModal(true);
            setValidationModalContext('new');
            return;
        }

        if (isBebanAccount(akunDebet)) {
            setNotaItems([{ id: '1', name: uraian || 'Barang / Jasa', qty: 1, price: nominal }]);
        } else {
            setNotaItems([]);
        }

        const defaults = getDocDefaults(akunDebet, effectiveAkunKredit, dariKepada, juruRaksaName || 'Juru Raksa Desa Adat');
        const generatedId = generateSequentialJuId(tanggal, entries, bkuData, bkpData);

        const entry = {
            id: generatedId,
            tanggal,
            dariKepada: dariKepada || '-',
            originalDariKepada: dariKepada || '-',
            akunDebet,
            akunKredit: effectiveAkunKredit,
            uraian,
            nominal,
            terbilang: terbilang(nominal),
            isEdit: false,
            primaryDocType: defaults.primaryDocType,
            notaKepada: defaults.notaKepada,
            notaHormatSaya: defaults.notaHormatSaya,
            kwitansiTelahTerima: defaults.kwitansiTelahTerima,
            kwitansiPenerima: defaults.kwitansiPenerima,
        };

        setDocTab(defaults.primaryDocType);
        setTempEntry(entry);
        setShowEntryModal(false);
        setShowDocModal(true);
    };

    const handleEditClick = (idTransaksi: string) => {
        const relatedJu = entries.filter(e => e.idTransaksi === idTransaksi);
        if (relatedJu.length < 2) return;
        const debetRow = relatedJu.find(r => r.rowType === 'debet');
        const kreditRow = relatedJu.find(r => r.rowType === 'kredit');
        if (!debetRow || !kreditRow) return;

        const debetAcc = ACCOUNTS.find(a => a.code === debetRow.kodeRekening);
        const kreditAcc = ACCOUNTS.find(a => a.code === kreditRow.kodeRekening);

        setEditingEntry({
            idTransaksi,
            debetRow,
            kreditRow
        });

        setEditTanggal(debetRow.date || new Date().toISOString().split('T')[0]);

        let pihak = '-';
        let desc = debetRow.uraian || '';
        if (desc.includes(' dari ')) {
            const parts = desc.split(' dari ');
            desc = parts[0].replace(/^Penerimaan\s+/, '').trim();
            pihak = parts[1].trim();
        } else if (desc.includes(' kepada ')) {
            const parts = desc.split(' kepada ');
            desc = parts[0].replace(/^Penerimaan\s+/, '').trim();
            pihak = parts[1].trim();
        }

        setEditDariKepada(pihak);
        setEditUraian(desc);

        setEditAkunDebet(debetRow.kodeRekening);
        setEditAkunDebetSearch(debetAcc ? `${debetAcc.code} - ${debetAcc.name}` : debetRow.kodeRekening);

        setEditAkunKredit(kreditRow.kodeRekening);
        setEditAkunKreditSearch(kreditAcc ? `${kreditAcc.code} - ${kreditAcc.name}` : kreditRow.kodeRekening);

        const amount = debetRow.debet || kreditRow.kredit || 0;
        setEditNominal(amount);

        const relatedBkp = bkpData.filter(b => b.idTransaksi === idTransaksi);
        if (relatedBkp.length > 0) {
            setNotaItems(relatedBkp.map((b, idx) => {
                const match = b.uraian.match(/^(.*?)\s*\(([\d.,]+)\s*x\s*([\d.,]+)\)$/);
                if (match) {
                    return {
                        id: idx.toString(),
                        name: match[1].trim(),
                        qty: parseNumber(match[2]) || 1,
                        price: parseNumber(match[3])
                    };
                }
                return {
                    id: idx.toString(),
                    name: b.uraian,
                    qty: 1,
                    price: b.kredit || b.debet || amount
                };
            }));
        } else {
            setNotaItems([{ id: '1', name: desc, qty: 1, price: amount }]);
        }

        setShowEditModal(true);
    };

    const handleOpenEditVerification = (e: React.FormEvent) => {
        e.preventDefault();

        const isValid = validateAndNotifySingleTransaction(
            { akunDebet: editAkunDebet, akunKredit: editAkunKredit, nominal: editNominal, tanggal: editTanggal, uraian: editUraian },
            (msg, type) => setNotification({ message: msg, type: type || 'error' })
        );
        if (!isValid) return;

        // Validasi Alur Pasangan Akun Debet & Kredit
        const pairAnalysis = analyzeAccountPair(editAkunDebet, editAkunKredit);
        if (pairAnalysis.status === 'error') {
            setNotification({
                message: `❌ ${pairAnalysis.title}: ${pairAnalysis.detailedNote}`,
                type: 'error'
            });
            playErrorSound();
            setShowAccountValidationModal(true);
            setValidationModalContext('edit');
            return;
        }


        const defaults = getDocDefaults(editAkunDebet, editAkunKredit, editDariKepada, juruRaksaName || 'Juru Raksa Desa Adat');

        const entry = {
            id: editingEntry?.idTransaksi || generateSequentialJuId(editTanggal, entries, bkuData, bkpData),
            tanggal: editTanggal,
            dariKepada: editDariKepada || '-',
            originalDariKepada: editDariKepada || '-',
            akunDebet: editAkunDebet,
            akunKredit: editAkunKredit,
            uraian: editUraian,
            nominal: editNominal,
            terbilang: terbilang(editNominal),
            isEdit: true,
            primaryDocType: defaults.primaryDocType,
            notaKepada: defaults.notaKepada,
            notaHormatSaya: defaults.notaHormatSaya,
            kwitansiTelahTerima: defaults.kwitansiTelahTerima,
            kwitansiPenerima: defaults.kwitansiPenerima,
        };

        setDocTab(defaults.primaryDocType);
        setTempEntry(entry);
        setShowEditModal(false);
        setShowDocModal(true);
    };

    const handleSaveVerifiedDoc = async () => {
        if (!tempEntry) return;
        setIsLoading(true);
        try {
            const isBeban = isBebanAccount(tempEntry.akunDebet);

            // Validasi khusus rincian nota belanja (Beban) terhadap QTY dan Harga Satuan
            if (isBeban && notaItems.length > 0) {
                const zeroQtyIndex = notaItems.findIndex(item => parseNumber(item.qty) <= 0);
                if (zeroQtyIndex !== -1) {
                    setIsLoading(false);
                    playErrorSound();
                    setNotification({
                        message: `⚠️ Kolom QTY (Kuantitas) pada baris #${zeroQtyIndex + 1} masih 0 (nol)! Mohon lengkapi jumlah QTY minimal 1 pada kotak yang ditandai merah agar data transaksi dapat disimpan.`,
                        type: 'error'
                    });
                    setTimeout(() => {
                        const firstInvalidQty = document.querySelector('input[data-qty-invalid="true"]') as HTMLInputElement | null;
                        if (firstInvalidQty) {
                            firstInvalidQty.focus();
                            firstInvalidQty.select();
                        }
                    }, 100);
                    return;
                }

                const zeroPriceIndex = notaItems.findIndex(item => parseNumber(item.price) <= 0);
                if (zeroPriceIndex !== -1) {
                    setIsLoading(false);
                    playErrorSound();
                    setNotification({
                        message: `⚠️ Kolom Harga Satuan pada baris #${zeroPriceIndex + 1} masih 0! Mohon isi harga satuan barang agar data transaksi dapat disimpan.`,
                        type: 'error'
                    });
                    setTimeout(() => {
                        const firstInvalidPrice = document.querySelector('input[data-price-invalid="true"]') as HTMLInputElement | null;
                        if (firstInvalidPrice) {
                            firstInvalidPrice.focus();
                            firstInvalidPrice.select();
                        }
                    }, 100);
                    return;
                }
            }

            const totalAmount = isBeban && notaItems.length > 0 
                ? notaItems.reduce((s, i) => s + (parseNumber(i.qty) * parseNumber(i.price)), 0) 
                : tempEntry.nominal;

            if (totalAmount <= 0) {
                setIsLoading(false);
                playErrorSound();
                setNotification({
                    message: '⚠️ Total nominal transaksi tidak boleh Rp 0 (nol)! Mohon periksa kembali kuantitas dan harga satuan nota.',
                    type: 'error'
                });
                return;
            }

            const idTx = tempEntry.id || generateSequentialJuId(tempEntry.tanggal, entries, bkuData, bkpData);

            // Pihak dan uraian transaksi jurnal diambil murni dari form input/edit transaksi,
            // tidak terpengaruh oleh pengubahan nama cetak / print signature
            const sourcePihak = tempEntry.originalDariKepada || tempEntry.dariKepada;
            let fullUraian = tempEntry.uraian;
            if (sourcePihak && sourcePihak !== '-' && sourcePihak !== 'Masukkan Nama/Toko/dsb') {
                if (!fullUraian.includes(' dari ') && !fullUraian.includes(' kepada ')) {
                    const isDebetKas = isKasAccount(tempEntry.akunDebet);
                    if (isDebetKas) {
                        fullUraian = `${fullUraian} dari ${sourcePihak}`;
                    } else {
                        fullUraian = `${fullUraian} kepada ${sourcePihak}`;
                    }
                }
            }

            const juRows: JuDisplayRow[] = [
                {
                    rowId: `${idTx}-debet`,
                    idTransaksi: idTx,
                    date: tempEntry.tanggal,
                    kodeRekening: tempEntry.akunDebet,
                    uraian: fullUraian,
                    debet: totalAmount,
                    kredit: 0,
                    rowType: 'debet'
                },
                {
                    rowId: `${idTx}-kredit`,
                    idTransaksi: idTx,
                    date: tempEntry.tanggal,
                    kodeRekening: tempEntry.akunKredit,
                    uraian: fullUraian,
                    debet: 0,
                    kredit: totalAmount,
                    rowType: 'kredit'
                }
            ];

            // Validate financial entries (e.g. Debet === Kredit balance check)
            const isBalancedAndValid = validateAndNotifyFinancialEntries(
                juRows,
                (msg, type) => setNotification({ message: msg, type: type || 'error' })
            );
            if (!isBalancedAndValid) {
                setIsLoading(false);
                return;
            }

            const bkuRows: Omit<BkuData, 'id' | 'saldo'>[] = [];
            if (isKasAccount(tempEntry.akunDebet)) {
                bkuRows.push({
                    idTransaksi: idTx,
                    noBukti: idTx,
                    bukti: idTx,
                    tanggal: tempEntry.tanggal,
                    kode: tempEntry.akunDebet,
                    uraian: fullUraian,
                    kategori: getKategoriForBkuTx(tempEntry.akunDebet, tempEntry.akunKredit, true),
                    penerimaan: totalAmount,
                    pengeluaran: 0
                });
            }
            if (isKasAccount(tempEntry.akunKredit)) {
                bkuRows.push({
                    idTransaksi: idTx,
                    noBukti: idTx,
                    bukti: idTx,
                    tanggal: tempEntry.tanggal,
                    kode: tempEntry.akunKredit,
                    uraian: fullUraian,
                    kategori: getKategoriForBkuTx(tempEntry.akunDebet, tempEntry.akunKredit, false),
                    penerimaan: 0,
                    pengeluaran: totalAmount
                });
            }

            const isDebetKas = isKasAccount(tempEntry.akunDebet);
            const mainBkpKategori = getKategoriFromAccountCode(isDebetKas ? tempEntry.akunKredit : tempEntry.akunDebet);
            const bkpRows: Omit<BkpData, 'id' | 'saldo'>[] = [];
            if (isBeban && notaItems.length > 0) {
                notaItems.forEach(item => {
                    const itemQty = parseNumber(item.qty);
                    const itemPrice = parseNumber(item.price);
                    bkpRows.push({
                        idTransaksi: idTx,
                        tanggal: tempEntry.tanggal,
                        bukti: tempEntry.akunDebet,
                        uraian: `${item.name || 'Barang/Jasa'} (${itemQty} x ${itemPrice})`,
                        kategori: mainBkpKategori,
                        debet: 0,
                        kredit: itemQty * itemPrice
                    });
                });
            } else {
                bkpRows.push({
                    idTransaksi: idTx,
                    tanggal: tempEntry.tanggal,
                    bukti: tempEntry.akunDebet,
                    uraian: fullUraian,
                    kategori: mainBkpKategori,
                    debet: isKasAccount(tempEntry.akunDebet) ? totalAmount : 0,
                    kredit: isKasAccount(tempEntry.akunKredit) ? totalAmount : 0
                });
            }

            await onSaveTransaction(juRows, bkuRows, bkpRows, tempEntry.isEdit ? tempEntry.id : undefined);
            if (tempEntry.isEdit) {
                playEditSuccessSound();
            } else {
                playSaveSuccessSound();
            }
            setNotification({ 
                message: tempEntry.isEdit ? 'Jurnal berhasil diperbarui!' : 'Jurnal berhasil disimpan!', 
                type: 'success' 
            });
            setShowDocModal(false);
            setTempEntry(null);
            setEditingEntry(null);
            setActivePayingDebt(null);
        } catch (err) {
            console.error(err);
            playErrorSound();
            setNotification({ message: 'Gagal menyimpan transaksi jurnal.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const triggerWAForDoc = (entry: any) => {
        if (!entry) return;
        const text = `*DOKUMEN TRANSAKSI - ${profile.namaDesa}*\n` +
            `=============================\n` +
            `ID Dokumen: ${entry.id}\n` +
            `Tanggal: ${entry.tanggal}\n` +
            `Dari / Kepada: ${entry.dariKepada}\n` +
            `Uraian: ${entry.uraian}\n` +
            `Nominal: Rp ${(entry.nominal || 0).toLocaleString('id-ID')}\n` +
            `Debet: ${getAccName(entry.akunDebet)} (${entry.akunDebet})\n` +
            `Kredit: ${getAccName(entry.akunKredit)} (${entry.akunKredit})\n` +
            `=============================\n` +
            `Terbilang: ${entry.terbilang || terbilang(entry.nominal)}`;

        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    const handleDeleteClick = (idTransaksi: string) => {
        if (!idTransaksi) return;
        setDeletingId(idTransaksi);
    };

    const handleConfirmDelete = async () => {
        if (!deletingId) return;
        setIsLoading(true);
        try {
            await onDeleteTransaction(deletingId);
            playDeleteSuccessSound();
            setNotification({ message: 'Transaksi berhasil dihapus dari Jurnal Umum.', type: 'success' });
        } catch (err) {
            console.error(err);
            playErrorSound();
            setNotification({ message: 'Gagal menghapus transaksi.', type: 'error' });
        } finally {
            setIsLoading(false);
            setDeletingId(null);
        }
    };

    const buildReceiptData = (idTransaksi: string) => {
        const relatedJu = entries.filter(e => e.idTransaksi === idTransaksi);
        if (relatedJu.length < 2) return null;
        const debetRow = relatedJu.find(r => r.rowType === 'debet');
        const kreditRow = relatedJu.find(r => r.rowType === 'kredit');
        if (!debetRow || !kreditRow) return null;

        let pihak = '-';
        let desc = debetRow.uraian || '';
        if (desc.includes(' dari ')) {
            const parts = desc.split(' dari ');
            desc = parts[0].replace(/^Penerimaan\s+/, '').trim();
            pihak = parts[1].trim();
        } else if (desc.includes(' kepada ')) {
            const parts = desc.split(' kepada ');
            desc = parts[0].replace(/^Penerimaan\s+/, '').trim();
            pihak = parts[1].trim();
        }

        const relatedBkp = bkpData.filter(b => b.idTransaksi === idTransaksi);
        const items = relatedBkp.map((b, idx) => {
            const match = b.uraian.match(/^(.*?)\s*\(([\d.,]+)\s*x\s*([\d.,]+)\)$/);
            if (match) {
                return {
                    id: idx.toString(),
                    name: match[1].trim(),
                    qty: parseNumber(match[2]) || 1,
                    price: parseNumber(match[3])
                };
            }
            return {
                id: idx.toString(),
                name: b.uraian,
                qty: 1,
                price: b.kredit || b.debet || debetRow.debet
            };
        });

        const defaults = getDocDefaults(debetRow.kodeRekening, kreditRow.kodeRekening, pihak, juruRaksaName || 'Juru Raksa Desa Adat');

        return {
            id: idTransaksi,
            tanggal: debetRow.date || '',
            dariKepada: pihak,
            uraian: desc,
            akunDebet: debetRow.kodeRekening,
            akunKredit: kreditRow.kodeRekening,
            nominal: debetRow.debet || kreditRow.kredit || 0,
            terbilang: terbilang(debetRow.debet || kreditRow.kredit || 0),
            items,
            primaryDocType: defaults.primaryDocType,
            notaKepada: defaults.notaKepada,
            notaHormatSaya: defaults.notaHormatSaya,
            kwitansiTelahTerima: defaults.kwitansiTelahTerima,
            kwitansiPenerima: defaults.kwitansiPenerima,
        };
    };

    const handlePrintReceiptClick = (idTransaksi: string) => {
        const doc = buildReceiptData(idTransaksi);
        if (!doc) return;
        setPrintDoc(doc);
        setDocTab(doc.primaryDocType);
    };

    const handleOpenA5Preview = (idTransaksi?: string) => {
        let targetId: string | undefined = idTransaksi;
        if (!targetId) {
            if (selectedTxIds.size > 0) {
                const firstSelected = Array.from(selectedTxIds)[0];
                if (typeof firstSelected === 'string') {
                    targetId = firstSelected;
                }
            } else if (filteredTxIds.length > 0) {
                targetId = filteredTxIds[0];
            } else if (entries.length > 0) {
                targetId = entries[0].idTransaksi;
            }
        }
        if (!targetId) {
            setNotification({ message: 'Belum ada transaksi untuk dipratinjau.', type: 'error' });
            return;
        }

        const doc = buildReceiptData(targetId);
        if (!doc) {
            setNotification({ message: 'Data transaksi jurnal tidak lengkap.', type: 'error' });
            return;
        }
        setPrintDoc(doc);
        setDocTab(doc.primaryDocType);
        setShowA5PreviewModal(true);
    };

    // Nota items handlers
    const handleEditNotaItem = (id: string, field: 'name' | 'qty' | 'price', value: any) => {
        setNotaItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleDeleteNotaItem = (id: string) => {
        if (notaItems.length <= 1) return;
        setNotaItems(prev => prev.filter(item => item.id !== id));
    };

    const handleAddNotaItem = () => {
        setNotaItems(prev => [...prev, { id: Date.now().toString(), name: '', qty: 1, price: 0 }]);
    };

    // Import Excel Handlers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processImportFile(file);
        }
    };

    const processImportFile = (file: File) => {
        if (typeof XLSX === 'undefined') {
            alert('Library Excel belum dimuat.');
            return;
        }
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('jurnal')) || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows: any[] = XLSX.utils.sheet_to_json(sheet);

                const parsed = rows.map((r, idx) => {
                    const tanggal = r['Tanggal'] || r['tanggal'] || r['Date'] || '';
                    const dariKepada = r['Pihak'] || r['Dari/Kepada'] || r['dariKepada'] || r['Pihak (Dari/Kepada)'] || '-';
                    const akunDebet = String(r['Kode Akun Debet'] || r['Debet'] || r['akunDebet'] || '').trim();
                    const akunKredit = String(r['Kode Akun Kredit'] || r['Kredit'] || r['akunKredit'] || '').trim();
                    const uraian = r['Keterangan / Uraian'] || r['Uraian'] || r['uraian'] || r['Keterangan'] || '';
                    const nominal = Number(r['Nominal (Rp)'] || r['Nominal'] || r['nominal'] || 0);

                    let error = '';
                    if (!tanggal) error = 'Tanggal kosong';
                    else if (!akunDebet) error = 'Kode Akun Debet kosong';
                    else if (!akunKredit) error = 'Kode Akun Kredit kosong';
                    else if (!nominal || nominal <= 0) error = 'Nominal tidak valid';

                    return {
                        index: idx + 1,
                        tanggal,
                        dariKepada,
                        akunDebet,
                        akunKredit,
                        uraian,
                        nominal,
                        error
                    };
                });

                setParsedImportRows(parsed);
            } catch (err) {
                console.error(err);
                alert('Gagal membaca file Excel.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExecuteImport = async () => {
        const validRows = parsedImportRows.filter(r => !r.error);
        if (validRows.length === 0) return;

        setIsImporting(true);
        setImportProgress(0);

        try {
            const simulatedEntries = [...entries];
            for (let i = 0; i < validRows.length; i++) {
                const row = validRows[i];
                const idTx = generateSequentialJuId(row.tanggal, simulatedEntries, bkuData, bkpData);
                simulatedEntries.push({ idTransaksi: idTx, date: row.tanggal } as any);

                let fullUraian = row.uraian;
                if (row.dariKepada && row.dariKepada !== '-') {
                    if (!fullUraian.includes(' dari ') && !fullUraian.includes(' kepada ')) {
                        if (isKasAccount(row.akunDebet)) {
                            fullUraian = `${fullUraian} dari ${row.dariKepada}`;
                        } else {
                            fullUraian = `${fullUraian} kepada ${row.dariKepada}`;
                        }
                    }
                }

                const juRows: JuDisplayRow[] = [
                    {
                        rowId: `${idTx}-debet`,
                        idTransaksi: idTx,
                        date: row.tanggal,
                        kodeRekening: row.akunDebet,
                        uraian: fullUraian,
                        debet: row.nominal,
                        kredit: 0,
                        rowType: 'debet'
                    },
                    {
                        rowId: `${idTx}-kredit`,
                        idTransaksi: idTx,
                        date: row.tanggal,
                        kodeRekening: row.akunKredit,
                        uraian: fullUraian,
                        debet: 0,
                        kredit: row.nominal,
                        rowType: 'kredit'
                    }
                ];

                const bkuRows: Omit<BkuData, 'id' | 'saldo'>[] = [];
                if (isKasAccount(row.akunDebet)) {
                    bkuRows.push({
                        idTransaksi: idTx,
                        noBukti: idTx,
                        bukti: idTx,
                        tanggal: row.tanggal,
                        kode: row.akunDebet,
                        uraian: fullUraian,
                        kategori: getKategoriForBkuTx(row.akunDebet, row.akunKredit, true),
                        penerimaan: row.nominal,
                        pengeluaran: 0
                    });
                }
                if (isKasAccount(row.akunKredit)) {
                    bkuRows.push({
                        idTransaksi: idTx,
                        noBukti: idTx,
                        bukti: idTx,
                        tanggal: row.tanggal,
                        kode: row.akunKredit,
                        uraian: fullUraian,
                        kategori: getKategoriForBkuTx(row.akunDebet, row.akunKredit, false),
                        penerimaan: 0,
                        pengeluaran: row.nominal
                    });
                }

                const mainBkpKategori = getKategoriFromAccountCode(isKasAccount(row.akunDebet) ? row.akunKredit : row.akunDebet);
                const bkpRows: Omit<BkpData, 'id' | 'saldo'>[] = [
                    {
                        idTransaksi: idTx,
                        tanggal: row.tanggal,
                        bukti: row.akunDebet,
                        uraian: fullUraian,
                        kategori: mainBkpKategori,
                        debet: isKasAccount(row.akunDebet) ? row.nominal : 0,
                        kredit: isKasAccount(row.akunKredit) ? row.nominal : 0
                    }
                ];

                await onSaveTransaction(juRows, bkuRows, bkpRows);
                setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
            }

            setNotification({ message: `Berhasil mengimpor ${validRows.length} transaksi!`, type: 'success' });
            playSyncSuccessSound();
            setShowImportModal(false);
            setImportFile(null);
            setParsedImportRows([]);
        } catch (err) {
            console.error(err);
            playErrorSound();
            setNotification({ message: 'Gagal mengimpor data.', type: 'error' });
        } finally {
            setIsImporting(false);
            setImportProgress(0);
        }
    };

    const handleOpenImport = () => {
        setImportFile(null);
        setParsedImportRows([]);
        setShowImportModal(true);
    };

    const handleOpenSettings = () => {
        setTempKeliangName(keliangName);
        setTempJuruRaksaName(juruRaksaName);
        setTempPenerimaName(penerimaName);
        setTempCustomPlace(customPlace);
        setTempSignatureDate(signatureDate);
        setIsSettingsOpen(true);
    };

    const handleVerifyPassword = () => {
        if (!passwordInput.trim()) {
            setNotification({ message: 'Masukkan password admin!', type: 'error' });
            return;
        }
        setKeliangName(tempKeliangName);
        setJuruRaksaName(tempJuruRaksaName);
        setPenerimaName(tempPenerimaName);
        setCustomPlace(tempCustomPlace);
        setSignatureDate(tempSignatureDate);

        localStorage.setItem('ju_keliangName', tempKeliangName);
        localStorage.setItem('ju_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('ju_penerimaName', tempPenerimaName);
        localStorage.setItem('ju_customPlace', tempCustomPlace);
        localStorage.setItem('ju_signatureDate', tempSignatureDate);

        setIsPasswordModalOpen(false);
        setIsSettingsOpen(false);
        setPasswordInput('');
        setNotification({ message: 'Pengaturan tanda tangan berhasil disimpan.', type: 'success' });
    };

    const resetFilters = () => {
        setSearchTerm('');
        setFilterStartDate('');
        setFilterEndDate('');
        setSelectedMonth('');
        setSelectedYear('');
        setFilterAccount('');
        setCurrentPage(1);
    };

    const handleExportExcel = () => {
        if (typeof XLSX === 'undefined') {
            setNotification({ message: 'Library Excel belum dimuat.', type: 'error' });
            return;
        }
        try {
            const exportData = filteredEntries.map(e => ({
                'Tanggal': e.date,
                'ID Transaksi': e.idTransaksi,
                'Uraian': e.uraian,
                'Kode Rekening': e.kodeRekening,
                'Nama Akun': getAccName(e.kodeRekening || ''),
                'Debet': e.debet,
                'Kredit': e.kredit,
                'Program': e.program || '-'
            }));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, "Jurnal Ringkasan");
            XLSX.writeFile(wb, `Export_Jurnal_Umum_${new Date().toISOString().split('T')[0]}.xlsx`);
            setNotification({ message: 'Data Jurnal berhasil diekspor.', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Gagal mengekspor data.', type: 'error' });
        }
    };

    const handlePrintDocument = () => { handlePrintFullJurnal(); };

    const handleDownloadPdf = async () => {
        setIsMenuOpen(false);
        setIsExportingPdf(true);
        try {
            const periodStr = filterStartDate && filterEndDate ? `${filterStartDate}_sd_${filterEndDate}` : 'Lengkap';
            const filename = `Jurnal_Umum_Usabe_Dalem_${periodStr}.pdf`;
            const success = await exportElementToPdf('printable-ju-full', {
                filename,
                orientation: 'landscape',
                format: 'a4',
                margin: [8, 8, 8, 8],
                enableWatermark: true,
                watermarkText: 'DESA ADAT BASANGALAS'
            });
            if (success !== false) {
                setNotification({ message: `Dokumen "${filename}" berhasil diunduh sebagai PDF!`, type: 'success' });
            }
        } catch (err) {
            console.error('Error downloading PDF:', err);
            setNotification({ message: 'Gagal mengunduh dokumen PDF.', type: 'error' });
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="bg-white p-4 space-y-6" id="printable-area">
             <style>{`
                @media print {
                    body * { visibility: hidden; }
                    
                    ${printTarget === 'full' ? `
                    #printable-ju-full, #printable-ju-full * { visibility: visible !important; }
                    #printable-ju-full { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        display: block !important; 
                        background: #ffffff !important; 
                        color: #000000 !important; 
                        padding: 10mm 12mm !important; 
                        margin: 0 !important;
                        box-sizing: border-box !important;
                    }
                    #printable-nota { display: none !important; }
                    #printable-kwitansi { display: none !important; }
                    ` : ''}

                    ${printTarget === 'nota' ? `
                    @page {
                        size: A5 portrait;
                        margin: 4mm 5mm;
                    }
                    #printable-nota, #printable-nota * { visibility: visible !important; }
                    #printable-nota { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        max-width: 100% !important;
                        display: block !important; 
                        background: #ffffff !important; 
                        color: #000000 !important; 
                        padding: 3mm 5mm !important; 
                        margin: 0 !important;
                        box-sizing: border-box !important;
                        font-size: 8pt !important;
                        line-height: 1.25 !important;
                    }
                    #printable-nota .nota-header-title {
                        font-size: 11pt !important;
                        line-height: 1.15 !important;
                        margin: 0 0 1px 0 !important;
                    }
                    #printable-nota .nota-header-address {
                        font-size: 7.5pt !important;
                        line-height: 1.2 !important;
                        margin: 0 0 2px 0 !important;
                    }
                    #printable-nota .nota-doc-badge {
                        font-size: 8.5pt !important;
                        line-height: 1.15 !important;
                        margin-top: 2px !important;
                        margin-bottom: 2px !important;
                        padding: 1px 8px !important;
                        letter-spacing: 0.05em !important;
                    }
                    #printable-nota .nota-meta-grid,
                    #printable-nota .nota-meta-grid p,
                    #printable-nota .nota-meta-grid strong {
                        font-size: 8pt !important;
                        line-height: 1.25 !important;
                    }
                    #printable-nota .nota-uraian-box {
                        font-size: 8pt !important;
                        line-height: 1.25 !important;
                        padding: 2px 5px !important;
                        margin-bottom: 3px !important;
                    }
                    #printable-nota table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 7.5pt !important;
                        line-height: 1.2 !important;
                        margin-bottom: 3px !important;
                    }
                    #printable-nota th, #printable-nota td {
                        border: 1px solid #000000 !important;
                        padding: 2px 4px !important;
                        font-size: 7.5pt !important;
                    }
                    #printable-nota .nota-total-box {
                        padding: 2px 5px !important;
                        margin-bottom: 3px !important;
                        font-size: 8pt !important;
                    }
                    #printable-nota .nota-total-nominal {
                        font-size: 9.5pt !important;
                        font-weight: bold !important;
                    }
                    #printable-nota .nota-terbilang-text {
                        font-size: 7.5pt !important;
                        line-height: 1.2 !important;
                        margin-bottom: 4px !important;
                    }
                    #printable-nota .nota-signature-container {
                        margin-top: 4px !important;
                        padding-top: 3px !important;
                        font-size: 8pt !important;
                    }
                    #printable-nota .nota-signature-space {
                        height: 32px !important;
                    }
                    #printable-ju-full { display: none !important; }
                    #printable-kwitansi { display: none !important; }
                    ` : ''}

                    ${printTarget === 'kwitansi' ? `
                    @page {
                        size: A5 landscape;
                        margin: 4mm 6mm;
                    }
                    #printable-kwitansi, #printable-kwitansi * { visibility: visible !important; }
                    #printable-kwitansi { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        max-width: 100% !important; 
                        display: block !important; 
                        background: #ffffff !important; 
                        color: #000000 !important; 
                        padding: 3mm 6mm !important; 
                        margin: 0 !important; 
                        box-sizing: border-box !important;
                        font-size: 8.5pt !important;
                        line-height: 1.3 !important;
                        page-break-inside: avoid !important;
                    }
                    #printable-kwitansi .kwitansi-border {
                        border: 2px double #000000 !important;
                        padding: 3mm 5mm !important;
                        page-break-inside: avoid !important;
                    }
                    #printable-kwitansi table {
                        font-size: 8pt !important;
                        line-height: 1.3 !important;
                    }
                    #printable-kwitansi th, #printable-kwitansi td {
                        padding: 2.5px 5px !important;
                    }
                    #printable-kwitansi .kwitansi-signature-space {
                        height: 32px !important;
                    }
                    #printable-ju-full { display: none !important; }
                    #printable-nota { display: none !important; }
                    ` : ''}

                    .no-print { display: none !important; }
                    table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt; page-break-inside: auto; }
                    th, td { border: 1px solid black !important; padding: 4px 6px !important; color: black !important; background: white !important; }
                    thead th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; color: black !important; font-weight: bold; }
                    .signature-section { display: flex !important; page-break-inside: avoid; margin-top: 30px; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
                .font-times { font-family: 'Times New Roman', Times, serif; }
            `}</style>

            {isLoading && <Spinner />}
            {notification && <div className="fixed top-20 right-4 z-50 w-80 no-print"><Notification {...notification} onClose={() => setNotification(null)} /></div>}

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />

            {/* FULL PRINT TABLE - INVISIBLE ON WEB SCREEN */}
            <div className="hidden print:block bg-white text-slate-900 p-0" id="printable-ju-full">
                {/* Formal Kop Surat Header */}
                <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                        DESA ADAT BASANGALAS
                    </h2>
                    <p className="text-sm font-bold text-slate-800 font-serif my-0.5 italic">
                        Laporan Kas Desa Adat
                    </p>
                    <p className="text-xs font-normal text-slate-700 font-serif m-0">
                        Jln. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                    </p>
                </div>

                <div className="text-center mb-6">
                    <h3 className="text-base font-black uppercase tracking-widest text-slate-700 font-serif">
                        BUKU JURNAL UMUM (BJU)
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                        Periode Laporan: {filterStartDate ? formatDate(filterStartDate) : 'Awal'} s.d {filterEndDate ? formatDate(filterEndDate) : 'Sekarang'}
                    </p>
                </div>

                <table className="w-full border-collapse border border-slate-500 text-slate-900 text-xs">
                    <thead>
                        <tr className="bg-slate-100 border-b-2 border-slate-900 font-bold text-slate-900">
                            <th className="border border-slate-500 p-2.5 text-center font-bold text-xs uppercase tracking-wider text-slate-900">Tanggal</th>
                            <th className="border border-slate-500 p-2.5 text-left font-bold text-xs uppercase tracking-wider text-slate-900">Keterangan Jurnal</th>
                            <th className="border border-slate-500 p-2.5 text-left font-bold text-xs uppercase tracking-wider text-slate-900">Akun Rekening</th>
                            <th className="border border-slate-500 p-2.5 text-right font-bold text-xs uppercase tracking-wider text-slate-900">Debet (Rp)</th>
                            <th className="border border-slate-500 p-2.5 text-right font-bold text-xs uppercase tracking-wider text-slate-900">Kredit (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEntries.map((e, idx) => (
                            <tr key={idx} className={e.rowType === 'kredit' ? 'bg-slate-50/80' : 'bg-white'}>
                                <td className="border border-slate-500 p-2 text-center whitespace-nowrap font-mono text-xs font-semibold text-slate-900">{e.rowType === 'debet' ? formatDate(e.date || '') : ''}</td>
                                <td className={`border border-slate-500 p-2 text-xs text-slate-900 ${e.rowType === 'kredit' ? 'italic pl-4 text-slate-800' : 'font-bold'}`}>{e.rowType === 'debet' ? e.uraian : ''}</td>
                                <td className={`border border-slate-500 p-2 text-xs text-slate-900 ${e.rowType === 'kredit' ? 'pl-8 italic text-slate-800' : 'font-mono font-semibold'}`}>{e.kodeRekening} - {getAccName(e.kodeRekening || '')}</td>
                                <td className="border border-slate-500 p-2 text-right text-xs font-mono font-bold text-slate-900">{e.debet > 0 ? formatCurrency(e.debet) : '-'}</td>
                                <td className="border border-slate-500 p-2 text-right text-xs font-mono font-bold text-slate-900">{e.kredit > 0 ? formatCurrency(e.kredit) : '-'}</td>
                            </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900">
                            <td colSpan={3} className="border border-slate-500 p-2.5 text-right uppercase font-bold text-xs text-slate-900">TOTAL SALDO JURNAL</td>
                            <td className="border border-slate-500 p-2.5 text-right text-xs font-mono font-black text-slate-900">{formatCurrency(summary.totalDebet)}</td>
                            <td className="border border-slate-500 p-2.5 text-right text-xs font-mono font-black text-slate-900">{formatCurrency(summary.totalKredit)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="signature-section flex justify-between mt-12 px-10 text-slate-900 text-xs font-serif italic">
                    <div className="text-center w-1/3">
                        <p className="text-slate-900">Mengetahui,</p>
                        <p className="font-bold text-slate-900">Keliang Adat Basangalas</p>
                        <div className="h-16"></div>
                        <p className="font-bold border-b border-slate-900 uppercase text-slate-900">{keliangName}</p>
                    </div>
                    <div className="text-center w-1/3">
                        <p className="text-slate-900">{customPlace}, {formatDate(signatureDate)}</p>
                        <p className="font-bold text-slate-900">Juru Raksa</p>
                        <div className="h-16"></div>
                        <p className="font-bold border-b border-slate-900 uppercase text-slate-900">{juruRaksaName}</p>
                    </div>
                </div>

                {/* Print Footer Layout */}
                <div className="print-formal-footer flex justify-between items-center mt-8 text-slate-900 border-t border-slate-400 pt-2">
                    <div>
                        <p className="font-semibold print:text-slate-400 print:text-[12px]">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                        <p className="text-[10px] text-slate-500 print:text-slate-400 print:text-[10px]">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                    </div>
                    <div className="text-right font-mono text-[8px] text-slate-500 print:text-slate-300">
                        <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>

            {/* PRINTABLE NOTA CONTAINER */}
            <div className="hidden print:block font-serif text-black p-2.5 max-w-full mx-auto" id="printable-nota">
                <div className="text-center border-b border-black pb-1.5 mb-2">
                    <h3 className="nota-header-title text-sm font-bold uppercase tracking-wider">{profile.namaDesa}</h3>
                    <p className="nota-header-address text-[9px] text-gray-700">{profile.alamat}</p>
                    <h4 className="nota-doc-badge text-xs font-bold uppercase mt-1 tracking-wider border-b border-black py-0.5 inline-block px-4">
                        NOTA BELANJA / TRANSAKSI
                    </h4>
                </div>

                <div className="nota-meta-grid grid grid-cols-2 text-[9.5px] mb-2 gap-1.5 border-b border-black pb-1.5 leading-snug">
                    <div>
                        <p><strong>No. Nota / ID:</strong> {activePrintData?.id || '-'}</p>
                        <p><strong>Tanggal:</strong> {activePrintData ? formatDate(activePrintData.tanggal) : '-'}</p>
                        <p><strong>Kepada :</strong> {activePrintData?.notaKepada || 'Desa Adat Basangalas'}</p>
                    </div>
                    <div className="text-right">
                        <p><strong>Akun Debet:</strong> {activePrintData?.akunDebet || '-'} ({getAccName(activePrintData?.akunDebet || '')})</p>
                        <p><strong>Akun Kredit:</strong> {activePrintData?.akunKredit || '-'} ({getAccName(activePrintData?.akunKredit || '')})</p>
                    </div>
                </div>

                <div className="mb-2">
                    <p className="text-[9.5px] font-bold mb-0.5">Uraian / Keterangan Transaksi:</p>
                    <p className="nota-uraian-box text-[9.5px] italic bg-gray-50 p-1.5 border border-black leading-snug">{activePrintData?.uraian || '-'}</p>
                </div>

                {activePrintData?.items && activePrintData.items.length > 0 && (
                    <div className="mb-2">
                        <p className="text-[9.5px] font-bold mb-0.5">Rincian Barang / Jasa:</p>
                        <table className="w-full text-[9px] border-collapse border border-black">
                            <thead>
                                <tr className="bg-gray-100 border-b border-black font-bold">
                                    <th className="border border-black py-0.5 px-1 text-center w-6">No</th>
                                    <th className="border border-black py-0.5 px-1.5 text-left">Nama Barang / Jasa</th>
                                    <th className="border border-black py-0.5 px-1 text-center w-10">Qty</th>
                                    <th className="border border-black py-0.5 px-1.5 text-right w-20">Harga Satuan</th>
                                    <th className="border border-black py-0.5 px-1.5 text-right w-24">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activePrintData.items.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="border border-black py-0.5 px-1 text-center">{idx + 1}</td>
                                        <td className="border border-black py-0.5 px-1.5">{item.name || item.itemName || 'Barang/Jasa'}</td>
                                        <td className="border border-black py-0.5 px-1 text-center">{item.qty}</td>
                                        <td className="border border-black py-0.5 px-1.5 text-right">Rp {(parseNumber(item.price)).toLocaleString('id-ID')}</td>
                                        <td className="border border-black py-0.5 px-1.5 text-right font-bold">Rp {(parseNumber(item.qty) * parseNumber(item.price)).toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="nota-total-box border border-black py-1 px-2 mb-2 flex justify-between items-center text-[10px] font-bold">
                    <span>TOTAL TRANSAKSI:</span>
                    <span className="nota-total-nominal text-xs font-mono font-bold">Rp {(activePrintData?.nominal || 0).toLocaleString('id-ID')}</span>
                </div>

                <div className="nota-terbilang-text mb-2 text-[9px] italic leading-snug">
                    <strong>Terbilang:</strong> "{activePrintData?.terbilang || (activePrintData ? terbilang(activePrintData.nominal) : '')}"
                </div>

                <div className="nota-signature-container flex justify-between items-end text-center text-[9.5px] mt-2 pt-2 border-t border-dashed border-black">
                    <div className="h-16 border border-slate-300 rounded-lg p-2 text-left text-[8px] text-gray-600 italic wrap items-center">
                      <p>Dokumen sah yang dikeluarkan oleh Juru Raksa Desa Adat.</p>
                      <p>Dokumen Pengganti Nota yang sama dengan Aslinya</p>
                      <p>Sesuai PSAP No. 7 Tahun 2021 tentang Akuntansi Pemerintahan Desa Adat.</p>
                    </div>
                    <div className="min-w-[150px]">
                        <p className="font-bold">Hormat Saya / Rekanan,</p>
                        <div className="nota-signature-space h-8"></div>
                        <p className="font-bold underline uppercase">
                            {displayRekanan(activePrintData?.notaHormatSaya)}
                        </p>
                    </div>
                </div>
            </div>

            {/* PRINTABLE KWITANSI CONTAINER (A5 LANDSCAPE) */}
            <div className="hidden print:block font-serif text-black p-2 max-w-full mx-auto" id="printable-kwitansi">
                <div className="kwitansi-border border-2 border-double border-black p-3.5">
                    <div className="flex justify-between items-start border-b border-black pb-1.5 mb-2">
                        <div>
                            <h3 className="text-base font-bold uppercase tracking-wider">{profile.namaDesa}</h3>
                            <p className="text-[9.5px] text-gray-700">{profile.alamat}</p>
                        </div>
                        <div className="text-right">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-black border border-black px-2.5 py-0.5 inline-block">
                                KWITANSI
                            </h4>
                            <p className="text-[10px] font-mono font-bold mt-0.5">No: {activePrintData?.id || '-'}</p>
                        </div>
                    </div>

                    <table className="w-full text-[10px] space-y-1 mb-2">
                        <tbody>
                            <tr>
                                <td className="w-36 font-bold py-0.5">Telah Terima Dari</td>
                                <td className="w-3 text-center">:</td>
                                <td className="py-0.5 font-semibold border-b border-dotted border-black">
                                    {activePrintData?.kwitansiTelahTerima || 'Juru Raksa Desa Adat'}
                                </td>
                            </tr>
                            <tr>
                                <td className="font-bold py-0.5">Uraian / Untuk</td>
                                <td className="text-center">:</td>
                                <td className="py-0.5 border-b border-dotted border-black">{activePrintData?.uraian || '-'}</td>
                            </tr>
                            <tr>
                                <td className="font-bold py-0.5">Terbilang</td>
                                <td className="text-center">:</td>
                                <td className="py-0.5 italic font-semibold border-b border-dotted border-black">
                                    "{activePrintData?.terbilang || (activePrintData ? terbilang(activePrintData.nominal) : '')}"
                                </td>
                            </tr>
                            <tr>
                                <td className="font-bold py-0.5">Pos Rekening</td>
                                <td className="text-center">:</td>
                                <td className="py-0.5 border-b border-dotted border-black">
                                    Debet: {activePrintData?.akunDebet || '-'} ({getAccName(activePrintData?.akunDebet || '')}) | Kredit: {activePrintData?.akunKredit || '-'} ({getAccName(activePrintData?.akunKredit || '')})
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="my-2 flex justify-between items-center bg-gray-50 p-2 border border-black">
                        <span className="font-bold text-[10px] uppercase tracking-wider">Jumlah Pembayaran:</span>
                        <span className="font-black text-sm font-mono">
                            Rp {(activePrintData?.nominal || 0).toLocaleString('id-ID')}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 text-center text-[10px] mt-2.5">
                        <div>
                            <p>Mengetahui,</p>
                            <p className="font-bold">Keliang Adat</p>
                            <div className="kwitansi-signature-space h-8"></div>
                            <p className="font-bold underline uppercase">{keliangName}</p>
                        </div>
                        <div>
                            <p></p>
                            <p className="font-bold"></p>
                            <div className="kwitansi-signature-space h-8"></div>
                            <p className="font-bold underline uppercase"></p>
                        </div>
                        <div>
                            <p>{customPlace}, {formatDate(activePrintData?.tanggal || signatureDate)}</p>
                            <p className="font-bold">Penerima</p>
                            <div className="kwitansi-signature-space h-8"></div>
                            <p className="font-bold underline uppercase">
                                {displayPenerima(activePrintData?.kwitansiPenerima)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

{/* HEADER DAN HALAMAN VIEW */}

            {/* MAIN HEADER AND ACTION BUTTONS */}
            <div className="bg-white text-gray-900 border-b-4 border-emerald-500 p-4 no-print my-6 relative print:border-none print:shadow-none print:bg-white print:rounded-none print:p-0 print:m-0">
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
                    <div className="absolute -right-0 -bottom-0 opacity-20 text-emerald-400 pointer-events-none">
                        <Droplets size={100} />
                    </div>
                </div>

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-teal-100 text-teal-600 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-teal-300">
                        Standar Nasional Permendagri No. 20/2018
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-700/60 shadow-lg shrink-0 mt-0.5">
                            <Droplets className="text-emerald-500 w-6 h-6" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight font-serif">
                                    Jurnal Umum &amp; Akuntansi
                                </h2>
                            </div>
                            <p className="text-sm italic font-serif text-emerald-800">
                              Catatan kronologis dan sistematis atas seluruh transaksi keuangan.
                              Desa Adat Basangalas.</p>
                        </div>
                    </div>
                </div>

                {/* HEADER MENU DROPDOWN */}
                <div className="relative" ref={menuRef}>
                    <button 
                        type="button"
                        onClick={() => setIsMenuOpen(prev => !prev)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 border cursor-pointer ${
                            isMenuOpen 
                                ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-400/50' 
                                : 'bg-transparent hover:bg-slate-800 text-gray-950 hover:text-white border-2 border-slate-700 hover:border-slate-600'
                        }`}
                        title="Menu Opsi Jurnal Umum"
                        aria-expanded={isMenuOpen}
                    >
                        <Menu size={16} className="text-emerald-400 shrink-0" />
                        <span className="tracking-wide">Menu</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 text-slate-300 shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* MENU DROPDOWN LIST */}
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800">
                            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Menu &amp; Tindakan Jurnal</p>
                                <p className="text-xs font-semibold text-slate-700">Pilih aksi atau ekspor dokumen</p>
                            </div>

                            <div className="p-1.5 space-y-1">
                                {/* Pratinjau Cetak A5 */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        handleOpenA5Preview();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-emerald-50 text-slate-800 transition-colors group cursor-pointer"
                                >
                                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform shrink-0">
                                        <Eye size={16} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-900">Pratinjau Cetak</span>
                                        <span className="text-[10px] text-slate-500 truncate">Lihat layout A5 dokumen sebelum cetak fisik</span>
                                    </div>
                                </button>
                                {/* 1. Cetak */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        handlePrintDocument();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-teal-50 text-slate-800 transition-colors group cursor-pointer"
                                >
                                    <div className="p-2 rounded-lg bg-teal-100 text-teal-700 group-hover:scale-105 transition-transform shrink-0">
                                        <Printer size={16} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-900">Cetak Jurnal</span>
                                        <span className="text-[10px] text-slate-500 truncate">Cetak dokumen atau simpan ke printer</span>
                                    </div>
                                </button>
                                {/* 2. Unduh PDF */}
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    disabled={isExportingPdf}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-rose-50 text-slate-800 transition-colors group cursor-pointer disabled:opacity-50"
                                >
                                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:scale-105 transition-transform shrink-0">
                                        {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-900">
                                            {isExportingPdf ? 'Mengekspor PDF...' : 'Unduh PDF'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 truncate">Download dokumen resmi PDF</span>
                                    </div>
                                </button>
                                {/* 3. Export Excel */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        handleExportExcel();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-blue-50 text-slate-800 transition-colors group cursor-pointer"
                                >
                                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform shrink-0">
                                        <Download size={16} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-900">Export Excel</span>
                                        <span className="text-[10px] text-slate-500 truncate">Unduh file spreadsheet (.xlsx)</span>
                                    </div>
                                </button>

                                {/* 4. Import Excel */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        handleOpenImport();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-emerald-50 text-slate-800 transition-colors group cursor-pointer"
                                >
                                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform shrink-0">
                                        <Upload size={16} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-900">Import Excel</span>
                                        <span className="text-[10px] text-slate-500 truncate">Unggah transaksi jurnal dari Excel</span>
                                    </div>
                                </button>
                                {/* 5. Tandatangan */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        handleOpenSettings();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-amber-50 text-slate-800 transition-colors group cursor-pointer"
                                >
                                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform shrink-0">
                                        <Settings size={16} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-900">Tandatangan</span>
                                        <span className="text-[10px] text-slate-500 truncate">Atur pejabat tanda tangan &amp; tanggal</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
              </div>
            </div>
          </div>

            {/* DEFINISI */}
            <p className="text-teal-700 text-xs mt-0.5 mb-4 w-full leading-relaxed font-semibold no-print">
                <span className="text-emerald-950 font-bold"><strong>Definisi Akuntansi : </strong></span> 
                Buku pencatatan kronologis pertama untuk seluruh transaksi keuangan desa adat (penerimaan kas, belanja operasional/program, dan mutasi modal) menggunakan sistem pembukuan berpasangan (<span className="italic">double-entry</span>) Debet dan Kredit yang seimbang, sebagai sumber utama posting otomatis ke Buku Kas Umum (BKU), Buku Pembantu (BKP), dan Buku Besar.
            </p>

            {/* TOGGLE SEMBUNYIKAN / TAMPILKAN FILTER CEPAT (Default Disembunyikan) */}
            <div className="flex items-center justify-between gap-3 no-print flex-nowrap">
                <button
                    type="button"
                    onClick={() => setShowQuickFilter(prev => !prev)}
                    className={`w-full max-w-[180px] flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                        showQuickFilter 
                            ? 'bg-teal-700 text-white border-teal-800 hover:bg-teal-800' 
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-teal-500'
                    }`}
                    title={showQuickFilter ? 'Sembunyikan bilah filter cepat' : 'Buka bilah filter cepat'}
                >
                    <Filter size={14} className={showQuickFilter ? 'text-teal-200' : 'text-teal-600'} />
                    <span>{showQuickFilter ? 'Sembunyikan Filter' : 'Tampilkan Filter'}</span>
                    {(filterStartDate || filterEndDate || searchTerm.trim() || filterAccount.trim() || selectedMonth || selectedYear) && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                            showQuickFilter ? 'bg-teal-900 text-teal-200' : 'bg-teal-100 text-teal-800 border border-teal-300'
                        }`}>
                            Filter Aktif
                        </span>
                    )}
                    <ChevronDown size={14} className={`transform transition-transform duration-200 ${showQuickFilter ? 'rotate-180' : ''}`} />
                </button>

                {(filterStartDate || filterEndDate || searchTerm.trim() || filterAccount.trim() || selectedMonth || selectedYear) && !showQuickFilter && (
                    <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl text-xs">
                        <span className="text-teal-800 font-medium">
                            <strong>Filter Aktif:</strong> {[
                                (filterStartDate || filterEndDate) && `Periode: ${activePeriodLabel}`,
                                selectedMonth && `Bulan: ${MONTHS_LIST.find(m => m.value === selectedMonth)?.label || selectedMonth}`,
                                selectedYear && `Tahun: ${selectedYear}`,
                                searchTerm.trim() && `Pencarian: "${searchTerm}"`,
                                filterAccount.trim() && `Akun: ${(() => {
                                    const code = filterAccount.split(' - ')[0].trim();
                                    const name = getAccName(code);
                                    return name && name !== code ? `${code} - ${name}` : filterAccount;
                                })()}`
                            ].filter(Boolean).join(' • ')}
                        </span>
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 ml-1 cursor-pointer"
                            title="Reset Semua Filter"
                        >
                            <RotateCcw size={12} /> Reset
                        </button>
                    </div>
                )}

                {/* Dropdown Bulan & Tahun */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Bulan:</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => handleMonthYearChange(e.target.value, selectedYear)}
                            className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer py-1"
                        >
                            <option value="">Semua Bulan</option>
                            {MONTHS_LIST.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Tahun:</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => handleMonthYearChange(selectedMonth, e.target.value)}
                            className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer py-1"
                        >
                            <option value="">Semua Tahun</option>
                            {availableYears.map((yr) => (
                                <option key={yr} value={yr}>
                                    {yr}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Filter Akun */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Akun:</span>
                        <select
                            value={filterAccount}
                            onChange={(e) => {
                                setFilterAccount(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full text-slate-800 shadow-inner font-semibold cursor-pointer"
                        >
                            <option value="">Semua Akun / Rekening</option>
                            {uniqueJuAccounts.map((acc) => (
                                <option key={acc.value} value={acc.value}>
                                    {acc.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* FILTER & PERIODE TOOLBAR (DITAMPILKAN JIKA TOGGLE DIAKTIFKAN) */}
            {showQuickFilter && (
            <div className="bg-slate-50 border border-slate-300/90 rounded-2xl p-4 shadow-sm space-y-3.5 no-print animate-fade-in">
                {/* BARIS 1: FILTER PERIODE WAKTU & RENTANG TANGGAL */}
                <div className="w-full pb-3 border-b border-slate-200">
                    {/* Presets Cepat */}
                    <div className="w-full flex items-center justify-between gap-2 flex-nowrap overflow-x-auto py-0.5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 whitespace-nowrap mr-1">
                            <Clock size={12} className="text-teal-600" /> Filter Cepat:
                        </span>
                        <div className="flex-1 flex items-center justify-between gap-2 flex-nowrap min-w-0">
                            <button
                                type="button"
                                onClick={() => handleSetPeriodPreset('all')}
                                className={`flex-1 text-center whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    !filterStartDate && !filterEndDate
                                        ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-500/30'
                                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                }`}
                            >
                                Semua
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetPeriodPreset('this_month')}
                                className={`flex-1 text-center whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filterStartDate && filterEndDate && selectedMonth === String(new Date().getMonth() + 1).padStart(2, '0') && selectedYear === String(new Date().getFullYear())
                                        ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-500/30'
                                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                }`}
                            >
                                Bulan Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetPeriodPreset('last_month')}
                                className={`flex-1 text-center whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filterStartDate && filterEndDate && selectedMonth === String(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getMonth() + 1).padStart(2, '0') && selectedYear === String(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getFullYear())
                                        ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-500/30'
                                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                }`}
                            >
                                Bulan Lalu
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetPeriodPreset('this_year')}
                                className={`flex-1 text-center whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filterStartDate === `${new Date().getFullYear()}-01-01` && filterEndDate === `${new Date().getFullYear()}-12-31`
                                        ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-500/30'
                                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                }`}
                            >
                                Tahun Ini ({new Date().getFullYear()})
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetPeriodPreset('last_year')}
                                className={`flex-1 text-center whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    filterStartDate === `${new Date().getFullYear() - 1}-01-01` && filterEndDate === `${new Date().getFullYear() - 1}-12-31`
                                        ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-500/30'
                                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                                }`}
                            >
                                Tahun Lalu ({new Date().getFullYear() - 1})
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* BARIS 2: RENTANG TANGGAL KUSTOM, SEARCH, AKUN & ACTION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 justify-between items-end">
                    {/* Dari Tanggal */}
                    <div className="space-y-1 lg:col-span-3">
                        <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1 ml-1">
                            <Calendar size={12} className="text-teal-600" /> Dari Tanggal
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={filterStartDate}
                                onChange={(e) => handleCustomStartDateChange(e.target.value)}
                                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full text-slate-800 shadow-inner font-mono font-semibold"
                            />
                        </div>
                    </div>

                    {/* Sampai Tanggal */}
                    <div className="space-y-1 lg:col-span-3">
                        <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1 ml-1">
                            <Calendar size={12} className="text-teal-600" /> Sampai Tanggal
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={filterEndDate}
                                onChange={(e) => handleCustomEndDateChange(e.target.value)}
                                className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full text-slate-800 shadow-inner font-mono font-semibold"
                            />
                        </div>
                    </div>

                    {/* Pencarian */}
                    <div className="space-y-1 lg:col-span-3">
                        <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1.5 ml-1">
                            <Search size={12} className="text-teal-600" /> Pencarian Uraian/ID
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Cari uraian, rekening, No. ID (cth: JU-260912-01)..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-slate-300 rounded-xl pl-9 pr-7 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none w-full text-slate-800 shadow-inner font-medium"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1 w-full">
                        <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1.5 ml-1">
                            <RotateCcw size={12} className="text-teal-600" /> Reset
                        </label>
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="bg-amber-100 border border-amber-500 px-4 py-2 rounded-xl text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1 cursor-pointer"
                            title="Reset Semua Filter"
                        >
                            <RotateCcw size={12} /> Reset
                        </button>
                    </div>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-300/90 rounded-2xl p-4 shadow-sm space-y-3.5 no-print">
                {/*  ACTIONS & STATS BANNER */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Ringkasan Filter & Keseimbangan */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5 bg-teal-100/80 text-teal-900 px-2.5 py-1 rounded-lg font-bold border border-teal-200/80 shadow-xs">
                            <Calendar size={13} className="text-teal-700" />
                            <span>{activePeriodLabel}</span>
                        </div>

                        <div className="bg-slate-200/80 text-slate-700 px-2.5 py-1 rounded-lg font-semibold border border-slate-300/80">
                            {filteredEntries.filter(e => e.rowType === 'debet').length} Transaksi ({filteredEntries.length} Baris)
                        </div>

                        <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-[11px] font-mono">
                            <span className="text-emerald-700 font-bold">D: {formatCurrency(summary.totalDebet)}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-rose-700 font-bold">K: {formatCurrency(summary.totalKredit)}</span>
                            <span className="text-slate-300">|</span>
                            {summary.totalDebet === summary.totalKredit ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                    <CheckCircle2 size={12} /> Seimbang
                                </span>
                            ) : (
                                <span className="text-rose-600 font-black flex items-center gap-0.5">
                                    <AlertTriangle size={12} /> Selisih: {formatCurrency(Math.abs(summary.totalDebet - summary.totalKredit))}
                                </span>
                            )}
                        </div>

                        {(searchTerm || filterStartDate || filterEndDate || filterAccount || selectedMonth || selectedYear) && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                                title="Hapus semua filter"
                            >
                                <X size={12} /> Reset Filter
                            </button>
                        )}

                        {/* Tombol Opsi Centang Semua */}
                        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300 text-[11px] shadow-2xs">
                            <button
                                type="button"
                                onClick={selectedTxIds.size === filteredTxIds.length ? handleDeselectAll : handleSelectAllFiltered}
                                className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded transition cursor-pointer ${
                                    selectedTxIds.size > 0 && selectedTxIds.size === filteredTxIds.length
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'hover:bg-slate-100 text-slate-700'
                                }`}
                                title="Centang semua transaksi hasil filter"
                            >
                                <CheckSquare size={13} className={selectedTxIds.size > 0 && selectedTxIds.size === filteredTxIds.length ? "text-teal-600" : "text-slate-500"} />
                                <span>{selectedTxIds.size > 0 && selectedTxIds.size === filteredTxIds.length ? 'Batal Semua' : `Centang Semua (${filteredTxIds.length})`}</span>
                            </button>
                            {pageTxIds.length < filteredTxIds.length && (
                                <>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={isAllCurrentPageSelected ? handleDeselectAll : handleSelectAllCurrentPage}
                                        className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded transition cursor-pointer ${
                                            isAllCurrentPageSelected
                                                ? 'bg-teal-100 text-teal-800'
                                                : 'hover:bg-slate-100 text-slate-700'
                                        }`}
                                        title="Centang transaksi pada halaman ini saja"
                                    >
                                        <CheckCircle2 size={13} className={isAllCurrentPageSelected ? "text-teal-600" : "text-slate-500"} />
                                        <span>{isAllCurrentPageSelected ? 'Batal Hal.' : `Hal. Ini (${pageTxIds.length})`}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Tombol Pratinjau Cetak A5 */}
                        <button
                            id="btn-pratinjau-cetak-ju"
                            type="button"
                            onClick={() => handleOpenA5Preview()}
                            className="w-full md:w-auto bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs border border-slate-300 dark:border-slate-600 active:scale-95 text-xs transition-all cursor-pointer"
                            title="Buka pratinjau dokumen dalam tata letak A5 sebelum cetak fisik"
                        >
                            <Eye size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
                            <span>Pratinjau Cetak</span>
                        </button>

                        {debtSummary.hasOutstandingDebt && (
                            <button
                                id="btn-bayar-hutang-ju"
                                type="button"
                                onClick={() => setShowDebtRecapModal(true)}
                                className="w-full md:w-auto bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-black py-2 px-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-purple-500/25 active:scale-95 uppercase tracking-wider text-xs transition-all cursor-pointer border border-purple-400/40 animate-pulse"
                                title="Klik untuk melihat rekapan hutang dan bayar hutang"
                            >
                                <Receipt size={16} className="text-purple-200 shrink-0" />
                                <span>Bayar Hutang</span>
                                <span className="bg-purple-950/80 text-purple-200 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                                    Rp {formatCurrency(debtSummary.totalSisaHutang)}
                                </span>
                            </button>
                        )}
                        <div className="relative w-full md:w-auto" ref={categoryDropdownRef}>
                            <button
                                id="btn-entri-baru-ju"
                                onClick={handleOpenInput}
                                className="w-full md:w-auto bg-teal-600 hover:bg-teal-500 text-white font-black py-2 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 uppercase tracking-wider text-xs transition-all cursor-pointer"
                                aria-haspopup="true"
                                aria-expanded={showCategoryDropdown}
                            >
                                <Plus size={16} /> 
                                <span>Entri Baru</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {/* DROPDOWN MENU: INPUT KATEGORI TRANSAKSI */}
                            {showCategoryDropdown && (
                                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in text-slate-800 dark:text-slate-100 divide-y divide-slate-100 dark:divide-slate-800">
                                    {/* Header Dropdown */}
                                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/90 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                                <ClipboardList size={14} className="text-teal-600 dark:text-teal-400" />
                                                Input Kategori Transaksi
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                Pilih jenis transaksi untuk otomatisasi akun:
                                            </p>
                                        </div>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300 font-bold">
                                            3 Pilihan
                                        </span>
                                    </div>

                                    {/* Menu Items */}
                                    <div className="p-1.5 space-y-1">
                                        {/* 1. Mutasi */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCategory('mutasi')}
                                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors flex items-center gap-3 cursor-pointer group"
                                        >
                                            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 group-hover:scale-110 transition-transform shrink-0">
                                                <ArrowLeftRight size={16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                                                    1. Mutasi
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                    Kredit: Kas Sumber | Debet: Kas Penerima
                                                </div>
                                            </div>
                                        </button>

                                        {/* 2. Pendapatan */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCategory('pendapatan')}
                                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors flex items-center gap-3 cursor-pointer group"
                                        >
                                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform shrink-0">
                                                <Coins size={16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                                                    2. Pendapatan
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                    Kredit: Pendapatan | Debet: Kas Otomatis
                                                </div>
                                            </div>
                                        </button>

                                        {/* 3. Belanja Adat */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCategory('belanja_adat')}
                                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center gap-3 cursor-pointer group"
                                        >
                                            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform shrink-0">
                                                <ShoppingBag size={16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                                    3. Belanja Adat
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                    Kas Desa Adat &amp; Juru Raksa (Kecuali Insentif)
                                                </div>
                                            </div>
                                        </button>

                                    </div>

                                    {/* Direct / Manual option */}
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800/60 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCategoryDropdown(false);
                                                handleDirectOpenInput();
                                            }}
                                            className="w-full text-center py-1.5 px-2 rounded-lg text-[12px] font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                        >
                                            Entri Formulir Kosong (Manual) →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* BULK ACTION BAR (TAMPIL KETIKA ADA TRANSAKSI DICENTANG) */}
            {selectedTxIds.size > 0 && (
                <div className="bg-gradient-to-r from-teal-900 via-slate-800 to-teal-950 text-white p-3 sm:p-3.5 rounded-2xl shadow-lg border border-teal-500/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 animate-fade-in no-print">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-teal-500/20 text-teal-200 border border-teal-400/40 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                            <CheckSquare size={15} className="text-teal-400" />
                            <span>{selectedTxIds.size} Transaksi Dicentang</span>
                        </div>
                        <div className="text-xs text-slate-300 font-mono">
                            Total Nilai: <span className="font-bold text-emerald-400">Rp {formatCurrency(selectedTotalAmount)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                            <button
                                type="button"
                                onClick={handleSelectAllFiltered}
                                className="text-teal-300 hover:text-white underline underline-offset-2 hover:bg-white/10 px-2 py-0.5 rounded transition cursor-pointer"
                            >
                                Centang Semua Hasil Filter ({filteredTxIds.length})
                            </button>
                            <span className="text-slate-500">•</span>
                            <button
                                type="button"
                                onClick={handleDeselectAll}
                                className="text-rose-300 hover:text-white underline underline-offset-2 hover:bg-white/10 px-2 py-0.5 rounded transition cursor-pointer"
                            >
                                Batal Centang
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            id="btn-bulk-edit-accounts"
                            onClick={() => {
                                setIsBulkChangeDebet(false);
                                setIsBulkChangeKredit(false);
                                setBulkAkunDebet('');
                                setBulkAkunKredit('');
                                setShowBulkEditModal(true);
                            }}
                            className="flex-1 md:flex-none bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 text-xs transition cursor-pointer border border-sky-400/50"
                            title="Edit akun debet atau kredit sekalian untuk transaksi yang dicentang"
                        >
                            <Pencil size={14} />
                            <span>Edit Akun Sekalian</span>
                        </button>
                        <button
                            type="button"
                            id="btn-bulk-delete"
                            onClick={() => setShowBulkDeleteModal(true)}
                            className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 text-xs transition cursor-pointer border border-rose-400/50"
                            title="Hapus sekalian semua transaksi yang dicentang"
                        >
                            <Trash2 size={14} />
                            <span>Hapus Sekalian ({selectedTxIds.size})</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TABEL */}
            <div className="overflow-x-auto border border-gray-300 rounded-xl bg-white shadow-sm no-print">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-400 text-gray-900 uppercase text-xs font-black border-b-2 border-slate-300">
                        <tr>
                            {JU_COLUMNS.map(c => (
                                <th key={c.key} className={`px-3 py-2.5 border-r border-slate-300 ${c.align} ${c.width}`}>
                                    {c.key === 'aksi' ? (
                                        <div className="flex items-center justify-center gap-1.5 cursor-pointer select-none" title="Centang Semua Transaksi di Halaman Ini">
                                            <input
                                                type="checkbox"
                                                id="checkbox-select-all-header"
                                                checked={isAllCurrentPageSelected}
                                                ref={selectAllHeaderCheckboxRef}
                                                onChange={handleToggleSelectAll}
                                                className="w-4 h-4 rounded border-slate-500 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                                                aria-label="Centang semua transaksi di halaman ini"
                                            />
                                            <span>Aksi</span>
                                        </div>
                                    ) : (
                                        c.label
                                    )}
                                </th>
                            ))}
                        </tr>
                        {/* Baris Nomor Kolom Standar Nasional */}
                        <tr className="bg-slate-200/70 text-slate-600 text-[9px] text-center font-mono font-bold border-b border-slate-300">
                          <th className="py-0.5 border-r border-slate-300 w-15">1</th>
                          <th className="py-0.5 border-r border-slate-300 w-12">2</th>
                          <th className="py-0.5 border-r border-slate-300 min-w-[210px]">3</th>
                          <th className="py-0.5 border-r border-slate-300 w-40">4</th>
                          <th className="py-0.5 border-r border-slate-300 w-24">5</th>
                          <th className="py-0.5 border-r border-slate-300 w-24">6</th>
                          <th className="py-0.5 border-slate-300 w-18 min-w-[80px]">7</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 font-medium">
                        {paginatedEntries.length > 0 ? paginatedEntries.map((e) => {
                            const isSelected = selectedTxIds.has(e.idTransaksi || '');
                            return (
                            <tr key={e.rowId} className={`transition-colors ${isSelected ? 'bg-teal-50/90 text-teal-950 font-medium' : (e.rowType === 'kredit' ? 'bg-slate-50 hover:bg-slate-500/10' : 'bg-white hover:bg-slate-500/10')}`}>
                                <td className="px-3 py-1.5 border-r border-slate-200 text-gray-700 font-mono text-xs whitespace-wrap w-15">{e.rowType === 'debet' || filterAccount ? formatDate(e.date || '') : ''}</td>
                                <td className="px-2.5 py-1.5 border-r border-slate-200 text-teal-700 font-mono text-[11px] font-semibold whitespace-wrap w-12">{e.rowType === 'debet' || filterAccount ? e.idTransaksi : ''}</td>
                                <td className={`px-3 py-1.5 border-r border-slate-200 text-gray-900 text-[12px] min-w-[210px] leading-relaxed break-words ${e.rowType === 'kredit' && !filterAccount ? 'italic text-gray-500' : 'font-semibold'}`}>{e.rowType === 'debet' || filterAccount ? e.uraian : ''}</td>
                                <td className={`px-3 py-1.5 border-r border-slate-200  text-[12px] w-40 ${e.rowType === 'kredit' ? 'pl-8 text-amber-700 italic font-medium' : 'text-emerald-700'}`}>{e.kodeRekening} - {getAccName(e.kodeRekening || '')}</td>
                                <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono text-emerald-700 font-bold text-xs whitespace-nowrap w-24">{e.debet > 0 ? formatCurrency(e.debet) : '-'}</td>
                                <td className="px-3 py-1.5 border-r border-slate-200 text-right font-mono text-rose-700 font-bold text-xs whitespace-nowrap w-24">{e.kredit > 0 ? formatCurrency(e.kredit) : '-'}</td>
                                <td className="px-1.5 py-1 text-center w-24 min-w-[105px] whitespace-nowrap">
                                    {(e.rowType === 'debet' || filterAccount) && (
                                        <div className="flex items-center justify-center gap-1">
                                            <input
                                                type="checkbox"
                                                id={`check-trx-${e.idTransaksi}`}
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectTx(e.idTransaksi || '')}
                                                className="w-4 h-4 rounded border-slate-400 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600 hover:scale-105 transition-transform"
                                                title={`Centang transaksi ${e.idTransaksi}`}
                                                aria-label={`Centang transaksi ${e.idTransaksi}`}
                                            />
                                            <button onClick={() => handleOpenA5Preview(e.idTransaksi || '')} className="text-emerald-700 hover:bg-emerald-100 p-1 rounded transition-colors" title="Pratinjau Cetak (Layout A5)"><Eye size={14} /></button>
                                            <button onClick={() => handlePrintReceiptClick(e.idTransaksi || '')} className="text-amber-700 hover:bg-amber-100 p-1 rounded transition-colors" title="Cetak Kwitansi/Nota"><Printer size={14} /></button>
                                            <button onClick={() => handleEditClick(e.idTransaksi || '')} className="text-sky-600 hover:bg-sky-100 p-1 rounded transition-colors" title="Edit Transaksi"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteClick(e.idTransaksi || '')} className="text-rose-600 hover:bg-rose-100 p-1 rounded transition-colors" title="Hapus Transaksi"><Trash2 size={14} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={7} className="px-4 py-20 text-center text-gray-600 italic uppercase font-black tracking-widest bg-gray-950/20">Data tidak ditemukan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-2 no-print gap-4">
                <Pagination currentPage={currentPage} totalPages={pageCount} onPageChange={setCurrentPage} />
            </div>

            {/* Formal Footer Layout */}
            <div className="flex justify-between items-center mt-8 text-slate-900 border-t-2 border-slate-400 pt-2 no-print">
                <div>
                    <p className="font-semibold">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                    <p className="text-[12px]">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                </div>
                <div className="text-right font-mono text-[9px] text-slate-600">
                    <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>

            {/* SIGNATURE SETTINGS MODAL */}
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Laporan Jurnal Umum" className="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center gap-2"><MapPin size={12}/> Tempat Laporan</label>
                        <input type="text" value={tempCustomPlace} onChange={e => setTempCustomPlace(e.target.value)} className="w-full bg-slate-50 border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>  
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 flex items-center gap-2"><Calendar size={12}/> Tanggal Tanda Tangan</label>
                        <input type="date" value={tempSignatureDate} onChange={e => setTempSignatureDate(e.target.value)} className="w-full bg-slate-50 border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Keliang Adat</label>
                        <input type="text" value={tempKeliangName} onChange={e => setTempKeliangName(e.target.value)} className="w-full bg-slate-50 border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Juru Raksa</label>
                        <input type="text" value={tempJuruRaksaName} onChange={e => setTempJuruRaksaName(e.target.value)} className="w-full bg-slate-50 border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Penerima Kwitansi</label>
                        <input type="text" value={tempPenerimaName} onChange={e => setTempPenerimaName(e.target.value)} className="w-full bg-slate-50 border border-gray-300 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <button onClick={() => setIsPasswordModalOpen(true)} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest">Simpan Perubahan</button>
                </div>
            </Modal>

            {/* PASSWORD VERIFICATION MODAL */}
            <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Verifikasi Keamanan" className="max-w-sm">
                <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3 mb-2">
                        <div className="p-4 bg-teal-500/10 rounded-full">
                            <Lock size={32} className="text-teal-400" />
                        </div>
                        <p className="text-[11px] text-center text-gray-500 font-bold uppercase tracking-widest leading-relaxed">Masukkan password admin untuk mengonfirmasi perubahan tanda tangan jurnal.</p>
                    </div>
                    <div>
                        <input 
                            type="password" 
                            value={passwordInput} 
                            onChange={e => setPasswordInput(e.target.value)} 
                            className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-gray-950 font-black text-center text-lg focus:ring-2 focus:ring-teal-500 outline-none shadow-inner" 
                            placeholder="••••••••"
                            autoFocus 
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                        />
                    </div>
                    <button 
                        onClick={handleVerifyPassword} 
                        className="w-full bg-teal-600 hover:bg-teal-500 py-4 rounded-xl font-black text-white shadow-lg uppercase tracking-widest text-xs transition-all active:scale-95"
                    >
                        Verifikasi & Simpan
                    </button>
                </div>
            </Modal>

            {/* INPUT KATEGORI TRANSAKSI MODAL */}
            <InputKategoriTransaksiModal
                isOpen={showKategoriModal}
                initialType={selectedCategoryType}
                cashBalances={cashAccountBalances}
                onClose={() => {
                    setShowKategoriModal(false);
                    setSelectedCategoryType(null);
                }}
                onSelectTransaction={handleSelectCategoryTransaction}
                onBypassCategory={handleDirectOpenInput}
            />

      {/* JURNAL ENTRY MODAL */}
      {showEntryModal && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 my-auto overflow-y-auto"
          onClick={() => setShowEntryModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-[92vh] max-h-[95vh] rounded-2xl shadow-2xl p-6 sm:p-8 relative text-slate-800 dark:text-slate-200 flex flex-col justify-between overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-xl font-bold uppercase tracking-wider font-mono text-emerald-500 flex items-center gap-2">
                <span>📝</span> Entry Jurnal Baru (Double-Entry)
              </h3>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenVerification} className="flex-1 overflow-y-auto py-4 space-y-5 pr-1.5 custom-scrollbar">
              {/* Banner Pelunasan Hutang */}
              {activePayingDebt && (
                <div className="p-3.5 rounded-2xl bg-purple-50 border-2 border-purple-300 flex items-start gap-3 text-xs text-purple-950 shadow-sm">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                    <Receipt size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-sm text-purple-900">
                        Mode Pelunasan Hutang: {activePayingDebt.code} - {activePayingDebt.name}
                      </span>
                      <span className="font-mono font-black text-xs px-2.5 py-1 bg-purple-200 text-purple-900 rounded-lg border border-purple-300">
                        Sisa Hutang: Rp {formatCurrency(activePayingDebt.maxAmount)}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1 leading-relaxed text-[11px]">
                      Akun Debet otomatis diset ke akun kewajiban <strong>{activePayingDebt.code}</strong>. Akun Kredit bersifat <strong>opsional</strong> (bisa dikosongkan untuk otomatis menggunakan Kas Di Bendahara 1.1.1.01 atau pilih rekening kas/bank yang digunakan). Nominal tidak boleh melebihi sisa hutang.
                    </p>
                  </div>
                </div>
              )}

              {/* Tanggal & Pihak Ketiga */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1 tracking-widest">Tanggal Setoran</label>
                    <div className="relative">
                        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} 
                        className="w-full bg-white border border-gray-300 rounded-xl px-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-sm shadow-sm" required />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between px-3 py-1.5 bg-teal-50/80 border border-teal-200 rounded-xl text-xs">
                      <span className="text-teal-900 font-bold flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                        No. ID Transaksi (Otomatis):
                      </span>
                      <span className="font-mono font-black text-teal-700 bg-white px-2.5 py-0.5 rounded-lg border border-teal-300 shadow-2xs text-[11px] tracking-wide">
                        {previewNextId}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                  <label className="block text-[10px] uppercase font-black text-gray-500 mb-1 ml-1 tracking-widest">Dari / Kepada (Pihak Ketiga)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={dariKepada}
                      onChange={(e) => {
                        setDariKepada(e.target.value);
                        setShowPihakKetigaSug(true);
                      }}
                      onFocus={(e) => {
                        e.target.select();
                        setShowPihakKetigaSug(true);
                      }}
                      onBlur={() => setTimeout(() => setShowPihakKetigaSug(false), 200)}
                      placeholder="Masukkan Nama/Toko/dsb"
                      className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-sm shadow-sm" required 
                    />
                    {dariKepada && (
                      <button
                        type="button"
                        onClick={() => setDariKepada('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="Reset / Hapus"
                      >
                        <X size={16} />
                      </button>
                    )}
                    {showPihakKetigaSug && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-[280px] overflow-y-auto z-[70] animate-fade-in">
                        {existingPihakKetiga
                          .filter((p) => {
                            const query = (dariKepada === 'Masukkan Nama/Toko/dsb' ? '' : dariKepada).toLowerCase();
                            return !query || p.toLowerCase().includes(query);
                          })
                          .map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onMouseDown={() => {
                                setDariKepada(p);
                                setShowPihakKetigaSug(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500/10 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-800 dark:text-slate-200 font-medium"
                            >
                              👤 {p}
                            </button>
                          ))
                        }
                        {existingPihakKetiga.filter((p) => {
                          const query = (dariKepada === 'Masukkan Nama/Toko/dsb' ? '' : dariKepada).toLowerCase();
                          return !query || p.toLowerCase().includes(query);
                        }).length === 0 && (
                          <div className="p-3 text-xs text-slate-400 italic">Nama pihak baru</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="bg-slate-50/90 p-3 rounded-xl border border-gray-200 space-y-1.5 shadow-xs">
                  <KodeRekeningAutocomplete
                    id="input-akun-debet"
                    value={akunDebet}
                    label="AKUN DEBET (MEMASUKKAN)"
                    side="debet"
                    placeholder="Ketik kode atau nama rekening debet..."
                    budgetItems={budgetItems}
                    counterpartCode={akunKredit}
                    cashBalances={cashAccountBalances}
                    required
                    onChange={(code) => {
                      const cleanCode = (code || '').split(' - ')[0].trim();
                      const cleanKredit = (akunKredit || '').split(' - ')[0].trim();

                      if (cleanKredit === '1.1.2.05' && cleanCode !== '5.3.2.01' && !cleanCode.startsWith('5.3.2.01')) {
                        setNotification({
                          message: '⚠️ Perhatian: Saat kredit adalah Kas Dana Kematian (1.1.2.05), akun debet wajib dan hanya boleh Dana Kematian (5.3.2.01).',
                          type: 'warning'
                        });
                        setAkunDebet('5.3.2.01');
                        const debetMatch = REFERENSI_REKENING.find(r => r.code === '5.3.2.01');
                        setAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : '5.3.2.01 - Dana Kematian');
                        return;
                      }

                      setAkunDebet(code);
                      const match = REFERENSI_REKENING.find(r => r.code === code);
                      setAkunDebetSearch(match ? `${match.code} - ${match.name}` : code);
                      if (code && akunKredit) {
                        setValidationModalContext('new');
                        setShowAccountValidationModal(true);
                      }
                    }}
                  />

                  {/* Indikator Otomatis jika Kredit adalah Kas Dana Kematian 1.1.2.05 */}
                  {(akunKredit?.split(' - ')[0].trim() === '1.1.2.05') && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs text-purple-900 dark:text-purple-200 animate-in fade-in">
                      <Sparkles size={12} className="text-purple-600 shrink-0" />
                      <span className="text-[11px] font-medium">
                        Kredit Kas Dana Kematian (1.1.2.05) aktif ➔ Otomatis Debet <strong>5.3.2.01 - Dana Kematian</strong>
                      </span>
                    </div>
                  )}

                  {/* Rekomendasi Akun Debet jika Akun Kredit 4.1.3.01 atau 4.1.3.02 */}
                  <RekomendasiAkunDebet
                    idPrefix="input-debet"
                    kreditCode={akunKredit}
                    selectedDebetCode={akunDebet}
                    cashBalances={cashAccountBalances}
                    onSelectDebet={(code, name) => {
                      setAkunDebet(code);
                      setAkunDebetSearch(`${code} - ${name}`);
                    }}
                  />
                </div>

                <div className="bg-slate-50/90 p-3 rounded-xl border border-gray-200 space-y-2 shadow-xs">
                  <KodeRekeningAutocomplete
                    id="input-akun-kredit"
                    value={akunKredit}
                    label={activePayingDebt ? "AKUN KREDIT (SUMBER DANA KAS/BANK - OPSIONAL)" : "AKUN KREDIT (MENGELUARKAN)"}
                    side="kredit"
                    placeholder={activePayingDebt ? "Pilih kas bersaldo / kosongkan untuk default..." : "Ketik kode atau nama rekening kredit..."}
                    budgetItems={budgetItems}
                    counterpartCode={akunDebet}
                    cashBalances={cashAccountBalances}
                    required={!activePayingDebt}
                    onChange={(code) => {
                      const cleanCode = (code || '').split(' - ')[0].trim();
                      setAkunKredit(code);
                      const match = REFERENSI_REKENING.find(r => r.code === code);
                      setAkunKreditSearch(match ? `${match.code} - ${match.name}` : code);

                      // Otomatisasi: Jika kredit adalah Kas Dana Kematian (1.1.2.05), debet otomatis diisi 5.3.2.01 (Dana Kematian)
                      if (cleanCode === '1.1.2.05') {
                        setAkunDebet('5.3.2.01');
                        const debetMatch = REFERENSI_REKENING.find(r => r.code === '5.3.2.01');
                        setAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : '5.3.2.01 - Dana Kematian');
                        if (!uraian || uraian.trim() === '') {
                          setUraian('Penyaluran / Belanja Dana Kematian');
                        }
                      }

                      if (code && (cleanCode === '1.1.2.05' || akunDebet)) {
                        setValidationModalContext('new');
                        setShowAccountValidationModal(true);
                      }
                    }}
                  />

                  {/* Tombol Kas Bersaldo dengan Popup Dropdown */}
                  {(() => {
                    const cleanCreditCode = (akunKredit || (activePayingDebt ? (getBestCashAccountWithBalance(parseNumber(nominal))?.code || '1.1.1.01') : '')).split(' - ')[0].trim();
                    const isCash = isKasAccount(cleanCreditCode);
                    const cashData = isCash ? (cashAccountBalances[cleanCreditCode] || { code: cleanCreditCode, name: REFERENSI_REKENING.find(r => r.code === cleanCreditCode)?.name || cleanCreditCode, balance: 0 }) : null;
                    const enteredNominal = parseNumber(nominal);

                    return (
                      <div className="relative pt-1" ref={kasBersaldoRef}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <button
                            id="btn-kas-bersaldo-dropdown"
                            type="button"
                            onClick={() => setShowKasBersaldoDropdown(prev => !prev)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                            title="Klik untuk membuka pilihan kas yang mempunyai saldo"
                          >
                            <Wallet size={13} className="text-emerald-600 shrink-0" />
                            <span>Kas Bersaldo</span>
                            {positiveCashAccounts.length > 0 && (
                              <span className="px-1.5 py-0.2 bg-emerald-200/80 text-emerald-900 rounded-full text-[10px] font-mono font-bold">
                                {positiveCashAccounts.length}
                              </span>
                            )}
                            <ChevronDown size={13} className={`text-emerald-700 transition-transform duration-200 ${showKasBersaldoDropdown ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Ringkasan Saldo Akun Kas Terpilih (Satu Baris Bersih & Ringkas) */}
                          {cashData && (
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-700 truncate min-w-0" title={`Saldo ${cashData.name}: Rp ${formatCurrency(cashData.balance)}`}>
                              <span className="text-slate-400 font-sans text-[10px]">Saldo:</span>
                              <span className={`font-bold ${cashData.balance >= enteredNominal ? 'text-emerald-700' : 'text-amber-700'}`}>
                                Rp {formatCurrency(cashData.balance)}
                              </span>
                              {enteredNominal > 0 && (
                                <span className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold shrink-0 ${
                                  cashData.balance >= enteredNominal 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {cashData.balance >= enteredNominal ? '✓ Cukup' : '⚠️ Kurang'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* POPUP DROPDOWN KAS BERSALDO */}
                        {showKasBersaldoDropdown && (
                          <div 
                            id="popup-dropdown-kas-bersaldo"
                            className="absolute left-0 top-full mt-1.5 w-full sm:w-84 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                          >
                            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 dark:border-slate-700/80 mb-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Wallet size={13} className="text-emerald-600" />
                                <span>Pilih Kas Bersaldo</span>
                              </div>
                              {enteredNominal > 0 && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  Kebutuhan: Rp {formatCurrency(enteredNominal)}
                                </span>
                              )}
                            </div>

                            <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                              {positiveCashAccounts.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 italic">
                                  Tidak ada rekening kas dengan saldo positif saat ini.
                                </div>
                              ) : (
                                positiveCashAccounts.map((cash) => {
                                  const isSelected = cleanCreditCode === cash.code;
                                  const isSufficient = cash.balance >= enteredNominal;

                                  return (
                                    <button
                                      key={cash.code}
                                      type="button"
                                      onClick={() => {
                                        setAkunKredit(cash.code);
                                        setAkunKreditSearch(`${cash.code} - ${cash.name}`);
                                        setShowKasBersaldoDropdown(false);
                                        if (cash.code === '1.1.2.05') {
                                          setAkunDebet('5.3.2.01');
                                          const debetMatch = REFERENSI_REKENING.find(r => r.code === '5.3.2.01');
                                          setAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : '5.3.2.01 - Dana Kematian');
                                          if (!uraian || uraian.trim() === '') {
                                            setUraian('Penyaluran / Belanja Dana Kematian');
                                          }
                                        }
                                        if (cash.code === '1.1.2.05' || akunDebet) {
                                          setValidationModalContext('new');
                                          setShowAccountValidationModal(true);
                                        }
                                      }}
                                      className={`w-full text-left p-2 rounded-lg transition-all flex items-center justify-between gap-2 border cursor-pointer ${
                                        isSelected
                                          ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 shadow-2xs'
                                          : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                                      }`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-[10px] font-bold px-1 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                            {cash.code}
                                          </span>
                                          <span className="text-xs font-semibold truncate block">
                                            {cash.name.replace('Kas Di Bendahara Desa Adat', 'Kas Di Bendahara')}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                          Rp {formatCurrency(cash.balance)}
                                        </div>
                                        {enteredNominal > 0 && (
                                          <span className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold inline-block ${
                                            isSufficient 
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' 
                                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                          }`}>
                                            {isSufficient ? '✓ Cukup' : '⚠️ Kurang'}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>

                            {activePayingDebt && !akunKredit && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700 text-[10px] text-purple-700 dark:text-purple-300 italic">
                                * Mode Pelunasan: Default otomatis menggunakan Kas Bendahara atau kas bersaldo.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Status Alur Akun Jurnal & Validasi Langsung */}
              {akunDebet && (akunKredit || activePayingDebt) && (
                <div className="p-2.5 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-2 text-teal-950 dark:text-teal-200 font-bold min-w-0">
                    <CheckCircle2 size={15} className="text-teal-600 shrink-0" />
                    <span className="truncate text-[11px]">
                      Alur Jurnal: <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-teal-200">{akunDebet.split(' - ')[0]}</span> (Debet) ➔ <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-teal-200">{(akunKredit || '1.1.1.01').split(' - ')[0]}</span> (Kredit)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setValidationModalContext('new');
                        setShowAccountValidationModal(true);
                      }}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[10px] transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                      title="Periksa diagram alur dan kaidah akuntansi akun yang dipilih"
                    >
                      <BookOpen size={12} />
                      <span>Validasi Alur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValidationModalContext('new');
                        handleSwapModalAccounts();
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold rounded-lg text-[10px] transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                      title="Tukar posisi Debet dan Kredit"
                    >
                      <ArrowRight size={12} className="rotate-180" />
                      <span>Tukar</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Uraian Transaksi & Nominal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="bg-slate-50/90 p-3 rounded-xl border border-gray-200 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="block text-[11px] uppercase font-bold text-slate-600">Uraian Transaksi</label>
                      <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1">
                        <span>💡 Klik untuk banyak pilihan</span>
                      </span>
                    </div>
                    <UraianDropdownInput
                      id="input-uraian-modal-baru"
                      value={uraian}
                      onChange={setUraian}
                      akunDebet={akunDebet}
                      akunKredit={akunKredit}
                      existingUraians={existingUraians}
                      placeholder="Masukkan atau pilih uraian transaksi..."
                      required
                    />
                </div>
                <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 shadow-xs relative overflow-hidden flex flex-col justify-center">
                  <label className="block text-[10px] font-black text-emerald-700 uppercase mb-1 ml-0.5 tracking-wider">Nominal Transaksi (Rp)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={nominal || ''}
                      onChange={(e) => setNominal(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-white border border-emerald-300 rounded-lg pl-12 pr-10 py-2 text-emerald-700 font-black focus:ring-2 focus:ring-emerald-500/20 outline-none text-xl sm:text-2xl shadow-inner" 
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 font-black text-base sm:text-lg">Rp</div>
                    {nominal > 0 && (
                      <button
                        type="button"
                        onClick={() => setNominal(0)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-full hover:bg-emerald-200/60 transition-colors"
                        title="Reset Nominal"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {nominal > 0 && (
                    <p className="mt-1.5 text-[11px] text-gray-800 font-medium italic truncate">
                      Terbilang: {terbilang(nominal)}
                    </p>
                  )}
                </div>  
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
                >
                  Verifikasi Dokumen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT VERIFICATION MODAL */}
      {showDocModal && tempEntry && (() => {
        const isBeban = isBebanAccount(tempEntry.akunDebet);
        const currentDocType = docTab || tempEntry.primaryDocType || 'nota';

        return (
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDocModal(false)}
          >
            <div 
              className={`bg-white border border-slate-300 w-full ${isBeban && currentDocType === 'nota' ? 'max-w-2xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl p-6 relative text-slate-950 font-sans`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xm font-bold uppercase font-mono text-center text-teal-600 tracking-wider mb-2">
                {currentDocType === 'kwitansi' ? 'VERIFIKASI KWITANSI' : isBeban ? 'VERIFIKASI NOTA BELANJA (BEBAN)' : 'VERIFIKASI NOTA TRANSAKSI'}
              </h3>
              <p className="text-[11px] text-slate-500 text-center mb-3">
                {currentDocType === 'kwitansi' 
                  ? 'Mohon tinjau kesesuaian kwitansi tanda terima sebelum posting jurnal.' 
                  : isBeban 
                    ? 'Mohon lengkapi dan tinjau rincian barang/jasa nota belanja sebelum posting jurnal.' 
                    : 'Mohon tinjau kesesuaian nota transaksi sebelum posting jurnal.'}
              </p>

              {/* TAB SELECTOR IN VERIFICATION MODAL */}
              <div className="flex border-b border-slate-200 mb-4 no-print gap-2">
                <button
                  type="button"
                  onClick={() => setDocTab('nota')}
                  className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 ${
                    currentDocType === 'nota' 
                      ? 'border-amber-500 text-amber-600 font-extrabold' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  📄 Nota Belanja / Transaksi {tempEntry.primaryDocType === 'nota' && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-1 font-mono">Utama</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setDocTab('kwitansi')}
                  className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 ${
                    currentDocType === 'kwitansi' 
                      ? 'border-teal-600 text-teal-600 font-extrabold' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  🧾 Kwitansi {tempEntry.primaryDocType === 'kwitansi' && <span className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded ml-1 font-mono">Utama</span>}
                </button>
              </div>

              {/* Informational banner */}
              <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-500 rounded-lg text-[10px] text-amber-800 font-medium mb-4 no-print">
                <span>💡</span>
                <span>Pengubahan Kepada/Rekanan dan Tanda Tangan pada formulir ini murni untuk keperluan cetak nota/kwitansi (tidak mengubah akun Jurnal).</span>
              </div>

              {/* Document Body */}
              {currentDocType === 'nota' ? (
                /* NOTA BELANJA PREVIEW IN VERIFICATION MODAL */
                <div className="p-4 border-2 border-dashed border-amber-300 bg-amber-50/20 rounded-lg space-y-4 font-mono text-xs">
                  <div className="text-center border-b border-slate-300 pb-2">
                    <h4 className="font-bold text-[15px] uppercase">{profile.namaDesa}</h4>
                    <p className="text-[11px] text-slate-500">{profile.alamat}</p>
                    <div className="mt-1.5 inline-block bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded border border-amber-300">
                      NOTA BELANJA / DOKUMEN TRANSAKSI
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      No. Nota: {tempEntry.id}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <p><strong>TANGGAL :</strong> {tempEntry.tanggal}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong>KEPADA / REKANAN :</strong>
                        {isEditingKepada ? (
                          <input
                            type="text"
                            value={tempEntry.notaKepada !== undefined ? tempEntry.notaKepada : ''}
                            onChange={(e) => setTempEntry({ ...tempEntry, notaKepada: e.target.value })}
                            placeholder="Desa Adat Basangalas"
                            className="bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            onBlur={() => setIsEditingKepada(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingKepada(false); }}
                            autoFocus
                          />
                        ) : (
                          <span className="font-bold underline text-slate-900">
                            {tempEntry.notaKepada || 'Desa Adat Basangalas'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsEditingKepada(!isEditingKepada)}
                          className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition no-print inline-flex items-center gap-1"
                          title="Edit Kepada / Rekanan (Khusus Cetak)"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    <p className="md:col-span-2"><strong>URAIAN :</strong> {tempEntry.uraian}</p>
                  </div>

                  {/* Dynamic Items Table for Beban Accounts */}
                  {isBeban && (() => {
                    const hasZeroQty = notaItems.some(i => parseNumber(i.qty) <= 0);
                    const hasZeroPrice = notaItems.some(i => parseNumber(i.price) <= 0);

                    return (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">Rincian Belanja Barang / Jasa:</p>
                          {hasZeroQty && (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 no-print animate-pulse">
                              <AlertCircle className="w-3.5 h-3.5" /> Qty masih 0 (Wajib diisi)
                            </span>
                          )}
                        </div>

                        {/* Banner Petunjuk Khusus saat QTY masih 0 */}
                        {hasZeroQty && (
                          <div className="no-print p-2.5 bg-rose-50 border-2 border-rose-400/80 rounded-xl text-rose-900 text-xs flex items-start gap-2.5 shadow-sm">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <p className="font-bold text-rose-900">Petunjuk: Kolom QTY Masih Bernilai 0 (Nol)!</p>
                              <p className="text-[11px] text-rose-800 leading-relaxed">
                                Mohon isi kuantitas belanja (minimal <strong>1</strong>) pada kotak <strong>Qty</strong> yang bertanda merah di bawah. Tombol simpan membutuhkan nilai Qty &gt; 0 agar nominal nota dapat dihitung dan tersimpan ke Jurnal Umum.
                              </p>
                            </div>
                          </div>
                        )}
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b-2 border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[9px]">
                                <th className="py-2 px-1 text-center w-8">No</th>
                                <th className="py-2 px-2">Nama Barang / Uraian</th>
                                <th className="py-2 px-1 text-center w-20">
                                  Qty {hasZeroQty && <span className="text-rose-600 font-black no-print">*</span>}
                                </th>
                                <th className="py-2 px-2 text-right w-28">Harga Satuan</th>
                                <th className="py-2 px-2 text-right w-28">Harga Total</th>
                                <th className="py-2 px-1 text-center w-8 no-print"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {notaItems.map((item, index) => {
                                const isItemQtyZero = parseNumber(item.qty) <= 0;
                                const isItemPriceZero = parseNumber(item.price) <= 0;

                                return (
                                  <tr key={item.id} className={`border-b border-slate-150 hover:bg-slate-50 transition-colors ${isItemQtyZero ? 'bg-rose-50/40' : ''}`}>
                                    <td className="py-2 px-1 text-center text-slate-500 font-mono text-[10px]">{index + 1}</td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => handleEditNotaItem(item.id, 'name', e.target.value)}
                                        placeholder="Nama barang / jasa"
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs print:border-0 print:bg-transparent print:p-0 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                      />
                                    </td>
                                    <td className="py-1 px-1">
                                      <div className="relative">
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          data-qty-invalid={isItemQtyZero ? "true" : "false"}
                                          value={item.qty}
                                          onChange={(e) => handleEditNotaItem(item.id, 'qty', e.target.value)}
                                          placeholder="1"
                                          className={`w-full rounded px-1 py-1 text-xs text-center font-mono font-bold transition-all print:border-0 print:bg-transparent print:p-0 ${
                                            isItemQtyZero
                                              ? 'bg-rose-50 border-2 border-rose-500 text-rose-800 ring-2 ring-rose-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-400'
                                              : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                                          }`}
                                          title={isItemQtyZero ? 'Kolom Qty wajib diisi minimal 1' : 'Kuantitas'}
                                        />
                                        {isItemQtyZero && (
                                          <span className="no-print block text-[9px] text-rose-600 font-black text-center mt-0.5 leading-none">
                                            Wajib &gt; 0
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-1 px-1">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        data-price-invalid={isItemPriceZero ? "true" : "false"}
                                        value={item.price}
                                        onChange={(e) => handleEditNotaItem(item.id, 'price', e.target.value)}
                                        placeholder="0"
                                        className={`w-full rounded px-1.5 py-1 text-xs text-right font-mono transition-all print:border-0 print:bg-transparent print:p-0 ${
                                          isItemPriceZero
                                            ? 'bg-amber-50 border-2 border-amber-400 text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500'
                                            : 'bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
                                        }`}
                                      />
                                    </td>
                                    <td className="py-2 px-1 text-right font-mono text-[11px] text-slate-800 font-bold">
                                      Rp {(parseNumber(item.qty) * parseNumber(item.price)).toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-1 px-1 text-center no-print">
                                      {notaItems.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteNotaItem(item.id)}
                                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                                          title="Hapus baris"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-start no-print">
                          <button
                            type="button"
                            onClick={handleAddNotaItem}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-bold rounded-lg text-[10px] flex items-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3" /> Tambah Baris Baru
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="border-t border-b border-slate-300 py-2 space-y-1 text-[11px]">
                    <p className="text-emerald-600"><strong>DEBET  :</strong> {getAccName(tempEntry.akunDebet)} ({tempEntry.akunDebet})</p>
                    <p className="text-gray-600"><strong>KREDIT :</strong> {getAccName(tempEntry.akunKredit)} ({tempEntry.akunKredit})</p>
                  </div>

                  <div className="text-right border-t border-slate-300 pt-2">
                    <p className="text-[10px] text-slate-600 uppercase font-bold">Total Nominal</p>
                    <p className="text-sm font-black text-slate-900">
                      Rp {(isBeban ? notaItems.reduce((s, i) => s + (parseNumber(i.qty) * parseNumber(i.price)), 0) : tempEntry.nominal).toLocaleString('id-ID')}
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-700 leading-relaxed italic border-t border-slate-300 pt-2">
                    Terbilang: "{tempEntry.terbilang || terbilang(isBeban ? notaItems.reduce((s, i) => s + (parseNumber(i.qty) * parseNumber(i.price)), 0) : tempEntry.nominal)}"
                  </p>

                  <div className="flex justify-end pt-6 text-center text-[11px] border-t border-dashed border-slate-300">
                    <div className="min-w-[150px]">
                      <div className="flex items-center justify-center gap-1">
                        <p className="font-bold">Hormat Saya / Rekanan</p>
                        <button
                          type="button"
                          onClick={() => setIsEditingHormatSaya(!isEditingHormatSaya)}
                          className="p-0.5 text-teal-600 hover:text-teal-800 no-print"
                          title="Edit Signature Hormat Saya / Rekanan (Khusus Cetak)"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      {isEditingHormatSaya ? (
                        <div className="mt-4 flex items-center gap-1 justify-center">
                          <input
                            type="text"
                            value={tempEntry.notaHormatSaya !== undefined ? tempEntry.notaHormatSaya : ''}
                            onChange={(e) => setTempEntry({ ...tempEntry, notaHormatSaya: e.target.value })}
                            placeholder="Ketik nama / kosongkan"
                            className="bg-white border border-teal-500 rounded px-1.5 py-0.5 text-[9px] font-bold text-center w-32 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            onBlur={() => setIsEditingHormatSaya(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingHormatSaya(false); }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTempEntry({ ...tempEntry, notaHormatSaya: '' });
                              setIsEditingHormatSaya(false);
                            }}
                            className="px-1.5 py-0.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-[9px] font-bold whitespace-nowrap"
                            title="Kosongkan untuk tulis tangan"
                          >
                            Kosongkan
                          </button>
                        </div>
                      ) : (
                        <p className="mt-8 font-bold underline uppercase">
                          {displayRekanan(tempEntry.notaHormatSaya)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (

                /* KWITANSI PREVIEW IN VERIFICATION MODAL */
                <div className="p-4 border-2 border-dashed border-teal-400 bg-teal-50/20 rounded-lg space-y-4 font-mono text-xs">
                  <div className="text-center border-b border-slate-300 pb-2">
                    <h4 className="font-bold text-[15px] uppercase">{profile.namaDesa}</h4>
                    <p className="text-[10px] text-slate-500">{profile.alamat}</p>
                    <div className="mt-1.5 inline-block bg-teal-700 text-white px-2.5 py-0.5 text-[11px] font-bold uppercase rounded">
                      KWITANSI
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      No. Kwitansi: {tempEntry.id}
                    </p>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <p><strong>TANGGAL :</strong> {tempEntry.tanggal}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong>TELAH TERIMA DARI :</strong>
                      {isEditingTelahTerima ? (
                        <input
                          type="text"
                          value={tempEntry.kwitansiTelahTerima !== undefined ? tempEntry.kwitansiTelahTerima : ''}
                          onChange={(e) => setTempEntry({ ...tempEntry, kwitansiTelahTerima: e.target.value })}
                          className="bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          onBlur={() => setIsEditingTelahTerima(false)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingTelahTerima(false); }}
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold underline text-slate-900">
                          {tempEntry.kwitansiTelahTerima || 'Juru Raksa Desa Adat'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEditingTelahTerima(!isEditingTelahTerima)}
                        className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition no-print inline-flex items-center gap-1"
                        title="Edit Telah Terima Dari (Khusus Cetak)"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                    <p><strong>URAIAN :</strong> {tempEntry.uraian}</p>
                    <p><strong>TERBILANG :</strong> <span className="italic font-bold">"{tempEntry.terbilang || terbilang(tempEntry.nominal)}"</span></p>
                  </div>

                  <div className="border-t border-b border-slate-300 py-2 space-y-1 text-[11px]">
                    <p className="text-emerald-600"><strong>DEBET  :</strong> {getAccName(tempEntry.akunDebet)} ({tempEntry.akunDebet})</p>
                    <p className="text-teal-600"><strong>KREDIT :</strong> {getAccName(tempEntry.akunKredit)} ({tempEntry.akunKredit})</p>
                  </div>

                  <div className="text-right border-t border-slate-300 pt-2">
                    <p className="text-[10px] text-slate-600 uppercase font-bold">Total Pembayaran</p>
                    <p className="text-sm font-black text-emerald-800">
                      Rp {(tempEntry.nominal || 0).toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 pt-6 text-center text-[11px] border-t border-dashed border-slate-300 gap-1">
                    <div>
                      <p>Mengetahui,</p>
                      <p className="font-bold">Keliang Adat</p>
                      <p className="mt-8 font-bold underline uppercase">{keliangName}</p>
                    </div>
                    <div>
                      <p></p>
                      <p className="font-bold"></p>
                      <p className="mt-8 font-bold underline uppercase"></p>
                    </div>
                    <div className="relative">
                      <p className="font-bold">Basangalas, {tempEntry.tanggal}</p>
                      <div className="flex items-center justify-center gap-1">
                        <p className="font-bold">Juru Raksa</p>
                        <button
                          type="button"
                          onClick={() => setIsEditingPenerima(!isEditingPenerima)}
                          className="p-0.5text-teal-600 hover:text-teal-800 no-print"
                          title="Edit Nama Penerima (Khusus Cetak)"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                      {isEditingPenerima ? (
                        <div className="mt-4 flex items-center gap-1 justify-center">
                          <input
                            type="text"
                            value={tempEntry.kwitansiPenerima !== undefined ? tempEntry.kwitansiPenerima : ''}
                            onChange={(e) => setTempEntry({ ...tempEntry, kwitansiPenerima: e.target.value })}
                            placeholder="Ketik nama / kosongkan"
                            className="bg-white border border-teal-500 rounded px-1.5 py-0.5 text-[9px] font-bold text-center w-32 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            onBlur={() => setIsEditingPenerima(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingPenerima(false); }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTempEntry({ ...tempEntry, kwitansiPenerima: '' });
                              setIsEditingPenerima(false);
                            }}
                            className="px-1.5 py-0.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-[9px] font-bold whitespace-nowrap"
                            title="Kosongkan untuk tulis tangan"
                          >
                            Kosongkan
                          </button>
                        </div>
                      ) : (
                        <p className="mt-8 font-bold underline uppercase">
                          {displayPenerima(tempEntry.kwitansiPenerima)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="flex flex-wrap gap-2 mt-6 no-print">
                <button
                  onClick={() => {
                    setShowDocModal(false);
                    if (tempEntry.isEdit) {
                      setShowEditModal(true);
                    } else {
                      setShowEntryModal(true);
                    }
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs"
                >
                  Kembali
                </button>
                <button
                  onClick={handleSaveVerifiedDoc}
                  className="flex-1 py-2 bg-emerald-600 text-white hover:bg-emerald-500 font-bold rounded-lg text-xs"
                >
                  Simpan Jurnal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintDoc(tempEntry);
                    setShowA5PreviewModal(true);
                  }}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                  title="Pratinjau visual layout kertas A5"
                >
                  <Eye className="w-3.5 h-3.5" /> Pratinjau A5
                </button>
                <button
                  onClick={() => handlePrintNota(tempEntry)}
                  className="flex-1 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak Nota
                </button>
                <button
                  onClick={() => handlePrintKwitansi(tempEntry)}
                  className="flex-1 py-2 bg-teal-600 text-white hover:bg-teal-500 font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                  title="Cetak Kwitansi dalam format A5 Landscape"
                >
                  <Printer className="w-3.5 h-3.5" /> Kwitansi (A5)
                </button>
                <button
                  onClick={() => triggerWAForDoc(tempEntry)}
                  className="py-2 px-3 bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                  title="Kirim Nota via WA"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRINT ACTIVE receipt / nota modal */}
      {printDoc && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setPrintDoc(null)}
        >
          <div 
            className="bg-white border border-slate-300 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl p-6 relative text-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPrintDoc(null)}
              className="absolute top-4 right-4 text-slate-400 font-bold no-print text-sm hover:text-black"
            >
              ✕
            </button>

            {/* TAB SELECTOR IN MODAL */}
            <div className="flex border-b border-slate-300 mb-4 no-print gap-2">
              <button
                onClick={() => setDocTab('nota')}
                className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 ${
                  docTab === 'nota' 
                    ? 'border-amber-500 text-amber-700 font-extrabold' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                📄 Nota Belanja / Transaksi
              </button>
              <button
                onClick={() => setDocTab('kwitansi')}
                className={`pb-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 ${
                  docTab === 'kwitansi' 
                    ? 'border-teal-600 text-teal-600 font-extrabold' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                🧾 Kwitansi
              </button>
            </div>

            {docTab === 'nota' ? (
              /* PREVIEW NOTA BELANJA */
              <div className="p-4 space-y-4 font-mono text-xs text-slate-900 border border-slate-400 rounded-lg bg-slate-50">
                {/* Notice */}
                <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-300 rounded-lg text-[10px] text-teal-600 font-medium no-print">
                  <span>💡</span>
                  <span>Formulir Cetak Nota: Pengubahan Kepada/Rekanan & Hormat Saya hanya untuk cetak nota (tidak tersimpan ke data Jurnal).</span>
                </div>

                <div className="text-center border-b border-slate-300 pb-3">
                  <h4 className="font-bold uppercase text-[15px]">{profile.namaDesa}</h4>
                  <p className="text-[10px] text-slate-500">{profile.alamat}</p>
                  <div className="mt-2 inline-block bg-amber-100 text-amber-900 px-3 py-1 text-[11px] font-bold uppercase border border-amber-300 rounded">
                    NOTA BELANJA / DOKUMEN TRANSAKSI
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <p><strong>NO. NOTA :</strong> {printDoc.id}</p>
                  <p><strong>TANGGAL :</strong> {formatDate(printDoc.tanggal)}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong>KEPADA / REKANAN :</strong>
                    {isEditingDocKepada ? (
                      <input
                        type="text"
                        value={printDoc.notaKepada !== undefined ? printDoc.notaKepada : ''}
                        onChange={(e) => setPrintDoc({ ...printDoc, notaKepada: e.target.value })}
                        placeholder="Desa Adat Basangalas"
                        className="bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        onBlur={() => setIsEditingDocKepada(false)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingDocKepada(false); }}
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold underline text-slate-900">
                        {printDoc.notaKepada || 'Desa Adat Basangalas'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingDocKepada(!isEditingDocKepada)}
                      className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition no-print inline-flex items-center gap-1"
                      title="Edit Kepada / Rekanan (Khusus Cetak)"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                  <p><strong>URAIAN :</strong> {printDoc.uraian}</p>
                </div>

                {printDoc.items && printDoc.items.length > 0 && (
                  <div className="border-t border-b border-slate-300 py-3 my-2 text-[11px]">
                    <p className="font-bold mb-1 text-[10px] uppercase text-slate-600">Rincian Barang / Jasa:</p>
                    <table className="w-full text-left font-mono">
                      <thead>
                        <tr className="border-b border-slate-300 font-bold text-slate-600">
                          <th className="py-1 w-6">No</th>
                          <th className="py-1">Nama Barang</th>
                          <th className="py-1 text-center w-10">Qty</th>
                          <th className="py-1 text-right w-20">Harga</th>
                          <th className="py-1 text-right w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printDoc.items.map((item: any, idx: number) => (
                          <tr key={item.id || idx} className="border-b border-slate-200 last:border-0">
                            <td className="py-1 text-slate-400">{idx + 1}</td>
                            <td className="py-1">{item.name || item.itemName || 'Barang/Jasa'}</td>
                            <td className="py-1 text-center">{item.qty}</td>
                            <td className="py-1 text-right">Rp {(parseNumber(item.price)).toLocaleString('id-ID')}</td>
                            <td className="py-1 text-right font-bold">Rp {(parseNumber(item.qty) * parseNumber(item.price)).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border-t border-slate-300 pt-2 space-y-1 text-[11px]">
                  <p className="text-emerald-700"><strong>DEBET  :</strong> {getAccName(printDoc.akunDebet)} ({printDoc.akunDebet})</p>
                  <p className="text-gray-700"><strong>KREDIT :</strong> {getAccName(printDoc.akunKredit)} ({printDoc.akunKredit})</p>
                </div>

                <div className="flex justify-between font-bold text-xs pt-1 border-t">
                  <span>TOTAL NOTA :</span>
                  <span className="text-amber-800">Rp {(printDoc.nominal || 0).toLocaleString('id-ID')}</span>
                </div>

                <p className="text-[11px] text-slate-700 italic leading-relaxed">
                  Terbilang : "{printDoc.terbilang || terbilang(printDoc.nominal)}"
                </p>

                <div className="flex justify-end pt-4 text-center text-[11px] border-t border-slate-300">
                  <div className="min-w-[150px]">
                    <div className="flex items-center justify-center gap-1">
                      <p className="font-bold">Hormat Saya / Rekanan</p>
                      <button
                        type="button"
                        onClick={() => setIsEditingDocHormatSaya(!isEditingDocHormatSaya)}
                        className="p-0.5 text-teal-600 hover:text-teal-800 no-print"
                        title="Edit Signature Hormat Saya / Rekanan (Khusus Cetak)"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                    {isEditingDocHormatSaya ? (
                      <div className="mt-4 flex items-center gap-1 justify-center">
                        <input
                          type="text"
                          value={printDoc.notaHormatSaya !== undefined ? printDoc.notaHormatSaya : ''}
                          onChange={(e) => setPrintDoc({ ...printDoc, notaHormatSaya: e.target.value })}
                          placeholder="Ketik nama / kosongkan"
                          className="bg-white border border-teal-500 rounded px-1.5 py-0.5 text-[9px] font-bold text-center w-32 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          onBlur={() => setIsEditingDocHormatSaya(false)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingDocHormatSaya(false); }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPrintDoc({ ...printDoc, notaHormatSaya: '' });
                            setIsEditingDocHormatSaya(false);
                          }}
                          className="px-1.5 py-0.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-[9px] font-bold whitespace-nowrap"
                          title="Kosongkan untuk tulis tangan"
                        >
                          Kosongkan
                        </button>
                      </div>
                    ) : (
                      <p className="mt-8 font-bold underline uppercase">
                        {displayRekanan(printDoc.notaHormatSaya)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* PREVIEW KWITANSI */
              <div className="p-4 space-y-4 font-mono text-xs text-slate-900 border-2 border-slate-800 rounded-lg bg-emerald-50/30">
                {/* Notice */}
                <div className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200 rounded-lg text-[10px] text-teal-800 font-medium no-print">
                  <span>💡</span>
                  <span>Formulir Cetak Kwitansi: Pengubahan Telah Terima Dari & Penerima hanya untuk cetak kwitansi (tidak tersimpan ke data Jurnal).</span>
                </div>

                <div className="flex justify-between items-start border-b border-slate-400 pb-3">
                  <div>
                    <h4 className="font-bold uppercase text-[15px]">{profile.namaDesa}</h4>
                    <p className="text-[10px] text-slate-500">{profile.alamat}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-teal-700 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase rounded">
                      KWITANSI
                    </span>
                    <p className="text-[10px] mt-1 font-bold">No: {printDoc.id}</p>
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <p><strong>TANGGAL :</strong> {formatDate(printDoc.tanggal)}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong>TELAH TERIMA DARI :</strong>
                    {isEditingDocTelahTerima ? (
                      <input
                        type="text"
                        value={printDoc.kwitansiTelahTerima !== undefined ? printDoc.kwitansiTelahTerima : ''}
                        onChange={(e) => setPrintDoc({ ...printDoc, kwitansiTelahTerima: e.target.value })}
                        className="bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        onBlur={() => setIsEditingDocTelahTerima(false)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingDocTelahTerima(false); }}
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold underline text-slate-900">
                        {printDoc.kwitansiTelahTerima || 'Juru Raksa Desa Adat'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingDocTelahTerima(!isEditingDocTelahTerima)}
                      className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition no-print inline-flex items-center gap-1"
                      title="Edit Telah Terima Dari (Khusus Cetak)"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                  <p><strong>URAIAN :</strong> {printDoc.uraian}</p>
                  <p><strong>TERBILANG :</strong> <span className="italic font-bold">"{printDoc.terbilang || terbilang(printDoc.nominal)}"</span></p>
                </div>

                <div className="bg-emerald-100/80 p-2.5 rounded border border-emerald-300 flex justify-between items-center text-xs font-bold">
                  <span>JUMLAH:</span>
                  <span className="text-sm text-emerald-950 font-black">Rp {(printDoc.nominal || 0).toLocaleString('id-ID')}</span>
                </div>

                <div className="grid grid-cols-3 pt-4 text-center text-[9px] border-t border-slate-300 gap-1">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-bold">Keliang Adat</p>
                    <p className="mt-8 font-bold underline uppercase">{keliangName}</p>
                  </div>
                  <div>
                    <p></p>
                    <p className="font-bold"></p>
                    <p className="mt-8 font-bold underline uppercase"></p>
                  </div>
                  <div>
                    <p>Basangalas, {formatDate(printDoc.tanggal)}</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className="font-bold">Juru Raksa</p>
                      <button
                        type="button"
                        onClick={() => setIsEditingDocPenerima(!isEditingDocPenerima)}
                        className="p-0.5 text-teal-600 hover:text-teal-800 no-print"
                        title="Edit Nama Penerima (Khusus Cetak)"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                    {isEditingDocPenerima ? (
                      <div className="mt-4 flex items-center gap-1 justify-center">
                        <input
                          type="text"
                          value={printDoc.kwitansiPenerima !== undefined ? printDoc.kwitansiPenerima : ''}
                          onChange={(e) => setPrintDoc({ ...printDoc, kwitansiPenerima: e.target.value })}
                          placeholder="Ketik nama / kosongkan"
                          className="bg-white border border-teal-500 rounded px-1.5 py-0.5 text-[9px] font-bold text-center w-32 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          onBlur={() => setIsEditingDocPenerima(false)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingDocPenerima(false); }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPrintDoc({ ...printDoc, kwitansiPenerima: '' });
                            setIsEditingDocPenerima(false);
                          }}
                          className="px-1.5 py-0.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded text-[9px] font-bold whitespace-nowrap"
                          title="Kosongkan untuk tulis tangan"
                        >
                          Kosongkan
                        </button>
                      </div>
                    ) : (
                      <p className="mt-8 font-bold underline uppercase">
                        {displayPenerima(printDoc.kwitansiPenerima)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2 no-print">
              <button
                onClick={() => setPrintDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => setShowA5PreviewModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Pratinjau visual layout kertas A5"
              >
                <Eye className="w-3.5 h-3.5" /> Pratinjau A5
              </button>
              <button
                onClick={() => handlePrintNota(printDoc)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Nota
              </button>
              <button
                onClick={() => handlePrintKwitansi(printDoc)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                title="Cetak Kwitansi dalam format A5 Landscape"
              >
                <Printer className="w-3.5 h-3.5" /> Kwitansi (A5 Landscape)
              </button>
              <button
                onClick={() => triggerWAForDoc(printDoc)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1"
                title="Kirim WA"
              >
                <Share2 className="w-3.5 h-3.5" /> WA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU CETAK DOKUMEN DALAM LAYOUT A5 */}
      {showA5PreviewModal && printDoc && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print"
          onClick={() => setShowA5PreviewModal(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[96vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-800/90 border-b border-slate-700 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Pratinjau Cetak Dokumen
                    <span className="bg-teal-900/60 text-teal-300 border border-teal-500/40 text-[10px] px-2 py-0.5 rounded-full font-mono font-normal">
                      {docTab === 'kwitansi' ? 'Layout Kertas A5 Landscape (210 × 148 mm)' : 'Layout Kertas A5 Portrait (148 × 210 mm)'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Validasi tata letak visual sebelum pencetakan ke printer fisik atau simpan PDF
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Doc Type Selector */}
                <div className="bg-slate-950 p-0.5 rounded-lg flex border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setDocTab('nota')}
                    className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      docTab === 'nota'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📄 Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocTab('kwitansi')}
                    className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      docTab === 'kwitansi'
                        ? 'bg-teal-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🧾 Kwitansi3
                  </button>
                </div>

                {/* Margin Guide Toggle */}
                <button
                  type="button"
                  onClick={() => setShowMarginGuide(!showMarginGuide)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                    showMarginGuide
                      ? 'bg-slate-700 border-slate-500 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tampilkan / sembunyikan garis batas aman margin printer (4-5 mm)"
                >
                  Garis Margin
                </button>

                {/* Zoom Toggle */}
                <button
                  type="button"
                  onClick={() => setA5PreviewZoom(a5PreviewZoom === 'fit' ? '100%' : 'fit')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                  title={a5PreviewZoom === 'fit' ? 'Zoom ke 100%' : 'Sesuaikan ke layar'}
                >
                  <Maximize2 size={15} />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowA5PreviewModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition ml-1 cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            <div className="bg-emerald-950/40 border-b border-emerald-800/50 px-5 py-2 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>
                  <strong>Tata letak valid:</strong> Seluruh teks, tabel, dan tanda tangan pas dalam 1 halaman kertas {docTab === 'kwitansi' ? 'A5 Landscape' : 'A5 Portrait'}.
                </span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400/80 hidden sm:block">
                ID Transaksi: <span className="font-bold text-white">{printDoc.id}</span> • Total: <span className="font-bold text-white">Rp {(printDoc.nominal || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Canvas Area with Simulated A5 Sheet */}
            <div className="flex-1 bg-slate-950 p-4 sm:p-6 overflow-y-auto max-h-[70vh] flex justify-center items-start">
              {/* The Simulated A5 Paper */}
              <div 
                className={`bg-white text-black shadow-[0_15px_40px_rgba(0,0,0,0.6)] rounded-xs relative transition-all duration-200 border border-slate-400 font-serif select-text ${
                  docTab === 'kwitansi'
                    ? (a5PreviewZoom === 'fit' ? 'w-full max-w-[620px]' : 'w-[680px]')
                    : (a5PreviewZoom === 'fit' ? 'w-full max-w-[440px]' : 'w-[480px]')
                }`}
                style={{
                  minHeight: docTab === 'kwitansi' ? '430px' : '620px',
                  padding: '4mm 6mm',
                  boxSizing: 'border-box'
                }}
              >
                {/* Paper Ruler / Watermark Indicator on top */}
                <div className="absolute top-1 right-2 text-[8px] font-mono text-slate-400 pointer-events-none select-none">
                  {docTab === 'kwitansi' ? 'KERTAS A5 LANDSCAPE • 210 × 148 mm' : 'KERTAS A5 PORTRAIT • 148 × 210 mm'}
                </div>

                {/* Simulated Margin Guidelines */}
                {showMarginGuide && (
                  <div 
                    className="absolute inset-[3mm_4mm] border border-dashed border-teal-500/30 pointer-events-none select-none rounded-[1px]" 
                    title="Garis batas aman cetak (4mm/5mm)"
                  />
                )}

                {/* CONTENT: NOTA BELANJA */}
                {docTab === 'nota' && (
                  <div className="text-black space-y-2">
                    {/* Header Desa */}
                    <div className="text-center border-b border-black pb-1.5 mb-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider">{profile.namaDesa}</h3>
                      <p className="text-[9px] text-gray-700">{profile.alamat}</p>
                      <h4 className="text-xs font-bold uppercase mt-1 tracking-wider border-t border-b border-black py-0.5 inline-block px-4">
                        NOTA BELANJA / TRANSAKSI
                      </h4>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 text-[9.5px] mb-2 gap-1.5 border-b border-black pb-1.5 leading-snug">
                      <div>
                        <p><strong>No. Nota / ID:</strong> {printDoc.id || '-'}</p>
                        <p><strong>Tanggal:</strong> {formatDate(printDoc.tanggal)}</p>
                        <p><strong>Kepada / Rekanan:</strong> {printDoc.notaKepada || 'Desa Adat Basangalas'}</p>
                      </div>
                      <div className="text-right">
                        <p><strong>Akun Debet:</strong> {printDoc.akunDebet || '-'} ({getAccName(printDoc.akunDebet || '')})</p>
                        <p><strong>Akun Kredit:</strong> {printDoc.akunKredit || '-'} ({getAccName(printDoc.akunKredit || '')})</p>
                      </div>
                    </div>

                    {/* Uraian */}
                    <div className="mb-2">
                      <p className="text-[9.5px] font-bold mb-0.5">Uraian / Keterangan Transaksi:</p>
                      <p className="text-[9.5px] italic bg-gray-50 p-1.5 border border-black leading-snug">{printDoc.uraian || '-'}</p>
                    </div>

                    {/* Table Items */}
                    {printDoc.items && printDoc.items.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[9.5px] font-bold mb-0.5">Rincian Barang / Jasa:</p>
                        <table className="w-full text-[9px] border-collapse border border-black">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black font-bold">
                              <th className="border border-black py-0.5 px-1 text-center w-6">No</th>
                              <th className="border border-black py-0.5 px-1.5 text-left">Nama Barang / Jasa</th>
                              <th className="border border-black py-0.5 px-1 text-center w-10">Qty</th>
                              <th className="border border-black py-0.5 px-1.5 text-right w-20">Harga Satuan</th>
                              <th className="border border-black py-0.5 px-1.5 text-right w-24">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {printDoc.items.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="border border-black py-0.5 px-1 text-center">{idx + 1}</td>
                                <td className="border border-black py-0.5 px-1.5">{item.name || item.itemName || 'Barang/Jasa'}</td>
                                <td className="border border-black py-0.5 px-1 text-center">{item.qty}</td>
                                <td className="border border-black py-0.5 px-1.5 text-right">Rp {(parseNumber(item.price)).toLocaleString('id-ID')}</td>
                                <td className="border border-black py-0.5 px-1.5 text-right font-bold">Rp {(parseNumber(item.qty) * parseNumber(item.price)).toLocaleString('id-ID')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Total */}
                    <div className="border border-black py-1 px-2 mb-2 flex justify-between items-center text-[10px] font-bold">
                      <span>TOTAL TRANSAKSI:</span>
                      <span className="text-xs font-mono font-bold">Rp {(printDoc.nominal || 0).toLocaleString('id-ID')}</span>
                    </div>

                    {/* Terbilang */}
                    <div className="mb-2 text-[9px] italic leading-snug">
                      <strong>Terbilang:</strong> "{printDoc.terbilang || terbilang(printDoc.nominal)}"
                    </div>

                    {/* Signature */}
                    <div className="flex justify-between items-end text-center text-[9.5px] mt-3 pt-2 border-t border-dashed border-black">
                      <div className="h-16 border border-slate-300 rounded-lg p-2 text-left text-[8px] text-gray-600 italic wrap items-center">
                        <p>Dokumen sah yang dikeluarkan oleh Juru Raksa Desa Adat.</p>
                      </div>
                      <div className="min-w-[150px]">
                        <p className="font-bold">Hormat Saya / Rekanan,</p>
                        <div className="h-9"></div>
                        <p className="font-bold underline uppercase">
                          {displayRekanan(printDoc.notaHormatSaya)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTENT: KWITANSI (A5 LANDSCAPE) */}
                {docTab === 'kwitansi' && (
                  <div className="kwitansi-border border-2 border-double border-black p-3.5 text-black">
                    <div className="flex justify-between items-start border-b border-black pb-1.5 mb-2">
                      <div>
                        <h3 className="text-base font-bold uppercase tracking-wider">{profile.namaDesa}</h3>
                        <p className="text-[9.5px] text-gray-700">{profile.alamat}</p>
                      </div>
                      <div className="text-right">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-black border border-black px-2.5 py-0.5 inline-block">
                          KWITANSI
                        </h4>
                        <p className="text-[10px] font-mono font-bold mt-0.5">No: {printDoc.id || '-'}</p>
                      </div>
                    </div>

                    <table className="w-full text-[10px] space-y-1 mb-2">
                      <tbody>
                        <tr>
                          <td className="w-36 font-bold py-0.5">Telah Terima Dari</td>
                          <td className="w-3 text-center">:</td>
                          <td className="py-0.5 font-semibold border-b border-dotted border-black">
                            {printDoc.kwitansiTelahTerima || 'Juru Raksa Desa Adat'}
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold py-0.5">Uraian / Untuk</td>
                          <td className="text-center">:</td>
                          <td className="py-0.5 border-b border-dotted border-black">{printDoc.uraian || '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-bold py-0.5">Terbilang</td>
                          <td className="text-center">:</td>
                          <td className="py-0.5 italic font-semibold border-b border-dotted border-black">
                            "{printDoc.terbilang || terbilang(printDoc.nominal)}"
                          </td>
                        </tr>
                        <tr>
                          <td className="font-bold py-0.5">Pos Rekening</td>
                          <td className="text-center">:</td>
                          <td className="py-0.5 border-b border-dotted border-black">
                            Debet: {printDoc.akunDebet || '-'} ({getAccName(printDoc.akunDebet || '')}) | Kredit: {printDoc.akunKredit || '-'} ({getAccName(printDoc.akunKredit || '')})
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="my-2 flex justify-between items-center bg-gray-50 p-2 border border-black">
                      <span className="font-bold text-[10px] uppercase tracking-wider">Jumlah Pembayaran:</span>
                      <span className="font-black text-sm font-mono">
                        Rp {(printDoc.nominal || 0).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 text-center text-[10px] mt-2.5">
                      <div>
                        <p>Mengetahui,</p>
                        <p className="font-bold">Keliang Adat</p>
                        <div className="h-8"></div>
                        <p className="font-bold underline uppercase">{keliangName}</p>
                      </div>
                      <div>
                        <p></p>
                        <p className="font-bold"></p>
                        <div className="h-8"></div>
                        <p className="font-bold underline uppercase"></p>
                      </div>
                      <div>
                        <p>{customPlace}, {formatDate(printDoc.tanggal || signatureDate)}</p>
                        <p className="font-bold">Penerima</p>
                        <div className="h-8"></div>
                        <p className="font-bold underline uppercase">
                          {displayPenerima(printDoc.kwitansiPenerima)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-800/95 border-t border-slate-700 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  {docTab === 'kwitansi' 
                    ? 'Layout siap cetak di kertas A5 Landscape (210mm × 148mm, margin 4mm × 6mm).' 
                    : 'Layout siap cetak di kertas A5 Portrait (148mm × 210mm, margin 4mm × 5mm).'}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowA5PreviewModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Tutup Pratinjau
                </button>
                {docTab === 'nota' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowA5PreviewModal(false);
                      handlePrintNota(printDoc);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg cursor-pointer active:scale-95"
                  >
                    <Printer size={15} /> Cetak Nota Sekarang (A5)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowA5PreviewModal(false);
                      handlePrintKwitansi(printDoc);
                    }}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-lg cursor-pointer active:scale-95"
                  >
                    <Printer size={15} /> Cetak Kwitansi Sekarang (A5 Landscape)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT JURNAL MODAL */}
      {showEditModal && editingEntry && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 my-auto overflow-y-auto"
          onClick={() => {
            setShowEditModal(false);
            setEditingEntry(null);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-[92vh] max-h-[95vh] rounded-2xl shadow-2xl p-6 sm:p-8 relative text-slate-800 dark:text-slate-200 flex flex-col justify-between overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200 dark:border-slate-800 shrink-0">
              <h3 className="text-xl font-bold uppercase tracking-wider font-mono text-emerald-500 flex items-center gap-2">
                <span>📝</span> Edit Jurnal Umum
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEntry(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenEditVerification} className="flex-1 overflow-y-auto py-4 space-y-5 pr-1.5 custom-scrollbar">
              {/* Tanggal & Pihak Ketiga */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 ml-1 tracking-widest">Tanggal Setoran</label>
                    <div className="relative">
                        <input type="date" value={editTanggal} onChange={e => setEditTanggal(e.target.value)} 
                        className="w-full bg-white border border-gray-300 rounded-xl px-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-sm shadow-sm" required />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs">
                      <span className="text-slate-700 font-bold text-[11px]">
                        No. ID Transaksi:
                      </span>
                      <span className="font-mono font-black text-teal-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300 shadow-2xs text-[11px] tracking-wide">
                        {editingEntry.idTransaksi}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                  <label className="block text-[10px] uppercase font-black text-gray-500 mb-1 ml-1 tracking-widest">Dari / Kepada (Pihak Ketiga)</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={editDariKepada}
                      onChange={(e) => {
                        setEditDariKepada(e.target.value);
                        setShowEditPihakKetigaSug(true);
                      }}
                      onFocus={(e) => {
                        e.target.select();
                        setShowEditPihakKetigaSug(true);
                      }}
                      onBlur={() => setTimeout(() => setShowEditPihakKetigaSug(false), 200)}
                      placeholder="Masukkan Nama/Toko/dsb"
                      className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-10 py-2.5 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-sm shadow-sm" required 
                    />
                    {editDariKepada && (
                      <button
                        type="button"
                        onClick={() => setEditDariKepada('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        title="Reset / Hapus"
                      >
                        <X size={16} />
                      </button>
                    )}
                    {showEditPihakKetigaSug && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-[280px] overflow-y-auto z-[70] animate-fade-in">
                        {existingPihakKetiga
                          .filter((p) => {
                            const query = (editDariKepada === 'Masukkan Nama/Toko/dsb' ? '' : editDariKepada).toLowerCase();
                            return !query || p.toLowerCase().includes(query);
                          })
                          .map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onMouseDown={() => {
                                setEditDariKepada(p);
                                setShowEditPihakKetigaSug(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-amber-500/10 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-800 dark:text-slate-200 font-medium"
                            >
                              👤 {p}
                            </button>
                          ))
                        }
                        {existingPihakKetiga.filter((p) => {
                          const query = (editDariKepada === 'Masukkan Nama/Toko/dsb' ? '' : editDariKepada).toLowerCase();
                          return !query || p.toLowerCase().includes(query);
                        }).length === 0 && (
                          <div className="p-3 text-xs text-slate-400 italic">Nama pihak baru</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                  <KodeRekeningAutocomplete
                    id="edit-akun-debet"
                    value={editAkunDebet}
                    label="AKUN DEBET (MEMASUKKAN)"
                    side="debet"
                    placeholder="Ketik kode atau nama rekening debet..."
                    budgetItems={budgetItems}
                    counterpartCode={editAkunKredit}
                    cashBalances={cashAccountBalances}
                    required
                    onChange={(code) => {
                      const cleanCode = (code || '').split(' - ')[0].trim();
                      const cleanKredit = (editAkunKredit || '').split(' - ')[0].trim();

                      if (cleanKredit === '1.1.2.05' && cleanCode !== '5.3.2.01' && !cleanCode.startsWith('5.3.2.01')) {
                        setNotification({
                          message: '⚠️ Perhatian: Saat kredit adalah Kas Dana Kematian (1.1.2.05), akun debet wajib dan hanya boleh Dana Kematian (5.3.2.01).',
                          type: 'warning'
                        });
                        setEditAkunDebet('5.3.2.01');
                        const debetMatch = REFERENSI_REKENING.find(r => r.code === '5.3.2.01');
                        setEditAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : '5.3.2.01 - Dana Kematian');
                        return;
                      }

                      setEditAkunDebet(code);
                      const match = REFERENSI_REKENING.find(r => r.code === code);
                      setEditAkunDebetSearch(match ? `${match.code} - ${match.name}` : code);
                      if (code && editAkunKredit) {
                        setValidationModalContext('edit');
                        setShowAccountValidationModal(true);
                      }
                    }}
                  />

                  {/* Indikator Otomatis jika Edit Kredit adalah Kas Dana Kematian 1.1.2.05 */}
                  {(editAkunKredit?.split(' - ')[0].trim() === '1.1.2.05') && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs text-purple-900 dark:text-purple-200 animate-in fade-in">
                      <Sparkles size={12} className="text-purple-600 shrink-0" />
                      <span className="text-[11px] font-medium">
                        Kredit Kas Dana Kematian (1.1.2.05) aktif ➔ Otomatis Debet <strong>5.3.2.01 - Dana Kematian</strong>
                      </span>
                    </div>
                  )}

                  {/* Rekomendasi Akun Debet jika Edit Akun Kredit 4.1.3.01 atau 4.1.3.02 */}
                  <RekomendasiAkunDebet
                    idPrefix="edit-debet"
                    kreditCode={editAkunKredit}
                    selectedDebetCode={editAkunDebet}
                    cashBalances={cashAccountBalances}
                    onSelectDebet={(code, name) => {
                      setEditAkunDebet(code);
                      setEditAkunDebetSearch(`${code} - ${name}`);
                    }}
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                  <KodeRekeningAutocomplete
                    id="edit-akun-kredit"
                    value={editAkunKredit}
                    label="AKUN KREDIT (MENGELUARKAN)"
                    side="kredit"
                    placeholder="Ketik kode atau nama rekening kredit..."
                    budgetItems={budgetItems}
                    counterpartCode={editAkunDebet}
                    cashBalances={cashAccountBalances}
                    required
                    onChange={(code) => {
                      const cleanCode = (code || '').split(' - ')[0].trim();
                      setEditAkunKredit(code);
                      const match = REFERENSI_REKENING.find(r => r.code === code);
                      setEditAkunKreditSearch(match ? `${match.code} - ${match.name}` : code);

                      // Otomatisasi: Jika edit kredit adalah Kas Dana Kematian (1.1.2.05), debet otomatis diisi 5.3.2.01 (Dana Kematian)
                      if (cleanCode === '1.1.2.05') {
                        setEditAkunDebet('5.3.2.01');
                        const debetMatch = REFERENSI_REKENING.find(r => r.code === '5.3.2.01');
                        setEditAkunDebetSearch(debetMatch ? `${debetMatch.code} - ${debetMatch.name}` : '5.3.2.01 - Dana Kematian');
                      }

                      if (code && (cleanCode === '1.1.2.05' || editAkunDebet)) {
                        setValidationModalContext('edit');
                        setShowAccountValidationModal(true);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Status Alur Akun Jurnal & Validasi Langsung (Edit Modal) */}
              {editAkunDebet && editAkunKredit && (
                <div className="p-3 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-2xl flex items-center justify-between gap-3 text-xs flex-wrap">
                  <div className="flex items-center gap-2 text-teal-950 dark:text-teal-200 font-bold min-w-0">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
                    <span className="truncate">
                      Alur Jurnal: <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-teal-200">{editAkunDebet.split(' - ')[0]}</span> (Debet) ➔ <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-teal-200">{editAkunKredit.split(' - ')[0]}</span> (Kredit)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setValidationModalContext('edit');
                        setShowAccountValidationModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-[11px] transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                      title="Periksa diagram alur dan kaidah akuntansi akun yang dipilih"
                    >
                      <BookOpen size={13} />
                      <span>Validasi Alur Akun</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValidationModalContext('edit');
                        handleSwapModalAccounts();
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold rounded-xl text-[11px] transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                      title="Tukar posisi Debet dan Kredit"
                    >
                      <ArrowRight size={13} className="rotate-180" />
                      <span>Tukar</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Uraian Transaksi & Nominal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[12px] uppercase font-bold text-slate-500">Uraian Transaksi</label>
                      <span className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1">
                        <span>💡 Klik untuk banyak pilihan</span>
                      </span>
                    </div>
                    <UraianDropdownInput
                      id="input-uraian-modal-edit"
                      value={editUraian}
                      onChange={setEditUraian}
                      akunDebet={editAkunDebet}
                      akunKredit={editAkunKredit}
                      existingUraians={existingUraians}
                      placeholder="Masukkan atau pilih uraian transaksi..."
                      required
                    />
                </div>
                <div className="bg-emerald-100 p-4 rounded-2xl border border-emerald-200 shadow-md relative overflow-hidden flex flex-col justify-center">
                  <label className="block text-[10px] font-black text-emerald-600 uppercase mb-2 ml-1 tracking-widest">Nominal Uang ( Rp )</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editNominal || ''}
                      onChange={(e) => setEditNominal(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full bg-white border border-emerald-300 rounded-xl pl-16 pr-12 py-3 text-emerald-700 font-black focus:ring-4 focus:ring-emerald-500/10 outline-none text-3xl sm:text-4xl shadow-inner" 
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700 font-black text-2xl sm:text-3xl">Rp.</div>
                    {editNominal > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditNominal(0)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-full hover:bg-emerald-200/60 transition-colors"
                        title="Reset Nominal"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                  {editNominal > 0 && (
                    <p className="mt-2 text-[13px] text-gray-900 font-medium italic">
                      Terbilang: {terbilang(editNominal)}
                    </p>
                  )}
                </div>  
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEntry(null);
                  }}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
                >
                  Verifikasi Dokumen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDeletingId(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-xl shadow-2xl p-6 relative text-slate-800 dark:text-slate-200 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-red-500 mb-2 flex items-center gap-2">
              <span>⚠️</span> Konfirmasi Hapus Jurnal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus jurnal transaksi ini? Tindakan ini bersifat permanen dan akan mempengaruhi Buku Besar, BKU, serta laporan keuangan lainnya.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {showImportModal && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (isImporting) return;
            setShowImportModal(false);
            setImportFile(null);
            setParsedImportRows([]);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl p-6 relative text-slate-800 dark:text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (isImporting) return;
                setShowImportModal(false);
                setImportFile(null);
                setParsedImportRows([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:opacity-50"
              disabled={isImporting}
            >
              ✕
            </button>

            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-blue-500 mb-2 flex items-center gap-2">
              <span>📥</span> Import Jurnal Umum via Excel
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Unggah file Excel untuk memasukkan data transaksi secara massal ke dalam sistem Jurnal Umum.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800/80 rounded-lg p-4 mb-5 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-800 dark:text-white block mb-1">Panduan Format File Excel:</span>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] leading-relaxed">
                <li>
                  Anda dapat menggunakan template dari file hasil <strong>Eksport Excel</strong> di halaman ini. Lembar kerja yang akan dibaca adalah sheet bernama <strong>&quot;Jurnal Ringkasan&quot;</strong> (atau sheet pertama bila tidak ditemukan).
                </li>
                <li>
                  Kolom wajib yang harus ada di file Excel:
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5 font-mono text-[10px] bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-850">
                    <div>📅 Tanggal (YYYY-MM-DD)</div>
                    <div>👤 Pihak (Dari/Kepada)</div>
                    <div>🟢 Kode Akun Debet</div>
                    <div>🔴 Kode Akun Kredit</div>
                    <div>📝 Keterangan / Uraian</div>
                    <div>💰 Nominal (Rp)</div>
                  </div>
                </li>
                <li>Pastikan Kode Akun Debet dan Kredit yang dimasukkan sesuai dengan referensi akun yang sah di sistem.</li>
              </ul>
            </div>

            {/* Drag & Drop File Selector */}
            {!importFile ? (
              <div 
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/20"
                onClick={() => document.getElementById('excel-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                    processImportFile(file);
                  } else {
                    alert('Harap unggah file Excel (.xlsx atau .xls)');
                  }
                }}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3 animate-pulse" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tarik & Lepas file Excel di sini, atau <span className="text-blue-500 hover:underline">Pilih dari Komputer</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Hanya mendukung format .xlsx dan .xls</p>
                <input 
                  id="excel-file-input"
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-bold font-mono">{importFile.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Total baris yang terbaca: {parsedImportRows.length} baris</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setParsedImportRows([]);
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-red-500 uppercase tracking-wider"
                    disabled={isImporting}
                  >
                    Ganti File
                  </button>
                </div>

                {/* Rows Preview */}
                {parsedImportRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">Pratinjau Data Transaksi</span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-600">✓ {parsedImportRows.filter(r => !r.error).length} Siap</span>
                        <span className="text-red-500">✗ {parsedImportRows.filter(r => r.error).length} Bermasalah</span>
                      </div>
                    </div>

                    <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                            <th className="p-2 font-mono text-center">No. Baris</th>
                            <th className="p-2">Tanggal</th>
                            <th className="p-2">Pihak</th>
                            <th className="p-2 font-mono">Debet</th>
                            <th className="p-2 font-mono">Kredit</th>
                            <th className="p-2">Keterangan / Uraian</th>
                            <th className="p-2 text-right">Nominal (Rp)</th>
                            <th className="p-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-700 dark:text-slate-300 font-mono">
                          {parsedImportRows.map((row, idx) => (
                            <tr key={idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/20 ${row.error ? 'bg-red-500/5' : ''}`}>
                              <td className="p-2 text-center text-slate-400">{row.index}</td>
                              <td className="p-2 font-sans">{row.tanggal}</td>
                              <td className="p-2 font-sans truncate max-w-[120px]">{row.dariKepada}</td>
                              <td className="p-2">
                                <span className={row.error?.includes('Debet') ? 'text-red-500' : 'text-emerald-600'}>
                                  {row.akunDebet || '-'}
                                </span>
                              </td>
                              <td className="p-2">
                                <span className={row.error?.includes('Kredit') ? 'text-red-500' : 'text-red-500/80'}>
                                  {row.akunKredit || '-'}
                                </span>
                              </td>
                              <td className="p-2 font-sans truncate max-w-[200px]">{row.uraian}</td>
                              <td className="p-2 text-right font-bold text-slate-950 dark:text-white">
                                Rp {row.nominal.toLocaleString('id-ID')}
                              </td>
                              <td className="p-2 text-center font-sans">
                                {row.error ? (
                                  <span className="px-2 py-0.5 rounded text-[9px] bg-red-500/10 text-red-500 font-bold" title={row.error}>
                                    EROR: {row.error}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-600 font-bold">
                                    SIAP
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Importing Progress */}
                {isImporting && (
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sedang mengimport data transaksi...
                      </span>
                      <span>{importProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setParsedImportRows([]);
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs"
                    disabled={isImporting}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/10 disabled:opacity-50"
                    disabled={isImporting || parsedImportRows.filter(r => !r.error).length === 0}
                  >
                    {isImporting ? 'Memproses...' : `Import ${parsedImportRows.filter(r => !r.error).length} Transaksi`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL REKAPAN & PELUNASAN HUTANG */}
      <DebtRecapModal
        isOpen={showDebtRecapModal}
        onClose={() => setShowDebtRecapModal(false)}
        debts={debtSummary.debts}
        totalSisaHutang={debtSummary.totalSisaHutang}
        totalPenambahanHutang={debtSummary.totalPenambahanHutang}
        totalPelunasanHutang={debtSummary.totalPelunasanHutang}
        onSelectPayDebt={handleSelectPayDebt}
      />

      {/* POPUP VALIDASI PASANGAN AKUN DEBET & KREDIT */}
      <AccountPairValidationModal
        isOpen={showAccountValidationModal}
        onClose={() => setShowAccountValidationModal(false)}
        akunDebet={validationModalContext === 'new' ? akunDebet : editAkunDebet}
        akunKredit={validationModalContext === 'new' ? (akunKredit || (activePayingDebt ? '1.1.1.01' : '')) : editAkunKredit}
        onSwapAccounts={handleSwapModalAccounts}
        onConfirm={() => setShowAccountValidationModal(false)}
      />

      {/* MODAL HAPUS TRANSAKSI MASSAL (BULK DELETE) */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={() => !isBulkProcessing && setShowBulkDeleteModal(false)}
        title="Konfirmasi Hapus Transaksi Sekaligus"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div className="text-xs text-rose-800 leading-relaxed">
              <p className="font-bold mb-1">Peringatan: Tindakan ini tidak dapat dibatalkan!</p>
              <p>
                Anda akan menghapus <span className="font-bold underline">{selectedTxIds.size} transaksi</span> sekaligus.
                Semua catatan jurnal, mutasi Buku Kas Umum (BKU), dan Buku Kas Pembantu (BKP) terkait transaksi terpilih akan dibersihkan secara permanen.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-200/60">
            <div className="flex justify-between items-center pb-1 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
              <span>Daftar Transaksi ({selectedTransactionsList.length})</span>
              <span>Nominal</span>
            </div>
            {selectedTransactionsList.map((tx) => (
              <div key={tx.idTransaksi} className="pt-1.5 flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800">
                    <span className="text-teal-700">{tx.idTransaksi}</span>
                    <span className="text-slate-400 font-normal">| {formatDate(tx.date)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">{tx.uraian}</div>
                </div>
                <div className="font-mono font-bold text-slate-900 shrink-0 text-[11px]">
                  {formatCurrency(tx.nominal)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded-xl text-xs font-bold">
            <span className="text-slate-700">Total Nilai yang Dihapus:</span>
            <span className="font-mono text-rose-700 text-sm">Rp {formatCurrency(selectedTotalAmount)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowBulkDeleteModal(false)}
              disabled={isBulkProcessing}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExecuteBulkDelete}
              disabled={isBulkProcessing}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isBulkProcessing ? (
                <>
                  <Spinner size={14} />
                  <span>Menghapus {selectedTxIds.size} Transaksi...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Hapus {selectedTxIds.size} Transaksi Sekaligus</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL EDIT AKUN MASSAL (BULK EDIT ACCOUNTS) */}
      <Modal
        isOpen={showBulkEditModal}
        onClose={() => !isBulkProcessing && setShowBulkEditModal(false)}
        title="Edit Akun Debet / Kredit Sekaligus"
        className="max-w-xl"
      >
        <form onSubmit={handleExecuteBulkEditAccounts} className="space-y-4">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3">
            <Pencil className="text-sky-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-sky-900 leading-relaxed">
              <p className="font-bold mb-0.5">Edit Rekening untuk {selectedTxIds.size} Transaksi Terpilih</p>
              <p>
                Pilih apakah ingin mengubah <span className="font-semibold">Akun Debet</span>, <span className="font-semibold">Akun Kredit</span>, atau keduanya. 
                Nominal transaksi, tanggal, dan uraian masing-masing transaksi tetap dipertahankan. BKU dan BKP akan otomatis diperbarui dan disesuaikan.
              </p>
            </div>
          </div>

          {/* Opsi Ubah Akun Debet */}
          <div className={`p-3.5 rounded-2xl border transition-all ${isBulkChangeDebet ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-slate-50 border-slate-200'}`}>
            <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
              <input
                type="checkbox"
                checked={isBulkChangeDebet}
                onChange={(e) => {
                  setIsBulkChangeDebet(e.target.checked);
                  if (!e.target.checked) setBulkAkunDebet('');
                }}
                className="w-4 h-4 rounded text-emerald-600 border-slate-400 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-black uppercase text-emerald-900">Ubah Akun Debet (Penerimaan / Penambahan)</span>
            </label>

            {isBulkChangeDebet && (
              <div className="pt-1.5 animate-fade-in">
                <KodeRekeningAutocomplete
                  id="bulk-akun-debet"
                  value={bulkAkunDebet}
                  label="Pilih Akun Debet Baru"
                  side="debet"
                  placeholder="Ketik kode atau nama rekening debet..."
                  budgetItems={budgetItems}
                  counterpartCode={isBulkChangeKredit ? bulkAkunKredit : undefined}
                  cashBalances={cashAccountBalances}
                  required={isBulkChangeDebet}
                  onChange={(code) => setBulkAkunDebet(code)}
                />
              </div>
            )}
          </div>

          {/* Opsi Ubah Akun Kredit */}
          <div className={`p-3.5 rounded-2xl border transition-all ${isBulkChangeKredit ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/20' : 'bg-slate-50 border-slate-200'}`}>
            <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
              <input
                type="checkbox"
                checked={isBulkChangeKredit}
                onChange={(e) => {
                  setIsBulkChangeKredit(e.target.checked);
                  if (!e.target.checked) setBulkAkunKredit('');
                }}
                className="w-4 h-4 rounded text-rose-600 border-slate-400 focus:ring-rose-500 accent-rose-600 cursor-pointer"
              />
              <span className="text-xs font-black uppercase text-rose-900">Ubah Akun Kredit (Pengeluaran / Sumber Dana)</span>
            </label>

            {isBulkChangeKredit && (
              <div className="pt-1.5 animate-fade-in">
                <KodeRekeningAutocomplete
                  id="bulk-akun-kredit"
                  value={bulkAkunKredit}
                  label="Pilih Akun Kredit Baru"
                  side="kredit"
                  placeholder="Ketik kode atau nama rekening kredit..."
                  budgetItems={budgetItems}
                  counterpartCode={isBulkChangeDebet ? bulkAkunDebet : undefined}
                  cashBalances={cashAccountBalances}
                  required={isBulkChangeKredit}
                  onChange={(code) => setBulkAkunKredit(code)}
                />
              </div>
            )}
          </div>

          {/* Preview Ringkasan Transaksi yang akan Diubah */}
          <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-3 text-xs max-h-36 overflow-y-auto space-y-1">
            <div className="text-slate-500 font-bold text-[11px] uppercase tracking-wider mb-1">
              Transaksi Terpilih ({selectedTransactionsList.length})
            </div>
            {selectedTransactionsList.map((tx) => (
              <div key={tx.idTransaksi} className="flex justify-between items-center text-[11px] py-0.5 border-b border-slate-200/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-teal-700">{tx.idTransaksi}</span>
                  <span className="text-slate-600 truncate">{tx.uraian}</span>
                </div>
                <div className="font-mono text-slate-700 shrink-0 ml-2">
                  {formatCurrency(tx.nominal)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowBulkEditModal(false)}
              disabled={isBulkProcessing}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isBulkProcessing || (!isBulkChangeDebet && !isBulkChangeKredit)}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isBulkProcessing ? (
                <>
                  <Spinner size={14} />
                  <span>Memperbarui {selectedTxIds.size} Transaksi...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Simpan Perubahan Akun ({selectedTxIds.size})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default JurnalUmum;
