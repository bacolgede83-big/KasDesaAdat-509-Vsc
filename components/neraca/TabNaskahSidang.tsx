import React, { useState, useEffect, useMemo } from 'react';
import { 
  ScrollText, 
  Copy, 
  Check, 
  Printer, 
  Download, 
  FileText, 
  CheckCircle2, 
  Building2, 
  Type} from 'lucide-react';
import { formatCurrency } from '../../utils/formatter';
import { useNotification } from '../../context/NotificationContext';
import { playSaveSuccessSound, playSyncSuccessSound } from '../../utils/soundEffects';
import { 
  getStoredSignatures, 
  getSignatureSettings, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  type DigitalSignatures, 
  type SignatureSettings 
} from '../../utils/signatureStorage';

export interface TabNaskahSidangProps {
  financialReport: any;
  expenditureAnalysis: any;
  reportDate: string;
  formattedReportDate: string;
  customPlace?: string;
  institutionName?: string;
  upakaraName?: string;
  keliangName?: string;
  juruRaksaName?: string;
  signatureDate?: string;
  formattedSigDate?: string;
  onSwitchToDokumen?: () => void;
  signatures?: DigitalSignatures;
  effectiveStamp?: string;
  embedSignatures?: boolean;
  showStamp?: boolean;
  sigSettings?: SignatureSettings;
}

type NaskahMode = 'bali' | 'bilingual' | 'cuecards';
type FontSize = 'normal' | 'medium' | 'large';

