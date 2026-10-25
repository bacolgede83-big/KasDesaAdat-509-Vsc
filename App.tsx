
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import RingkasanEksekutif from './pages/RingkasanEksekutif';
import Anggaran from './pages/Anggaran';
import PlaceholderPage from './pages/PlaceholderPage';
import SplashScreen from './pages/SplashScreen';
import DisclaimerPage from './pages/DisclaimerPage';
import BukuKasUmum from './pages/BukuKasUmum';
import BukuKasPembantu from './pages/BukuKasPembantu';
import JurnalUmum from './pages/JurnalUmum';
import BukuBesar from './pages/BukuBesar';
import Rekonsiliasi from './pages/Rekonsiliasi';
import LaporanRekonsiliasiAkhir from './pages/LaporanRekonsiliasiAkhir';
import FormulirNeraca from './pages/FormulirNeraca';
import DokumenNeraca from './pages/DokumenNeraca';
import SaldoAkhir from './pages/SaldoAkhir';
import Neraca from './pages/Neraca'; 
import Pepeson from './pages/Pepeson';
import Pengaturan from './pages/Pengaturan';
import Rekapitulasi from './pages/Rekapitulasi';
import MatriksBulanan from './pages/MatriksBulanan';
import Modal from './components/shared/Modal';
import Spinner from './components/shared/Spinner';
import { Download, Save } from 'lucide-react';
import { SIDEBAR_MENU } from './constants';
import type { BkuData, BkpData, JuDisplayRow, BudgetItem, ManualBudgetCaps, PepesonItem, DanaPuniaItem, UrunanItem } from './types';
import { useNotification } from './context/NotificationContext';
import { validateAndNotifyFinancialEntries, generateSequentialJuId } from './utils/financialValidator';
import { runDailyAutoBackup } from './services/autoBackupService';
import { collectAllPagesBackupData, restoreAllPagesDataFromJSON, countTotalKegiatan } from './utils/backupHelper';
import { 
  playSaveSuccessSound, 
  playEditSuccessSound, 
  playDeleteSuccessSound, 
  playErrorSound, 
  playSyncSuccessSound 
} from './utils/soundEffects';

// Firebase Imports
import { auth, db } from './firebase';
// @ts-ignore - Suppress false positive missing export error for modular auth SDK
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
// @ts-ignore
import { collection, doc, setDoc, onSnapshot, writeBatch, getDocs, query, where, deleteDoc } from 'firebase/firestore';

// Global XLSX from script tag
declare const XLSX: any;

// Helper to sanitize Firestore objects into plain JSON-serializable objects
const sanitize = (data: any): any => {
    if (data === null || data === undefined || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(sanitize).filter(x => x !== undefined);
    
    // Handle Firestore Timestamp specifically
    if (data.seconds !== undefined && data.nanoseconds !== undefined && typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    
    // Handle other complex objects by ensuring they aren't circular and are plain
    if (data.constructor && data.constructor.name !== 'Object') {
        if (typeof data.toJSON === 'function') return data.toJSON();
        return String(data);
    }

    const result: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const val = data[key];
            if (val !== undefined) {
                result[key] = sanitize(val);
            }
        }
    }
    return result;
};

