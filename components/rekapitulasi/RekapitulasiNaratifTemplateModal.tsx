import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../shared/Modal';
import { ExportPdfButton } from '../shared/ExportPdfButton';
import { formatLongDate } from '../../utils/formatter';
import type { JuDisplayRow } from '../../types';
import { 
    getStoredSignatures, 
    isAutoEmbedSignaturesEnabled, 
    getSignatureScale, 
    setSignatureScale,
    isStampOverlayEnabled, 
    setStampOverlayEnabled,
    getStampScale, 
    setStampScale,
    getEffectiveStamp, 
    DigitalSignatures 
} from '../../utils/signatureStorage';
import { 
    Printer, 
    ZoomIn, 
    ZoomOut, 
    Stamp, 
    Maximize2, 
    Minimize2, 
    FileText, 
    Sparkles
} from 'lucide-react';
import { RekapitulasiNaratifContent } from './RekapitulasiNaratifContent';

export interface RekapitulasiNaratifTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
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
    keliangName?: string;
    juruRaksaName?: string;
    penyarikanName?: string;
    pengawasName?: string;
    customPlace?: string;
    signatureDate?: string;
}

export const RekapitulasiNaratifTemplateModal: React.FC<RekapitulasiNaratifTemplateModalProps> = ({
    isOpen,
    onClose,
    reportPeriodLabel,
    selectedYear,
    selectedMonth,
    entries = [],
    rekap,
    keliangName = 'I Made Mudita',
    juruRaksaName = 'I Putu Gede Sutrana',
    penyarikanName = '',
    pengawasName = '',
    customPlace = 'Basangalas',
    signatureDate
}) => {
    // Village Profile from localStorage
    const savedProfile = typeof window !== 'undefined' 
        ? localStorage.getItem('basangalas_profile') || localStorage.getItem('village_profile') || localStorage.getItem('tigalikur_profile') 
        : null;
    const profile = useMemo(() => {
        return savedProfile ? JSON.parse(savedProfile) : { 
            namaDesa: 'DESA ADAT BASANGALAS', 
            namaBendahara: juruRaksaName, 
            namaKetua: keliangName,
            alamat: 'Sekretariat: Jl. Raya Basangalas, Desa Tribuana, Kec. Abang, Karangasem, Bali 80852'
        };
    }, [savedProfile, juruRaksaName, keliangName]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [signatures, setSignatures] = useState<DigitalSignatures>({});
    const [embedSignatures, setEmbedSignatures] = useState<boolean>(true);
    const [showStamp, setShowStamp] = useState<boolean>(true);
    const [sigScale, setSigScale] = useState<number>(100);
    const [stampScaleVal, setStampScaleVal] = useState<number>(100);

    // Editable names in signature section
    const [keliang, setKeliang] = useState<string>(keliangName);
    const [juruRaksa, setJuruRaksa] = useState<string>(juruRaksaName);
    const [penyarikan, setPenyarikan] = useState<string>(penyarikanName);
    const [pengawas, setPengawas] = useState<string>(pengawasName);

    const [isEditingKeliang, setIsEditingKeliang] = useState(false);
    const [isEditingJuruRaksa, setIsEditingJuruRaksa] = useState(false);
    const [isEditingPenyarikan, setIsEditingPenyarikan] = useState(false);
    const [isEditingPengawas, setIsEditingPengawas] = useState(false);

    const effectiveStamp = useMemo(() => {
        return getEffectiveStamp(signatures, profile.namaDesa || 'DESA ADAT BASANGALAS');
    }, [signatures, profile]);

    useEffect(() => {
        const loadSigs = () => {
            setSignatures(getStoredSignatures());
            setEmbedSignatures(isAutoEmbedSignaturesEnabled());
            setShowStamp(isStampOverlayEnabled());
            setSigScale(getSignatureScale());
            setStampScaleVal(getStampScale());
        };
        loadSigs();
        window.addEventListener('signatures-updated', loadSigs);
        return () => window.removeEventListener('signatures-updated', loadSigs);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setKeliang(keliangName || profile.namaKetua || 'I Made Mudita');
            setJuruRaksa(juruRaksaName || profile.namaBendahara || 'I Putu Gede Sutrana');
            setPenyarikan(penyarikanName || '');
            setPengawas(pengawasName || '');
        }
    }, [isOpen, keliangName, juruRaksaName, penyarikanName, pengawasName, profile]);

    useEffect(() => {
        const handleAfterPrint = () => {
            document.body.classList.remove('print-rekap-naratif-mode');
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
            document.body.classList.remove('print-rekap-naratif-mode');
        };
    }, []);

    const handleAdjustScale = (delta: number) => {
        const newScale = Math.max(50, Math.min(180, sigScale + delta));
        setSigScale(newScale);
        setSignatureScale(newScale);
    };

    const handleAdjustStampScale = (delta: number) => {
        const newScale = Math.max(50, Math.min(180, stampScaleVal + delta));
        setStampScaleVal(newScale);
        setStampScale(newScale);
    };

    const handleToggleStamp = (enabled: boolean) => {
        setShowStamp(enabled);
        setStampOverlayEnabled(enabled);
    };

    const handlePrintNaratif = () => {
        document.body.classList.add('print-rekap-naratif-mode');
        setTimeout(() => {
            window.print();
        }, 80);
    };

    const currentYearStr = selectedYear || new Date().getFullYear().toString();
    const formattedSignDate = formatLongDate(signatureDate || new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Laporan Realisasi Anggaran & Narasi Keuangan Kas - ${reportPeriodLabel}`}
            className={`transition-all duration-300 ${
                isFullscreen 
                    ? '!max-w-[98vw] !w-[98vw] !h-[96vh] !p-3' 
                    : '!max-w-4xl !w-full'
            }`}
        >
            <div className="flex flex-col h-full space-y-4">
                
                {/* TOOLBAR ATAS: Info + Fullscreen Toggle + Print Shortcut */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-teal-950/40 via-slate-800 to-emerald-950/40 border border-slate-700 rounded-xl no-print">
                    <div className="flex items-center gap-2 text-slate-200">
                        <span className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30">
                            <FileText size={18} />
                        </span>
                        <div>
                            <div className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                                Narasi LRA Ramah Krama Awam <Sparkles size={13} className="text-emerald-400 animate-pulse" />
                            </div>
                            <div className="text-[11px] text-slate-300">
                                Penjelasan realisasi anggaran LRA dalam bahasa sederhana, transparan &amp; mudah dipahami krama desa.
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* TOMBOL BUKA LAYAR PENUH */}
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                isFullscreen
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-md'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 hover:border-amber-400'
                            }`}
                            title={isFullscreen ? 'Kembalikan Ukuran Normal' : 'Tampilkan Dokumen Layar Penuh'}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 size={15} /> Layar Normal
                                </>
                            ) : (
                                <>
                                    <Maximize2 size={15} /> Buka Layar Penuh
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handlePrintNaratif}
                            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow cursor-pointer active:scale-95"
                        >
                            <Printer size={15} /> Cetak Narasi
                        </button>
                    </div>
                </div>

                {/* STYLE KHUSUS PRINT A4 */}
                <style>{`
                    @media print {
                        body.print-rekap-naratif-mode * {
                            visibility: hidden;
                        }
                        body.print-rekap-naratif-mode #printable-rekap-naratif,
                        body.print-rekap-naratif-mode #printable-rekap-naratif * {
                            visibility: visible;
                        }
                        body.print-rekap-naratif-mode #printable-rekap-naratif {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            max-width: 100% !important;
                            padding: 10mm 15mm !important;
                            margin: 0 !important;
                            background: white !important;
                            color: black !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        body.print-rekap-naratif-mode .no-print {
                            display: none !important;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 10mm 12mm 10mm 12mm;
                        }
                    }
                `}</style>

                {/* CONTAINER PREVIEW NASKAH DOKUMEN */}
                <div 
                    className="flex-1 overflow-y-auto bg-slate-200/90 p-3 sm:p-6 rounded-xl border border-slate-700/50 shadow-inner"
                    style={{ minHeight: isFullscreen ? '78vh' : '65vh' }}
                >
                    <RekapitulasiNaratifContent 
                        profile={profile}
                        reportPeriodLabel={reportPeriodLabel}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        entries={entries}
                        rekap={rekap}
                        keliang={keliang}
                        setKeliang={setKeliang}
                        isEditingKeliang={isEditingKeliang}
                        setIsEditingKeliang={setIsEditingKeliang}
                        juruRaksa={juruRaksa}
                        setJuruRaksa={setJuruRaksa}
                        isEditingJuruRaksa={isEditingJuruRaksa}
                        setIsEditingJuruRaksa={setIsEditingJuruRaksa}
                        penyarikan={penyarikan}
                        setPenyarikan={setPenyarikan}
                        isEditingPenyarikan={isEditingPenyarikan}
                        setIsEditingPenyarikan={setIsEditingPenyarikan}
                        pengawas={pengawas}
                        setPengawas={setPengawas}
                        isEditingPengawas={isEditingPengawas}
                        setIsEditingPengawas={setIsEditingPengawas}
                        customPlace={customPlace}
                        formattedSignDate={formattedSignDate}
                        showStamp={showStamp}
                        stampScaleVal={stampScaleVal}
                        effectiveStamp={effectiveStamp}
                        embedSignatures={embedSignatures}
                        signatures={signatures}
                        sigScale={sigScale}
                    />
                </div>

                {/* FOOTER CONTROLS: TTD, STEMPEL, PDF, CETAK */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-700 bg-slate-900/60 p-3 rounded-xl no-print">
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-teal-300 font-mono cursor-pointer">
                            <input
                                type="checkbox"
                                checked={embedSignatures}
                                onChange={e => setEmbedSignatures(e.target.checked)}
                                className="rounded border-slate-600 text-teal-600 focus:ring-teal-500"
                            />
                            <span>Sematkan TTD</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs text-rose-300 font-mono cursor-pointer ml-1">
                            <input
                                type="checkbox"
                                checked={showStamp}
                                onChange={e => handleToggleStamp(e.target.checked)}
                                className="rounded border-rose-600 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="flex items-center gap-1">
                                <Stamp className="w-3.5 h-3.5 text-rose-400" /> Stempel Keliang
                            </span>
                        </label>

                        {/* Signature Zoom / Scale Adjuster */}
                        {embedSignatures && (
                            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
                                <span className="text-[10px] font-mono text-slate-400 px-1 font-bold">Skala TTD:</span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustScale(-10)}
                                    disabled={sigScale <= 50}
                                    className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 rounded transition cursor-pointer"
                                    title="Perkecil Tanda Tangan"
                                >
                                    <ZoomOut size={13} />
                                </button>
                                <span className="text-[11px] font-mono font-bold text-teal-300 w-9 text-center">
                                    {sigScale}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustScale(10)}
                                    disabled={sigScale >= 180}
                                    className="p-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-200 rounded transition cursor-pointer"
                                    title="Perbesar Tanda Tangan"
                                >
                                    <ZoomIn size={13} />
                                </button>
                            </div>
                        )}

                        {/* Stamp Zoom / Scale Adjuster */}
                        {showStamp && (
                            <div className="flex items-center gap-1 bg-rose-950/40 border border-rose-900/60 rounded-lg p-1 text-xs">
                                <span className="text-[10px] font-mono text-rose-300 px-1 font-bold">Stempel:</span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustStampScale(-10)}
                                    disabled={stampScaleVal <= 50}
                                    className="p-1 bg-rose-900/60 hover:bg-rose-800 disabled:opacity-30 text-rose-200 rounded transition cursor-pointer"
                                    title="Perkecil Stempel"
                                >
                                    <ZoomOut size={13} />
                                </button>
                                <span className="text-[11px] font-mono font-bold text-rose-300 w-9 text-center">
                                    {stampScaleVal}%
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustStampScale(10)}
                                    disabled={stampScaleVal >= 180}
                                    className="p-1 bg-rose-900/60 hover:bg-rose-800 disabled:opacity-30 text-rose-200 rounded transition cursor-pointer"
                                    title="Perbesar Stempel"
                                >
                                    <ZoomIn size={13} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <ExportPdfButton
                            elementId="printable-rekap-naratif"
                            filename={`Narasi_LRA_Kas_${currentYearStr}_${selectedMonth || 'THN'}.pdf`}
                            buttonText="Ekspor PDF"
                            variant="compact"
                            options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                        />

                        <button
                            type="button"
                            onClick={handlePrintNaratif}
                            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow cursor-pointer active:scale-95"
                        >
                            <Printer size={15} /> Cetak Narasi
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default RekapitulasiNaratifTemplateModal;