export const TabNaskahSidang: React.FC<TabNaskahSidangProps> = ({
  financialReport,
  expenditureAnalysis,
  reportDate,
  formattedReportDate,
  customPlace = 'Basangalas',
  institutionName = 'DESA ADAT BASANGALAS',
  upakaraName = 'Tata Kelola Kas Desa Adat',
  keliangName = 'I Made Mudita',
  juruRaksaName = 'I Putu Gede Sutrana',
  signatureDate,
  formattedSigDate = formattedReportDate,
  onSwitchToDokumen,
  signatures: propSignatures,
  effectiveStamp: propEffectiveStamp,
  embedSignatures: propEmbedSignatures,
  showStamp: propShowStamp,
  sigSettings: propSigSettings
}) => {
  const { showNotification } = useNotification();
  const [naskahMode, setNaskahMode] = useState<NaskahMode>('bali');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const totalHutang = Math.abs(financialReport?.totalKewajiban || 0);
  const isBebasHutang = totalHutang === 0;
  const surplusBersih = (financialReport?.surplusDefisit || 0) + (financialReport?.manualSurplusBalance || 0);
  const isSurplus = surplusBersih >= 0;

  // Tempekan & SHU LPD (Dana Pembangunan Desa) robust data resolution
  const totalTempekanAmount = Number(
    financialReport?.totalAsetKasTempekan ?? 
    financialReport?.totalAsetTempekan ?? 
    financialReport?.kasTempekan?.saldo ?? 
    (financialReport?.asetTempekan?.reduce((s: number, i: any) => s + (Number(i.saldo) || 0), 0) || 0)
  ) || Number(localStorage.getItem('neraca_saldo_tempekan')) || 0;

  const totalSHULPDAmount = Number(
    financialReport?.totalAsetKasSHULPD ?? 
    financialReport?.totalKasDPD ?? 
    financialReport?.kasDPD?.saldo ?? 
    0
  ) || Number(localStorage.getItem('neraca_saldo_shulpd')) || 0;

  // Format currency helpers
  const fKas = formatCurrency(financialReport?.totalAsetKas || 0);
  const fKasTunai = formatCurrency(financialReport?.kasJuruRaksaTunai?.saldo || 0);
  const fKasBank = formatCurrency(financialReport?.totalKasDesaAdat || 0);
  const fKasProgram = formatCurrency(financialReport?.totalAsetKasProgram || (totalSHULPDAmount + totalTempekanAmount));
  const fUrunan = formatCurrency(financialReport?.totalAsetDanaAci || 0);
  const fPunia = formatCurrency(financialReport?.totalAsetDanaPunia || 0);
  const fBelanjaKas = formatCurrency(expenditureAnalysis?.totalBelanja5Pos || 0);
  const fKasKeluar = formatCurrency(expenditureAnalysis?.totalKasKeluarJurnal || 0);
  const fParhyangan = formatCurrency(expenditureAnalysis?.totalParhyangan || 0);
  const fPawongan = formatCurrency(expenditureAnalysis?.totalPawongan || 0);
  const fPalemahan = formatCurrency(expenditureAnalysis?.totalPalemahan || 0);
  const fOperasional = formatCurrency((expenditureAnalysis?.totalTransportBebanAdat || 0) + (expenditureAnalysis?.totalOperasional || 0));
  const puniaBarangAmount = Number(expenditureAnalysis?.totalPuniaBarang) || 0;
  const hasPuniaBarang = puniaBarangAmount > 0;
  const fPuniaBarang = formatCurrency(puniaBarangAmount);
  const fTotalYadnya = formatCurrency(expenditureAnalysis?.totalRealisasiYadnya || 0);
  const fSurplus = formatCurrency(Math.abs(surplusBersih));
  const fHutang = formatCurrency(totalHutang);
  const fTempekan = formatCurrency(totalTempekanAmount);
  const fSHULPD = formatCurrency(totalSHULPDAmount);

  // Reactive Digital Signatures and Village Stempel
  const [storedSignatures, setStoredSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [storedSigSettings, setStoredSigSettings] = useState<SignatureSettings>(() => getSignatureSettings());
  const [autoEmbedSignatures, setAutoEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [stampOverlay, setStampOverlay] = useState<boolean>(() => isStampOverlayEnabled());

  useEffect(() => {
    const handleSigUpdate = () => {
      setStoredSignatures(getStoredSignatures());
      setStoredSigSettings(getSignatureSettings());
      setAutoEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setStampOverlay(isStampOverlayEnabled());
    };
    window.addEventListener('signatures-updated', handleSigUpdate);
    window.addEventListener('storage', handleSigUpdate);
    return () => {
      window.removeEventListener('signatures-updated', handleSigUpdate);
      window.removeEventListener('storage', handleSigUpdate);
    };
  }, []);

  const signatures = propSignatures || storedSignatures;
  const sigSettings = propSigSettings || storedSigSettings;
  const embedSignatures = propEmbedSignatures !== undefined ? propEmbedSignatures : autoEmbedSignatures;
  const showStamp = propShowStamp !== undefined ? propShowStamp : stampOverlay;
  const effectiveStamp = propEffectiveStamp || getEffectiveStamp(signatures, institutionName);

  // Struktur Naskah Sidang Basa Bali Alus & Terjemahan Bahasa Indonesia
  const sections = useMemo(() => [
    {
      id: 'purwaka',
      title: 'I. Purwaka & Pangaksama (Pangastungkara)',
      subtitle: 'Salam pembuka, penghormatan para pangelingsir, dan rasa syukur atas panugrahan Ida Sang Hyang Widhi Wasa',
      bali: `Om Swastyastu,

Majeng ring Ida Bhatara Sasuhunan sane malinggih malingga ring kahyangan desa, sane ngicenin panugrahan karahajengan lan kerahayuan.
Sane wangiang titiang Jero Bendesa Adat ${institutionName} pinaka manggala pamucuk desa.
Sane suciang titiang para Jero Mangku kahyangan sami.
Taler majeng ring para Kelihan Banjar Adat, Prajuru Desa, Penempek Sami, miwah Ida Dane krama desa sane dahat tresna asihin titiang sami.

Sadurung titiang matur amatra indik laporan pertanggungjawaban kas lan neraca puniki, lugrayang titiang pinaka Juru Raksa ngaturang pangaksama sane pinih ageng. 
Swadharma ngamel jinah krama puniki mabuat pisan, kadi nyaga tirtha ning sane patut satata bening, jujur, mawali ring kasucian, lan prasida katanggungjawabang ring niskala miwah skala. Ring paruman sane becik puniki, titiang ngaturang laporan posisi keuangan neraca per tanggal ${formattedReportDate} madasar bukti fisik, catetan BKU, lan rekonsiliasi kas sane tuhu patut.`,
      indo: `Om Swastyastu,

Kepada Ida Sang Hyang Widhi Wasa / Tuhan Yang Maha Esa yang melimpahkan keselamatan dan kerahayuan.
Yang saya hormati Jero Bendesa Adat ${institutionName} selaku pimpinan tertinggi desa adat.
Yang saya sucikan para Jero Pemangku adat sekalian.
Yang sangat saya hormati para pengurus Sabha Desa dan Badan Pengawas Keuangan Adat selaku pengawas tata kelola keuangan.
Serta kepada para Kelihan Banjar Adat, Sekretaris, Bendahara, dan seluruh warga krama desa adat yang saya cintai.

Sebelum saya menyampaikan pertanggungjawaban pembukuan kas dan neraca ini, izinkanlah saya selaku Juru Raksa (Bendahara Pengelola Kas) menyampaikan permohonan maaf dan ketulusan hati. Mengemban amanah mengelola dana krama desa adalah tanggung jawab luhur yang laksana menjaga air suci—harus senantiasa jernih, transparan, akuntabel, serta dapat dipertanggungjawabkan secara skala (administratif) maupun niskala (spiritual). Pada persidangan paruman yang suci ini, kami sampaikan laporan neraca per tanggal ${formattedReportDate} berdasarkan bukti fisik transaksi, Buku Kas Umum, dan rekonsiliasi yang sahih.`,
      points: [
        'Salam pembuka Om Swastyastu & doa syukur kehadirat Hyang Widhi Wasa.',
        'Penghormatan kepada Bendesa Adat, Sabha Desa / Badan Pengawas, Pamangku, & Krama Sami.',
        'Komitmen integritas Juru Raksa: Menjaga kas desa laksana menjaga air suci (transparan, jujur, akuntabel).'
      ]
    },
    {
      id: 'harta_kas',
      title: 'II. Piteket Aset & Saldo Kas Desa (Posisi Likuiditas)',
      subtitle: 'Paparan kas aktif, kas tunai siap pakai di tangan juru raksa, rekening bank/LPD, urunan, lan dana punia',
      bali: `Inggih Ida Dane krama sami sane wangiang titiang,
Kaping pertama, indik kahanan Aset Kas utawi jinah desa adat sane kakepeg:

1. Saldo Aset Kas & Setara Kas Desa Adat sami sane wenten ring desa adat mangkin punika agengnyane ${fKas} sane kepah :
2. Jinah tunai siap pakai sane kategen langsung olih Juru Raksa ring brankas/dompet operasional anggen belanja sane gelis inggih punika ${fKasTunai}.
3. Jinah kas sane kasimpen rapi ring Rekening Bank / LPD anggen keamanan lan cadangan sami wenten ${fKasBank}.${financialReport?.totalAsetKasProgram > 0 || totalSHULPDAmount > 0 || totalTempekanAmount > 0 ? ` Taler wenten kas aset lainnya agengnyane ${fKasProgram}, sane kasimpen manut tetujon program khusus desa adat inggih punika :
   Kas Dana Pembangunan Desa (SHU LPD) agengnyane ${fSHULPD}${totalSHULPDAmount > 0 && totalTempekanAmount > 0 ? ' lan ' : ''}${totalTempekanAmount > 0 ? `Kas Simpanan Tempekan agengnyane ${fTempekan}` : ''}.` : ''}
4. Indik penerimaan dana gotong royong saking Krama, urunan utawi peturunan krama, utawi Subsidi saking Tempekan Desa sane ngranjing sami wenten ${fUrunan}.
5. Taler saking ketulusan manah para pamedek lan krama ring Dana Punia miwah Pendapatan Asli Desa Adat punika sampun terhimpun agengnyane ${fPunia}.

Sami jinah puniki sampun kasurat, kalinggihang ring Buku Kas Umum (BKU) lan kaselarasang ring buku kas bank. Nenten wenten jinah sane magenah ring genah sane remang-remang, sami prasida kacingak lan katilik malih ring lampiran rincian rekening.`,
      indo: `Bapak, Ibu, dan seluruh krama desa yang saya hormati,
Pertama, perihal posisi Aset Kas dan likuiditas dana kas desa adat yang tercatat:

1. Total Aset Kas & Setara Kas yang dimiliki desa adat saat ini berjumlah ${fKas}.
2. Kas tunai siap pakai yang dipegang langsung oleh Juru Raksa untuk transaksi langsung dan mendesak sebesar ${fKasTunai}.
3. Kas simpanan resmi di rekening Bank / LPD untuk keamanan dan cadangan dana sebesar ${fKasBank}.${financialReport?.totalAsetKasProgram > 0 || totalSHULPDAmount > 0 || totalTempekanAmount > 0 ? ` Serta terdapat kas program khusus desa sebesar ${fKasProgram}${totalSHULPDAmount > 0 || totalTempekanAmount > 0 ? `, yang dialokasikan khusus untuk: ${totalSHULPDAmount > 0 ? `Kas Dana Pembangunan Desa (SHU LPD) sebesar ${fSHULPD}` : ''}${totalSHULPDAmount > 0 && totalTempekanAmount > 0 ? ' dan ' : ''}${totalTempekanAmount > 0 ? `Kas Simpanan Tempekan sebesar ${fTempekan}` : ''}` : ''}.` : ''}
4. Penerimaan urunan / peturunan gotong royong krama yang terhimpun berjumlah ${fUrunan}.
5. Penerimaan dari ketulusan Dana Punia dan Pendapatan Asli Desa Adat berjumlah ${fPunia}.

Seluruh aliran uang ini telah tercatat tertib di Buku Kas Umum (BKU) dan direkonsiliasi dengan rekening koran. Tidak ada dana yang berada di area abu-abu; seluruhnya transparan dan dapat diperiksa pada lampiran pembukuan.`,
      points: [
        `Total Kas Aktif Tersedia: ${fKas}`,
        `Kas Tunai di Juru Raksa (Siap Belanja): ${fKasTunai}`,
        `Kas di Bank / LPD Desa: ${fKasBank}`,
        ...(totalSHULPDAmount > 0 ? [`Kas Dana Pembangunan Desa (SHU LPD): ${fSHULPD}`] : []),
        ...(totalTempekanAmount > 0 ? [`Kas Simpanan Tempekan: ${fTempekan}`] : []),
        `Total Penerimaan Urunan Krama: ${fUrunan}`,
        `Total Penerimaan Dana Punia: ${fPunia}`
      ]
    },
    {
      id: 'belanja_yadnya',
      title: 'III. Pangwedaran Belanja Kas & Penyerapan Yadnya (Tri Hita Karana)',
      subtitle: hasPuniaBarang 
        ? 'Pertanggungjawaban alokasi kas langsung untuk Parhyangan, Pawongan, Palemahan, lan Punia Barang'
        : 'Pertanggungjawaban alokasi kas langsung untuk Parhyangan, Pawongan, miwah Palemahan',
      bali: `Kaping kalih, indik belanja desa adat utawi pangamedalan jinah kas:

Jinah kas sane medal saking buku kas (Jurnal & BKU) anggen nyokong sahananing swadharma desa adat punika ${fKasKeluar}, antuk realisasi belanja langsung agengnyane ${fBelanjaKas}. Jinah puniki kaalokasikang manut tetujon Tri Hita Karana:
• Pos Parhyangan (Aci piodalan, upakara yadnya, sarana bebantenan, pecanangan pura): ${fParhyangan}.
• Pos Pawongan (santunan kematian, pasraman/Bulan Bahasa): ${fPawongan}.
• Pos Palemahan (Pamelat palemahan, penataan setra, kebersihan wewidangan pura): ${fPalemahan}.
• Pos Operasional & Beban Adat (Pesangkepan, ATK kantor, listrik, PDAM, transport & Uang saku): ${fOperasional}.` + (hasPuniaBarang ? `

Pateget sane mabuat pisan katur ring krama sami:
Sujatinyane total nilai yadnya lan operasional sane mamargi nenten wantah ${fBelanjaKas}, nanging nyantos ${fTotalYadnya}.
Napi mawinan prasida asapunika? Santukan wenten punia marupa BARANG (Non-Kas) saking para krama sane nilainyane ${fPuniaBarang} (kadi beras, klapa, ayam, bebek, babi caru, wastra). Yadiastun nenten nganggen jinah kas desa anggen numbas, barang puniki nyata sampun ngranjing lan telas kaanggen ring yadnya. Puniki pinaka bukti luhur, krama desa adat ${institutionName} satata masikian ngaturang ketulusan anggen nyujur kerahayuan.` : `

Sahananing pangamedalan belanja kas puniki sampun kalaksanayang madasar tatakrama, hemat, lan patitis manut piteket swadharma agama miwah swadharma negara, mangda satata ngawetuang karahayuan lan katentreman ring wewidangan desa sami.`),
      indo: `Kedua, penyampaian pertanggungjawaban realisasi belanja dan arus kas keluar:

Total uang kas yang keluar dari pembukuan kas (BKU & Jurnal) untuk membiayai kebutuhan desa adat adalah sebesar ${fKasKeluar}, dengan realisasi belanja langsung akun operasional sebesar ${fBelanjaKas}. Anggaran ini dialokasikan selaras dengan prinsip Tri Hita Karana:
• Pos Parhyangan (Upakara piodalan, banten, aci, pemeliharaan pura): ${fParhyangan}.
• Pos Pawongan (Pemberdayaan warga, dana santunan kematian, pasraman krama): ${fPawongan}.
• Pos Palemahan (Kebersihan lingkungan pura, penataan setra, sarana fisik desa): ${fPalemahan}.
• Pos Operasional Adat (Kesekretariatan, ATK kantor, paruman, listrik/air, operasional): ${fOperasional}.` + (hasPuniaBarang ? `

Catatan istimewa dan penting bagi seluruh warga:
Sesungguhnya total nilai kegiatan yadnya yang terlaksana bukan hanya ${fBelanjaKas}, melainkan mencapai ${fTotalYadnya}.
Mengapa demikian? Karena ada sumbangan punia berwujud BARANG (Non-Kas) dari warga yang bernilai ${fPuniaBarang} (seperti beras, kelapa daksina, ayam caru, babi, kain pelinggih). Meskipun desa tidak mengeluarkan uang kas sepeser pun untuk membelinya, barang tersebut nyata diterima dan habis dimanfaatkan untuk yadnya. Ini membuktikan bahwa gotong royong warga ${institutionName} sangat hidup dan tak ternilai dengan uang semata.` : `

Seluruh pengeluaran belanja kas ini telah direalisasikan secara tepat guna dan efisien sesuai kebutuhan upakara yadnya, kegiatan krama, dan operasional desa adat demi memelihara kerahayuan bersama.`),
      points: [
        `Total Realisasi Belanja Kas: ${fBelanjaKas}`,
        `Alokasi Parhyangan (Upakara & Pura): ${fParhyangan}`,
        `Alokasi Pawongan (Warga & Santunan): ${fPawongan}`,
        `Alokasi Palemahan (Lingkungan & Setra): ${fPalemahan}`,
        `Alokasi Operasional Adat: ${fOperasional}`,
        ...(hasPuniaBarang ? [
          `Nilai Gotong Royong Punia Barang (Non-Kas): ${fPuniaBarang}`,
          `Total Nilai Riil Kegiatan Yadnya Gabungan: ${fTotalYadnya}`
        ] : [])
      ]
    },
    {
      id: 'status_hutang_surplus',
      title: 'IV. Kahanan Utang & Surplus Berjalan',
      subtitle: 'Kepastian status pelunasan kewajiban pihak ketiga dan saldo surplus bersih kas desa',
      bali: `Kaping tiga, indik kewajiban utang piutang lan surplus berjalan:

${isBebasHutang ? `Sane pinih utama tur ngawinang manah titiang sami liang lan padang, Desa Adat ${institutionName} ring galahe mangkin magenah ring status BEBAS HUTANG utawi NOL KEWAJIBAN (Rp 0). Nenten wenten sisa bon ring warung, nenten wenten tagihan rekanan sane nunggak, lan nenten wenten pinjaman saking pihak ketiga.` : `Ring galahe mangkin, kantun wenten kewajiban belanja / hutang pihak ketiga sane katureksain agengnyane ${fHutang}. Kewajiban puniki sampun kaselarasang ring rencana kas lan pacang kalunasang manut tata cara sane sampun kasungkemin.`}

Madasar petikan kalkulasi neraca puniki, posisi kas periode berjalan nyihnayang ${isSurplus ? `SURPLUS BERSIH agengnyane ${fSurplus}` : `DEFISIT OPERASIONAL agengnyane ${fSurplus}`}.
${isSurplus ? `Jinah surplus ${fSurplus} puniki nenten ical, nanging tetep utuh dados Kas Selembar sane kasimpen ring kas aktif desa, sane pacang dados modal utama kas anggen nyokong upakara, karya agung, lan pembangunan desa adat ring galah sane jagi rauh.` : `Defisit puniki sampun katutupin antuk saldo simpanan kas sane wenten sadurungnyane sajeroning ngukuhang swadharma desa.`}`,
      indo: `Ketiga, perihal status kewajiban hutang dan surplus berjalan desa:

${isBebasHutang ? `Hal yang paling membanggakan dan melegakan kita semua: Desa Adat ${institutionName} saat ini berada dalam posisi BEBAS HUTANG (NOL KEWAJIBAN / Rp 0). Tidak ada bon belanja warung yang tertunggak, tidak ada tagihan rekanan yang belum dibayar, dan tidak ada pinjaman kepada pihak ketiga. Ini adalah bukti nyata tata kelola keuangan desa adat yang sehat, disiplin, dan berwibawa.` : `Saat ini masih tercatat kewajiban belanja / hutang pihak ketiga sebesar ${fHutang}. Posisi ini telah terjadwalkan dengan baik dan siap dilunasi sesuai kesepakatan bersama.`}

Berdasarkan perhitungan neraca yang teruji, posisi kinerja kas saat ini membukukan ${isSurplus ? `SURPLUS BERSIH sebesar ${fSurplus}` : `DEFISIT BERJALAN sebesar ${fSurplus}`}.
${isSurplus ? `Dana surplus ${fSurplus} ini tidak berkurang sedikit pun, melainkan utuh tersimpan sebagai Saldo Kas Bebas yang siap menjadi kekuatan modal pendanaan karya yadnya, program krama, dan perawatan desa adat di masa mendatang.` : `Defisit operasional ini telah tercukupi dengan baik melalui saldo kas awal yang tersedia.`}`,
      points: [
        isBebasHutang ? 'Status Kewajiban: 100% BEBAS HUTANG (Rp 0 / Nihil Utang Rekanan)' : `Kewajiban Belanja Tercatat: ${fHutang}`,
        `Kinerja Bersih Berjalan: ${isSurplus ? `SURPLUS BERSIH (+${fSurplus})` : `DEFISIT (-${fSurplus})`}`,
        'Keamanan Dana: Surplus tersimpan aman di kas aktif & rekening Bank/LPD desa.'
      ]
    },
    {
      id: 'audit_pengawas',
      title: 'V. Piteket Majeng Badan Pengawas Keuangan & Sabha Desa',
      subtitle: 'Kesiapan dokumen bukti, nota, kuitansi, dan pembukuan BKU untuk diverifikasi pengawas',
      bali: `Majeng ring para prajuru Sabha Desa miwah angga Badan Pengawas Keuangan Adat sane dahat kusumayang titiang,
Pinaka akuntan lan juru raksa sane ngamargiang asas keterbukaan, sahananing bukti fisik kadi:
1. Nota belanja lan kuitansi sah saking rekanan lan warung,
2. Nomor bukti transaksi Jurnal Umum lan BKU,
3. Lembar rekening koran bank lan buku tabungan LPD,
Sami sampun kacumpu lan kapejang ring meja sidang pameriksaan. Titiang nyiagayang raga mangda katilik, kapidartayang, lan kasampurnayang yening wenten pituduh sane becik anggen nyanggra kaluwihan desa adat kawekasan.`,
      indo: `Kepada para anggota Sabha Desa dan Badan Pengawas Keuangan Adat yang saya hormati,
Sebagai juru raksa pengelola kas yang menjunjung tinggi asas transparansi dan akuntansi profesional:
1. Seluruh nota transaksi dan kwitansi sah dari rekanan / warung,
2. Nomor register transaksi Jurnal Umum dan BKU,
3. Rekening koran bank dan buku kas LPD,
Seluruhnya telah kami siapkan di meja sidang pemeriksaan. Kami siap untuk diverifikasi dan menerima saran pembinaan yang konstruktif demi kemajuan tata kelola desa adat kita bersama.`,
      points: [
        'Kesiapan Berkas: Kwitansi, nota, bon belanja, dan buku rekening siap diaudit.',
        'Asas Keterbukaan: Tidak ada transaksi fiktif atau terselubung.',
        'Kesiapan diverifikasi oleh Badan Pengawas Keuangan & Sabha Desa Adat.'
      ]
    },
    {
      id: 'pamuput',
      title: 'VI. Panyineb & Pamuput (Doa Kerahayuan lan Parama Santih)',
      subtitle: 'Kata penutup, permohonan maaf atas kekurangan, dan doa kerahayuan desa adat',
      bali: `Inggih Ida Dane krama sami, Jero Bendesa, lan para Prajuru sane kusumayang titiang,
Asapunika laporan pertanggungjawaban kas neraca sane prasida katur olih titiang pinaka Juru Raksa Desa Adat ${institutionName}. Titiang ngaturang suksma ping banget antuk uratian, pasemetonan, lan pitresnan Ida Dane sami. Yening wenten atur titiang sane nenten manut ring anggah-ungguhing basa, kirang langkung atur titiang, titiang nunas geng rena pangampura.

Dumogi Ida Sang Hyang Widhi Wasa satata mapaica kerahayuan, karahajengan, lan kasukertan majeng ring krama Desa Adat ${institutionName} sami.

Om Santih, Santih, Santih, Om.`,
      indo: `Bapak, Ibu, seluruh krama desa, Jero Bendesa, dan para Pengurus yang saya hormati,
Demikianlah naskah pertanggungjawaban kas neraca yang dapat kami sampaikan selaku Juru Raksa Desa Adat ${institutionName}. Kami menghaturkan terima kasih yang sebesar-besarnya atas perhatian, kepercayaan, dan kebersamaan seluruh krama. Apabila ada tutur kata atau tata bahasa yang kurang berkenan, dengan kerendahan hati kami memohon maaf yang sedalam-dalamnya.

Semoga Ida Sang Hyang Widhi Wasa senantiasa menganugerahkan keselamatan, kedamaian, dan kerahayuan bagi segenap warga krama Desa Adat ${institutionName}.

Om Santih, Santih, Santih, Om.`,
      points: [
        'Ucapan terima kasih atas amanah dan kepercayaan seluruh krama.',
        'Permohonan maaf atas segala keterbatasan tutur kata.',
        'Doa kerahayuan dan penutup Parama Santih.'
      ]
    }
  ], [
    institutionName,
    formattedReportDate,
    fKas,
    fKasTunai,
    fKasBank,
    fKasProgram,
    fUrunan,
    fPunia,
    fBelanjaKas,
    fKasKeluar,
    fParhyangan,
    fPawongan,
    fPalemahan,
    fOperasional,
    fPuniaBarang,
    fTotalYadnya,
    fSurplus,
    fHutang,
    isBebasHutang,
    isSurplus,
    financialReport
  ]);

  // Handler Copy All
  const handleCopyAll = () => {
    let text = `NASKAH SIDANG PARUMAN PERTANGGUNGJAWABAN KEUANGAN DESA ADAT\n${institutionName.toUpperCase()}\nPosisi Laporan: ${formattedReportDate}\nPenyaji: Juru Raksa / Bendahara Adat (${juruRaksaName})\n\n`;

    sections.forEach(sec => {
      text += `=== ${sec.title} ===\n`;
      if (naskahMode === 'bali' || naskahMode === 'bilingual') {
        text += `[Basa Bali Alus]:\n${sec.bali}\n\n`;
      }
      if (naskahMode === 'bilingual') {
        text += `[Terjemahan Indonesia]:\n${sec.indo}\n\n`;
      }
      if (naskahMode === 'cuecards') {
        text += `[Poin Inti Mimbar]:\n${sec.points.map(p => `• ${p}`).join('\n')}\n\n`;
      }
    });

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    playSaveSuccessSound();
    showNotification('Seluruh naskah sidang berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Handler Copy Section
  const handleCopySection = (sec: typeof sections[0]) => {
    let text = `${sec.title}\n\n`;
    if (naskahMode === 'bali') {
      text += sec.bali;
    } else if (naskahMode === 'bilingual') {
      text += `[Basa Bali]:\n${sec.bali}\n\n[Terjemahan]:\n${sec.indo}`;
    } else {
      text += sec.points.map(p => `• ${p}`).join('\n');
    }

    navigator.clipboard.writeText(text);
    setCopiedSection(sec.id);
    playSaveSuccessSound();
    showNotification(`Bagian "${sec.title.split(' ')[1]}" berhasil disalin!`, 'info');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Handler Print Naskah Mimbar
  const handlePrintNaskah = () => {
    showNotification('Mempersiapkan lembar cetak naskah sidang mimbar...', 'info');
    document.body.classList.add('print-naskah-mode');
    setTimeout(() => {
      window.print();
    }, 150);

    const cleanup = () => {
      document.body.classList.remove('print-naskah-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 3000);
  };

  // Handler Download Text File
  const handleDownloadText = () => {
    let content = `NASKAH RESMI SIDANG PERTANGGUNGJAWABAN KEUANGAN DESA ADAT\n`;
    content += `${institutionName.toUpperCase()}\n`;
    content += `Tempat: ${customPlace} | Posisi Laporan: ${formattedReportDate}\n`;
    content += `Disusun & Dibacakan Oleh: Juru Raksa (${juruRaksaName})\n`;
    content += `Mengetahui: Bendesa Adat (${keliangName})\n`;
    content += `========================================================================\n\n`;

    sections.forEach(s => {
      content += `------------------------------------------------------------------------\n`;
      content += `${s.title.toUpperCase()}\n`;
      content += `------------------------------------------------------------------------\n`;
      content += `[BASA BALI ALUS PARUMAN]:\n${s.bali}\n\n`;
      content += `[TERJEMAHAN BAHASA INDONESIA]:\n${s.indo}\n\n`;
      content += `[POIN KUNCI PODIUM]:\n${s.points.map(p => `- ${p}`).join('\n')}\n\n`;
    });

    content += `========================================================================\n`;
    content += `Disahkan di ${customPlace}, pada ${formattedReportDate}\n`;
    content += `Juru Raksa: ${juruRaksaName}   |   Bendesa Adat: ${keliangName}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Naskah_Sidang_Pertanggungjawaban_${institutionName.replace(/\s+/g, '_')}_${reportDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    playSyncSuccessSound();
    showNotification('Berkas naskah sidang berhasil diunduh.', 'success');
  };

  // Font size classes
  const fontClass = {
    normal: 'text-xs leading-relaxed',
    medium: 'text-sm leading-relaxed',
    large: 'text-base sm:text-lg leading-loose'
  }[fontSize];

  return (
    <div className="space-y-6">
      {/* Specific Print CSS for Naskah Sidang */}
      <style>{`
        @media print {
          body.print-naskah-mode #printable-naratif-area {
            display: none !important;
          }
          body.print-naskah-mode #printable-naskah-sidang-area {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          body.print-naskah-mode #printable-naskah-sidang-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .page-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* --- HEADER NAVIGASI & AKSI NASKAH SIDANG --- */}
      <div className="no-print p-4 bg-white border-b-4 border-indigo-700/50 rounded-2xl pb-4 sm:p-6 relative overflow-hidden">

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300 shadow-inner">
              <ScrollText size={28} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-serif tracking-wide">
                  Naskah Sidang Pertanggungjawaban
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Basa Bali Alus Paruman
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Akuntan &amp; Juru Raksa
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Teks pidarta resmi pertanggungjawaban keuangan kas dan neraca di hadapan <em>krama sami</em> dan <em>Badan Pengawas Keuangan Adat</em>.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {onSwitchToDokumen && (
              <button
                type="button"
                onClick={onSwitchToDokumen}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
                title="Beralih ke format Dokumen Cetak Neraca"
              >
                <FileText size={14} />
                <span>Dokumen Cetak</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              title="Salin seluruh naskah pidarta ke clipboard"
            >
              {copiedAll ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedAll ? 'Tersalin!' : 'Salin Naskah'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadText}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Unduh berkas teks naskah sidang (.txt)"
            >
              <Download size={14} />
              <span>Unduh Teks</span>
            </button>

            <button
              type="button"
              onClick={handlePrintNaskah}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95"
              title="Cetak format naskah mimbar pidarta siap baca di podium"
            >
              <Printer size={14} />
              <span>Cetak Mimbar</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- KONTROL PENGATURAN TAMPILAN & MODE BACA --- */}
      <div className="no-print bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Mode Pilihan Naskah */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-medium">Gaya Penyampaian:</span>
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setNaskahMode('bali')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                naskahMode === 'bali'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Basa Bali Alus
            </button>
            <button
              type="button"
              onClick={() => setNaskahMode('bilingual')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                naskahMode === 'bilingual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Dwibahasa (Bali + Indo)
            </button>
            <button
              type="button"
              onClick={() => setNaskahMode('cuecards')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                naskahMode === 'cuecards'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Kartu Mimbar (Cue Cards)
            </button>
          </div>
        </div>

        {/* Font Size Adjuster */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Type size={14} />
            <span>Ukuran Huruf:</span>
          </span>
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setFontSize('normal')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                fontSize === 'normal' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kecil
            </button>
            <button
              type="button"
              onClick={() => setFontSize('medium')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                fontSize === 'medium' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sedang
            </button>
            <button
              type="button"
              onClick={() => setFontSize('large')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                fontSize === 'large' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Ukuran besar sangat nyaman dibaca saat berdiri di podium"
            >
              Besar (Podium)
            </button>
          </div>
        </div>
      </div>

      {/* --- AREA UTAMA LEMBAR NASKAH SIDANG (PRINTABLE & READABLE) --- */}
      <div 
        id="printable-naskah-sidang-area"
        className="bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-300 p-6 sm:p-10 font-sans print:shadow-none print:border-none print:p-0"
      >
        {/* KOP RESMI DOKUMEN NASKAH SIDANG */}
        <div className="border-b-4 border-double border-slate-900 pb-4 mb-6 text-center break-inside-auto">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="p-2 bg-slate-100 border border-slate-600 rounded-lg text-slate-900 print:border-slate-900">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif font-black tracking-wider uppercase text-slate-950 m-0">
                {institutionName}
              </h1>
              <p className="text-xs sm:text-sm font-serif font-bold text-slate-800 uppercase tracking-widest m-0">
                PERTANGGUNGJAWABAN KEUANGAN KAS &amp; NERACA
              </p>
            </div>
          </div>
          <p className="text-xs font-sans text-slate-600 italic mt-0.5">
            Titimangsa: {customPlace}, Posisi Laporan Per: {formattedReportDate}
          </p>
        </div>

        {/* JUDUL NASKAH */}
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-950 font-black text-[11px] uppercase tracking-widest rounded-full mb-2">
            NASKAH RESMI WICARA MANGGALA JURU RAKSA
          </span>
          <h2 className="text-base sm:text-xl font-black uppercase tracking-wide text-slate-950 font-serif underline decoration-2 underline-offset-4">
            PIDARTA PERTANGGUNGJAWABAN KEUANGAN KAS DESA ADAT
          </h2>
          <p className="text-xs font-mono text-slate-600 mt-1">
            Penyaji: <strong>{juruRaksaName}</strong> (Juru Raksa / Bendahara Adat) • Mengetahui: <strong>{keliangName}</strong> (Bendesa Adat)
          </p>
        </div>

        {/* DAFTAR BAB / SECTIONS */}
        <div className="space-y-8 break-inside-auto">
          {sections.map((sec, idx) => (
            <div 
              key={sec.id}
              className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all print:border-none print:p-0 print:bg-transparent page-break-auto"
            >
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-300 gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-950 font-serif flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 print:hidden" />
                    <span>{sec.title}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 italic mt-0.5">
                    {sec.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2 no-print self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleCopySection(sec)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                    title="Salin bagian ini saja"
                  >
                    {copiedSection === sec.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedSection === sec.id ? 'Tersalin' : 'Salin Bab'}</span>
                  </button>
                </div>
              </div>

              {/* Tampilan Sesuai Mode */}
              {naskahMode === 'bali' && (
                <div className={`text-slate-800 font-serif whitespace-pre-line ${fontClass}`}>
                  {sec.bali}
                </div>
              )}

              {naskahMode === 'bilingual' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-300">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block mb-2">
                      Basa Bali Alus Paruman:
                    </span>
                    <div className={`text-slate-900 font-serif whitespace-pre-line ${fontClass}`}>
                      {sec.bali}
                    </div>
                  </div>

                  <div className="bg-slate-100/80 p-4 rounded-xl border border-slate-300">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-200 px-2 py-0.5 rounded border border-slate-300 inline-block mb-2">
                      Arti / Terjemahan Bahasa Indonesia:
                    </span>
                    <div className={`text-slate-700 font-sans whitespace-pre-line ${fontClass}`}>
                      {sec.indo}
                    </div>
                  </div>
                </div>
              )}

              {naskahMode === 'cuecards' && (
                <div className="bg-white p-4 rounded-xl border-2 border-indigo-300/80 shadow-xs space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full inline-block">
                    Poin Utama Bicara Podium:
                  </span>
                  <ul className="space-y-2">
                    {sec.points.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2 text-slate-800 font-medium">
                        <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                        <span className={fontClass}>{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <details className="mt-2 text-xs text-slate-600 border-t border-slate-200 pt-2 cursor-pointer">
                    <summary className="font-bold text-indigo-600 hover:text-indigo-700 select-none">
                      Buka Naskah Lengkap Basa Bali
                    </summary>
                    <p className="mt-2 text-slate-800 font-serif whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {sec.bali}
                    </p>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* LEMBAR PENGESAHAN TANDA TANGAN NASKAH */}
      <div className="pt-6 border-t border-slate-300 break-inside-avoid">
        <div className="flex justify-end mb-4 text-xs text-slate-700">
          <div className="text-right">
            <p>Ditetapkan di: <span className="font-bold text-slate-900">{customPlace}</span></p>
            <p>Pada Tanggal: <span className="font-bold text-slate-900">{formattedSigDate}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 text-center text-xs sm:text-sm text-slate-900 font-serif">
          {/* Sisi Kiri: Mengetahui Keliang Adat */}
          <div className="space-y-1">
            <p className="not-italic text-slate-700">Mengetahui,</p>
            <p className="font-bold text-slate-950 text-sm sm:text-base relative z-10">Keliang Adat Basangalas</p>
            <div className="h-16 sm:h-20 flex items-center justify-center relative">
              {/* STEMPEL RESMI DESA ADAT - Posisi di Keliang Adat, mengambil tempat setengah nama Keliang Adat ke kiri, mengenai tanda tangan dan label pejabat */}
              {showStamp && effectiveStamp && (
                <div 
                  className="absolute pointer-events-none select-none z-0"
                  style={{
                    left: '30%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 0.92,
                    filter: 'drop-shadow(0 1px 2px rgba(159, 18, 57, 0.2))'
                  }}
                >
                  <img 
                    src={effectiveStamp} 
                    alt="Stempel Resmi Desa Adat" 
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain max-w-none mix-blend-multiply" 
                    style={{
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                      transform: `scale(${((sigSettings.stampScale || 100) / 100) * 1.3})`
                    }}
                  />
                </div>
              )}
              {embedSignatures && signatures?.keliang ? (
                <img 
                  src={signatures.keliang} 
                  alt="TTD Keliang" 
                  className="max-h-16 sm:max-h-20 object-contain relative z-10" 
                />
              ) : (
                <span className="text-[10px] text-slate-400 italic select-none no-print">[ Tanda Tangan ]</span>
              )}
            </div>
            <p className="font-bold border-b-2 border-slate-900 uppercase pb-0.5 inline-block min-w-[150px] sm:min-w-[220px] text-slate-950 relative z-10">
              {keliangName}
            </p>
          </div>

          {/* Sisi Kanan: Juru Raksa */}
          <div className="space-y-1">
            <p className="not-italic text-slate-700">{customPlace}, {formattedSigDate}</p>
            <p className="font-bold text-slate-950 text-sm sm:text-base">Juru Raksa</p>
            <div className="h-16 sm:h-20 flex items-center justify-center relative">
              {embedSignatures && signatures?.juruRaksa ? (
                <img 
                  src={signatures.juruRaksa} 
                  alt="TTD Juru Raksa" 
                  className="max-h-16 sm:max-h-20 object-contain relative z-10" 
                />
              ) : (
                <span className="text-[10px] text-slate-400 italic select-none no-print">[ Tanda Tangan ]</span>
              )}
            </div>
            <p className="font-bold border-b-2 border-slate-900 uppercase pb-0.5 inline-block min-w-[150px] sm:min-w-[220px] text-slate-950">
              {juruRaksaName}
            </p>
          </div>
        </div>
      </div>
      {/* Formal Footer Layout (Lembar Ke-2) */}
      <div className="neraca-main-footer justify-between items-center mt-6 print:mt-4 pt-2 border-t border-slate-300 print:px-2 text-slate-900 break-inside-auto">
          <div>
              <p className="font-semibold print:text-[11px] print:text-slate-500">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
              <p className="print:text-[9px] text-slate-500 print:text-slate-400">Transparansi dan integritas data keuangan terjamin &amp; terautentikasi secara digital.</p>
          </div>
          <div className="text-right font-mono print:text-[9px] text-slate-500 print:text-slate-700">
              <p className="hidden print:block font-bold">https://desaadatbasangalas.netlify.app</p>
             {/*} <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p> */}
          </div>
      </div>
      </div>
    </div>
  );
};

export default TabNaskahSidang;
