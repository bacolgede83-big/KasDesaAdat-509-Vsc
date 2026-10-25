import * as XLSX from 'xlsx';
import { 
  BkuData, 
  BkpData, 
  BudgetItem, 
  DanaPuniaItem, 
  UrunanItem, 
  JuDisplayRow, 
  PepesonItem 
} from '../types';

export interface Export7ModulesData {
  bkuData: BkuData[];
  bkpData: BkpData[];
  budgetItems: BudgetItem[];
  danaPuniaItems: DanaPuniaItem[];
  urunanItems: UrunanItem[];
  juData: JuDisplayRow[];
  pepesonItems: PepesonItem[];
  villageProfile?: {
    namaDesa?: string;
    alamat?: string;
    namaKetua?: string;
    namaBendahara?: string;
  };
}

export interface ExportOptions {
  yearFilter?: string; // 'all' or specific year like '2026'
  villageName?: string;
}

// Helper to filter data by year if specified
const filterByYear = (dateStr?: string, yearFilter?: string): boolean => {
  if (!yearFilter || yearFilter === 'all') return true;
  if (!dateStr) return false;
  return dateStr.startsWith(yearFilter);
};

// Helper to calculate column widths
const autoFitCols = (wsData: any[][]): XLSX.ColInfo[] => {
  if (!wsData || wsData.length === 0) return [];
  const colWidths: number[] = [];
  
  wsData.forEach(row => {
    if (!row) return;
    row.forEach((cell, colIdx) => {
      const cellLen = cell !== null && cell !== undefined ? String(cell).length : 0;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, cellLen + 3);
    });
  });

  return colWidths.map(w => ({ wch: Math.min(Math.max(w, 10), 60) }));
};

/**
 * Generates and downloads the full 7 modules as a modern multi-sheet .xlsx workbook.
 */
