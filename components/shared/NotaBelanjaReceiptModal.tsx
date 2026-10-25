import React, { useState, useEffect, useMemo } from 'react';
import type { BkpData, BkuData } from '../../types';
import Modal from './Modal';
import { ExportPdfButton } from './ExportPdfButton';
import { formatCurrency, numberToWords, formatDate } from '../../utils/formatter';
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
import { getPosBelanjaFromTransaction, KATEGORI_BELANJA_OPTIONS, REFERENSI_REKENING } from '../../constants';
import { Printer, Pencil, MessageCircle, ZoomIn, ZoomOut, Stamp, Plus, Trash2, Check } from 'lucide-react';

export interface ReceiptItem {
  id?: string;
  name: string;
  qty: number;
  price: number;
}

interface NotaBelanjaReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: BkpData | BkuData | null;
  titleLabel?: string;
}

export const NotaBelanjaReceiptModal: React.FC<NotaBelanjaReceiptModalProps> = ({
  isOpen,
  onClose,
  entry,
  titleLabel = 'NOTA BELANJA / BUKTI PENGELUARAN KAS'
}) => {
  // Profile settings from localStorage
  const savedProfile = typeof window !== 'undefined' ? localStorage.getItem('basangalas_profile') || localStorage.getItem('village_profile') || localStorage.getItem('tigalikur_profile') : null;
  const profile = useMemo(() => {
    return savedProfile ? JSON.parse(savedProfile) : { namaBendahara: 'I Putu Gede Sutrana', namaKetua: 'I Made Mudita' };
  }, [savedProfile]);

  const [signatures, setSignatures] = useState<DigitalSignatures>({});
  const [embedSignatures, setEmbedSignatures] = useState<boolean>(true);
  const [showStamp, setShowStamp] = useState<boolean>(true);
  const [sigScale, setSigScale] = useState<number>(100);
  const [stampScaleVal, setStampScaleVal] = useState<number>(100);

  // Editable fields for the receipt
  const [keliang, setKeliang] = useState<string | undefined>(undefined);
  const [juruRaksa, setJuruRaksa] = useState<string | undefined>(undefined);
  const [penerimaToko, setPenerimaToko] = useState<string>('Pihak Ketiga / Rekanan');
  const [posBelanja, setPosBelanja] = useState<string>('Belanja Alat Tulis Kantor (ATK)');

  // Items / Sub-items breakdown
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [isEditingItems, setIsEditingItems] = useState<boolean>(false);

  const [isEditingKeliang, setIsEditingKeliang] = useState(false);
  const [isEditingJuruRaksa, setIsEditingJuruRaksa] = useState(false);
  const [isEditingPenerima, setIsEditingPenerima] = useState(false);
  const [isEditingKategori, setIsEditingKategori] = useState(false);

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

  const handleToggleStamp = (val: boolean) => {
    setShowStamp(val);
    setStampOverlayEnabled(val);
  };

  useEffect(() => {
    if (entry) {
      setKeliang(profile.namaKetua || 'I Made Mudita');
      setJuruRaksa(profile.namaBendahara || 'I Putu Gede Sutrana');

      // 1. Akurasi Kategori / Pos Belanja sesuai akun transaksi
      const directAkunName = (entry as any).akunLawanName || (entry as any).namaAkun;
      const targetAkunCode = (entry as any).akunLawanCode || (entry as any).kode;
      const rawKategori = (entry as any).kategori;

      let resolvedKategori = '';
      if (directAkunName && directAkunName !== 'Umum' && !directAkunName.startsWith('1.1')) {
        resolvedKategori = directAkunName;
      } else if (targetAkunCode) {
        const cleanCode = targetAkunCode.split(' - ')[0].trim();
        const refMatch = REFERENSI_REKENING.find(r => r.code === cleanCode);
        if (refMatch) {
          resolvedKategori = refMatch.name;
        }
      }

      if (!resolvedKategori && rawKategori && rawKategori !== 'Umum' && rawKategori !== 'Belanja Operasional / Rutin') {
        resolvedKategori = rawKategori;
      }

      if (!resolvedKategori) {
        resolvedKategori = getPosBelanjaFromTransaction(entry as any);
      }
      setPosBelanja(resolvedKategori);

      // 2. Vendor / Penerima Toko
      let vendor = 'Pihak Ketiga / Rekanan';
      const uraian = entry.uraian || '';
      if (uraian.toLowerCase().includes('kepada ')) {
        vendor = uraian.split(/kepada /i)[1]?.split(/[,;.]/)[0]?.trim() || vendor;
      } else if (uraian.toLowerCase().includes('di ')) {
        vendor = uraian.split(/di /i)[1]?.split(/[,;.]/)[0]?.trim() || vendor;
      } else if (uraian.toLowerCase().includes('toko ')) {
        vendor = ('Toko ' + uraian.split(/toko /i)[1]?.split(/[,;.]/)[0])?.trim() || vendor;
      }
      setPenerimaToko(vendor);

      // 3. Rincian Barang / Jasa (Items breakdown)
      const passedItems = (entry as any).items;
      const passedSubItems = (entry as any).subItems;
      const amountVal = ('kredit' in entry ? entry.kredit : entry.pengeluaran) || 0;

      if (passedItems && Array.isArray(passedItems) && passedItems.length > 0) {
        setItems(passedItems.map((it: any, idx: number) => ({
          id: it.id || (idx + 1).toString(),
          name: it.name || it.itemName || it.uraian || 'Barang / Jasa',
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0
        })));
      } else if (passedSubItems && Array.isArray(passedSubItems) && passedSubItems.length > 0) {
        setItems(passedSubItems.map((sub: any, idx: number) => {
          const match = sub.uraian ? sub.uraian.match(/^(.*?)\s*\(([\d.,]+)\s*x\s*([\d.,]+)\)$/) : null;
          if (match) {
            const q = parseFloat(match[2].replace(/\./g, '').replace(',', '.')) || 1;
            const p = parseFloat(match[3].replace(/\./g, '').replace(',', '.')) || (sub.kredit || sub.debet || 0);
            return {
              id: (idx + 1).toString(),
              name: match[1].trim(),
              qty: q,
              price: p
            };
          }
          return {
            id: (idx + 1).toString(),
            name: sub.uraian || 'Barang / Jasa',
            qty: 1,
            price: sub.kredit || sub.debet || 0
          };
        }));
      } else {
        const match = entry.uraian ? entry.uraian.match(/^(.*?)\s*\(([\d.,]+)\s*x\s*([\d.,]+)\)$/) : null;
        if (match) {
          const q = parseFloat(match[2].replace(/\./g, '').replace(',', '.')) || 1;
          const p = parseFloat(match[3].replace(/\./g, '').replace(',', '.')) || amountVal;
          setItems([{
            id: '1',
            name: match[1].trim(),
            qty: q,
            price: p
          }]);
        } else {
          setItems([{
            id: '1',
            name: entry.uraian || 'Pengeluaran Belanja Kas',
            qty: 1,
            price: amountVal
          }]);
        }
      }

      setIsEditingKeliang(false);
      setIsEditingJuruRaksa(false);
      setIsEditingPenerima(false);
      setIsEditingKategori(false);
      setIsEditingItems(false);
    }
  }, [entry, profile]);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-receipt-mode');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('print-receipt-mode');
    };
  }, []);

  if (!entry) return null;

  // Extract amount and account details
  const amount = ('kredit' in entry ? entry.kredit : entry.pengeluaran) || 0;
  const tanggal = ('tanggal' in entry ? entry.tanggal : '') || '';
  const bukti = ('bukti' in entry ? entry.bukti : ('kode' in entry ? entry.kode : '')) || entry.id;
  const akunCode = (entry as any).akunLawanCode || (entry as any).kode || '';

  // Hitung total dari items jika ada
  const totalFromItems = items.reduce((sum, it) => sum + ((it.qty || 0) * (it.price || 0)), 0);
  const effectiveTotal = items.length > 0 && totalFromItems > 0 ? totalFromItems : amount;

  const receiptNo = bukti ? `NOTA-${bukti}` : `NOTA-${entry.id.slice(-8).toUpperCase()}`;

  const handlePrintReceipt = () => {
    document.body.classList.add('print-receipt-mode');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-receipt-mode');
    }, 1200);
  };

  const handleSendWA = () => {
    let itemsText = '';
    if (items.length > 0) {
      itemsText = '\n*Rincian Barang/Jasa:*\n' + items.map((it, i) => `${i + 1}. ${it.name} (${it.qty} x ${formatCurrency(it.price)}) = ${formatCurrency(it.qty * it.price)}`).join('\n') + '\n';
    }
    const text = `*NOTA BELANJA / BUKTI PENGELUARAN KAS*\nDESA ADAT BASANGALAS - KAS DESA ADAT\n-----------------------------------\n*No. Bukti:* ${receiptNo}\n*Tanggal:* ${formatDate(tanggal)}\n*Dibayarkan Kepada:* ${penerimaToko}\n*Kategori / Pos Belanja:* ${posBelanja}${akunCode ? ` (${akunCode})` : ''}\n*Uraian Belanja:* ${entry.uraian}${itemsText}\n*Total Pengeluaran:* ${formatCurrency(effectiveTotal)}\n*Terbilang:* ${effectiveTotal > 0 ? numberToWords(effectiveTotal) + ' Rupiah' : '-'}\n-----------------------------------\n_Dokumen pengeluaran sah tercatat di Buku Kas Pembantu & BKU._`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const displaySignatureText = (val?: string, defaultVal?: string) => {
    if (val === undefined || val === null) return defaultVal || '......................';
    if (val.trim() === '' || val === '-') return '......................';
    return val;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleLabel}
      className="max-w-2xl"
    >
      <style>{`
        @media print {
          @page {
            size: A5 portrait;
            margin: 3mm 5mm;
          }
          body.print-receipt-mode {
            background-color: #ffffff !important;
          }
          body.print-receipt-mode * {
            visibility: hidden;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja,
          body.print-receipt-mode #printable-receipt-nota-belanja * {
            visibility: visible !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 2.5mm 3.5mm !important;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 99999999 !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          body.print-receipt-mode .no-print,
          body.print-receipt-mode .no-print * {
            display: none !important;
          }
          /* Header Kop Surat */
          body.print-receipt-mode #printable-receipt-nota-belanja .kop-header {
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 2px !important;
            margin-bottom: 3px !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .kop-title {
            font-size: 10.5pt !important;
            line-height: 1.15 !important;
            margin: 0 !important;
            font-weight: 900 !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .kop-sub {
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
            margin: 1px 0 !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .kop-address {
            font-size: 7pt !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }
          /* Document Title */
          body.print-receipt-mode #printable-receipt-nota-belanja .doc-title-box {
            margin-bottom: 3px !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .doc-title {
            font-size: 8.5pt !important;
            line-height: 1.15 !important;
            margin: 0 !important;
            font-weight: 900 !important;
            letter-spacing: 0.04em !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .doc-no {
            font-size: 7pt !important;
            line-height: 1.1 !important;
            margin-top: 1px !important;
          }
          /* Details Box */
          body.print-receipt-mode #printable-receipt-nota-belanja .details-box {
            border: 1px solid #000000 !important;
            padding: 3px 5px !important;
            margin-bottom: 3px !important;
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
            background: transparent !important;
            border-radius: 0 !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .details-box .grid {
            gap: 1px !important;
          }
          /* Table Rincian Barang / Jasa */
          body.print-receipt-mode #printable-receipt-nota-belanja table.receipt-items-table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1px solid #000000 !important;
            font-size: 7.2pt !important;
            line-height: 1.15 !important;
            margin-top: 2px !important;
            margin-bottom: 2px !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja table.receipt-items-table th,
          body.print-receipt-mode #printable-receipt-nota-belanja table.receipt-items-table td {
            border: 1px solid #000000 !important;
            padding: 1.5px 3.5px !important;
            font-size: 7.2pt !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja table.receipt-items-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .terbilang-box {
            font-size: 7pt !important;
            line-height: 1.2 !important;
            margin-top: 2px !important;
            padding-top: 2px !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .date-location-text {
            font-size: 7.5pt !important;
            margin-top: 3px !important;
            margin-bottom: 2px !important;
          }
          /* Signatures - Balanced Columns with Flexbox */
          body.print-receipt-mode #printable-receipt-nota-belanja .receipt-signature-section,
          body.print-receipt-mode #printable-receipt-nota-belanja .signature-section {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            width: 100% !important;
            margin: 4px auto 0 auto !important;
            padding: 3px 0 0 0 !important;
            box-sizing: border-box !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .receipt-signature-column {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
            text-align: center !important;
            flex: 1 1 0% !important;
            min-width: 0 !important;
            width: 100% !important;
            padding: 0 1mm !important;
            font-size: 7.5pt !important;
            line-height: 1.15 !important;
            box-sizing: border-box !important;
            position: relative !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .sig-img-container {
            height: 42px !important;
            width: 100% !important;
            margin: 2px 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: relative !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .signature-img {
            height: 38px !important;
            max-width: 90% !important;
            object-fit: contain !important;
            position: relative !important;
            z-index: 1 !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .stamp-overlay {
            width: 58px !important;
            height: 58px !important;
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-30%, -50%) rotate(-4deg) !important;
            pointer-events: none !important;
            z-index: 2 !important;
            mix-blend-mode: multiply !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .signature-name {
            font-size: 7.8pt !important;
            font-weight: 800 !important;
            text-decoration: underline !important;
            text-transform: uppercase !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            max-width: 100% !important;
            display: inline-block !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .signature-role-sub {
            font-size: 6.8pt !important;
            color: #475569 !important;
            margin-top: 1px !important;
          }
          body.print-receipt-mode #printable-receipt-nota-belanja .footer-note {
            margin-top: 3px !important;
            padding-top: 2px !important;
            font-size: 6.5pt !important;
          }
        }
      `}</style>
      <div className="space-y-2">
        {/* Printable Area Wrapper (A5 Optimized) */}
        <div
          id="printable-receipt-nota-belanja"
          className="bg-white text-slate-900 p-5 sm:p-6 rounded-xl border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0"
        >
          {/* Kop Surat Header */}
          <div className="kop-header text-center border-b-2 sm:border-b-4 border-double border-slate-900 pb-2 mb-3">
            <h2 className="kop-title text-base sm:text-lg font-black uppercase tracking-wider text-slate-900 font-serif m-0">
              DESA ADAT BASANGALAS
            </h2>
            <p className="kop-sub text-[11px] sm:text-xs font-bold text-slate-800 tracking-widest my-0.5">
              Tata Kelola Keuangan Desa Adat
            </p>
            <p className="kop-address text-[9px] sm:text-[10px] font-semibold text-slate-600 font-serif m-0">
              Jl. Raya Basangalas, Tribuana, Abang, Karangasem - Bali
            </p>
          </div>

          {/* Document Title */}
          <div className="doc-title-box text-center mb-3">
            <h3 className="doc-title text-xs sm:text-sm font-black uppercase tracking-widest text-slate-900 underline font-serif m-0">
              NOTA BELANJA / BUKTI PENGELUARAN KAS
            </h3>
            <p className="doc-no text-[9px] sm:text-[10px] font-bold text-slate-500 font-mono mt-0.5">
              NO. BUKTI: {receiptNo}
            </p>
          </div>

          {/* Main Details Box */}
          <div className="details-box border border-slate-300 rounded-lg p-3 bg-slate-50/70 text-slate-800 text-[11px] sm:text-xs space-y-1.5 print:bg-white print:border-slate-800 print:p-1.5">
            <div className="grid grid-cols-12 gap-1 items-baseline">
              <div className="col-span-4 font-semibold text-slate-600">Tanggal Belanja / Bayar</div>
              <div className="col-span-8 font-bold text-slate-900">: {formatDate(tanggal)}</div>
            </div>
            <div className="grid grid-cols-12 gap-1 items-baseline">
              <div className="col-span-4 font-semibold text-slate-600">Dibayarkan Kepada</div>
              <div className="col-span-8 font-bold text-slate-900 uppercase">
                {isEditingPenerima ? (
                  <div className="flex items-center gap-1.5 no-print">
                    <input
                      type="text"
                      value={penerimaToko}
                      onChange={e => setPenerimaToko(e.target.value)}
                      className="bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 flex-1 focus:outline-none"
                      onKeyDown={e => { if (e.key === 'Enter') setIsEditingPenerima(false); }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingPenerima(false)}
                      className="px-2 py-0.5 bg-teal-600 text-white rounded text-[11px] font-bold"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span>: {penerimaToko}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingPenerima(true)}
                      className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100 transition-opacity"
                      title="Ubah Penerima / Toko"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-1 items-baseline">
              <div className="col-span-4 font-semibold text-slate-600">Kategori / Pos Belanja</div>
              <div className="col-span-8 font-semibold text-slate-900">
                {isEditingKategori ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full no-print">
                    <input
                      type="text"
                      value={posBelanja}
                      onChange={e => setPosBelanja(e.target.value)}
                      placeholder="Pos belanja..."
                      className="bg-white border border-teal-500 rounded px-2 py-0.5 text-xs font-bold text-slate-900 flex-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      onKeyDown={e => { if (e.key === 'Enter') setIsEditingKategori(false); }}
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      <select
                        onChange={e => {
                          if (e.target.value) {
                            setPosBelanja(e.target.value);
                            setIsEditingKategori(false);
                          }
                        }}
                        className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="">Pilih Pos Belanja...</option>
                        {KATEGORI_BELANJA_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsEditingKategori(false)}
                        className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-[11px] font-bold"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group flex-wrap">
                    <span className="font-bold text-slate-900">: {posBelanja}</span>
                    {akunCode && (
                      <span className="font-mono text-[9.5px] bg-slate-200/90 text-slate-800 font-bold px-1.5 py-0.2 rounded border border-slate-300 print:border-slate-800">
                        [{akunCode}]
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingKategori(true)}
                      className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100 transition-opacity"
                      title="Ubah Kategori / Pos Belanja"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-1 items-baseline">
              <div className="col-span-4 font-semibold text-slate-600">Uraian / Keperluan</div>
              <div className="col-span-8 font-semibold text-slate-900 leading-tight">: {entry.uraian}</div>
            </div>
          </div>

          {/* Table Rincian Barang / Jasa (Requested Feature) */}
          <div className="my-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10.5px] sm:text-[11px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
                <span>Rincian Barang / Jasa</span>
                <span className="text-slate-500 font-normal text-[10px]">({items.length} item)</span>
              </span>
              <div className="flex items-center gap-1 no-print">
                <button
                  type="button"
                  onClick={() => setIsEditingItems(!isEditingItems)}
                  className="text-[10px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Pencil size={10} />
                  <span>{isEditingItems ? 'Selesai Edit' : 'Edit Rincian'}</span>
                </button>
                {isEditingItems && (
                  <button
                    type="button"
                    onClick={() => {
                      setItems([...items, { id: (items.length + 1).toString(), name: '', qty: 1, price: 0 }]);
                    }}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <Plus size={10} />
                    <span>Tambah Baris</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="receipt-items-table w-full border-collapse border border-slate-800 text-slate-900 text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-800 text-center font-bold text-[9.5px] sm:text-[10px] text-slate-800">
                    <th className="border border-slate-800 py-1 px-1 text-center w-7">No</th>
                    <th className="border border-slate-800 py-1 px-2 text-left">Nama Barang / Jasa</th>
                    <th className="border border-slate-800 py-1 px-1 text-center w-12">Banyaknya</th>
                    <th className="border border-slate-800 py-1 px-2 text-right w-24 sm:w-28">Harga Satuan (Rp)</th>
                    <th className="border border-slate-800 py-1 px-2 text-right w-28 sm:w-32">Jumlah (Rp)</th>
                    {isEditingItems && (
                      <th className="border border-slate-800 py-1 px-1 w-8 text-center no-print">Hapus</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="border border-slate-800 py-0.5 px-1 text-center font-medium">{idx + 1}</td>
                      <td className="border border-slate-800 py-0.5 px-2 font-semibold">
                        {isEditingItems ? (
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => {
                              const next = [...items];
                              next[idx].name = e.target.value;
                              setItems(next);
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="Nama barang / jasa..."
                          />
                        ) : (
                          item.name || '-'
                        )}
                      </td>
                      <td className="border border-slate-800 py-0.5 px-1 text-center font-medium">
                        {isEditingItems ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.qty}
                            onChange={e => {
                              const next = [...items];
                              next[idx].qty = parseFloat(e.target.value) || 0;
                              setItems(next);
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        ) : (
                          item.qty
                        )}
                      </td>
                      <td className="border border-slate-800 py-0.5 px-2 text-right font-mono">
                        {isEditingItems ? (
                          <input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={e => {
                              const next = [...items];
                              next[idx].price = parseFloat(e.target.value) || 0;
                              setItems(next);
                            }}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        ) : (
                          formatCurrency(item.price)
                        )}
                      </td>
                      <td className="border border-slate-800 py-0.5 px-2 text-right font-mono font-bold">
                        {formatCurrency((item.qty || 0) * (item.price || 0))}
                      </td>
                      {isEditingItems && (
                        <td className="border border-slate-800 py-0.5 px-1 text-center no-print">
                          <button
                            type="button"
                            onClick={() => {
                              const next = items.filter((_, i) => i !== idx);
                              setItems(next.length > 0 ? next : [{ id: '1', name: '', qty: 1, price: 0 }]);
                            }}
                            className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 transition-colors"
                            title="Hapus baris"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-[10px] sm:text-[11px]">
                    <td colSpan={4} className="border border-slate-800 py-1 px-2 text-right uppercase tracking-wider font-bold text-slate-800">
                      Total Pengeluaran:
                    </td>
                    <td className="border border-slate-800 py-1 px-2 text-right font-mono text-rose-800 print:text-black font-black">
                      {formatCurrency(effectiveTotal)}
                    </td>
                    {isEditingItems && <td className="border border-slate-800 no-print"></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Terbilang Box */}
          {effectiveTotal > 0 && (
            <div className="terbilang-box bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-[10px] sm:text-[11px] italic font-semibold text-slate-700 print:bg-transparent print:border-none print:p-0">
              Terbilang: &quot;# {numberToWords(effectiveTotal)} Rupiah #&quot;
            </div>
          )}

          {/* Tempat & Tanggal Pengesahan */}
          <div className="date-location-text text-right text-[10.5px] sm:text-xs font-semibold text-slate-800 mt-2 mb-1 px-1">
            <p>Basangalas, {formatDate(tanggal)}</p>
          </div>

          {/* Signature Section */}
          <div className="signature-section receipt-signature-section break-inside-avoid flex justify-between items-start gap-3 sm:gap-6 pt-3 text-center text-[10px] sm:text-xs text-slate-900 bg-transparent w-full">
            {/* Column 1: Keliang Adat with Official Stamp */}
            <div className="receipt-signature-column flex-1 flex flex-col items-center justify-between min-h-[125px] sm:min-h-[140px] relative bg-transparent px-1">
              <div>
                <p className="font-medium text-[10px] sm:text-[11px] text-slate-700">Mengetahui / Menyetujui,</p>
                <p className="font-bold text-[10px] sm:text-[11px] text-slate-900 mb-0.5">Keliang Adat Basangalas</p>
              </div>
              
              <div 
                className="sig-img-container flex items-center justify-center my-1 transition-all relative w-full bg-transparent"
                style={{ height: `${Math.round(65 * (sigScale / 100))}px` }}
              >
                {/* Official Stempel Desa Adat Overlay */}
                {embedSignatures && showStamp && (
                  <div
                    className="stamp-overlay absolute pointer-events-none select-none flex items-center justify-center transition-all bg-transparent"
                    style={{
                      right: '30%',
                      top: '50%',
                      transform: `translate(-30%, -50%) rotate(-5deg) scale(${stampScaleVal / 100})`,
                      width: '75px',
                      height: '75px',
                      opacity: 0.88,
                      backgroundColor: 'transparent',
                      mixBlendMode: 'multiply',
                      zIndex: 15
                    }}
                    title="Stempel Resmi Desa Adat Basangalas"
                  >
                    <img
                      src={effectiveStamp}
                      alt="Stempel Desa Adat Basangalas"
                      className="stamp-img w-full h-full object-contain filter contrast-125"
                      style={{ backgroundColor: 'transparent' }}
                    />
                  </div>
                )}

                {/* Keliang Signature */}
                {embedSignatures && signatures.keliang ? (
                  <img
                    src={signatures.keliang}
                    alt="TTD Keliang Adat"
                    style={{
                      height: `${Math.round(52 * (sigScale / 100))}px`,
                      maxWidth: `${Math.round(120 * (sigScale / 100))}px`,
                      backgroundColor: 'transparent'
                    }}
                    className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                  />
                ) : (
                  <div style={{ height: `${Math.round(52 * (sigScale / 100))}px` }}></div>
                )}
              </div>

              <div className="relative z-20 bg-transparent w-full text-center">
                {isEditingKeliang ? (
                  <div className="flex items-center gap-1 justify-center">
                    <input
                      type="text"
                      value={keliang !== undefined ? keliang : (profile.namaKetua || '')}
                      onChange={e => setKeliang(e.target.value)}
                      className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-28 focus:outline-none"
                      onBlur={() => setIsEditingKeliang(false)}
                      onKeyDown={e => { if (e.key === 'Enter') setIsEditingKeliang(false); }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1 group">
                    <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-900 block select-text">
                      {displaySignatureText(keliang, profile.namaKetua)}
                    </span>
                    <button
                      onClick={() => setIsEditingKeliang(true)}
                      className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100"
                      title="Edit Nama Keliang"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
                <p className="signature-role-sub text-[9px] text-slate-500 font-medium">Keliang Adat</p>
              </div>
            </div>

            {/* Column 2: Penerima / Toko */}
            <div className="receipt-signature-column flex-1 flex flex-col items-center justify-between min-h-[125px] sm:min-h-[140px] relative bg-transparent px-1">
              <div>
                <p className="font-medium text-[10px] sm:text-[11px] text-slate-700">Yang Menerima,</p>
                <p className="font-bold text-[10px] sm:text-[11px] text-slate-900 mb-0.5">Pihak Toko / Rekanan</p>
              </div>
              
              <div 
                className="sig-img-container flex items-center justify-center my-1 transition-all relative w-full bg-transparent"
                style={{ height: `${Math.round(65 * (sigScale / 100))}px` }}
              >
                {embedSignatures && signatures.penerimaToko ? (
                  <img
                    src={signatures.penerimaToko}
                    alt="TTD Penerima"
                    style={{
                      height: `${Math.round(52 * (sigScale / 100))}px`,
                      maxWidth: `${Math.round(120 * (sigScale / 100))}px`,
                      backgroundColor: 'transparent'
                    }}
                    className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                  />
                ) : (
                  <div style={{ height: `${Math.round(52 * (sigScale / 100))}px` }}></div>
                )}
              </div>

              <div className="relative z-20 bg-transparent w-full text-center">
                {isEditingPenerima ? (
                  <div className="flex items-center gap-1 justify-center">
                    <input
                      type="text"
                      value={penerimaToko}
                      onChange={e => setPenerimaToko(e.target.value)}
                      className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-28 focus:outline-none"
                      onBlur={() => setIsEditingPenerima(false)}
                      onKeyDown={e => { if (e.key === 'Enter') setIsEditingPenerima(false); }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1 group">
                    <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-900 block select-text">
                      {displaySignatureText(penerimaToko, 'Pihak Ketiga / Rekanan')}
                    </span>
                    <button
                      onClick={() => setIsEditingPenerima(true)}
                      className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100"
                      title="Edit Nama Penerima"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
                <p className="signature-role-sub text-[9px] text-slate-500 font-medium">Pihak Rekanan</p>
              </div>
            </div>

            {/* Column 3: Juru Raksa (Bendahara) */}
            <div className="receipt-signature-column flex-1 flex flex-col items-center justify-between min-h-[125px] sm:min-h-[140px] relative bg-transparent px-1">
              <div>
                <p className="font-medium text-[10px] sm:text-[11px] text-slate-700">Lunas Dibayar,</p>
                <p className="font-bold text-[10px] sm:text-[11px] text-slate-900 mb-0.5">Juru Raksa (Bendahara)</p>
              </div>
              
              <div 
                className="sig-img-container flex items-center justify-center my-1 transition-all relative w-full bg-transparent"
                style={{ height: `${Math.round(65 * (sigScale / 100))}px` }}
              >
                {embedSignatures && signatures.juruRaksa ? (
                  <img
                    src={signatures.juruRaksa}
                    alt="TTD Juru Raksa"
                    style={{
                      height: `${Math.round(52 * (sigScale / 100))}px`,
                      maxWidth: `${Math.round(120 * (sigScale / 100))}px`,
                      backgroundColor: 'transparent'
                    }}
                    className="signature-img object-contain pointer-events-none transition-all relative z-10 block"
                  />
                ) : (
                  <div style={{ height: `${Math.round(52 * (sigScale / 100))}px` }}></div>
                )}
              </div>

              <div className="relative z-20 bg-transparent w-full text-center">
                {isEditingJuruRaksa ? (
                  <div className="flex items-center gap-1 justify-center">
                    <input
                      type="text"
                      value={juruRaksa !== undefined ? juruRaksa : (profile.namaBendahara || '')}
                      onChange={e => setJuruRaksa(e.target.value)}
                      className="bg-white border border-teal-500 rounded px-1 py-0.5 text-[9px] font-bold text-center w-28 focus:outline-none"
                      onBlur={() => setIsEditingJuruRaksa(false)}
                      onKeyDown={e => { if (e.key === 'Enter') setIsEditingJuruRaksa(false); }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1 group">
                    <span className="signature-name font-bold underline uppercase text-[10px] sm:text-[11px] text-slate-900 block select-text">
                      {displaySignatureText(juruRaksa, profile.namaBendahara)}
                    </span>
                    <button
                      onClick={() => setIsEditingJuruRaksa(true)}
                      className="p-0.5 text-teal-600 hover:text-teal-800 no-print opacity-75 group-hover:opacity-100"
                      title="Edit Nama Juru Raksa"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
                <p className="signature-role-sub text-[9px] text-slate-500 font-medium">Juru Raksa (Bendahara)</p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="footer-note mt-3 pt-2 border-t border-slate-200 text-center text-[8.5px] sm:text-[9px] text-slate-500 italic">
            Nota Belanja ini adalah bukti sah pengeluaran kas Desa Adat Basangalas dalam Buku Kas Pembantu (BKP) & BKU.
          </div>
        </div>

        <div className="bg-teal-50 border border-teal-200 p-2 rounded-xl text-[10.5px] font-semibold text-teal-800 no-print flex items-center justify-between">
          <span>*Catatan Cetak: Format telah disesuaikan untuk Kertas A5 Portrait (148 x 210 mm). Pilih ukuran kertas A5 di dialog printer.</span>
        </div>

        {/* Modal Action Controls (No Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-700 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 font-mono cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={embedSignatures}
                onChange={e => setEmbedSignatures(e.target.checked)}
                className="rounded border-slate-600 text-teal-600 focus:ring-teal-500"
              />
              <span>Sematkan TTD</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-rose-800 font-mono cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={showStamp}
                onChange={e => handleToggleStamp(e.target.checked)}
                className="rounded border-rose-600 text-rose-600 focus:ring-rose-500"
              />
              <span className="flex items-center gap-1">
                <Stamp className="w-3.5 h-3.5 text-rose-700" /> Stempel Keliang
              </span>
            </label>

            {/* Signature Zoom / Scale Adjuster */}
            {embedSignatures && (
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
                <span className="text-[10px] font-mono text-slate-400 px-1 font-bold">TTD:</span>
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
                <span className="text-[10px] font-mono text-rose-300 px-1 font-bold">Cap:</span>
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
            <button
              type="button"
              onClick={handleSendWA}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <MessageCircle size={15} /> Kirim WA
            </button>

            <ExportPdfButton
              elementId="printable-receipt-nota-belanja"
              filename={`Nota_Belanja_${bukti || 'BKP'}.pdf`}
              buttonText="Ekspor PDF"
              variant="compact"
              options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
            />
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow cursor-pointer"
            >
              <Printer size={15} /> Cetak Nota (A5)
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

export default NotaBelanjaReceiptModal;
