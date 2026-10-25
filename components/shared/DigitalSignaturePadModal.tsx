import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, Upload, RotateCcw, Trash2, Check, X, 
  Image as ImageIcon, Download, Sparkles, ShieldCheck, Loader2
} from 'lucide-react';
import Modal from './Modal';
import { optimizeSignatureDataUrl } from '../../utils/signatureStorage';

interface DigitalSignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  title?: string;
  roleName?: string;
  initialSignature?: string;
}

export const DigitalSignaturePadModal: React.FC<DigitalSignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title = 'Tanda Tangan Digital',
  roleName = 'Pejabat / Pengurus',
  initialSignature
}) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'upload'>('draw');
  
  // Canvas states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState<string>('#0f172a'); // Hitam dokumen
  const [penWidth, setPenWidth] = useState<number>(3);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  // Upload states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize Canvas
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual canvas size in memory
    const displayWidth = rect.width || 480;
    const displayHeight = 220;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;

    // Clear transparent background
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Save initial empty state to history
    try {
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialData]);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'draw') {
      setTimeout(() => {
        initCanvas();
      }, 50);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (isOpen) {
      setUploadedImage(null);
      setHasDrawn(false);
      if (initialSignature) {
        setUploadedImage(initialSignature);
      }
    }
  }, [isOpen, initialSignature]);

  // Update stroke style when color/width changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
  }, [penColor, penWidth]);

  // Coordinates helper
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      e.preventDefault(); // Prevent scrolling on touch
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.closePath();
    setIsDrawing(false);

    // Save history for undo
    try {
      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory(prev => [...prev.slice(-15), currentState]);
    } catch (e) {
      // ignore
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setHistory([]);
  };

  const handleUndo = () => {
    if (history.length <= 1) {
      handleClear();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previousState = newHistory[newHistory.length - 1];

    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      setHistory(newHistory);
    } else {
      handleClear();
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  // Helper to remove white background from uploaded scanned signatures
  const makeWhiteBackgroundTransparent = async (imgSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 400;
        const maxH = 180;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imgSrc);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        // Convert pixels that are close to white (brightness > 220) to transparent
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          // If light/white paper pixel
          if (r > 215 && g > 215 && b > 215) {
            d[i + 3] = 0; // Alpha transparent
          } else if (r > 190 && g > 190 && b > 190) {
            // Soft blend edge
            d[i + 3] = Math.round(d[i + 3] * 0.3);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imgSrc);
      img.src = imgSrc;
    });
  };

  // Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran berkas gambar maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawResult = event.target?.result as string;
      if (rawResult) {
        setIsProcessing(true);
        try {
          const transparentPng = await makeWhiteBackgroundTransparent(rawResult);
          const optimized = await optimizeSignatureDataUrl(transparentPng, 320, 140);
          setUploadedImage(optimized);
        } catch (err) {
          setUploadedImage(rawResult);
        } finally {
          setIsProcessing(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Crop & convert canvas to transparent PNG data URL
  const getTrimmedCanvasDataUrl = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) { // non-transparent pixel
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return '';

    // Add slight padding around signature
    const padding = 8;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width, maxX + padding);
    maxY = Math.min(height, maxY + padding);

    const trimmedWidth = maxX - minX;
    const trimmedHeight = maxY - minY;

    if (trimmedWidth <= 0 || trimmedHeight <= 0) return '';

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (!trimmedCtx) return canvas.toDataURL('image/png');

    trimmedCtx.drawImage(
      canvas,
      minX, minY, trimmedWidth, trimmedHeight,
      0, 0, trimmedWidth, trimmedHeight
    );

    return trimmedCanvas.toDataURL('image/png');
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      if (activeTab === 'draw') {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) {
          alert('Silakan goreskan tanda tangan pada bidang kanvas terlebih dahulu.');
          setIsProcessing(false);
          return;
        }
        const dataUrl = getTrimmedCanvasDataUrl(canvas);
        if (!dataUrl) {
          alert('Tanda tangan kosong. Silakan gambar tanda tangan Anda.');
          setIsProcessing(false);
          return;
        }
        const optimized = await optimizeSignatureDataUrl(dataUrl, 320, 140);
        onSave(optimized);
        onClose();
      } else {
        if (!uploadedImage) {
          alert('Silakan pilih atau unggah berkas gambar tanda tangan terlebih dahulu.');
          setIsProcessing(false);
          return;
        }
        const optimized = await optimizeSignatureDataUrl(uploadedImage, 320, 140);
        onSave(optimized);
        onClose();
      }
    } catch (err) {
      console.error('Error optimizing signature:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${title} - ${roleName}`}
      className="max-w-xl"
    >
      <div className="space-y-4">
        {/* Tab Selection */}
        <div className="flex border-b border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono transition-colors border-b-2 ${
              activeTab === 'draw'
                ? 'border-teal-500 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PenTool size={15} /> Gambar Langsung (Canvas)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono transition-colors border-b-2 ${
              activeTab === 'upload'
                ? 'border-teal-500 text-teal-400 bg-teal-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload size={15} /> Unggah File Gambar
          </button>
        </div>

        {/* TAB 1: DRAW CANVAS */}
        {activeTab === 'draw' && (
          <div className="space-y-3">
            {/* Toolbar: Color & Width */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-800/80 rounded-lg border border-slate-700 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase">Warna Tinta:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { color: '#0f172a', label: 'Hitam Pekat', bg: 'bg-slate-900' },
                    { color: '#1e3a8a', label: 'Biru Dokumen', bg: 'bg-blue-900' },
                    { color: '#9f1239', label: 'Merah / Ungu Stempel', bg: 'bg-rose-900' },
                    { color: '#064e3b', label: 'Hijau Adat', bg: 'bg-emerald-900' }
                  ].map(c => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setPenColor(c.color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${c.bg} ${
                        penColor === c.color ? 'border-teal-400 scale-110 ring-2 ring-teal-500/50' : 'border-slate-600 hover:scale-105'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase">Ketebalan:</span>
                <div className="flex items-center gap-1">
                  {[
                    { width: 2, label: 'Tipis' },
                    { width: 3.5, label: 'Sedang' },
                    { width: 5, label: 'Tebal' }
                  ].map(w => (
                    <button
                      key={w.width}
                      type="button"
                      onClick={() => setPenWidth(w.width)}
                      className={`px-2 py-1 text-[10px] rounded font-mono font-bold transition ${
                        penWidth === w.width
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas Drawing Area */}
            <div className="relative border-2 border-dashed border-teal-500/40 rounded-xl overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-52 cursor-crosshair touch-none block"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 opacity-60">
                  <PenTool size={28} className="mb-1" />
                  <span className="text-xs font-semibold">Tanda tangani di area ini (Gunakan mouse / jari / stylus)</span>
                </div>
              )}
              <div className="absolute bottom-2 left-3 pointer-events-none text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Area Kanvas Tanda Tangan
              </div>
            </div>

            {/* Canvas Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                >
                  <RotateCcw size={13} /> Batal Goresan
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!hasDrawn}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 text-xs font-medium rounded-lg border border-rose-800/40 transition"
                >
                  <Trash2 size={13} /> Bersihkan Kanvas
                </button>
              </div>

              <div className="text-[10px] text-slate-400 font-mono">
                {hasDrawn ? '✓ Goresan terdeteksi' : 'Belum ada goresan'}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD IMAGE */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-teal-500/50 hover:border-teal-400 bg-slate-800/50 hover:bg-slate-800 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-teal-500/10 rounded-full text-teal-400 group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">
                  Klik untuk memilih file gambar tanda tangan
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Mendukung format PNG transparan, JPG, WEBP, atau SVG (Maks. 5MB)
                </p>
              </div>
            </div>

            {/* Preview of Uploaded Image */}
            {uploadedImage && (
              <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold flex items-center gap-1.5 text-teal-400">
                    <Check size={14} /> Pratinjau Tanda Tangan Terunggah:
                  </span>
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold"
                  >
                    Hapus
                  </button>
                </div>
                <div className="bg-white p-4 rounded-lg flex items-center justify-center min-h-[100px] border border-slate-300">
                  <img
                    src={uploadedImage}
                    alt="Pratinjau Tanda Tangan"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security & Authenticity Notice */}
        <div className="p-3 bg-teal-950/40 border border-teal-800/40 rounded-lg flex items-start gap-2.5 text-[11px] text-teal-200">
          <ShieldCheck size={16} className="text-teal-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Keamanan Tanda Tangan:</span> Tanda tangan digital disimpan aman dan dienkripsi secara lokal. Tanda tangan akan otomatis tersemat pada kwitansi tanda terima dan nota belanja saat dicetak atau diekspor ke PDF.
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-teal-600/30 transition cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Mengoptimalkan...
              </>
            ) : (
              <>
                <Check size={15} /> Simpan Tanda Tangan
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DigitalSignaturePadModal;
