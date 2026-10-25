import type { JuDisplayRow, BudgetItem } from '../types';
import { REFERENSI_REKENING } from '../constants';
import { formatDate } from './formatter';

export interface OperationalRow {
  kode: string;
  uraian: string;
  anggaran: number;
  realisasi: number;
  selisih: number;
  persentase: number;
}

export interface LraGroupData {
  label: string;
  rows: OperationalRow[];
  totalAnggaran: number;
  totalRealisasi: number;
  totalSelisih: number;
}

export interface LraReportDataProps {
  silpaTahunLalu: number;
  silpaLabel: string;
  sumberdana: LraGroupData;
  pendapatan: LraGroupData;
  pendapatanadat: LraGroupData;
  pendapatanhibah: LraGroupData;
  pendapatanhibahprovinsi: LraGroupData;
  pendapatanhibahkabupaten: LraGroupData;
  parhyanganadat: LraGroupData;
  pawonganadat: LraGroupData;
  bebanadat: LraGroupData;
  insentif: LraGroupData;
  insentifkabupaten: LraGroupData;
  operasional: LraGroupData;
  perjalananDinas: LraGroupData;
  beban: LraGroupData;
  parhyangan: LraGroupData;
  parhyangankabupaten: LraGroupData;
  pawongan: LraGroupData;
  palemahan: LraGroupData;
  belanjaLainnya: LraGroupData;
  totalBelanjaAnggaran: number;
  totalBelanjaRealisasi: number;
  surplusDefisit: {
    anggaran: number;
    realisasi: number;
  };
}

export interface LraFilterParams {
  selectedYear?: string;
  selectedMonth?: string;
  startDate?: string;
  endDate?: string;
}

export const MONTHS_LIST = [
  { val: '01', label: 'Januari' },
  { val: '02', label: 'Februari' },
  { val: '03', label: 'Maret' },
  { val: '04', label: 'April' },
  { val: '05', label: 'Mei' },
  { val: '06', label: 'Juni' },
  { val: '07', label: 'Juli' },
  { val: '08', label: 'Agustus' },
  { val: '09', label: 'September' },
  { val: '10', label: 'Oktober' },
  { val: '11', label: 'November' },
  { val: '12', label: 'Desember' }
];

export const getSilpaLabel = (params: LraFilterParams): string => {
  const { startDate, selectedYear, selectedMonth } = params;

  let yearRef = selectedYear;
  if (!yearRef && startDate) {
    yearRef = startDate.split('-')[0];
  }

  // 1. Jika ada startDate kustom
  if (startDate) {
    const parts = startDate.split('-');
    if (parts.length === 3) {
      const sY = parts[0];
      const sM = parts[1];
      const sD = parts[2];

      if (sD === '01') {
        if (sM === '01') {
          return `Silpa Tahun ${Number(sY) - 1}`;
        }
        const prevMonthIdx = parseInt(sM, 10) - 2;
        const prevMonthName = MONTHS_LIST[prevMonthIdx]?.label || `Bulan ${parseInt(sM, 10) - 1}`;
        return `Saldo Bulan ${prevMonthName} ${sY} (Silpa Bulan Lalu)`;
      } else {
        return `Saldo Awal Kas per ${formatDate(startDate)}`;
      }
    }
    return `Saldo Awal Kas per ${formatDate(startDate)}`;
  }

  // 2. Jika filter Bulan dipilih
  if (selectedMonth) {
    if (selectedMonth === '01') {
      return yearRef ? `Silpa Tahun ${Number(yearRef) - 1}` : 'Silpa Tahun Lalu';
    }
    const monthNum = parseInt(selectedMonth, 10);
    const prevMonthIdx = monthNum - 2;
    const prevMonthName = MONTHS_LIST[prevMonthIdx]?.label || `Bulan ${monthNum - 1}`;
    return yearRef 
      ? `Saldo Bulan ${prevMonthName} ${yearRef} (Silpa Bulan Lalu)`
      : `Saldo Bulan ${prevMonthName} (Silpa Bulan Lalu)`;
  }

  // 3. Jika hanya Tahun dipilih (seluruh tahun)
  if (yearRef) {
    return `Silpa Tahun ${Number(yearRef) - 1}`;
  }

  return 'Silpa Tahun Sebelumnya';
};

