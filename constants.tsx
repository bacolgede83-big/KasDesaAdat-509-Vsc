
import type { SidebarMenuItem } from './types';
import { LayoutDashboard, Book, BookCopy, BarChart2, Repeat, FileCheck2, ClipboardList, BookOpen, Scale, Settings, Landmark, CalendarDays } from 'lucide-react';

export const SIDEBAR_MENU: SidebarMenuItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, sectionHeader: 'MENU UTAMA' },
  { name: 'Ringkasan Eksekutif', icon: BarChart2 },
  { name: 'Anggaran', icon: Landmark, sectionHeader: 'PENDANAAN & ANGGARAN' },
  { name: 'Jurnal Umum', icon: ClipboardList, sectionHeader: 'MENU PEMBUKUAN' },
  { name: 'Buku Kas Umum', icon: Book },
  { name: 'Buku Kas Pembantu', icon: BookCopy },
  { name: 'Buku Besar', icon: BookOpen },
  { name: 'Neraca', icon: Scale, sectionHeader: 'AKUNTANSI & PELAPORAN' },
  { name: 'Laporan Pendapatan & Belanja', icon: FileCheck2 },
  { name: 'Dokumen Neraca', icon: BookOpen },
  { name: 'Matriks Bulanan', icon: CalendarDays },
  { name: 'Pengaturan', icon: Settings, sectionHeader: 'SETTING' },
];

