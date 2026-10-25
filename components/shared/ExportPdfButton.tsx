import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Layout, Check, Download, FileCheck, ShieldCheck, Stamp } from 'lucide-react';
import { exportElementToPdf, PdfExportOptions } from '../../utils/pdfExport';
import { useNotification } from '../../context/NotificationContext';
import Modal from './Modal';

interface ExportPdfButtonProps {
  elementId: string;
  filename?: string;
  options?: PdfExportOptions;
  buttonText?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'compact';
  defaultOrientation?: 'portrait' | 'landscape';
  showModal?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideButton?: boolean;
  onExportSuccess?: (filename: string) => void;
}

export const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({
  elementId,
  filename = 'Laporan_Keuangan_Desa.pdf',
  options = {} as PdfExportOptions,
  buttonText = 'Ekspor PDF',
  className = '',
  variant = 'default',
  defaultOrientation,
  showModal = true,
  isOpen,
  onOpenChange,
  hideButton = false,
  onExportSuccess
}) => {
  const { showNotification } = useNotification();
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = isOpen !== undefined ? isOpen : internalModalOpen;

  const setModalOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    setInternalModalOpen(open);
  };
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    defaultOrientation || options?.orientation || 'landscape'
  );
  const [exportFilename, setExportFilename] = useState(filename);
  const [enableWatermark, setEnableWatermark] = useState<boolean>(
    options?.enableWatermark !== false
  );
  const [watermarkText, setWatermarkText] = useState<string>(
    options?.watermarkText || 'Desa TigaLikur'
  );
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setExportFilename(filename);
  }, [filename]);

  useEffect(() => {
    if (defaultOrientation) {
      setOrientation(defaultOrientation);
    } else if (options?.orientation) {
      setOrientation(options.orientation);
    }
  }, [defaultOrientation, options?.orientation]);

  const handleTriggerClick = () => {
    if (showModal) {
      setModalOpen(true);
    } else {
      executeDownload(orientation, exportFilename, enableWatermark, watermarkText);
    }
  };

  const executeDownload = async (
    targetOrientation: 'portrait' | 'landscape',
    nameToUse: string,
    useWatermark: boolean,
    wmText: string
  ) => {
    setIsExporting(true);
    const finalFilename = nameToUse.endsWith('.pdf') ? nameToUse : `${nameToUse}.pdf`;
    try {
      const success = await exportElementToPdf(elementId, {
        ...options,
        filename: nameToUse,
        orientation: targetOrientation,
        enableWatermark: useWatermark,
        watermarkText: wmText
      });
      setModalOpen(false);
      
      if (success !== false) {
        showNotification(
          `Ekspor PDF Berhasil! Dokumen "${finalFilename}" telah siap diunduh.`,
          'success'
        );
        if (onExportSuccess) {
          onExportSuccess(finalFilename);
        }
      } else {
        showNotification(
          `Sistem pencetakan diaktifkan untuk file "${finalFilename}".`,
          'info'
        );
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      showNotification('Gagal mengekspor dokumen PDF. Silakan coba lagi.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeDownload(orientation, exportFilename, enableWatermark, watermarkText);
  };

  let baseStyle = 'flex items-center gap-2 font-black transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  
  if (variant === 'default') {
    baseStyle += ' bg-gray-900/50 hover:bg-rose-700 text-white py-1 px-4 rounded-xl border-2 border-gray-900';
  } else if (variant === 'outline') {
    baseStyle += ' bg-teal-50 hover:bg-rose-100 text-rose-700 py-2 px-3 rounded-xl border border-rose-300';
  } else if (variant === 'secondary') {
    baseStyle += ' bg-slate-800 hover:bg-slate-700 text-rose-400 py-2 px-4 rounded-xl border border-slate-700';
  } else if (variant === 'compact') {
    baseStyle += ' bg-transparent hover:bg-rose-600 text-gray-950 font-bold py-2 px-3 border-2 border-gray-400 rounded-lg text-xs';
  }

  return (  
    <>
      {!hideButton && (
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={isExporting}
          className={`${baseStyle} ${className}`}
          title="Atur Orientasi Halaman & Unduh Laporan PDF"
        >
          {isExporting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs uppercase tracking-wider font-mono">Memproses PDF...</span>
            </>
          ) : (
            <>
              <FileText size={16} />
              <span className="text-xs uppercase tracking-wider font-mono">{buttonText}</span>
              <span className="bg-rose-800/40 text-rose-100 text-[10px] px-1.5 py-0.5 rounded uppercase font-sans font-bold border border-rose-400/30 ml-1">
                {orientation === 'portrait' ? 'Potret' : 'Lanskap'}
              </span>
            </>
          )}
        </button>
      )}

      {/* PDF Export Modal with Orientation Selection */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isExporting && setModalOpen(false)}
        title="Konfigurasi & Ekspor Dokumen PDF"
        className="max-w-xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
              1. Pilih Orientasi Halaman
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Pilih format tampilan halaman yang sesuai dengan jumlah kolom data laporan Anda.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Portrait Option */}
              <div
                onClick={() => setOrientation('portrait')}
                className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col justify-between relative ${
                  orientation === 'portrait'
                    ? 'border-rose-600 bg-rose-50/60 shadow-md ring-2 ring-rose-500/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {orientation === 'portrait' && (
                  <div className="absolute top-3 right-3 bg-rose-600 text-white p-1 rounded-full">
                    <Check size={14} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-8 border-2 border-rose-600 bg-white rounded flex items-center justify-center text-[9px] font-bold text-rose-600 shadow-sm">
                      A4
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Potret (Portrait)</h4>
                      <span className="text-[10px] font-mono font-semibold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        Vertikal (210 × 297 mm)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mt-2">
                    Cocok untuk ringkasan eksekutif, neraca, laporan arus kas, serta tabel vertikal standar.
                  </p>
                </div>
              </div>

              {/* Landscape Option */}
              <div
                onClick={() => setOrientation('landscape')}
                className={`cursor-pointer rounded-2xl p-4 border-2 transition-all flex flex-col justify-between relative ${
                  orientation === 'landscape'
                    ? 'border-rose-600 bg-rose-50/60 shadow-md ring-2 ring-rose-500/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {orientation === 'landscape' && (
                  <div className="absolute top-3 right-3 bg-rose-600 text-white p-1 rounded-full">
                    <Check size={14} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-6 border-2 border-rose-600 bg-white rounded flex items-center justify-center text-[9px] font-bold text-rose-600 shadow-sm">
                      A4
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Lanskap (Landscape)</h4>
                      <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        Horizontal (297 × 210 mm)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed mt-2">
                    Cocok untuk Buku Kas Umum (BKU), Buku Kas Pembantu (BKP), Jurnal Umum, &amp; tabel berelement lebar.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Segmented Control Switcher */}
            <div className="mt-4 flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  orientation === 'portrait'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText size={14} />
                <span>Modus Potret (Vertikal)</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  orientation === 'landscape'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layout size={14} />
                <span>Modus Lanskap (Horizontal)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
              2. Nama File Dokumen PDF
            </label>
            <input
              type="text"
              value={exportFilename}
              onChange={(e) => setExportFilename(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm"
              placeholder="Masukkan nama file..."
              required
            />
          </div>

          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stamp className="text-amber-700" size={18} />
                <label className="text-xs font-black text-amber-900 uppercase tracking-wider">
                  3. Watermark Otentikasi Dokumen
                </label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableWatermark}
                  onChange={(e) => setEnableWatermark(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <p className="text-xs text-amber-800 leading-relaxed">
              Menambahkan watermark transparan latar belakang pada cetakan PDF untuk otentikasi dan perlindungan dokumen keuangan resmi desa adat.
            </p>

            {enableWatermark && (
              <div className="pt-2 space-y-2 border-t border-amber-200/60">
                <label className="block text-[11px] font-bold text-amber-900 uppercase">
                  Teks Watermark:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="Contoh: Desa TigaLikur"
                  />
                  <button
                    type="button"
                    onClick={() => setWatermarkText('Desa TigaLikur')}
                    className="px-2.5 py-1.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-300 hover:bg-amber-200"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-amber-700 pt-1 font-mono">
                  <ShieldCheck size={12} className="text-amber-600" />
                  <span>Preview Watermark: <strong className="uppercase border-b border-dashed border-amber-600 font-serif tracking-widest px-1">{watermarkText || 'DESA TIGALIKUR'}</strong></span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center gap-3">
            <FileCheck className="text-rose-600 shrink-0" size={20} />
            <p className="text-xs text-slate-700 font-medium">
              Dokumen akan diproses dengan orientasi{' '}
              <strong className="text-rose-700 uppercase font-black">
                {orientation === 'portrait' ? 'Potret (Vertikal)' : 'Lanskap (Horizontal)'}
              </strong>
              {enableWatermark ? (
                <> dan watermark otentikasi <strong className="text-amber-700 font-black">'{watermarkText || 'Desa TigaLikur'}'</strong>.</>
              ) : (
                <> tanpa watermark.</>
              )}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={isExporting}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isExporting}
              className="flex-2 px-8 py-3 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-sm disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>MEMPROSES METADATA PDF...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>UNDUH PDF ({orientation === 'portrait' ? 'POTRET' : 'LANSKAP'})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ExportPdfButton;
