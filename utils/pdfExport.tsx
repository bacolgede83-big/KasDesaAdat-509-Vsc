/**
 * Utility for exporting HTML elements / report tables to clean PDF files using html2pdf.js.
 */

declare const html2pdf: any;

export interface PdfExportOptions {
  filename?: string;
  margin?: number | [number, number, number, number];
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter' | 'legal';
  scale?: number;
  watermarkText?: string;
  enableWatermark?: boolean;
}

export const exportElementToPdf = async (
  elementOrId: HTMLElement | string,
  options: PdfExportOptions = {}
): Promise<boolean> => {
  const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;

  if (!element) {
    console.error(`[pdfExport] Element not found: ${elementOrId}`);
    return false;
  }

  const filename = options.filename || 'Laporan_Keuangan_Desa.pdf';
  const orientation = options.orientation || 'landscape';
  const format = options.format || 'a4';
  const margin = options.margin !== undefined ? options.margin : [8, 8, 8, 8];
  const scale = options.scale || 2.5;
  const enableWatermark = options.enableWatermark !== false;
  const watermarkText = options.watermarkText || 'Desa TigaLikur';

  // Calculate printable container width based on paper format & orientation
  // A4 dimensions in mm: portrait = 210mm, landscape = 297mm
  const marginHoriz = Array.isArray(margin) ? (margin[1] + margin[3]) : (margin * 2);
  const paperWidthMm = orientation === 'landscape' ? 297 : 210;
  const targetWidthMm = paperWidthMm - marginHoriz;

  // Create temporary off-screen container for rendering
  const pdfContainer = document.createElement('div');
  pdfContainer.style.position = 'fixed';
  pdfContainer.style.left = '-9999px';
  pdfContainer.style.top = '0';
  pdfContainer.style.width = `${targetWidthMm}mm`;
  pdfContainer.style.backgroundColor = '#ffffff';
  pdfContainer.style.color = '#0f172a';
  pdfContainer.style.boxSizing = 'border-box';
  pdfContainer.style.padding = '0px';
  pdfContainer.style.margin = '0px';
  pdfContainer.style.zIndex = '-9999';

  // Clone target element
  const clone = element.cloneNode(true) as HTMLElement;

  // Prepare clone styling
  clone.classList.remove('hidden');
  clone.classList.add('html2pdf-printing');
  if (orientation === 'portrait') {
    clone.classList.add('html2pdf-printing-portrait');
  } else {
    clone.classList.add('html2pdf-printing-landscape');
  }
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.style.width = '100%';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.boxSizing = 'border-box';
  clone.style.padding = '10px';
  clone.style.margin = '0';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#0f172a';

  // Remove any elements marked with no-print
  const noPrintEls = clone.querySelectorAll('.no-print');
  noPrintEls.forEach((el) => el.remove());

  // Unhide printable elements that had hidden class or print-only styles for web view
  const allHiddenEls = clone.querySelectorAll('.hidden, [style*="display: none"], [style*="visibility: hidden"]');
  allHiddenEls.forEach((el: any) => {
    if (!el.classList.contains('no-print')) {
      el.classList.remove('hidden');
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      if (el.classList.contains('print:flex') || el.classList.contains('signature-section') || el.classList.contains('flex')) {
        el.style.display = 'flex';
      } else if (el.tagName === 'TR') {
        el.style.display = 'table-row';
      } else if (el.tagName === 'TD' || el.tagName === 'TH') {
        el.style.display = 'table-cell';
      } else {
        el.style.display = 'block';
      }
    }
  });

  // Helper to sanitize element styles for a pristine white-background PDF
  const isSignatureOrStampElement = (node: HTMLElement): boolean => {
    if (!node) return false;
    const tagName = node.tagName.toUpperCase();
    if (tagName === 'IMG') return true;
    const classList = node.classList ? Array.from(node.classList) : [];
    if (classList.some(c => c.includes('signature') || c.includes('sig-') || c.includes('stamp') || c.includes('stempel') || c.includes('sigScale'))) {
      return true;
    }
    const title = (node.getAttribute('title') || '').toLowerCase();
    if (title.includes('stempel') || title.includes('tanda tangan') || title.includes('ttd')) {
      return true;
    }
    if (node.style.position === 'absolute' || (node.closest && (node.closest('.signature-section') || node.closest('[class*="signature"]')))) {
      return true;
    }
    return false;
  };

  const isInlineOrTextElement = (tagName: string): boolean => {
    return ['SPAN', 'P', 'EM', 'STRONG', 'B', 'I', 'SMALL', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'U'].includes(tagName);
  };

  const sanitizeNodeForPdf = (node: HTMLElement) => {
    if (!node || !node.style) return;

    // Remove heavy drop shadows & glow effects
    node.style.boxShadow = 'none';

    const tagName = node.tagName.toUpperCase();
    const isSigOrStamp = isSignatureOrStampElement(node);
    const isText = isInlineOrTextElement(tagName);

    if (tagName === 'IMG') {
      const alt = (node.getAttribute('alt') || '').toLowerCase();
      const isStampImg = alt.includes('stempel') || (node.getAttribute('title') || '').toLowerCase().includes('stempel');
      node.style.visibility = 'visible';
      node.style.display = 'block';
      if (isStampImg) {
        node.style.opacity = '0.88';
        node.style.mixBlendMode = 'multiply';
        node.style.zIndex = '5';
      } else {
        node.style.opacity = '1';
        node.style.position = 'relative';
        node.style.zIndex = '10';
      }
      node.style.backgroundColor = 'transparent';
      return;
    }

    if (isSigOrStamp) {
      // Keep background transparent so it doesn't paint opaque boxes over signatures/stamps/names
      node.style.backgroundColor = 'transparent';
      node.style.visibility = 'visible';
      
      const title = (node.getAttribute('title') || '').toLowerCase();
      const classList = node.classList ? Array.from(node.classList) : [];
      const isStampOverlay = title.includes('stempel') || classList.some(c => c.includes('stamp') || c.includes('stempel'));

      if (isStampOverlay) {
        node.style.opacity = '0.88';
        node.style.mixBlendMode = 'multiply';
        node.style.zIndex = '5';
      } else if (node.style.position === 'relative' || classList.some(c => c.includes('signature') || c.includes('sig-'))) {
        node.style.opacity = '1';
      }

      if (isText) {
        node.style.color = '#0f172a';
        node.style.position = 'relative';
        node.style.zIndex = '20';
      }
      return;
    }

    if (isText) {
      node.style.backgroundColor = 'transparent';
      node.style.color = '#0f172a';
      node.style.visibility = 'visible';
      node.style.opacity = '1';
      return;
    }

    // Preserve print-specific utility overrides
    if (node.classList) {
      if (node.classList.contains('print:bg-white') || node.classList.contains('bg-white')) {
        node.style.backgroundColor = '#ffffff';
      } else if (node.classList.contains('print:bg-slate-100') || node.classList.contains('bg-slate-100')) {
        node.style.backgroundColor = '#f1f5f9';
      }
      if (node.classList.contains('print:text-slate-900') || node.classList.contains('print:text-black') || node.classList.contains('text-black')) {
        node.style.color = '#0f172a';
      } else if (node.classList.contains('print:text-slate-800')) {
        node.style.color = '#1e293b';
      } else if (node.classList.contains('print:text-slate-700')) {
        node.style.color = '#334155';
      } else if (node.classList.contains('print:text-slate-600')) {
        node.style.color = '#475569';
      }
      if (node.classList.contains('print:border-slate-900') || node.classList.contains('print:border-black') || node.classList.contains('border-black')) {
        node.style.borderColor = '#0f172a';
      } else if (node.classList.contains('print:border-slate-300')) {
        node.style.borderColor = '#cbd5e1';
      }
    }

    // Table headers & footers formatting
    const isHeaderCell = tagName === 'TH' || (node.closest && node.closest('thead') !== null);
    const isFooterCell = tagName === 'TFOOT' || (node.closest && node.closest('tfoot') !== null);

    if (isHeaderCell) {
      node.style.backgroundColor = '#f1f5f9';
      node.style.color = '#0f172a';
      node.style.borderColor = '#94a3b8';
    } else if (isFooterCell) {
      node.style.backgroundColor = '#f8fafc';
      node.style.color = '#0f172a';
      node.style.borderColor = '#0f172a';
    } else if (tagName === 'TABLE') {
      node.style.backgroundColor = '#ffffff';
      node.style.color = '#0f172a';
    } else if (tagName === 'TR' || tagName === 'TD') {
      node.style.backgroundColor = 'transparent';
      node.style.color = '#0f172a';
    } else if (tagName === 'SECTION' || tagName === 'MAIN' || tagName === 'ARTICLE' || tagName === 'HEADER' || tagName === 'FOOTER') {
      node.style.backgroundColor = '#ffffff';
      node.style.color = '#0f172a';
    } else if (tagName === 'DIV') {
      // Only top level container gets solid white, inner divs keep transparent unless explicit bg-white
      if (node === clone || node.classList?.contains('bg-white')) {
        node.style.backgroundColor = '#ffffff';
      } else {
        node.style.backgroundColor = 'transparent';
      }
      node.style.color = '#0f172a';
    } else {
      node.style.backgroundColor = 'transparent';
      node.style.color = '#0f172a';
    }

    // Handle colored badges/texts for high contrast on white background
    if (node.classList) {
      if (node.classList.contains('text-emerald-400') || node.classList.contains('text-teal-400') || node.classList.contains('text-green-400') || node.classList.contains('text-emerald-500')) {
        node.style.color = '#047857';
      } else if (node.classList.contains('text-rose-400') || node.classList.contains('text-red-400') || node.classList.contains('text-rose-500')) {
        node.style.color = '#b91c1c';
      } else if (node.classList.contains('text-amber-400') || node.classList.contains('text-yellow-400') || node.classList.contains('text-amber-500')) {
        node.style.color = '#b45309';
      } else if (node.classList.contains('text-teal-300') || node.classList.contains('text-teal-600')) {
        node.style.color = '#0f766e';
      } else if (node.classList.contains('text-indigo-400') || node.classList.contains('text-indigo-300')) {
        node.style.color = '#4338ca';
      }
    }
  };

  // Sanitize root clone element
  sanitizeNodeForPdf(clone);

  // Ensure table and child elements stay within printable width, visible, and white-background styled
  const allChildren = clone.querySelectorAll('*');
  allChildren.forEach((child: any) => {
    if (child.classList && child.classList.contains('no-print')) {
      child.remove();
      return;
    }
    child.style.visibility = 'visible';
    child.style.opacity = '1';
    child.style.maxHeight = 'none';
    if (child.style.overflow || child.style.overflowY || child.style.maxHeight) {
      child.style.overflow = 'visible';
      child.style.overflowY = 'visible';
      child.style.overflowX = 'visible';
    }

    if (child.tagName === 'TABLE') {
      child.style.width = '100%';
      child.style.maxWidth = '100%';
      child.style.boxSizing = 'border-box';
      child.style.tableLayout = 'auto';
      child.style.borderCollapse = 'collapse';
    }

    sanitizeNodeForPdf(child as HTMLElement);
  });

  // Inject transparent authentication watermark if enabled
  if (enableWatermark) {
    clone.style.position = 'relative';

    const watermarkOverlay = document.createElement('div');
    watermarkOverlay.className = 'pdf-watermark-container';
    watermarkOverlay.style.position = 'absolute';
    watermarkOverlay.style.top = '0';
    watermarkOverlay.style.left = '0';
    watermarkOverlay.style.width = '100%';
    watermarkOverlay.style.height = '100%';
    watermarkOverlay.style.pointerEvents = 'none';
    watermarkOverlay.style.zIndex = '999';
    watermarkOverlay.style.display = 'flex';
    watermarkOverlay.style.flexDirection = 'column';
    watermarkOverlay.style.justifyContent = 'space-around';
    watermarkOverlay.style.alignItems = 'center';
    watermarkOverlay.style.overflow = 'hidden';
    watermarkOverlay.style.opacity = '0.08';
    watermarkOverlay.style.padding = '20px 0';

    // Generate angled watermark rows repeating across pages
    const watermarkRows = 12;
    for (let r = 0; r < watermarkRows; r++) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'center';
      row.style.alignItems = 'center';
      row.style.gap = '30px';
      row.style.whiteSpace = 'nowrap';
      row.style.transform = 'rotate(-22deg)';
      row.style.margin = '40px 0';
      row.style.fontSize = '28px';
      row.style.fontWeight = '900';
      row.style.fontFamily = "'Cinzel', 'Playfair Display', serif";
      row.style.letterSpacing = '5px';
      row.style.color = '#0f172a';
      row.style.textTransform = 'uppercase';
      
      row.innerHTML = `<span style="border-bottom: 2px dashed #0f172a; padding-bottom: 2px;">${watermarkText}</span>`;
      watermarkOverlay.appendChild(row);
    }

    clone.appendChild(watermarkOverlay);
  }

  pdfContainer.appendChild(clone);
  document.body.appendChild(pdfContainer);

  const opt = {
    margin: margin,
    filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      letterRendering: true,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: {
      unit: 'mm',
      format: format,
      orientation: orientation
    }
  };

  try {
    const html2pdfLib = typeof html2pdf !== 'undefined' ? html2pdf : (window as any).html2pdf;
    if (typeof html2pdfLib !== 'undefined') {
      await html2pdfLib().set(opt).from(clone).save();
      return true;
    } else {
      console.warn('[pdfExport] html2pdf library not loaded on window, falling back to print dialog');
      window.print();
      return false;
    }
  } catch (error) {
    console.error('[pdfExport] PDF export error:', error);
    window.print();
    return false;
  } finally {
    if (document.body.contains(pdfContainer)) {
      document.body.removeChild(pdfContainer);
    }
  }
};
