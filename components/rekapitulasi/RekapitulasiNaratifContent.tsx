import React, { useMemo } from 'react';
import { formatCurrency, formatLongDate, numberToWords } from '../../utils/formatter';
import { REFERENSI_REKENING } from '../../constants';
import type { JuDisplayRow } from '../../types';
import type { DigitalSignatures } from '../../utils/signatureStorage';
import { 
    Coins, 
    Wallet, 
    Scale, 
    TrendingUp, 
    TrendingDown, 
    CheckCircle2, 
    HeartHandshake,
    Sparkles,
    ShieldCheck,
    Pencil
} from 'lucide-react';

export interface RekapitulasiNaratifContentProps {
    profile: {
        namaDesa?: string;
        namaKetua?: string;
        namaBendahara?: string;
        alamat?: string;
    };
    reportPeriodLabel: string;
    selectedYear: string;
    selectedMonth?: string;
    entries?: JuDisplayRow[];
    rekap: {
        totalSumberDana: number;
        totalDanaPuniaUang: number;
        totalDanaPuniaBarang: number;
        totalDanaPuniaAll: number;
        totalDanaPenggenap: number;
        totalPemasukanLain: number;
        totalPemasukan: number;
        totalPengeluaran: number;
        saldoAkhir: number;
    };
    keliang: string;
    setKeliang: (val: string) => void;
    isEditingKeliang: boolean;
    setIsEditingKeliang: (val: boolean) => void;
    juruRaksa: string;
    setJuruRaksa: (val: string) => void;
    isEditingJuruRaksa: boolean;
    setIsEditingJuruRaksa: (val: boolean) => void;
    penyarikan: string;
    setPenyarikan: (val: string) => void;
    isEditingPenyarikan: boolean;
    setIsEditingPenyarikan: (val: boolean) => void;
    pengawas: string;
    setPengawas: (val: string) => void;
    isEditingPengawas: boolean;
    setIsEditingPengawas: (val: boolean) => void;
    customPlace: string;
    formattedSignDate: string;
    showStamp: boolean;
    stampScaleVal: number;
    effectiveStamp: string;
    embedSignatures: boolean;
    signatures: DigitalSignatures;
    sigScale: number;
}

