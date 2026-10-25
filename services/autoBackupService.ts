import { storage, auth, db } from '../firebase';
// @ts-ignore
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
// @ts-ignore
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { AutoBackupConfig, BackupHistoryItem } from '../types';
import { collectAllPagesBackupData } from '../utils/backupHelper';

const DB_NAME = 'BasangalasBackupDB';
const DB_VERSION = 1;
const STORE_NAME = 'daily_backups';

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: true,
  targetCloud: true,
  targetLocal: true,
  autoDownload: false,
  retentionDays: 30,
};

// 1. IndexedDB Helper for Local Snapshots
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung oleh browser ini.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('dateKey', 'dateKey', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSnapshotToIndexedDB(item: BackupHistoryItem): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write warning, fallback to memory/localStorage:', err);
  }
}

export async function getSnapshotsFromIndexedDB(): Promise<BackupHistoryItem[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result as BackupHistoryItem[];
        // Sort descending by timestamp
        items.sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read warning:', err);
    return [];
  }
}

export async function deleteSnapshotFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete warning:', err);
  }
}

// 2. Configuration Management
export function getAutoBackupConfig(): AutoBackupConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem('auto_backup_config');
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Could not read auto backup config:', e);
  }
  return DEFAULT_CONFIG;
}

export function saveAutoBackupConfig(config: Partial<AutoBackupConfig>): AutoBackupConfig {
  const current = getAutoBackupConfig();
  const updated = { ...current, ...config };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('auto_backup_config', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save auto backup config to localStorage:', e);
    }
  }
  return updated;
}

// 3. Backup History Management
export function getStoredBackupHistory(): BackupHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('auto_backup_history');
    if (stored) {
      const list = JSON.parse(stored) as BackupHistoryItem[];
      return list.sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (e) {
    console.warn('Could not read backup history:', e);
  }
  return [];
}

export function saveStoredBackupHistory(history: BackupHistoryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep max 30 items in localStorage metadata list (full data stored in IndexedDB)
    const sanitized = history.slice(0, 30).map(item => {
      const { fullData, ...meta } = item;
      return meta as BackupHistoryItem;
    });
    localStorage.setItem('auto_backup_history', JSON.stringify(sanitized));
  } catch (e) {
    console.warn('Could not save backup history metadata:', e);
  }
}

// 4. Data Extraction & Formatting
export interface BackupPayloadSource {
  bkuData: any[];
  bkpData: any[];
  juData: any[];
  budgetItems: any[];
  pepesonItems: any[];
  danaPuniaItems: any[];
  urunanItems: any[];
  manualBudgetCaps?: any;
  penyetoranPajak?: number;
  profile?: any;
  peminjamData?: any[];
  setoranData?: any[];
  reconciliationHistory?: any[];
}

export function createStandardBackupPayload(source: BackupPayloadSource): any {
  const payload = collectAllPagesBackupData({
    bkuData: source.bkuData || [],
    bkpData: source.bkpData || [],
    juData: source.juData || [],
    budgetItems: source.budgetItems || [],
    pepesonItems: source.pepesonItems || [],
    danaPuniaItems: source.danaPuniaItems || [],
    urunanItems: source.urunanItems || [],
    settings: {
      penyetoranPajak: source.penyetoranPajak || 0,
      manualBudgetCaps: source.manualBudgetCaps || {}
    },
    profile: source.profile,
    peminjamData: source.peminjamData || [],
    setoranData: source.setoranData || [],
    reconciliationHistory: source.reconciliationHistory || []
  });

  return {
    ...payload,
    backupType: 'automatic_daily_backup'
  };
}

// 5. Main Execution Function for Daily Auto-Backup
export interface RunAutoBackupParams {
  userId?: string;
  source: BackupPayloadSource;
  force?: boolean; // If true, runs regardless of whether today's backup already ran
  onSuccess?: (item: BackupHistoryItem) => void;
  onError?: (err: any) => void;
}

