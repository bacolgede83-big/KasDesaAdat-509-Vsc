import React, { useState, useMemo, useCallback } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Sector, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { 
  Coins, 
  PieChart as PieIcon, 
  BarChart3, 
  TrendingUp, 
  Award, 
  Layers,
  Search,
  X,
  Filter,
  FileText,
  Wallet,
  CheckCircle2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { formatCurrency, formatLongDate } from '../../utils/formatter';
import type { JuDisplayRow, BkuData, DanaPuniaItem, UrunanItem } from '../../types';
import { REFERENSI_REKENING } from '../../constants';

export interface FundingSourceAccountItem {
  id: string;
  code: string;
  name: string;
  shortName: string;
  category: 'Pendapatan' | 'Sumber Dana' | 'Pembiayaan' | 'Kas Penerimaan';
  groupCode: string;
  value: number;
  count: number;
  color: string;
  percent: number;
  channelBreakdown: {
    tunai: number;
    transfer: number;
    sasahAbu: number;
    barang: number;
    lainnya: number;
  };
  transactions: JuDisplayRow[];
}

interface FundingSourceDistributionChartProps {
  entries: JuDisplayRow[];
  bkuData?: BkuData[];
  danaPuniaItems?: DanaPuniaItem[];
  urunanItems?: UrunanItem[];
  selectedYear: number | 'all';
}

// Palet warna resmi dan konsisten per akun CoA
const ACCOUNT_COLORS: Record<string, string> = {
  '4.1.1.01': '#0d9488', // Pendapatan Dana Punia (Teal)
  '4.1.1.02': '#9333ea', // Pendapatan Penjualan (Purple)
  '4.1.1.03': '#0284c7', // Saldo Awal Kas Desa Adat (Sky Blue)
  '4.1.1.04': '#06b6d4', // Saldo Kas Desa Adat (Cyan)
  '4.1.1.05': '#0891b2', // Saldo Kas JuruRaksa(Tunai)
  '4.1.1.06': '#059669', // Pendapatan Desa Adat (Emerald)
  '4.1.1.07': '#0284c7', // Pengembalian Dana Aci (Sky Blue)
  '4.1.1.08': '#6366f1', // Pendapatan Lain-lain (Indigo)
  '4.1.1.09': '#2563eb', // Pendapatan Bunga LPD (Royal Blue)
  '4.1.3.01': '#16a34a', // Pendapatan Hibah Provinsi (Green)
  '4.1.3.02': '#3b82f6', // Pendapatan Hibah Kabupaten (Light Blue)
  '4.1.3.03': '#d97706', // Administrasi Banjar Adat (Amber)
  '4.1.3.04': '#7c3aed', // Pendapatan Bunga Bank (Violet)
  '7.1.1.01': '#10b981', // Hibah A / Provinsi (Mint)
  '7.1.1.02': '#1d4ed8', // Hibah B / Kabupaten (Vibrant Blue)
  '7.1.1.03': '#8b5cf6', // Sumber Dana Lainnya (Purple)
  '7.1.2.02': '#f59e0b', // Urunan Krama (Gold)
  '7.1.2.03': '#ec4899', // Sumber Dana Lainnya (Pink)
  '6.1.1.01': '#14b8a6', // Silpa Tahun Sebelumnya (Teal Light)
  '6.1.1.02': '#84cc16', // Silpa Adat (Lime)
  '1.1.1.04': '#0d9488', // Kas Dana Punia Tunai
  '1.1.1.05': '#0284c7', // Kas Dana Punia Transfer
  '1.1.1.03': '#9333ea', // Kas Sasah Abu
  '1.1.1.06': '#ea580c', // Kas Punia Barang
  '1.1.1.08': '#f59e0b', // Kas Urunan
};

const FALLBACK_PALETTE = [
  '#0d9488', '#0284c7', '#f59e0b', '#10b981', '#7c3aed',
  '#ea580c', '#06b6d4', '#ec4899', '#6366f1', '#84cc16',
  '#059669', '#3b82f6', '#d97706', '#9333ea', '#14b8a6'
];

const getAccountColor = (code: string): string => {
  if (ACCOUNT_COLORS[code]) return ACCOUNT_COLORS[code];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
};

const getAccountShortName = (code: string, fullName: string): string => {
  if (code === '4.1.1.01') return 'Dana Punia';
  if (code === '4.1.1.02') return 'Penjualan';
  if (code === '4.1.1.03') return 'Saldo Awal Kas';
  if (code === '4.1.1.06') return 'Pendapatan Adat';
  if (code === '4.1.1.07') return 'Pengembalian Aci';
  if (code === '4.1.1.08') return 'Pendapatan Lain';
  if (code === '4.1.1.09') return 'Bunga LPD';
  if (code === '4.1.3.01') return 'Hibah Provinsi';
  if (code === '4.1.3.02') return 'Hibah Kabupaten';
  if (code === '4.1.3.03') return 'Adm Banjar Adat';
  if (code === '4.1.3.04') return 'Bunga Bank';
  if (code === '7.1.1.01') return 'Hibah A (Prov)';
  if (code === '7.1.1.02') return 'Hibah B (Kab)';
  if (code === '7.1.1.03') return 'Sumber Lainnya';
  if (code === '7.1.2.02') return 'Urunan Krama';
  if (code === '7.1.2.03') return 'Sumber Swadaya';
  if (code === '6.1.1.01') return 'Silpa Lalu';
  if (code === '6.1.1.02') return 'Silpa Adat';
  if (fullName.length > 20) return fullName.substring(0, 18) + '...';
  return fullName;
};

// Custom Active Shape for Pie/Donut Chart
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { 
    cx, 
    cy, 
    midAngle, 
    innerRadius, 
    outerRadius, 
    startAngle, 
    endAngle, 
    fill, 
    payload, 
    percent, 
    value 
  } = props;
  
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 8) * cos;
  const sy = cy + (outerRadius + 8) * sin;
  const mx = cx + (outerRadius + 22) * cos;
  const my = cy + (outerRadius + 22) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 16;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      {/* Center Label */}
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1e293b" fontSize={13} fontWeight="800">
        {payload.shortName || payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={fill} fontSize={16} fontWeight="900" fontFamily="monospace">
        {`${((percent || 0) * 100).toFixed(1)}%`}
      </text>

      {/* Main highlighted slice */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
      />
      
      {/* Outer glow ring */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 7}
        outerRadius={outerRadius + 11}
        fill={fill}
        opacity={0.35}
        cornerRadius={4}
      />

      {/* Connector lines & callout text */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} strokeWidth={2} fill="none" />
      <circle cx={ex} cy={ey} r={3.5} fill={fill} stroke="#ffffff" strokeWidth={1.5} />
      <text 
        x={ex + (cos >= 0 ? 1 : -1) * 8} 
        y={ey} 
        dy={4} 
        textAnchor={textAnchor} 
        fill="#0f172a" 
        fontSize={12} 
        fontWeight="800"
        fontFamily="monospace"
      >
        {formatCurrency(value)}
      </text>
    </g>
  );
};

