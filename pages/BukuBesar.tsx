
import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { JuDisplayRow, BkuData, BkpData, BudgetItem } from '../types';
import { formatCurrency, formatDate, numberToWords } from '../utils/formatter';
import { Search, Trash2, ArrowDownLeft, ArrowUpRight, Download, BookOpen, Printer, User, Filter, FileSpreadsheet, Scale, Settings, Database, Calendar, X, FileText, Info, ChevronDown, Check, Sparkles, FileSignature, Stamp } from 'lucide-react';
import Notification from '../components/shared/Notification';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/shared/Modal';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { REFERENSI_REKENING } from '../constants';
import { ExportPdfButton } from '../components/shared/ExportPdfButton';
import { ReportSignatureBlock } from '../components/shared/ReportSignatureBlock';
import { 
    isAutoEmbedSignaturesEnabled, 
    isStampOverlayEnabled, 
    saveSignatureSettings, 
    setStampOverlayEnabled 
} from '../utils/signatureStorage';

declare const XLSX: any;

interface BukuBesarProps {
    entries: JuDisplayRow[];
    bkuData: BkuData[];
    bkpData: BkpData[];
    budgetItems: BudgetItem[];
    onSubmit: (formData: Omit<BkuData, 'id' | 'saldo'>, id?: string) => void;
    onBkpSubmit: (formData: Omit<BkpData, 'id' | 'saldo'>) => void;
    onDelete: (id: string) => void;
    onReplaceBku: (data: BkuData[]) => void;
}

