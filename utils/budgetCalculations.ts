import type { BudgetItem, JuDisplayRow } from '../types';
import { REFERENSI_REKENING } from '../constants';

export interface AccountGroupDef {
  id: string;
  codePrefix: string;
  title: string;
  shortTitle: string;
  categoryType: 'sumberdana' | 'pendapatan' | 'belanja';
  description: string;
}

export const BUDGET_ACCOUNT_GROUPS: AccountGroupDef[] = [
  { id: 'sumberdana', codePrefix: '7', title: 'I. SUMBER DANA & HIBAH', shortTitle: 'Sumber Dana', categoryType: 'sumberdana', description: 'Hibah Provinsi, Hibah Kabupaten, dan penerimaan sumber dana' },
  { id: 'pendapatan', codePrefix: '4', title: 'II. PENDAPATAN DESA ADAT & DANA PUNIA', shortTitle: 'Pendapatan', categoryType: 'pendapatan', description: 'Dana Punia, Sasah Abu, Pendapatan Desa Adat, Bunga Bank/LPD, dan Administrasi' },
  { id: 'belanja-insentif', codePrefix: '5.1.1', title: 'III.1 BEBAN INSENTIF PRAJURU & PETUGAS', shortTitle: 'Beban Insentif', categoryType: 'belanja', description: 'Insentif Keliang, Penyarikan, Petajuh, Juru Raksa, Admin, Penempek, dan Serati' },
  { id: 'belanja-operasional', codePrefix: '5.1.2', title: 'III.2 BELANJA OPERASIONAL KANTOR', shortTitle: 'Operasional Kantor', categoryType: 'belanja', description: 'ATK, Konsumsi Paruman, Internet, BPJS, Awig-awig, Perkara Adat, Listrik, dan PDAM' },
  { id: 'belanja-perjalanan-dinas', codePrefix: '5.1.3', title: 'III.3 PERJALANAN DINAS & SAKU', shortTitle: 'Perjalanan Dinas', categoryType: 'belanja', description: 'Perjalanan Dinas / Uang Saku Prajuru, Admin, Pecalang, dan Lainnya' },
  { id: 'belanja-beban-lainnya', codePrefix: '5.1.4', title: 'III.4 BEBAN-BEBAN LAINNYA', shortTitle: 'Beban Lainnya', categoryType: 'belanja', description: 'Administrasi Bank, Banjar Adat, Gong, Peralatan, Kundangan, Pesangkepan, dll' },
  { id: 'belanja-parhyangan', codePrefix: '5.2', title: 'III.5 PROGRAM PARHYANGAN', shortTitle: 'Program Parhyangan', categoryType: 'belanja', description: 'Perlindungan Pratima, Dana Aci Melanting/Dalem/BaleAgung/Puseh, Galungan, Renovasi, dll' },
  { id: 'belanja-pawongan', codePrefix: '5.3', title: 'III.6 PROGRAM PAWONGAN', shortTitle: 'Program Pawongan', categoryType: 'belanja', description: 'Pasraman, Seni Wali, Sebunan, Bulan Bahasa, Sipandu, Bupda, Pesantian, Dana Kematian' },
  { id: 'belanja-palemahan', codePrefix: '5.4', title: 'III.7 PROGRAM PALEMAHAN', shortTitle: 'Program Palemahan', categoryType: 'belanja', description: 'Pemeliharaan Wantilan, Pengelolaan Sampah, Hutan/Danau, Setra, LPD, Bak Sampah' },
];

export interface SubCategorySummary {
  id: string;
  code: string;
  title: string;
  shortTitle: string;
  anggaran: number;
  realisasi: number;
  selisih: number;
  persentase: number;
  isOver: boolean;
}

export interface FinancialBudgetSummary {
  targetYear: string;
  totalRevenueBudget: number;
  totalRevenueRealization: number;
  totalRevenueSelisih: number;
  totalExpenseBudget: number;
  totalExpenseRealization: number;
  totalExpenseSelisih: number;
  netBalance: number;
  surplusDefisitBudget: number;
  revenueProgress: number;
  expenseProgress: number;
  expenseToRevenueRatio: number;
  subCategories: SubCategorySummary[];
  realizationMap: Record<string, number>;
}

/**
 * Single Source of Truth Calculation Engine
 * Synchronizes calculations identically across Dashboard, Anggaran, and LRA.
 */