// Custom Tooltip for Recharts Bar Chart
const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as FundingSourceAccountItem;
    return (
      <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 text-xs backdrop-blur-md max-w-xs">
        <div className="flex items-center gap-2 font-bold text-white mb-1.5 pb-1 border-b border-slate-700">
          <span 
            className="w-3 h-3 rounded-full shrink-0" 
            style={{ backgroundColor: data.color }}
          />
          <span className="truncate">{data.name}</span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono ml-auto shrink-0">
            {data.code}
          </span>
        </div>
        <div className="space-y-1 font-mono">
          <div className="flex justify-between gap-4 text-slate-300">
            <span>Nominal:</span>
            <span className="font-bold text-emerald-400">{formatCurrency(data.value)}</span>
          </div>
          <div className="flex justify-between gap-4 text-slate-300">
            <span>Proporsi:</span>
            <span className="font-bold text-sky-300">{data.percent?.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between gap-4 text-slate-400 text-[11px] pt-1 border-t border-slate-800">
            <span>Kategori:</span>
            <span className="font-semibold text-white">{data.category}</span>
          </div>
          <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
            <span>Jumlah Transaksi:</span>
            <span className="font-semibold text-white">{data.count} transaksi</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const FundingSourceDistributionChart: React.FC<FundingSourceDistributionChartProps> = ({
  entries = [],
  bkuData = [],
  danaPuniaItems = [],
  urunanItems = [],
  selectedYear
}) => {
  const [viewMode, setViewMode] = useState<'donut' | 'bar'>('donut');
  const [activeIndex, setActiveIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Pendapatan' | 'Sumber Dana' | 'Pembiayaan'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectAccount, setInspectAccount] = useState<FundingSourceAccountItem | null>(null);

  // Filter entries according to selectedYear (Single Source of Truth from Jurnal Umum)
  const filteredEntries = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    if (selectedYear === 'all') return entries;
    return entries.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d.getFullYear() === selectedYear;
    });
  }, [entries, selectedYear]);

  // Comprehensive calculation of each funding source derived strictly from Jurnal Umum & REFERENSI_REKENING
  const allFundingSourcesData: FundingSourceAccountItem[] = useMemo(() => {
    // 1. Group entries by transaction ID (to respect double-entry bookkeeping & understand pairs)
    const txMap = new Map<string, JuDisplayRow[]>();
    const standaloneRows: JuDisplayRow[] = [];

    if (Array.isArray(filteredEntries) && filteredEntries.length > 0) {
      filteredEntries.forEach(e => {
        const txId = e.idTransaksi ? String(e.idTransaksi).trim() : '';
        if (txId) {
          if (!txMap.has(txId)) txMap.set(txId, []);
          txMap.get(txId)!.push(e);
        } else {
          standaloneRows.push(e);
        }
      });
    }

    const accountMap: Record<string, {
      code: string;
      name: string;
      category: 'Pendapatan' | 'Sumber Dana' | 'Pembiayaan';
      groupCode: string;
      value: number;
      count: number;
      channelBreakdown: {
        tunai: number;
        transfer: number;
        sasahAbu: number;
        barang: number;
        lainnya: number;
      };
      transactions: JuDisplayRow[];
    }> = {};

    const getAccountInfo = (code: string) => {
      const cleanCode = (code || '').split(' - ')[0].trim();
      const ref = REFERENSI_REKENING.find(r => r.code === cleanCode);
      let name = ref?.name || (code.includes(' - ') ? code.split(' - ')[1].trim() : cleanCode);
      
      // Standarisasi nama CoA resmi
      if (cleanCode === '7.1.1.01') name = 'Hibah Provinsi (BKK)';
      else if (cleanCode === '7.1.1.02') name = 'Hibah Kabupaten';
      else if (cleanCode === '7.1.2.02') name = 'Urunan Krama Adat';
      else if (cleanCode === '4.1.1.01') name = 'Pendapatan Dana Punia';
      else if (cleanCode === '4.1.1.07') name = 'Pengembalian Dana Aci';
      else if (cleanCode === '4.1.1.09') name = 'Pendapatan Bunga LPD';
      else if (cleanCode === '4.1.3.01') name = 'Pendapatan Hibah Provinsi';
      else if (cleanCode === '4.1.3.02') name = 'Pendapatan Hibah Kabupaten';
      else if (cleanCode === '6.1.1.01') name = 'SILPA Tahun Sebelumnya';

      let category: 'Pendapatan' | 'Sumber Dana' | 'Pembiayaan' = 'Pendapatan';
      const groupCode = cleanCode.substring(0, 5);

      if (cleanCode.startsWith('4.')) {
        category = 'Pendapatan';
      } else if (cleanCode.startsWith('7.')) {
        category = 'Sumber Dana';
      } else if (cleanCode.startsWith('6.') || cleanCode.startsWith('3.')) {
        category = 'Pembiayaan';
      }

      return { code: cleanCode, name, category, groupCode };
    };

    const addReceipt = (
      code: string, 
      amount: number, 
      txRow: JuDisplayRow, 
      pairedDebetCodes: string[] = []
    ) => {
      if (amount <= 0) return;
      const info = getAccountInfo(code);
      if (!accountMap[info.code]) {
        accountMap[info.code] = {
          code: info.code,
          name: info.name,
          category: info.category,
          groupCode: info.groupCode,
          value: 0,
          count: 0,
          channelBreakdown: {
            tunai: 0,
            transfer: 0,
            sasahAbu: 0,
            barang: 0,
            lainnya: 0
          },
          transactions: []
        };
      }

      const acc = accountMap[info.code];
      acc.value += amount;
      acc.count += 1;
      acc.transactions.push(txRow);

      // Identifikasi sub-kanal penerimaan (Kas Penampung)
      const isTransfer = pairedDebetCodes.some(c => c.startsWith('1.1.1.05')) || 
        (txRow.uraian && txRow.uraian.toLowerCase().includes('transfer'));
      const isSasah = pairedDebetCodes.some(c => c.startsWith('1.1.1.03')) || 
        (txRow.uraian && txRow.uraian.toLowerCase().includes('sasah'));
      const isBarang = pairedDebetCodes.some(c => c.startsWith('1.1.1.06')) || 
        (txRow.uraian && txRow.uraian.toLowerCase().includes('barang'));
      const isTunai = pairedDebetCodes.some(c => c.startsWith('1.1.1.04') || c.startsWith('1.1.1.01')) || 
        (!isTransfer && !isSasah && !isBarang);

      if (isTransfer) acc.channelBreakdown.transfer += amount;
      else if (isSasah) acc.channelBreakdown.sasahAbu += amount;
      else if (isBarang) acc.channelBreakdown.barang += amount;
      else if (isTunai) acc.channelBreakdown.tunai += amount;
      else acc.channelBreakdown.lainnya += amount;
    };

    // 1. Proses transaksi berpasangan (Double Entry)
    txMap.forEach((rows) => {
      // Cari baris kredit Pendapatan (4.*), Sumber Dana (7.*), Pembiayaan (6.*), atau Ekuitas (3.*)
      const receiptCreditRows = rows.filter(r => {
        const c = (r.kodeRekening || '').split(' - ')[0].trim();
        const kVal = Number(r.kredit) || 0;
        const dVal = Number(r.debet) || 0;
        return (c.startsWith('4.') || c.startsWith('7.') || c.startsWith('6.') || c.startsWith('3.')) && (kVal > dVal);
      });

      const debitCodes = rows
        .filter(r => (Number(r.debet) || 0) > 0)
        .map(r => (r.kodeRekening || '').split(' - ')[0].trim());

      if (receiptCreditRows.length > 0) {
        receiptCreditRows.forEach(row => {
          const kVal = Number(row.kredit) || 0;
          const dVal = Number(row.debet) || 0;
          addReceipt(row.kodeRekening || '', kVal - dVal, row, debitCodes);
        });
      }
    });

    // 2. Proses baris mandiri (tanpa ID transaksi)
    standaloneRows.forEach(row => {
      const c = (row.kodeRekening || '').split(' - ')[0].trim();
      const kVal = Number(row.kredit) || 0;
      const dVal = Number(row.debet) || 0;
      if ((c.startsWith('4.') || c.startsWith('7.') || c.startsWith('6.') || c.startsWith('3.')) && (kVal > dVal)) {
        addReceipt(row.kodeRekening || '', kVal - dVal, row, []);
      }
    });

    // Fallback jika tidak ada data dari Jurnal tapi ada data dari danaPuniaItems / urunanItems
    if (Object.keys(accountMap).length === 0) {
      if (Array.isArray(danaPuniaItems) && danaPuniaItems.length > 0) {
        danaPuniaItems.forEach(item => {
          const itemYear = item.tanggal ? new Date(item.tanggal).getFullYear() : undefined;
          if (selectedYear !== 'all' && itemYear && itemYear !== selectedYear) return;
          const nominal = Number(item.nominal) || 0;
          if (nominal > 0) {
            const fakeRow: JuDisplayRow = {
              rowId: item.id || 'dp',
              idTransaksi: item.id || 'dp',
              date: item.tanggal,
              uraian: item.keterangan || item.namaDonatur || 'Dana Punia',
              kodeRekening: '4.1.1.01 - Pendapatan Dana Punia',
              kredit: nominal,
              debet: 0,
              rowType: 'kredit'
            };
            const pairedCodes = item.metodePembayaran === 'Transfer' ? ['1.1.1.05'] : 
              item.jenis === 'Barang' ? ['1.1.1.06'] : 
              item.jenis === 'Sasah Abu' ? ['1.1.1.03'] : ['1.1.1.04'];
            addReceipt('4.1.1.01', nominal, fakeRow, pairedCodes);
          }
        });
      }

      if (Array.isArray(urunanItems) && urunanItems.length > 0) {
        urunanItems.forEach(item => {
          const itemYear = item.tanggal ? new Date(item.tanggal).getFullYear() : undefined;
          if (selectedYear !== 'all' && itemYear && itemYear !== selectedYear) return;
          const nominal = Number(item.nominal) || 0;
          if (nominal > 0) {
            const fakeRow: JuDisplayRow = {
              rowId: item.id || 'ur',
              idTransaksi: item.id || 'ur',
              date: item.tanggal,
              uraian: item.keterangan || item.namaKrama || 'Urunan Krama',
              kodeRekening: '7.1.2.02 - Urunan Krama Adat',
              kredit: nominal,
              debet: 0,
              rowType: 'kredit'
            };
            const pairedCodes = item.metodePembayaran === 'Transfer' ? ['1.1.1.05'] : ['1.1.1.04'];
            addReceipt('7.1.2.02', nominal, fakeRow, pairedCodes);
          }
        });
      }
    }

    const rawList = Object.values(accountMap).filter(acc => acc.value > 0);
    const grandTotal = rawList.reduce((sum, item) => sum + item.value, 0);

    return rawList
      .map(item => {
        const color = getAccountColor(item.code);
        return {
          id: item.code,
          code: item.code,
          name: item.name,
          shortName: getAccountShortName(item.code, item.name),
          category: item.category,
          groupCode: item.groupCode,
          value: item.value,
          count: item.count,
          color,
          percent: grandTotal > 0 ? (item.value / grandTotal) * 100 : 0,
          channelBreakdown: item.channelBreakdown,
          transactions: item.transactions
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries, danaPuniaItems, urunanItems, selectedYear]);

  // Filtered by category tab and search query, recalculating active percent
  const displayedSourcesData = useMemo(() => {
    const list = allFundingSourcesData.filter(item => {
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
      const matchSearch = !searchQuery.trim() || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.shortName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    const activeTotal = list.reduce((sum, item) => sum + item.value, 0);

    return list.map(item => ({
      ...item,
      percent: activeTotal > 0 ? (item.value / activeTotal) * 100 : 0
    }));
  }, [allFundingSourcesData, categoryFilter, searchQuery]);

  // Overall totals strictly aligned with Dashboard metrics
  const totalReceipts = useMemo(() => {
    return allFundingSourcesData.reduce((sum, item) => sum + item.value, 0);
  }, [allFundingSourcesData]);

  const totalRevenueAccounts = useMemo(() => {
    return allFundingSourcesData
      .filter(item => item.category === 'Pendapatan')
      .reduce((sum, item) => sum + item.value, 0);
  }, [allFundingSourcesData]);

  const totalFundingAccounts = useMemo(() => {
    return allFundingSourcesData
      .filter(item => item.category === 'Sumber Dana' || item.category === 'Pembiayaan')
      .reduce((sum, item) => sum + item.value, 0);
  }, [allFundingSourcesData]);

  const dominantSource = useMemo(() => {
    if (allFundingSourcesData.length === 0) return null;
    return allFundingSourcesData[0];
  }, [allFundingSourcesData]);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  return (
    <div id="funding-source-distribution-card" className="bg-white p-6 rounded-2xl shadow-xl border border-gray-400 overflow-hidden relative">
      {/* Background soft accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-300 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 shadow-xs">
            <Coins size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              Proporsi Penerimaan Berbagai Sumber Dana
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-600" /> Sesuai Jurnal Umum & CoA
              </span>
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Komposisi penghimpunan dana langsung dari transaksi Jurnal Umum sesuai Referensi Rekening (CoA) ({selectedYear === 'all' ? 'Seluruh Periode' : `Tahun ${selectedYear}`})
            </p>
          </div>
        </div>

        {/* View Mode Toggle Button */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto no-print">
          <button
            type="button"
            onClick={() => setViewMode('donut')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'donut'
                ? 'bg-white text-teal-700 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Tampilkan Diagram Donat"
          >
            <PieIcon size={14} />
            <span>Diagram Donat</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'bar'
                ? 'bg-white text-teal-700 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Tampilkan Grafik Batang"
          >
            <BarChart3 size={14} />
            <span>Grafik Batang</span>
          </button>
        </div>
      </div>

      {/* KPI Top Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">
        {/* Highlight 1: Total Penerimaan Terhimpun */}
        <div className="bg-gradient-to-br from-teal-50/80 to-emerald-50/50 p-4 rounded-xl border border-teal-200 shadow-xs">
          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-teal-600" /> Total Penerimaan
          </span>
          <p className="text-xl font-black text-teal-900 font-mono tracking-tight">
            {formatCurrency(totalReceipts)}
          </p>
          <p className="text-[11px] text-teal-700 mt-1 font-medium">
            Akumulasi transaksi kredit di Jurnal Umum
          </p>
        </div>

        {/* Highlight 2: Kontributor Dominan */}
        <div className="bg-gradient-to-br from-sky-50/80 to-blue-50/50 p-4 rounded-xl border border-sky-200 shadow-xs">
          <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <Award size={14} className="text-sky-600" /> Sumber Dominan
          </span>
          <p className="text-base font-black text-sky-900 tracking-tight" title={dominantSource ? dominantSource.name : '-'}>
            {dominantSource ? dominantSource.name : '-'}
          </p>
          <p className="text-[11px] text-sky-700 mt-1 font-mono font-bold">
            {dominantSource ? `${formatCurrency(dominantSource.value)} (${dominantSource.percent.toFixed(1)}%)` : 'Belum ada data'}
          </p>
        </div>

        {/* Highlight 3: Jumlah Pos Akun Aktif */}
        <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-4 rounded-xl border border-amber-300 shadow-xs">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <Layers size={14} className="text-amber-600" /> Pos Akun Aktif
          </span>
          <p className="text-xl font-black text-amber-900 font-mono tracking-tight">
            {allFundingSourcesData.length} Rekening
          </p>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">
            {allFundingSourcesData.reduce((sum, item) => sum + item.count, 0)} total transaksi jurnal
          </p>
        </div>

        {/* Highlight 4: Pendapatan vs Sumber Dana */}
        <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/50 p-4 rounded-xl border border-purple-200 shadow-xs">
          <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
            <Wallet size={14} className="text-purple-600" /> Pendapatan vs Hibah/Dana
          </span>
          <p className="text-sm font-black text-purple-900 font-mono tracking-tight truncate">
            {totalReceipts > 0 ? `${((totalRevenueAccounts / totalReceipts) * 100).toFixed(0)}% : ${((totalFundingAccounts / totalReceipts) * 100).toFixed(0)}%` : '0% : 0%'}
          </p>
          <p className="text-[11px] text-purple-700 mt-1 font-medium">
            Akun 4.*: {formatCurrency(totalRevenueAccounts)}
          </p>
        </div>
      </div>

      {/* Main Visualizations / Recharts Section */}
      {allFundingSourcesData.length === 0 ? (
        <div className="py-16 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Coins size={36} className="mx-auto text-gray-400 mb-2 opacity-50" />
          <p className="text-sm font-bold text-gray-700">Belum ada transaksi penerimaan pada periode ini di Jurnal Umum</p>
          <p className="text-xs text-gray-500 mt-1">
            Data grafik akan otomatis tampil saat transaksi penerimaan (Akun 4.* Pendapatan, 7.* Sumber Dana, atau 6.* Pembiayaan) dicatat di Jurnal Umum.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Chart Canvas (Left/Center Column) */}
          <div className="lg:col-span-7 bg-slate-50/60 p-4 rounded-2xl border border-gray-300">
            {viewMode === 'donut' ? (
              <div style={{ width: '100%', height: 340 }} className="relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {/* @ts-ignore activeIndex prop supported in runtime */}
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={displayedSourcesData.length > 0 ? displayedSourcesData : allFundingSourcesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={76}
                      outerRadius={108}
                      dataKey="value"
                      onMouseEnter={onPieEnter}
                      paddingAngle={4}
                      animationDuration={600}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {(displayedSourcesData.length > 0 ? displayedSourcesData : allFundingSourcesData).map((entry) => (
                        <Cell 
                          key={`cell-${entry.id}`} 
                          fill={entry.color} 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-2">
                  <span className="text-[11px] text-gray-500 font-medium italic">
                    Arahkan kursor atau klik potongan diagram untuk melihat proporsi dan nominal akun
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', height: Math.max(340, (displayedSourcesData.length || allFundingSourcesData.length) * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={displayedSourcesData.length > 0 ? displayedSourcesData : allFundingSourcesData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis 
                      type="number" 
                      tickFormatter={(v) => formatCurrency(v)} 
                      tick={{ fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="shortName" 
                      tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }}
                      width={110}
                    />
                    <RechartsTooltip content={<CustomBarTooltip />} />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 8, 8, 0]}
                      animationDuration={600}
                    >
                      {(displayedSourcesData.length > 0 ? displayedSourcesData : allFundingSourcesData).map((entry) => (
                        <Cell key={`bar-${entry.id}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-center mt-1">
                  <span className="text-[11px] text-gray-500 font-medium italic">
                    Perbandingan nominal antar akun penerimaan resmi di Jurnal Umum
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Breakdown List / Legend (Right Column) */}
          <div className="lg:col-span-5 space-y-3">
            {/* Filter and Search Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter size={13} className="text-teal-600" />
                  <span>Rincian Rekening Penerimaan</span>
                </h4>
                <span className="text-[10px] text-gray-500 font-mono">
                  {displayedSourcesData.length} dari {allFundingSourcesData.length} Pos
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    categoryFilter === 'all'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('Pendapatan')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    categoryFilter === 'Pendapatan'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Pendapatan (4.*)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('Sumber Dana')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    categoryFilter === 'Sumber Dana'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Sumber Dana (7.*)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('Pembiayaan')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    categoryFilter === 'Pembiayaan'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  SILPA / Lainnya
                </button>
              </div>

              {/* Search box */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode rekening atau uraian akun..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-gray-800"
                />
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* List of Accounts */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {displayedSourcesData.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                  Tidak ditemukan akun yang cocok dengan filter.
                </div>
              ) : (
                displayedSourcesData.map((item, index) => {
                  const isActive = activeIndex === index;
                  const hasSubChannel = (item.channelBreakdown.transfer > 0 || item.channelBreakdown.tunai > 0 || item.channelBreakdown.sasahAbu > 0 || item.channelBreakdown.barang > 0);

                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-teal-50/70 border-teal-400 shadow-sm scale-[1.01]' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-start gap-2 min-w-0">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0 shadow-xs mt-0.5" 
                            style={{ backgroundColor: item.color }} 
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 leading-tight">
                                {item.name}
                              </span>
                              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded font-mono font-bold">
                                {item.code}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {item.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black font-mono block" style={{ color: item.color }}>
                            {item.percent.toFixed(1)}%
                          </span>
                          <span className="text-[11px] font-bold text-gray-800 font-mono">
                            {formatCurrency(item.value)}
                          </span>
                        </div>
                      </div>

                      {/* Progress indicator */}
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1.5">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(item.percent, 100)}%`,
                            backgroundColor: item.color 
                          }}
                        />
                      </div>

                      {/* Sub-channel Chips (khusus jika ada breakdown Tunai/Transfer/Sasah Abu/Barang) */}
                      {hasSubChannel && (
                        <div className="flex flex-wrap gap-1 mt-1 mb-1.5 text-[10px]">
                          {item.channelBreakdown.tunai > 0 && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                              Tunai: {formatCurrency(item.channelBreakdown.tunai)}
                            </span>
                          )}
                          {item.channelBreakdown.transfer > 0 && (
                            <span className="bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.2 rounded font-mono">
                              Transfer: {formatCurrency(item.channelBreakdown.transfer)}
                            </span>
                          )}
                          {item.channelBreakdown.sasahAbu > 0 && (
                            <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded font-mono">
                              Sasah Abu: {formatCurrency(item.channelBreakdown.sasahAbu)}
                            </span>
                          )}
                          {item.channelBreakdown.barang > 0 && (
                            <span className="bg-orange-50 text-orange-800 border border-orange-200 px-1.5 py-0.2 rounded font-mono">
                              Barang: {formatCurrency(item.channelBreakdown.barang)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                        <span className="font-mono text-[10px]">
                          {item.count} transaksi dicatat
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectAccount(item);
                          }}
                          className="text-[10px] text-teal-700 hover:text-teal-900 font-bold hover:underline flex items-center gap-0.5"
                        >
                          <FileText size={10} />
                          <span>Lihat Rincian</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Inspection Modal */}
      {inspectAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-300 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span 
                  className="w-3.5 h-3.5 rounded-full shrink-0" 
                  style={{ backgroundColor: inspectAccount.color }} 
                />
                <div>
                  <h4 className="text-sm font-bold text-gray-900 leading-tight">
                    {inspectAccount.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono font-bold text-teal-700">
                      Kode CoA: {inspectAccount.code}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      • {inspectAccount.category}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectAccount(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Summary KPI */}
            <div className="p-4 bg-teal-50/50 border-b border-teal-100 grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Total Penerimaan</span>
                <span className="text-sm font-black text-teal-900 font-mono">
                  {formatCurrency(inspectAccount.value)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Proporsi Global</span>
                <span className="text-sm font-black text-teal-700 font-mono">
                  {inspectAccount.percent.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Jumlah Data</span>
                <span className="text-sm font-black text-gray-800 font-mono">
                  {inspectAccount.count} transaksi
                </span>
              </div>
            </div>

            {/* Modal Body: Transactions Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="text-xs font-bold text-gray-700 mb-2 flex items-center justify-between">
                <span>Daftar Transaksi Jurnal Terkait:</span>
                <span className="text-[11px] text-gray-500 font-normal">
                  {selectedYear === 'all' ? 'Semua Periode' : `Tahun ${selectedYear}`}
                </span>
              </div>

              {inspectAccount.transactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  Tidak ada baris transaksi yang tersedia.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700 uppercase font-mono text-[10px] border-b border-gray-200">
                      <tr>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">ID / Bukti</th>
                        <th className="p-2.5">Uraian Transaksi</th>
                        <th className="p-2.5 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      {inspectAccount.transactions.map((tx, idx) => {
                        const amount = (Number(tx.kredit) || 0) > 0 ? (Number(tx.kredit) || 0) : (Number(tx.debet) || 0);
                        return (
                          <tr key={tx.rowId || idx} className="hover:bg-teal-50/40">
                            <td className="p-2.5 whitespace-nowrap font-mono text-[11px] text-gray-600">
                              {tx.date ? formatLongDate(tx.date) : '-'}
                            </td>
                            <td className="p-2.5 whitespace-nowrap font-mono text-[11px] text-teal-700 font-medium">
                              {tx.idTransaksi || '-'}
                            </td>
                            <td className="p-2.5 text-gray-900 font-medium">
                              {tx.uraian || '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                              {formatCurrency(amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectAccount(null)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundingSourceDistributionChart;
