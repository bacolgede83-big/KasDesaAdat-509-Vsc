import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  Calendar,
  PieChart,
  Filter,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowLeftRight,
} from "lucide-react";
import type { JuDisplayRow, BudgetItem } from "../../types";
import {
  formatCurrency,
} from "../../utils/formatter";
import {
  calculateLraReportData,
  MONTHS_LIST,
  LraReportDataProps,
} from "../../utils/lraCalculator";
import { LraSignatureBlock } from "./LraSignatureBlock";
import { isAutoEmbedSignaturesEnabled, isStampOverlayEnabled } from "../../utils/signatureStorage";

interface LraFullScreenAdatModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: LraReportDataProps;
  periodLabel: string;
  keliangName: string;
  juruRaksaName: string;
  customPlace: string;
  signatureDate: string;
  onOpenSettings?: () => void;
  printColorMode?: "color" | "monochrome";
  onTriggerPrint?: (mode?: "color" | "monochrome") => void;
  // Interactive Filtering Props:
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

export const LraFullScreenAdatModal: React.FC<LraFullScreenAdatModalProps> = ({
  isOpen,
  onClose,
  reportData: initialReportData,
  periodLabel: initialPeriodLabel,
  keliangName,
  juruRaksaName,
  customPlace,
  signatureDate,
  onOpenSettings,
  printColorMode = "color",
  onTriggerPrint,
  entries,
  budgetItems,
  initialStartDate = "",
  initialEndDate = "",
  initialYear = new Date().getFullYear().toString(),
  initialMonth = "",
  onApplyFilterToParent,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFilterBarOpen, setIsFilterBarOpen] = useState<boolean>(false);
  const [localPrintColorMode, setLocalPrintColorMode] = useState<"color" | "monochrome">(printColorMode);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState<boolean>(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalPrintColorMode(printColorMode);
  }, [printColorMode]);

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

  // Local Interactive Filter State
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setSelectedYear(initialYear);
      setSelectedMonth(initialMonth);
    }
  }, [isOpen, initialStartDate, initialEndDate, initialYear, initialMonth]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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

  const currentReportData = activeReport.reportData;
  const currentPeriodLabel = activeReport.periodLabel;

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

  // Preset Handlers
  const handlePresetAll = () => {
    setStartDate("");
    setEndDate("");
    setSelectedYear("");
    setSelectedMonth("");
  };

  const handlePresetThisYear = () => {
    setStartDate("");
    setEndDate("");
    setSelectedYear(new Date().getFullYear().toString());
    setSelectedMonth("");
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const curYear = now.getFullYear().toString();
    const curMonth = String(now.getMonth() + 1).padStart(2, "0");
    setStartDate("");
    setEndDate("");
    setSelectedYear(curYear);
    setSelectedMonth(curMonth);
  };

  const handlePresetQuarter = (quarterNum: number) => {
    const yr = selectedYear || new Date().getFullYear().toString();
    setSelectedMonth("");
    if (quarterNum === 1) {
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-03-31`);
    } else if (quarterNum === 2) {
      setStartDate(`${yr}-04-01`);
      setEndDate(`${yr}-06-30`);
    } else if (quarterNum === 3) {
      setStartDate(`${yr}-07-01`);
      setEndDate(`${yr}-09-30`);
    } else if (quarterNum === 4) {
      setStartDate(`${yr}-10-01`);
      setEndDate(`${yr}-12-31`);
    }
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedYear(new Date().getFullYear().toString());
    setSelectedMonth("");
  };

  const hasCustomFilter = Boolean(
    startDate ||
    endDate ||
    selectedMonth ||
    (selectedYear && selectedYear !== new Date().getFullYear().toString())
  );

  // Filter baris Sumber Dana Akun 7 murni (mengecualikan kode 6.1.1.01 / saldo tahun lalu)
  const pureSumberDanaRows = (currentReportData.sumberdana?.rows || []).filter(
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

  // Aggregate calculations khusus Kas Adat
  const totalPenerimaanAnggaran =
    (currentReportData.pendapatanadat?.totalAnggaran || 0) +
    sumberDanaAnggaranMurni;
  const totalPenerimaanRealisasi =
    (currentReportData.silpaTahunLalu || 0) +
    (currentReportData.pendapatanadat?.totalRealisasi || 0) +
    sumberDanaRealisasiMurni;
  const totalPenerimaanSelisih =
    totalPenerimaanRealisasi - totalPenerimaanAnggaran;
  const persentasePenerimaan =
    totalPenerimaanAnggaran > 0
      ? (totalPenerimaanRealisasi / totalPenerimaanAnggaran) * 100
      : totalPenerimaanRealisasi > 0
        ? 100
        : 0;

  // Macro Belanja Categories Adat mapped strictly with constants.tsx
  const belanjaSummaryRows = [
    {
      no: "1",
      kode: "5.2.1",
      kategori: "Bidang Parhyangan Adat",
      anggaran: currentReportData.parhyanganadat?.totalAnggaran || 0,
      realisasi: currentReportData.parhyanganadat?.totalRealisasi || 0,
      sisa: currentReportData.parhyanganadat?.totalSelisih || 0,
      persen:
        (currentReportData.parhyanganadat?.totalAnggaran || 0) > 0
          ? ((currentReportData.parhyanganadat?.totalRealisasi || 0) /
              (currentReportData.parhyanganadat?.totalAnggaran || 1)) *
            100
          : (currentReportData.parhyanganadat?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
    {
      no: "2",
      kode: "5.3.2",
      kategori: "Bidang Pawongan Adat (Sosial)",
      anggaran: currentReportData.pawonganadat?.totalAnggaran || 0,
      realisasi: currentReportData.pawonganadat?.totalRealisasi || 0,
      sisa: currentReportData.pawonganadat?.totalSelisih || 0,
      persen:
        (currentReportData.pawonganadat?.totalAnggaran || 0) > 0
          ? ((currentReportData.pawonganadat?.totalRealisasi || 0) /
              (currentReportData.pawonganadat?.totalAnggaran || 1)) *
            100
          : (currentReportData.pawonganadat?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
    {
      no: "3",
      kode: "5.1.5",
      kategori: "Bidang Beban Adat",
      anggaran: currentReportData.bebanadat?.totalAnggaran || 0,
      realisasi: currentReportData.bebanadat?.totalRealisasi || 0,
      sisa: currentReportData.bebanadat?.totalSelisih || 0,
      persen:
        (currentReportData.bebanadat?.totalAnggaran || 0) > 0
          ? ((currentReportData.bebanadat?.totalRealisasi || 0) /
              (currentReportData.bebanadat?.totalAnggaran || 1)) *
            100
          : (currentReportData.bebanadat?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
    {
      no: "4",
      kode: "5.4.1",
      kategori: "Bidang Palemahan (Lingkungan & Wilayah)",
      anggaran: currentReportData.palemahan?.totalAnggaran || 0,
      realisasi: currentReportData.palemahan?.totalRealisasi || 0,
      sisa: currentReportData.palemahan?.totalSelisih || 0,
      persen:
        (currentReportData.palemahan?.totalAnggaran || 0) > 0
          ? ((currentReportData.palemahan?.totalRealisasi || 0) /
              (currentReportData.palemahan?.totalAnggaran || 1)) *
            100
          : (currentReportData.palemahan?.totalRealisasi || 0) > 0
            ? 100
            : 0,
    },
  ];

  if (
    (currentReportData.belanjaLainnya?.totalAnggaran || 0) > 0 ||
    (currentReportData.belanjaLainnya?.totalRealisasi || 0) > 0
  ) {
    belanjaSummaryRows.push({
      no: "5",
      kode: "5.x",
      kategori: "Belanja Lain-lain",
      anggaran: currentReportData.belanjaLainnya.totalAnggaran,
      realisasi: currentReportData.belanjaLainnya.totalRealisasi,
      sisa: currentReportData.belanjaLainnya.totalSelisih,
      persen:
        currentReportData.belanjaLainnya.totalAnggaran > 0
          ? (currentReportData.belanjaLainnya.totalRealisasi /
              currentReportData.belanjaLainnya.totalAnggaran) *
            100
          : currentReportData.belanjaLainnya.totalRealisasi > 0
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

  const totalBelanjaLabel = (() => {
    if (startDate && endDate) {
      return `TOTAL REALISASI BELANJA PERIODE (${currentPeriodLabel.toUpperCase()})`;
    }
    if (startDate || endDate) {
      return `TOTAL REALISASI BELANJA PERIODE (${currentPeriodLabel.toUpperCase()})`;
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
  })();

  // Calculate expense ratios based on CoA groupings
  const parhyanganReal = currentReportData.parhyanganadat?.totalRealisasi || 0;
  const operasionalReal =
    (currentReportData.pawonganadat?.totalRealisasi || 0) +
    (currentReportData.bebanadat?.totalRealisasi || 0);
  const porsiParhyangan =
    totalBelanjaRealisasi > 0
      ? (parhyanganReal / totalBelanjaRealisasi) * 100
      : 0;
  const porsiOperasional =
    totalBelanjaRealisasi > 0
      ? (operasionalReal / totalBelanjaRealisasi) * 100
      : 0;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 130));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 70));
  const handleResetZoom = () => setZoomLevel(100);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-md flex flex-col h-[100dvh] w-[100vw] overflow-hidden select-text animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-adat-modal-title"
    >
      {/* TOP NAVIGATION & ACTION BAR (STICKY) */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-700/80 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 shadow-xl z-20 text-white">
        {/* Left: Title and Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-xl shadow-md shrink-0">
            <FileText size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2
                id="fullscreen-adat-modal-title"
                className="text-xs sm:text-sm md:text-base font-black text-white truncate leading-tight font-serif"
              >
                Ringkasan Eksekutif 1 Halaman (LRA Adat)
              </h2>
              <span className="hidden sm:inline-flex px-2 py-0.5 bg-teal-900/80 text-teal-300 text-[10px] font-bold rounded-full border border-teal-600/50">
                PSAP 02 • KAS ADAT
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate">
              Periode:{" "}
              <strong className="text-teal-300 font-mono">
                {currentPeriodLabel}
              </strong>
            </p>
          </div>
        </div>

        {/* Center: Zoom Controls */}
        <div className="hidden lg:flex items-center bg-slate-800/80 border border-slate-700 rounded-xl p-0.5 text-xs text-slate-300">
          <button
            onClick={handleZoomOut}
            title="Perkecil Tampilan"
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
          >
            <ZoomOut size={15} />
          </button>
          <span className="px-2 font-mono font-bold text-teal-300 text-[11px] min-w-[45px] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={handleZoomIn}
            title="Perbesar Tampilan"
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
          >
            <ZoomIn size={15} />
          </button>
          {zoomLevel !== 100 && (
            <button
              onClick={handleResetZoom}
              title="Reset Skala 100%"
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border-l border-slate-700 ml-0.5"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>

        {/* Right: Action Buttons & Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-sm ${
              isFilterBarOpen
                ? "bg-teal-600 text-white border-teal-400 shadow-teal-900/40"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            }`}
            title="Tampilkan / Sembunyikan Panel Filter Rentang Tanggal"
          >
            <Filter
              size={14}
              className={hasCustomFilter ? "text-amber-300" : "text-slate-300"}
            />
            <span className="hidden sm:inline">Filter Tanggal</span>
            {hasCustomFilter && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            {isFilterBarOpen ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
          </button>

          {onOpenSettings && (
            <div className="hidden sm:flex items-center gap-1.5">
              <div 
                onClick={onOpenSettings}
                className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-slate-700 transition-colors"
                title="Status Otomatisasi Tanda Tangan & Stempel (Klik untuk membuka pengaturan)"
              >
                <span className={isAutoEmbedSignaturesEnabled() ? "text-emerald-400" : "text-slate-400"}>
                  TTD: {isAutoEmbedSignaturesEnabled() ? "ON" : "OFF"}
                </span>
                <span className="text-slate-600">•</span>
                <span className={isStampOverlayEnabled() ? "text-rose-400" : "text-slate-400"}>
                  Stempel: {isStampOverlayEnabled() ? "ON" : "OFF"}
                </span>
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 sm:px-3 sm:py-1.5 bg-rose-600/90 hover:bg-rose-600 active:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1 transition-all"
            title="Tutup Layar Penuh (Esc)"
            aria-label="Tutup Layar Penuh"
          >
            <X size={18} />
            <span className="hidden sm:inline">Tutup</span>
          </button>
        </div>
      </header>

      {/* INTERACTIVE DATE RANGE & PERIOD FILTER PANEL */}
      {isFilterBarOpen && (
        <div className="shrink-0 bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 shadow-inner z-10 animate-fade-in text-white">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 max-w-7xl mx-auto">
            {/* Left: Custom Date Range Inputs */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
                <Calendar size={14} className="text-teal-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-300">
                  Rentang:
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value) {
                      setSelectedMonth("");
                    }
                  }}
                  className="bg-slate-900 text-white font-mono text-xs px-2 py-0.5 rounded border border-slate-600 outline-none focus:border-teal-400"
                  title="Tanggal Mulai (Start Date)"
                />
                <span className="text-slate-400 font-bold text-[10px]">
                  s/d
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (e.target.value) {
                      setSelectedMonth("");
                    }
                  }}
                  className="bg-slate-900 text-white font-mono text-xs px-2 py-0.5 rounded border border-slate-600 outline-none focus:border-teal-400"
                  title="Tanggal Selesai (End Date)"
                />
              </div>

              {/* Quick Year & Month Selectors */}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1 text-xs">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="bg-transparent text-xs text-white font-bold py-0.5 px-1 rounded outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-white">
                    Semua Tahun
                  </option>
                  {availableYears.map((y) => (
                    <option
                      key={y}
                      value={y}
                      className="bg-slate-900 text-white"
                    >
                      {y}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="bg-transparent text-xs text-white font-bold py-0.5 px-1 rounded outline-none border-l border-slate-700 cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-white">
                    Semua Bulan
                  </option>
                  {MONTHS_LIST.map((m) => (
                    <option
                      key={m.val}
                      value={m.val}
                      className="bg-slate-900 text-white"
                    >
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right: Quick Presets & Reset */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handlePresetThisYear}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors"
              >
                Tahun Ini
              </button>
              <button
                onClick={handlePresetThisMonth}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors"
              >
                Bulan Ini
              </button>
              <button
                onClick={() => handlePresetQuarter(1)}
                className="hidden sm:inline-block px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors"
              >
                TW I
              </button>
              <button
                onClick={() => handlePresetQuarter(2)}
                className="hidden sm:inline-block px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors"
              >
                TW II
              </button>
              <button
                onClick={() => handlePresetQuarter(3)}
                className="hidden sm:inline-block px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors"
              >
                TW III
              </button>
              <button
                onClick={() => handlePresetQuarter(4)}
                className="hidden sm:inline-block px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold border border-slate-700 transition-colors"
              >
                TW IV
              </button>
              <button
                onClick={handleResetFilters}
                className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg text-[11px] font-bold border border-rose-800/80 transition-colors flex items-center gap-1"
                title="Reset Semua Filter"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>

              {onApplyFilterToParent && (
                <button
                  onClick={() => {
                    onApplyFilterToParent({
                      startDate,
                      endDate,
                      selectedYear,
                      selectedMonth,
                    });
                  }}
                  className="px-2.5 py-1 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-[11px] font-bold border border-teal-500 transition-colors flex items-center gap-1 shadow-xs ml-1"
                  title="Sinkronkan Filter ini ke Halaman Utama"
                >
                  <Check size={12} />
                  <span>Terapkan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN SCROLLABLE PREVIEW CONTAINER */}
      <main className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-6 md:p-8 flex justify-center items-start custom-scrollbar">
        <div
          className="w-full max-w-[860px] transition-all duration-150 origin-top"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : "none",
            transformOrigin: "top center",
          }}
        >
          {/* Paper Container */}
          <div
            id="lra-adat-fullscreen-printable"
            className={`bg-white rounded-2xl border border-slate-300 p-3 sm:p-6 md:p-10 shadow-2xl text-slate-900 ${
              localPrintColorMode === "color"
                ? "print-mode-color"
                : "print-mode-monochrome"
            }`}
          >
            {/* 1. KOP SURAT DOKUMEN RESMI */}
            <div className="border-b-4 border-double border-slate-900 pb-3 mb-4 text-center">
              <div className="flex items-center justify-between mb-1">
                <div className="w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center bg-teal-900 text-white rounded-lg font-serif font-black text-lg sm:text-2xl shrink-0 shadow-sm">
                  DA
                </div>
                <div className="flex-1 px-2 sm:px-4">
                  <h2 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-wider sm:tracking-widest text-slate-900 font-serif m-0">
                    DESA ADAT BASANGALAS
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-teal-900 font-serif my-0.5">
                    • Laporan Pertanggungjawaban Keuangan Desa Adat
                  </p>
                  <p className="text-[9px] sm:text-[11px] text-slate-600 font-serif m-0">
                    Jln. Raya Basangalas, Desa Tribuana, Kec. Abang, Kab.
                    Karangasem - Bali
                  </p>
                </div>
                <div className="w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center border-2 border-slate-900 rounded-lg text-slate-900 font-mono font-black text-[10px] sm:text-xs shrink-0 text-center leading-tight">
                  PSAP
                  <br />
                  02
                </div>
              </div>
            </div>

            {/* 2. TITLE & PERIOD */}
            <div className="text-center mb-4 sm:mb-5">
              <h3 className="text-xs sm:text-base font-black uppercase tracking-tight text-slate-900 font-serif underline decoration-teal-700 decoration-2 underline-offset-4">
                RINGKASAN EKSEKUTIF LAPORAN REALISASI ANGGARAN (LRA) DESA ADAT
              </h3>
              <p className="text-[11px] sm:text-xs font-bold text-slate-700 mt-1 font-mono">
                Periode Laporan:{" "}
                <span className="text-teal-800 font-black">
                  {currentPeriodLabel}
                </span>
              </p>
            </div>

            {/* 3. 4 MACRO HIGHLIGHT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
              {/* Box 1: Total Penerimaan */}
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-900 uppercase">
                    Total Penerimaan
                  </span>
                  <span className="text-[9px] font-black bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-mono">
                    {persentasePenerimaan.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs sm:text-base font-black text-emerald-900 mt-1 font-sans">
                  {formatCurrency(totalPenerimaanRealisasi)}
                </p>
                <span className="text-[8px] sm:text-[9px] text-emerald-700 font-sans">
                  Target: {formatCurrency(totalPenerimaanAnggaran)}
                </span>
              </div>

              {/* Box 2: Total Belanja */}
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-900 uppercase">
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
                <p className="text-xs sm:text-base font-black text-slate-900 mt-1 font-sans">
                  {formatCurrency(totalBelanjaRealisasi)}
                </p>
                <span className="text-[8px] sm:text-[9px] text-slate-600 font-sans">
                  Pagu: {formatCurrency(totalBelanjaAnggaran)}
                </span>
              </div>

              {/* Box 3: Sisa Pagu Belanja */}
              <div
                className={`border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm ${
                  sisaPaguBelanja >= 0
                    ? "bg-teal-50/90 border-teal-300"
                    : "bg-rose-50/90 border-rose-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-900 uppercase">
                    Sisa Pagu
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-600">
                    Efisiensi
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-base font-black mt-1 font-sans ${
                    sisaPaguBelanja >= 0 ? "text-teal-900" : "text-rose-700"
                  }`}
                >
                  {formatCurrency(sisaPaguBelanja)}
                </p>
                <span className="text-[8px] sm:text-[9px] text-slate-600 font-sans">
                  {sisaPaguBelanja >= 0
                    ? "✅ Pagu Terkendali"
                    : "⚠️ Overbudget"}
                </span>
              </div>

              {/* Box 4: Surplus / Defisit Akhir */}
              <div
                className={`border rounded-xl p-2.5 sm:p-3 flex flex-col justify-between shadow-sm ${
                  surplusDefisitRealisasi >= 0
                    ? "bg-teal-900 text-white border-teal-800"
                    : "bg-rose-900 text-white border-rose-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-teal-100">
                    Surplus / (Defisit)
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-white/20 text-white px-1.5 py-0.2 rounded">
                    Kas Akhir
                  </span>
                </div>
                <p className="text-xs sm:text-base font-black text-white mt-1 font-sans">
                  {formatCurrency(surplusDefisitRealisasi)}
                </p>
                <span className="text-[8px] sm:text-[9px] text-teal-200 font-sans">
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

            {/* 4. TABEL RINGKASAN MAKRO LRA ADAT (SESUAI CONSTANTS CoA) */}
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
                  {/* === SECTION I: PENERIMAAN DESA ADAT === */}
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
                  {currentReportData.silpaTahunLalu !== 0 && (
                    <tr className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="px-3 py-1 text-center font-mono text-[11px] text-slate-500">
                        1
                      </td>
                      <td className="px-3 py-1 font-medium text-slate-800">
                        <span className="font-mono text-[12px] text-teal-700 font-bold mr-1.5">
                          {currentReportData.silpaLabel || "Saldo Awal / SILPA Periode Lalu"}
                        </span>
                      </td>
                      {!isMonthFilterActive && <td className="px-3 py-1 text-right text-slate-600">-</td>}
                      <td className="px-3 py-1 text-right font-bold text-slate-900">
                        {formatCurrency(currentReportData.silpaTahunLalu)}
                      </td>
                      {!isMonthFilterActive && (
                        <>
                          <td className="px-3 py-1 text-right text-emerald-700 font-semibold">
                            +{formatCurrency(currentReportData.silpaTahunLalu)}
                          </td>
                          <td className="px-2 py-1 text-center font-mono text-[11px] text-slate-600">
                            100%
                          </td>
                        </>
                      )}
                    </tr>
                  )}

                  {/* Pendapatan Asli / Dana Punia Akun 4.1.1 */}
                  <tr className="hover:bg-slate-50 border-b border-slate-200">
                    <td className="px-3 py-1 text-center font-mono text-[11px] text-slate-500">
                      {currentReportData.silpaTahunLalu !== 0 ? "2" : "1"}
                    </td>
                    <td className="px-3 py-1 font-medium text-slate-800">
                      <span className="font-mono text-[12px] text-teal-700 font-bold mr-1.5">
                        Pendapatan Desa Adat
                      </span>
                    </td>
                    {!isMonthFilterActive && (
                      <td className="px-3 py-1 text-right text-slate-800">
                        {formatCurrency(currentReportData.pendapatanadat?.totalAnggaran || 0)}
                      </td>
                    )}
                    <td className="px-3 py-1 text-right font-bold text-slate-900">
                      {formatCurrency(currentReportData.pendapatanadat?.totalRealisasi || 0)}
                    </td>
                    {!isMonthFilterActive && (
                      <>
                        <td
                          className={`px-3 py-1 text-right font-semibold ${(currentReportData.pendapatanadat?.totalSelisih || 0) >= 0 ? "text-emerald-700" : "text-amber-700"}`}
                        >
                          {(currentReportData.pendapatanadat?.totalSelisih || 0) > 0
                            ? `+${formatCurrency(currentReportData.pendapatanadat?.totalSelisih || 0)}`
                            : formatCurrency(currentReportData.pendapatanadat?.totalSelisih || 0)}
                        </td>
                        <td className="px-2 py-1 text-center font-mono text-[10px] font-bold text-slate-800">
                          {(currentReportData.pendapatanadat?.totalAnggaran || 0) > 0
                            ? `${(((currentReportData.pendapatanadat?.totalRealisasi || 0) / (currentReportData.pendapatanadat?.totalAnggaran || 1)) * 100).toFixed(1)}%`
                            : (currentReportData.pendapatanadat?.totalRealisasi || 0) > 0
                              ? "100%"
                              : "0%"}
                        </td>
                      </>
                    )}
                  </tr>

                  {/* Sumber Dana Akun 7 */}
                  <tr className="hover:bg-slate-50 border-b border-slate-200">
                    <td className="px-3 py-1 text-center font-mono text-[11px] text-slate-500">
                      {currentReportData.silpaTahunLalu !== 0 ? "3" : "2"}
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
                        <td className="px-2 py-1 text-center font-mono text-[10px] font-bold text-slate-800">
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
                    <td className="px-3 py-1.5 uppercase text-[11px] text-teal-950">
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
                      className="px-3 py-1.5 uppercase tracking-wide text-[11px]"
                    >
                      BELANJA DESA ADAT (BIDANG 5.1 s.d. 5.4)
                    </td>
                  </tr>

                  {belanjaSummaryRows.map((item) => (
                    <tr
                      key={`${item.no}-${item.kode}`}
                      className="hover:bg-slate-50 border-b border-slate-200"
                    >
                      <td className="px-3 py-1 text-center font-mono text-[11px] text-slate-500">
                        {item.no}
                      </td>
                      <td className="px-3 py-1 font-medium text-slate-800">
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
                          <td className="px-2 py-1 text-center font-mono text-[12px] font-bold">
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

            {/* 5. PERFORMANCE SNAPSHOT & PROGRESS RATIO */}
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
                    title={`Parhyangan Adat: ${porsiParhyangan.toFixed(1)}%`}
                  />
                  <div
                    className="bg-indigo-600 h-full transition-all"
                    style={{
                      width: `${Math.min(porsiOperasional, 100 - porsiParhyangan)}%`,
                    }}
                    title={`Pawongan & Beban Adat: ${porsiOperasional.toFixed(1)}%`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-700 mt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-700 inline-block"></span>
                    Parhyangan Adat (5.2.1): <strong>{porsiParhyangan.toFixed(1)}%</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                    Pawongan &amp; Beban Adat:{" "}
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
                    : `Keuangan Desa Adat Basangalas mengalami DEFISIT sebesar ${formatCurrency(Math.abs(surplusDefisitRealisasi))}. Diperlukan efisiensi pos pengeluaran dan optimalisasi sisa pagu anggaran.`}
                </p>
              </div>
            </div>

            {/* 6. LEMBAR PENGESAHAN / TANDA TANGAN */}
            <LraSignatureBlock
              keliangName={keliangName}
              juruRaksaName={juruRaksaName}
              customPlace={customPlace}
              signatureDate={signatureDate}
              keliangTitle="Keliang Adat Basangalas"
              keliangSubtitle="Penanggung Jawab Kebijakan"
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
                Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas • LRA Adat 1 Halaman
              </span>
              <span>https://desaadatbasangalas.netlify.app</span>              
            </div>
          </div>
        </div>
      </main>

      {/* Print-specific Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .custom-scrollbar::-webkit-scrollbar {
            display: none;
          }
          #lra-adat-fullscreen-printable {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          header, nav, button, input, select {
            display: none !important;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default LraFullScreenAdatModal;