export const getLraPeriodLabel = (params: LraFilterParams): string => {
  const { startDate, endDate, selectedYear, selectedMonth } = params;

  if (startDate && endDate) {
    return `${formatDate(startDate)} s.d. ${formatDate(endDate)}`;
  }
  if (startDate) {
    return `Mulai ${formatDate(startDate)}`;
  }
  if (endDate) {
    return `Sampai ${formatDate(endDate)}`;
  }
  if (selectedMonth && selectedYear) {
    const m = MONTHS_LIST.find(i => i.val === selectedMonth)?.label;
    return `${m} ${selectedYear}`;
  }
  if (selectedYear) {
    return `Tahun ${selectedYear}`;
  }
  return 'Seluruh Periode';
};

export const calculateLraReportData = (
  entries: JuDisplayRow[],
  budgetItems: BudgetItem[],
  params: LraFilterParams
): { reportData: LraReportDataProps; periodLabel: string } => {
  const { startDate, endDate, selectedYear, selectedMonth } = params;
  const realizationMap: Record<string, number> = {};
  const trackedCodes = new Set<string>();

  // 1. Hitung Saldo Pindahan (SILPA)
  let silpaTahunLalu = 0;
  let cutOffDate: string | null = null;

  if (startDate) {
    cutOffDate = startDate;
  } else if (selectedYear && selectedMonth) {
    cutOffDate = `${selectedYear}-${selectedMonth}-01`;
  } else if (selectedYear) {
    cutOffDate = `${selectedYear}-01-01`;
  }

  if (cutOffDate) {
    entries.forEach(e => {
      if (e.date && e.date < cutOffDate) {
        const code = (e.kodeRekening || '').trim();
        const debetVal = Number(e.debet) || 0;
        const kreditVal = Number(e.kredit) || 0;
        if (code.startsWith('4')) silpaTahunLalu += (kreditVal - debetVal);
        if (code.startsWith('7')) silpaTahunLalu += (kreditVal - debetVal);
        if (code.startsWith('6')) silpaTahunLalu += (kreditVal - debetVal);
        if (code.startsWith('5')) silpaTahunLalu -= (debetVal - kreditVal);
      }
    });
  }

  // 2. Filter Entries Berdasarkan Parameter
  const filteredEntries = entries.filter(e => {
    if (!e.date) return false;

    if (startDate || endDate) {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    }

    const [y, m] = e.date.split('-');
    const matchYear = selectedYear ? y === selectedYear : true;
    const matchMonth = selectedMonth ? m === selectedMonth : true;
    return matchYear && matchMonth;
  });

  filteredEntries.forEach(e => {
    const code = (e.kodeRekening || '').trim();
    const debetVal = Number(e.debet) || 0;
    const kreditVal = Number(e.kredit) || 0;
    if (code.startsWith('4')) realizationMap[code] = (realizationMap[code] || 0) + (kreditVal - debetVal);
    if (code.startsWith('5')) realizationMap[code] = (realizationMap[code] || 0) + (debetVal - kreditVal);
    if (code.startsWith('7')) realizationMap[code] = (realizationMap[code] || 0) + (kreditVal - debetVal);
    if (code.startsWith('6')) realizationMap[code] = (realizationMap[code] || 0) + (kreditVal - debetVal);
  });

  // Tentukan tahun acuan anggaran
  let budgetYearReference: string | undefined = selectedYear;
  if (!budgetYearReference && startDate) {
    budgetYearReference = startDate.split('-')[0];
  } else if (!budgetYearReference && endDate) {
    budgetYearReference = endDate.split('-')[0];
  }

  const getGroupData = (prefix: string | string[], label: string, shouldTrack = true): LraGroupData => {
    const prefixes = Array.isArray(prefix) ? prefix : [prefix];
    const isRevenueType = prefixes.some(p => p.startsWith('4') || p.startsWith('7') || p.startsWith('6'));
    const accounts = REFERENSI_REKENING.filter(r => prefixes.some(p => r.code.startsWith(p)));
    const rows: OperationalRow[] = accounts.map(acc => {
      if (shouldTrack) {
        trackedCodes.add(acc.code);
      }
      const realisasi = realizationMap[acc.code] || 0;
      const matchingBudgetItems = budgetItems.filter(b => 
        b.kode === acc.code && (budgetYearReference ? (!b.tahun || b.tahun === budgetYearReference) : true)
      );
      const anggaran = matchingBudgetItems.reduce((sum, b) => sum + (Number(b.jumlah) || 0), 0);
      
      // PSAP 02 Standard Accounting Variance:
      // - Pendapatan & Sumber Dana (Akun 4 & 7): Realisasi - Anggaran (Lebih target = +, Kurang target = -)
      // - Belanja (Akun 5): Anggaran - Realisasi (Sisa aman = +, Overbudget = -)
      const selisih = isRevenueType ? (realisasi - anggaran) : (anggaran - realisasi);
      return {
        kode: acc.code,
        uraian: acc.name,
        anggaran,
        realisasi,
        selisih,
        persentase: anggaran > 0 ? (realisasi / anggaran) * 100 : (realisasi > 0 ? 100 : 0)
      };
    }).filter(row => row.realisasi !== 0 || row.anggaran !== 0);

    const totalAnggaran = rows.reduce((s, r) => s + r.anggaran, 0);
    const totalRealisasi = rows.reduce((s, r) => s + r.realisasi, 0);
    const totalSelisih = isRevenueType ? (totalRealisasi - totalAnggaran) : (totalAnggaran - totalRealisasi);

    return { label, rows, totalAnggaran, totalRealisasi, totalSelisih };
  };

  const createEmptyGroup = (label: string): LraGroupData => ({
    label,
    rows: [],
    totalAnggaran: 0,
    totalRealisasi: 0,
    totalSelisih: 0
  });

  // Sumber Dana (Akun 7) dan SiLPA (Akun 6.1.1.01) sesuai REFERENSI_REKENING constants.tsx
  const sumberdana = getGroupData(['7', '6'], 'I. SUMBER DANA & SILPA', true);
  
  // SINKRONISASI & LABELING KONSISTEN:
  // Tentukan label saldo awal/SiLPA berdasarkan periode aktif (misal: "Saldo Bulan Januari 2026 (Silpa Bulan Lalu)")
  const silpaLabel = getSilpaLabel(params);
  const recordedSilpa = realizationMap['6.1.1.01'] || 0;
  const existingIndex = sumberdana.rows.findIndex(r => r.kode === '6.1.1.01');

  if (existingIndex >= 0) {
    sumberdana.rows[existingIndex].uraian = silpaLabel;
    if (silpaTahunLalu !== 0) {
      if (recordedSilpa === 0) {
        sumberdana.rows[existingIndex].realisasi = silpaTahunLalu;
        sumberdana.rows[existingIndex].selisih = silpaTahunLalu - sumberdana.rows[existingIndex].anggaran;
      } else {
        sumberdana.rows[existingIndex].realisasi += silpaTahunLalu;
        sumberdana.rows[existingIndex].selisih = sumberdana.rows[existingIndex].realisasi - sumberdana.rows[existingIndex].anggaran;
      }
      sumberdana.rows[existingIndex].persentase = sumberdana.rows[existingIndex].anggaran > 0 
        ? (sumberdana.rows[existingIndex].realisasi / sumberdana.rows[existingIndex].anggaran) * 100 
        : 0;
      sumberdana.totalRealisasi += silpaTahunLalu;
      sumberdana.totalSelisih += silpaTahunLalu;
    }
  } else if (silpaTahunLalu !== 0) {
    sumberdana.rows.unshift({
      kode: '6.1.1.01',
      uraian: silpaLabel,
      anggaran: 0,
      realisasi: silpaTahunLalu,
      selisih: silpaTahunLalu,
      persentase: 0
    });
    sumberdana.totalRealisasi += silpaTahunLalu;
    sumberdana.totalSelisih += silpaTahunLalu;
  }

  // Pendapatan Desa Adat (Akun 4.1.1) sesuai REFERENSI_REKENING constants.tsx
  const pendapatan = getGroupData('4', 'II. PENDAPATAN DESA ADAT', true);
  const pendapatanadat = pendapatan;

  // Grup Belanja Desa Adat sesuai REFERENSI_REKENING constants.tsx:
  // 1. 5.1.5: Operasional Adat (ATK, Konsumsi Paruman, Listrik, PDAM, Beban Gong, dll)
  // 2. 5.2.1: Bidang Parhyangan (Keagamaan & Upakara Aci)
  // 3. 5.3.2: Bidang Pawongan (Sosial & Budaya)
  // 4. 5.4.1 / 5.4: Bidang Palemahan (Lingkungan Hidup & Wilayah)
  const operasional = getGroupData('5.1.5', 'I. BIDANG OPERASIONAL ADAT');
  const parhyangan = getGroupData('5.2.1', 'II. BIDANG PARHYANGAN (KEAGAMAAN & UPAKARA)');
  const pawongan = getGroupData('5.3.2', 'III. BIDANG PAWONGAN (SOSIAL & BUDAYA)');
  const palemahan = getGroupData(['5.4.1', '5.4'], 'IV. BIDANG PALEMAHAN (LINGKUNGAN & WILAYAH)');

  // Alias untuk kompatibilitas tampilan komponen LRA Adat
  const bebanadat = operasional;
  const parhyanganadat = parhyangan;
  const pawonganadat = pawongan;

  // Grup belanja lainnya jika terdapat akun 5.x lain yang digunakan
  const otherRows: OperationalRow[] = [];
  Object.entries(realizationMap).forEach(([code, val]) => {
    if (code.startsWith('5') && !trackedCodes.has(code) && val !== 0) {
      otherRows.push({
        kode: code,
        uraian: REFERENSI_REKENING.find(r => r.code === code)?.name || `Belanja ${code}`,
        anggaran: 0,
        realisasi: val,
        selisih: -val,
        persentase: 0
      });
    }
  });

  const belanjaLainnyaTotalReal = otherRows.reduce((s, r) => s + r.realisasi, 0);
  const belanjaLainnya: LraGroupData = {
    label: 'V. BELANJA LAIN-LAIN',
    rows: otherRows,
    totalAnggaran: 0,
    totalRealisasi: belanjaLainnyaTotalReal,
    totalSelisih: -belanjaLainnyaTotalReal
  };

  // Akun-akun yang tidak ada hubungannya dengan CoA constants.tsx dibuat grup kosong
  // agar tidak merusak perhitungan (TIDAK LAGI DOUBLE COUNTING 5.1.5!)
  const insentif = createEmptyGroup('Beban Insentif Prajuru');
  const insentifkabupaten = createEmptyGroup('Beban Insentif Kabupaten');
  const perjalananDinas = createEmptyGroup('Perjalanan Dinas & Saku');
  const beban = createEmptyGroup('Beban Lainnya');
  const parhyangankabupaten = createEmptyGroup('Parhyangan Hibah Kabupaten');
  const pendapatanhibah = createEmptyGroup('Pendapatan Hibah');
  const pendapatanhibahprovinsi = createEmptyGroup('Pendapatan Hibah Provinsi');
  const pendapatanhibahkabupaten = createEmptyGroup('Pendapatan Hibah Kabupaten');

  // Perhitungan TOTAL BELANJA REALISASI:
  // Dihitung langsung dari seluruh pengeluaran akun 5.x yang sah tanpa duplikasi
  const totalBelanjaRealisasi =
    operasional.totalRealisasi +
    parhyangan.totalRealisasi +
    pawongan.totalRealisasi +
    palemahan.totalRealisasi +
    belanjaLainnya.totalRealisasi;

  const totalBelanjaAnggaran =
    operasional.totalAnggaran +
    parhyangan.totalAnggaran +
    pawongan.totalAnggaran +
    palemahan.totalAnggaran +
    belanjaLainnya.totalAnggaran;

  const totalPendapatanAnggaran = sumberdana.totalAnggaran + pendapatan.totalAnggaran;
  const totalPendapatanRealisasi = sumberdana.totalRealisasi + pendapatan.totalRealisasi;

  const reportData: LraReportDataProps = {
    silpaTahunLalu,
    silpaLabel,
    sumberdana,
    pendapatan,
    pendapatanadat,
    pendapatanhibah,
    pendapatanhibahprovinsi,
    pendapatanhibahkabupaten,
    parhyanganadat,
    pawonganadat,
    bebanadat,
    insentif,
    insentifkabupaten,
    operasional,
    perjalananDinas,
    beban,
    parhyangan,
    parhyangankabupaten,
    pawongan,
    palemahan,
    belanjaLainnya,
    totalBelanjaAnggaran,
    totalBelanjaRealisasi,
    surplusDefisit: {
      anggaran: totalPendapatanAnggaran - totalBelanjaAnggaran,
      realisasi: totalPendapatanRealisasi - totalBelanjaRealisasi
    }
  };

  const periodLabel = getLraPeriodLabel(params);

  return { reportData, periodLabel };
};
