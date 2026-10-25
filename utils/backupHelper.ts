/**
 * Comprehensive Backup & Restore Utility for All Pages and Sub-Pages
 * Covers:
 * - 7 Core Data Collections (BKU, BKP, Jurnal Umum, Anggaran Kas RAPB, Pepeson, Dana Punia, Urunan Krama)
 * - All Dana Punia Sub-Pages (Transfer, Tunai, Barang, Sasah Abu, Lainnya)
 * - Pembuatan Anggaran & Rincian Kegiatan across all years and all pos accounts
 * - All Page & Sub-Page Signatures, Custom Locations, Print Orientations, Form Options
 *   (BKU, BKP, Jurnal Umum, Buku Besar, Neraca, LRA, Rekapitulasi, Saldo Akhir, Rekonsiliasi, Anggaran)
 * - Physical Cash Opnames, Currency Denominations & Register Numbers
 * - Digital Signatures & Seal (Keliang, Juru Raksa, Petugas/Kolektor, Penyetor, Toko, Stempel)
 * - Financial Settings (Pajak, Manual Budget Caps)
 * - Village Profile & Identity
 * - Additional Sub-Modules (Peminjam, Setoran, Riwayat Rekonsiliasi)
 */

import { getStoredSignatures, getSignatureSettings, saveStoredSignatures, saveSignatureSettings } from './signatureStorage';

export interface BackupAllDataParams {
  bkuData: any[];
  bkpData: any[];
  juData: any[];
  budgetItems: any[];
  pepesonItems: any[];
  danaPuniaItems: any[];
  urunanItems: any[];
  settings?: {
    penyetoranPajak?: number;
    manualBudgetCaps?: any;
  };
  profile?: any;
  peminjamData?: any[];
  setoranData?: any[];
  reconciliationHistory?: any[];
}

export interface RestoredAppData {
  bku: any[];
  bkp: any[];
  jurnal_umum: any[];
  anggaran: any[];
  pepeson: any[];
  dana_punia: any[];
  urunan: any[];
  penyetoranPajak?: number;
  manualBudgetCaps?: any;
  profile?: any;
  digitalSignatures?: any;
  signatureSettings?: any;
  peminjamData?: any[];
  setoranData?: any[];
  reconciliationHistory?: any[];
  kegiatanCount: number;
  pageConfigCount: number;
}

// Sanitize helper to prevent circular references and serialize dates
export const sanitizeData = (data: any): any => {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  if (data.seconds !== undefined && data.nanoseconds !== undefined && typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }

  if (data.constructor && data.constructor.name !== 'Object') {
    if (typeof data.toJSON === 'function') return data.toJSON();
  }

  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    try {
      cleanObj[key] = sanitizeData(data[key]);
    } catch {
      cleanObj[key] = null;
    }
  }
  return cleanObj;
};

// Clean numeric fields in array records
export const cleanNumericRecords = (arr: any[]): any[] => {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map(row => {
    const clean = { ...row };
    const numericKeys = [
      'penerimaan', 'pengeluaran', 'debet', 'kredit', 'jumlah', 'total',
      'saldo', 'qty', 'hargaSatuan', 'jumlahKrama', 'insentif', 'kehadiran',
      'potongan', 'iuran', 'anggaran', 'frekuensiKali', 'nominalSatuan'
    ];
    numericKeys.forEach(k => {
      if (clean[k] !== undefined) clean[k] = Number(clean[k]) || 0;
    });
    if (clean.createdAt !== undefined) clean.createdAt = Number(clean.createdAt) || Date.now();
    return clean;
  });
};

// Count total budget activities from a map of years & accounts
export const countTotalKegiatan = (kegiatanObj: any): number => {
  if (!kegiatanObj || typeof kegiatanObj !== 'object') return 0;
  let count = 0;
  Object.values(kegiatanObj).forEach((itemMap: any) => {
    if (itemMap && typeof itemMap === 'object') {
      Object.values(itemMap).forEach((list: any) => {
        if (Array.isArray(list)) count += list.length;
      });
    }
  });
  return count;
};

/**
 * Collects entire app state across all pages, sub-pages, local storage, and configurations
 */
