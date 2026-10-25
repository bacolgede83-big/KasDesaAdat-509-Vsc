import React, { useState, useEffect, useMemo } from 'react';
import { 
  getStoredSignatures, 
  isAutoEmbedSignaturesEnabled, 
  isStampOverlayEnabled, 
  getEffectiveStamp, 
  getSignatureScale, 
  getStampScale,
  type DigitalSignatures 
} from '../../utils/signatureStorage';
import { formatLongDate } from '../../utils/formatter';

export interface ReportSignatureBlockProps {
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
}

export const ReportSignatureBlock: React.FC<ReportSignatureBlockProps> = ({
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
  showStatusIndicator = false
}) => {
  const [signatures, setSignatures] = useState<DigitalSignatures>(() => getStoredSignatures());
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(() => isAutoEmbedSignaturesEnabled());
  const [showStamp, setShowStamp] = useState<boolean>(() => isStampOverlayEnabled());
  const [sigScale, setSigScale] = useState<number>(() => getSignatureScale());
  const [stampScaleVal, setStampScaleVal] = useState<number>(() => getStampScale());

  useEffect(() => {
    const handleSigsChanged = () => {
      setSignatures(getStoredSignatures());
      setEmbedSignatures(isAutoEmbedSignaturesEnabled());
      setShowStamp(isStampOverlayEnabled());
      setSigScale(getSignatureScale());
      setStampScaleVal(getStampScale());
    };

    window.addEventListener('signatures-updated', handleSigsChanged);
    return () => window.removeEventListener('signatures-updated', handleSigsChanged);
  }, []);

  const effectiveStamp = useMemo(() => {
    return getEffectiveStamp(signatures, namaDesa);
  }, [signatures, namaDesa]);

  // Scaled dimensions
  const scaleRatio = Math.max(0.5, Math.min(1.8, sigScale / 100));
  const stampRatio = Math.max(0.5, Math.min(1.8, stampScaleVal / 100));

  const sigBoxHeight = Math.max(54, Math.round(62 * scaleRatio));
  const sigImgHeight = Math.round(54 * scaleRatio);
  const sigImgMaxWidth = Math.round(135 * scaleRatio);

  const stampBoxSize = Math.round(86 * stampRatio);

  return (
    <div className={`signature-section flex justify-between items-start pt-2 px-4 sm:px-10 text-slate-900 text-xs font-serif w-full break-inside-avoid relative ${className}`}>
      {/* Optional on-screen automation status helper */}
      {showStatusIndicator && (
        <div className="no-print absolute -top-3 right-4 flex items-center gap-2 text-[9.5px] font-sans">
          <span className={`px-2 py-0.5 rounded-full font-bold border transition-colors ${
            embedSignatures 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}>
            TTD Digital: {embedSignatures ? 'ON' : 'OFF'}
          </span>
          <span className={`px-2 py-0.5 rounded-full font-bold border transition-colors ${
            showStamp 
              ? 'bg-rose-50 text-rose-800 border-rose-300' 
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}>
            Stempel: {showStamp ? 'ON' : 'OFF'}
          </span>
        </div>
      )}

      {/* 1. KELIANG DESA ADAT + STEMPEL RESMI OVERLAY (KIRI) */}
      <div className="text-center w-56 flex flex-col items-center select-text">
        <p className="not-italic leading-tight text-slate-800">
          {keliangActionText}
          <br />
          <strong className="font-bold text-slate-950">{keliangTitle}</strong>
        </p>

        {/* Kotak Tanda Tangan & Stempel */}
        <div 
          className="flex items-center justify-center my-1.5 transition-all relative w-full bg-transparent"
          style={{ minHeight: `${sigBoxHeight}px`, height: `${sigBoxHeight}px` }}
        >
          {/* Stempel Resmi Desa Adat Overlay */}
          {showStamp && (
            <div
              className="stamp-overlay absolute pointer-events-none select-none flex items-center justify-center transition-all bg-transparent z-5"
              style={{
                right: '20%',
                top: '50%',
                transform: `translate(-32%, -50%) rotate(-4deg)`,
                width: `${stampBoxSize}px`,
                height: `${stampBoxSize}px`,
                opacity: 0.88,
                mixBlendMode: 'multiply'
              }}
              title="Stempel Resmi Desa Adat Basangalas"
            >
              <img
                src={effectiveStamp}
                alt="Stempel Resmi Desa Adat"
                className="stamp-img w-full h-full object-contain filter contrast-125 pointer-events-none"
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          )}

          {/* Tanda Tangan Digital Keliang Adat */}
          {embedSignatures && signatures.keliang ? (
            <img
              src={signatures.keliang}
              alt="Tanda Tangan Keliang Adat"
              style={{
                height: `${sigImgHeight}px`,
                maxWidth: `${sigImgMaxWidth}px`,
                backgroundColor: 'transparent'
              }}
              className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
            />
          ) : (
            <div style={{ height: `${sigImgHeight}px` }} className="flex items-center justify-center">
              {!embedSignatures && (
                <span className="text-[9px] text-slate-300 font-sans italic no-print">(Tanda Tangan Manual)</span>
              )}
            </div>
          )}
        </div>

        {/* Nama & Jabatan Keliang */}
        <div className="w-full">
          <p className="font-bold border-b border-slate-900 pb-1 text-slate-950 uppercase tracking-wide">
            {keliangName}
          </p>
          {keliangSubtitle && (
            <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
              {keliangSubtitle}
            </span>
          )}
        </div>
      </div>

      {/* 2. JURU RAKSA / BENDAHARA (KANAN) */}
      <div className="text-center w-56 flex flex-col items-center select-text">
        <p className="not-italic leading-tight text-slate-800">
          {customPlace}, {formatLongDate(signatureDate)}
          <br />
          <strong className="font-bold text-slate-950">{juruRaksaTitle}</strong>
        </p>

        {/* Kotak Tanda Tangan Juru Raksa */}
        <div 
          className="flex items-center justify-center my-1.5 transition-all relative w-full bg-transparent"
          style={{ minHeight: `${sigBoxHeight}px`, height: `${sigBoxHeight}px` }}
        >
          {embedSignatures && signatures.juruRaksa ? (
            <img
              src={signatures.juruRaksa}
              alt="Tanda Tangan Juru Raksa"
              style={{
                height: `${sigImgHeight}px`,
                maxWidth: `${sigImgMaxWidth}px`,
                backgroundColor: 'transparent'
              }}
              className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
            />
          ) : (
            <div style={{ height: `${sigImgHeight}px` }} className="flex items-center justify-center">
              {!embedSignatures && (
                <span className="text-[9px] text-slate-300 font-sans italic no-print">(Tanda Tangan Manual)</span>
              )}
            </div>
          )}
        </div>

        {/* Nama & Jabatan Juru Raksa */}
        <div className="w-full">
          <p className="font-bold border-b border-slate-900 pb-1 text-slate-950 uppercase tracking-wide">
            {juruRaksaName}
          </p>
          {juruRaksaSubtitle && (
            <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
              {juruRaksaSubtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportSignatureBlock;