const App: React.FC = () => {
  const { showNotification } = useNotification();
  const [activePage, setActivePage] = useState<string>(SIDEBAR_MENU[0].name);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isOpLoading, setIsOpLoading] = useState<boolean>(false);
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null);
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);

  // Firebase Data Initialization Progress State
  const [isDataInitializing, setIsDataInitializing] = useState<boolean>(false);
  const [initProgress, setInitProgress] = useState<number>(0);
  const [initStatusText, setInitStatusText] = useState<string>('Menghubungkan ke database Firebase...');

  // General Operations Progress State (Import/Restore/Save)
  const [opProgress, setOpProgress] = useState<number | undefined>(undefined);
  const [opStatusText, setOpStatusText] = useState<string>('Memproses...');
  const [opDetails, setOpDetails] = useState<{
    currentCollection?: string;
    currentCount?: number;
    totalCount?: number;
    collections?: { label: string; count?: number; done: boolean; inProgress: boolean }[];
  } | undefined>(undefined);

  const loadedCollectionsRef = useRef<Set<string>>(new Set());
  
  // Data State
  const [bkuData, setBkuData] = useState<BkuData[]>([]);
  const [bkpData, setBkpData] = useState<BkpData[]>([]);
  const [juData, setJuData] = useState<JuDisplayRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [pepesonItems, setPepesonItems] = useState<PepesonItem[]>([]);
  const [danaPuniaItems, setDanaPuniaItems] = useState<DanaPuniaItem[]>([]);
  const [urunanItems, setUrunanItems] = useState<UrunanItem[]>([]);
  const [manualBudgetCaps, setManualBudgetCaps] = useState<ManualBudgetCaps>({
    'pendapatan': 0, 'belanja-rutin-insentif': 0, 'belanja-rutin-operasional': 0,
    'belanja-program-parhyangan': 0, 'belanja-program-pawongan': 0, 'belanja-program-palemahan': 0
  });

  const [penyetoranPajak, setPenyetoranPajak] = useState<number>(0);
  const [jurnalInitialAccounts, setJurnalInitialAccounts] = useState<{ debet: string; kredit: string; autoOpen?: boolean } | null>(null);

  const handleOpenJurnalWithAccounts = useCallback((debet: string, kredit: string) => {
    setJurnalInitialAccounts({ debet, kredit, autoOpen: true });
    setActivePage('Jurnal Umum');
  }, []);

  // Backup Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupType, setBackupType] = useState<'excel' | 'csv' | 'json'>('excel');
  const [backupFilename, setBackupFilename] = useState('');

  const recalculateBkuSaldo = useCallback((data: BkuData[]): BkuData[] => {
      const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.tanggal).getTime();
          const dateB = new Date(b.tanggal).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
      });
      let bal = 0;
      return sorted.map(i => { 
          bal += (Number(i.penerimaan) || 0) - (Number(i.pengeluaran) || 0); 
          return { ...i, saldo: bal }; 
      });
  }, []);

  const recalculateBkpSaldo = useCallback((data: BkpData[]): BkpData[] => {
      const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.tanggal).getTime();
          const dateB = new Date(b.tanggal).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
      });
      let bal = 0;
      return sorted.map(i => { 
          bal += (Number(i.debet) || 0) - (Number(i.kredit) || 0); 
          return { ...i, saldo: bal }; 
      });
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, email: currentUser.email });
        setIsDataInitializing(true);
      } else {
        setUser(null);
        setIsDataInitializing(false);
        setIsDisclaimerAccepted(false);
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setIsDataInitializing(false);
      setInitProgress(0);
      return;
    }

    setIsDataInitializing(true);
    setInitProgress(5);
    setInitStatusText('Terhubung ke database Firebase. Memulai sinkronisasi data...');
    loadedCollectionsRef.current.clear();

    const TOTAL_COLLECTIONS = 8;
    let syncFinished = false;
    let syncFinishTimer: ReturnType<typeof setTimeout> | null = null;

    const markLoaded = (name: string, label: string) => {
      loadedCollectionsRef.current.add(name);
      const count = loadedCollectionsRef.current.size;
      const pct = Math.min(100, Math.round((count / TOTAL_COLLECTIONS) * 100));
      setInitProgress(pct);
      setInitStatusText(`Memuat ${label} (${count}/${TOTAL_COLLECTIONS})...`);
      if (count >= TOTAL_COLLECTIONS && !syncFinished) {
        syncFinished = true;
        setInitStatusText('Inisialisasi Data Firebase Selesai!');
        syncFinishTimer = setTimeout(() => {
          setIsDataInitializing(false);
        }, 250);
      }
    };

    // Safety fallback timeout for offline / slow network conditions
    const safetyTimeout = setTimeout(() => {
      if (!syncFinished) {
        syncFinished = true;
        console.info("Firestore initial sync fallback activated (offline or slow connection)");
        setInitProgress(100);
        setInitStatusText('Modus offline / Sinkronisasi awal selesai.');
        setIsDataInitializing(false);
      }
    }, 4000);

    const onErr = (name: string, label: string) => (err: any) => {
      console.warn(`Firestore snapshot warning [${name}]:`, err);
      markLoaded(name, label);
    };

    const unsubBku = onSnapshot(collection(db, 'users', user.uid, 'bku'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => sanitize(doc.data()));
        setBkuData(recalculateBkuSaldo(rawData));
        markLoaded('bku', 'Buku Kas Umum');
    }, onErr('bku', 'Buku Kas Umum'));

    const unsubBkp = onSnapshot(collection(db, 'users', user.uid, 'bkp'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => sanitize(doc.data()));
        setBkpData(recalculateBkpSaldo(rawData));
        markLoaded('bkp', 'Buku Kas Pembantu');
    }, onErr('bkp', 'Buku Kas Pembantu'));

    const unsubJu = onSnapshot(collection(db, 'users', user.uid, 'jurnal_umum'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => ({ ...sanitize(doc.data()), rowId: doc.id }));
        setJuData(rawData);
        markLoaded('jurnal_umum', 'Jurnal Umum');
    }, onErr('jurnal_umum', 'Jurnal Umum'));

    const unsubBudget = onSnapshot(collection(db, 'users', user.uid, 'anggaran'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => sanitize(doc.data()));
        setBudgetItems(rawData);
        markLoaded('anggaran', 'Anggaran');
    }, onErr('anggaran', 'Anggaran'));

    const unsubPepeson = onSnapshot(collection(db, 'users', user.uid, 'pepeson'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => sanitize(doc.data()));
        setPepesonItems(rawData);
        markLoaded('pepeson', 'Pepeson');
    }, onErr('pepeson', 'Pepeson'));

    const unsubDanaPunia = onSnapshot(collection(db, 'users', user.uid, 'dana_punia'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => ({ ...sanitize(doc.data()), id: doc.id }));
        setDanaPuniaItems(rawData);
        markLoaded('dana_punia', 'Dana Punia');
    }, onErr('dana_punia', 'Dana Punia'));

    const unsubUrunan = onSnapshot(collection(db, 'users', user.uid, 'urunan'), (snapshot) => {
        const rawData = snapshot.docs.map(doc => sanitize(doc.data()));
        setUrunanItems(rawData);
        markLoaded('urunan', 'Urunan');
    }, onErr('urunan', 'Urunan'));

    const unsubSettings = onSnapshot(doc(db, 'users', user.uid, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = sanitize(docSnap.data());
        if (data.penyetoranPajak !== undefined) setPenyetoranPajak(Number(data.penyetoranPajak) || 0);
        if (data.manualBudgetCaps) {
            setManualBudgetCaps(prev => ({ ...prev, ...data.manualBudgetCaps }));
        }
      }
      markLoaded('settings', 'Pengaturan');
    }, onErr('settings', 'Pengaturan'));

    return () => { 
      clearTimeout(safetyTimeout);
      if (syncFinishTimer) clearTimeout(syncFinishTimer);
      unsubBku(); unsubBkp(); unsubJu(); unsubBudget(); unsubPepeson(); unsubDanaPunia(); unsubUrunan(); unsubSettings(); 
    };
  }, [user?.uid, recalculateBkuSaldo, recalculateBkpSaldo]);

  // Automated Daily Backup Schedule (Runs once per day upon first login after initial sync)
  const hasTriggeredDailyBackupRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || isDataInitializing) return;
    if (hasTriggeredDailyBackupRef.current) return;

    const timer = setTimeout(async () => {
      const totalCount =
        bkuData.length +
        bkpData.length +
        juData.length +
        budgetItems.length +
        danaPuniaItems.length +
        urunanItems.length +
        pepesonItems.length;

      // Only run auto backup if user has actual data
      if (totalCount === 0) return;

      try {
        const res = await runDailyAutoBackup({
          userId: user.uid,
          source: {
            bkuData,
            bkpData,
            juData,
            budgetItems,
            pepesonItems,
            danaPuniaItems,
            urunanItems,
            manualBudgetCaps,
            penyetoranPajak,
            peminjamData: [],
            setoranData: [],
            reconciliationHistory: []
          },
          force: false,
          onSuccess: (item) => {
            showNotification(
              `🛡️ Backup harian otomatis berhasil disimpan (${item.storageTargets.includes('firebase_storage') ? 'Firebase Storage & Snapshot Lokal' : 'Snapshot Lokal Perangkat'}).`,
              'success'
            );
          }
        });

        if (res.executed) {
          hasTriggeredDailyBackupRef.current = true;
        }
      } catch (err) {
        console.warn('Auto backup routine notice:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [
    user?.uid,
    isDataInitializing,
    bkuData.length,
    bkpData.length,
    juData.length,
    budgetItems.length,
    danaPuniaItems.length,
    urunanItems.length,
    pepesonItems.length,
    showNotification,
    bkuData,
    bkpData,
    juData,
    budgetItems,
    pepesonItems,
    danaPuniaItems,
    urunanItems,
    manualBudgetCaps,
    penyetoranPajak
  ]);


  useEffect(() => {
    if(!user?.uid) return;
    
    const saveSettings = async () => {
        try {
            const cleanCaps = sanitize(manualBudgetCaps);
            await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), {
                penyetoranPajak: Number(penyetoranPajak),
                manualBudgetCaps: cleanCaps 
            }, { merge: true });
        } catch (err) {
            console.error("Auto-save settings error:", err);
        }
    };

    const timeoutId = setTimeout(saveSettings, 1500);
    return () => clearTimeout(timeoutId);
  }, [penyetoranPajak, manualBudgetCaps, user?.uid]);

  useEffect(() => {
    if(!user?.uid) return;
    
    const savePepeson = async () => {
        try {
            const batch = writeBatch(db);
            const oldSnap = await getDocs(collection(db, 'users', user.uid, 'pepeson'));
            oldSnap.forEach(d => batch.delete(d.ref));
            
            pepesonItems.forEach(item => {
                batch.set(doc(db, 'users', user.uid, 'pepeson', item.id), sanitize(item));
            });
            await batch.commit();
        } catch (err) {
            console.error("Auto-save pepeson error:", err);
        }
    };

    const timeoutId = setTimeout(savePepeson, 2000);
    return () => clearTimeout(timeoutId);
  }, [pepesonItems, user?.uid]);

  const handleSaveTransaction = async (juRows: JuDisplayRow[], bkuRows: Omit<BkuData, 'id' | 'saldo'>[], bkpItems: Omit<BkpData, 'id' | 'saldo'>[], oldIdTransaksi?: string) => {
      if (!user?.uid) return;

      // Validate financial entries (ensure Debet equals Kredit balance, non-zero amount)
      const isValid = validateAndNotifyFinancialEntries(juRows, showNotification);
      if (!isValid) {
          return;
      }

      const batch = writeBatch(db);
      const now = Date.now();
      
      const targetIdTransaksi = oldIdTransaksi || juRows[0]?.idTransaksi || generateSequentialJuId(juRows[0]?.date, juData, bkuData, bkpData);

      if (oldIdTransaksi) {
          const oldJuSnap = await getDocs(query(collection(db, 'users', user.uid, 'jurnal_umum'), where('idTransaksi', '==', oldIdTransaksi)));
          oldJuSnap.forEach(d => batch.delete(d.ref));
          const oldBkuSnap = await getDocs(query(collection(db, 'users', user.uid, 'bku'), where('idTransaksi', '==', oldIdTransaksi)));
          oldBkuSnap.forEach(d => batch.delete(d.ref));
          const oldBkpSnap = await getDocs(query(collection(db, 'users', user.uid, 'bkp'), where('idTransaksi', '==', oldIdTransaksi)));
          oldBkpSnap.forEach(d => batch.delete(d.ref));
          // Removed deletion of dana_punia items to prevent data loss in Dana Punia section
      }

      juRows.forEach((row, idx) => {
          const rowId = `${targetIdTransaksi}-${idx}`;
          const safeRow = {
              rowId,
              idTransaksi: targetIdTransaksi,
              date: row.date,
              kodeRekening: row.kodeRekening,
              uraian: row.uraian,
              debet: Number(row.debet) || 0,
              kredit: Number(row.kredit) || 0,
              rowType: row.rowType,
              program: row.program || '',
              createdAt: now + idx
          };
          batch.set(doc(db, 'users', user.uid, 'jurnal_umum', rowId), safeRow);
      });
      
      bkuRows.forEach((bku, idx) => {
          const bkuId = `bku-${targetIdTransaksi}-${idx}`;
          batch.set(doc(db, 'users', user.uid, 'bku', bkuId), { 
              ...bku, 
              id: bkuId, 
              idTransaksi: targetIdTransaksi, 
              noBukti: targetIdTransaksi,
              bukti: targetIdTransaksi,
              saldo: 0, 
              createdAt: now + idx
          });
      });
      
      bkpItems.forEach((item, idx) => {
          const bkpId = `bkp-${targetIdTransaksi}-${idx}`;
          batch.set(doc(db, 'users', user.uid, 'bkp', bkpId), { 
              ...item, 
              id: bkpId, 
              idTransaksi: targetIdTransaksi, 
              saldo: 0, 
              createdAt: now + 50 + idx 
          });
      });
      await batch.commit();
  };

  const handleDeleteTransaction = async (idTransaksi: string) => {
      if (!user?.uid) {
          setJuData(prev => prev.filter(r => r.idTransaksi !== idTransaksi));
          setBkuData(prev => prev.filter(r => r.idTransaksi !== idTransaksi));
          setBkpData(prev => prev.filter(r => r.idTransaksi !== idTransaksi));
          return;
      }
      const batch = writeBatch(db);
      const juSnap = await getDocs(query(collection(db, 'users', user.uid, 'jurnal_umum'), where('idTransaksi', '==', idTransaksi)));
      juSnap.forEach(d => batch.delete(d.ref));
      const bkuSnap = await getDocs(query(collection(db, 'users', user.uid, 'bku'), where('idTransaksi', '==', idTransaksi)));
      bkuSnap.forEach(d => batch.delete(d.ref));
      const bkpSnap = await getDocs(query(collection(db, 'users', user.uid, 'bkp'), where('idTransaksi', '==', idTransaksi)));
      bkpSnap.forEach(d => batch.delete(d.ref));
      // Removed deletion of dana_punia items to prevent data loss in Dana Punia section
      await batch.commit();
  };

  const handleDeleteMultipleTransactions = async (idTransaksiList: string[]) => {
      if (!idTransaksiList || idTransaksiList.length === 0) return;
      const idSet = new Set(idTransaksiList);

      setJuData(prev => prev.filter(r => !idSet.has(r.idTransaksi)));
      setBkuData(prev => prev.filter(r => !idSet.has(r.idTransaksi)));
      setBkpData(prev => prev.filter(r => !idSet.has(r.idTransaksi)));

      if (!user?.uid) return;

      const chunkSize = 30;
      for (let i = 0; i < idTransaksiList.length; i += chunkSize) {
          const chunk = idTransaksiList.slice(i, i + chunkSize);
          let batch = writeBatch(db);
          let opCount = 0;

          const juSnap = await getDocs(query(collection(db, 'users', user.uid, 'jurnal_umum'), where('idTransaksi', 'in', chunk)));
          juSnap.forEach(d => {
              batch.delete(d.ref);
              opCount++;
          });

          const bkuSnap = await getDocs(query(collection(db, 'users', user.uid, 'bku'), where('idTransaksi', 'in', chunk)));
          bkuSnap.forEach(d => {
              batch.delete(d.ref);
              opCount++;
          });

          const bkpSnap = await getDocs(query(collection(db, 'users', user.uid, 'bkp'), where('idTransaksi', 'in', chunk)));
          bkpSnap.forEach(d => {
              batch.delete(d.ref);
              opCount++;
          });

          if (opCount > 0) {
              await batch.commit();
          }
      }
  };

  const handleBulkUpdateTransactions = async (
    txList: {
      idTransaksi: string;
      juRows: JuDisplayRow[];
      bkuRows: Omit<BkuData, 'id' | 'saldo'>[];
      bkpRows: Omit<BkpData, 'id' | 'saldo'>[];
    }[]
  ) => {
      if (!txList || txList.length === 0) return;
      const now = Date.now();

      if (!user?.uid) {
          const updatedIds = new Set(txList.map(t => t.idTransaksi));
          setJuData(prev => [
              ...prev.filter(r => !updatedIds.has(r.idTransaksi)),
              ...txList.flatMap(t => t.juRows)
          ]);
          setBkuData(prev => recalculateBkuSaldo([
              ...prev.filter(r => !updatedIds.has(r.idTransaksi)),
              ...txList.flatMap((t, tIdx) => t.bkuRows.map((b, bIdx) => ({
                  ...b,
                  id: `bku-${t.idTransaksi}-${bIdx}`,
                  idTransaksi: t.idTransaksi,
                  noBukti: t.idTransaksi,
                  bukti: t.idTransaksi,
                  saldo: 0,
                  createdAt: now + tIdx * 10 + bIdx
              })))
          ]));
          setBkpData(prev => recalculateBkpSaldo([
              ...prev.filter(r => !updatedIds.has(r.idTransaksi)),
              ...txList.flatMap((t, tIdx) => t.bkpRows.map((b, bIdx) => ({
                  ...b,
                  id: `bkp-${t.idTransaksi}-${bIdx}`,
                  idTransaksi: t.idTransaksi,
                  saldo: 0,
                  createdAt: now + 50 + tIdx * 10 + bIdx
              })))
          ]));
          return;
      }

      const chunkSize = 20;
      for (let i = 0; i < txList.length; i += chunkSize) {
          const chunk = txList.slice(i, i + chunkSize);
          const chunkIds = chunk.map(c => c.idTransaksi);
          let batch = writeBatch(db);

          const juSnap = await getDocs(query(collection(db, 'users', user.uid, 'jurnal_umum'), where('idTransaksi', 'in', chunkIds)));
          juSnap.forEach(d => batch.delete(d.ref));
          const bkuSnap = await getDocs(query(collection(db, 'users', user.uid, 'bku'), where('idTransaksi', 'in', chunkIds)));
          bkuSnap.forEach(d => batch.delete(d.ref));
          const bkpSnap = await getDocs(query(collection(db, 'users', user.uid, 'bkp'), where('idTransaksi', 'in', chunkIds)));
          bkpSnap.forEach(d => batch.delete(d.ref));

          chunk.forEach((tx, tIdx) => {
              tx.juRows.forEach((row, idx) => {
                  const rowId = `${tx.idTransaksi}-${idx}`;
                  const safeRow = {
                      rowId,
                      idTransaksi: tx.idTransaksi,
                      date: row.date,
                      kodeRekening: row.kodeRekening,
                      uraian: row.uraian,
                      debet: Number(row.debet) || 0,
                      kredit: Number(row.kredit) || 0,
                      rowType: row.rowType,
                      program: row.program || '',
                      createdAt: now + tIdx * 20 + idx
                  };
                  batch.set(doc(db, 'users', user.uid, 'jurnal_umum', rowId), safeRow);
              });

              tx.bkuRows.forEach((bku, idx) => {
                  const bkuId = `bku-${tx.idTransaksi}-${idx}`;
                  batch.set(doc(db, 'users', user.uid, 'bku', bkuId), {
                      ...bku,
                      id: bkuId,
                      idTransaksi: tx.idTransaksi,
                      noBukti: tx.idTransaksi,
                      bukti: tx.idTransaksi,
                      saldo: 0,
                      createdAt: now + tIdx * 20 + idx
                  });
              });

              tx.bkpRows.forEach((item, idx) => {
                  const bkpId = `bkp-${tx.idTransaksi}-${idx}`;
                  batch.set(doc(db, 'users', user.uid, 'bkp', bkpId), {
                      ...item,
                      id: bkpId,
                      idTransaksi: tx.idTransaksi,
                      saldo: 0,
                      createdAt: now + 50 + tIdx * 20 + idx
                  });
              });
          });

          await batch.commit();
      }
  };

  const handleResetAllData = async () => {
    // Clear local state immediately
    setBkuData([]);
    setBkpData([]);
    setJuData([]);
    setBudgetItems([]);
    setPepesonItems([]);
    setDanaPuniaItems([]);
    setUrunanItems([]);
    setManualBudgetCaps({
      'pendapatan': 0, 'belanja-rutin-insentif': 0, 'belanja-rutin-operasional': 0,
      'belanja-program-parhyangan': 0, 'belanja-program-pawongan': 0, 'belanja-program-palemahan': 0
    });
    setPenyetoranPajak(0);

    if (user?.uid) {
      try {
        const collectionsToClear = ['bku', 'bkp', 'jurnal_umum', 'anggaran', 'pepeson', 'dana_punia', 'urunan'];
        let batch = writeBatch(db);
        let count = 0;

        for (const colName of collectionsToClear) {
          const q = collection(db, 'users', user.uid, colName);
          const snap = await getDocs(q);
          for (const docSnap of snap.docs) {
            batch.delete(docSnap.ref);
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
        }

        const settingsRef = doc(db, 'users', user.uid, 'settings', 'general');
        batch.delete(settingsRef);
        count++;

        if (count > 0) {
          await batch.commit();
        }
      } catch (error) {
        console.error("Gagal menghapus data di database:", error);
      }
    }
  };

  const executeBackup = () => {
      let finalName = backupFilename.trim() || `Backup_Desa_${new Date().toISOString().split('T')[0]}`;
      
      const safeBku = sanitize(bkuData);
      const safeBkp = sanitize(bkpData);
      const safeJu = sanitize(juData);
      const safeBudget = sanitize(budgetItems);
      const safePepeson = sanitize(pepesonItems);
      const safeDanaPunia = sanitize(danaPuniaItems);
      const safeUrunan = sanitize(urunanItems);
      const safeSettings = sanitize({ penyetoranPajak, manualBudgetCaps });

      if (backupType === 'excel') {
          if (typeof XLSX === 'undefined') return;
          if (!finalName.endsWith('.xlsx')) finalName += '.xlsx';
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeBku), "BKU");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeBkp), "BKP");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeJu), "JurnalUmum");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeBudget), "Anggaran");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safePepeson), "Pepeson");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeDanaPunia), "DanaPunia");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeUrunan), "Urunan");
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([safeSettings]), "Settings");
          XLSX.writeFile(wb, finalName);
      } else if (backupType === 'json') {
          if (!finalName.endsWith('.json')) finalName += '.json';
          
          try {
              const data = collectAllPagesBackupData({
                bkuData,
                bkpData,
                juData,
                budgetItems,
                pepesonItems,
                danaPuniaItems,
                urunanItems,
                settings: { penyetoranPajak, manualBudgetCaps }
              });

              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = finalName;
              link.click();

              const totalKegiatan = countTotalKegiatan(data.pembuatan_anggaran_kegiatan);
              const pageConfigCount = Object.keys(data.page_signatures_and_settings || {}).length;

              showNotification(
                `Backup JSON Lengkap berhasil diunduh! Seluruh halaman & sub-halaman tercadangkan (${data.anggaran.length} Anggaran Kas, ${totalKegiatan} Rincian Kegiatan Semua Tahun, ${data.dana_punia.length} Dana Punia Semua Sub-Page, ${data.bku.length} BKU, ${data.bkp.length} BKP, ${data.jurnal_umum.length} Jurnal Umum, ${data.pepeson.length} Pepeson, ${data.urunan.length} Urunan, serta ${pageConfigCount} Pengaturan/TTD Halaman).`, 
                'success'
              );
          } catch (e) {
              console.error("JSON Backup Error:", e);
              showNotification("Gagal membuat file JSON karena struktur data bermasalah.", "error");
          }
      } else {
          if (typeof XLSX === 'undefined') return;
          if (!finalName.endsWith('.csv')) finalName += '.csv';
          const ws = XLSX.utils.json_to_sheet(safeBku);
          const csv = XLSX.utils.sheet_to_csv(ws);
          const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", finalName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
      setIsBackupModalOpen(false);
  };

  const handleBackupExcel = () => {
      setBackupType('excel');
      setBackupFilename(`Data_Keuangan_Desa_${new Date().toISOString().split('T')[0]}`);
      setIsBackupModalOpen(true);
  };

  const handleBackupJSON = () => {
      setBackupType('json');
      setBackupFilename(`Data_Keuangan_Desa_${new Date().toISOString().split('T')[0]}`);
      setIsBackupModalOpen(true);
  };

  const handleBackupCSV = () => {
      setBackupType('csv');
      setBackupFilename(`Backup_BKU_${new Date().toISOString().split('T')[0]}`);
      setIsBackupModalOpen(true);
  };

  const handleRestore = (file: File): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();

          const cleanNumericData = (arr: any[]) => {
              if (!arr || !Array.isArray(arr)) return [];
              return arr.map(row => {
                  const clean = { ...row };
                  if (clean.penerimaan !== undefined) clean.penerimaan = Number(clean.penerimaan) || 0;
                  if (clean.pengeluaran !== undefined) clean.pengeluaran = Number(clean.pengeluaran) || 0;
                  if (clean.debet !== undefined) clean.debet = Number(clean.debet) || 0;
                  if (clean.kredit !== undefined) clean.kredit = Number(clean.kredit) || 0;
                  if (clean.jumlah !== undefined) clean.jumlah = Number(clean.jumlah) || 0;
                  if (clean.total !== undefined) clean.total = Number(clean.total) || 0;
                  if (clean.saldo !== undefined) clean.saldo = Number(clean.saldo) || 0;
                  if (clean.qty !== undefined) clean.qty = Number(clean.qty) || 0;
                  if (clean.hargaSatuan !== undefined) clean.hargaSatuan = Number(clean.hargaSatuan) || 0;
                  if (clean.jumlahKrama !== undefined) clean.jumlahKrama = Number(clean.jumlahKrama) || 0;
                  if (clean.insentif !== undefined) clean.insentif = Number(clean.insentif) || 0;
                  if (clean.kehadiran !== undefined) clean.kehadiran = Number(clean.kehadiran) || 0;
                  if (clean.potongan !== undefined) clean.potongan = Number(clean.potongan) || 0;
                  if (clean.createdAt !== undefined) clean.createdAt = Number(clean.createdAt) || Date.now();
                  return clean;
              });
          };

          const processJsonData = async (data: any) => {
              try {
                  setIsOpLoading(true);
                  setOpProgress(5);
                  setOpStatusText("Membaca dan memverifikasi data backup JSON seluruh halaman...");

                  const restored = restoreAllPagesDataFromJSON(data);

                  const bkuCleaned = restored.bku;
                  const bkpCleaned = restored.bkp;
                  const juCleaned = restored.jurnal_umum;
                  const budgetCleaned = restored.anggaran;
                  const pepesonCleaned = restored.pepeson;
                  const danaPuniaCleaned = restored.dana_punia;
                  const urunanCleaned = restored.urunan;

                  const pajakVal = restored.penyetoranPajak;
                  const capsVal = restored.manualBudgetCaps;
                  const profileObj = restored.profile;

                  // Update React states immediately
                  if (bkuCleaned.length > 0) setBkuData(recalculateBkuSaldo(bkuCleaned));
                  if (bkpCleaned.length > 0) setBkpData(recalculateBkpSaldo(bkpCleaned));
                  if (juCleaned.length > 0) setJuData(juCleaned);
                  if (budgetCleaned.length > 0) setBudgetItems(budgetCleaned);
                  if (pepesonCleaned.length > 0) setPepesonItems(pepesonCleaned);
                  if (danaPuniaCleaned.length > 0) setDanaPuniaItems(danaPuniaCleaned);
                  if (urunanCleaned.length > 0) setUrunanItems(urunanCleaned);

                  if (pajakVal !== undefined) setPenyetoranPajak(Number(pajakVal) || 0);
                  if (capsVal) setManualBudgetCaps(prev => ({ ...prev, ...capsVal }));

                  // Save to Firestore if user logged in
                  if (user?.uid) {
                      const collections = [
                        { name: "anggaran", label: "Anggaran Kas", data: budgetCleaned },
                        { name: "dana_punia", label: "Dana Punia", data: danaPuniaCleaned },
                        { name: "urunan", label: "Urunan Krama", data: urunanCleaned },
                        { name: "bku", label: "Buku Kas Umum", data: bkuCleaned },
                        { name: "bkp", label: "Buku Kas Pembantu", data: bkpCleaned },
                        { name: "jurnal_umum", label: "Jurnal Umum", data: juCleaned },
                        { name: "pepeson", label: "Pepeson", data: pepesonCleaned }
                      ];

                      const collectionsState = collections.map(c => ({
                        label: c.label,
                        count: c.data.length,
                        done: false,
                        inProgress: false
                      }));

                      for (let index = 0; index < collections.length; index++) {
                          const col = collections[index];
                          const startPct = Math.round((index / collections.length) * 75) + 5;
                          setOpProgress(startPct);
                          setOpStatusText(`Memulihkan ${col.label} (${col.data.length} data)...`);

                          setOpDetails({
                            currentCollection: col.label,
                            currentCount: index + 1,
                            totalCount: collections.length,
                            collections: collectionsState.map((c, i) => ({
                              ...c,
                              done: i < index,
                              inProgress: i === index
                            }))
                          });

                          if (col.data.length > 0) {
                              const oldSnap = await getDocs(collection(db, 'users', user.uid, col.name));
                              let deleteBatch = writeBatch(db);
                              let delCount = 0;
                              for (const d of oldSnap.docs) {
                                  deleteBatch.delete(d.ref);
                                  delCount++;
                                  if (delCount >= 400) {
                                      await deleteBatch.commit();
                                      deleteBatch = writeBatch(db);
                                      delCount = 0;
                                  }
                              }
                              if (delCount > 0) {
                                  await deleteBatch.commit();
                              }

                              const chunkSize = 400;
                              for (let i = 0; i < col.data.length; i += chunkSize) {
                                  const chunk = col.data.slice(i, i + chunkSize);
                                  const currentBatch = writeBatch(db);
                                  chunk.forEach((row: any, rIdx: number) => {
                                      const id = String(row.id || row.rowId || `${col.name}-${Date.now()}-${i + rIdx}`);
                                      const ref = doc(db, 'users', user.uid, col.name, id);
                                      currentBatch.set(ref, sanitize(row));
                                  });
                                  await currentBatch.commit();
                              }
                          }

                          const finishStepPct = Math.round(((index + 1) / collections.length) * 75) + 5;
                          setOpProgress(finishStepPct);
                      }

                      if (pajakVal !== undefined || capsVal) {
                          setOpProgress(82);
                          setOpStatusText("Memulihkan Pengaturan & Pagu Anggaran...");
                          await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), sanitize({
                              penyetoranPajak: pajakVal !== undefined ? Number(pajakVal) : penyetoranPajak,
                              manualBudgetCaps: capsVal || manualBudgetCaps
                          }), { merge: true });
                      }

                      if (profileObj) {
                          setOpProgress(85);
                          setOpStatusText("Memulihkan Identitas Desa...");
                          await setDoc(doc(db, 'users', user.uid, 'settings', 'profile'), sanitize(profileObj), { merge: true });
                      }

                      // --- CHECKSUM & INTEGRITY VERIFICATION STEP ---
                      setOpProgress(88);
                      setOpStatusText("Memverifikasi checksum & integritas data Firestore...");

                      const computeChecksum = (colName: string, items: any[]) => {
                        let count = items.length;
                        let nominalSum = 0;
                        for (const item of items) {
                          if (colName === 'bku') {
                            nominalSum += (Number(item.penerimaan) || 0) + (Number(item.pengeluaran) || 0);
                          } else if (colName === 'bkp' || colName === 'jurnal_umum') {
                            nominalSum += (Number(item.debet) || 0) + (Number(item.kredit) || 0);
                          } else if (colName === 'anggaran') {
                            nominalSum += Number(item.jumlah) || 0;
                          } else if (colName === 'dana_punia') {
                            nominalSum += (Number(item.total) || Number(item.jumlah) || ((Number(item.hargaSatuan) || 0) * (Number(item.qty) || 1)) || 0);
                          } else if (colName === 'urunan') {
                            nominalSum += (Number(item.jumlah) || ((Number(item.jumlahKrama) || 0) * (Number(item.iuran) || 0)) || Number(item.total) || 0);
                          } else if (colName === 'pepeson') {
                            nominalSum += (Number(item.insentif) || Number(item.jumlah) || Number(item.total) || 0);
                          } else {
                            nominalSum += (Number(item.jumlah) || Number(item.total) || 0);
                          }
                        }
                        return { count, nominalSum: Math.round(nominalSum) };
                      };

                      const verificationDetails: {
                        name: string;
                        label: string;
                        expectedCount: number;
                        actualCount: number;
                        expectedSum: number;
                        actualSum: number;
                        match: boolean;
                      }[] = [];

                      let allCollectionsMatch = true;
                      const mismatches: string[] = [];

                      for (let vIdx = 0; vIdx < collections.length; vIdx++) {
                        const col = collections[vIdx];
                        const checkPct = 88 + Math.round(((vIdx + 1) / collections.length) * 10);
                        setOpProgress(checkPct);
                        setOpStatusText(`Verifikasi Checksum: ${col.label}...`);

                        const expectedCheck = computeChecksum(col.name, col.data);
                        const verifySnap = await getDocs(collection(db, 'users', user.uid, col.name));
                        const fetchedData: any[] = [];
                        verifySnap.forEach(d => fetchedData.push(d.data()));
                        const actualCheck = computeChecksum(col.name, fetchedData);

                        const countMatch = expectedCheck.count === actualCheck.count;
                        const sumMatch = expectedCheck.nominalSum === actualCheck.nominalSum;
                        const isMatch = countMatch && sumMatch;

                        if (!isMatch) {
                          allCollectionsMatch = false;
                          mismatches.push(`${col.label} (Expected: ${expectedCheck.count} baris / Rp ${expectedCheck.nominalSum.toLocaleString('id-ID')}, Firestore: ${actualCheck.count} baris / Rp ${actualCheck.nominalSum.toLocaleString('id-ID')})`);
                        }

                        verificationDetails.push({
                          name: col.name,
                          label: col.label,
                          expectedCount: expectedCheck.count,
                          actualCount: actualCheck.count,
                          expectedSum: expectedCheck.nominalSum,
                          actualSum: actualCheck.nominalSum,
                          match: isMatch
                        });
                      }

                      // Update collections state to done with verification checkmarks
                      setOpDetails({
                        currentCollection: allCollectionsMatch ? 'Verifikasi Checksum 100% Berhasil' : 'Verifikasi Checksum Selesai dengan Catatan',
                        currentCount: collections.length,
                        totalCount: collections.length,
                        collections: collections.map(c => {
                          const v = verificationDetails.find(vd => vd.name === c.name);
                          return {
                            label: c.label,
                            count: v ? v.actualCount : c.data.length,
                            done: v ? v.match : true,
                            inProgress: false
                          };
                        })
                      });

                      const totalCount = bkuCleaned.length + bkpCleaned.length + juCleaned.length + budgetCleaned.length + pepesonCleaned.length + danaPuniaCleaned.length + urunanCleaned.length;
                      setOpProgress(100);

                      if (allCollectionsMatch) {
                        setOpStatusText("Checksum Valid (100% Cocok)! Pemulihan seluruh halaman selesai.");
                        showNotification(`✅ Verifikasi Checksum Sukses (100% Presisi)! Seluruh ${totalCount} item di 7 buku keuangan, ${restored.kegiatanCount} rincian kegiatan pada Pembuatan Anggaran semua tahun, ${restored.dana_punia.length} dana punia di seluruh sub-halaman, dan ${restored.pageConfigCount} pengaturan/tanda tangan halaman terverifikasi utuh tanpa ada data yang hilang.`, 'success');
                      } else {
                        setOpStatusText("Pemulihan selesai dengan catatan ketidakcocokan.");
                        showNotification(`⚠️ Peringatan Checksum: Ditemukan selisih pada: ${mismatches.join('; ')}. Data telah dimuat ke antarmuka aplikasi.`, 'warning');
                      }
                  } else {
                      const totalCount = bkuCleaned.length + bkpCleaned.length + juCleaned.length + budgetCleaned.length + pepesonCleaned.length + danaPuniaCleaned.length + urunanCleaned.length;
                      setOpProgress(100);
                      setOpStatusText("Pemulihan selesai!");
                      showNotification(`Restorasi Sukses! Seluruh halaman & sub-halaman berhasil dipulihkan: ${totalCount} data buku keuangan, ${restored.kegiatanCount} rincian kegiatan Pembuatan Anggaran, ${restored.dana_punia.length} dana punia di seluruh sub-page, dan ${restored.pageConfigCount} pengaturan halaman.`, 'success');
                  }
                  resolve();
              } catch (err: any) {
                  console.error("Restore JSON error:", err);
                  showNotification(`Gagal memulihkan data JSON: ${err?.message || 'Pastikan file terformat JSON dengan benar.'}`, 'error');
                  reject(err);
              } finally {
                  setTimeout(() => {
                    setOpProgress(undefined);
                    setOpDetails(undefined);
                    setIsOpLoading(false);
                  }, 400);
              }
          };

          if (file.name.endsWith('.json')) {
              reader.onload = async (e) => {
                  try {
                      const text = e.target?.result as string;
                      const data = JSON.parse(text);
                      await processJsonData(data);
                  } catch (err) {
                      showNotification("Gagal membaca file JSON. Format file rusak atau tidak valid.", "error");
                      reject(err);
                  }
              };
              reader.onerror = (err) => {
                  showNotification("Gagal membaca file.", "error");
                  reject(err);
              };
              reader.readAsText(file);
          } else {
              if (typeof XLSX === 'undefined') {
                  showNotification("Modul Excel (XLSX) belum siap.", "error");
                  reject(new Error("XLSX not defined"));
                  return;
              }
              reader.onload = async (e) => {
                  try {
                      setIsOpLoading(true);
                      setOpProgress(10);
                      setOpStatusText("Membaca file Excel...");
                      const data = new Uint8Array(e.target?.result as ArrayBuffer);
                      const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
                      
                      const sheetsToImport = [
                        { sheet: "BKU", col: "bku", label: "Buku Kas Umum" },
                        { sheet: "BKP", col: "bkp", label: "Buku Kas Pembantu" },
                        { sheet: "JurnalUmum", col: "jurnal_umum", label: "Jurnal Umum" },
                        { sheet: "Anggaran", col: "anggaran", label: "Anggaran" },
                        { sheet: "Pepeson", col: "pepeson", label: "Pepeson" },
                        { sheet: "DanaPunia", col: "dana_punia", label: "Dana Punia" },
                        { sheet: "Urunan", col: "urunan", label: "Urunan" }
                      ];

                      for (let index = 0; index < sheetsToImport.length; index++) {
                          const item = sheetsToImport[index];
                          const stepPct = Math.round(((index + 1) / sheetsToImport.length) * 100);
                          setOpProgress(stepPct);
                          setOpStatusText(`Mengimpor sheet ${item.label} (${index + 1}/${sheetsToImport.length})...`);

                          if (workbook.SheetNames.includes(item.sheet)) {
                              const jsonData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[item.sheet], { raw: false });
                              const cleanRows = cleanNumericData(jsonData);

                              if (item.col === 'bku') setBkuData(recalculateBkuSaldo(cleanRows));
                              if (item.col === 'bkp') setBkpData(recalculateBkpSaldo(cleanRows));
                              if (item.col === 'jurnal_umum') setJuData(cleanRows);
                              if (item.col === 'anggaran') setBudgetItems(cleanRows);
                              if (item.col === 'pepeson') setPepesonItems(cleanRows);
                              if (item.col === 'dana_punia') setDanaPuniaItems(cleanRows);
                              if (item.col === 'urunan') setUrunanItems(cleanRows);

                              if (user?.uid) {
                                  const oldSnap = await getDocs(collection(db, 'users', user.uid, item.col));
                                  const deleteBatch = writeBatch(db);
                                  oldSnap.forEach(d => deleteBatch.delete(d.ref));
                                  await deleteBatch.commit();
                                  
                                  const chunkSize = 400;
                                  for (let i = 0; i < cleanRows.length; i += chunkSize) {
                                      const chunk = cleanRows.slice(i, i + chunkSize);
                                      const currentBatch = writeBatch(db);
                                      chunk.forEach((row: any, rIdx: number) => {
                                          const id = String(row.id || row.rowId || `${item.col}-${Date.now()}-${i + rIdx}`);
                                          const ref = doc(db, 'users', user.uid, item.col, id);
                                          currentBatch.set(ref, sanitize(row));
                                      });
                                      await currentBatch.commit();
                                  }
                              }
                          }
                      }
                      
                      if (workbook.SheetNames.includes("Settings")) {
                          const settingsRow = XLSX.utils.sheet_to_json(workbook.Sheets["Settings"])[0] as any;
                          if (settingsRow) {
                              const { penyetoranPajak: pp, ...caps } = sanitize(settingsRow);
                              if (pp !== undefined) setPenyetoranPajak(Number(pp) || 0);
                              if (caps) setManualBudgetCaps(prev => ({ ...prev, ...caps }));

                              if (user?.uid) {
                                  await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), {
                                      penyetoranPajak: Number(pp) || 0,
                                      manualBudgetCaps: caps || {}
                                  }, { merge: true });
                              }
                          }
                      }
                      
                      setOpProgress(100);
                      setOpStatusText("Impor Excel Selesai!");
                      showNotification("Data berhasil dipulihkan dari Excel.", "success");
                      resolve();
                  } catch (err: any) {
                      console.error("Restore Excel error:", err);
                      showNotification("Gagal memulihkan data dari Excel. Periksa format file.", "error");
                      reject(err);
                  } finally {
                      setOpProgress(undefined);
                      setIsOpLoading(false);
                  }
              };
              reader.readAsArrayBuffer(file);
          }
      });
  };

  const handleBkpReplace = async (newData: BkpData[]) => {
      if (!user?.uid) return;
      setIsOpLoading(true);
      try {
          const oldSnap = await getDocs(collection(db, 'users', user.uid, 'bkp'));
          const batch = writeBatch(db);
          oldSnap.forEach(d => batch.delete(d.ref));
          await batch.commit();

          const chunkSize = 400;
          for (let i = 0; i < newData.length; i += chunkSize) {
              const chunk = newData.slice(i, i + chunkSize);
              const curBatch = writeBatch(db);
              chunk.forEach((row, idx) => {
                  const id = row.id || `bkp-imp-${i + idx}`;
                  curBatch.set(doc(db, 'users', user.uid, 'bkp', id), sanitize({ ...row, id, createdAt: Date.now() + i + idx }));
              });
              await curBatch.commit();
          }
          alert("BKP berhasil diperbarui dari impor.");
      } finally {
          setIsOpLoading(false);
      }
  };

  const handleAddUrunan = async (item: UrunanItem) => {
    setUrunanItems(prev => [...prev.filter(i => i.id !== item.id), item]);
    if (!user?.uid) return;
    try {
        await setDoc(doc(db, 'users', user.uid, 'urunan', item.id), sanitize(item));
        playSaveSuccessSound();
    } catch (err) {
        console.error("Add urunan error:", err);
        playErrorSound();
    }
  };

  const handleUpdateUrunan = async (item: UrunanItem) => {
    setUrunanItems(prev => prev.map(i => i.id === item.id ? item : i));
    if (!user?.uid) return;
    try {
        await setDoc(doc(db, 'users', user.uid, 'urunan', item.id), sanitize(item));
        playEditSuccessSound();
    } catch (err) {
        console.error("Update urunan error:", err);
        playErrorSound();
    }
  };

  const handleDeleteUrunan = async (id: string) => {
    setUrunanItems(prev => prev.filter(i => i.id !== id));
    if (!user?.uid) return;
    try {
        await deleteDoc(doc(db, 'users', user.uid, 'urunan', id));
        playDeleteSuccessSound();
    } catch (err) {
        console.error("Delete urunan error:", err);
        playErrorSound();
    }
  };

  const handleAddBudgetItem = async (item: BudgetItem) => {
    const cleanItem = sanitize(item);
    setBudgetItems(prev => {
      const filtered = prev.filter(i => !(i.id === cleanItem.id || (i.kode === cleanItem.kode && (!i.tahun || i.tahun === cleanItem.tahun))));
      return [...filtered, cleanItem];
    });
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'anggaran', cleanItem.id), cleanItem);
    } catch (err) {
      console.error("Add budget error:", err);
    }
  };

  const handleUpdateBudgetItem = async (item: BudgetItem) => {
    const cleanItem = sanitize(item);
    setBudgetItems(prev => {
      const exists = prev.some(i => i.id === cleanItem.id);
      if (exists) {
        return prev.map(i => i.id === cleanItem.id ? cleanItem : i);
      }
      const filtered = prev.filter(i => !(i.kode === cleanItem.kode && (!i.tahun || i.tahun === cleanItem.tahun)));
      return [...filtered, cleanItem];
    });
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'anggaran', cleanItem.id), cleanItem);
    } catch (err) {
      console.error("Update budget error:", err);
    }
  };

  const handleDeleteBudgetItem = async (id: string) => {
    setBudgetItems(prev => prev.filter(i => i.id !== id));
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'anggaran', id));
    } catch (err) {
      console.error("Delete budget error:", err);
    }
  };

  const handleBatchSaveBudgetItems = async (items: BudgetItem[]) => {
    const cleanItems = items.map(sanitize);
    setBudgetItems(cleanItems);
    if (!user?.uid) return;
    try {
      setIsOpLoading(true);
      const batch = writeBatch(db);
      const oldSnap = await getDocs(collection(db, 'users', user.uid, 'anggaran'));
      oldSnap.forEach(d => batch.delete(d.ref));
      cleanItems.forEach(item => {
        batch.set(doc(db, 'users', user.uid, 'anggaran', item.id), item);
      });
      await batch.commit();
    } catch (err) {
      console.error("Batch save budget error:", err);
    } finally {
      setIsOpLoading(false);
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard': return (
        <Dashboard 
          entries={juData} 
          bkuData={bkuData} 
          danaPuniaItems={danaPuniaItems} 
          urunanItems={urunanItems} 
          budgetItems={budgetItems}
          manualBudgetCaps={manualBudgetCaps}
          setActivePage={setActivePage}
          onAddUrunan={handleAddUrunan}
          onOpenJurnalWithAccounts={handleOpenJurnalWithAccounts}
        />
      );
      case 'Ringkasan Eksekutif': return (
        <RingkasanEksekutif 
          entries={juData} 
          bkuData={bkuData} 
          danaPuniaItems={danaPuniaItems} 
          urunanItems={urunanItems} 
          budgetItems={budgetItems}
          manualBudgetCaps={manualBudgetCaps}
          setActivePage={setActivePage}
          onOpenJurnalWithAccounts={handleOpenJurnalWithAccounts}
        />
      );
      case 'Anggaran': return (
        <Anggaran 
          budgetItems={budgetItems}
          setBudgetItems={setBudgetItems}
          manualBudgetCaps={manualBudgetCaps}
          onSetManualBudgetCaps={setManualBudgetCaps}
          entries={juData}
          onAddBudgetItem={handleAddBudgetItem}
          onUpdateBudgetItem={handleUpdateBudgetItem}
          onDeleteBudgetItem={handleDeleteBudgetItem}
          onBatchSaveBudgetItems={handleBatchSaveBudgetItems}
          setActivePage={setActivePage}
        />
      );
      case 'Jurnal Umum': return (
        <JurnalUmum 
          entries={juData} 
          budgetItems={budgetItems} 
          bkuData={bkuData} 
          bkpData={bkpData} 
          urunanItems={urunanItems}
          onAddUrunan={handleAddUrunan}
          onSaveTransaction={handleSaveTransaction} 
          onDeleteTransaction={handleDeleteTransaction} 
          onDeleteMultipleTransactions={handleDeleteMultipleTransactions}
          onBulkUpdateTransactions={handleBulkUpdateTransactions}
          setActivePage={setActivePage} 
          initialAccounts={jurnalInitialAccounts}
          onClearInitialAccounts={() => setJurnalInitialAccounts(null)}
        />
      );
      case 'Buku Besar': return <BukuBesar entries={juData} bkuData={bkuData} bkpData={bkpData} budgetItems={budgetItems} onSubmit={() => {}} onBkpSubmit={() => {}} onDelete={handleDeleteTransaction} onReplaceBku={() => {}} />;
      case 'Buku Kas Umum': return <BukuKasUmum bkuData={bkuData} bkpData={bkpData} entries={juData} budgetItems={budgetItems} onSubmit={handleSaveTransaction} onDelete={handleDeleteTransaction} onReplace={() => {}} />;
      case 'Buku Kas Pembantu': return <BukuKasPembantu bkpData={bkpData} bkuData={bkuData} entries={juData} budgetItems={budgetItems} onSubmit={handleSaveTransaction} onDelete={handleDeleteTransaction} onReplace={handleBkpReplace} />;
      case 'Neraca': return <Neraca bkuData={bkuData} entries={juData} />;
      case 'Saldo Akhir': return <SaldoAkhir entries={juData} budgetItems={budgetItems} penyetoranPajak={penyetoranPajak} setPenyetoranPajak={setPenyetoranPajak} />;
      case 'Rekonsiliasi': return <Rekonsiliasi bkuTransactions={bkuData} bkpTransactions={bkpData} entries={juData} />;
      case 'Laporan Pendapatan & Belanja': return <LaporanRekonsiliasiAkhir entries={juData} budgetItems={budgetItems} manualBudgetCaps={manualBudgetCaps} />;
      case 'Dokumen Neraca': return <DokumenNeraca bkuData={bkuData} entries={juData} danaPuniaItems={danaPuniaItems} urunanItems={urunanItems} />;
      case 'Matriks Bulanan': return (
        <MatriksBulanan 
          entries={juData} 
          bkuData={bkuData} 
          budgetItems={budgetItems} 
          danaPuniaItems={danaPuniaItems} 
          urunanItems={urunanItems} 
          manualBudgetCaps={manualBudgetCaps}
          setActivePage={setActivePage}
          onOpenJurnalWithAccounts={handleOpenJurnalWithAccounts}
        />
      );
      case 'Formulir Neraca': return <FormulirNeraca entries={juData} bkuData={bkuData} bkpData={bkpData} budgetItems={budgetItems} danaPuniaItems={danaPuniaItems} urunanItems={urunanItems} />;
      case 'Rekapitulasi': return <Rekapitulasi entries={juData} danaPuniaItems={danaPuniaItems} budgetItems={budgetItems} />;
      case 'Pepeson': return <Pepeson items={pepesonItems} setItems={setPepesonItems} />;
      case 'Pengaturan': return (
        <Pengaturan 
          bkuData={bkuData} 
          bkpData={bkpData} 
          juData={juData} 
          budgetItems={budgetItems}
          pepesonItems={pepesonItems}
          danaPuniaItems={danaPuniaItems}
          urunanItems={urunanItems}
          manualBudgetCaps={manualBudgetCaps}
          penyetoranPajak={penyetoranPajak}
          onRestoreData={handleRestore}
          onResetAllData={handleResetAllData} 
        />
      );
      default: return <PlaceholderPage title={activePage} />;
    }
  };

  const isStartupLoading = isAuthChecking || (!!user && isDataInitializing);

  if (isStartupLoading) {
    return (
      <SplashScreen 
        onLogin={async () => {}} 
        onRegister={async () => {}} 
        isLoading={true} 
      />
    );
  }

  if (!user) {
    return (
      <SplashScreen 
        onLogin={async (e, p) => signInWithEmailAndPassword(auth, e, p)} 
        onRegister={async (e, p) => createUserWithEmailAndPassword(auth, e, p)} 
        isLoading={false} 
      />
    );
  }

  if (!isDisclaimerAccepted) {
    return (
      <DisclaimerPage 
        onContinue={() => { 
          setIsDisclaimerAccepted(true); 
          setActivePage('Dashboard'); 
        }} 
      />
    );
  }

  return (
    <>
      {isOpLoading && (
        <Spinner 
          text="Memproses Data Firebase..." 
          progress={opProgress} 
          progressText={opStatusText} 
          details={opDetails}
        />
      )}
      <Layout 
        activePage={activePage} setActivePage={setActivePage} 
        onLogout={() => {
          signOut(auth);
          setIsDisclaimerAccepted(false);
        }} 
        onBackupExcel={handleBackupExcel} 
        onBackupJSON={handleBackupJSON}
        onBackupCSV={handleBackupCSV} 
        onRestore={handleRestore} onReset={handleResetAllData}
        juData={juData}
        bkuData={bkuData}
        bkpData={bkpData}
      >
        {renderPage()}
      </Layout>

      <Modal isOpen={isBackupModalOpen} onClose={() => setIsBackupModalOpen(false)} title={`Simpan Backup ${backupType.toUpperCase()}`} className="max-w-md">
          <div className="space-y-4">
              <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-2 ml-1">Nama File Simpanan</label>
                  <input type="text" value={backupFilename} onChange={e => setBackupFilename(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-teal-500 outline-none" autoFocus />
              </div>
              <button onClick={executeBackup} className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 py-3 rounded-xl font-black text-white shadow-lg uppercase tracking-widest text-xs"><Download size={18}/> Download Sekarang</button>
          </div>
      </Modal>
    </>
  );
};

export default App;
