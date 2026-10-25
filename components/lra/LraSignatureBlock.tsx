import React, { useState, useEffect, useMemo } from 'react';
import { 
  getStoredSignatures, 
  getSignatureSettings,
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  setStampScale,
  setStampOverlayEnabled,
  type DigitalSignatures,
  type SignatureSettings
} from '../../utils/signatureStorage';
import { formatLongDate } from '../../utils/formatter';

export interface LraSignatureBlockProps {
  keliangName: string;
  juruRaksaName: string;
  customPlace?: string;
  signatureDate?: string;
  keliangTitle?: string;
  keliangSubtitle?: string;
  juruRaksaTitle?: string;
  juruRaksaSubtitle?: string;
  keliangActionText?: string;
  className?: string;
  namaDesa?: string;
  showStatusIndicator?: boolean;
  showQuickControls?: boolean;
  onOpenSettings?: () => void;
}

export const LraSignatureBlock: React.FC<LraSignatureBlockProps> = ({
  keliangName,
  juruRaksaName,
  customPlace = 'Basangalas',
  signatureDate = new Date().toISOString().split('T')[0],
  keliangTitle = 'Keliang Adat Basangalas',
  keliangSubtitle = 'Penanggung Jawab Umum',
  juruRaksaTitle = 'Juru Raksa',
  juruRaksaSubtitle = 'Pengelola & Pembukuan Kas',
  keliangActionText = 'Mengetahui,',
  className = '',
  namaDesa = 'DESA ADAT BASANGALAS',
  showStatusIndicator = false,
  showQuickControls = true,
  onOpenSettings
}) => {
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [sigSettings, setSigSettings] = useState<SignatureSettings>(() => getSignatureSettings());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStamp, setShowStamp] = useState<boolean>(() => isStampOverlayEnabled());

  useEffect(() => {
    const handleUpdate = () => {
      setSignatures(getStoredSignatures());
      setSigSettings(getSignatureSettings());
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
    };

    window.addEventListener('signatures-updated', handleUpdate);
    return () => window.removeEventListener('signatures-updated', handleUpdate);
  }, []);

  const effectiveStamp = useMemo(() => {
    return getEffectiveStamp(signatures, namaDesa);
  }, [signatures, namaDesa]);

  const formattedSigDate = useMemo(() => {
    if (!signatureDate) {
      return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const formatted = formatLongDate(signatureDate);
    return formatted !== '-' ? formatted : signatureDate;
  }, [signatureDate]);

  const handleAdjustStampScale = (delta: number) => {
    const currentScale = sigSettings.stampScale || 100;
    const newScale = Math.max(50, Math.min(200, currentScale + delta));
    setStampScale(newScale);
    setSigSettings(getSignatureSettings());
    window.dispatchEvent(new Event('signatures-updated'));
  };

  const handleResetStampScale = () => {
    setStampScale(100);
    setSigSettings(getSignatureSettings());
    window.dispatchEvent(new Event('signatures-updated'));
  };

  return (
    <div className={`break-inside-avoid relative ${className}`}>
      {/* On-screen Quick Adjuster for Stamp Scale & Settings (Screen-only, hidden in print) */}
      {showQuickControls && (
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 shadow-2xs">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-slate-600">Skala Stempel:</span>
            <button
              type="button"
              onClick={() => handleAdjustStampScale(-5)}
              className="w-5 h-5 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-200 rounded text-slate-800 text-xs font-bold active:scale-95 transition-all"
              title="Perkecil Ukuran Stempel (-5%)"
            >
              -
            </button>
            <span className="font-mono text-teal-800 px-1 font-black">
              {sigSettings.stampScale || 100}%
            </span>
            <button
              type="button"
              onClick={() => handleAdjustStampScale(5)}
              className="w-5 h-5 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-200 rounded text-slate-800 text-xs font-bold active:scale-95 transition-all"
              title="Perbesar Ukuran Stempel (+5%)"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleResetStampScale}
              className="text-[10px] text-slate-500 hover:text-slate-800 underline ml-1"
              title="Kembalikan ke Skala Standar 100%"
            >
              Reset
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-1 text-[10px] text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showStamp}
                onChange={(e) => {
                  setStampOverlayEnabled(e.target.checked);
                  setShowStamp(e.target.checked);
                  window.dispatchEvent(new Event('signatures-updated'));
                }}
                className="rounded text-rose-600 w-3.5 h-3.5 cursor-pointer accent-rose-600"
              />
              <span className="font-medium">Stempel Resmi</span>
            </label>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-[10px] text-teal-700 hover:text-teal-900 font-bold hover:underline"
              >
                Pengaturan TTD...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Baris Tanggal & Lokasi Penetapan (Right-Aligned) */}
      <div className="flex justify-end mb-4 text-xs text-slate-700">
        <div className="text-right">
          <p>Ditetapkan di: <span className="font-bold text-slate-900">{customPlace}</span></p>
          <p>Pada Tanggal: <span className="font-bold text-slate-900">{formattedSigDate}</span></p>
        </div>
      </div>

      {/* Grid 2 Kolom: Keliang Adat (Kiri) & Juru Raksa (Kanan) */}
      <div className="grid grid-cols-2 gap-6 text-center text-xs sm:text-sm text-slate-900 font-serif">
        {/* Sisi Kiri: Mengetahui Keliang Adat */}
        <div className="space-y-1">
          <p className="not-italic text-slate-700">{keliangActionText}</p>
          <p className="font-bold text-slate-950 text-sm sm:text-base relative z-10">{keliangTitle}</p>
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
          <p className="font-bold text-slate-950 text-sm sm:text-base">{juruRaksaTitle}</p>
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
  );
};

export default LraSignatureBlock;