export function calculateBudgetAndRealization(
  entries: JuDisplayRow[],
  budgetItems: BudgetItem[],
  selectedYear: number | string | 'all' = 'all',
  selectedMonth?: string
): FinancialBudgetSummary {
  const currYearStr = new Date().getFullYear().toString();
  const targetYear = selectedYear === 'all' ? currYearStr : String(selectedYear);

  // 1. Build Realization Map directly from Journal entries
  const filteredEntries = entries.filter(e => {
    if (!e.date) return false;
    const [y, m] = e.date.split('-');
    const matchYear = selectedYear === 'all' ? true : y === String(selectedYear);
    const matchMonth = selectedMonth ? m === selectedMonth : true;
    return matchYear && matchMonth;
  });

  const realizationMap: Record<string, number> = {};
  let totalRevenueRealization = 0;
  let totalExpenseRealization = 0;

  filteredEntries.forEach(e => {
    const rawCode = (e.kodeRekening || '').trim();
    if (!rawCode) return;
    const code = rawCode.split(' - ')[0].trim();
    if (!code) return;

    const debet = Number(e.debet) || 0;
    const kredit = Number(e.kredit) || 0;

    // 4. Pendapatan (Kredit - Debet)
    if (code.startsWith('4')) {
      const net = kredit - debet;
      realizationMap[code] = (realizationMap[code] || 0) + net;
      totalRevenueRealization += net;
    }
    // 7. Sumber Dana (Kredit - Debet)
    else if (code.startsWith('7')) {
      const net = kredit - debet;
      realizationMap[code] = (realizationMap[code] || 0) + net;
      totalRevenueRealization += net;
    }
    // 5. Belanja (Debet - Kredit)
    else if (code.startsWith('5')) {
      const net = debet - kredit;
      realizationMap[code] = (realizationMap[code] || 0) + net;
      totalExpenseRealization += net;
    }
    // 6. SILPA / Saldo Awal (Kredit - Debet)
    else if (code.startsWith('6')) {
      const net = kredit - debet;
      realizationMap[code] = (realizationMap[code] || 0) + net;
    }
  });

  // 2. Filter Firestore Budget Items for the chosen year
  const filteredBudgetItems = budgetItems.filter(item => {
    if (!item) return false;
    const itemYear = item.tahun ? String(item.tahun).trim() : currYearStr;
    if (selectedYear === 'all') {
      return itemYear === currYearStr;
    }
    return itemYear === String(selectedYear);
  });

  // 3. Compute Budget Totals using standard Account Groups
  const expenseGroupPrefixes = [
    { id: '5.1.1', code: '5.1.1', title: 'Beban Insentif Prajuru & Petugas', shortTitle: 'Beban Insentif' },
    { id: '5.1.2', code: '5.1.2', title: 'Belanja Operasional Kantor', shortTitle: 'Operasional Kantor' },
    { id: '5.1.3', code: '5.1.3', title: 'Perjalanan Dinas & Saku', shortTitle: 'Perjalanan Dinas' },
    { id: '5.1.4', code: '5.1.4', title: 'Beban-Beban Lainnya', shortTitle: 'Beban Lainnya' },
    { id: '5.2',   code: '5.2',   title: 'Program Parhyangan', shortTitle: 'Program Parhyangan' },
    { id: '5.3',   code: '5.3',   title: 'Program Pawongan', shortTitle: 'Program Pawongan' },
    { id: '5.4',   code: '5.4',   title: 'Program Palemahan', shortTitle: 'Program Palemahan' }
  ];

  let totalRevenueBudget = 0;
  let totalExpenseBudget = 0;

  // Track budget per specific sub-group
  const catBudgetMap: Record<string, number> = {
    '5.1.1': 0,
    '5.1.2': 0,
    '5.1.3': 0,
    '5.1.4': 0,
    '5.2': 0,
    '5.3': 0,
    '5.4': 0,
    '5.other': 0
  };

  filteredBudgetItems.forEach(item => {
    const val = Number(item.jumlah) || 0;
    if (val <= 0) return;
    const code = (item.kode || '').trim();

    if (code.startsWith('4') || code.startsWith('7')) {
      totalRevenueBudget += val;
    } else if (code.startsWith('5.1.1')) {
      catBudgetMap['5.1.1'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5.1.2')) {
      catBudgetMap['5.1.2'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5.1.3')) {
      catBudgetMap['5.1.3'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5.1.4')) {
      catBudgetMap['5.1.4'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5.2')) {
      catBudgetMap['5.2'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5.3')) {
      catBudgetMap['5.3'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5.4')) {
      catBudgetMap['5.4'] += val;
      totalExpenseBudget += val;
    } else if (code.startsWith('5')) {
      catBudgetMap['5.other'] += val;
      totalExpenseBudget += val;
    }
  });

  // Calculate Realization per Sub-Group
  const subCategories: SubCategorySummary[] = expenseGroupPrefixes.map(grp => {
    let grpReal = 0;
    Object.entries(realizationMap).forEach(([code, amount]) => {
      if (code.startsWith(grp.code)) {
        grpReal += amount;
      }
    });

    const grpBudget = catBudgetMap[grp.code] || 0;
    const persentase = grpBudget > 0 
      ? (grpReal / grpBudget) * 100 
      : (grpReal > 0 ? 100 : 0);

    return {
      id: grp.id,
      code: grp.code,
      title: grp.title,
      shortTitle: grp.shortTitle,
      anggaran: grpBudget,
      realisasi: grpReal,
      selisih: grpBudget - grpReal,
      persentase,
      isOver: grpBudget > 0 && grpReal > grpBudget
    };
  });

  // Ratios
  const revenueProgress = totalRevenueBudget > 0 
    ? (totalRevenueRealization / totalRevenueBudget) * 100 
    : (totalRevenueRealization > 0 ? 100 : 0);

  const expenseProgress = totalExpenseBudget > 0 
    ? (totalExpenseRealization / totalExpenseBudget) * 100 
    : (totalExpenseRealization > 0 ? 100 : 0);

  const expenseToRevenueRatio = totalRevenueRealization > 0 
    ? (totalExpenseRealization / totalRevenueRealization) * 100 
    : (totalExpenseRealization > 0 ? 100 : 0);

  const netBalance = totalRevenueRealization - totalExpenseRealization;
  const surplusDefisitBudget = totalRevenueBudget - totalExpenseBudget;
  const totalRevenueSelisih = totalRevenueRealization - totalRevenueBudget;
  const totalExpenseSelisih = totalExpenseBudget - totalExpenseRealization;

  return {
    targetYear,
    totalRevenueBudget,
    totalRevenueRealization,
    totalRevenueSelisih,
    totalExpenseBudget,
    totalExpenseRealization,
    totalExpenseSelisih,
    netBalance,
    surplusDefisitBudget,
    revenueProgress,
    expenseProgress,
    expenseToRevenueRatio,
    subCategories,
    realizationMap
  };
}
