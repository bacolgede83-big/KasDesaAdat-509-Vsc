
import React, { useState, useEffect, useRef } from 'react';
import type { BkpData } from '../../types';
import { X, Upload, FileSpreadsheet, Save } from 'lucide-react';
import { numberToWords, formatCurrency } from '../../utils/formatter';

declare const XLSX: any;

interface BkpNotaEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<BkpData, 'id' | 'saldo'>, id?: string) => void;
    entry: BkpData;
    existingCategories: string[];
}

const BkpNotaEditModal: React.FC<BkpNotaEditModalProps> = ({ isOpen, onClose, onSubmit, entry, existingCategories }) => {
    const [bukti, setBukti] = useState('');
    const [tanggal, setTanggal] = useState('');
    const [uraian, setUraian] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [kategori, setKategori] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && entry) {
            setBukti(entry.bukti);
            setTanggal(entry.tanggal);
            setUraian(entry.uraian);
            setAmount(entry.kredit); // Assuming this is only used for Pengeluaran
            setKategori(entry.kategori || '');
        }
    }, [isOpen, entry]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
            alert('Library Excel belum siap.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Simple parsing logic based on the "Nota" format generated in BukuBesar
                let foundBukti = '';
                let foundDate = '';
                let foundTotal = 0;

                // Search for metadata in first few rows
                for(let i=0; i< Math.min(10, jsonData.length); i++) {
                    const row: any = jsonData[i];
                    if(row && row.length > 1) {
                        if(String(row[0]).toLowerCase().includes('bukti')) foundBukti = row[1];
                        if(String(row[0]).toLowerCase().includes('tanggal')) {
                            if(row[1] instanceof Date) {
                                foundDate = row[1].toISOString().split('T')[0];
                            } else {
                                const d = new Date(row[1]);
                                if(!isNaN(d.getTime())) foundDate = d.toISOString().split('T')[0];
                            }
                        }
                    }
                }

                // Search for Total at the bottom
                const lastRow: any = jsonData[jsonData.length - 1];
                if (lastRow && lastRow.length > 1) {
                    const possibleTotal = lastRow[lastRow.length - 1];
                    if (typeof possibleTotal === 'number') {
                        foundTotal = possibleTotal;
                    }
                }

                if(foundBukti) setBukti(foundBukti);
                if(foundDate) setTanggal(foundDate);
                if(foundTotal > 0) setAmount(foundTotal);

                alert('Data berhasil diimpor dari Nota Excel!');

            } catch (err) {
                console.error(err);
                alert('Gagal membaca file Excel. Pastikan format sesuai Nota.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = ''; // Reset
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = Number(amount) || 0;
        const data: Omit<BkpData, 'id' | 'saldo'> = {
            tanggal,
            kategori,
            bukti,
            uraian,
            debet: 0, // Always 0 for this modal (Expense/Nota)
            kredit: numericAmount,
        };
        onSubmit(data, entry.id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-sm p-4" onClick={onClose}>
            <div 
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl m-4 border border-gray-700 animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-xl font-semibold text-white">Edit Transaksi Pengeluaran (Nota)</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Visual Paper Container */}
                    <div className="bg-white text-black p-6 rounded-sm shadow-md border border-gray-300 relative">
                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                            <div>
                                <h2 className="text-2xl font-bold uppercase tracking-wider">Nota Belanja</h2>
                                <p className="text-sm text-gray-600 italic">Formulir Edit Data BKP</p>
                            </div>
                            <div className="text-right">
                                <button 
                                    type="button"
                                    onClick={handleImportClick}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow transition-colors mb-2"
                                >
                                    <Upload size={14} />
                                    Import Excel
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept=".xlsx, .xls" 
                                    className="hidden" 
                                />
                                <div className="text-sm font-mono text-gray-500">
                                    {entry.id}
                                </div>
                            </div>
                        </div>

                        {/* Form Inputs Styled as Paper Fields */}
                        <form id="nota-edit-form" onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">No. Bukti</label>
                                    <input 
                                        type="text" 
                                        value={bukti}
                                        onChange={e => setBukti(e.target.value)}
                                        className="w-full border-b border-gray-400 bg-transparent py-1 px-2 text-black focus:border-blue-600 focus:outline-none font-mono"
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tanggal</label>
                                    <input 
                                        type="date" 
                                        value={tanggal}
                                        onChange={e => setTanggal(e.target.value)}
                                        className="w-full border-b border-gray-400 bg-transparent py-1 px-2 text-black focus:border-blue-600 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Kategori</label>
                                    <input 
                                        list="modal-category-list"
                                        type="text" 
                                        value={kategori}
                                        onChange={e => setKategori(e.target.value)}
                                        className="w-full border-b border-gray-400 bg-transparent py-1 px-2 text-black focus:border-blue-600 focus:outline-none font-mono"
                                        placeholder="Pilih/Ketik..."
                                    />
                                    <datalist id="modal-category-list">
                                        {existingCategories.map((cat) => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Uraian / Rincian Belanja</label>
                                <textarea 
                                    value={uraian}
                                    onChange={e => setUraian(e.target.value)}
                                    rows={3}
                                    className="w-full border border-gray-300 bg-gray-50 py-2 px-3 text-black focus:border-blue-600 focus:outline-none rounded-sm resize-none"
                                    required
                                ></textarea>
                            </div>

                            <div className="bg-gray-100 p-4 rounded border border-gray-200">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg text-gray-700">TOTAL PENGELUARAN</span>
                                    <div className="relative w-1/2">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                                        <input 
                                            type="number"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full bg-white border border-gray-300 rounded py-2 pl-10 pr-4 text-right text-xl font-bold text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="text-right mt-2 text-sm italic text-gray-600">
                                    {Number(amount) > 0 ? numberToWords(Number(amount)) + ' Rupiah' : '-'}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            type="submit" 
                            form="nota-edit-form"
                            className="flex items-center gap-2 px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all"
                        >
                            <Save size={18} />
                            Perbarui
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BkpNotaEditModal;
