import { formatCurrency } from './formatter';
import type { JuDisplayRow } from '../types';

export interface FinancialValidationEntry {
  debet?: number | string | null;
  kredit?: number | string | null;
  kodeRekening?: string | null;
  uraian?: string | null;
  date?: string | null;
  [key: string]: any;
}

export interface FinancialValidationDetails {
  totalDebet: number;
  totalKredit: number;
  selisih: number;
  isBalanced: boolean;
  entryCount: number;
}

export interface FinancialValidationResult {
  isValid: boolean;
  errorMessage?: string;
  errors: string[];
  details: FinancialValidationDetails;
}

export interface FinancialValidationOptions {
  allowZero?: boolean;
  requireAccounts?: boolean;
  requireUraian?: boolean;
  requireDate?: boolean;
  customErrorPrefix?: string;
}

const parseNumericValue = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

/**
 * Validates financial entries (e.g. Journal rows, double-entry transactions).
 * Verifies that:
 * 1. Debet equals Kredit (Balance check with epsilon tolerance)
 * 2. Total amounts are positive (> 0)
 * 3. Accounts and descriptions are properly filled
 */
export const validateFinancialEntries = (
  entries: (JuDisplayRow | FinancialValidationEntry)[],
  options: FinancialValidationOptions = {}
): FinancialValidationResult => {
  const {
    allowZero = false,
    requireAccounts = true,
    requireUraian = false,
    requireDate = false,
    customErrorPrefix = ''
  } = options;

  const errors: string[] = [];

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Tidak ada baris transaksi keuangan untuk divalidasi.',
      errors: ['Tidak ada baris transaksi keuangan untuk divalidasi.'],
      details: {
        totalDebet: 0,
        totalKredit: 0,
        selisih: 0,
        isBalanced: true,
        entryCount: 0
      }
    };
  }

  let totalDebet = 0;
  let totalKredit = 0;

  entries.forEach((entry, idx) => {
    const rowNum = idx + 1;
    const dVal = parseNumericValue(entry.debet);
    const kVal = parseNumericValue(entry.kredit);

    if (dVal < 0 || kVal < 0) {
      errors.push(`Baris #${rowNum}: Nilai debet/kredit tidak boleh bernilai negatif.`);
    }

    totalDebet += dVal;
    totalKredit += kVal;

    if (requireAccounts && (!entry.kodeRekening || String(entry.kodeRekening).trim() === '')) {
      errors.push(`Baris #${rowNum}: Kode rekening / akun wajib dipilih.`);
    }

    if (requireUraian && (!entry.uraian || String(entry.uraian).trim() === '')) {
      errors.push(`Baris #${rowNum}: Uraian transaksi wajib diisi.`);
    }

    if (requireDate && (!entry.date || String(entry.date).trim() === '')) {
      errors.push(`Baris #${rowNum}: Tanggal transaksi wajib diisi.`);
    }
  });

  // Check Debet vs Kredit balance (allow tolerance for floating-point inaccuracies < 0.01)
  const selisih = Math.abs(totalDebet - totalKredit);
  const isBalanced = selisih < 0.01;

  if (!isBalanced) {
    const formattedDebet = formatCurrency(totalDebet);
    const formattedKredit = formatCurrency(totalKredit);
    const formattedSelisih = formatCurrency(selisih);
    errors.unshift(
      `Transaksi tidak seimbang (Unbalanced)! Total Debet (${formattedDebet}) harus sama dengan Total Kredit (${formattedKredit}). Selisih: ${formattedSelisih}.`
    );
  }

  if (!allowZero && totalDebet === 0 && totalKredit === 0) {
    errors.push('Nominal transaksi harus lebih besar dari 0.');
  }

  const isValid = errors.length === 0;
  const prefix = customErrorPrefix ? `${customErrorPrefix}: ` : '';
  const errorMessage = isValid ? undefined : `${prefix}${errors[0]}`;

  return {
    isValid,
    errorMessage,
    errors,
    details: {
      totalDebet,
      totalKredit,
      selisih,
      isBalanced,
      entryCount: entries.length
    }
  };
};

/**
 * Validates a single transaction pair (debet account, kredit account, and nominal amount).
 */
export const validateSingleTransaction = (
  entry: {
    akunDebet?: string | null;
    akunKredit?: string | null;
    nominal: number | string;
    tanggal?: string;
    uraian?: string;
  },
  options: { allowSameAccount?: boolean } = {}
): FinancialValidationResult => {
  const errors: string[] = [];
  const nominalNum = parseNumericValue(entry.nominal);

  if (!entry.akunDebet || entry.akunDebet.trim() === '') {
    errors.push('Silahkan pilih Akun DEBET.');
  }

  if (!entry.akunKredit || entry.akunKredit.trim() === '') {
    errors.push('Silahkan pilih Akun KREDIT.');
  }

  if (!options.allowSameAccount && entry.akunDebet && entry.akunKredit) {
    const cleanDebet = entry.akunDebet.split(' - ')[0].trim();
    const cleanKredit = entry.akunKredit.split(' - ')[0].trim();
    if (cleanDebet === cleanKredit) {
      errors.push('Akun Debet dan Akun Kredit tidak boleh sama untuk transaksi jurnal.');
    }
  }

  if (nominalNum <= 0) {
    errors.push('Masukkan nominal transaksi yang valid (lebih dari 0).');
  }

  if (entry.tanggal && isNaN(new Date(entry.tanggal).getTime())) {
    errors.push('Format tanggal transaksi tidak valid.');
  }

  const isValid = errors.length === 0;
  return {
    isValid,
    errorMessage: isValid ? undefined : errors[0],
    errors,
    details: {
      totalDebet: nominalNum,
      totalKredit: nominalNum,
      selisih: 0,
      isBalanced: true,
      entryCount: 2
    }
  };
};