export const download7ModulesXLSX = (
  data: Export7ModulesData,
  options: ExportOptions = {}
): { success: boolean; filename: string; totalRecords: number } => {
  const { yearFilter = 'all', villageName = 'Desa Adat Basangalas' } = options;
  const periodLabel = yearFilter === 'all' ? 'Semua Tahun (Konsolidasi)' : `Tahun Anggaran ${yearFilter}`;
  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const wb = XLSX.utils.book_new();

  // 1. FILTER DATA BY YEAR
  const bku = data.bkuData.filter(item => filterByYear(item.tanggal, yearFilter));
  const bkp = data.bkpData.filter(item => filterByYear(item.tanggal, yearFilter));
  const budget = data.budgetItems.filter(item => {
    if (!yearFilter || yearFilter === 'all') return true;
    return item.tahun ? String(item.tahun) === yearFilter : true;
  });
  const punia = data.danaPuniaItems.filter(item => filterByYear(item.date || (item as any).tanggal, yearFilter));
  const urunan = data.urunanItems.filter(item => filterByYear(item.date || (item as any).tanggal, yearFilter));
  const ju = data.juData.filter(item => filterByYear(item.date || (item as any).tanggal, yearFilter));
  const pepeson = data.pepesonItems; // Pepeson is master/current distribution

  // TOTALS CALCULATION
  const bkuTotalPenerimaan = bku.reduce((sum, i) => sum + (Number(i.penerimaan) || 0), 0);
  const bkuTotalPengeluaran = bku.reduce((sum, i) => sum + (Number(i.pengeluaran) || 0), 0);
  const bkuFinalSaldo = bku.length > 0 ? (bku[bku.length - 1].saldo || (bkuTotalPenerimaan - bkuTotalPengeluaran)) : 0;

  const bkpTotalDebet = bkp.reduce((sum, i) => sum + (Number(i.debet) || 0), 0);
  const bkpTotalKredit = bkp.reduce((sum, i) => sum + (Number(i.kredit) || 0), 0);
  const bkpFinalSaldo = bkp.length > 0 ? (bkp[bkp.length - 1].saldo || (bkpTotalDebet - bkpTotalKredit)) : 0;

  const budgetTotalPagu = budget.reduce((sum, i) => sum + (Number(i.jumlah) || 0), 0);
  const puniaTotal = punia.reduce((sum, i) => sum + (Number(i.total || i.jumlah) || 0), 0);
  const urunanTotal = urunan.reduce((sum, i) => sum + (Number(i.total || i.jumlah) || 0), 0);

  const juTotalDebet = ju.reduce((sum, i) => sum + (Number(i.debet) || 0), 0);
  const juTotalKredit = ju.reduce((sum, i) => sum + (Number(i.kredit) || 0), 0);

  const pepesonTotal = pepeson.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  const totalRecords = bku.length + bkp.length + budget.length + punia.length + urunan.length + ju.length + pepeson.length;

  // --- SHEET 0: COVER & REKAPITULASI 7 MODUL ---
  const coverRows: any[][] = [
    ['LAPORAN REKAPITULASI KEUANGAN 7 MODUL PEMBUKUAN'],
    [villageName.toUpperCase()],
    [`Periode Pelaporan: ${periodLabel}`],
    [`Tanggal Unduh Data: ${currentDateStr}`],
    [`Prajuru Desa: Ketua / Keliang (${data.villageProfile?.namaKetua || '-'}) | Bendahara / Juru Raksa (${data.villageProfile?.namaBendahara || '-'})`],
    [],
    ['REKAPITULASI RINGKASAN PER MODUL PEMBUKUAN'],
    [
      'No',
      'Nama Modul Pembukuan',
      'Jumlah Data (Baris)',
      'Total Penerimaan / Debet (Rp)',
      'Total Pengeluaran / Kredit (Rp)',
      'Saldo Akhir / Total Pagu (Rp)',
      'Status / Keterangan'
    ],
    [
      1,
      '1. Buku Kas Umum (BKU)',
      bku.length,
      bkuTotalPenerimaan,
      bkuTotalPengeluaran,
      bkuFinalSaldo,
      'Kas Utama Desa Adat'
    ],
    [
      2,
      '2. Buku Kas Pembantu (BKP)',
      bkp.length,
      bkpTotalDebet,
      bkpTotalKredit,
      bkpFinalSaldo,
      'Kas Pembantu Belanja Operasional'
    ],
    [
      3,
      '3. Anggaran APBDes',
      budget.length,
      0,
      0,
      budgetTotalPagu,
      'Pagu Anggaran Pendapatan & Belanja Desa'
    ],
    [
      4,
      '4. Dana Punia',
      punia.length,
      puniaTotal,
      0,
      puniaTotal,
      'Donasi & Punia (Tunai, Transfer, Barang, Sasah)'
    ],
    [
      5,
      '5. Urunan Krama',
      urunan.length,
      urunanTotal,
      0,
      urunanTotal,
      'Iuran Wajib Krama & Banjar Adat'
    ],
    [
      6,
      '6. Buku Jurnal Umum',
      ju.length,
      juTotalDebet,
      juTotalKredit,
      juTotalDebet - juTotalKredit,
      juTotalDebet === juTotalKredit ? 'Balance (Seimbang)' : 'Selisih Transaksi'
    ],
    [
      7,
      '7. Pepeson Desa',
      pepeson.length,
      0,
      0,
      pepesonTotal,
      'Distribusi Logistik Upakara & Insentif'
    ],
    [],
    [
      'TOTAL KONSOLIDASI',
      'Seluruh Modul Pembukuan',
      totalRecords,
      bkuTotalPenerimaan + puniaTotal + urunanTotal,
      bkuTotalPengeluaran + bkpTotalKredit,
      bkuFinalSaldo,
      'Data Terverifikasi Sistem'
    ]
  ];

  const wsCover = XLSX.utils.aoa_to_sheet(coverRows);
  wsCover['!cols'] = autoFitCols(coverRows);
  XLSX.utils.book_append_sheet(wb, wsCover, '0. Ringkasan 7 Modul');

  // --- SHEET 1: BUKU KAS UMUM (BKU) ---
  const bkuRows: any[][] = [
    ['BUKU KAS UMUM (BKU)'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Tanggal', 'No Bukti', 'Kode Rekening', 'Uraian Transaksi', 'Kategori', 'Penerimaan (Rp)', 'Pengeluaran (Rp)', 'Saldo Kas (Rp)']
  ];

  bku.forEach((item, idx) => {
    bkuRows.push([
      idx + 1,
      item.tanggal || '',
      item.noBukti || item.bukti || '',
      item.kode || (item as any).kodeRekening || '',
      item.uraian || '',
      item.kategori || '',
      Number(item.penerimaan) || 0,
      Number(item.pengeluaran) || 0,
      Number(item.saldo) || 0
    ]);
  });

  bkuRows.push([
    'TOTAL',
    '',
    '',
    '',
    'TOTAL BUKU KAS UMUM',
    '',
    bkuTotalPenerimaan,
    bkuTotalPengeluaran,
    bkuFinalSaldo
  ]);

  const wsBku = XLSX.utils.aoa_to_sheet(bkuRows);
  wsBku['!cols'] = autoFitCols(bkuRows);
  XLSX.utils.book_append_sheet(wb, wsBku, '1. BKU');

  // --- SHEET 2: BUKU KAS PEMBANTU (BKP) ---
  const bkpRows: any[][] = [
    ['BUKU KAS PEMBANTU (BKP)'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Tanggal', 'No Bukti Nota', 'Uraian Belanja', 'Kategori Belanja', 'Debet (Rp)', 'Kredit / Belanja (Rp)', 'Saldo Kas (Rp)']
  ];

  bkp.forEach((item, idx) => {
    bkpRows.push([
      idx + 1,
      item.tanggal || '',
      item.bukti || '',
      item.uraian || '',
      item.kategori || '',
      Number(item.debet) || 0,
      Number(item.kredit) || 0,
      Number(item.saldo) || 0
    ]);
  });

  bkpRows.push([
    'TOTAL',
    '',
    '',
    'TOTAL BUKU KAS PEMBANTU',
    '',
    bkpTotalDebet,
    bkpTotalKredit,
    bkpFinalSaldo
  ]);

  const wsBkp = XLSX.utils.aoa_to_sheet(bkpRows);
  wsBkp['!cols'] = autoFitCols(bkpRows);
  XLSX.utils.book_append_sheet(wb, wsBkp, '2. BKP');

  // --- SHEET 3: ANGGARAN APBDES ---
  const budgetRows: any[][] = [
    ['RENCANA ANGGARAN PENDAPATAN & BELANJA DESA (APBDes)'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Tahun', 'Kode Rekening', 'Uraian Anggaran', 'Bidang / Klasifikasi', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah Pagu (Rp)', 'Keterangan']
  ];

  budget.forEach((item, idx) => {
    budgetRows.push([
      idx + 1,
      item.tahun || yearFilter || '2026',
      item.kode || (item as any).kodeRekening || '',
      item.uraian || '',
      item.type || (item as any).kategori || '',
      item.volume !== undefined ? Number(item.volume) : 1,
      item.satuan || 'Kegiatan',
      Number(item.hargaSatuan) || 0,
      Number(item.jumlah) || 0,
      item.keterangan || ''
    ]);
  });

  budgetRows.push([
    'TOTAL',
    '',
    '',
    'TOTAL ANGGARAN APBDES',
    '',
    '',
    '',
    '',
    budgetTotalPagu,
    ''
  ]);

  const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
  wsBudget['!cols'] = autoFitCols(budgetRows);
  XLSX.utils.book_append_sheet(wb, wsBudget, '3. Anggaran APBDes');

  // --- SHEET 4: DANA PUNIA ---
  const puniaRows: any[][] = [
    ['BUKU CATATAN PENERIMAAN DANA PUNIA'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Tanggal', 'Nama Donatur', 'Jenis Punia', 'Alamat / Banjar', 'Uraian Donasi', 'Qty', 'Satuan', 'Nominal / Nilai (Rp)', 'Total (Rp)']
  ];

  punia.forEach((item, idx) => {
    const pType = item.type === 'transfer' ? 'Transfer Bank' : item.type === 'tunai' || item.type === 'uang' ? 'Tunai' : item.type === 'barang' ? 'Barang' : item.type === 'sasah-abu' ? 'Sasah-Abu' : (item.type || 'Lainnya');
    puniaRows.push([
      idx + 1,
      item.date || (item as any).tanggal || '',
      item.nama || '',
      pType,
      item.alamat || '-',
      item.uraian || '',
      Number(item.qty) || 1,
      item.satuan || 'Paket',
      Number(item.hargaSatuan || item.jumlah) || 0,
      Number(item.total || item.jumlah) || 0
    ]);
  });

  puniaRows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    'TOTAL PENERIMAAN DANA PUNIA',
    '',
    '',
    '',
    puniaTotal
  ]);

  const wsPunia = XLSX.utils.aoa_to_sheet(puniaRows);
  wsPunia['!cols'] = autoFitCols(puniaRows);
  XLSX.utils.book_append_sheet(wb, wsPunia, '4. Dana Punia');

  // --- SHEET 5: URUNAN KRAMA ---
  const urunanRows: any[][] = [
    ['BUKU PENERIMAAN URUNAN KRAMA DESA ADAT'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Tanggal', 'Nama Krama / Banjar', 'Uraian Iuran / Piodalan', 'Nominal Iuran (Rp)', 'Total Disetor (Rp)']
  ];

  urunan.forEach((item, idx) => {
    urunanRows.push([
      idx + 1,
      item.date || (item as any).tanggal || '',
      item.nama || (item as any).krama || '',
      item.uraian || '',
      Number(item.jumlah || (item as any).iuran) || 0,
      Number(item.total || item.jumlah) || 0
    ]);
  });

  urunanRows.push([
    'TOTAL',
    '',
    '',
    'TOTAL PENERIMAAN URUNAN KRAMA',
    '',
    urunanTotal
  ]);

  const wsUrunan = XLSX.utils.aoa_to_sheet(urunanRows);
  wsUrunan['!cols'] = autoFitCols(urunanRows);
  XLSX.utils.book_append_sheet(wb, wsUrunan, '5. Urunan Krama');

  // --- SHEET 6: BUKU JURNAL UMUM ---
  const juRows: any[][] = [
    ['BUKU JURNAL UMUM (DOUBLE ENTRY)'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Tanggal Jurnal', 'Row ID', 'No Bukti Transaksi', 'Kode Rekening', 'Uraian Akun', 'Debet (Rp)', 'Kredit (Rp)', 'Posisi Akun', 'Program / Pos']
  ];

  ju.forEach((item, idx) => {
    juRows.push([
      idx + 1,
      item.date || (item as any).tanggal || '',
      item.rowId || '',
      item.idTransaksi || '-',
      item.kodeRekening || '',
      item.uraian || '',
      Number(item.debet) || 0,
      Number(item.kredit) || 0,
      item.rowType || (Number(item.debet) > 0 ? 'debet' : 'kredit'),
      item.program || '-'
    ]);
  });

  juRows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    'TOTAL JURNAL UMUM',
    juTotalDebet,
    juTotalKredit,
    juTotalDebet === juTotalKredit ? 'BALANCE (SEIMBANG)' : 'SELISIH',
    ''
  ]);

  const wsJu = XLSX.utils.aoa_to_sheet(juRows);
  wsJu['!cols'] = autoFitCols(juRows);
  XLSX.utils.book_append_sheet(wb, wsJu, '6. Jurnal Umum');

  // --- SHEET 7: PEPESON DESA ---
  const pepesonRows: any[][] = [
    ['BUKU DISTRIBUSI PEPESON DESA ADAT'],
    [villageName.toUpperCase()],
    [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
    [],
    ['No', 'Nama Pos / Barang Pepeson', 'Krama Penerima / Sasaran', 'Volume / Qty', 'Satuan', 'Jumlah Krama', 'Total Nilai (Rp)']
  ];

  pepeson.forEach((item, idx) => {
    pepesonRows.push([
      idx + 1,
      item.nama || (item as any).namaPos || '',
      item.krama || (item as any).kramaPenerima || '',
      Number(item.qty) || 0,
      item.satuan || 'Orang',
      Number(item.jumlahKrama) || 0,
      Number(item.total) || 0
    ]);
  });

  pepesonRows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    'TOTAL PEPESON DESA',
    pepesonTotal
  ]);

  const wsPepeson = XLSX.utils.aoa_to_sheet(pepesonRows);
  wsPepeson['!cols'] = autoFitCols(pepesonRows);
  XLSX.utils.book_append_sheet(wb, wsPepeson, '7. Pepeson Desa');

  // DOWNLOAD THE WORKBOOK
  const cleanVillage = villageName.replace(/\s+/g, '_');
  const yearSuffix = yearFilter === 'all' ? 'SEMUA_TAHUN' : `TA_${yearFilter}`;
  const dateSuffix = new Date().toISOString().split('T')[0];
  const filename = `LAPORAN_7_MODUL_${cleanVillage}_${yearSuffix}_${dateSuffix}.xlsx`;

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { success: true, filename, totalRecords };
};

