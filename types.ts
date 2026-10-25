
import type { LucideIcon } from 'lucide-react';

export interface SidebarMenuItem {
  name: string;
  icon: LucideIcon;
  sectionHeader?: string;
}

export interface MonthlyData {
  name: string;
  penerimaan: number;
  realisasi: number;
}

export interface CategoryData {
  name: string;
  value: number;
  [key: string]: any;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Penerimaan' | 'Realisasi' | 'Pendapatan' | 'Sumber Dana & Pendapatan';
  category: string;
}

export interface SummaryData {
  totalRevenue: number;
  totalExpenses: number;
  balance: number;
}

export interface BkuData {
  id: string;
  idTransaksi?: string; // Link ke Jurnal
  noBukti?: string;     // No. Bukti di BKU (sama dengan idTransaksi jurnal)
  bukti?: string;       // Alias nomor bukti
  tanggal: string;
  kode: string;
  uraian: string;
  kategori: string; 
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
  createdAt?: number; // Penanda urutan input
}

export interface BkpData {
  id: string;
  idTransaksi?: string; // Link ke Jurnal
  bkuId?: string; 
  tanggal: string;
  bukti: string;
  uraian: string;
  kategori: string; 
  debet: number; 
  kredit: number; 
  saldo: number;
  createdAt?: number; // Penanda urutan input
  namaAkun?: string;
  kode?: string;
  akunLawanCode?: string;
  akunLawanName?: string;
  subItems?: BkpData[];
  items?: Array<{ id?: string; name: string; qty: number; price: number }>;
}

export type BkuTransaction = BkuData;
export type BkpTransaction = BkpData;

export interface JuDisplayRow {
  rowId: string;
  idTransaksi?: string;
  date?: string;
  kodeRekening?: string;
  uraian: string;
  debet: number;
  kredit: number;
  rowType: 'debet' | 'kredit' | 'memo';
  program?: string;
  createdAt?: number; // Penanda urutan input
}

export interface BudgetItemKegiatan {
  id: string;
  namaKegiatan: string;
  jadwal: string;
  periode?: 'Bulanan' | 'Tahunan' | string;
  volume?: number;
  satuan?: string;
  isIndependen?: boolean;
  frekuensiKali?: number;
  nominalSatuan?: number;
  anggaran: number;
}

export interface RincianPaguItem {
  id: string;
  no?: number;
  uraian: string;
  qty: number;
  satuan: string;
  tarifSatuan: number;
  paguAnggaran: number;
}

export interface BudgetItem {
  id: string;
  kode: string;
  uraian: string;
  jumlah: number;
  type?: 'pendapatan' | 'belanja-rutin-insentif' | 'belanja-rutin-operasional' | 'belanja-program-parhyangan' | 'belanja-program-pawongan' | 'belanja-program-palemahan' | string;
  volume?: number;
  satuan?: string;
  hargaSatuan?: number;
  keterangan?: string;
  tahun?: string;
  kegiatanList?: BudgetItemKegiatan[];
  rincianList?: RincianPaguItem[];
}

// Data Pagu Manual per Kategori
export type BudgetTabType = BudgetItem['type'];
export type ManualBudgetCaps = Record<BudgetTabType, number>;

export interface PepesonItem {
    id: string;
    nama: string;
    krama: string;
    qty: number;
    satuan: string;
    jumlahKrama: number;
    total: number;
}

export interface UrunanItem {
    id: string;
    idTransaksi?: string;
    date: string;
    nama: string;
    uraian: string;
    jumlah: number;
    total: number;
}

export interface DanaPuniaItem {
    id: string;
    idTransaksi?: string;
    date?: string; // Tambahkan field tanggal
    type: 'uang' | 'tunai' | 'transfer' | 'sasah-abu' | 'barang' | 'lainnya';
    nama: string;
    alamat?: string;
    luasTanah?: number;
    uraian: string;
    qty: number;
    satuan: string;
    hargaSatuan?: number;
    jumlah: number;
    total: number;
}

export interface PeminjamData {
  id: string;
  tanggal?: string;
  kodeRekening?: string;
  kodePinjam?: string;
  nama: string;
  jumlahPinjaman?: number;
  pinjamanAwal?: number;
  sisaPinjaman?: number;
  sisaPokok?: number;
  status: string;
  telepon?: string;
}

export interface SetoranData {
  id: string;
  tanggal?: string;
  peminjamId?: string;
  namaPeminjam?: string;
  pokok?: number;
  bunga?: number;
  total?: number;
  jumlahSetoran?: number;
  uraian?: string;
}

export interface ReconciliationHistoryEntry {
  id: string;
  year?: string;
  month?: string;
  saldoAwal?: number;
  penerimaan?: number;
  pengeluaran?: number;
  saldoAkhir?: number;
  selisih?: number;
  status?: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  targetCloud: boolean;
  targetLocal: boolean;
  autoDownload: boolean;
  retentionDays: number;
  lastBackupDate?: string;
  lastBackupTime?: string;
}

export interface BackupHistoryItem {
  id: string;
  dateKey: string; // YYYY-MM-DD
  timestamp: number;
  formattedDate: string;
  sizeBytes: number;
  recordCounts: {
    bku: number;
    bkp: number;
    ju: number;
    anggaran: number;
    danaPunia: number;
    urunan: number;
    pepeson: number;
  };
  storageTargets: ('firebase_storage' | 'local_indexeddb')[];
  cloudPath?: string;
  cloudUrl?: string;
  isAuto: boolean;
  status: 'success' | 'warning' | 'error';
  statusMessage?: string;
  fullData?: any;
}

