import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Scale, 
  BookOpen,
  Calendar,
  Building2,
  Flame,
  Sparkles,
  Utensils,
  Package,
  Search,
  Briefcase,
  Layers,
  Store,
  RotateCcw} from 'lucide-react';
import type { JuDisplayRow } from '../../types';
import { formatCurrency } from '../../utils/formatter';
import { REFERENSI_REKENING } from '../../constants';

interface DebtSummaryCardProps {
  entries: JuDisplayRow[];
  selectedYear: number | 'all';
  setActivePage?: (page: string) => void;
}

export interface DebtCategorySummary {
  code: string;
  name: string;
  totalKredit: number; // Timbul Hutang
  totalDebet: number;  // Pelunasan Hutang
  sisaHutang: number;  // Saldo Sisa Hutang (Kredit - Debet)
  txCount: number;
  lastDate?: string;
  associatedDepts: string[];
  associatedCreditors: string[];
}

export interface DebtDepartmentSummary {
  id: string;
  name: string;
  iconType: 'upakara' | 'konsumsi' | 'caru' | 'wewalungan' | 'operasional' | 'palemahan' | 'umum';
  totalKredit: number;
  totalDebet: number;
  sisaHutang: number;
  txCount: number;
  lastDate?: string;
  accountCodes: string[];
  creditorNames: string[];
}

export interface CreditorEntitySummary {
  id: string;
  name: string;
  accountCode: string;
  accountName: string;
  departmentName: string;
  totalKredit: number;
  totalDebet: number;
  sisaHutang: number;
  txCount: number;
  lastDate?: string;
}

// Helper: Determine department from expense accounts, programs, or descriptions
function detectDepartment(
  debetCode?: string, 
  program?: string, 
  uraian?: string
): { id: string; name: string; iconType: DebtDepartmentSummary['iconType'] } {
  // 1. If explicit program is specified
  if (program && program.trim()) {
    const p = program.trim().toLowerCase();
    if (p.includes('parhyangan') || p.includes('upakara') || p.includes('banten')) {
      return { id: 'dept-upakara', name: 'Seksi Upakara & Parhyangan', iconType: 'upakara' };
    }
    if (p.includes('pawongan') || p.includes('konsumsi') || p.includes('dapur')) {
      return { id: 'dept-konsumsi', name: 'Seksi Pawongan & Dapur', iconType: 'konsumsi' };
    }
    if (p.includes('palemahan') || p.includes('pembangunan') || p.includes('sarana')) {
      return { id: 'dept-palemahan', name: 'Seksi Palemahan & Sarana', iconType: 'palemahan' };
    }
    if (p.includes('operasional') || p.includes('rutin')) {
      return { id: 'dept-operasional', name: 'Seksi Operasional & Sekretariat', iconType: 'operasional' };
    }
  }

  // 2. From paired expense account code
  if (debetCode) {
    const clean = debetCode.split(' - ')[0].trim();
    if (clean.startsWith('5.1.1')) return { id: 'dept-upakara', name: 'Seksi Upakara & Bebantenan', iconType: 'upakara' };
    if (clean.startsWith('5.1.2') || clean.startsWith('5.1.3')) return { id: 'dept-operasional', name: 'Seksi Operasional & Rekanan', iconType: 'operasional' };
    if (clean.startsWith('5.2')) return { id: 'dept-konsumsi', name: 'Seksi Dapur & Konsumsi', iconType: 'konsumsi' };
    if (clean.startsWith('5.3')) return { id: 'dept-caru', name: 'Seksi Caru & Wewalungan Suci', iconType: 'caru' };
    if (clean.startsWith('5.4')) return { id: 'dept-wewalungan', name: 'Seksi Wewalungan / Hewan', iconType: 'wewalungan' };
    if (clean.startsWith('5.')) return { id: 'dept-palemahan', name: 'Seksi Pengadaan & Sarana', iconType: 'palemahan' };
  }

  // 3. From text keyword analysis
  if (uraian) {
    const u = uraian.toLowerCase();
    if (u.includes('banten') || u.includes('jinah') || u.includes('sesari') || u.includes('kain') || u.includes('upakara')) {
      return { id: 'dept-upakara', name: 'Seksi Upakara & Bebantenan', iconType: 'upakara' };
    }
    if (u.includes('konsumsi') || u.includes('beras') || u.includes('dapur') || u.includes('makan') || u.includes('lauk') || u.includes('sayur') || u.includes('gas') || u.includes('mineral')) {
      return { id: 'dept-konsumsi', name: 'Seksi Dapur & Konsumsi', iconType: 'konsumsi' };
    }
    if (u.includes('caru') || u.includes('ayam caru') || u.includes('bebek') || u.includes('kambing') || u.includes('anjing') || u.includes('sampi')) {
      return { id: 'dept-caru', name: 'Seksi Caru & Wewalungan Suci', iconType: 'caru' };
    }
    if (u.includes('bawi') || u.includes('celeng') || u.includes('babi')) {
      return { id: 'dept-wewalungan', name: 'Seksi Wewalungan / Hewan', iconType: 'wewalungan' };
    }
    if (u.includes('listrik') || u.includes('bbm') || u.includes('internet') || u.includes('operasional') || u.includes('pajak') || u.includes('shuttle')) {
      return { id: 'dept-operasional', name: 'Seksi Operasional & Rekanan', iconType: 'operasional' };
    }
    if (u.includes('perlengkapan') || u.includes('alat') || u.includes('tenda') || u.includes('sound') || u.includes('pembangunan')) {
      return { id: 'dept-palemahan', name: 'Seksi Palemahan & Perlengkapan', iconType: 'palemahan' };
    }
  }

  return { id: 'dept-umum', name: 'Seksi Umum & Kepanitiaan', iconType: 'umum' };
}