export type NotificationCallback = (
  message: string,
  type?: 'error' | 'warning' | 'success' | 'info'
) => void;

/**
 * Helper function to validate financial entries and automatically display a toast notification if invalid.
 * Returns true if valid, false if invalid.
 */
export const validateAndNotifyFinancialEntries = (
  entries: (JuDisplayRow | FinancialValidationEntry)[],
  showNotification?: NotificationCallback | null,
  options?: FinancialValidationOptions
): boolean => {
  const result = validateFinancialEntries(entries, options);
  if (!result.isValid) {
    const msg = result.errorMessage || 'Validasi transaksi keuangan gagal.';
    if (showNotification) {
      showNotification(msg, 'error');
    }
    return false;
  }
  return true;
};

/**
 * Helper function to validate a single transaction pair and display a toast notification if invalid.
 * Returns true if valid, false if invalid.
 */
export const validateAndNotifySingleTransaction = (
  entry: {
    akunDebet?: string | null;
    akunKredit?: string | null;
    nominal: number | string;
    tanggal?: string;
    uraian?: string;
  },
  showNotification?: NotificationCallback | null,
  options?: { allowSameAccount?: boolean }
): boolean => {
  const result = validateSingleTransaction(entry, options);
  if (!result.isValid) {
    const msg = result.errorMessage || 'Validasi transaksi gagal.';
    if (showNotification) {
      showNotification(msg, 'error');
    }
    return false;
  }
  return true;
};

/**
 * Generates sequential transaction ID for Jurnal Umum:
 * Format: JU-yymmdd-number (e.g. JU-260912-01)
 *
 * @param dateStr Date of transaction in YYYY-MM-DD or parseable format
 * @param existingEntries Collection of existing journal entries or objects containing idTransaksi
 * @param additionalSources Optional additional lists (such as bkuData, bkpData)
 * @returns Formatted sequential ID string, e.g. "JU-260912-01"
 */
export const generateSequentialJuId = (
  dateStr?: string | null,
  existingEntries?: { idTransaksi?: string; date?: string; tanggal?: string }[],
  ...additionalSources: ({ idTransaksi?: string; date?: string; tanggal?: string }[] | undefined)[]
): string => {
  let yy = '';
  let mm = '';
  let dd = '';

  if (dateStr && typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      const yearPart = parts[0].trim();
      yy = yearPart.length >= 2 ? yearPart.slice(-2) : yearPart.padStart(2, '0');
      mm = parts[1].trim().padStart(2, '0');
      dd = parts[2].trim().slice(0, 2).padStart(2, '0');
    }
  }

  if (!yy || !mm || !dd) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    yy = validDate.getFullYear().toString().slice(-2);
    mm = String(validDate.getMonth() + 1).padStart(2, '0');
    dd = String(validDate.getDate()).padStart(2, '0');
  }

  const datePrefix = `JU-${yy}${mm}${dd}`; // e.g. "JU-260912"
  // Mendukung format JU-yymmdd-number (e.g. JU-260912-01) dan JU-yymmddnumber (e.g. JU-26091201)
  const regex = new RegExp(`^${datePrefix}-?(\\d+)$`, 'i');

  const existingIds = new Set<string>();
  const collect = (list?: { idTransaksi?: string }[]) => {
    if (!list) return;
    for (const item of list) {
      if (item && item.idTransaksi) {
        existingIds.add(item.idTransaksi.trim().toUpperCase());
      }
    }
  };

  collect(existingEntries);
  for (const src of additionalSources) {
    collect(src);
  }

  let maxSeq = 0;
  existingIds.forEach(id => {
    const match = id.match(regex);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });

  let nextSeq = maxSeq + 1;
  // Format JU-yymmdd-number, misal: JU-260912-01
  let candidateId = `${datePrefix}-${String(nextSeq).padStart(2, '0')}`;
  let altCandidateId = `${datePrefix}${String(nextSeq).padStart(2, '0')}`;

  // Guarantee uniqueness in case of unusual gaps or collisions across both formats
  while (existingIds.has(candidateId.toUpperCase()) || existingIds.has(altCandidateId.toUpperCase())) {
    nextSeq++;
    candidateId = `${datePrefix}-${String(nextSeq).padStart(2, '0')}`;
    altCandidateId = `${datePrefix}${String(nextSeq).padStart(2, '0')}`;
  }

  return candidateId;
};