// Standard Chart of Accounts (CoA) for Accounting
export const REFERENSI_REKENING = [
    // 1. ASET (ASSETS)
    // 1.1 Kas & Bank
    { code: '1.1.1.01', name: 'Kas Desa Adat' },
    { code: '1.1.1.02', name: 'Kas Juru Raksa(DesaAdat)' },
    { code: '1.1.1.03', name: 'Kas Sasah Abu' },
    { code: '1.1.1.04', name: 'Kas Dana Punia Tunai' },
    { code: '1.1.1.05', name: 'Kas Dana Punia Transfer' },
    { code: '1.1.1.06', name: 'Kas Punia Barang' },
    { code: '1.1.1.08', name: 'Kas Urunan' },
    { code: '1.1.1.09', name: 'Kas Lainnya' },

    // 1.1.2 Kas Khusus
    { code: '1.1.2.01', name: 'Kas Saldo Karya-18' },
    { code: '1.1.2.05', name: 'Kas Dana Kematian' },
    { code: '1.1.2.06', name: 'Kas Dana Pembangunan Desa' },
    { code: '1.1.2.07', name: 'Kas Tempekan' },

    // 1.2 Piutang
    { code: '1.2.1.01', name: 'Piutang Desa Adat' },

    // 2. KEWAJIBAN (LIABILITIES)
    { code: '2.1.1.01', name: 'Utang di Dana Shuttle' },
    { code: '2.1.1.02', name: 'Utang di Kas Saldo Karya' },
    { code: '2.1.1.03', name: 'Titipan Pajak (Belum Disetor)' },
    { code: '2.1.1.04', name: 'Utang Belanja/Rekanan' },
    { code: '2.1.1.05', name: 'Utang di Warung/Toko' },
    { code: '2.1.1.06', name: 'Utang Perlengkapan' },
    { code: '2.1.1.07', name: 'Utang Jangka Panjang' },
    { code: '2.1.1.08', name: 'Utang Jangka Pendek' },
    { code: '2.1.1.09', name: 'Utang Lainnya' },

    // 3. EKUITAS (EQUITY)
    { code: '3.1.1.01', name: 'Piutang Belum Terbayar' },
    { code: '3.1.1.06', name: 'Ekuitas/Modal' },
    { code: '3.1.1.07', name: 'Surplus / Defisit Periode Berjalan' },

    // 7. SUMBER DANA
    { code: '7.1.1.01', name: 'Hibah Provinsi (BKK)' },
    { code: '7.1.1.02', name: 'Hibah Kabupaten' },
    { code: '7.1.1.03', name: 'Sumber Dana Lainnya' },
    { code: '7.1.2.02', name: 'Urunan Krama' },
    { code: '7.1.2.03', name: 'Sumber Dana Lainnya' },

    // 4. PENDAPATAN (REVENUE)
    { code: '4.1.1.01', name: 'Pendapatan Dana Punia' },
    { code: '4.1.1.02', name: 'Pendapatan Penjualan' },

    { code: '4.1.1.03', name: 'Saldo Awal Kas Desa Adat' },
    { code: '4.1.1.04', name: 'Saldo Kas Desa Adat' },
    { code: '4.1.1.05', name: 'Saldo Kas JuruRaksa(Tunai)' },

    { code: '4.1.1.06', name: 'Pendapatan Desa Adat' },
    { code: '4.1.1.07', name: 'Pengembalian Dana Aci' },
    { code: '4.1.1.09', name: 'Pendapatan Bunga LPD' },
    { code: '4.1.1.08', name: 'Pendapatan Lain-lain' },

    { code: '4.1.1.10', name: 'Saldo Hibah(Prov)' },
    { code: '4.1.1.11', name: 'Saldo Hibah(Kab)' },
    { code: '4.1.1.12', name: 'Saldo Rehab' },
    { code: '4.1.1.13', name: 'Pendapatan Subsidi' },
    { code: '4.1.1.14', name: 'Pendapatan Penempek Desa' },
    
    { code: '4.1.3.01', name: 'Pendapatan Hibah Provinsi' },
    { code: '4.1.3.02', name: 'Pendapatan Hibah Kabupaten' },
    { code: '4.1.3.03', name: 'Pendapatan Administrasi Banjar' },
    { code: '4.1.3.04', name: 'Pendapatan Bunga Bank' },

    // 5.1.5 Operasional Adat
    { code: '5.1.5.01', name: 'Beban Gong' },
    { code: '5.1.5.02', name: 'Beban Peralatan' },
    { code: '5.1.5.05', name: 'Beban Kundangan' },
    { code: '5.1.5.06', name: 'Beban Dana Punia' },
    { code: '5.1.5.07', name: 'Beban Pesangkepan' },

    { code: '5.1.5.08', name: 'Belanja Alat Tulis Kantor (ATK)' },
    { code: '5.1.5.09', name: 'Belanja Konsumsi Paruman' },
    { code: '5.1.5.10', name: 'Belanja Internet' },
    { code: '5.1.5.11', name: 'Belanja BPJS/Asuransi' },
    { code: '5.1.5.12', name: 'Belanja Awig-awig/Perarem' },
    { code: '5.1.5.13', name: 'Belanja Perkara Adat' },
    { code: '5.1.5.14', name: 'Belanja Listrik' },
    { code: '5.1.5.15', name: 'Beban PDAM' },
    { code: '5.1.5.16', name: 'Beban Transportasi' },
    { code: '5.1.5.17', name: 'Beban Lainnya' },

    // PROGRAM
    // 5.2.1 Parhyangan Desa Adat
    { code: '5.2.1.01', name: 'Pecanangan' },
    { code: '5.2.1.02', name: 'Dana Aci Melanting' },
    { code: '5.2.1.03', name: 'Dana Aci Usabe Dalem' },
    { code: '5.2.1.04', name: 'Dana Aci BaleAgung' },
    { code: '5.2.1.05', name: 'Dana Aci Pura Puseh' },
    { code: '5.2.1.07', name: 'Upakara & Aci (Galungan)' },
    { code: '5.2.1.08', name: 'Upakara & Aci (Kuningan)' },
    { code: '5.2.1.09', name: 'Aci Melanting & Dalem 2025' },
    { code: '5.2.1.10', name: 'Dana Aci Pura UlunSuwi' },
    { code: '5.2.1.11', name: 'Dana Aci Lainnya' },
    { code: '5.2.1.12', name: 'Parhyangan Lainnya' },
    { code: '5.2.1.13', name: 'Parhyangan Prov.' },

    // 5.3.2 Pawongan Desa Adat
    { code: '5.3.2.01', name: 'Dana Kematian' },
    { code: '5.3.2.02', name: 'Dana Santunan' },
    { code: '5.3.2.03', name: 'Bulan Bahasa ( Provinsi )' },
    { code: '5.3.2.04', name: 'Pawongan Lainnya' },

    // 5.4 Palemahan
    { code: '5.4.1.01', name: 'Renovasi di Pura BaleAgung ( Mrade BaleAgung )' },
    { code: '5.4.1.02', name: 'Renovasi di Pura Puseh' },
    { code: '5.4.1.03', name: 'Bak Sampah ( Provinsi )' },
    { code: '5.4.1.04', name: 'Pengelolaan Sampah' },
    { code: '5.4.1.05', name: 'Penataan Wewidangan' },
    { code: '5.4.1.06', name: 'Pemeliharaan Setra' },
    { code: '5.4.1.07', name: 'Renovasi di Pura Dalem' },
    { code: '5.4.1.08', name: 'Renovasi di Pura Melanting' },
    { code: '5.4.1.10', name: 'Renovasi di Pura UlunSuwi' },
    { code: '5.4.1.11', name: 'Renovasi di Pura Pesimpenan' },
    { code: '5.4.1.09', name: 'Palemahan Lainnya' },


    { code: '6.1.1.01', name: 'Silpa Tahun Sebelumnya' },
];