export const RekapitulasiNaratifContent: React.FC<RekapitulasiNaratifContentProps> = ({
    profile,
    reportPeriodLabel,
    entries = [],
    rekap,
    keliang,
    setKeliang,
    isEditingKeliang,
    setIsEditingKeliang,
    juruRaksa,
    setJuruRaksa,
    isEditingJuruRaksa,
    setIsEditingJuruRaksa,
    penyarikan,
    setPenyarikan,
    isEditingPenyarikan,
    setIsEditingPenyarikan,
    pengawas,
    setPengawas,
    isEditingPengawas,
    setIsEditingPengawas,
    customPlace,
    formattedSignDate,
    showStamp,
    stampScaleVal,
    effectiveStamp,
    embedSignatures,
    signatures,
    sigScale
}) => {
    // Status Saldo Kas Akhir
    const saldoStatus = useMemo(() => {
        if (rekap.saldoAkhir > 0) {
            return {
                type: 'surplus',
                label: 'KAS SURPLUS (SISA UANG KAS LEBIH)',
                badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                boxBg: 'bg-emerald-50/60 border-emerald-300',
                ringkasan: 'Seluruh belanja yadnya dan operasional desa telah terbiayai dengan lunas, dan menyisakan uang kas aman yang tersimpan utuh di rekening kas desa & brankas bendahara untuk kegiatan yadnya berikutnya.',
            };
        } else if (rekap.saldoAkhir === 0) {
            return {
                type: 'balanced',
                label: 'KAS BERIMBANG (PAS / TEPAT)',
                badge: 'bg-blue-100 text-blue-800 border-blue-300',
                boxBg: 'bg-blue-50/60 border-blue-300',
                ringkasan: 'Seluruh uang masuk terserap tepat 100% untuk membiayai seluruh rangkaian karya/upakara secara cermat tanpa menyisakan hutang maupun sisa kas.',
            };
        } else {
            return {
                type: 'talangan',
                label: 'PENGGUNAAN DANA CADANGAN / TALANGAN',
                badge: 'bg-amber-100 text-amber-800 border-amber-300',
                boxBg: 'bg-amber-50/60 border-amber-300',
                ringkasan: 'Terdapat kebutuhan yadnya mendesak yang ditalangi terlebih dahulu secara tertib dan akan diseimbangkan pada penerimaan kas tahap berikutnya.',
            };
        }
    }, [rekap.saldoAkhir]);

    // Analisis Rincian Belanja Berdasarkan Bidang LRA (Tri Hita Karana & Operasional)
    const expenseDetails = useMemo(() => {
        let totalParhyanganRaw = 0;
        let totalPawonganRaw = 0;
        let totalPalemahanRaw = 0;
        let totalOperasionalRaw = 0;
        let totalInsentifRaw = 0;
        let totalBebanRaw = 0;

        const detailParhyangan: { nama: string; jumlah: number }[] = [];
        const detailPawongan: { nama: string; jumlah: number }[] = [];
        const detailPalemahan: { nama: string; jumlah: number }[] = [];
        const detailOperasional: { nama: string; jumlah: number }[] = [];
        const detailInsentif: { nama: string; jumlah: number }[] = [];
        const detailBeban: { nama: string; jumlah: number }[] = [];

        const accMap: Record<string, { code: string; name: string; amount: number }> = {};
        const sourceEntries = entries && entries.length > 0 ? entries : [];

        sourceEntries.forEach(e => {
            const code = e.kodeRekening || '';
            let amount = 0;
            let targetCode = '';
            let targetName = '';

            if (code.startsWith('5.')) {
                amount = (e.debet || 0) - (e.kredit || 0);
                targetCode = code;
                const ref = REFERENSI_REKENING.find(r => r.code === code);
                targetName = ref?.name || e.uraian;
            } else if (code.startsWith('1.1') && (e.kredit || 0) > 0) {
                // Baris kas keluar yang berhubungan dengan belanja
                const related = sourceEntries.filter(r => r.idTransaksi === e.idTransaksi);
                const debetRow = related.find(r => r.rowType === 'debet' && r.kodeRekening?.startsWith('5.'));
                if (debetRow) {
                    return; // Sudah tercatat di debet 5.x
                }
                const otherDebet = related.find(r => r.rowType === 'debet' && !r.kodeRekening?.startsWith('1.1'));
                if (otherDebet) {
                    targetCode = otherDebet.kodeRekening || '5.2.1.03';
                    const ref = REFERENSI_REKENING.find(r => r.code === targetCode);
                    targetName = ref?.name || otherDebet.uraian || e.uraian;
                    amount = e.kredit || 0;
                } else {
                    targetCode = '5.2.1.03';
                    targetName = e.uraian || 'Dana Aci Usabe Dalem / Upakara Yadnya';
                    amount = e.kredit || 0;
                }
            }

            if (amount > 0 && targetCode) {
                const key = `${targetCode}-${targetName}`;
                if (!accMap[key]) {
                    accMap[key] = { code: targetCode, name: targetName, amount: 0 };
                }
                accMap[key].amount += amount;
            }
        });

        // Klasifikasikan ke 6 Pilar LRA Desa Adat
        Object.values(accMap).forEach(item => {
            const lower = item.name.toLowerCase();
            const code = item.code;

            // 1. INSENTIF PRAJURU & PETUGAS (5.1.1 & 5.1.4)
            if (
                code.startsWith('5.1.1') || 
                code.startsWith('5.1.4') || 
                lower.includes('insentif') ||
                lower.includes('honor') ||
                lower.includes('tali kasih')
            ) {
                totalInsentifRaw += item.amount;
                detailInsentif.push({ nama: item.name, jumlah: item.amount });
            }
            // 2. BIDANG PARHYANGAN (5.2.1, 5.2.2, 5.2.3)
            else if (
                code.startsWith('5.2') || 
                lower.includes('aci') || 
                lower.includes('pura') || 
                lower.includes('upakara') || 
                lower.includes('yadnya') || 
                lower.includes('parhyangan') ||
                lower.includes('melanting') ||
                lower.includes('dalem') ||
                lower.includes('baleagung') ||
                lower.includes('puseh') ||
                lower.includes('canang') ||
                lower.includes('banten')
            ) {
                totalParhyanganRaw += item.amount;
                detailParhyangan.push({ nama: item.name, jumlah: item.amount });
            }
            // 3. BIDANG PAWONGAN (5.3.1, 5.3.2)
            else if (
                code.startsWith('5.3') || 
                lower.includes('pawongan') || 
                lower.includes('pasraman') || 
                lower.includes('sipandu') ||
                lower.includes('pecalang') ||
                lower.includes('kematian') ||
                lower.includes('santunan') ||
                lower.includes('seni') ||
                lower.includes('gong')
            ) {
                totalPawonganRaw += item.amount;
                detailPawongan.push({ nama: item.name, jumlah: item.amount });
            }
            // 4. BIDANG PALEMAHAN (5.4)
            else if (
                code.startsWith('5.4') || 
                lower.includes('palemahan') || 
                lower.includes('sampah') || 
                lower.includes('wantilan') || 
                lower.includes('setra') ||
                lower.includes('kuburan') ||
                lower.includes('lingkungan')
            ) {
                totalPalemahanRaw += item.amount;
                detailPalemahan.push({ nama: item.name, jumlah: item.amount });
            }
            // 5. OPERASIONAL KANTOR & PERJALANAN DINAS (5.1.2 & 5.1.3)
            else if (
                code.startsWith('5.1.2') || 
                code.startsWith('5.1.3') || 
                lower.includes('atk') || 
                lower.includes('operasional') || 
                lower.includes('perjalanan dinas') ||
                lower.includes('konsumsi') ||
                lower.includes('paruman') ||
                lower.includes('pesangkepan') ||
                lower.includes('listrik') ||
                lower.includes('internet')
            ) {
                totalOperasionalRaw += item.amount;
                detailOperasional.push({ nama: item.name, jumlah: item.amount });
            }
            // 6. BEBAN PENUNJANG & ADMINISTRASI (5.1.5)
            else {
                totalBebanRaw += item.amount;
                detailBeban.push({ nama: item.name, jumlah: item.amount });
            }
        });

        // Pastikan total pengeluaran klop 100% dengan rekap.totalPengeluaran
        const calculatedSum = totalParhyanganRaw + totalPawonganRaw + totalPalemahanRaw + totalOperasionalRaw + totalInsentifRaw + totalBebanRaw;
        let adjustedParhyangan = totalParhyanganRaw;
        const diff = (rekap.totalPengeluaran || 0) - calculatedSum;
        if (diff > 0) {
            adjustedParhyangan += diff;
            detailParhyangan.push({ nama: 'Pengadaan Sarana Banten & Upakara Yadnya Tambahan', jumlah: diff });
        }

        return {
            totalParhyangan: adjustedParhyangan,
            totalPawongan: totalPawonganRaw,
            totalPalemahan: totalPalemahanRaw,
            totalOperasional: totalOperasionalRaw,
            totalInsentif: totalInsentifRaw,
            totalBeban: totalBebanRaw,
            detailParhyangan,
            detailPawongan,
            detailPalemahan,
            detailOperasional,
            detailInsentif,
            detailBeban
        };
    }, [entries, rekap.totalPengeluaran]);

    return (
        <div 
            id="printable-rekap-naratif"
            className="rekap-naratif-sheet bg-white text-slate-900 mx-auto font-serif relative"
            style={{
                width: '100%',
                maxWidth: '210mm',
                minHeight: '297mm',
                padding: '16mm 18mm',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff'
            }}
        >
            {/* KOP SURAT RESMI DESA ADAT */}
            <div className="text-center pb-3 mb-4 border-b-4 border-double border-slate-900">
                <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 font-sans">
                    {profile.namaDesa || 'DESA ADAT BASANGALAS'}
                </h1>
                <p className="text-[11px] sm:text-xs font-semibold uppercase text-slate-800 tracking-wide font-sans">
                    KECAMATAN ABANG, KABUPATEN KARANGASEM - PROVINSI BALI
                </p>
                <p className="text-[9px] sm:text-[10px] text-slate-600 italic mt-0.5 font-sans">
                    {profile.alamat || 'Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852'}
                </p>
            </div>

            {/* JUDUL LAPORAN */}
            <div className="text-center mb-5">
                <h2 className="text-sm sm:text-base font-black uppercase text-slate-900 tracking-wide font-sans underline decoration-slate-900 decoration-1 underline-offset-4">
                    LAPORAN REALISASI ANGGARAN &amp; NARASI KEUANGAN KAS DESA ADAT
                </h2>
                <p className="text-xs font-bold text-teal-800 mt-1 font-sans">
                    Periode Laporan: {reportPeriodLabel}
                </p>
                <p className="text-[10px] text-slate-500 italic mt-0.5">
                    (Penjelasan Realisasi Keuangan Berdasarkan Laporan Realisasi Anggaran / LRA dengan Bahasa Sederhana untuk Seluruh Krama Desa Adat)
                </p>
            </div>

            {/* SALAM PEMBUKA HANGAT */}
            <div className="mb-4 text-xs sm:text-[13px] leading-relaxed text-slate-800">
                <p className="font-semibold italic text-slate-900">
                    Om Swastyastu,
                </p>
                <p className="mt-1 text-slate-700 italic">
                    Katur ring para Prajuru Desa Adat, Pemangku, Baga Petilik (Pengawas), Sabha Desa, Yowana, lan sinamian Krama Desa Adat sane wangiang titiang.
                </p>
            </div>

            {/* PENDAHULUAN */}
            <div className="mb-5 text-justify text-xs sm:text-[13px] leading-relaxed text-slate-800 space-y-2">
                <p className="indent-6">
                    Puji syukur (<em>angayubagia</em>) kita panjatkan ke hadapan Ida Sang Hyang Widhi Wasa / Tuhan Yang Maha Esa, 
                    atas asung kerta wara nugraha-Nya, seluruh rangkaian kegiatan keagamaan, upakara yadnya, dan pengelolaan 
                    kas desa di wewidangan <strong>{profile.namaDesa || 'Desa Adat Basangalas'}</strong> pada periode{' '}
                    <strong>{reportPeriodLabel}</strong> telah berjalan dengan tertib, lancar, dan damai (<em>labda karya</em>).
                </p>
                <p className="indent-6">
                    Sebagai wujud keterbukaan, kejujuran, dan tanggung jawab suci Prajuru kepada seluruh 
                    <strong> Krama Desa Adat</strong> serta para donatur/simpatisan (<em>bhakta</em>), lembar laporan ini kami susun dengan bahasa sederhana 
                    agar mudah dipahami oleh seluruh krama desa. Kami laporkan secara terbuka mengenai 
                    <strong> dari mana uang kas kita peroleh</strong>, <strong>untuk apa saja uang tersebut dibelanjakan sesuai Laporan Realisasi Anggaran (LRA)</strong>, 
                    serta <strong>berapa sisa uang kas yang kini tersimpan utuh di kas desa</strong>.
                </p>
            </div>

            {/* KOTAK RINGKASAN TIGA ANGKA POKOK (KRAMA-FRIENDLY HIGHLIGHTS) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5 not-italic font-sans">
                {/* 1. TOTAL UANG MASUK */}
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-center shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-emerald-800 flex items-center justify-center gap-1">
                        <TrendingUp size={14} className="text-emerald-700" />
                        1. Total Uang Masuk
                    </div>
                    <div className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5">
                        {formatCurrency(rekap.totalPemasukan)}
                    </div>
                    <div className="text-[9px] text-emerald-900/80 mt-0.5">
                        Hibah Pemerintah, Punia &amp; Kas Adat
                    </div>
                </div>

                {/* 2. TOTAL UANG DIBELANJAKAN */}
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 text-center shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-rose-800 flex items-center justify-center gap-1">
                        <TrendingDown size={14} className="text-rose-700" />
                        2. Total Uang Dibelanjakan
                    </div>
                    <div className="text-base sm:text-lg font-black text-rose-700 font-mono mt-0.5">
                        {formatCurrency(rekap.totalPengeluaran)}
                    </div>
                    <div className="text-[9px] text-rose-900/80 mt-0.5">
                        Belanja Aci, Krama, &amp; Operasional
                    </div>
                </div>

                {/* 3. SISA UANG KAS AKHIR */}
                <div className={`border-2 rounded-xl p-3 text-center shadow-sm ${saldoStatus.boxBg}`}>
                    <div className="text-[10px] uppercase font-bold text-slate-800 flex items-center justify-center gap-1">
                        <Scale size={14} className="text-teal-700" />
                        3. Sisa Uang Kas Saat Ini
                    </div>
                    <div className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5">
                        {formatCurrency(rekap.saldoAkhir)}
                    </div>
                    <div className="text-[9px] font-bold text-slate-700 mt-0.5">
                        {saldoStatus.label}
                    </div>
                </div>
            </div>

            {/* TABEL RANGKUMAN REALISASI LRA SEDERHANA */}
            <div className="my-5 border border-slate-300 rounded-lg overflow-hidden font-sans text-xs shadow-xs">
                <div className="bg-slate-800 text-white px-3 py-2 font-bold uppercase text-[11px] flex items-center justify-between">
                    <span>Tabel Ringkasan Realisasi Anggaran (LRA)</span>
                    <span className="text-[10px] text-slate-300 font-normal">Format Sederhana untuk Krama</span>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-[11px] text-slate-700 font-bold">
                            <th className="p-2 w-10 text-center">No</th>
                            <th className="p-2">Pos Rincian Kegiatan Keuangan</th>
                            <th className="p-2 text-right w-36">Jumlah Uang (Rp)</th>
                            <th className="p-2 text-center w-28">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                        {/* BAGIAN I: PENERIMAAN */}
                        <tr className="bg-emerald-50/70 font-bold text-emerald-900">
                            <td className="p-2 text-center">I</td>
                            <td colSpan={2} className="p-2 uppercase tracking-wide">
                                TOTAL UANG MASUK (PENERIMAAN KAS)
                            </td>
                            <td className="p-2 text-right font-mono text-emerald-800 font-black">
                                {formatCurrency(rekap.totalPemasukan)}
                            </td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">1</td>
                            <td className="p-1.5 pl-6 text-slate-700">Bantuan Hibah Pemerintah (BKK Provinsi Bali &amp; Hibah Kabupaten)</td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(rekap.totalSumberDana)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Hibah Resmi</td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">2</td>
                            <td className="p-1.5 pl-6 text-slate-700">Dana Punia Krama Desa &amp; Simpatisan (Uang Tunai &amp; Transfer Bank)</td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(rekap.totalDanaPuniaUang)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Punia Sukarela</td>
                        </tr>
                        {rekap.totalDanaPuniaBarang > 0 && (
                            <tr>
                                <td className="p-1.5 text-center text-slate-400">3</td>
                                <td className="p-1.5 pl-6 text-slate-700">Dana Punia Sarana Barang / Banten Upakara</td>
                                <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(rekap.totalDanaPuniaBarang)}</td>
                                <td className="p-1.5 text-center text-[10px] text-slate-500">Sarana Yadnya</td>
                            </tr>
                        )}
                        {rekap.totalPemasukanLain > 0 && (
                            <tr>
                                <td className="p-1.5 text-center text-slate-400">4</td>
                                <td className="p-1.5 pl-6 text-slate-700">Kas Asli Desa Adat (Sasah Abu Pura, Pengelolaan Aset, &amp; Lain-lain)</td>
                                <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(rekap.totalPemasukanLain)}</td>
                                <td className="p-1.5 text-center text-[10px] text-slate-500">Kas Mandiri</td>
                            </tr>
                        )}
                        {rekap.totalDanaPenggenap > 0 && (
                            <tr>
                                <td className="p-1.5 text-center text-slate-400">5</td>
                                <td className="p-1.5 pl-6 text-slate-700">Dana Cadangan Kas / Penyeimbang Kas Masuk</td>
                                <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(rekap.totalDanaPenggenap)}</td>
                                <td className="p-1.5 text-center text-[10px] text-slate-500">Cadangan Kas</td>
                            </tr>
                        )}

                        {/* BAGIAN II: BELANJA */}
                        <tr className="bg-rose-50/70 font-bold text-rose-900">
                            <td className="p-2 text-center">II</td>
                            <td colSpan={2} className="p-2 uppercase tracking-wide">
                                TOTAL UANG DIBELANJAKAN (PENGELUARAN REALISASI LRA)
                            </td>
                            <td className="p-2 text-right font-mono text-rose-800 font-black">
                                {formatCurrency(rekap.totalPengeluaran)}
                            </td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">1</td>
                            <td className="p-1.5 pl-6 text-slate-700">
                                <strong>Bidang Parhyangan:</strong> Kebutuhan Suci Pura, Aci Piodalan &amp; Upakara Yadnya
                            </td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(expenseDetails.totalParhyangan)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Pura &amp; Yadnya</td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">2</td>
                            <td className="p-1.5 pl-6 text-slate-700">
                                <strong>Bidang Pawongan:</strong> Pasraman Anak-anak, Seni Gong &amp; Pengamanan Pecalang
                            </td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(expenseDetails.totalPawongan)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Krama &amp; Budaya</td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">3</td>
                            <td className="p-1.5 pl-6 text-slate-700">
                                <strong>Bidang Palemahan:</strong> Kebersihan Sampah Desa, Perawatan Wantilan &amp; Setra
                            </td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(expenseDetails.totalPalemahan)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Lingkungan Asri</td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">4</td>
                            <td className="p-1.5 pl-6 text-slate-700">
                                <strong>Operasional Sekretariat &amp; Rapat:</strong> Kertas ATK, Konsumsi Paruman, Listrik, Internet
                            </td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(expenseDetails.totalOperasional)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Kantor &amp; Rapat</td>
                        </tr>
                        <tr>
                            <td className="p-1.5 text-center text-slate-400">5</td>
                            <td className="p-1.5 pl-6 text-slate-700">
                                <strong>Tali Kasih / Insentif Prajuru &amp; Serati:</strong> Uang lelah pengurus desa adat yang ngayah
                            </td>
                            <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(expenseDetails.totalInsentif)}</td>
                            <td className="p-1.5 text-center text-[10px] text-slate-500">Tali Kasih Sah</td>
                        </tr>
                        {expenseDetails.totalBeban > 0 && (
                            <tr>
                                <td className="p-1.5 text-center text-slate-400">6</td>
                                <td className="p-1.5 pl-6 text-slate-700">
                                    <strong>Administrasi Bank &amp; Penunjang Lainnya:</strong> Biaya admin rekening bank &amp; penunjang
                                </td>
                                <td className="p-1.5 text-right font-mono text-slate-800">{formatCurrency(expenseDetails.totalBeban)}</td>
                                <td className="p-1.5 text-center text-[10px] text-slate-500">Administrasi</td>
                            </tr>
                        )}

                        {/* BAGIAN III: SISA KAS */}
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400">
                            <td className="p-2 text-center">III</td>
                            <td className="p-2 uppercase tracking-wide">
                                SISA UANG KAS SAAT INI (SALDO AKHIR TERSIMPAN)
                            </td>
                            <td className="p-2 text-right font-mono text-teal-800 text-sm font-black">
                                {formatCurrency(rekap.saldoAkhir)}
                            </td>
                            <td className="p-2 text-center text-[10px] font-bold text-teal-700">
                                {rekap.saldoAkhir >= 0 ? 'Tersimpan Aman' : 'Talangan'}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* URAIAN NARATIF BERBAHASA SEDERHANA (RAMAH KRAMA AWAM) */}
            <div className="space-y-5 my-6 text-xs sm:text-[13px] text-slate-800 leading-relaxed text-justify">
                
                {/* 1. DARI MANA SAJA UANG KAS DIPEROLEH */}
                <div>
                    <h3 className="font-bold text-slate-900 uppercase font-sans text-xs sm:text-sm border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
                        <Coins size={16} className="text-emerald-700" />
                        1. Dari Mana Saja Uang Kas Kita Masuk?
                    </h3>
                    <p className="indent-6">
                        Sepanjang periode <strong>{reportPeriodLabel}</strong>, total uang kas yang diterima oleh desa adat kita adalah sebesar{' '}
                        <strong className="text-emerald-800">{formatCurrency(rekap.totalPemasukan)}</strong> (<em>{numberToWords(rekap.totalPemasukan)} rupiah</em>).
                        Uang ini bukan berasal dari satu sumber saja, melainkan gabungan dari beberapa penerimaan sah:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 mt-1.5 text-slate-700">
                        <li>
                            <strong>Bantuan Dana Hibah Pemerintah:</strong> Sebesar <strong>{formatCurrency(rekap.totalSumberDana)}</strong> yang merupakan bantuan resmi pemerintah (seperti Dana BKK Pemerintah Provinsi Bali Rp 300 juta dan Hibah Pemerintah Kabupaten Karangasem) yang disalurkan langsung untuk memperkuat desa adat kita dan membiayai kebutuhan pura serta krama.
                        </li>
                        <li>
                            <strong>Ketulusan Punia Krama Desa &amp; Simpatisan:</strong> Sebesar <strong>{formatCurrency(rekap.totalDanaPuniaAll)}</strong>, yang terdiri dari sumbangan punia uang (tunai dan kiriman transfer bank) sebesar <strong>{formatCurrency(rekap.totalDanaPuniaUang)}</strong>, serta sarana barang/banten sebesar <strong>{formatCurrency(rekap.totalDanaPuniaBarang)}</strong> yang dihaturkan dengan tulus ikhlas oleh krama untuk kelengkapan upacara yadnya.
                        </li>
                        {rekap.totalPemasukanLain > 0 && (
                            <li>
                                <strong>Kas Asli Desa Adat:</strong> Sebesar <strong>{formatCurrency(rekap.totalPemasukanLain)}</strong>, yang bersumber dari pengelolaan sasah abu pura, pemanfaatan barang adat, dan pendapatan sah desa adat lainnya.
                            </li>
                        )}
                        {rekap.totalDanaPenggenap > 0 && (
                            <li>
                                <strong>Dana Cadangan / Penyeimbang Kas:</strong> Sebesar <strong>{formatCurrency(rekap.totalDanaPenggenap)}</strong>, merupakan uang kas cadangan yang dicairkan untuk memastikan kelancaran pembiayaan upacara piodalan tepat waktu.
                            </li>
                        )}
                    </ul>
                </div>

                {/* 2. UNTUK APA SAJA UANG TERSEBUT DIPAKAI (SESUAI LRA) */}
                <div>
                    <h3 className="font-bold text-slate-900 uppercase font-sans text-xs sm:text-sm border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
                        <Wallet size={16} className="text-rose-700" />
                        2. Untuk Apa Saja Uang Tersebut Dibelanjakan? (Realisasi Belanja LRA)
                    </h3>
                    <p className="indent-6">
                        Seluruh uang yang keluar dibelanjakan secara hati-hati, jujur, dan terarah sesuai kebutuhan nyata desa adat kita. 
                        Total pengeluaran yang telah terealisasi adalah sebesar <strong className="text-rose-800">{formatCurrency(rekap.totalPengeluaran)}</strong> (<em>{numberToWords(rekap.totalPengeluaran)} rupiah</em>).
                        Pengeluaran ini kami bagi ke dalam pos-pos kegiatan yang jelas sesuai Laporan Realisasi Anggaran (LRA):
                    </p>

                    <div className="space-y-3 mt-3">
                        {/* A. PARHYANGAN */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3">
                            <div className="flex items-center justify-between font-sans">
                                <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                    A. Kebutuhan Pura &amp; Upakara Yadnya (Bidang Parhyangan)
                                </span>
                                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {formatCurrency(expenseDetails.totalParhyangan)}
                                </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-xs leading-relaxed">
                                <em>Untuk apa uang ini?</em> Uang ini kita gunakan murni untuk membeli perlengkapan banten, kelapa, beras, bunga, dupa, canang harian, serta membiayai jalannya upacara piodalan di Pura Dalem, Pura Melanting, Pura Puseh, dan Pura Bale Agung. Tujuannya agar seluruh rangkaian yadnya terlaksana dengan suci, hening, dan khidmat tanpa ada sarana yang kurang.
                            </p>
                        </div>

                        {/* B. PAWONGAN */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3">
                            <div className="flex items-center justify-between font-sans">
                                <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                    B. Kegiatan Krama, Seni, Budaya &amp; Keamanan (Bidang Pawongan)
                                </span>
                                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {formatCurrency(expenseDetails.totalPawongan)}
                                </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-xs leading-relaxed">
                                <em>Untuk apa uang ini?</em> Uang ini kita manfaatkan untuk pembinaan generasi muda dan krama desa kita, seperti kegiatan pasraman anak-anak belajar aksara dan doa Hindu, latihan tetabuhan gong dan tari wali, bantuan santunan duka/kematian bagi krama yang tertimpa musibah, serta dukungan operasional bagi Pecalang (Sipandu Beradat) yang bertugas mengamankan jalannya upacara adat.
                            </p>
                        </div>

                        {/* C. PALEMAHAN */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3">
                            <div className="flex items-center justify-between font-sans">
                                <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                    C. Kebersihan Lingkungan &amp; Fasilitas Desa (Bidang Palemahan)
                                </span>
                                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {formatCurrency(expenseDetails.totalPalemahan)}
                                </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-xs leading-relaxed">
                                <em>Untuk apa uang ini?</em> Uang ini kita pakai untuk menjaga wewidangan desa adat agar tetap bersih, asri, dan rapi. Di antaranya adalah biaya pengangkutan sampah di lingkungan pura dan banjar, pemeliharaan wantilan desa adat tempat krama berkumpul, serta penataan setra (kuburan adat).
                            </p>
                        </div>

                        {/* D. OPERASIONAL KANTOR */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3">
                            <div className="flex items-center justify-between font-sans">
                                <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                    D. Belanja Operasional Kantor Sekretariat &amp; Rapat Krama
                                </span>
                                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {formatCurrency(expenseDetails.totalOperasional)}
                                </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-xs leading-relaxed">
                                <em>Untuk apa uang ini?</em> Uang ini kita gunakan untuk keperluan administrasi dan surat-menyurat sekretariat desa, seperti pembelian kertas dan tinta (ATK), biaya listrik wantilan/kantor, kuota internet sekretariat, serta suguhan konsumsi makanan ringan saat prajuru dan krama menggelar paruman/pesangkepan banjar di wantilan.
                            </p>
                        </div>

                        {/* E. TALI KASIH PRAJURU */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3">
                            <div className="flex items-center justify-between font-sans">
                                <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                                    E. Tali Kasih / Insentif Prajuru &amp; Petugas Adat
                                </span>
                                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {formatCurrency(expenseDetails.totalInsentif)}
                                </span>
                            </div>
                            <p className="mt-1 text-slate-700 text-xs leading-relaxed">
                                <em>Untuk apa uang ini?</em> Uang ini merupakan tali kasih resmi yang sah dan terukur yang diberikan kepada pengurus desa adat (Keliang Desa Adat, Penyarikan, Juru Raksa, Petajuh, Penempek banjar, Istri Penempek, dan Serati Banten). Ini adalah bentuk penghargaan krama atas waktu, tenaga, dan pikiran yang mereka luangkan secara tulus untuk <em>ngayah</em> melayani krama siang dan malam.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. SISA UANG KAS AKHIR & DI MANA DISIMPAN */}
                <div>
                    <h3 className="font-bold text-slate-900 uppercase font-sans text-xs sm:text-sm border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
                        <Scale size={16} className="text-teal-700" />
                        3. Berapa Sisa Uang Kas Kita &amp; Di Mana Disimpan?
                    </h3>
                    <p className="indent-6">
                        Setelah seluruh belanja kegiatan dan upakara di atas dibayarkan, posisi akhir keuangan kas desa adat kita menyisakan saldo sebesar:
                    </p>
                    
                    <div className="my-2 p-3 rounded-xl border-2 bg-slate-50 border-slate-300 text-center font-sans">
                        <div className="text-xs text-slate-600 font-semibold">
                            Total Uang Masuk ({formatCurrency(rekap.totalPemasukan)}) − Total Uang Dibelanjakan ({formatCurrency(rekap.totalPengeluaran)})
                        </div>
                        <div className="text-base sm:text-lg font-black text-teal-800 font-mono mt-1">
                            = Sisa Uang Kas: {formatCurrency(rekap.saldoAkhir)}
                        </div>
                        <div className="text-xs font-bold text-teal-900 mt-0.5">
                            ({numberToWords(rekap.saldoAkhir)} rupiah)
                        </div>
                    </div>

                    <div className={`p-3 rounded-lg border text-xs sm:text-[13px] ${saldoStatus.boxBg}`}>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1 font-sans">
                            <CheckCircle2 size={16} className="text-teal-700" />
                            <span>Status Uang Kas: {saldoStatus.label}</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">
                            {saldoStatus.ringkasan} Uang sisa kas ini <strong>bukan uang yang hilang atau tidak jelas</strong>, melainkan tersimpan utuh dan aman di rekening resmi bank (Bank BPD Bali atas nama Desa Adat) dan kas tunai Juru Raksa. Sisa uang kas ini siap dipergunakan sewaktu-waktu untuk piodalan pura atau kegiatan adat berikutnya, sehingga krama tidak perlu dibebani urunan mendadak.
                        </p>
                    </div>
                </div>

                {/* 4. JAMINAN KEJUJURAN & BUKTI FISIK (AKUNTABILITAS) */}
                <div>
                    <h3 className="font-bold text-slate-900 uppercase font-sans text-xs sm:text-sm border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-teal-700" />
                        4. Keterbukaan &amp; Pertanggungjawaban (Setiap Rupiah Ada Kuitansinya)
                    </h3>
                    <p className="indent-6">
                        Prajuru Desa Adat menegaskan kepada seluruh Krama bahwa <strong>setiap rupiah uang yang dibelanjakan memiliki bukti fisik yang sah</strong>, berupa nota toko, kuitansi bermaterai/bertandatangan, dan daftar tanda terima resmi.
                    </p>
                    <p className="indent-6 mt-1.5">
                        Laporan ini telah diperiksa secara bersama-sama oleh Penyarikan (Sekretaris), Juru Raksa (Bendahara), Badan Pengawas (Baga Petilik), dan disahkan oleh Keliang Desa Adat. Apabila ada krama desa yang ingin melihat langsung rincian kuitansi belanja atau ingin menanyakan hal-hal yang kurang jelas, prajuru dengan senang hati dan terbuka mempersilakan krama untuk datang ke sekretariat desa adat pada jam kerja atau saat paruman banjar berlangsung.
                    </p>
                </div>

            </div>

            {/* PENUTUP */}
            <div className="mb-6 text-justify text-xs sm:text-[13px] leading-relaxed text-slate-800">
                <p className="indent-6">
                    Demikian Laporan Realisasi Anggaran dan Narasi Keuangan Kas Desa Adat ini kami sampaikan dengan sejujur-jujurnya 
                    berlandaskan ajaran <strong>Tri Hita Karana</strong> dan semangat kejujuran suci (<em>satya</em>). 
                    Semoga laporan ini membawa ketenangan hati, kejelasan, serta mempererat rasa persatuan dan kekeluargaan seluruh 
                    Krama Desa Adat Basangalas.
                </p>
                <div className="mt-4 italic text-slate-900 text-xs sm:text-sm font-semibold text-center">
                    Om Santih, Santih, Santih Om.
                </div>
            </div>

            {/* KOLOM TANDA TANGAN 4 PEJABAT RESMI */}
            <div className="mt-8 pt-4 border-t-2 border-slate-900 page-break-inside-avoid">
                <div className="text-right text-xs font-sans font-bold text-slate-800 mb-4">
                    Ditetapkan di: <span className="uppercase">{customPlace}</span>, Tanggal: <span>{formattedSignDate}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    
                    {/* 1. KELIANG DESA ADAT + STEMPEL RESMI OVERLAY */}
                    <div className="flex flex-col items-center justify-between min-h-[140px] relative">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                            Mengesahkan,<br />
                            <span className="text-slate-800">Keliang Desa Adat</span>
                        </div>

                        <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                            {/* STEMPEL RESMI DESA OVERLAY */}
                            {showStamp && (
                                <div 
                                    className="absolute pointer-events-none z-0 transition-transform select-none"
                                    style={{
                                        top: '50%',
                                        left: '50%',
                                        transform: `translate(-35%, -50%) scale(${stampScaleVal / 100})`,
                                        opacity: 0.92,
                                        filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                                    }}
                                >
                                    <img
                                        src={effectiveStamp}
                                        alt="Stempel Resmi Desa Adat"
                                        className="w-24 h-24 object-contain max-w-none"
                                    />
                                </div>
                            )}

                            {/* TTD DIGITAL KELIANG */}
                            {embedSignatures && signatures.keliang ? (
                                <img
                                    src={signatures.keliang}
                                    alt="TTD Keliang Desa"
                                    style={{
                                        height: `${Math.round(54 * (sigScale / 100))}px`,
                                        maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                        backgroundColor: 'transparent'
                                    }}
                                    className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                                />
                            ) : (
                                <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                            )}
                        </div>

                        <div className="relative z-20 mt-1 bg-transparent">
                            {isEditingKeliang ? (
                                <div className="flex items-center gap-1 justify-center">
                                    <input 
                                        type="text" 
                                        value={keliang}
                                        onChange={e => setKeliang(e.target.value)}
                                        className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                        onBlur={() => setIsEditingKeliang(false)}
                                        onKeyDown={e => { if (e.key === 'Enter') setIsEditingKeliang(false); }}
                                        autoFocus
                                    />
                                    <button 
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setKeliang(''); setIsEditingKeliang(false); }}
                                        className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                    >X</button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => setIsEditingKeliang(true)}
                                    className="cursor-pointer hover:bg-teal-50/80 px-1 py-0.5 rounded transition group flex items-center justify-center gap-1"
                                    title="Klik untuk ubah nama"
                                >
                                    <span className="font-sans font-bold text-[11px] sm:text-xs text-slate-950 underline decoration-slate-950 uppercase">
                                        {keliang || '(...........................)'}
                                    </span>
                                    <Pencil size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                            )}
                            <div className="text-[9px] font-sans text-slate-600">Prajuru Utama</div>
                        </div>
                    </div>

                    {/* 2. JURU RAKSA / BENDAHARA */}
                    <div className="flex flex-col items-center justify-between min-h-[140px]">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                            Penata Kas,<br />
                            <span className="text-slate-800">Juru Raksa (Bendahara)</span>
                        </div>

                        <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                            {embedSignatures && signatures.juruRaksa ? (
                                <img
                                    src={signatures.juruRaksa}
                                    alt="TTD Juru Raksa"
                                    style={{
                                        height: `${Math.round(54 * (sigScale / 100))}px`,
                                        maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                        backgroundColor: 'transparent'
                                    }}
                                    className="signature-img object-contain pointer-events-none transition-all block"
                                />
                            ) : (
                                <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                            )}
                        </div>

                        <div className="mt-1 bg-transparent">
                            {isEditingJuruRaksa ? (
                                <div className="flex items-center gap-1 justify-center">
                                    <input 
                                        type="text" 
                                        value={juruRaksa}
                                        onChange={e => setJuruRaksa(e.target.value)}
                                        className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                        onBlur={() => setIsEditingJuruRaksa(false)}
                                        onKeyDown={e => { if (e.key === 'Enter') setIsEditingJuruRaksa(false); }}
                                        autoFocus
                                    />
                                    <button 
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setJuruRaksa(''); setIsEditingJuruRaksa(false); }}
                                        className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                    >X</button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => setIsEditingJuruRaksa(true)}
                                    className="cursor-pointer hover:bg-teal-50/80 px-1 py-0.5 rounded transition group flex items-center justify-center gap-1"
                                    title="Klik untuk ubah nama"
                                >
                                    <span className="font-sans font-bold text-[11px] sm:text-xs text-slate-950 underline decoration-slate-950 uppercase">
                                        {juruRaksa || '(...........................)'}
                                    </span>
                                    <Pencil size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                            )}
                            <div className="text-[9px] font-sans text-slate-600">Pengelola Kas Desa</div>
                        </div>
                    </div>

                    {/* 3. PENYARIKAN / SEKRETARIS */}
                    <div className="flex flex-col items-center justify-between min-h-[140px]">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                            Verifikator Administrasi,<br />
                            <span className="text-slate-800">Penyarikan (Sekretaris)</span>
                        </div>

                        <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                            {embedSignatures && signatures.penyarikan ? (
                                <img
                                    src={signatures.penyarikan}
                                    alt="TTD Penyarikan"
                                    style={{
                                        height: `${Math.round(54 * (sigScale / 100))}px`,
                                        maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                        backgroundColor: 'transparent'
                                    }}
                                    className="signature-img object-contain pointer-events-none transition-all block"
                                />
                            ) : (
                                <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                            )}
                        </div>

                        <div className="mt-1 bg-transparent">
                            {isEditingPenyarikan ? (
                                <div className="flex items-center gap-1 justify-center">
                                    <input 
                                        type="text" 
                                        value={penyarikan}
                                        onChange={e => setPenyarikan(e.target.value)}
                                        className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                        onBlur={() => setIsEditingPenyarikan(false)}
                                        onKeyDown={e => { if (e.key === 'Enter') setIsEditingPenyarikan(false); }}
                                        autoFocus
                                    />
                                    <button 
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setPenyarikan(''); setIsEditingPenyarikan(false); }}
                                        className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                    >X</button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => setIsEditingPenyarikan(true)}
                                    className="cursor-pointer hover:bg-teal-50/80 px-1 py-0.5 rounded transition group flex items-center justify-center gap-1"
                                    title="Klik untuk ubah nama"
                                >
                                    <span className="font-sans font-bold text-[11px] sm:text-xs text-slate-950 underline decoration-slate-950 uppercase">
                                        {penyarikan || '(...........................)'}
                                    </span>
                                    <Pencil size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                            )}
                            <div className="text-[9px] font-sans text-slate-600">Tata Usaha &amp; Dokumen</div>
                        </div>
                    </div>

                    {/* 4. BADAN PENGAWAS / BAGA PETILIK */}
                    <div className="flex flex-col items-center justify-between min-h-[140px]">
                        <div className="text-[10px] sm:text-[11px] font-bold uppercase font-sans text-slate-900 leading-tight">
                            Pemeriksa Independen,<br />
                            <span className="text-slate-800">Ketua Badan Pengawas</span>
                        </div>

                        <div className="relative my-1 flex items-center justify-center w-full min-h-[58px]">
                            {embedSignatures && signatures.pengawas ? (
                                <img
                                    src={signatures.pengawas}
                                    alt="TTD Pengawas"
                                    style={{
                                        height: `${Math.round(54 * (sigScale / 100))}px`,
                                        maxWidth: `${Math.round(110 * (sigScale / 100))}px`,
                                        backgroundColor: 'transparent'
                                    }}
                                    className="signature-img object-contain pointer-events-none transition-all block"
                                />
                            ) : (
                                <div style={{ height: `${Math.round(54 * (sigScale / 100))}px` }}></div>
                            )}
                        </div>

                        <div className="mt-1 bg-transparent">
                            {isEditingPengawas ? (
                                <div className="flex items-center gap-1 justify-center">
                                    <input 
                                        type="text" 
                                        value={pengawas}
                                        onChange={e => setPengawas(e.target.value)}
                                        className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-24 focus:outline-none"
                                        onBlur={() => setIsEditingPengawas(false)}
                                        onKeyDown={e => { if (e.key === 'Enter') setIsEditingPengawas(false); }}
                                        autoFocus
                                    />
                                    <button 
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => { setPengawas(''); setIsEditingPengawas(false); }}
                                        className="px-1 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-bold rounded"
                                    >X</button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => setIsEditingPengawas(true)}
                                    className="cursor-pointer hover:bg-teal-50/80 px-1 py-0.5 rounded transition group flex items-center justify-center gap-1"
                                    title="Klik untuk ubah nama"
                                >
                                    <span className="font-sans font-bold text-[11px] sm:text-xs text-slate-950 underline decoration-slate-950 uppercase">
                                        {pengawas || '(...........................)'}
                                    </span>
                                    <Pencil size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                            )}
                            <div className="text-[9px] font-sans text-slate-600">Baga Petilik Adat</div>
                        </div>
                    </div>

                </div>
            </div>

            {/* CATATAN RESMI */}
            <div className="mt-8 pt-3 border-t border-slate-300 text-[10px] text-slate-500 italic font-sans flex items-center justify-between">
                <span>Dokumen sah laporan pertanggungjawaban kas Desa Adat Basangalas berlandaskan asas keterbukaan dan kejujuran (satya).</span>
                <span>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
        </div>
    );
};

export default RekapitulasiNaratifContent;