export const collectAllPagesBackupData = (params: BackupAllDataParams): any => {
  const safeBku = sanitizeData(params.bkuData || []);
  const safeBkp = sanitizeData(params.bkpData || []);
  const safeJu = sanitizeData(params.juData || []);
  const safeBudget = sanitizeData(params.budgetItems || []);
  const safePepeson = sanitizeData(params.pepesonItems || []);
  const safeDanaPunia = sanitizeData(params.danaPuniaItems || []);
  const safeUrunan = sanitizeData(params.urunanItems || []);
  const safeSettings = sanitizeData(params.settings || {});

  // Profile resolution
  let savedProfileObj: any = params.profile || null;
  if (!savedProfileObj && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('basangalas_profile') || 
                  localStorage.getItem('tigalikur_profile') ||
                  localStorage.getItem('desa_profile') ||
                  localStorage.getItem('village_profile');
      if (raw) savedProfileObj = JSON.parse(raw);
    } catch (e) {
      console.warn("Could not read local profile for backup:", e);
    }
  }

  // Dana Punia Sub-Page breakdowns
  const puniaTransfer = safeDanaPunia.filter((i: any) => i.type === 'transfer');
  const puniaTunai = safeDanaPunia.filter((i: any) => i.type === 'tunai' || i.type === 'uang');
  const puniaBarang = safeDanaPunia.filter((i: any) => i.type === 'barang');
  const puniaSasahAbu = safeDanaPunia.filter((i: any) => i.type === 'sasah-abu');
  const puniaLainnya = safeDanaPunia.filter((i: any) => i.type === 'lainnya');

  // Pembuatan Anggaran (Rincian Kegiatan per Tahun dan per Pos)
  const pembuatanAnggaranKegiatan: Record<string, any> = {};
  const pageSignaturesAndSettings: Record<string, any> = {};

  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Collect all pembuatan_anggaran_kegiatan_*
        if (key.startsWith('pembuatan_anggaran_kegiatan_')) {
          try {
            const rawVal = localStorage.getItem(key);
            if (rawVal) {
              pembuatanAnggaranKegiatan[key] = JSON.parse(rawVal);
            }
          } catch (e) {
            console.warn(`Error parsing ${key}`, e);
          }
        }

        // Collect all signatures, custom locations, and register settings across all pages
        const isPageSetting = 
          key.startsWith('anggaran_') ||
          key.startsWith('bku_') ||
          key.startsWith('bkp_') ||
          key.startsWith('ju_') ||
          key.startsWith('bb_') ||
          key.startsWith('neraca_') ||
          key.startsWith('rekapitulasi_') ||
          key.startsWith('saldoakhir_') ||
          key.startsWith('lra_') ||
          key.startsWith('rekonsiliasi_') ||
          key.includes('_nomorRegister') ||
          key.includes('_catatan') ||
          key.includes('_banknotes') ||
          key.includes('_coins') ||
          key.includes('_bankPhysical') ||
          key.includes('_bankAccountName') ||
          key.includes('_bankAccountNumber') ||
          key.includes('_kasKhususPhysical');

        if (isPageSetting) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            try {
              pageSignaturesAndSettings[key] = JSON.parse(val);
            } catch {
              pageSignaturesAndSettings[key] = val;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error scanning localStorage for page settings:", e);
    }
  }

  // Also harvest any kegiatanList that may reside directly on budgetItems
  safeBudget.forEach((b: any) => {
    if (b.kegiatanList && Array.isArray(b.kegiatanList) && b.kegiatanList.length > 0) {
      const yearKey = `pembuatan_anggaran_kegiatan_${b.tahun || '2026'}`;
      if (!pembuatanAnggaranKegiatan[yearKey]) {
        pembuatanAnggaranKegiatan[yearKey] = {};
      }
      if (!pembuatanAnggaranKegiatan[yearKey][b.kode]) {
        pembuatanAnggaranKegiatan[yearKey][b.kode] = b.kegiatanList;
      }
    }
  });

  // Digital Signatures & Settings
  let digitalSignaturesObj: any = null;
  let signatureSettingsObj: any = null;
  try {
    digitalSignaturesObj = getStoredSignatures();
    signatureSettingsObj = getSignatureSettings();
  } catch (e) {
    console.warn("Could not retrieve digital signatures for backup:", e);
  }

  return {
    version: '5.2.0',
    exportDate: new Date().toISOString(),
    appName: 'Sistem Pengelolaan Keuangan Desa Adat Basangalas',
    profile: savedProfileObj,

    // 1. Primary Ledger & Financial Collections
    bku: safeBku,
    bkp: safeBkp,
    jurnal_umum: safeJu,
    anggaran: safeBudget,
    pepeson: safePepeson,
    dana_punia: safeDanaPunia,
    urunan: safeUrunan,

    // 2. Dana Punia All Sub-Pages
    dana_punia_subpages: {
      transfer: puniaTransfer,
      tunai: puniaTunai,
      barang: puniaBarang,
      sasah_abu: puniaSasahAbu,
      lainnya: puniaLainnya
    },
    dana_punia_transfer: puniaTransfer,
    dana_punia_tunai: puniaTunai,
    dana_punia_barang: puniaBarang,
    dana_punia_sasah_abu: puniaSasahAbu,
    dana_punia_lainnya: puniaLainnya,

    // 3. Pembuatan Anggaran (Rincian Kegiatan Semua Tahun & Semua Pos)
    pembuatan_anggaran_kegiatan: pembuatanAnggaranKegiatan,

    // 4. All Page & Sub-Page Custom Configurations (Signatures, Custom Places, Register Numbers, Cash Opname)
    page_signatures_and_settings: pageSignaturesAndSettings,

    // 5. Digital Signatures & Official Village Stamp
    digitalSignatures: digitalSignaturesObj,
    digital_signatures: digitalSignaturesObj,
    signatureSettings: signatureSettingsObj,
    signature_settings: signatureSettingsObj,

    // 6. Global Financial Rules & Settings
    settings: safeSettings,

    // 7. Additional Modules (Peminjam, Setoran, Rekonsiliasi)
    peminjamData: sanitizeData(params.peminjamData || []),
    setoranData: sanitizeData(params.setoranData || []),
    reconciliationHistory: sanitizeData(params.reconciliationHistory || []),

    // 8. Backward Compatibility Aliases
    bkuData: safeBku,
    bkpData: safeBkp,
    juData: safeJu,
    budgetItems: safeBudget,
    pepesonItems: safePepeson,
    danaPuniaItems: safeDanaPunia,
    urunanItems: safeUrunan
  };
};

