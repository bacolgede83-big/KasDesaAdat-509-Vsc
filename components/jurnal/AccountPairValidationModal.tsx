import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowRight, ArrowLeftRight, CheckCircle2, AlertTriangle, AlertCircle, 
  X, Check, HelpCircle, ShieldCheck, RefreshCw, BookOpen, Layers
} from 'lucide-react';
import { REFERENSI_REKENING, isKasAccount } from '../../constants';

export interface AccountPairAnalysis {
  status: 'valid' | 'warning' | 'error' | 'reversed';
  title: string;
  transactionType: string;
  flowDescriptionDebet: string;
  flowDescriptionKredit: string;
  cashEffect: 'keluar' | 'masuk' | 'mutasi' | 'non-kas';
  detailedNote: string;
  recommendation: string;
  canSwap: boolean;
}

export const analyzeAccountPair = (debetCodeRaw: string, kreditCodeRaw: string): AccountPairAnalysis => {
  const debetCode = debetCodeRaw.split(' - ')[0].trim();
  const kreditCode = kreditCodeRaw.split(' - ')[0].trim();

  // 1. Akun Sama
  if (debetCode && kreditCode && debetCode === kreditCode) {
    return {
      status: 'error',
      title: 'Kesalahan: Akun Debet dan Kredit Sama',
      transactionType: 'TRANSAKSI TIDAK VALID',
      flowDescriptionDebet: `Akun ${debetCode} didebet`,
      flowDescriptionKredit: `Akun ${kreditCode} dikredit`,
      cashEffect: 'non-kas',
      detailedNote: 'Dalam kaidah akuntansi pembukuan berpasangan, akun Debet dan Akun Kredit tidak boleh menggunakan kode rekening yang sama dalam satu transaksi jurnal.',
      recommendation: 'Silahkan pilih salah satu akun yang berbeda untuk sisi Debet atau Kredit.',
      canSwap: false
    };
  }

  const isDebetKas = isKasAccount(debetCode) || debetCode.startsWith('1.1.1');
  const isKreditKas = isKasAccount(kreditCode) || kreditCode.startsWith('1.1.1');
  const isDebetBelanja = debetCode.startsWith('5.');
  const isKreditBelanja = kreditCode.startsWith('5.');
  const isDebetPendapatan = debetCode.startsWith('4.');
  const isKreditPendapatan = kreditCode.startsWith('4.');
  const isDebetHutang = debetCode.startsWith('2.');
  const isKreditHutang = kreditCode.startsWith('2.');
  const isDebetEkuitas = debetCode.startsWith('3.');
  const isKreditEkuitas = kreditCode.startsWith('3.');
  const isDebetSumberDana = debetCode.startsWith('7.') || debetCode.startsWith('6.');
  const isKreditSumberDana = kreditCode.startsWith('7.') || kreditCode.startsWith('6.');

  // 2. Terbalik: Belanja di Kredit & Kas di Debet
  if (isDebetKas && isKreditBelanja) {
    return {
      status: 'reversed',
      title: 'Kemungkinan Terbalik: Kas didebet, Belanja dikredit',
      transactionType: 'POTENSI KESALAHAN POSISI AKUN',
      flowDescriptionDebet: 'Kas bertambah (Debet)',
      flowDescriptionKredit: 'Belanja berkurang (Kredit)',
      cashEffect: 'masuk',
      detailedNote: 'Jika transaksi ini adalah PENGELUARAN KAS untuk belanja/kegiatan desa adat, maka posisi ini TERBALIK. Akun Belanja (5.*) seharusnya berada di sisi DEBET, dan Kas (1.1.1.*) berada di sisi KREDIT.',
      recommendation: 'Klik tombol "Tukar Posisi (Debet ⇄ Kredit)" di bawah agar pencatatan sesuai kaidah akuntansi pengeluaran kas.',
      canSwap: true
    };
  }

  // 3. Terbalik: Pendapatan di Debet & Kas di Kredit
  if (isDebetPendapatan && isKreditKas) {
    return {
      status: 'reversed',
      title: 'Kemungkinan Terbalik: Pendapatan didebet, Kas dikredit',
      transactionType: 'POTENSI KESALAHAN POSISI AKUN',
      flowDescriptionDebet: 'Pendapatan berkurang (Debet)',
      flowDescriptionKredit: 'Kas berkurang (Kredit)',
      cashEffect: 'keluar',
      detailedNote: 'Jika transaksi ini adalah PENERIMAAN KAS dari pendapatan/punia/iuran desa adat, posisi ini TERBALIK. Kas (1.1.1.*) seharusnya didebet (bertambah), dan Pendapatan (4.*) dikredit (diakui bertambah).',
      recommendation: 'Klik tombol "Tukar Posisi (Debet ⇄ Kredit)" di bawah untuk membetulkan posisi akun.',
      canSwap: true
    };
  }

  // 4a. Khusus: Kas Hibah Provinsi (1.1.2.02 / 1.1.2.04) vs Akun Belanja Debet
  if (isDebetBelanja && (kreditCode === '1.1.2.02' || kreditCode === '1.1.2.04')) {
    if (debetCode.startsWith('5.1.4') || debetCode.startsWith('5.2.3')) {
      return {
        status: 'error',
        title: 'Akun Debet 5.1.4 & 5.2.3 Non-Aktif untuk Kas Hibah Provinsi',
        transactionType: 'ALOKASI DANA TIDAK SESUAI',
        flowDescriptionDebet: `Beban ${debetCode} (Belanja Hibah Kabupaten) didebet`,
        flowDescriptionKredit: `Kas ${kreditCode} (Kas Hibah Provinsi) dikredit`,
        cashEffect: 'keluar',
        detailedNote: `Kas Hibah Provinsi (${kreditCode}) tidak diperkenankan untuk mendanai belanja peruntukan Hibah Kabupaten. Akun 5.1.4 (Beban Insentif Prajuru Kabupaten) dan 5.2.3 (Parhyangan Hibah Kabupaten) dinonaktifkan jika kredit adalah Kas Hibah Provinsi.`,
        recommendation: 'Ganti akun Debet ke pos belanja kegiatan Hibah Provinsi (5.1.1, 5.2.2, 5.3, 5.4) atau ubah akun Kredit ke Kas Hibah Kabupaten.',
        canSwap: false
      };
    }
  }

  // 4b. Khusus: Kas Hibah Kabupaten (1.1.2.03) vs Akun Belanja Debet
  if (isDebetBelanja && kreditCode === '1.1.2.03') {
    const isAllowed = debetCode.startsWith('5.1.4') || debetCode.startsWith('5.2.3');
    if (!isAllowed) {
      return {
        status: 'error',
        title: 'Hanya Akun 5.1.4 & 5.2.3 Yang Aktif untuk Kas Hibah Kabupaten',
        transactionType: 'ALOKASI DANA TIDAK SESUAI',
        flowDescriptionDebet: `Beban ${debetCode} didebet`,
        flowDescriptionKredit: `Kas ${kreditCode} (Kas Hibah Kabupaten) dikredit`,
        cashEffect: 'keluar',
        detailedNote: `Sumber dana Kas Hibah Kabupaten (${kreditCode}) terikat khusus untuk pos belanja Hibah Kabupaten. Akun belanja yang aktif di debet hanya 5.1.4 (Beban Insentif Prajuru Kabupaten) dan 5.2.3 (Parhyangan Hibah Kabupaten).`,
        recommendation: 'Pilih akun Debet 5.1.4.* (Insentif) atau 5.2.3.* (Parhyangan Kabupaten) sesuai peruntukan dana hibah kabupaten.',
        canSwap: false
      };
    } else {
      return {
        status: 'valid',
        title: 'Pengeluaran Belanja Dana Hibah Kabupaten (Sesuai Peruntukan)',
        transactionType: 'PENGELUARAN KAS HIBAH KABUPATEN',
        flowDescriptionDebet: `Beban Hibah Kabupaten (${debetCode}) bertambah (Debet)`,
        flowDescriptionKredit: `Kas Hibah Kabupaten (${kreditCode}) dikeluarkan (Kredit)`,
        cashEffect: 'keluar',
        detailedNote: `Posisi akun SANGAT TEPAT. Pengeluaran kas belanja hibah kabupaten (${kreditCode}) dialokasikan ke pos peruntukan kabupaten (${debetCode}).`,
        recommendation: 'Posisi akun sudah sesuai dengan juknis belanja hibah kabupaten. Silahkan lanjutkan pengisian nominal dan uraian.',
        canSwap: true
      };
    }
  }

  // 4c. Khusus: Kas Dana Kematian (1.1.2.05) vs Akun Debet - HANYA boleh Dana Kematian (5.3.2.01)
  if (kreditCode === '1.1.2.05') {
    const isDanaKematian = debetCode === '5.3.2.01' || debetCode.startsWith('5.3.2.01');
    if (!isDanaKematian) {
      return {
        status: 'error',
        title: 'Akun Debet Hanya Boleh Dana Kematian (5.3.2.01)',
        transactionType: 'ALOKASI DANA KEMATIAN KHUSUS',
        flowDescriptionDebet: `Akun ${debetCode} didebet`,
        flowDescriptionKredit: `Kas Dana Kematian (1.1.2.05) dikredit`,
        cashEffect: 'keluar',
        detailedNote: `Pengeluaran dari Kas Dana Kematian (1.1.2.05) secara khusus hanya diperuntukkan bagi beban Dana Kematian (5.3.2.01). Akun debet lainnya dinonaktifkan.`,
        recommendation: 'Ubah akun Debet ke 5.3.2.01 (Dana Kematian).',
        canSwap: false
      };
    } else {
      return {
        status: 'valid',
        title: 'Pengeluaran Kas Dana Kematian (5.3.2.01)',
        transactionType: 'PENGELUARAN KAS DANA KEMATIAN',
        flowDescriptionDebet: `Beban Dana Kematian (5.3.2.01) bertambah (Debet)`,
        flowDescriptionKredit: `Kas Dana Kematian (1.1.2.05) dikeluarkan (Kredit)`,
        cashEffect: 'keluar',
        detailedNote: 'Posisi akun SANGAT TEPAT. Pengeluaran dari Kas Dana Kematian dialokasikan langsung ke pos beban Dana Kematian.',
        recommendation: 'Posisi akun sudah sesuai aturan. Silahkan lanjutkan pengisian nominal dan uraian transaksi.',
        canSwap: false
      };
    }
  }

  // 4. Pengeluaran Kas untuk Belanja (Normal)
  if (isDebetBelanja && isKreditKas) {
    return {
      status: 'valid',
      title: 'Transaksi Pengeluaran Kas (Belanja / Beban)',
      transactionType: 'PENGELUARAN KAS (BELANJA)',
      flowDescriptionDebet: 'Beban / Belanja dicatat bertambah (Debet)',
      flowDescriptionKredit: 'Kas / Bank berkurang dikeluarkan (Kredit)',
      cashEffect: 'keluar',
      detailedNote: 'Posisi akun sudah TEPAT. Transaksi ini akan mencatat pengeluaran di Buku Kas Umum (BKU) dan Buku Kas Pembantu (BKP) terkait.',
      recommendation: 'Posisi akun sudah benar. Silahkan lanjutkan pengisian nominal dan uraian transaksi.',
      canSwap: true
    };
  }

  // 5a. Khusus: Penerimaan Kas Dana Hibah Provinsi (4.1.3.01)
  if (isDebetKas && kreditCode === '4.1.3.01') {
    const isRecommended = ['1.1.2.02', '1.1.2.04', '1.1.1.02', '1.1.1.01'].includes(debetCode);
    return {
      status: 'valid',
      title: 'Penerimaan Dana Hibah / BKK Provinsi Bali (4.1.3.01)',
      transactionType: 'PENERIMAAN HIBAH PROVINSI',
      flowDescriptionDebet: `Kas penerima (${debetCode}) bertambah (Debet)`,
      flowDescriptionKredit: 'Pendapatan Hibah Provinsi (4.1.3.01) diakui (Kredit)',
      cashEffect: 'masuk',
      detailedNote: isRecommended
        ? `Posisi akun SANGAT TEPAT. Akun Debet ${debetCode} merupakan rekomendasi resmi rekening penampung dana BKK/Hibah Provinsi.`
        : `Posisi akun sah sebagai penerimaan kas. Rekomendasi utama rekening penampung BKK Provinsi: 1.1.2.02 (Kas Hibah Prov LPD), 1.1.2.04 (Kas JuruRaksa HibProv), 1.1.1.02, atau 1.1.1.01.`,
      recommendation: 'Posisi akun sudah sesuai dengan juknis pencatatan dana hibah provinsi. Silahkan lanjutkan pengisian nominal dan uraian.',
      canSwap: true
    };
  }

  // 5b. Khusus: Penerimaan Kas Dana Hibah Kabupaten (4.1.3.02)
  if (isDebetKas && kreditCode === '4.1.3.02') {
    const isRecommended = ['1.1.2.03', '1.1.1.02', '1.1.1.01'].includes(debetCode);
    return {
      status: 'valid',
      title: 'Penerimaan Dana Hibah Pemerintah Kabupaten (4.1.3.02)',
      transactionType: 'PENERIMAAN HIBAH KABUPATEN',
      flowDescriptionDebet: `Kas penerima (${debetCode}) bertambah (Debet)`,
      flowDescriptionKredit: 'Pendapatan Hibah Kabupaten (4.1.3.02) diakui (Kredit)',
      cashEffect: 'masuk',
      detailedNote: isRecommended
        ? `Posisi akun SANGAT TEPAT. Akun Debet ${debetCode} merupakan rekomendasi resmi rekening penampung dana Hibah Kabupaten.`
        : `Posisi akun sah sebagai penerimaan kas. Rekomendasi utama rekening penampung Hibah Kabupaten: 1.1.2.03 (Kas Hibah Kab LPD), 1.1.1.02, atau 1.1.1.01.`,
      recommendation: 'Posisi akun sudah sesuai dengan juknis pencatatan dana hibah kabupaten. Silahkan lanjutkan pengisian nominal dan uraian.',
      canSwap: true
    };
  }

  // 5. Penerimaan Kas dari Pendapatan / Punia (Normal)
  if (isDebetKas && (isKreditPendapatan || isKreditSumberDana)) {
    return {
      status: 'valid',
      title: 'Transaksi Penerimaan Kas (Pendapatan / Punia)',
      transactionType: 'PENERIMAAN KAS (PENDAPATAN)',
      flowDescriptionDebet: 'Kas / Bank bertambah diterima (Debet)',
      flowDescriptionKredit: 'Pendapatan / Sumber Dana bertambah (Kredit)',
      cashEffect: 'masuk',
      detailedNote: 'Posisi akun sudah TEPAT. Transaksi ini akan menambah saldo Kas di BKU dan Buku Kas Pembantu Penerimaan.',
      recommendation: 'Posisi akun sudah benar. Silahkan lanjutkan pengisian nominal dan uraian transaksi.',
      canSwap: true
    };
  }

  // 6. Mutasi Kas Antar Rekening (Normal)
  if (isDebetKas && isKreditKas) {
    return {
      status: 'valid',
      title: 'Mutasi Saldo Kas Antar Rekening',
      transactionType: 'MUTASI KAS INTERNAL',
      flowDescriptionDebet: 'Kas Penerima bertambah (Debet)',
      flowDescriptionKredit: 'Kas Pengirim berkurang (Kredit)',
      cashEffect: 'mutasi',
      detailedNote: 'Transaksi pemindahan dana antar rekening (misal penarikan kas dari Bank ke Bendahara, atau penyetoran ke rekening Bank). Total kas bersih desa tidak berubah, hanya berpindah pos.',
      recommendation: 'Pastikan rekening debet (yang menerima dana) dan rekening kredit (yang mengeluarkan dana) sudah sesuai tujuan pemindahan kas.',
      canSwap: true
    };
  }

  // 7. Pelunasan Hutang (Normal)
  if (isDebetHutang && isKreditKas) {
    return {
      status: 'valid',
      title: 'Pelunasan Hutang / Kewajiban',
      transactionType: 'PELUNASAN HUTANG',
      flowDescriptionDebet: 'Kewajiban / Hutang berkurang (Debet)',
      flowDescriptionKredit: 'Kas berkurang dibayarkan (Kredit)',
      cashEffect: 'keluar',
      detailedNote: 'Posisi akun sudah TEPAT. Transaksi ini akan melunasi atau mengurangi saldo hutang rekanan di Neraca dan mengurangi saldo Kas di BKU.',
      recommendation: 'Posisi akun sudah benar untuk transaksi pembayaran hutang.',
      canSwap: true
    };
  }

  // 8. Timbul Hutang Baru / Pinjaman Diterima
  if (isDebetKas && isKreditHutang) {
    return {
      status: 'valid',
      title: 'Penerimaan Dana dari Kewajiban / Hutang',
      transactionType: 'PENERIMAAN DARI HUTANG',
      flowDescriptionDebet: 'Kas bertambah diterima (Debet)',
      flowDescriptionKredit: 'Kewajiban / Hutang bertambah (Kredit)',
      cashEffect: 'masuk',
      detailedNote: 'Mencatat penambahan kas yang bersumber dari pinjaman atau timbulnya hutang baru.',
      recommendation: 'Pastikan pencatatan hutang telah disetujui sesuai aturan adat.',
      canSwap: true
    };
  }

  // 9. Belanja yang Belum Dibayar (Timbul Hutang Belanja)
  if (isDebetBelanja && isKreditHutang) {
    return {
      status: 'valid',
      title: 'Pembelian / Belanja Non-Tunai (Kredit)',
      transactionType: 'BELANJA NON-TUNAI',
      flowDescriptionDebet: 'Beban Belanja bertambah (Debet)',
      flowDescriptionKredit: 'Hutang Rekanan bertambah (Kredit)',
      cashEffect: 'non-kas',
      detailedNote: 'Transaksi akrual di mana barang/jasa telah diterima namun pembayaran belum dilakukan sehingga timbul hutang rekanan.',
      recommendation: 'Transaksi tidak mempengaruhi kas saat ini, akan mempengaruhi kas saat pelunasan nanti.',
      canSwap: true
    };
  }

  // 10. General Valid Pair
  return {
    status: 'valid',
    title: 'Konfirmasi Pasangan Rekening Jurnal',
    transactionType: 'TRANSAKSI JURNAL UMUM',
    flowDescriptionDebet: `Akun Debet: ${debetCode}`,
    flowDescriptionKredit: `Akun Kredit: ${kreditCode}`,
    cashEffect: isDebetKas ? 'masuk' : isKreditKas ? 'keluar' : 'non-kas',
    detailedNote: 'Periksa kembali alur debit dan kredit di atas untuk memastikan transaksi tercatat pada buku dan neraca yang tepat.',
    recommendation: 'Periksa kesesuaian uraian transaksi dengan kode rekening yang dipilih.',
    canSwap: true
  };
};