/**
 * Memeriksa apakah sebuah kode rekening termasuk dalam kelompok Aset Kas & Bank (1.1.*)
 * Sesuai Standar Akuntansi Nasional / SAP / SAK EMKM: Seluruh akun Kas & Setara Kas diawali dengan 1.1.*
 */
export const isKasAccount = (code: string | undefined | null): boolean => {
    if (!code) return false;
    const cleanCode = code.split(' - ')[0].trim();
    return cleanCode.startsWith('1.1.') || cleanCode === '1.1';
};

/**
 * Mendapatkan nama kategori berdasarkan kode rekening (REFERENSI_REKENING).
 * Khususnya untuk Beban (5.x.x.x) akan menghasilkan kategori spesifik sesuai kode,
 * contoh: 5.1.1.01 -> Bebantenan, 5.1.2.01 -> Beban Listrik, 5.2.1.01 -> Beras, dsb.
 */
export const getKategoriFromAccountCode = (code: string): string => {
    if (!code) return 'Umum';
    const cleanCode = code.split(' - ')[0].trim();
    const match = REFERENSI_REKENING.find(r => r.code === cleanCode);
    if (match) {
        return match.name;
    }
    if (code.includes(' - ')) {
        const parts = code.split(' - ');
        if (parts[1]?.trim()) return parts[1].trim();
    }
    return 'Umum';
};

/**
 * Mendapatkan kategori BKU/BKP untuk transaksi Jurnal Umum berdasarkan pasangan akun Debet dan Kredit.
 */
export const getKategoriForBkuTx = (akunDebet: string, akunKredit: string, isDebetKas: boolean): string => {
    // Jika Kas di Debet (penerimaan BKU), kategori mengacu pada akun Kredit (Pendapatan/Lainnya)
    // Jika Kas di Kredit (pengeluaran BKU), kategori mengacu pada akun Debet (Beban/Lainnya)
    const targetCode = isDebetKas ? akunKredit : akunDebet;
    return getKategoriFromAccountCode(targetCode);
};

export const KATEGORI_BELANJA_OPTIONS = [
    'Belanja Alat Tulis Kantor (ATK)',
    'Belanja Konsumsi Paruman',
    'Belanja Listrik',
    'Beban PDAM',
    'Belanja Internet',
    'Belanja BPJS/Asuransi',
    'Belanja Awig-awig/Perarem',
    'Belanja Perkara Adat',
    'Beban Transportasi',
    'Beban Gong',
    'Beban Peralatan',
    'Beban Kundangan',
    'Beban Dana Punia',
    'Beban Pesangkepan',
    'Beban Lainnya',  
    'Pecanangan',
    'Dana Aci Melanting',
    'Dana Aci Usabe Dalem',
    'Dana Aci BaleAgung',
    'Dana Aci Pura Puseh',
    'Upakara & Aci (Galungan)',
    'Upakara & Aci (Kuningan)',  
    'Aci Melanting & Dalem 2025',
    'Dana Aci Pura UlunSuwi',
    'Dana Aci Lainnya',
    'Parhyangan Lainnya',
    'Dana Kematian',
    'Dana Santunan',
    'Bulan Bahasa ( Provinsi )',
    'Pawongan Lainnya',
    'Pengelolaan Sampah',
    'Penataan Wewidangan',
    'Pemeliharaan Setra',
    'Renovasi di Pura BaleAgung ( Mrade BaleAgung )',
    'Renovasi di Pura Puseh',
    'Renovasi di Pura Dalem (Undag)',
    'Renovasi di Pura Melanting',
    'Renovasi di Pura UlunSuwi',
    'Renovasi di Pura Pesimpenan',
    'Palemahan Lainnya',
    'Operasional',
];

