import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  FileText,
  ShieldCheck,
  PieChart,
  Printer,
  Maximize2,
  ChevronDown,
  Palette,
  Check,
  ArrowLeftRight,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatter";
import { ExportPdfButton } from "../shared/ExportPdfButton";
import { LraFullScreenAdatModal } from "./LraFullScreenAdatModal";
import { LraReportDataProps, MONTHS_LIST, calculateLraReportData } from "../../utils/lraCalculator";
import type { JuDisplayRow, BudgetItem } from "../../types";
import { LraSignatureBlock } from "./LraSignatureBlock";
import { LraVarianceExplanation } from "./LraVarianceExplanation";
import { isAutoEmbedSignaturesEnabled, isStampOverlayEnabled } from "../../utils/signatureStorage";

interface LraAdatSummaryProps {
  reportData: LraReportDataProps;
  periodLabel: string;
  keliangName: string;
  juruRaksaName: string;
  customPlace: string;
  signatureDate: string;
  onOpenSettings?: () => void;
  printColorMode?: "color" | "monochrome";
  onTriggerPrint?: (mode?: "color" | "monochrome") => void;
  onOpenFullScreen?: () => void;
  entries?: JuDisplayRow[];
  budgetItems?: BudgetItem[];
  initialStartDate?: string;
  initialEndDate?: string;
  initialYear?: string;
  initialMonth?: string;
  onApplyFilterToParent?: (filters: {
    startDate: string;
    endDate: string;
    selectedYear: string;
    selectedMonth: string;
  }) => void;
}