interface AccountPairValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  akunDebet: string;
  akunKredit: string;
  onSwapAccounts: () => void;
  onConfirm: () => void;
  onSelectDifferentAccount?: (side: 'debet' | 'kredit') => void;
}

export const AccountPairValidationModal: React.FC<AccountPairValidationModalProps> = ({
  isOpen,
  onClose,
  akunDebet,
  akunKredit,
  onSwapAccounts,
  onConfirm,
  onSelectDifferentAccount
}) => {
  if (!isOpen || !akunDebet || !akunKredit) return null;

  const debetCode = akunDebet.split(' - ')[0].trim();
  const debetName = akunDebet.includes(' - ') 
    ? akunDebet.split(' - ').slice(1).join(' - ').trim() 
    : (REFERENSI_REKENING.find(r => r.code === debetCode)?.name || debetCode);

  const kreditCode = akunKredit.split(' - ')[0].trim();
  const kreditName = akunKredit.includes(' - ') 
    ? akunKredit.split(' - ').slice(1).join(' - ').trim() 
    : (REFERENSI_REKENING.find(r => r.code === kreditCode)?.name || kreditCode);

  const analysis = useMemo(() => {
    return analyzeAccountPair(debetCode, kreditCode);
  }, [debetCode, kreditCode]);

  const isReversedOrError = analysis.status === 'reversed' || analysis.status === 'error';

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/75 z-[99999] flex justify-center items-center backdrop-blur-xs p-3 sm:p-4 animate-fade-in no-print"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header dengan Status Banner */}
        <div className={`p-4 sm:p-5 flex items-start justify-between border-b ${
          analysis.status === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-950 dark:text-rose-200'
            : analysis.status === 'reversed'
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-950 dark:text-amber-200'
            : 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 text-teal-950 dark:text-teal-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-2xl shrink-0 shadow-xs ${
              analysis.status === 'error'
                ? 'bg-rose-600 text-white'
                : analysis.status === 'reversed'
                ? 'bg-amber-500 text-white'
                : 'bg-teal-600 text-white'
            }`}>
              {analysis.status === 'error' ? (
                <AlertCircle size={22} />
              ) : analysis.status === 'reversed' ? (
                <AlertTriangle size={22} />
              ) : (
                <ShieldCheck size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  analysis.status === 'error'
                    ? 'bg-rose-200 text-rose-900'
                    : analysis.status === 'reversed'
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-teal-200 text-teal-900'
                }`}>
                  {analysis.transactionType}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Verifikasi Alur Jurnal
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black mt-1 text-slate-900 dark:text-white leading-tight">
                {analysis.title}
              </h3>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Visual Alur Transaksi (Debet -> Kredit) */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Alur Pemindahbukuan Akun:</span>
              {analysis.canSwap && (
                <button
                  type="button"
                  onClick={onSwapAccounts}
                  className="flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  title="Klik untuk membalik posisi Debet dan Kredit"
                >
                  <ArrowLeftRight size={13} />
                  <span>Tukar Debet ⇄ Kredit</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
              {/* Box DEBET */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-emerald-300 dark:border-emerald-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200">
                      SISI DEBET (MASUK / BEBAN)
                    </span>
                    <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {debetCode}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                    {debetName}
                  </div>
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-950/60 flex items-center gap-1.5">
                  <Check size={13} className="shrink-0" />
                  <span>{analysis.flowDescriptionDebet}</span>
                </div>
              </div>

              {/* Box KREDIT */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-rose-300 dark:border-rose-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md border border-rose-200">
                      SISI KREDIT (KELUAR / SUMBER)
                    </span>
                    <span className="font-mono text-[11px] font-bold text-rose-700 dark:text-rose-400">
                      {kreditCode}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                    {kreditName}
                  </div>
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium mt-2 pt-2 border-t border-rose-100 dark:border-rose-950/60 flex items-center gap-1.5">
                  <Check size={13} className="shrink-0" />
                  <span>{analysis.flowDescriptionKredit}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Penjelasan Validasi & Dampak Keuangan */}
          <div className={`p-4 rounded-2xl border text-xs space-y-2 leading-relaxed ${
            analysis.status === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-900 dark:text-rose-200'
              : analysis.status === 'reversed'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-950 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              <BookOpen size={16} className={isReversedOrError ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600'} />
              <span>Penjelasan Kaidah Akuntansi:</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              {analysis.detailedNote}
            </p>
            <div className="pt-2 border-t border-black/5 dark:border-white/5 font-semibold flex items-start gap-1.5 text-[11px]">
              <span className="text-teal-700 dark:text-teal-400 shrink-0 font-bold">💡 Saran:</span>
              <span>{analysis.recommendation}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            {analysis.canSwap && (
              <button
                type="button"
                onClick={onSwapAccounts}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 text-xs transition-colors shadow-xs active:scale-95"
                title="Tukar posisi Debet dan Kredit"
              >
                <ArrowLeftRight size={15} />
                <span>Tukar Posisi</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold py-2.5 px-3.5 rounded-xl text-xs transition-colors shadow-xs"
            >
              Ubah Akun
            </button>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            className={`font-black py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 text-white ${
              analysis.status === 'error'
                ? 'bg-slate-400 cursor-not-allowed'
                : analysis.status === 'reversed'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/20'
            }`}
            disabled={analysis.status === 'error'}
          >
            <CheckCircle2 size={16} />
            <span>{analysis.status === 'reversed' ? 'Tetap Lanjutkan (Sesuai Kebutuhan)' : 'Akun Sudah Sesuai (Lanjutkan)'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