export async function runDailyAutoBackup(params: RunAutoBackupParams): Promise<{
  executed: boolean;
  item?: BackupHistoryItem;
  message: string;
}> {
  const config = getAutoBackupConfig();
  if (!config.enabled && !params.force) {
    return { executed: false, message: 'Backup otomatis dinonaktifkan dalam pengaturan.' };
  }

  const now = new Date();
  const todayKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const lastDate = config.lastBackupDate;

  // If already backed up today and not forced, skip
  if (lastDate === todayKey && !params.force) {
    return { executed: false, message: `Backup otomatis hari ini (${todayKey}) sudah dijalankan sebelumnya.` };
  }

  // Ensure there is some data or profile to backup
  const { source } = params;
  const totalRecords =
    (source.bkuData?.length || 0) +
    (source.bkpData?.length || 0) +
    (source.juData?.length || 0) +
    (source.budgetItems?.length || 0) +
    (source.danaPuniaItems?.length || 0) +
    (source.urunanItems?.length || 0) +
    (source.pepesonItems?.length || 0);

  // If entirely empty (0 records and no profile), don't create blank backup unless forced
  if (totalRecords === 0 && !params.force) {
    return { executed: false, message: 'Data masih kosong, backup otomatis dilewati sementara.' };
  }

  const payload = createStandardBackupPayload(source);
  const payloadString = JSON.stringify(payload, null, 2);
  const sizeBytes = new Blob([payloadString]).size;
  const backupId = `backup_${todayKey}_${Date.now()}`;
  const formattedTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) + ` ${formattedTime}`;

  const storageTargets: ('firebase_storage' | 'local_indexeddb')[] = [];
  let cloudPath: string | undefined = undefined;
  let cloudUrl: string | undefined = undefined;
  let cloudSuccess = false;
  let cloudErrorMsg: string | undefined = undefined;

  // A. Upload to Firebase Storage (if enabled and user is logged in)
  const uid = params.userId || auth?.currentUser?.uid;
  if (config.targetCloud && uid && storage) {
    try {
      const fileName = `backup_${todayKey}.json`;
      const filePath = `backups/${uid}/${fileName}`;
      const storageRef = ref(storage, filePath);

      await uploadString(storageRef, payloadString, 'raw', {
        contentType: 'application/json',
        customMetadata: {
          exportDate: payload.exportDate,
          version: payload.version,
          totalRecords: String(totalRecords),
          namaDesa: payload.profile?.namaDesa || 'Desa Adat'
        }
      });

      cloudPath = filePath;
      storageTargets.push('firebase_storage');
      cloudSuccess = true;

      try {
        cloudUrl = await getDownloadURL(storageRef);
      } catch (e) {
        // download URL optional
      }
    } catch (storageErr: any) {
      console.warn('Firebase Storage upload failed, falling back to local snapshot:', storageErr);
      cloudErrorMsg = storageErr?.message || 'Storage error';
    }
  }

  // B. Save to Local Snapshot (IndexedDB)
  if (config.targetLocal || !cloudSuccess) {
    try {
      const historyItemWithData: BackupHistoryItem = {
        id: backupId,
        dateKey: todayKey,
        timestamp: Date.now(),
        formattedDate,
        sizeBytes,
        recordCounts: {
          bku: source.bkuData?.length || 0,
          bkp: source.bkpData?.length || 0,
          ju: source.juData?.length || 0,
          anggaran: source.budgetItems?.length || 0,
          danaPunia: source.danaPuniaItems?.length || 0,
          urunan: source.urunanItems?.length || 0,
          pepeson: source.pepesonItems?.length || 0
        },
        storageTargets: cloudSuccess ? ['firebase_storage', 'local_indexeddb'] : ['local_indexeddb'],
        cloudPath,
        cloudUrl,
        isAuto: !params.force,
        status: cloudSuccess ? 'success' : (config.targetCloud ? 'warning' : 'success'),
        statusMessage: cloudSuccess 
          ? 'Tersimpan di Firebase Storage & Snapshot Lokal' 
          : (cloudErrorMsg ? `Tersimpan di Lokal (${cloudErrorMsg})` : 'Tersimpan di Snapshot Lokal'),
        fullData: payload
      };

      await saveSnapshotToIndexedDB(historyItemWithData);
      storageTargets.push('local_indexeddb');
    } catch (indexedDbErr) {
      console.warn('IndexedDB save failed:', indexedDbErr);
    }
  }

  // C. Optional Auto-Download to client device
  if (config.autoDownload && typeof window !== 'undefined') {
    try {
      const blob = new Blob([payloadString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AUTOBACKUP_${payload.profile?.namaDesa?.replace(/\s+/g, '_') || 'DESA'}_${todayKey}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (dlErr) {
      console.warn('Auto download prompt error:', dlErr);
    }
  }

  // D. Create metadata record for history list
  const historyItem: BackupHistoryItem = {
    id: backupId,
    dateKey: todayKey,
    timestamp: Date.now(),
    formattedDate,
    sizeBytes,
    recordCounts: {
      bku: source.bkuData?.length || 0,
      bkp: source.bkpData?.length || 0,
      ju: source.juData?.length || 0,
      anggaran: source.budgetItems?.length || 0,
      danaPunia: source.danaPuniaItems?.length || 0,
      urunan: source.urunanItems?.length || 0,
      pepeson: source.pepesonItems?.length || 0
    },
    storageTargets: Array.from(new Set(storageTargets)),
    cloudPath,
    cloudUrl,
    isAuto: !params.force,
    status: cloudSuccess ? 'success' : (config.targetCloud ? 'warning' : 'success'),
    statusMessage: cloudSuccess 
      ? 'Tersimpan di Firebase Storage & Snapshot Lokal' 
      : (cloudErrorMsg ? `Tersimpan di Lokal (${cloudErrorMsg})` : 'Tersimpan di Snapshot Lokal')
  };

  // E. Update localStorage History & Config
  const existingHistory = getStoredBackupHistory();
  const updatedHistory = [historyItem, ...existingHistory.filter(h => h.id !== backupId)].slice(0, 50);
  saveStoredBackupHistory(updatedHistory);

  saveAutoBackupConfig({
    lastBackupDate: todayKey,
    lastBackupTime: `${todayKey} ${formattedTime}`
  });

  // F. Sync status to Firestore if user authenticated
  if (uid && db) {
    try {
      await setDoc(doc(db, 'users', uid, 'settings', 'backup_status'), {
        lastBackupDate: todayKey,
        lastBackupTime: `${todayKey} ${formattedTime}`,
        lastBackupId: backupId,
        recordCounts: historyItem.recordCounts,
        sizeBytes,
        storageTargets: historyItem.storageTargets,
        cloudPath: cloudPath || null,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      // ignore
    }
  }

  if (params.onSuccess) {
    params.onSuccess(historyItem);
  }

  return {
    executed: true,
    item: historyItem,
    message: cloudSuccess 
      ? `Backup otomatis berhasil disimpan ke Firebase Storage & Snapshot Lokal (${totalRecords} transaksi/data).` 
      : `Backup otomatis berhasil disimpan ke Snapshot Lokal (${totalRecords} transaksi/data).`
  };
}

// 6. Restore from a Snapshot Item
export async function getFullPayloadFromSnapshot(item: BackupHistoryItem): Promise<any | null> {
  if (item.fullData) {
    return item.fullData;
  }

  // Look in IndexedDB
  try {
    const db = await openIndexedDB();
    const storedItem = await new Promise<BackupHistoryItem | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(item.id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (storedItem?.fullData) {
      return storedItem.fullData;
    }
  } catch (err) {
    console.warn('Failed to retrieve full payload from IndexedDB:', err);
  }

  // Fallback to Firebase Storage if available
  if (item.cloudUrl || item.cloudPath) {
    try {
      let downloadUrl = item.cloudUrl;
      if (!downloadUrl && item.cloudPath && storage) {
        const storageRef = ref(storage, item.cloudPath);
        downloadUrl = await getDownloadURL(storageRef);
      }

      if (downloadUrl) {
        const res = await fetch(downloadUrl);
        if (res.ok) {
          const json = await res.json();
          return json;
        }
      }
    } catch (err) {
      console.warn('Failed to download backup from cloud:', err);
    }
  }

  return null;
}

// 7. Trigger Direct Download of a Snapshot as JSON File
export async function downloadSnapshotAsFile(item: BackupHistoryItem): Promise<boolean> {
  try {
    const payload = await getFullPayloadFromSnapshot(item);
    if (!payload) {
      throw new Error('Data payload backup tidak ditemukan di penyimpanan lokal maupun cloud.');
    }

    const payloadString = JSON.stringify(payload, null, 2);
    const blob = new Blob([payloadString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const villageName = (payload.profile?.namaDesa || 'BASANGALAS').replace(/\s+/g, '_');
    link.download = `BACKUP_${villageName}_${item.dateKey}_${item.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('Download snapshot error:', err);
    return false;
  }
}