/**
 * Restores all pages and sub-pages data from a JSON object
 */
export const restoreAllPagesDataFromJSON = (data: any): RestoredAppData => {
  if (!data || typeof data !== 'object') {
    throw new Error('Data backup tidak valid atau kosong.');
  }

  // 1. Restore Profile
  const profileObj = data.profile || null;
  if (profileObj && typeof window !== 'undefined') {
    try {
      localStorage.setItem('basangalas_profile', JSON.stringify(profileObj));
      localStorage.setItem('tigalikur_profile', JSON.stringify(profileObj));
    } catch (e) {
      console.warn("Could not save profile to localStorage:", e);
    }
  }

  // 2. Restore Pembuatan Anggaran Kegiatan (All Years & All Accounts)
  const kegiatanObj = data.pembuatan_anggaran_kegiatan || data.pembuatanAnggaranKegiatan;
  let kegiatanCount = 0;
  if (kegiatanObj && typeof kegiatanObj === 'object' && typeof window !== 'undefined') {
    Object.keys(kegiatanObj).forEach(storageKey => {
      try {
        const val = kegiatanObj[storageKey];
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        localStorage.setItem(storageKey, strVal);
        // Count items
        if (typeof val === 'object' && val !== null) {
          Object.values(val).forEach((kegList: any) => {
            if (Array.isArray(kegList)) kegiatanCount += kegList.length;
          });
        }
      } catch (e) {
        console.warn(`Failed restoring ${storageKey}:`, e);
      }
    });
  }

  // 3. Restore All Page & Subpage Signatures, Registers, Custom Locations
  const pageSettings = data.page_signatures_and_settings || data.pageSignaturesAndSettings;
  let pageConfigCount = 0;
  if (pageSettings && typeof pageSettings === 'object' && typeof window !== 'undefined') {
    Object.keys(pageSettings).forEach(k => {
      try {
        const val = pageSettings[k];
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        localStorage.setItem(k, strVal);
        pageConfigCount++;
      } catch (e) {
        console.warn(`Failed restoring page setting ${k}:`, e);
      }
    });
  }

  // 4. Restore Digital Signatures & Stamp
  const sigs = data.digitalSignatures || data.digital_signatures;
  if (sigs && typeof sigs === 'object') {
    try {
      saveStoredSignatures(sigs);
      localStorage.setItem('digital_signatures', JSON.stringify(sigs));
    } catch (e) {
      console.warn("Could not restore digital signatures:", e);
    }
  }

  const sigSet = data.signatureSettings || data.signature_settings;
  if (sigSet && typeof sigSet === 'object') {
    try {
      saveSignatureSettings(sigSet);
      localStorage.setItem('signature_settings', JSON.stringify(sigSet));
    } catch (e) {
      console.warn("Could not restore signature settings:", e);
    }
  }

  // 5. Extract Core Collections with Aliases
  const rawBku = data.bku || data.bkuData || (Array.isArray(data) && data[0]?.penerimaan !== undefined ? data : []);
  const rawBkp = data.bkp || data.bkpData || (Array.isArray(data) && data[0]?.debet !== undefined && data[0]?.bukti !== undefined ? data : []);
  const rawJu = data.jurnal_umum || data.juData || data.jurnal || (Array.isArray(data) && data[0]?.rowType !== undefined ? data : []);
  const rawBudget = data.anggaran || data.budgetItems || data.anggaranKas || [];
  const rawPepeson = data.pepeson || data.pepesonItems || [];
  const rawUrunan = data.urunan || data.urunanItems || [];

  // 6. Extract Dana Punia & Integrate All Sub-Pages
  let rawDanaPunia = Array.isArray(data.dana_punia) 
    ? [...data.dana_punia] 
    : (Array.isArray(data.danaPuniaItems) 
        ? [...data.danaPuniaItems] 
        : (Array.isArray(data.danaPunia) ? [...data.danaPunia] : []));

  const subpages = data.dana_punia_subpages || {};
  const extraTransfer = data.dana_punia_transfer || subpages.transfer || data.danaPuniaTransfer || [];
  const extraTunai = data.dana_punia_tunai || subpages.tunai || data.danaPuniaTunai || [];
  const extraBarang = data.dana_punia_barang || subpages.barang || data.danaPuniaBarang || [];
  const extraSasahAbu = data.dana_punia_sasah_abu || subpages.sasah_abu || data.danaPuniaSasahAbu || [];
  const extraLainnya = data.dana_punia_lainnya || subpages.lainnya || data.danaPuniaLainnya || [];

  const subpageItems: any[] = [
    ...extraTransfer.map((i: any) => ({ ...i, type: i.type || 'transfer' })),
    ...extraTunai.map((i: any) => ({ ...i, type: i.type || 'tunai' })),
    ...extraBarang.map((i: any) => ({ ...i, type: i.type || 'barang' })),
    ...extraSasahAbu.map((i: any) => ({ ...i, type: i.type || 'sasah-abu' })),
    ...extraLainnya.map((i: any) => ({ ...i, type: i.type || 'lainnya' }))
  ];

  if (rawDanaPunia.length === 0 && subpageItems.length > 0) {
    rawDanaPunia = subpageItems;
  } else if (subpageItems.length > 0) {
    const existingIds = new Set(rawDanaPunia.map(i => i.id).filter(Boolean));
    subpageItems.forEach(item => {
      if (!item.id || !existingIds.has(item.id)) {
        rawDanaPunia.push(item);
        if (item.id) existingIds.add(item.id);
      }
    });
  }

  // 7. Clean Numeric Data
  const bkuCleaned = cleanNumericRecords(rawBku);
  const bkpCleaned = cleanNumericRecords(rawBkp);
  const juCleaned = cleanNumericRecords(rawJu);
  const budgetCleaned = cleanNumericRecords(rawBudget);
  const pepesonCleaned = cleanNumericRecords(rawPepeson);
  const danaPuniaCleaned = cleanNumericRecords(rawDanaPunia);
  const urunanCleaned = cleanNumericRecords(rawUrunan);

  // 8. Extract Settings
  const settingsObj = data.settings || {};
  const pajakVal = settingsObj.penyetoranPajak !== undefined 
    ? Number(settingsObj.penyetoranPajak) 
    : (data.penyetoranPajak !== undefined ? Number(data.penyetoranPajak) : undefined);
  const capsVal = settingsObj.manualBudgetCaps || data.manualBudgetCaps;

  // 9. Dispatch events to notify all active views (such as PembuatanAnggaranView)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('pembuatan_anggaran_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  }

  return {
    bku: bkuCleaned,
    bkp: bkpCleaned,
    jurnal_umum: juCleaned,
    anggaran: budgetCleaned,
    pepeson: pepesonCleaned,
    dana_punia: danaPuniaCleaned,
    urunan: urunanCleaned,
    penyetoranPajak: pajakVal,
    manualBudgetCaps: capsVal,
    profile: profileObj,
    digitalSignatures: sigs,
    signatureSettings: sigSet,
    peminjamData: Array.isArray(data.peminjamData) ? data.peminjamData : [],
    setoranData: Array.isArray(data.setoranData) ? data.setoranData : [],
    reconciliationHistory: Array.isArray(data.reconciliationHistory) ? data.reconciliationHistory : [],
    kegiatanCount,
    pageConfigCount
  };
};