// Helper: Extract creditor/supplier entity name from description or account name
function extractCreditorName(uraian: string, accountName: string): string {
  if (!uraian) return accountName;

  // Check pattern: "kepada [Entity Name]" or "dari [Entity Name]"
  const matchKepada = uraian.match(/(?:kepada|ke|rekanan|toko|ud\.|cv\.|pt\.|pak|jero|i\s+[a-z]+)\s+([^,;.]+)/i);
  if (matchKepada && matchKepada[1]?.trim()) {
    const raw = matchKepada[0].trim();
    // Clean up if it ends with noise
    return raw.replace(/^(kepada|ke|rekanan)\s+/i, '').trim();
  }

  // Fallback to Account Name (e.g. Utang Nota Belum Di Bayar -> Rekanan Nota Belum Dibayar)
  return accountName.replace(/^Utang\s+(di\s+)?/i, 'Kreditor ');
}

const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({
  entries,
  selectedYear,
  setActivePage
}) => {
  const [breakdownViewMode, setBreakdownViewMode] = useState<'account' | 'department' | 'creditor'>('account');
  const [statusFilter, setStatusFilter] = useState<'all' | 'outstanding' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'sisa-desc' | 'sisa-asc' | 'progress-asc' | 'name-asc' | 'timbul-desc'>('sisa-desc');
  
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [selectedFilterKey, setSelectedFilterKey] = useState<string>('all');

  // Filter entries according to selectedYear
  const filteredEntries = useMemo(() => {
    if (selectedYear === 'all') return entries;
    return entries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d.getFullYear() === selectedYear;
    });
  }, [entries, selectedYear]);

  // Index transactions by idTransaksi to find matching debet/kredit pairs
  const txGroupMap = useMemo(() => {
    const map = new Map<string, JuDisplayRow[]>();
    filteredEntries.forEach(row => {
      if (row.idTransaksi) {
        const arr = map.get(row.idTransaksi) || [];
        arr.push(row);
        map.set(row.idTransaksi, arr);
      }
    });
    return map;
  }, [filteredEntries]);

  // Filter only transactions marked under debt accounts (Akun 2.*)
  const debtEntries = useMemo(() => {
    return filteredEntries.filter(e => {
      const code = (e.kodeRekening || '').trim();
      return code.startsWith('2');
    }).sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredEntries]);

  // Aggregate debt metrics & breakdowns
  const {
    totalPenambahanHutang,
    totalPelunasanHutang,
    totalSisaHutang,
    tingkatPelunasan,
    categorySummaries,
    departmentSummaries,
    creditorSummaries
  } = useMemo(() => {
    let penambahan = 0;
    let pelunasan = 0;

    const catMap: Record<string, { 
      kredit: number; 
      debet: number; 
      count: number; 
      lastDate?: string;
      depts: Set<string>;
      creditors: Set<string>;
    }> = {};

    const deptMap: Record<string, {
      name: string;
      iconType: DebtDepartmentSummary['iconType'];
      kredit: number;
      debet: number;
      count: number;
      lastDate?: string;
      accounts: Set<string>;
      creditors: Set<string>;
    }> = {};

    const creditorMap: Record<string, {
      name: string;
      accountCode: string;
      accountName: string;
      deptName: string;
      kredit: number;
      debet: number;
      count: number;
      lastDate?: string;
    }> = {};

    debtEntries.forEach(e => {
      const code = (e.kodeRekening || '').trim();
      const debetVal = Number(e.debet) || 0;
      const kreditVal = Number(e.kredit) || 0;

      penambahan += kreditVal;
      pelunasan += debetVal;

      // Find counterpart rows in same transaction to detect Department and Creditor
      const siblings = e.idTransaksi ? (txGroupMap.get(e.idTransaksi) || []) : [];
      const pairedDebetRow = siblings.find(s => s.rowType === 'debet' && s.kodeRekening !== code);
      const debetAccountCode = pairedDebetRow ? pairedDebetRow.kodeRekening : undefined;
      const effectiveProgram = e.program || (pairedDebetRow ? pairedDebetRow.program : undefined);

      const deptInfo = detectDepartment(debetAccountCode, effectiveProgram, e.uraian);
      const matchCoa = REFERENSI_REKENING.find(r => r.code === code);
      const accountName = matchCoa ? matchCoa.name : 'Utang / Kewajiban Lainnya';
      const creditorName = extractCreditorName(e.uraian, accountName);

      // 1. Account Mapping
      if (!catMap[code]) {
        catMap[code] = { 
          kredit: 0, 
          debet: 0, 
          count: 0, 
          lastDate: e.date,
          depts: new Set<string>(),
          creditors: new Set<string>()
        };
      }
      catMap[code].kredit += kreditVal;
      catMap[code].debet += debetVal;
      catMap[code].count += 1;
      catMap[code].depts.add(deptInfo.name);
      catMap[code].creditors.add(creditorName);
      if (e.date && (!catMap[code].lastDate || e.date > catMap[code].lastDate!)) {
        catMap[code].lastDate = e.date;
      }

      // 2. Department Mapping
      if (!deptMap[deptInfo.id]) {
        deptMap[deptInfo.id] = {
          name: deptInfo.name,
          iconType: deptInfo.iconType,
          kredit: 0,
          debet: 0,
          count: 0,
          lastDate: e.date,
          accounts: new Set<string>(),
          creditors: new Set<string>()
        };
      }
      deptMap[deptInfo.id].kredit += kreditVal;
      deptMap[deptInfo.id].debet += debetVal;
      deptMap[deptInfo.id].count += 1;
      deptMap[deptInfo.id].accounts.add(code);
      deptMap[deptInfo.id].creditors.add(creditorName);
      if (e.date && (!deptMap[deptInfo.id].lastDate || e.date > deptMap[deptInfo.id].lastDate!)) {
        deptMap[deptInfo.id].lastDate = e.date;
      }

      // 3. Specific Creditor Entity Mapping
      const credKey = `${creditorName.toLowerCase()}__${code}`;
      if (!creditorMap[credKey]) {
        creditorMap[credKey] = {
          name: creditorName,
          accountCode: code,
          accountName,
          deptName: deptInfo.name,
          kredit: 0,
          debet: 0,
          count: 0,
          lastDate: e.date
        };
      }
      creditorMap[credKey].kredit += kreditVal;
      creditorMap[credKey].debet += debetVal;
      creditorMap[credKey].count += 1;
      if (e.date && (!creditorMap[credKey].lastDate || e.date > creditorMap[credKey].lastDate!)) {
        creditorMap[credKey].lastDate = e.date;
      }
    });

    // Transform into arrays
    const catSummaries: DebtCategorySummary[] = Object.keys(catMap).map(code => {
      const matchCoa = REFERENSI_REKENING.find(r => r.code === code);
      const name = matchCoa ? matchCoa.name : 'Utang / Kewajiban Lainnya';
      const itemKredit = catMap[code].kredit;
      const itemDebet = catMap[code].debet;
      const itemSisa = Math.max(0, itemKredit - itemDebet);

      return {
        code,
        name,
        totalKredit: itemKredit,
        totalDebet: itemDebet,
        sisaHutang: itemSisa,
        txCount: catMap[code].count,
        lastDate: catMap[code].lastDate,
        associatedDepts: Array.from(catMap[code].depts),
        associatedCreditors: Array.from(catMap[code].creditors)
      };
    });

    const deptSummaries: DebtDepartmentSummary[] = Object.keys(deptMap).map(id => {
      const d = deptMap[id];
      const itemSisa = Math.max(0, d.kredit - d.debet);
      return {
        id,
        name: d.name,
        iconType: d.iconType,
        totalKredit: d.kredit,
        totalDebet: d.debet,
        sisaHutang: itemSisa,
        txCount: d.count,
        lastDate: d.lastDate,
        accountCodes: Array.from(d.accounts),
        creditorNames: Array.from(d.creditors)
      };
    });

    const credSummaries: CreditorEntitySummary[] = Object.keys(creditorMap).map(id => {
      const c = creditorMap[id];
      const itemSisa = Math.max(0, c.kredit - c.debet);
      return {
        id,
        name: c.name,
        accountCode: c.accountCode,
        accountName: c.accountName,
        departmentName: c.deptName,
        totalKredit: c.kredit,
        totalDebet: c.debet,
        sisaHutang: itemSisa,
        txCount: c.count,
        lastDate: c.lastDate
      };
    });

    const sisa = Math.max(0, penambahan - pelunasan);
    const progress = penambahan > 0 ? Math.min(100, (pelunasan / penambahan) * 100) : 100;

    return {
      totalPenambahanHutang: penambahan,
      totalPelunasanHutang: pelunasan,
      totalSisaHutang: sisa,
      tingkatPelunasan: progress,
      categorySummaries: catSummaries,
      departmentSummaries: deptSummaries,
      creditorSummaries: credSummaries
    };
  }, [debtEntries, txGroupMap]);

  // Filtering & Sorting for Breakdown List
  const filteredAndSortedBreakdown = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (breakdownViewMode === 'account') {
      return categorySummaries
        .filter(item => {
          if (statusFilter === 'outstanding' && item.sisaHutang <= 0) return false;
          if (statusFilter === 'settled' && item.sisaHutang > 0) return false;
          if (q) {
            const matchesCode = item.code.toLowerCase().includes(q);
            const matchesName = item.name.toLowerCase().includes(q);
            const matchesDept = item.associatedDepts.some(d => d.toLowerCase().includes(q));
            const matchesCred = item.associatedCreditors.some(c => c.toLowerCase().includes(q));
            return matchesCode || matchesName || matchesDept || matchesCred;
          }
          return true;
        })
        .sort((a, b) => {
          if (sortBy === 'sisa-desc') return b.sisaHutang - a.sisaHutang || b.totalKredit - a.totalKredit;
          if (sortBy === 'sisa-asc') return a.sisaHutang - b.sisaHutang;
          if (sortBy === 'timbul-desc') return b.totalKredit - a.totalKredit;
          if (sortBy === 'progress-asc') {
            const progA = a.totalKredit > 0 ? (a.totalDebet / a.totalKredit) : 1;
            const progB = b.totalKredit > 0 ? (b.totalDebet / b.totalKredit) : 1;
            return progA - progB;
          }
          return a.name.localeCompare(b.name);
        });
    }

    if (breakdownViewMode === 'department') {
      return departmentSummaries
        .filter(item => {
          if (statusFilter === 'outstanding' && item.sisaHutang <= 0) return false;
          if (statusFilter === 'settled' && item.sisaHutang > 0) return false;
          if (q) {
            const matchesName = item.name.toLowerCase().includes(q);
            const matchesAcc = item.accountCodes.some(c => c.toLowerCase().includes(q));
            const matchesCred = item.creditorNames.some(c => c.toLowerCase().includes(q));
            return matchesName || matchesAcc || matchesCred;
          }
          return true;
        })
        .sort((a, b) => {
          if (sortBy === 'sisa-desc') return b.sisaHutang - a.sisaHutang || b.totalKredit - a.totalKredit;
          if (sortBy === 'sisa-asc') return a.sisaHutang - b.sisaHutang;
          if (sortBy === 'timbul-desc') return b.totalKredit - a.totalKredit;
          if (sortBy === 'progress-asc') {
            const progA = a.totalKredit > 0 ? (a.totalDebet / a.totalKredit) : 1;
            const progB = b.totalKredit > 0 ? (b.totalDebet / b.totalKredit) : 1;
            return progA - progB;
          }
          return a.name.localeCompare(b.name);
        });
    }

    // Breakdown view mode === 'creditor'
    return creditorSummaries
      .filter(item => {
        if (statusFilter === 'outstanding' && item.sisaHutang <= 0) return false;
        if (statusFilter === 'settled' && item.sisaHutang > 0) return false;
        if (q) {
          const matchesName = item.name.toLowerCase().includes(q);
          const matchesAcc = item.accountCode.toLowerCase().includes(q) || item.accountName.toLowerCase().includes(q);
          const matchesDept = item.departmentName.toLowerCase().includes(q);
          return matchesName || matchesAcc || matchesDept;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'sisa-desc') return b.sisaHutang - a.sisaHutang || b.totalKredit - a.totalKredit;
        if (sortBy === 'sisa-asc') return a.sisaHutang - b.sisaHutang;
        if (sortBy === 'timbul-desc') return b.totalKredit - a.totalKredit;
        if (sortBy === 'progress-asc') {
          const progA = a.totalKredit > 0 ? (a.totalDebet / a.totalKredit) : 1;
          const progB = b.totalKredit > 0 ? (b.totalDebet / b.totalKredit) : 1;
          return progA - progB;
        }
        return a.name.localeCompare(b.name);
      });
  }, [breakdownViewMode, categorySummaries, departmentSummaries, creditorSummaries, statusFilter, searchQuery, sortBy]);

  // Outstanding sum for the currently active breakdown view
  const currentViewOutstandingSubtotal = useMemo(() => {
    return filteredAndSortedBreakdown.reduce((sum: number, item: any) => sum + (item.sisaHutang || 0), 0);
  }, [filteredAndSortedBreakdown]);

  // Outstanding count in current active breakdown
  const currentViewOutstandingCount = useMemo(() => {
    return filteredAndSortedBreakdown.filter((item: any) => item.sisaHutang > 0).length;
  }, [filteredAndSortedBreakdown]);

  // Filtered transactions for the detail list
  const displayTransactions = useMemo(() => {
    if (selectedFilterKey === 'all') return debtEntries;
    
    return debtEntries.filter(e => {
      const code = (e.kodeRekening || '').trim();
      if (code === selectedFilterKey) return true;

      // Check if selected filter is a department ID
      if (selectedFilterKey.startsWith('dept-')) {
        const siblings = e.idTransaksi ? (txGroupMap.get(e.idTransaksi) || []) : [];
        const pairedDebetRow = siblings.find(s => s.rowType === 'debet' && s.kodeRekening !== code);
        const debetAccountCode = pairedDebetRow ? pairedDebetRow.kodeRekening : undefined;
        const effectiveProgram = e.program || (pairedDebetRow ? pairedDebetRow.program : undefined);
        const dept = detectDepartment(debetAccountCode, effectiveProgram, e.uraian);
        return dept.id === selectedFilterKey;
      }

      // Check if selected filter is a creditor key
      if (selectedFilterKey.includes('__')) {
        const matchCoa = REFERENSI_REKENING.find(r => r.code === code);
        const accountName = matchCoa ? matchCoa.name : 'Utang / Kewajiban Lainnya';
        const creditorName = extractCreditorName(e.uraian, accountName);
        const credKey = `${creditorName.toLowerCase()}__${code}`;
        return credKey === selectedFilterKey;
      }

      return false;
    });
  }, [debtEntries, selectedFilterKey, txGroupMap]);

  const hasDebt = totalSisaHutang > 0;

  const renderDepartmentIcon = (iconType: DebtDepartmentSummary['iconType']) => {
    switch (iconType) {
      case 'upakara': return <Sparkles size={16} className="text-amber-600" />;
      case 'konsumsi': return <Utensils size={16} className="text-emerald-600" />;
      case 'caru': return <Flame size={16} className="text-rose-600" />;
      case 'wewalungan': return <Package size={16} className="text-indigo-600" />;
      case 'operasional': return <Briefcase size={16} className="text-sky-600" />;
      case 'palemahan': return <Building2 size={16} className="text-teal-600" />;
      default: return <Layers size={16} className="text-purple-600" />;
    }
  };

  return (
    <div id="ringkasan-hutang-card" className="bg-white rounded-2xl border border-slate-400 p-6 shadow-xl relative overflow-hidden transition-all text-slate-900">
      {/* Decorative ambient background */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none no-print" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b-2 border-slate-400">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border shrink-0 ${
            hasDebt 
              ? 'bg-purple-50 border-purple-300 text-purple-700' 
              : 'bg-emerald-50 border-emerald-300 text-emerald-700'
          }`}>
            <Receipt size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                Ringkasan Hutang &amp; Kewajiban (Jurnal Umum)
              </h3>
              <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                hasDebt 
                  ? 'bg-purple-100 text-purple-900 border-purple-300' 
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}>
                {hasDebt ? `${categorySummaries.filter(c => c.sisaHutang > 0).length} Pos Belum Lunas` : 'Lunas Sempurna (Nihil)'}
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-0.5">
              Rincian sisa kewajiban berjalan berdasarkan pos akun kreditur, departemen/bidang pelaksana, dan entitas rekanan
            </p>
          </div>
        </div>

        {/* Quick Links & Year Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 border border-slate-300 px-3 py-1 rounded-lg">
            Periode: {selectedYear === 'all' ? 'Seluruh Tahun' : `Tahun ${selectedYear}`}
          </span>
          {setActivePage && (
            <button
              type="button"
              onClick={() => setActivePage('Jurnal Umum')}
              className="no-print flex items-center gap-1 text-xs font-bold text-purple-800 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-3 py-1 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Buka Jurnal Umum untuk melihat catatan transaksi hutang"
            >
              <BookOpen size={13} />
              <span>Buka Jurnal</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Total Sisa Hutang (Outstanding Debt) */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          hasDebt 
            ? 'bg-purple-50/70 border-purple-400 shadow-xs hover:border-slate-900' 
            : 'bg-slate-50 border-slate-400'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                <Receipt size={14} className="text-purple-700" /> Sisa Hutang Berjalan
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-400">
                Outstanding
              </span>
            </div>
            <p className={`text-2xl font-black font-mono tracking-tight my-1 ${
              hasDebt ? 'text-purple-950' : 'text-slate-800'
            }`}>
              {formatCurrency(totalSisaHutang)}
            </p>
            <p className="text-[11px] text-purple-900 mt-1 leading-tight">
              {hasDebt 
                ? 'Total kewajiban yang belum diselesaikan' 
                : 'Tidak ada sisa kewajiban (Lunas)'}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-purple-400 flex items-center justify-between text-[10px] font-mono font-semibold text-purple-900">
            <span>Formula:</span>
            <span>Kredit - Debet (Akun 2.*)</span>
          </div>
        </div>

        {/* Metric 2: Total Timbul Hutang (Kredit) */}
        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-400 hover:border-amber-700 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <ArrowUpRight size={14} className="text-amber-700" /> Timbul Hutang
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-400">
                Kredit (2.*)
              </span>
            </div>
            <p className="text-2xl font-black text-amber-950 font-mono tracking-tight my-1">
              {formatCurrency(totalPenambahanHutang)}
            </p>
            <p className="text-[11px] text-amber-900 mt-1 leading-tight">
              Akumulasi nilai nota/kewajiban yang tercatat
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-amber-300 flex items-center justify-between text-[10px] font-mono font-semibold text-amber-900">
            <span>Transaksi:</span>
            <span>{debtEntries.length} Baris Jurnal</span>
          </div>
        </div>

        {/* Metric 3: Total Pelunasan (Debet) */}
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-300 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <ArrowDownLeft size={14} className="text-emerald-700" /> Telah Dilunasi
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                Debet (2.*)
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-950 font-mono tracking-tight my-1">
              {formatCurrency(totalPelunasanHutang)}
            </p>
            <p className="text-[11px] text-emerald-900 mt-1 leading-tight">
              Realisasi pembayaran &amp; pelunasan yang terekam
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-emerald-300 flex items-center justify-between text-[10px] font-mono font-semibold text-emerald-900">
            <span>Status:</span>
            <span className="text-emerald-800 font-bold">Terbayar</span>
          </div>
        </div>

        {/* Metric 4: Rasio Pelunasan (%) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-400 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" /> Rasio Pelunasan
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                tingkatPelunasan >= 100 
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                  : 'bg-purple-100 text-purple-900 border-purple-300'
              }`}>
                {tingkatPelunasan.toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight my-1">
              {tingkatPelunasan.toFixed(1)}%
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden border border-slate-300">
              <div 
                className={`h-full transition-all duration-500 ${
                  tingkatPelunasan >= 100 ? 'bg-emerald-500' : 'bg-purple-600'
                }`}
                style={{ width: `${tingkatPelunasan}%` }}
              />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] font-mono font-semibold text-slate-700">
            <span>Penyelesaian:</span>
            <span>{tingkatPelunasan >= 100 ? '100% Tuntas' : `${(100 - tingkatPelunasan).toFixed(1)}% Sisa`}</span>
          </div>
        </div>
      </div>

      {/* Dedicated Progress Bar Box */}
      <div className="mb-6 bg-purple-50/40 border border-purple-300 rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-purple-700" />
            <span className="text-xs font-black text-purple-950 uppercase tracking-wide">
              Rasio Pelunasan: Total Terbayar vs. Total Timbul Hutang
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-emerald-800 font-bold">
              Terbayar: {formatCurrency(totalPelunasanHutang)}
            </span>
            <span className="text-slate-400">/</span>
            <span className="text-purple-950 font-bold">
              Total Hutang: {formatCurrency(totalPenambahanHutang)}
            </span>
          </div>
        </div>

        <div className="relative w-full bg-purple-200/60 rounded-full h-3.5 overflow-hidden border border-purple-300 flex shadow-inner">
          <div 
            className="bg-emerald-500 h-full transition-all duration-500 relative flex items-center justify-end"
            style={{ width: `${Math.min(100, Math.max(0, tingkatPelunasan))}%` }}
          >
            {tingkatPelunasan > 12 && (
              <span className="text-[9px] font-black text-white font-mono px-1.5 leading-none">
                {tingkatPelunasan.toFixed(0)}%
              </span>
            )}
          </div>
          {tingkatPelunasan < 100 && totalPenambahanHutang > 0 && (
            <div 
              className="bg-purple-400/50 h-full transition-all duration-500 flex items-center justify-end"
              style={{ width: `${Math.max(0, 100 - tingkatPelunasan)}%` }}
            >
              {(100 - tingkatPelunasan) > 15 && (
                <span className="text-[9px] font-black text-purple-950 font-mono px-1.5 leading-none">
                  {(100 - tingkatPelunasan).toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="font-semibold text-slate-900">
                Terlunasi: <strong className="text-emerald-700">{formatCurrency(totalPelunasanHutang)} ({tingkatPelunasan.toFixed(1)}%)</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span>
              <span className="font-semibold text-slate-900">
                Sisa Hutang: <strong className="text-purple-900">{formatCurrency(totalSisaHutang)} ({(100 - tingkatPelunasan).toFixed(1)}%)</strong>
              </span>
            </div>
          </div>
          <span className="text-[10px] text-purple-900 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md font-semibold">
            {tingkatPelunasan >= 100 ? 'Hutang Telah Lunas 100%' : `Sisa yang Harus Dilunasi: ${formatCurrency(totalSisaHutang)}`}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ENHANCED BREAKDOWN LIST SECTION (CREDITOR ACCOUNTS, DEPARTMENTS & SUPPLIERS) */}
      {/* ========================================================================= */}
      <div className="mb-6 pt-2 border-t-2 border-slate-300">
        {/* Section Header with Category Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Receipt size={18} className="text-purple-700" />
              <span>Rincian Sisa Hutang Terkategori</span>
            </h4>
            <p className="text-xs text-slate-600 mt-0.5">
              Lihat distribusi sisa kewajiban berdasarkan pos rekening kreditur, bidang kerja pelaksana, atau pihak ketiga
            </p>
          </div>

          {/* View Mode Switcher Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300 self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => { setBreakdownViewMode('account'); setSelectedFilterKey('all'); }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                breakdownViewMode === 'account'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
              }`}
            >
              <CreditCard size={13} />
              <span>Akun Kreditur ({categorySummaries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setBreakdownViewMode('department'); setSelectedFilterKey('all'); }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                breakdownViewMode === 'department'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
              }`}
            >
              <Building2 size={13} />
              <span>Departemen / Bidang ({departmentSummaries.length})</span>
            </button>
            <button
              type="button"
              onClick={() => { setBreakdownViewMode('creditor'); setSelectedFilterKey('all'); }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                breakdownViewMode === 'creditor'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
              }`}
            >
              <Store size={13} />
              <span>Rekanan / Toko ({creditorSummaries.length})</span>
            </button>
          </div>
        </div>

        {/* Filter, Search & Sort Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-300">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  breakdownViewMode === 'account' 
                    ? "Cari kode akun, nama pos kewajiban..."
                    : breakdownViewMode === 'department'
                    ? "Cari nama seksi / bidang kerja..."
                    : "Cari nama toko / rekanan / pihak ketiga..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`text-[11px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('outstanding')}
                className={`text-[11px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === 'outstanding' ? 'bg-purple-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hanya tampilkan kategori yang masih memiliki sisa hutang"
              >
                Sisa Hutang ({categorySummaries.filter(c => c.sisaHutang > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('settled')}
                className={`text-[11px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === 'settled' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hanya tampilkan kategori yang sudah lunas 100%"
              >
                Lunas
              </button>
            </div>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="text-xs bg-white text-slate-800 font-bold border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-600"
            >
              <option value="sisa-desc">Sisa Hutang Terbesar</option>
              <option value="sisa-asc">Sisa Hutang Terkecil</option>
              <option value="timbul-desc">Total Hutang Terbesar</option>
              <option value="progress-asc">Rasio Pelunasan Terendah</option>
              <option value="name-asc">Nama (A-Z)</option>
            </select>
          </div>
        </div>

        {/* View Info Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              Menampilkan {filteredAndSortedBreakdown.length} kategori 
              {breakdownViewMode === 'account' && ' akun kreditur'}
              {breakdownViewMode === 'department' && ' departemen/bidang'}
              {breakdownViewMode === 'creditor' && ' entitas rekanan'}
            </span>
            {currentViewOutstandingCount > 0 ? (
              <span className="text-[10px] bg-purple-100 text-purple-900 font-bold font-mono px-2 py-0.5 rounded-full border border-purple-300">
                {currentViewOutstandingCount} Pos Aktif Hutang
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold font-mono px-2 py-0.5 rounded-full border border-emerald-300">
                Seluruh Pos Lunas
              </span>
            )}
          </div>
          <div className="font-mono text-xs">
            Subtotal Sisa Hutang: <strong className="text-purple-950 font-black">{formatCurrency(currentViewOutstandingSubtotal)}</strong>
          </div>
        </div>

        {/* Breakdown Items List */}
        {filteredAndSortedBreakdown.length === 0 ? (
          <div className="p-8 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-600 text-xs">
            <AlertCircle size={24} className="mx-auto mb-2 text-slate-400" />
            <p className="font-semibold">Tidak ada kategori hutang yang sesuai dengan filter atau pencarian.</p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="mt-2 text-purple-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                <RotateCcw size={12} /> Reset Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredAndSortedBreakdown.map((item: any) => {
              const isLunas = item.sisaHutang === 0;
              const progress = item.totalKredit > 0 ? Math.min(100, (item.totalDebet / item.totalKredit) * 100) : 100;
              
              // Determine item key and labels based on view mode
              const itemKey = breakdownViewMode === 'account' 
                ? item.code 
                : breakdownViewMode === 'department' 
                ? item.id 
                : item.id;

              const isSelected = selectedFilterKey === itemKey;

              return (
                <div 
                  key={itemKey}
                  onClick={() => {
                    if (selectedFilterKey === itemKey) {
                      setSelectedFilterKey('all');
                    } else {
                      setSelectedFilterKey(itemKey);
                      setShowTransactionDetails(true);
                    }
                  }}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between cursor-pointer relative group ${
                    isSelected
                      ? 'bg-purple-100/70 border-purple-600 ring-2 ring-purple-400 shadow-md'
                      : isLunas 
                      ? 'bg-slate-50 border-slate-300 hover:border-slate-400 hover:shadow-xs' 
                      : 'bg-white border-purple-300 hover:border-purple-600 shadow-2xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Row: Code/Icon, Title & Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {breakdownViewMode === 'account' && (
                          <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 shrink-0">
                            {item.code}
                          </span>
                        )}
                        {breakdownViewMode === 'department' && (
                          <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-300 shrink-0">
                            {renderDepartmentIcon(item.iconType)}
                          </div>
                        )}
                        {breakdownViewMode === 'creditor' && (
                          <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 shrink-0">
                            <Store size={15} />
                          </div>
                        )}
                      </div>

                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full shrink-0 border ${
                        isLunas 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                          : 'bg-purple-100 text-purple-950 border-purple-400'
                      }`}>
                        {isLunas ? 'Lunas 100%' : 'Belum Lunas'}
                      </span>
                    </div>
                    
                    {/* Account Name & Seksi */}
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-black text-slate-900 leading-snug" title={item.name}>
                        {item.name}
                      </h5>
                      {breakdownViewMode === 'account' && item.associatedDepts?.length > 0 && (
                        <span className="text-[10px] text-slate-500 block truncate">
                          Bidang: {item.associatedDepts.join(', ')}
                        </span>
                      )}
                      {breakdownViewMode === 'department' && item.accountCodes?.length > 0 && (
                        <span className="text-[10px] text-slate-500 font-mono block truncate">
                          Akun: {item.accountCodes.join(', ')}
                        </span>
                      )}
                      {breakdownViewMode === 'creditor' && (
                        <span className="text-[10px] text-slate-500 block truncate">
                          {item.accountCode} • {item.departmentName}
                        </span>
                      )}
                    </div>

                    {/* Sisa Hutang Prominent Display */}
                    <div className="my-2.5 p-2.5 rounded-lg bg-slate-100/80 border border-slate-300">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                        <span>Sisa Hutang (Outstanding):</span>
                        <span className="text-[10px] font-mono text-purple-900">
                          {progress.toFixed(0)}% Terbayar
                        </span>
                      </div>
                      <p className={`text-lg font-black font-mono tracking-tight ${
                        isLunas ? 'text-emerald-700' : 'text-purple-950'
                      }`}>
                        {formatCurrency(item.sisaHutang)}
                      </p>
                    </div>

                    {/* Financial Figures Breakdown Table */}
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>Timbul Hutang (Kredit):</span>
                        <span className="font-bold text-slate-900">{formatCurrency(item.totalKredit)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Telah Dilunasi (Debet):</span>
                        <span className="font-bold text-emerald-800">-{formatCurrency(item.totalDebet)}</span>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden border border-slate-300">
                      <div 
                        className={`h-full transition-all duration-300 ${isLunas ? 'bg-emerald-500' : 'bg-purple-600'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Footer: Transactions & Selection Indicator */}
                  <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} className="text-slate-400" />
                      {item.txCount} Transaksi {item.lastDate ? `(${item.lastDate})` : ''}
                    </span>
                    <span className={`font-bold transition-colors ${
                      isSelected ? 'text-purple-900 underline' : 'text-slate-700 group-hover:text-purple-800'
                    }`}>
                      {isSelected ? '✓ Terpilih' : 'Klik utk Rincian →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COLLAPSIBLE / FILTERED TRANSACTION DETAIL LIST */}
      {/* ========================================================================= */}
      {debtEntries.length > 0 && (
        <div className="mt-6 pt-4 border-t-2 border-slate-400">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen size={15} className="text-purple-700" />
                Catatan Transaksi Jurnal ({displayTransactions.length} Baris)
              </span>
              {selectedFilterKey !== 'all' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] bg-purple-100 text-purple-950 font-bold px-2 py-0.5 rounded-md border border-purple-300">
                    Filter: {
                      breakdownViewMode === 'account' 
                        ? categorySummaries.find(c => c.code === selectedFilterKey)?.name || selectedFilterKey
                        : breakdownViewMode === 'department'
                        ? departmentSummaries.find(d => d.id === selectedFilterKey)?.name || selectedFilterKey
                        : creditorSummaries.find(c => c.id === selectedFilterKey)?.name || selectedFilterKey
                    }
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFilterKey('all')}
                    className="text-[11px] text-purple-700 hover:text-purple-950 hover:underline font-bold cursor-pointer"
                  >
                    (Reset Filter)
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTransactionDetails(prev => !prev)}
                className="no-print flex items-center gap-1.5 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-300 px-3 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <span>{showTransactionDetails ? 'Sembunyikan Rincian Jurnal' : 'Tampilkan Rincian Jurnal'}</span>
                {showTransactionDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {showTransactionDetails && (
            <div className="overflow-x-auto rounded-xl border border-slate-300 bg-slate-50/50 mt-2 shadow-inner">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Kode Rekening</th>
                    <th className="py-2.5 px-3">Departemen / Seksi</th>
                    <th className="py-2.5 px-3">Uraian Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Pelunasan (Debet)</th>
                    <th className="py-2.5 px-3 text-right">Timbul Hutang (Kredit)</th>
                    <th className="py-2.5 px-3 text-center">ID Jurnal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayTransactions.slice(0, 20).map((row, idx) => {
                    const coa = REFERENSI_REKENING.find(r => r.code === row.kodeRekening);
                    const isDebet = (Number(row.debet) || 0) > 0;
                    const isKredit = (Number(row.kredit) || 0) > 0;

                    const siblings = row.idTransaksi ? (txGroupMap.get(row.idTransaksi) || []) : [];
                    const pairedDebetRow = siblings.find(s => s.rowType === 'debet' && s.kodeRekening !== row.kodeRekening);
                    const debetAccountCode = pairedDebetRow ? pairedDebetRow.kodeRekening : undefined;
                    const effectiveProgram = row.program || (pairedDebetRow ? pairedDebetRow.program : undefined);
                    const deptInfo = detectDepartment(debetAccountCode, effectiveProgram, row.uraian);

                    return (
                      <tr key={row.rowId || `${row.idTransaksi}-${idx}`} className="hover:bg-purple-50/40 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                          {row.date || '-'}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          <span className="font-bold text-purple-950">{row.kodeRekening}</span>
                          <span className="text-[10px] text-slate-600 block">{coa?.name || ''}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-800 text-[11px]">
                          <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                            {renderDepartmentIcon(deptInfo.iconType)}
                            {deptInfo.name}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium max-w-xs">
                          {row.uraian}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {isDebet ? formatCurrency(Number(row.debet)) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-purple-950 whitespace-nowrap">
                          {isKredit ? formatCurrency(Number(row.kredit)) : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          {row.idTransaksi || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {displayTransactions.length > 20 && (
                <div className="p-2.5 text-center text-xs text-slate-600 bg-slate-100 border-t border-slate-300 font-mono font-medium">
                  Menampilkan 20 transaksi terbaru dari total {displayTransactions.length} transaksi kewajiban.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebtSummaryCard;