/**
 * Menghasilkan kategori / pos belanja yang akurat dan terstandardisasi untuk Nota Belanja & BKP
 * berdasarkan nama akun lawan, kode akun transaksi dari REFERENSI_REKENING, atau uraian transaksi.
 */
export const getPosBelanjaFromTransaction = (item?: {
    code?: string;
    akunLawanCode?: string;
    namaAkun?: string;
    akunLawanName?: string;
    kategori?: string;
    uraian?: string;
} | null): string => {
    if (!item) return 'Belanja Operasional / Rutin';

    // 1. Jika nama akun lawan / pos belanja sudah terdefinisi secara spesifik dari transaksi
    const directAccountName = (item.akunLawanName || item.namaAkun || '').trim();
    if (directAccountName && directAccountName !== 'Umum' && !directAccountName.startsWith('1.1')) {
        return directAccountName;
    }

    const rawCode = item.akunLawanCode || item.code || '';
    const cleanCode = rawCode.split(' - ')[0].trim();
    const uraianLower = (item.uraian || '').toLowerCase();
    const kategori = (item.kategori || '').trim();

    // 2. Cocokkan langsung ke REFERENSI_REKENING untuk mendapatkan nama akun resmi yang 100% akurat
    if (cleanCode) {
        const refMatch = REFERENSI_REKENING.find(r => r.code === cleanCode);
        if (refMatch) {
            return refMatch.name;
        }
    }

    // 3. Cek jika kategori bawaan transaksi sudah spesifik (bukan generic)
    if (kategori && kategori !== 'Umum' && kategori !== 'Belanja Operasional / Rutin' && kategori !== 'Belanja & Operasional Upakara Aci Usaba Dalem') {
        return kategori;
    }

    // 4. Analisis Kata Kunci Uraian Transaksi
    if (uraianLower.includes('atk') || uraianLower.includes('kertas') || uraianLower.includes('tinta') || uraianLower.includes('alat tulis') || uraianLower.includes('buku')) {
        return 'Belanja Alat Tulis Kantor (ATK)';
    }
    if (uraianLower.includes('konsumsi') || uraianLower.includes('nasi') || uraianLower.includes('snack') || uraianLower.includes('makan') || uraianLower.includes('minum') || uraianLower.includes('kue')) {
        return 'Belanja Konsumsi Paruman';
    }
    if (uraianLower.includes('listrik') || uraianLower.includes('pln') || uraianLower.includes('token')) {
        return 'Belanja Listrik';
    }
    if (uraianLower.includes('pdam') || uraianLower.includes('air')) {
        return 'Beban PDAM';
    }
    if (uraianLower.includes('internet') || uraianLower.includes('wifi') || uraianLower.includes('kuota') || uraianLower.includes('pulsa')) {
        return 'Belanja Internet';
    }
    if (uraianLower.includes('gong') || uraianLower.includes('gambelan')) {
        return 'Beban Gong';
    }
    if (uraianLower.includes('kematian') || uraianLower.includes('santunan')) {
        return 'Dana Kematian';
    }
    if (uraianLower.includes('sampah') || uraianLower.includes('kebersihan')) {
        return 'Pengelolaan Sampah';
    }
    if (uraianLower.includes('setra') || uraianLower.includes('kuburan')) {
        return 'Pemeliharaan Setra';
    }
    if (uraianLower.includes('pura') || uraianLower.includes('aci') || uraianLower.includes('banten') || uraianLower.includes('canang') || uraianLower.includes('daksina') || uraianLower.includes('sesari') || uraianLower.includes('upakara') || uraianLower.includes('galungan') || uraianLower.includes('kuningan') || uraianLower.includes('melanting') || uraianLower.includes('dalem') || uraianLower.includes('baleagung') || uraianLower.includes('puseh')) {
        return 'Parhyangan';
    }

    return getKategoriFromAccountCode(cleanCode) || 'Operasional';
};