const BukuBesar: React.FC<BukuBesarProps> = ({ entries, bkuData, bkpData, budgetItems, onSubmit, onBkpSubmit, onDelete, onReplaceBku }) => {
    const { showPermissionDenied } = useNotification();
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [selectedTarget, setSelectedTarget] = useState<string>(''); 
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFilename, setExportFilename] = useState('');
    
    // Account dropdown & search state
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [accountSearchQuery, setAccountSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const accountDropdownRef = useRef<HTMLDivElement>(null);
    const accountSearchInputRef = useRef<HTMLInputElement>(null);

    // Third party / Target dropdown & search state
    const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
    const [targetSearchQuery, setTargetSearchQuery] = useState('');
    const targetDropdownRef = useRef<HTMLDivElement>(null);
    const targetSearchInputRef = useRef<HTMLInputElement>(null);

    // Signature State
    const [keliangName, setKeliangName] = useState(() => localStorage.getItem('bb_keliangName') || 'I Made Mudita');
    const [juruRaksaName, setJuruRaksaName] = useState(() => localStorage.getItem('bb_juruRaksaName') || 'I Putu Gede Sutrana');
    const [signatureDate, setSignatureDate] = useState(() => localStorage.getItem('bb_signatureDate') || new Date().toISOString().split('T')[0]);
    const [customPlace, setCustomPlace] = useState(() => localStorage.getItem('bb_customPlace') || 'Basangalas');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Digital Signatures & Stamp Automation State
    const [autoEmbedSignatures, setAutoEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
    const [showStampOverlay, setShowStampOverlay] = useState<boolean>(() => isStampOverlayEnabled());
    const [tempAutoEmbed, setTempAutoEmbed] = useState<boolean>(autoEmbedSignatures);
    const [tempShowStamp, setTempShowStamp] = useState<boolean>(showStampOverlay);

    useEffect(() => {
        const syncSigs = () => {
            const embed = isAutoEmbedSignaturesEnabled();
            const stamp = isStampOverlayEnabled();
            setAutoEmbedSignatures(embed);
            setShowStampOverlay(stamp);
            setTempAutoEmbed(embed);
            setTempShowStamp(stamp);
        };
        syncSigs();
        window.addEventListener('signatures-updated', syncSigs);
        return () => window.removeEventListener('signatures-updated', syncSigs);
    }, []);

    // Close dropdowns on outside click or Escape key
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
                setIsAccountDropdownOpen(false);
            }
            if (targetDropdownRef.current && !targetDropdownRef.current.contains(event.target as Node)) {
                setIsTargetDropdownOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsAccountDropdownOpen(false);
                setIsTargetDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Autofocus inputs when dropdowns open
    useEffect(() => {
        if (isAccountDropdownOpen) {
            setTimeout(() => {
                accountSearchInputRef.current?.focus();
            }, 50);
        }
    }, [isAccountDropdownOpen]);

    useEffect(() => {
        if (isTargetDropdownOpen) {
            setTimeout(() => {
                targetSearchInputRef.current?.focus();
            }, 50);
        }
    }, [isTargetDropdownOpen]);

    const [tempKeliangName, setTempKeliangName] = useState(keliangName);
    const [tempJuruRaksaName, setTempJuruRaksaName] = useState(juruRaksaName);
    const [tempCustomPlace, setTempCustomPlace] = useState(customPlace);
    const [tempSignatureDate, setTempSignatureDate] = useState(signatureDate);
    const [isConfirmSaveSettingsOpen, setIsConfirmSaveSettingsOpen] = useState(false);

    const handleOpenSettings = () => {
        setTempKeliangName(keliangName);
        setTempJuruRaksaName(juruRaksaName);
        setTempCustomPlace(customPlace);
        setTempSignatureDate(signatureDate);
        setTempAutoEmbed(isAutoEmbedSignaturesEnabled());
        setTempShowStamp(isStampOverlayEnabled());
        setIsSettingsOpen(true);
    };

    const handleRequestSaveSettings = () => {
        setIsConfirmSaveSettingsOpen(true);
    };

    const handleConfirmSaveSettings = () => {
        setKeliangName(tempKeliangName);
        setJuruRaksaName(tempJuruRaksaName);
        setCustomPlace(tempCustomPlace);
        setSignatureDate(tempSignatureDate);

        localStorage.setItem('bb_keliangName', tempKeliangName);
        localStorage.setItem('bb_juruRaksaName', tempJuruRaksaName);
        localStorage.setItem('bb_customPlace', tempCustomPlace);
        localStorage.setItem('bb_signatureDate', tempSignatureDate);

        // Simpan status otomatisasi tanda tangan digital & stempel resmi
        saveSignatureSettings({ autoEmbed: tempAutoEmbed });
        setStampOverlayEnabled(tempShowStamp);
        setAutoEmbedSignatures(tempAutoEmbed);
        setShowStampOverlay(tempShowStamp);
        window.dispatchEvent(new Event('signatures-updated'));

        setIsConfirmSaveSettingsOpen(false);
        setIsSettingsOpen(false);
        setNotification({ message: 'Pengaturan tanda tangan & stempel Buku Besar berhasil disimpan!', type: 'success' });
    };

    const parseRowData = (uraian: string) => {
        let target = '-';
        if (uraian.includes(' dari ')) target = uraian.split(' dari ')[1] || '-';
        else if (uraian.includes(' kepada ')) target = uraian.split(' kepada ')[1] || '-';
        return { target: target.trim() };
    };

    const availableCodes = useMemo(() => {
        const map = new Map<string, string>();
        REFERENSI_REKENING.forEach(ref => map.set(ref.code, ref.name));
        bkuData.forEach(b => { if (b.kode && !map.has(b.kode)) map.set(b.kode, 'Kode Historis BKU'); });
        budgetItems.forEach(b => { if (b.kode && !map.has(b.kode)) map.set(b.kode, b.uraian || b.keterangan || 'Pos Anggaran'); });
        entries.forEach(e => { if (e.kodeRekening && !map.has(e.kodeRekening)) map.set(e.kodeRekening, 'Kode Transaksi'); });
        return Array.from(map.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [bkuData, budgetItems, entries]);

    const accountTransactionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(e => {
            if (e.kodeRekening) {
                counts[e.kodeRekening] = (counts[e.kodeRekening] || 0) + 1;
            }
        });
        return counts;
    }, [entries]);

    const getAccountGroupName = (code: string) => {
        if (code.startsWith('1.1.1')) return 'Kas & Bank';
        if (code.startsWith('1.')) return 'Aset & Piutang';
        if (code.startsWith('2.')) return 'Kewajiban / Utang';
        if (code.startsWith('3.')) return 'Ekuitas';
        if (code.startsWith('4.')) return 'Pendapatan / Punia';
        if (code.startsWith('5.1.1')) return 'Belanja Bebantenan';
        if (code.startsWith('5.1.2')) return 'Belanja Operasional';
        if (code.startsWith('5.1.3')) return 'Belanja Lain-Lain';
        if (code.startsWith('5.2')) return 'Belanja Konsumsi';
        if (code.startsWith('5.3')) return 'Belanja Caru & Pitik';
        if (code.startsWith('5.4')) return 'Belanja Wewalungan';
        if (code.startsWith('5.')) return 'Belanja & Beban';
        if (code.startsWith('6.')) return 'Pembiayaan / SILPA';
        if (code.startsWith('7.')) return 'Sumber Dana & Urunan';
        return 'Akun Keuangan';
    };

    const categoryFilters = [
        { id: 'all', label: 'Semua Akun' },
        { id: 'active', label: '⚡ Ada Transaksi' },
        { id: '1', label: '1. Kas/Aset' },
        { id: '2', label: '2. Utang' },
        { id: '3', label: '3. Ekuitas' },
        { id: '4', label: '4. Pendapatan' },
        { id: '5', label: '5. Belanja' },
        { id: '7', label: '7. Sumber Dana' },
    ];

    const filteredAccountOptions = useMemo(() => {
        let list = availableCodes.map(item => ({
            ...item,
            groupName: getAccountGroupName(item.code),
            txCount: accountTransactionCounts[item.code] || 0,
        }));

        // Category filter
        if (selectedCategoryFilter === 'active') {
            list = list.filter(item => item.txCount > 0);
        } else if (selectedCategoryFilter !== 'all') {
            list = list.filter(item => item.code.startsWith(selectedCategoryFilter + '.'));
        }

        // Search query filter
        const query = accountSearchQuery.trim().toLowerCase();
        if (query) {
            list = list.filter(item => 
                item.code.toLowerCase().includes(query) ||
                item.name.toLowerCase().includes(query) ||
                item.groupName.toLowerCase().includes(query)
            );
        }

        return list;
    }, [availableCodes, accountSearchQuery, selectedCategoryFilter, accountTransactionCounts]);

    const availableTargets = useMemo(() => {
        const targets = new Set<string>();
        entries.forEach(item => {
            const { target } = parseRowData(item.uraian);
            if (target && target !== '-' && target.trim().length > 1) targets.add(target.trim());
        });
        return Array.from(targets).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [entries]);

    const targetTransactionCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(item => {
            const { target } = parseRowData(item.uraian);
            if (target && target !== '-' && target.trim().length > 1) {
                const clean = target.trim();
                counts[clean] = (counts[clean] || 0) + 1;
            }
        });
        return counts;
    }, [entries]);

    const filteredTargetOptions = useMemo(() => {
        const query = targetSearchQuery.trim().toLowerCase();
        let list = availableTargets.map(name => ({
            name,
            txCount: targetTransactionCounts[name] || 0
        }));

        if (query) {
            list = list.filter(item => item.name.toLowerCase().includes(query));
        }

        return list;
    }, [availableTargets, targetSearchQuery, targetTransactionCounts]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        years.add(new Date().getFullYear().toString());
        entries.forEach(e => {
            if (e.date) {
                const year = e.date.split('-')[0];
                if (year) years.add(year);
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

    const selectedAccountName = useMemo(() => {
        if (!selectedAccount) return '';
        return availableCodes.find(c => c.code === selectedAccount)?.name || '';
    }, [selectedAccount, availableCodes]);

    // Enhanced Saldo Pindahan Logic
    const { saldoPindahan, pindahanLabel } = useMemo(() => {
        if (!selectedAccount || !selectedYear) return { saldoPindahan: 0, pindahanLabel: '' };
        
        let cutoffDate = "";
        let label = "";

        if (selectedMonth) {
            cutoffDate = `${selectedYear}-${selectedMonth}-01`;
            label = "SALDO BULAN LALU";
        } else {
            cutoffDate = `${selectedYear}-01-01`;
            label = "SALDO AKHIR TAHUN SEBELUMNYA";
        }
        
        const previousEntries = entries.filter(e => 
            e.kodeRekening === selectedAccount && 
            e.date && e.date < cutoffDate
        );

        const firstDigit = selectedAccount.charAt(0);
        const isCreditNormal = ['2', '3', '4'].includes(firstDigit);
        
        const saldo = previousEntries.reduce((sum, row) => {
            if (isCreditNormal) return sum + (row.kredit - row.debet);
            return sum + (row.debet - row.kredit);
        }, 0);

        return { saldoPindahan: saldo, pindahanLabel: label };
    }, [entries, selectedAccount, selectedMonth, selectedYear]);

    const ledgerData = useMemo(() => {
        if (!selectedAccount && !selectedTarget) return [];
        let filtered: JuDisplayRow[] = [];

        filtered = entries.filter(e => {
            const entryYear = e.date?.split('-')[0];
            const entryMonth = e.date?.split('-')[1];
            
            const matchYear = !selectedYear || entryYear === selectedYear;
            const matchMonth = !selectedMonth || entryMonth === selectedMonth;
            
            if (selectedAccount) {
                return e.kodeRekening === selectedAccount && matchYear && matchMonth;
            } else if (selectedTarget) {
                const { target } = parseRowData(e.uraian);
                return target.toLowerCase() === selectedTarget.toLowerCase() && matchYear && matchMonth;
            }
            return false;
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        const firstDigit = selectedAccount ? selectedAccount.charAt(0) : '0'; 
        const isCreditNormal = ['2', '3', '4'].includes(firstDigit);
        
        let runningBalance = selectedYear ? saldoPindahan : 0;
        
        return filtered.map(row => {
            if (isCreditNormal) runningBalance += (row.kredit - row.debet);
            else runningBalance += (row.debet - row.kredit);
            return { ...row, saldo: runningBalance };
        });
    }, [entries, selectedAccount, selectedTarget, selectedMonth, selectedYear, saldoPindahan]);

    const displayLedgerData = useMemo(() => {
        if (!ledgerSearchTerm) return ledgerData;
        return ledgerData.filter(row => 
            row.uraian.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
            (row.idTransaksi && row.idTransaksi.toLowerCase().includes(ledgerSearchTerm.toLowerCase()))
        );
    }, [ledgerData, ledgerSearchTerm]);

    const totalDisplayDebet = useMemo(() => displayLedgerData.reduce((s, r) => s + (r.debet || 0), 0), [displayLedgerData]);
    const totalDisplayKredit = useMemo(() => displayLedgerData.reduce((s, r) => s + (r.kredit || 0), 0), [displayLedgerData]);

    const handlePrint = () => { window.print(); };

    const processExportData = () => {
      if (typeof XLSX === 'undefined') return;
      let fileName = exportFilename.trim() || `Buku Besar - ${selectedAccount || selectedTarget}`;
      if (!fileName.endsWith('.xlsx')) fileName += '.xlsx';
      
      const rows = displayLedgerData.map(item => ({
          Tanggal: item.date, ID: item.idTransaksi, Uraian: item.uraian,
          Debet: item.debet, Kredit: item.kredit, Saldo: (item as any).saldo
      }));

      if (selectedYear && saldoPindahan !== 0) {
          rows.unshift({
            Tanggal: '-', ID: '-', Uraian: pindahanLabel,
            Debet: 0, Kredit: 0, Saldo: saldoPindahan
          } as any);
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BukuBesar");
      XLSX.writeFile(wb, fileName);
      setNotification({ message: 'Buku Besar berhasil diekspor ke Excel.', type: 'success' });
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
        <div className="space-y-6">
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
                    body * { visibility: hidden; }
                    #printable-area, #printable-area * { visibility: visible; }
                    #printable-area { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100% !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: white !important; 
                        color: black !important; 
                        display: block !important; 
                        overflow: visible !important;
                    }
                    @page { size: portrait; margin: 15mm; }
                    .no-print { display: none !important; }
                    
                    table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        font-size: 10px !important; 
                        border: 1px solid black !important; 
                        table-layout: fixed; 
                        page-break-inside: auto;
                    }

                    tr { page-break-inside: avoid; page-break-after: auto; }
                    
                    th, td { 
                        border: 1px solid black !important; 
                        padding: 6px 4px !important; 
                        color: black !important; 
                        background: transparent !important; 
                        word-wrap: break-word;
                    }

                    th:nth-child(1), td:nth-child(1) { width: 14%; }
                    th:nth-child(2), td:nth-child(2) { width: 12%; font-size: 8px; }
                    th:nth-child(3), td:nth-child(3) { width: 34%; }
                    th:nth-child(4), td:nth-child(4) { width: 13%; }
                    th:nth-child(5), td:nth-child(5) { width: 13%; }
                    th:nth-child(6), td:nth-child(6) { width: 14%; }

                    thead th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; color: black !important; }
                    
                    tfoot { display: table-row-group !important; }
                    
                    .signature-section { display: flex !important; page-break-inside: avoid; }
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

            {/* Header & Controls */}
            <div className="bg-white text-gray-900 border-b-4 border-emerald-500 p-4 no-print my-6 relative print:border-none print:shadow-none print:bg-white print:rounded-none print:p-0 print:m-0">
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
                  <div className="absolute -right-0 -bottom-0 opacity-10 text-emerald-600 pointer-events-none">
                      <BookOpen size={100} />
                  </div>
              </div>
                <div className="justify-between items-start lg:items-center gap-4 no-print">
                    <div className="flex items-start gap-4">
                        <div className="p-3.5 bg-teal-500/20 rounded-2xl text-teal-700 shadow-md shrink-0 mt-1">
                            <BookOpen size={28} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 font-serif">
                                    Buku Besar &amp; Mutasi
                                </h2>
                                <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-300">
                                    General Ledger (Buku Akun)
                                </span>
                            </div>
                            <p className="text-emerald-700 text-sm font-medium">Filter berdasarkan rekening dan periode untuk audit mutasi.</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap items-center justify-end mt-2">
                        {/* Tombol Tanda Tangan & Status Automation */}
                        <div className="flex items-center gap-1.5">
                            <button onClick={handleOpenSettings} 
                                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-1.5 px-3 rounded-xl transition-all border border-gray-700 active:scale-95 text-xs shadow-xs" 
                                title="Atur Nama, Tanggal, & Otomatisasi Tanda Tangan/Stempel">
                                <Settings size={14} /><span>Tanda Tangan</span>
                            </button>
                            <div 
                                onClick={handleOpenSettings}
                                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 border border-gray-300 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-gray-200 transition-colors shadow-2xs select-none"
                                title="Status Otomatisasi Tanda Tangan & Stempel Buku Besar (Klik untuk mengubah)"
                            >
                                <span className={autoEmbedSignatures ? 'text-emerald-700' : 'text-gray-500'}>
                                    TTD: {autoEmbedSignatures ? 'ON' : 'OFF'}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className={showStampOverlay ? 'text-rose-700' : 'text-gray-500'}>
                                    Stempel: {showStampOverlay ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsExportModalOpen(true)} 
                        className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded-xl transition-all shadow-lg active:scale-95" title="Ekspor data ke Excel">
                            <Download size={15} /><span>Ekspor Excel</span>
                        </button>
                        {(selectedAccount || selectedTarget) && (
                            <>
                                <ExportPdfButton 
                                    elementId="printable-area" 
                                    filename={`Buku_Besar_${selectedAccount || selectedTarget}.pdf`} 
                                    buttonText="Ekspor PDF" 
                                    variant="default" 
                                    defaultOrientation="landscape" 
                                    showModal={true} 
                                />
                                <button onClick={handlePrint} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-1 px-2 rounded-xl transition-all shadow-lg active:scale-95" title="Cetak Buku Besar">
                                    <Printer size={18} />
                                    <span>Cetak Buku Besar</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Definisi */}
             <div className="mt-2 text-sm text-teal-700 w-full font-normal">
                 <p className="leading-snug">
                     <strong className="text-teal-950 font-bold">Definisi Buku Besar:</strong> Kumpulan akun individual untuk mengikhtisarkan seluruh mutasi Debet dan Kredit serta menghitung saldo akhir berjalan per kode rekening secara terinci pasca-pembukuan jurnal umum.
                 </p>
             </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-5 border-b-2 border-gray-500 pb-2 gap-3 bg-slate-white p-0 no-print">
                    <div className="space-y-1 relative" ref={accountDropdownRef}>
                        <label className="text-[11px] text-gray-500 font-black tracking-widest flex items-center gap-2 mb-1 pl-1">
                            <Scale size={12} className="text-teal-500" /> Pilih Rekening
                        </label>
                        
                        {/* Interactive Dropdown Trigger Box */}
                        <div 
                            id="ledger-acc-select-box"
                            onClick={() => {
                                setIsAccountDropdownOpen(prev => !prev);
                                setAccountSearchQuery('');
                            }}
                            className={`w-full bg-gray-100 border-2 ${isAccountDropdownOpen ? 'border-teal-600 ring-2 ring-teal-200 bg-white' : 'border-gray-500 hover:border-teal-600'} text-gray-900 rounded-xl px-3.5 py-1.5 flex items-center justify-between cursor-pointer transition-all select-none`}
                            title="Klik untuk membuka pilihan rekening"
                        >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                                <Scale size={15} className={selectedAccount ? "text-teal-600 shrink-0" : "text-gray-400 shrink-0"} />
                                {selectedAccount ? (
                                    <div className="truncate text-left leading-tight">
                                        <span className="font-mono font-bold text-xs bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded mr-1.5 border border-teal-300">
                                            {selectedAccount}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-800">
                                            {selectedAccountName || 'Rekening'}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500 font-medium truncate">Cari Rekening...</span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                                {selectedAccount && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAccount('');
                                            setAccountSearchQuery('');
                                        }}
                                        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Hapus pilihan rekening"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isAccountDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                            </div>
                        </div>

                        {/* Searchable Dropdown Popup */}
                        {isAccountDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1.5 w-[330px] sm:w-[420px] md:w-[460px] bg-white border-2 border-teal-600 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150">
                                {/* Search Header & Filter Tabs */}
                                <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-teal-600" />
                                        <input
                                            ref={accountSearchInputRef}
                                            type="text"
                                            value={accountSearchQuery}
                                            onChange={(e) => setAccountSearchQuery(e.target.value)}
                                            placeholder="Ketik kode (mis: 5.1.1) atau nama rekening..."
                                            className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl pl-9 pr-8 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none placeholder-slate-400 shadow-inner"
                                            autoFocus
                                        />
                                        {accountSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setAccountSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Category Filter Pills */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
                                        {categoryFilters.map(tab => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setSelectedCategoryFilter(tab.id)}
                                                className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
                                                    selectedCategoryFilter === tab.id
                                                        ? 'bg-teal-700 text-white shadow-xs'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Options List */}
                                <div className="max-h-[290px] overflow-y-auto divide-y divide-slate-100 p-1.5">
                                    {filteredAccountOptions.length > 0 ? (
                                        filteredAccountOptions.map((item) => {
                                            const isSelected = selectedAccount === item.code;
                                            return (
                                                <button
                                                    key={item.code}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedAccount(item.code);
                                                        setSelectedTarget('');
                                                        setIsAccountDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                                                        isSelected 
                                                            ? 'bg-teal-50 text-teal-950 font-medium' 
                                                            : 'hover:bg-slate-50 text-slate-800'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${
                                                            isSelected 
                                                                ? 'bg-teal-600 text-white border-teal-700' 
                                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                                        }`}>
                                                            {item.code}
                                                        </span>
                                                        <div className="truncate">
                                                            <p className="text-xs font-semibold truncate leading-tight">{item.name}</p>
                                                            <span className="text-[10px] text-slate-400 font-medium">{item.groupName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {item.txCount > 0 && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full border border-emerald-200" title={`${item.txCount} transaksi tercatat`}>
                                                                {item.txCount} Tx
                                                            </span>
                                                        )}
                                                        {isSelected && <Check size={16} className="text-teal-600 font-bold" />}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center px-4 text-slate-400 text-xs">
                                            <p className="font-semibold text-slate-600 mb-1">Rekening tidak ditemukan</p>
                                            <p className="text-[11px]">Coba cari dengan kode lain atau pilih tab "Semua Akun".</p>
                                        </div>
                                    )}
                                </div>

                                {/* Dropdown Footer */}
                                <div className="px-3 py-2 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                                    <span>{filteredAccountOptions.length} rekening ditemukan</span>
                                    {selectedAccount && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedAccount('');
                                                setIsAccountDropdownOpen(false);
                                            }}
                                            className="text-rose-600 hover:underline font-bold"
                                        >
                                            Reset Pilihan
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filter Tahun */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-black tracking-widest flex items-center gap-2 mb-1 pl-1">
                            <Calendar size={12} className="text-teal-500" /> Tahun</label>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full bg-gray-100 border-2 border-gray-500 text-gray-900 rounded-xl px-4 py-1 focus:ring-2 focus:ring-gray-300 focus:border-gray-600 outline-none text-sm"
                        >
                            <option value="">Semua Tahun</option>
                            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>
                    {/* Filter Bulan */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-black tracking-widest flex items-center gap-2 mb-1 pl-1">
                            <Calendar size={12} className="text-teal-500" /> Bulan</label>
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full bg-gray-100 border-2 border-gray-500 text-gray-900 rounded-xl px-4 py-1 focus:ring-2 focus:ring-gray-300 focus:border-gray-600 outline-none text-sm"
                        >
                            <option value="">Semua Bulan</option>
                            {monthsList.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                        </select>
                    </div>
                    {/* Filter Pihak Ketiga */}
                    <div className="space-y-1 relative" ref={targetDropdownRef}>
                        <label className="text-[11px] text-gray-500 font-black tracking-widest flex items-center gap-2 mb-1 pl-1">
                            <User size={12} className="text-teal-500" /> Filter Pihak Ketiga
                        </label>
                        
                        {/* Interactive Dropdown Trigger Box */}
                        <div 
                            id="ledger-target-select-box"
                            onClick={() => {
                                setIsTargetDropdownOpen(prev => !prev);
                                setTargetSearchQuery('');
                            }}
                            className={`w-full bg-gray-100 border-2 ${isTargetDropdownOpen ? 'border-teal-600 ring-2 ring-teal-200 bg-white' : 'border-gray-500 hover:border-teal-600'} text-gray-900 rounded-xl px-3.5 py-2 flex items-center justify-between cursor-pointer transition-all select-none`}
                            title="Klik untuk membuka pilihan pihak ketiga"
                        >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                                <User size={15} className={selectedTarget ? "text-teal-600 shrink-0" : "text-gray-400 shrink-0"} />
                                {selectedTarget ? (
                                    <div className="truncate text-left leading-tight">
                                        <span className="text-xs font-semibold text-slate-900 truncate">
                                            {selectedTarget}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500 font-medium truncate"> Cari Pihak Ketiga...</span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                                {selectedTarget && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTarget('');
                                            setTargetSearchQuery('');
                                        }}
                                        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Hapus filter pihak ketiga"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isTargetDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                            </div>
                        </div>

                        {/* Searchable Dropdown Popup */}
                        {isTargetDropdownOpen && (
                            <div className="absolute left-0 md:left-auto md:right-0 top-full mt-1.5 w-[300px] sm:w-[360px] md:w-[380px] bg-white border-2 border-teal-600 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150">
                                {/* Search Header */}
                                <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-teal-600" />
                                        <input
                                            ref={targetSearchInputRef}
                                            type="text"
                                            value={targetSearchQuery}
                                            onChange={(e) => setTargetSearchQuery(e.target.value)}
                                            placeholder="Ketik nama pihak ketiga..."
                                            className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl pl-9 pr-8 py-2 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none placeholder-slate-400 shadow-inner"
                                            autoFocus
                                        />
                                        {targetSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setTargetSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Options List */}
                                <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 p-1.5">
                                    {filteredTargetOptions.length > 0 ? (
                                        filteredTargetOptions.map((item) => {
                                            const isSelected = selectedTarget === item.name;
                                            return (
                                                <button
                                                    key={item.name}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedTarget(item.name);
                                                        setSelectedAccount('');
                                                        setIsTargetDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                                                        isSelected 
                                                            ? 'bg-teal-50 text-teal-950 font-medium' 
                                                            : 'hover:bg-slate-50 text-slate-800'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                                                            isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}>
                                                            {item.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-semibold truncate leading-tight">{item.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {item.txCount > 0 && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full border border-emerald-200" title={`${item.txCount} transaksi tercatat`}>
                                                                {item.txCount} Tx
                                                            </span>
                                                        )}
                                                        {isSelected && <Check size={16} className="text-teal-600 font-bold" />}
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center px-4 text-slate-400 text-xs">
                                            <p className="font-semibold text-slate-600 mb-1">Pihak ketiga tidak ditemukan</p>
                                            <p className="text-[11px]">Coba ketik kata kunci pencarian yang lain.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Dropdown Footer */}
                                <div className="px-3 py-2 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                                    <span>{filteredTargetOptions.length} pihak ketiga tersedia</span>
                                    {selectedTarget && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedTarget('');
                                                setIsTargetDropdownOpen(false);
                                            }}
                                            className="text-rose-600 hover:underline font-bold"
                                        >
                                            Reset Pilihan
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filter Uraian */}
                    <div className="space-y-1">
                        <label className="text-[11px] text-gray-500 font-black tracking-widest flex items-center gap-2 mb-1 pl-1">
                            <Search size={12} className="text-teal-500" /> Cari Transaksi</label>
                        <div className="relative">
                            <input type="text" placeholder="Cari uraian..." value={ledgerSearchTerm} onChange={(e) => setLedgerSearchTerm(e.target.value)} 
                            className="w-full bg-gray-100 border-2 border-gray-500 text-gray-900 rounded-xl px-4 py-1 pl-10 focus:ring-2 focus:ring-gray-300 focus:border-gray-600 outline-none text-sm placeholder-gray-400" />
                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>
                    </div>
            </div>


            {(selectedAccount || selectedTarget) ? (
                <div id="printable-area" className="bg-white p-1 space-y-2 no-print:border">
                    {/* Print Only Header */}
                    <div className="hidden print:block text-slate-900 mb-6">
                        <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                                DESA ADAT BASANGALAS
                            </h2>
                            <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
                                Tata Kelola Penatausahaan Keuangan Kas Desa Adat
                            </p>
                            <p className="text-xs font-semibold text-slate-700 font-serif m-0">
                                Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                            </p>
                        </div>
                        <div className="text-center mb-4">
                            <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                                BUKU BESAR & MUTASI
                            </h3>
                            <div className="flex justify-between items-end mt-2 text-xs font-mono font-semibold text-slate-800">
                                <span>Rekening: {selectedAccount ? `${selectedAccount} - ${selectedAccountName}` : `Pihak: ${selectedTarget}`}</span>
                                <span>Periode: {selectedMonth ? monthsList.find(m => m.val === selectedMonth)?.label : 'SELURUH'} {selectedYear || 'SEMUA TAHUN'}</span>
                            </div>
                        </div>
                    </div>   

                    {/* Summary Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-xl border border-gray-500 no-print">
                        <div>
                            <span className="text-[10px] text-gray-900 font-black uppercase tracking-widest block mb-1">Identitas Buku</span>
                            <p className="text-lg font-bold text-gray-700">{selectedAccount ? `${selectedAccount} - ${selectedAccountName}` : `Pihak: ${selectedTarget}`}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest block mb-1">Saldo Akhir Kumulatif</span>
                            <p className="text-2xl font-black text-teal-600 hover:text-gray-400 hover:text-3xl">{displayLedgerData.length > 0 ? formatCurrency(displayLedgerData[displayLedgerData.length - 1].saldo) : (selectedYear ? formatCurrency(saldoPindahan) : formatCurrency(0))}</p>
                        </div>
                    </div>

                    {/* Ledger Table */}
                    <div className="overflow-x-auto bg-white pt-4">
                        <table className="w-full text-sm text-left border border-gray-400">
                            <thead className="bg-slate-700 text-gray-100 uppercase text-[12px] font-black tracking-widest rounded-xl">
                                <tr>
                                    <th className="px-3 py-2">Tanggal</th>
                                    <th className="px-3 py-2">ID Transaksi</th>
                                    <th className="px-6 py-2">Uraian Transaksi</th>
                                    <th className="px-4 py-2 text-right">Debet</th>
                                    <th className="px-4 py-2 text-right">Kredit</th>
                                    <th className="px-4 py-2 text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-300">
                                {selectedYear && (
                                    <tr className="bg-gray-200 italic border-b border-teal-500">
                                        <td className="px-3 py-3 text-center">-</td>
                                        <td className="px-3 py-3 text-center">-</td>
                                        <td className="px-6 py-3 font-bold text-teal-400 uppercase text-[10px]">{pindahanLabel}</td>
                                        <td className="px-4 py-3 text-right">-</td>
                                        <td className="px-4 py-3 text-right">-</td>
                                        <td className="px-4 py-3 text-right font-black text-teal-400">{formatCurrency(saldoPindahan)}</td>
                                    </tr>
                                )}

                                {displayLedgerData.map((row, idx) => (
                                    <tr key={`${row.rowId}-${idx}`} className="hover:bg-slate-100 transition-colors align-top">
                                        <td className="px-3 py-2 whitespace-wrap text-gray-800 font-mono text-xs">{row.date ? formatDate(row.date) : '-'}</td>
                                        <td className="px-3 py-2 text-teal-500 font-bold text-[10px] break-all">{row.idTransaksi}</td>
                                        <td className="px-6 py-2 text-gray-900 leading-relaxed hover:text-emerald-500">{row.uraian}</td>
                                        <td className="px-4 py-2 text-right text-emerald-500 font-bold">{row.debet > 0 ? formatCurrency(row.debet) : '-'}</td>
                                        <td className="px-4 py-2 text-right text-rose-800 font-bold">{row.kredit > 0 ? formatCurrency(row.kredit) : '-'}</td>
                                        <td className="px-4 py-2 text-right font-black text-gray-900">{formatCurrency((row as any).saldo)}</td>
                                    </tr>
                                ))}

                                {displayLedgerData.length === 0 && (!selectedYear) && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic">Belum ada transaksi pada periode ini.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-300 text-gray-900 font-bold print:bg-slate-1000">
                                <tr className="border-t-2 border-gray-500">
                                    <td colSpan={3} className="px-6 py-4 uppercase text-[10px] font-black tracking-widest">Total Mutasi Periode Ini</td>
                                    <td className="px-4 py-4 text-right text-emerald-700">{formatCurrency(totalDisplayDebet)}</td>
                                    <td className="px-4 py-4 text-right text-rose-700">{formatCurrency(totalDisplayKredit)}</td>
                                    <td className="px-4 py-4 text-right font-black">
                                        {displayLedgerData.length > 0 ? formatCurrency(displayLedgerData[displayLedgerData.length - 1].saldo) : (selectedYear ? formatCurrency(saldoPindahan) : formatCurrency(0))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* LEMBAR PENGESAHAN TANDA TANGAN & STEMPEL BUKU BESAR */}
                    <div className="mt-8 pt-4 border-t-2 border-slate-300">
                        <ReportSignatureBlock
                            keliangName={keliangName}
                            juruRaksaName={juruRaksaName}
                            customPlace={customPlace}
                            signatureDate={signatureDate}
                            keliangTitle="Keliang Adat Basangalas"
                            keliangSubtitle="Penanggung Jawab Kebijakan"
                            juruRaksaTitle="Juru Raksa"
                            juruRaksaSubtitle="Pengelola &amp; Pembukuan Kas"
                            keliangActionText="Mengetahui,"
                            namaDesa="DESA ADAT BASANGALAS"
                        />
                    </div>
                    {/* Print Footer Layout */}
                    <div className="print-formal-footer hidden print:flex flex justify-between items-center mt-12 text-slate-900 border-t border-slate-400 pt-2">
                        <div>
                            <p className="font-semibold print:text-slate-400 print:text-[12px]">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                            <p className="text-[10px] text-slate-500 print:text-slate-400 print:text-[10px]">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                        </div>
                        <div className="text-right font-mono text-[8px] text-slate-500 print:text-slate-300">
                            <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-100 border-2 border-dashed border-gray-500 rounded-3xl no-print text-center px-6">
                    <div className="p-6 bg-teal-50 rounded-full mb-6"><Scale size={48} className="text-teal-400" /></div>
                    <h3 className="text-xl font-bold text-gray-500 mb-2">Buku Besar Akuntansi</h3>
                    <p className="text-gray-500 max-w-sm">Pilih kode rekening dan periode laporan untuk menampilkan ringkasan mutasi debet & kredit.</p>
                </div>
            )}

            {/* Formal Footer Layout */}
            <div className="flex justify-between items-center mt-8 text-slate-900 border-t-2 border-slate-400 pt-2 no-print">
                <div>
                    <p className="font-semibold">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                    <p className="text-[12px]">Transparansi dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                </div>
                <div className="text-right font-mono text-[9px] text-slate-600">
                    <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>


            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Pengaturan Tanda Tangan & Stempel Buku Besar" className="max-w-md">
                <div className="space-y-4">
                    {/* TOGGLE OTOMATISASI TANDA TANGAN & STEMPEL DIGITAL */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                        <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                            <FileSignature size={14} />
                            <span>Otomatisasi Tanda Tangan &amp; Stempel</span>
                        </div>

                        {/* Switch Tanda Tangan Digital */}
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-800 block">Sematkan Tanda Tangan Digital</span>
                                <span className="text-[10px] text-slate-500 block">Tampilkan TTD digital Keliang &amp; Juru Raksa</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={tempAutoEmbed}
                                    onChange={e => setTempAutoEmbed(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                        </div>

                        {/* Switch Stempel Resmi Desa */}
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/80">
                            <div>
                                <span className="text-xs font-bold text-slate-800 block">Tampilkan Stempel Resmi Desa</span>
                                <span className="text-[10px] text-slate-500 block">Cap stempel merah Desa Adat Basangalas</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={tempShowStamp}
                                    onChange={e => setTempShowStamp(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Tempat Laporan</label>
                        <input type="text" value={tempCustomPlace} onChange={e => setTempCustomPlace(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>  
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Tanggal Laporan (Tanda Tangan)</label>
                        <input type="date" value={tempSignatureDate} onChange={e => setTempSignatureDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Keliang Adat</label>
                        <input type="text" value={tempKeliangName} onChange={e => setTempKeliangName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2">Nama Juru Raksa</label>
                        <input type="text" value={tempJuruRaksaName} onChange={e => setTempJuruRaksaName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" />
                    </div>
                    <button onClick={handleRequestSaveSettings} className="w-full bg-teal-600 py-3 rounded-xl font-black text-white hover:bg-teal-500 transition-colors shadow-lg uppercase tracking-widest">Simpan Perubahan</button>
                </div>
            </Modal>

            <ConfirmationModal 
                isOpen={isConfirmSaveSettingsOpen} 
                onClose={() => setIsConfirmSaveSettingsOpen(false)} 
                onConfirm={handleConfirmSaveSettings} 
                title="Konfirmasi Perubahan Tanda Tangan" 
                message="Apakah Anda yakin ingin menyimpan perubahan pengaturan tanda tangan Buku Besar?" 
                confirmText="Ya, Simpan" 
                confirmColor="bg-teal-600" 
            />

            <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Buku Besar" className="max-w-md">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Nama File Excel</label>
                        <input type="text" value={exportFilename} onChange={(e) => setExportFilename(e.target.value)} className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Buku_Besar_PADA.xlsx" autoFocus />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsExportModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors text-xs">Batal</button>
                        <button onClick={processExportData} className="flex items-center gap-2 px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition-all text-xs"><Download size={16} /> DOWNLOAD</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default BukuBesar;