/**
 * Generates and downloads a single module as a modern .xlsx file.
 */
export const downloadSingleModuleXLSX = (
  type: 'bku' | 'bkp' | 'anggaran' | 'dana_punia' | 'urunan' | 'jurnal' | 'pepeson',
  data: Export7ModulesData,
  options: ExportOptions = {}
): { success: boolean; filename: string; count: number } => {
  const { yearFilter = 'all', villageName = 'Desa Adat Basangalas' } = options;
  const periodLabel = yearFilter === 'all' ? 'Semua Tahun (Konsolidasi)' : `Tahun Anggaran ${yearFilter}`;
  const currentDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const wb = XLSX.utils.book_new();
  const cleanVillage = villageName.replace(/\s+/g, '_');
  let filename = '';
  let count = 0;

  if (type === 'bku') {
    const items = data.bkuData.filter(i => filterByYear(i.tanggal, yearFilter));
    count = items.length;
    const totPen = items.reduce((s, i) => s + (Number(i.penerimaan) || 0), 0);
    const totPeng = items.reduce((s, i) => s + (Number(i.pengeluaran) || 0), 0);
    const salAkhir = items.length > 0 ? (items[items.length - 1].saldo || (totPen - totPeng)) : 0;

    const rows: any[][] = [
      ['BUKU KAS UMUM (BKU)'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Tanggal', 'No Bukti', 'Kode Rekening', 'Uraian Transaksi', 'Kategori', 'Penerimaan (Rp)', 'Pengeluaran (Rp)', 'Saldo Kas (Rp)']
    ];

    items.forEach((i, idx) => {
      rows.push([
        idx + 1,
        i.tanggal || '',
        i.noBukti || i.bukti || '',
        i.kode || (i as any).kodeRekening || '',
        i.uraian || '',
        i.kategori || '',
        Number(i.penerimaan) || 0,
        Number(i.pengeluaran) || 0,
        Number(i.saldo) || 0
      ]);
    });

    rows.push(['TOTAL', '', '', '', 'TOTAL BUKU KAS UMUM', '', totPen, totPeng, salAkhir]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'BKU');
    filename = `BKU_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  } else if (type === 'bkp') {
    const items = data.bkpData.filter(i => filterByYear(i.tanggal, yearFilter));
    count = items.length;
    const totDeb = items.reduce((s, i) => s + (Number(i.debet) || 0), 0);
    const totKre = items.reduce((s, i) => s + (Number(i.kredit) || 0), 0);
    const salAkhir = items.length > 0 ? (items[items.length - 1].saldo || (totDeb - totKre)) : 0;

    const rows: any[][] = [
      ['BUKU KAS PEMBANTU (BKP)'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Tanggal', 'No Bukti Nota', 'Uraian Belanja', 'Kategori Belanja', 'Debet (Rp)', 'Kredit / Belanja (Rp)', 'Saldo Kas (Rp)']
    ];

    items.forEach((i, idx) => {
      rows.push([
        idx + 1,
        i.tanggal || '',
        i.bukti || '',
        i.uraian || '',
        i.kategori || '',
        Number(i.debet) || 0,
        Number(i.kredit) || 0,
        Number(i.saldo) || 0
      ]);
    });

    rows.push(['TOTAL', '', '', 'TOTAL BUKU KAS PEMBANTU', '', totDeb, totKre, salAkhir]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'BKP');
    filename = `BKP_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  } else if (type === 'anggaran') {
    const items = data.budgetItems.filter(i => {
      if (!yearFilter || yearFilter === 'all') return true;
      return i.tahun ? String(i.tahun) === yearFilter : true;
    });
    count = items.length;
    const totPagu = items.reduce((s, i) => s + (Number(i.jumlah) || 0), 0);

    const rows: any[][] = [
      ['RENCANA ANGGARAN PENDAPATAN & BELANJA DESA (APBDes)'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Tahun', 'Kode Rekening', 'Uraian Anggaran', 'Bidang / Klasifikasi', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah Pagu (Rp)', 'Keterangan']
    ];

    items.forEach((i, idx) => {
      rows.push([
        idx + 1,
        i.tahun || yearFilter || '2026',
        i.kode || (i as any).kodeRekening || '',
        i.uraian || '',
        i.type || (i as any).kategori || '',
        i.volume !== undefined ? Number(i.volume) : 1,
        i.satuan || 'Kegiatan',
        Number(i.hargaSatuan) || 0,
        Number(i.jumlah) || 0,
        i.keterangan || ''
      ]);
    });

    rows.push(['TOTAL', '', '', 'TOTAL ANGGARAN APBDES', '', '', '', '', totPagu, '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Anggaran');
    filename = `ANGGARAN_APBDES_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  } else if (type === 'dana_punia') {
    const items = data.danaPuniaItems.filter(i => filterByYear(i.date || (i as any).tanggal, yearFilter));
    count = items.length;
    const totPunia = items.reduce((s, i) => s + (Number(i.total || i.jumlah) || 0), 0);

    const rows: any[][] = [
      ['BUKU CATATAN PENERIMAAN DANA PUNIA'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Tanggal', 'Nama Donatur', 'Jenis Punia', 'Alamat / Banjar', 'Uraian Donasi', 'Qty', 'Satuan', 'Nominal (Rp)', 'Total (Rp)']
    ];

    items.forEach((i, idx) => {
      const pType = i.type === 'transfer' ? 'Transfer Bank' : i.type === 'tunai' || i.type === 'uang' ? 'Tunai' : i.type === 'barang' ? 'Barang' : i.type === 'sasah-abu' ? 'Sasah-Abu' : (i.type || 'Lainnya');
      rows.push([
        idx + 1,
        i.date || (i as any).tanggal || '',
        i.nama || '',
        pType,
        i.alamat || '-',
        i.uraian || '',
        Number(i.qty) || 1,
        i.satuan || 'Paket',
        Number(i.hargaSatuan || i.jumlah) || 0,
        Number(i.total || i.jumlah) || 0
      ]);
    });

    rows.push(['TOTAL', '', '', '', '', 'TOTAL PENERIMAAN DANA PUNIA', '', '', '', totPunia]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Dana Punia');
    filename = `DANA_PUNIA_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  } else if (type === 'urunan') {
    const items = data.urunanItems.filter(i => filterByYear(i.date || (i as any).tanggal, yearFilter));
    count = items.length;
    const totUrunan = items.reduce((s, i) => s + (Number(i.total || i.jumlah) || 0), 0);

    const rows: any[][] = [
      ['BUKU PENERIMAAN URUNAN KRAMA DESA ADAT'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Tanggal', 'Nama Krama / Banjar', 'Uraian Iuran / Piodalan', 'Nominal Iuran (Rp)', 'Total Disetor (Rp)']
    ];

    items.forEach((i, idx) => {
      rows.push([
        idx + 1,
        i.date || (i as any).tanggal || '',
        i.nama || (i as any).krama || '',
        i.uraian || '',
        Number(i.jumlah || (i as any).iuran) || 0,
        Number(i.total || i.jumlah) || 0
      ]);
    });

    rows.push(['TOTAL', '', '', 'TOTAL PENERIMAAN URUNAN KRAMA', '', totUrunan]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Urunan Krama');
    filename = `URUNAN_KRAMA_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  } else if (type === 'jurnal') {
    const items = data.juData.filter(i => filterByYear(i.date || (i as any).tanggal, yearFilter));
    count = items.length;
    const totDeb = items.reduce((s, i) => s + (Number(i.debet) || 0), 0);
    const totKre = items.reduce((s, i) => s + (Number(i.kredit) || 0), 0);

    const rows: any[][] = [
      ['BUKU JURNAL UMUM (DOUBLE ENTRY)'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Tanggal Jurnal', 'Row ID', 'No Bukti Transaksi', 'Kode Rekening', 'Uraian Akun', 'Debet (Rp)', 'Kredit (Rp)', 'Posisi Akun', 'Program / Pos']
    ];

    items.forEach((i, idx) => {
      rows.push([
        idx + 1,
        i.date || (i as any).tanggal || '',
        i.rowId || '',
        i.idTransaksi || '-',
        i.kodeRekening || '',
        i.uraian || '',
        Number(i.debet) || 0,
        Number(i.kredit) || 0,
        i.rowType || (Number(i.debet) > 0 ? 'debet' : 'kredit'),
        i.program || '-'
      ]);
    });

    rows.push(['TOTAL', '', '', '', '', 'TOTAL JURNAL UMUM', totDeb, totKre, totDeb === totKre ? 'BALANCE' : 'SELISIH', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Umum');
    filename = `JURNAL_UMUM_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  } else if (type === 'pepeson') {
    const items = data.pepesonItems;
    count = items.length;
    const totPep = items.reduce((s, i) => s + (Number(i.total) || 0), 0);

    const rows: any[][] = [
      ['BUKU DISTRIBUSI PEPESON DESA ADAT'],
      [villageName.toUpperCase()],
      [`Periode: ${periodLabel} | Dicetak: ${currentDateStr}`],
      [],
      ['No', 'Nama Pos / Barang Pepeson', 'Krama Penerima / Sasaran', 'Volume / Qty', 'Satuan', 'Jumlah Krama', 'Total Nilai (Rp)']
    ];

    items.forEach((i, idx) => {
      rows.push([
        idx + 1,
        i.nama || (i as any).namaPos || '',
        i.krama || (i as any).kramaPenerima || '',
        Number(i.qty) || 0,
        i.satuan || 'Orang',
        Number(i.jumlahKrama) || 0,
        Number(i.total) || 0
      ]);
    });

    rows.push(['TOTAL', '', '', '', '', 'TOTAL PEPESON DESA', totPep]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = autoFitCols(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Pepeson Desa');
    filename = `PEPESON_DESA_${cleanVillage}_${yearFilter === 'all' ? 'LENGKAP' : yearFilter}.xlsx`;
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { success: true, filename, count };
};

/**
 * Generates and downloads an official Excel template (.xlsx) for import.
 */
export const downloadModuleTemplateXLSX = (
  type: 'bku' | 'bkp' | 'anggaran' | 'dana_punia' | 'urunan' | 'jurnal' | 'pepeson'
): void => {
  const wb = XLSX.utils.book_new();
  let filename = '';
  let rows: any[][] = [];

  if (type === 'bku') {
    filename = 'TEMPLATE_IMPOR_BKU.xlsx';
    rows = [
      ['Nomor', 'Tanggal', 'Kode Rekening', 'Uraian Transaksi', 'Kategori', 'Penerimaan', 'Pengeluaran', 'Saldo Kas'],
      [1, '2026-07-01', '4.1.1.01', 'Penerimaan Dana Punia Karya Piodalan', 'Pendapatan', 15000000, 0, 15000000],
      [2, '2026-07-05', '5.1.1.01', 'Belanja Pembelian Janur dan Upakara', 'Belanja Rutin', 0, 3500000, 11500000]
    ];
  } else if (type === 'bkp') {
    filename = 'TEMPLATE_IMPOR_BKP.xlsx';
    rows = [
      ['Nomor', 'Tanggal', 'No Bukti Nota', 'Uraian Belanja', 'Kategori', 'Debet', 'Kredit / Belanja', 'Saldo'],
      [1, '2026-07-05', 'NOTA-001', 'Pembelian Wastra dan Perlengkapan Pura', 'Operasional', 0, 2500000, 2500000],
      [2, '2026-07-08', 'NOTA-002', 'Konsumsi Gotong Royong Krama Banjar', 'Kegiatan Pawongan', 0, 1200000, 3700000]
    ];
  } else if (type === 'anggaran') {
    filename = 'TEMPLATE_IMPOR_ANGGARAN_APBDES.xlsx';
    rows = [
      ['Kode Rekening', 'Uraian Anggaran', 'Bidang / Kategori', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah Pagu', 'Keterangan'],
      ['5.1.2.01', 'Pemeliharaan Pura Penataran Agung', 'belanja-program-parhyangan', 1, 'Paket', 25000000, 25000000, 'Pembangunan Pagar & Kori'],
      ['5.2.1.01', 'Insentif Pemangku & Prajuru Desa', 'belanja-rutin-insentif', 12, 'Bulan', 1500000, 18000000, 'Operasional Bulanan']
    ];
  } else if (type === 'dana_punia') {
    filename = 'TEMPLATE_IMPOR_DANA_PUNIA.xlsx';
    rows = [
      ['Tanggal', 'Nama Donatur', 'Jenis Punia', 'Alamat', 'Uraian', 'Qty', 'Satuan', 'Nominal', 'Total'],
      ['2026-07-02', 'I Wayan Sudarma', 'Transfer', 'Br. Kangin', 'Punia Piodalan Agung', 1, 'Transfer', 1000000, 1000000],
      ['2026-07-03', 'Ni Ketut Artini', 'Barang', 'Br. Kauh', 'Punia Beras & Minyak Kelapa', 5, 'Karung', 350000, 1750000]
    ];
  } else if (type === 'urunan') {
    filename = 'TEMPLATE_IMPOR_URUNAN_KRAMA.xlsx';
    rows = [
      ['Tanggal', 'Nama Krama / Banjar', 'Uraian', 'Nominal', 'Total'],
      ['2026-07-01', 'Banjar Adat Kaja', 'Urunan Gotong Royong Karya Pura', 150000, 15000000],
      ['2026-07-01', 'Banjar Adat Kelod', 'Urunan Wajib Krama Mipil', 150000, 13500000]
    ];
  } else if (type === 'jurnal') {
    filename = 'TEMPLATE_IMPOR_JURNAL_UMUM.xlsx';
    rows = [
      ['Row ID', 'Tanggal Jurnal', 'Kode Rekening', 'Uraian Akun', 'Debet', 'Kredit', 'Tipe Baris'],
      ['ju-001-d', '2026-07-10', '1.1.1.01', 'Penerimaan Kas Dana Punia Pura', 5000000, 0, 'debet'],
      ['ju-001-k', '2026-07-10', '4.1.1.01', 'Pendapatan Dana Punia Pura', 0, 5000000, 'kredit']
    ];
  } else if (type === 'pepeson') {
    filename = 'TEMPLATE_IMPOR_PEPESON_DESA.xlsx';
    rows = [
      ['Nama Pos / Barang', 'Krama Penerima', 'Qty', 'Satuan', 'Jumlah Krama', 'Total'],
      ['Insentif Kerja Bakti Banjar', 'Krama Banjar Kaja', 50, 'Orang', 50, 2500000],
      ['Beras & Dupa Upacara', 'Prajuru & Pemangku', 12, 'Paket', 12, 1800000]
    ];
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoFitCols(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Parses an Excel (.xlsx, .xls) file into headers and data rows.
 */
export const parseExcelFile = (
  file: File
): Promise<{ headers: string[]; rows: string[][] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Lembar kerja Excel kosong atau tidak terbaca.');
        }

        let targetSheet: XLSX.WorkSheet | null = null;
        for (const sheetName of workbook.SheetNames) {
          const s = workbook.Sheets[sheetName];
          if (s && s['!ref']) {
            targetSheet = s;
            break;
          }
        }

        if (!targetSheet) {
          throw new Error('Tidak ada data dalam lembar kerja Excel.');
        }

        const rawData: any[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1 });
        const nonEmpty = rawData.filter(
          row => Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
        );

        if (nonEmpty.length === 0) {
          throw new Error('Berkas Excel tidak memiliki baris data.');
        }

        // Smart detect header row (skip top titles like "BUKU KAS UMUM", etc.)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(nonEmpty.length, 6); i++) {
          const rowText = nonEmpty[i].map(c => String(c || '').toLowerCase()).join(' ');
          if (
            rowText.includes('tanggal') ||
            rowText.includes('kode') ||
            rowText.includes('uraian') ||
            rowText.includes('nama') ||
            rowText.includes('debet') ||
            rowText.includes('kredit') ||
            rowText.includes('nomor') ||
            rowText.includes('pagu') ||
            rowText.includes('pos')
          ) {
            headerRowIdx = i;
            break;
          }
        }

        const headers = nonEmpty[headerRowIdx].map(h => String(h || '').trim());
        const rows = nonEmpty.slice(headerRowIdx + 1).map(row => {
          return headers.map((_, colIdx) => {
            const val = row[colIdx];
            return val !== undefined && val !== null ? String(val).trim() : '';
          });
        });

        resolve({ headers, rows });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