export const LraAdatSummary: React.FC<LraAdatSummaryProps> = ({
  reportData: initialReportData,
  periodLabel: initialPeriodLabel,
  keliangName,
  juruRaksaName,
  customPlace,
  signatureDate,
  onOpenSettings,
  printColorMode = "color",
  onTriggerPrint,
  onOpenFullScreen,
  entries,
  budgetItems,
  initialStartDate = "",
  initialEndDate = "",
  initialYear = "",
  initialMonth = "",
  onApplyFilterToParent,
}) => {
  const [internalFullScreenOpen, setInternalFullScreenOpen] = useState(false);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  // Digital Signatures & Stamp Automation State
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStamp, setShowStamp] = useState<boolean>(() => isStampOverlayEnabled());

  useEffect(() => {
    const handleSigs = () => {
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
    };
    window.addEventListener('signatures-updated', handleSigs);
    return () => window.removeEventListener('signatures-updated', handleSigs);
  }, []);

  // Local Interactive Filter State
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  // Sync initial props when they change
  useEffect(() => {
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    setSelectedYear(initialYear);
    setSelectedMonth(initialMonth);
  }, [initialStartDate, initialEndDate, initialYear, initialMonth]);

  // Available Years
  const availableYears = useMemo(() => {
    if (!entries || entries.length === 0) {
      return [new Date().getFullYear().toString()];
    }
    const years = new Set<string>();
    entries.forEach((e) => {
      if (e.date) years.add(e.date.split("-")[0]);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  // Dynamic LRA Calculation based on local interactive filters
  const activeReport = useMemo(() => {
    if (entries && budgetItems) {
      return calculateLraReportData(entries, budgetItems, {
        startDate,
        endDate,
        selectedYear,
        selectedMonth,
      });
    }
    return {
      reportData: initialReportData,
      periodLabel: initialPeriodLabel,
    };
  }, [
    entries,
    budgetItems,
    startDate,
    endDate,
    selectedYear,
    selectedMonth,
    initialReportData,
    initialPeriodLabel,
  ]);

  const reportData = activeReport.reportData;
  const periodLabel = activeReport.periodLabel;

  const isMonthFilterActive = useMemo(() => {
    if (selectedMonth && selectedMonth !== "") return true;
    if (startDate && endDate) {
      const startM = startDate.slice(0, 7);
      const endM = endDate.slice(0, 7);
      if (startM === endM) {
        return true;
      }
    }
    return false;
  }, [selectedMonth, startDate, endDate]);

  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    setStartDate("");
    setEndDate("");
    if (onApplyFilterToParent) {
      onApplyFilterToParent({
        startDate: "",
        endDate: "",
        selectedYear: newYear,
        selectedMonth,
      });
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    setStartDate("");
    setEndDate("");
    if (onApplyFilterToParent) {
      onApplyFilterToParent({
        startDate: "",
        endDate: "",
        selectedYear,
        selectedMonth: newMonth,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        printDropdownRef.current &&
        !printDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPrintDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenFullScreenModal = () => {
    if (onOpenFullScreen) {
      onOpenFullScreen();
    } else {
      setInternalFullScreenOpen(true);
    }
  };

  // Filter baris Sumber Dana Akun 7 murni (mengecualikan kode 6.1.1.01 / saldo tahun lalu yang dimasukkan saat filter tahun aktif)
  const pureSumberDanaRows = (reportData.sumberdana?.rows || []).filter(
    (row) => row.kode !== "6.1.1.01" && !row.kode.startsWith("6.")
  );
  const sumberDanaAnggaranMurni = pureSumberDanaRows.reduce(
    (sum, r) => sum + r.anggaran,
    0
  );
  const sumberDanaRealisasiMurni = pureSumberDanaRows.reduce(
    (sum, r) => sum + r.realisasi,
    0
  );
  const sumberDanaSelisihMurni =
    sumberDanaRealisasiMurni - sumberDanaAnggaranMurni;
  const sumberDanaPersenMurni =
    sumberDanaAnggaranMurni > 0
      ? (sumberDanaRealisasiMurni / sumberDanaAnggaranMurni) * 100
      : sumberDanaRealisasiMurni > 0
        ? 100
        : 0;

  // Aggregate calculations
  const totalPenerimaanAnggaran =
    (reportData.pendapatanadat?.totalAnggaran || 0) +
    sumberDanaAnggaranMurni;
  const totalPenerimaanRealisasi =
    (reportData.silpaTahunLalu || 0) +
    (reportData.pendapatanadat?.totalRealisasi || 0) +
    sumberDanaRealisasiMurni;
  const totalPenerimaanSelisih =
    totalPenerimaanRealisasi - totalPenerimaanAnggaran;
  const persentasePenerimaan =
    totalPenerimaanAnggaran > 0
      ? (totalPenerimaanRealisasi / totalPenerimaanAnggaran) * 100
      : totalPenerimaanRealisasi > 0
        ? 100
        : 0;

  // Macro Belanja Categories mapped strictly with constants.tsx (REFERENSI_REKENING)
  const belanjaSummaryRows = [
    {
      no: "1",
      kode: "5.2.1",
      kategori: "Bidang Parhyangan Adat",
      anggaran: reportData.parhyanganadat?.totalAnggaran || 0,
      realisasi: reportData.parhyanganadat?.totalRealisasi || 0,
      sisa: reportData.parhyanganadat?.totalSelisih || 0,
      persen:
        (reportData.parhyanganadat?.totalAnggaran || 0) > 0
          ? ((reportData.parhyanganadat?.totalRealisasi || 0) /
              (reportData.parhyanganadat?.totalAnggaran || 1)) *
            100
          : (reportData.parhyanganadat?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
    {
      no: "2",
      kode: "5.3.2",
      kategori: "Bidang Pawongan Adat (Sosial)",
      anggaran: reportData.pawonganadat?.totalAnggaran || 0,
      realisasi: reportData.pawonganadat?.totalRealisasi || 0,
      sisa: reportData.pawonganadat?.totalSelisih || 0,
      persen:
        (reportData.pawonganadat?.totalAnggaran || 0) > 0
          ? ((reportData.pawonganadat?.totalRealisasi || 0) /
              (reportData.pawonganadat?.totalAnggaran || 1)) *
            100
          : (reportData.pawonganadat?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
    {
      no: "3",
      kode: "5.1.5",
      kategori: "Bidang Beban Adat",
      anggaran: reportData.bebanadat?.totalAnggaran || 0,
      realisasi: reportData.bebanadat?.totalRealisasi || 0,
      sisa: reportData.bebanadat?.totalSelisih || 0,
      persen:
        (reportData.bebanadat?.totalAnggaran || 0) > 0
          ? ((reportData.bebanadat?.totalRealisasi || 0) /
              (reportData.bebanadat?.totalAnggaran || 1)) *
            100
          : (reportData.bebanadat?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
    {
      no: "4",
      kode: "5.4.1",
      kategori: "Bidang Palemahan (Lingkungan & Wilayah)",
      anggaran: reportData.palemahan?.totalAnggaran || 0,
      realisasi: reportData.palemahan?.totalRealisasi || 0,
      sisa: reportData.palemahan?.totalSelisih || 0,
      persen:
        (reportData.palemahan?.totalAnggaran || 0) > 0
          ? ((reportData.palemahan?.totalRealisasi || 0) /
              (reportData.palemahan?.totalAnggaran || 1)) *
            100
          : (reportData.palemahan?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
  ];

  if (
    (reportData.belanjaLainnya?.totalAnggaran || 0) > 0 ||
    (reportData.belanjaLainnya?.totalRealisasi || 0) > 0
  ) {
    belanjaSummaryRows.push({
      no: "5",
      kode: "5.x",
      kategori: "Belanja Lain-lain",
      anggaran: reportData.belanjaLainnya.totalAnggaran,
      realisasi: reportData.belanjaLainnya.totalRealisasi,
      sisa: reportData.belanjaLainnya.totalSelisih,
      persen:
        reportData.belanjaLainnya.totalAnggaran > 0
          ? (reportData.belanjaLainnya.totalRealisasi /
              reportData.belanjaLainnya.totalAnggaran) *
            100
          : reportData.belanjaLainnya.totalRealisasi > 0
            ? 100
            : 0,
    });
  }

  const totalBelanjaAnggaran = belanjaSummaryRows.reduce((sum, r) => sum + r.anggaran, 0);
  const totalBelanjaRealisasi = belanjaSummaryRows.reduce((sum, r) => sum + r.realisasi, 0);
  const sisaPaguBelanja = totalBelanjaAnggaran - totalBelanjaRealisasi;
  const persentaseSerapanBelanja =
    totalBelanjaAnggaran > 0
      ? (totalBelanjaRealisasi / totalBelanjaAnggaran) * 100
      : totalBelanjaRealisasi > 0
        ? 100
        : 0;

  const surplusDefisitAnggaran = totalPenerimaanAnggaran - totalBelanjaAnggaran;
  const surplusDefisitRealisasi = totalPenerimaanRealisasi - totalBelanjaRealisasi;
  const variansSurplusDefisit =
    surplusDefisitRealisasi - surplusDefisitAnggaran;

  const totalBelanjaLabel = useMemo(() => {
    if (startDate && endDate) {
      return `TOTAL REALISASI BELANJA PERIODE (${periodLabel.toUpperCase()})`;
    }
    if (startDate || endDate) {
      return `TOTAL REALISASI BELANJA PERIODE (${periodLabel.toUpperCase()})`;
    }
    if (selectedMonth) {
      const monthObj = MONTHS_LIST.find((m) => m.val === selectedMonth);
      const monthName = monthObj ? monthObj.label.toUpperCase() : `BULAN ${selectedMonth}`;
      return selectedYear
        ? `TOTAL REALISASI BELANJA BULAN ${monthName} ${selectedYear}`
        : `TOTAL REALISASI BELANJA BULAN ${monthName}`;
    }
    if (selectedYear && selectedYear !== new Date().getFullYear().toString()) {
      return `TOTAL REALISASI BELANJA TAHUN ${selectedYear}`;
    }
    if (!selectedYear) {
      return "TOTAL REALISASI BELANJA SELURUH PERIODE (KUMULATIF)";
    }
    return "TOTAL REALISASI BELANJA TAHUN BERJALAN";
  }, [startDate, endDate, selectedMonth, selectedYear, periodLabel]);

  // Calculate expense ratios based on CoA groupings
  const parhyanganReal = reportData.parhyanganadat?.totalRealisasi || 0;
  const operasionalReal =
    (reportData.pawonganadat?.totalRealisasi || 0) +
    (reportData.bebanadat?.totalRealisasi || 0);
  const porsiParhyangan =
    totalBelanjaRealisasi > 0
      ? (parhyanganReal / totalBelanjaRealisasi) * 100
      : 0;
  const porsiOperasional =
    totalBelanjaRealisasi > 0
      ? (operasionalReal / totalBelanjaRealisasi) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          ACTION TOOLBAR (ON SCREEN)
          ========================================================================= */}
      <div className="no-print bg-slate-50 border border-slate-300 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-600 text-white rounded-xl shadow-sm">
            <FileText size={18} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 leading-tight">
              Ringkasan Eksekutif LRA Adat
            </h4>
            <p className="text-xs text-slate-600">
              Format ringkas standar akuntansi (PSAP 02) sesuai Chart of
              Accounts resmi Desa Adat.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-inner">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Tahun:</span>
              <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-600 cursor-pointer"
              >
                  <option value="">Semua Tahun</option>
                  {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                  ))}
              </select>
              <select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-900 outline-none focus:border-teal-600 cursor-pointer"
              >
                  <option value="">Semua Bulan</option>
                  {MONTHS_LIST.map(m => (
                      <option key={m.val} value={m.val}>{m.label}</option>
                  ))}
              </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Buka Layar Penuh (Modal) */}
          <button
            onClick={handleOpenFullScreenModal}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            title="Tampilkan Ringkasan 1 Halaman dalam Tampilan Layar Penuh / Modal"
          >
            <Maximize2 size={15} />
            <span>Buka Layar Penuh (Modal)</span>
          </button>

          <ExportPdfButton
            elementId="lra-onepage-printable-container"
            filename={`One_Page_Summary_LRA_${periodLabel.replace(/\s+/g, "_")}.pdf`}
            buttonText="Ekspor PDF"
            variant="default"
            defaultOrientation="portrait"
            showModal={true}
          />

          <div className="relative inline-block" ref={printDropdownRef}>
            <div className="flex items-center rounded-xl shadow-md overflow-hidden bg-gradient-to-r from-teal-700 to-emerald-700">
              <button
                onClick={() =>
                  onTriggerPrint ? onTriggerPrint(printColorMode) : window.print()
                }
                className="px-3.5 py-2 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                title="Cetak Ringkasan 1 Halaman"
              >
                <Printer size={15} />
                <span>
                  {printColorMode === "monochrome"
                    ? "Cetak Standar (Hitam Putih)"
                    : "Cetak 1 Halaman"}
                </span>
              </button>
              <button
                onClick={() => setIsPrintDropdownOpen(!isPrintDropdownOpen)}
                className="px-2 py-2 border-l border-teal-600/60 hover:bg-black/10 text-white transition-colors"
                title="Pilih Mode Cetak (Hitam Putih / Berwarna)"
                aria-label="Pilih Mode Cetak"
              >
                <ChevronDown size={14} className={isPrintDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            </div>

            {isPrintDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 text-xs text-white animate-fade-in">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Format Cetak / Print Mode
                </div>
                <button
                  onClick={() => {
                    setIsPrintDropdownOpen(false);
                    if (onTriggerPrint) {
                      onTriggerPrint("monochrome");
                    } else {
                      window.print();
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-800 transition-colors ${
                    printColorMode === "monochrome" ? "bg-teal-950/70 text-teal-300 font-bold" : "text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Printer size={14} className="text-slate-300" />
                    <div>
                      <div className="font-bold">Cetak Standar (Hitam Putih)</div>
                      <div className="text-[10px] text-slate-400">Background putih bersih &amp; hemat tinta</div>
                    </div>
                  </div>
                  {printColorMode === "monochrome" && <Check size={14} className="text-teal-400" />}
                </button>
                <button
                  onClick={() => {
                    setIsPrintDropdownOpen(false);
                    if (onTriggerPrint) {
                      onTriggerPrint("color");
                    } else {
                      window.print();
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-800 transition-colors ${
                    printColorMode === "color" ? "bg-teal-950/70 text-teal-300 font-bold" : "text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Palette size={14} className="text-teal-400" />
                    <div>
                      <div className="font-bold">Cetak Berwarna (Full Color)</div>
                      <div className="text-[10px] text-slate-400">Gradien &amp; aksen warna resmi</div>
                    </div>
                  </div>
                  {printColorMode === "color" && <Check size={14} className="text-teal-400" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          PRINTABLE 1-PAGE DOCUMENT CONTAINER
          ========================================================================= */}
      <div
        id="lra-onepage-printable-container"
        className={`bg-white rounded-2xl border border-slate-300 p-3.5 sm:p-6 md:p-8 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 text-slate-900 ${
          printColorMode === "color"
            ? "print-mode-color"
            : "print-mode-monochrome"
        }`}
      >
        {/* 1. KOP SURAT / DOKUMEN RESMI */}
        <div className="border-b-4 border-double border-slate-900 pb-3 mb-4 text-center">
          <div className="flex items-center justify-between mb-1">
            <div className="w-12 h-12 hidden print:flex sm:flex items-center justify-center bg-teal-900 text-white rounded-lg font-serif font-black text-xl shrink-0 shadow-sm">
              DA
            </div>
            <div className="flex-1 px-2 sm:px-4">
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                DESA ADAT BASANGALAS
              </h2>
              <p className="text-xs sm:text-sm font-bold text-teal-800 font-serif my-0.5">
                • Laporan Pertanggungjawaban Keuangan Kas Desa Adat
              </p>
              <p className="text-[10px] text-slate-600 font-serif m-0">
                Jalan Raya Basangalas, Desa Tribuana, Kec. Abang, Kab.
                Karangasem - Bali
              </p>
            </div>
            <div className="w-12 h-12 hidden print:flex sm:flex items-center justify-center border-2 border-slate-900 rounded-lg text-slate-900 font-mono font-black text-xs shrink-0 text-center leading-tight">
              PSAP
              <br />
              02
            </div>
          </div>
        </div>

        {/* Title & Period */}
        <div className="text-center mb-4">
          <h3 className="text-sm sm:text-base font-black uppercase tracking-thight text-slate-900 font-serif underline decoration-teal-700 decoration-2 underline-offset-4">
            RINGKASAN EKSEKUTIF LAPORAN REALISASI ANGGARAN (LRA) DESA ADAT
          </h3>
          <p className="text-xs font-bold text-slate-700 mt-1 font-mono">
            Periode Laporan:{" "}
            <span className="text-teal-800 font-black">{periodLabel}</span>
          </p>
        </div>

        {/* 2. HIGHLIGHT METRICS STRIP (4 MACRO KEY INDICATORS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {/* Box 1: Total Penerimaan */}
          <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-900 uppercase">
                Total Penerimaan
              </span>
              <span className="text-[9px] font-black bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-mono">
                {persentasePenerimaan.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-emerald-900 mt-1 font-sans">
              {formatCurrency(totalPenerimaanRealisasi)}
            </p>
            <span className="text-[9px] text-emerald-700 font-sans">
              Target: {formatCurrency(totalPenerimaanAnggaran)}
            </span>
          </div>

          {/* Box 2: Total Belanja */}
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-900 uppercase">
                Total Belanja
              </span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                  persentaseSerapanBelanja > 100
                    ? "bg-rose-200 text-rose-900"
                    : "bg-teal-200 text-teal-900"
                }`}
              >
                {persentaseSerapanBelanja.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-slate-900 mt-1 font-sans">
              {formatCurrency(totalBelanjaRealisasi)}
            </p>
            <span className="text-[9px] text-slate-600 font-sans">
              Pagu: {formatCurrency(totalBelanjaAnggaran)}
            </span>
          </div>

          {/* Box 3: Sisa Pagu Belanja */}
          <div
            className={`border rounded-xl p-2.5 flex flex-col justify-between shadow-sm ${
              sisaPaguBelanja >= 0
                ? "bg-teal-50/80 border-teal-300"
                : "bg-rose-50/80 border-rose-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-900 uppercase">
                Sisa Pagu Belanja
              </span>
              <span className="text-[9px] font-bold text-slate-600">
                Efisiensi
              </span>
            </div>
            <p
              className={`text-xs sm:text-sm font-black mt-1 font-sans ${
                sisaPaguBelanja >= 0 ? "text-teal-900" : "text-rose-700"
              }`}
            >
              {formatCurrency(sisaPaguBelanja)}
            </p>
            <span className="text-[9px] text-slate-600 font-sans">
              {sisaPaguBelanja >= 0 ? "✅ Pagu Terkendali" : "⚠️ Overbudget"}
            </span>
          </div>

          {/* Box 4: Surplus / Defisit Akhir */}
          <div
            className={`border rounded-xl p-2.5 flex flex-col justify-between shadow-sm ${
              surplusDefisitRealisasi >= 0
                ? "bg-teal-900 text-white border-teal-800"
                : "bg-rose-900 text-white border-rose-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-100">
                Surplus / (Defisit)
              </span>
              <span className="text-[9px] font-mono font-bold bg-white/20 text-white px-1.5 py-0.2 rounded">
                Kas Akhir
              </span>
            </div>
            <p className="text-xs sm:text-sm font-black text-white mt-1 font-sans">
              {formatCurrency(surplusDefisitRealisasi)}
            </p>
            <span className="text-[9px] text-teal-200 font-sans">
              Varians:{" "}
              {variansSurplusDefisit >= 0
                ? `+${formatCurrency(variansSurplusDefisit)}`
                : formatCurrency(variansSurplusDefisit)}
            </span>
          </div>
        </div>

        {/* Hint geser tabel di layar HP */}
        <div className="sm:hidden flex items-center justify-between text-[11px] text-teal-900 bg-teal-50 px-3 py-1.5 rounded-lg mb-2 border border-teal-200 no-print">
          <span className="flex items-center gap-1.5 font-bold">
            <ArrowLeftRight size={13} className="text-teal-700 shrink-0" /> Geser tabel ke samping untuk melihat seluruh kolom
          </span>
        </div>

        {/* 3. TABEL RINGKASAN MAKRO LRA (SESUAI CONSTANTS CoA) */}
        <div className="border border-slate-400 rounded-xl overflow-x-auto mb-4 shadow-sm scrollbar-thin print:rounded-none print:shadow-none print:border-none">
          {isMonthFilterActive && (
            <div className="bg-teal-50 border-b border-teal-200 px-3 py-1.5 text-xs text-teal-900 font-semibold flex items-center justify-between no-print">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
                Filter Bulan Aktif: Kolom Anggaran &amp; Selisih disembunyikan untuk fokus realisasi kas bulanan.
              </span>
              <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono font-bold">
                Realisasi Bulanan
              </span>
            </div>
          )}
          <table className="w-full min-w-[500px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider">
                <th className="px-3 py-2 text-center w-10 border border-slate-700">
                  No
                </th>
                <th className="px-3 py-2 border border-slate-700">
                  Pos / Uraian Akun Makro
                </th>
                {!isMonthFilterActive && (
                  <th className="px-3 py-2 text-right w-28 border border-slate-700">
                    Anggaran (Rp)
                  </th>
                )}
                <th className={`px-3 py-2 text-right ${isMonthFilterActive ? 'w-48' : 'w-28'} border border-slate-700`}>
                  Realisasi (Rp)
                </th>
                {!isMonthFilterActive && (
                  <>
                    <th className="px-3 py-2 text-right w-28 border border-slate-700">
                      Sisa / Selisih
                    </th>
                    <th className="px-2 py-2 text-center w-16 border border-slate-700">
                      %
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900 font-sans">
              {/* === SECTION I: PENERIMAAN & SUMBER DANA === */}
              <tr className="bg-teal-900 text-white font-black">
                <td className="px-3 py-1.5 text-center font-mono">I</td>
                <td
                  colSpan={isMonthFilterActive ? 2 : 5}
                  className="px-3 py-1.5 uppercase tracking-wide text-[11px]"
                >
                  PENERIMAAN DESA ADAT
                </td>
              </tr>

              {/* Saldo Awal Tahun Lalu */}
              {reportData.silpaTahunLalu !== 0 && (
                <tr className="hover:bg-slate-50 border-b border-slate-200">
                  <td className="px-3 py-1 text-center font-mono text-[11px] font-semibold text-slate-500">
                    1
                  </td>
                  <td className="px-3 py-1 font-medium text-slate-800">
                    <span className="font-mono text-[12px] text-teal-700 font-bold mr-1.5">
                      {reportData.silpaLabel || "Saldo Awal / SILPA Periode Lalu"}
                    </span>
                  </td>
                  {!isMonthFilterActive && <td className="px-3 py-1 text-right text-slate-600">-</td>}
                  <td className="px-3 py-1 text-right font-bold text-slate-900">
                    {formatCurrency(reportData.silpaTahunLalu)}
                  </td>
                  {!isMonthFilterActive && (
                    <>
                      <td className="px-3 py-1 text-right text-emerald-700 font-semibold">
                        +{formatCurrency(reportData.silpaTahunLalu)}
                      </td>
                      <td className="px-2 py-1 text-center font-mono text-[12px] text-slate-600">
                        100%
                      </td>
                    </>
                  )}
                </tr>
              )}

              {/* Pendapatan Asli / Dana Punia Akun 4 */}
              <tr className="hover:bg-slate-50 border-b border-slate-200">
                <td className="px-3 py-1 text-center font-mono text-[11px] font-semibold text-slate-500">
                  {reportData.silpaTahunLalu !== 0 ? "2" : "1"}
                </td>
                <td className="px-3 py-1 font-medium text-slate-800">
                  <span className="font-mono text-[12px] text-teal-700 font-bold mr-1.5">
                    Pendapatan Desa Adat
                  </span>
                </td>
                {!isMonthFilterActive && (
                  <td className="px-3 py-1 text-right text-slate-800">
                    {formatCurrency(reportData.pendapatanadat?.totalAnggaran || 0)}
                  </td>
                )}
                <td className="px-3 py-1 text-right font-bold text-slate-900">
                  {formatCurrency(reportData.pendapatanadat?.totalRealisasi || 0)}
                </td>
                {!isMonthFilterActive && (
                  <>
                    <td
                      className={`px-3 py-1 text-right font-semibold ${(reportData.pendapatanadat?.totalSelisih || 0) >= 0 ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {(reportData.pendapatanadat?.totalSelisih || 0) > 0
                        ? `+${formatCurrency(reportData.pendapatanadat?.totalSelisih || 0)}`
                        : formatCurrency(reportData.pendapatanadat?.totalSelisih || 0)}
                    </td>
                    <td className="px-2 py-1 text-center font-mono text-[12px] font-bold text-slate-800">
                      {(reportData.pendapatanadat?.totalAnggaran || 0) > 0
                        ? `${(((reportData.pendapatanadat?.totalRealisasi || 0) / (reportData.pendapatanadat?.totalAnggaran || 1)) * 100).toFixed(1)}%`
                        : (reportData.pendapatanadat?.totalRealisasi || 0) > 0
                          ? "100%"
                          : "0%"}
                    </td>
                  </>
                )}
              </tr>

              {/* Sumber Dana Akun 7 */}
              <tr className="hover:bg-slate-50 border-b border-slate-200">
                <td className="px-3 py-1 text-center font-mono text-[11px] font-semibold text-slate-500">
                  {reportData.silpaTahunLalu !== 0 ? "3" : "2"}
                </td>
                <td className="px-3 py-1 font-medium text-slate-800">
                  <span className="font-mono text-[12px] text-teal-700 font-bold mr-1.5">
                    Sumber Dana Lainnya
                  </span>
                </td>
                {!isMonthFilterActive && (
                  <td className="px-3 py-1 text-right text-slate-800">
                    {sumberDanaAnggaranMurni > 0
                      ? formatCurrency(sumberDanaAnggaranMurni)
                      : "-"}
                  </td>
                )}
                <td className="px-3 py-1 text-right font-bold text-slate-900">
                  {formatCurrency(sumberDanaRealisasiMurni)}
                </td>
                {!isMonthFilterActive && (
                  <>
                    <td
                      className={`px-3 py-1 text-right font-semibold ${sumberDanaSelisihMurni >= 0 ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {sumberDanaSelisihMurni > 0
                        ? `+${formatCurrency(sumberDanaSelisihMurni)}`
                        : formatCurrency(sumberDanaSelisihMurni)}
                    </td>
                    <td className="px-2 py-1 text-center font-mono text-[12px] font-bold text-slate-800">
                      {sumberDanaAnggaranMurni > 0
                        ? `${sumberDanaPersenMurni.toFixed(1)}%`
                        : sumberDanaRealisasiMurni > 0
                          ? "100%"
                          : "0%"}
                    </td>
                  </>
                )}
              </tr>


              {/* Subtotal Penerimaan */}
              <tr className="bg-teal-50 font-black border-y-2 border-teal-700">
                <td className="px-3 py-1.5 text-center text-teal-900 font-mono">
                </td>
                <td className="px-3 py-1.5 uppercase text-[12px] text-teal-950">
                  TOTAL PENERIMAAN DESA ADAT
                </td>
                {!isMonthFilterActive && (
                  <td className="px-3 py-1.5 text-right text-teal-950">
                    {formatCurrency(totalPenerimaanAnggaran)}
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-teal-950 font-black">
                  {formatCurrency(totalPenerimaanRealisasi)}
                </td>
                {!isMonthFilterActive && (
                  <>
                    <td
                      className={`px-3 py-1.5 text-right font-bold ${totalPenerimaanSelisih >= 0 ? "text-emerald-800" : "text-amber-800"}`}
                    >
                      {totalPenerimaanSelisih > 0
                        ? `+${formatCurrency(totalPenerimaanSelisih)}`
                        : formatCurrency(totalPenerimaanSelisih)}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono font-black text-teal-900">
                      {persentasePenerimaan.toFixed(1)}%
                    </td>
                  </>
                )}
              </tr>

              {/* === SECTION II: BELANJA DESA ADAT === */}
              <tr className="bg-slate-700 text-white font-black">
                <td className="px-3 py-1.5 text-center font-mono">II</td>
                <td
                  colSpan={isMonthFilterActive ? 2 : 5}
                  className="px-3 py-1.5 uppercase tracking-wide text-[12px]"
                >
                  BELANJA DESA ADAT (BIDANG 5.1 s.d. 5.4)
                </td>
              </tr>

              {belanjaSummaryRows.map((item) => (
                <tr
                  key={`${item.no}-${item.kode}`}
                  className="hover:bg-slate-50 border-b border-slate-200"
                >
                  <td className="px-3 py-1 text-center font-mono text-[11px] font-semibold text-slate-500">
                    {item.no}
                  </td>
                  <td className="px-3 py-1 font-mono text-slate-800">
                    <span className="font-mono text-[12px] text-teal-700 font-bold mr-1.5">
                      {item.kategori}                     
                    </span>
                  </td>
                  {!isMonthFilterActive && (
                    <td className="px-3 py-1 text-right text-slate-800">
                      {item.anggaran > 0 ? formatCurrency(item.anggaran) : "-"}
                    </td>
                  )}
                  <td className="px-3 py-1 text-right font-bold text-slate-900">
                    {formatCurrency(item.realisasi)}
                  </td>
                  {!isMonthFilterActive && (
                    <>
                      <td
                        className={`px-3 py-1 text-right font-semibold ${
                          item.sisa >= 0 ? "text-slate-800" : "text-rose-700"
                        }`}
                      >
                        {item.anggaran > 0 || item.realisasi > 0
                          ? formatCurrency(item.sisa)
                          : "-"}
                      </td>
                      <td className="px-2 py-1 text-center font-mono text-[11px] font-bold">
                        <span
                          className={`px-1.5 py-0.2 rounded ${
                            item.persen > 100
                              ? "bg-rose-100 text-rose-800"
                              : item.persen >= 80
                                ? "bg-teal-100 text-teal-800"
                                : "text-slate-700"
                          }`}
                        >
                          {item.persen.toFixed(0)}%
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Subtotal Belanja */}
              <tr className="bg-slate-200 font-black border-y-2 border-slate-700">
                <td className="px-3 py-1.5 text-center text-slate-900 font-mono">
                </td>
                <td className="px-3 py-1.5 uppercase text-[11px] text-slate-950">
                  {totalBelanjaLabel}
                </td>
                {!isMonthFilterActive && (
                  <td className="px-3 py-1.5 text-right text-slate-950">
                    {formatCurrency(totalBelanjaAnggaran)}
                  </td>
                )}
                <td className="px-3 py-1.5 text-right text-rose-800 font-black">
                  {formatCurrency(totalBelanjaRealisasi)}
                </td>
                {!isMonthFilterActive && (
                  <>
                    <td
                      className={`px-3 py-1.5 text-right font-bold ${sisaPaguBelanja >= 0 ? "text-slate-900" : "text-rose-700"}`}
                    >
                      {formatCurrency(sisaPaguBelanja)}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono font-black text-slate-900">
                      {persentaseSerapanBelanja.toFixed(1)}%
                    </td>
                  </>
                )}
              </tr>

              {/* === SECTION III: SURPLUS / DEFISIT AKHIR === */}
              <tr
                className={`font-black text-[12px] border-t-4 ${
                  surplusDefisitRealisasi >= 0
                    ? "bg-teal-100 text-teal-950 border-teal-800"
                    : "bg-rose-100 text-rose-950 border-rose-800"
                }`}
              >
                <td className="px-3 py-2.5 text-center font-mono font-black">
                  III
                </td>
                <td className="px-3 py-2.5 uppercase tracking-wide text-xs">
                  SURPLUS / (DEFISIT) BERSIH LRA (I - II)
                </td>
                {!isMonthFilterActive && (
                  <td className="px-3 py-2.5 text-right font-bold">
                    {formatCurrency(surplusDefisitAnggaran)}
                  </td>
                )}
                <td className="px-3 py-2.5 text-right font-black">
                  {formatCurrency(surplusDefisitRealisasi)}
                </td>
                {!isMonthFilterActive && (
                  <>
                    <td className="px-3 py-2.5 text-right font-black">
                      {variansSurplusDefisit >= 0
                        ? `+${formatCurrency(variansSurplusDefisit)}`
                        : formatCurrency(variansSurplusDefisit)}
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono text-xs font-black">
                      {surplusDefisitRealisasi >= 0 ? "SURPLUS" : "DEFISIT"}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. PERFORMANCE SNAPSHOT & PROGRESS RATIO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs">
          {/* Rasio Alokasi Belanja */}
          <div className=" no-print">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1">
                <PieChart size={13} className="text-teal-700" />
                Proporsi Alokasi Belanja Aktual
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Total Belanja: {formatCurrency(totalBelanjaRealisasi)}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden flex">
              <div
                className="bg-teal-700 h-full transition-all"
                style={{ width: `${Math.min(porsiParhyangan, 100)}%` }}
                title={`Parhyangan & Upakara: ${porsiParhyangan.toFixed(1)}%`}
              />
              <div
                className="bg-indigo-600 h-full transition-all"
                style={{
                  width: `${Math.min(porsiOperasional, 100 - porsiParhyangan)}%`,
                }}
                title={`Operasional: ${porsiOperasional.toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-700 mt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-700 inline-block"></span>
                Parhyangan (5.2): <strong>{porsiParhyangan.toFixed(1)}%</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                Operasional (5.1):{" "}
                <strong>{porsiOperasional.toFixed(1)}%</strong>
              </span>
            </div>
          </div>

          {/* Catatan Ringkas Eksekutif */}
          <div className="border-l-0 sm:border-l sm:pl-3 border-slate-300 flex flex-col justify-center">
            <span className="font-bold text-slate-900 flex items-center gap-1 mb-1">
              <ShieldCheck size={13} className="text-emerald-700" />
              Catatan Akuntabilitas &amp; Tata Kelola
            </span>
            <p className="text-[10px] text-slate-600 leading-snug">
              {surplusDefisitRealisasi >= 0
                ? `Keuangan Desa Adat Basangalas berada dalam kondisi SEHAT & SURPLUS sebesar ${formatCurrency(surplusDefisitRealisasi)}. Pagu anggaran belanja terserap terkendali (${persentaseSerapanBelanja.toFixed(1)}%).`
                : `Realisasi belanja melampaui penerimaan kas tahun berjalan. Terdapat defisit operasional ${formatCurrency(Math.abs(surplusDefisitRealisasi))} yang tertutupi oleh cadangan kas kasir/sumber dana terkait.`}
            </p>
          </div>
        </div>

        {/* 5. CATATAN & NARASI PENJELASAN SELISIH ANGGARAN & REALISASI */}
        <div className="mb-4">
          <LraVarianceExplanation
            reportData={reportData}
            periodLabel={periodLabel}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            isMonthFilterActive={isMonthFilterActive}
          />
        </div>

        {/* 6. TANDA TANGAN RESMI PENGESAHAN */}
        <LraSignatureBlock
          keliangName={keliangName}
          juruRaksaName={juruRaksaName}
          customPlace={customPlace}
          signatureDate={signatureDate}
          keliangTitle="Keliang Adat Basangalas"
          keliangSubtitle="Penanggung Jawab Umum"
          juruRaksaTitle="Juru Raksa"
          juruRaksaSubtitle="Pengelola &amp; Pembukuan Kas"
          keliangActionText="Mengetahui,"
          namaDesa="DESA ADAT BASANGALAS"
          showQuickControls={true}
          onOpenSettings={onOpenSettings}
        />

        {/* Formal Footer */}
        <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-200 text-[8px] text-slate-500 font-mono">
          <span>
            Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas • LRA Desa Adat.
          </span>
          <span>
            Dicetak:{" "}
            {new Date().toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* RENDER FULLSCREEN MODAL IF ACTIVE */}
      {internalFullScreenOpen && (
        <LraFullScreenAdatModal
          isOpen={internalFullScreenOpen}
          onClose={() => setInternalFullScreenOpen(false)}
          reportData={reportData}
          periodLabel={periodLabel}
          keliangName={keliangName}
          juruRaksaName={juruRaksaName}
          customPlace={customPlace}
          signatureDate={signatureDate}
          onOpenSettings={onOpenSettings}
          printColorMode={printColorMode}
          onTriggerPrint={onTriggerPrint}
          entries={entries}
          budgetItems={budgetItems}
          initialStartDate={startDate}
          initialEndDate={endDate}
          initialYear={selectedYear}
          initialMonth={selectedMonth}
          onApplyFilterToParent={(f) => {
            setStartDate(f.startDate);
            setEndDate(f.endDate);
            setSelectedYear(f.selectedYear);
            setSelectedMonth(f.selectedMonth);
            if (onApplyFilterToParent) {
              onApplyFilterToParent(f);
            }
          }}
        />
      )}
    </div>
  );
};

export default LraAdatSummary;
