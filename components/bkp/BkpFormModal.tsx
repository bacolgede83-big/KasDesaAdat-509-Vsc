
import React, { useState, useEffect } from 'react';
import type { BkpData } from '../../types';
import { X } from 'lucide-react';
import { numberToWords } from '../../utils/formatter';

interface BkpFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<BkpData, 'id' | 'saldo'>, id?: string) => void;
    entryToEdit?: BkpData | null;
    existingCategories: string[];
}

const BkpFormModal: React.FC<BkpFormModalProps> = ({ isOpen, onClose, onSubmit, entryToEdit, existingCategories }) => {
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [kategori, setKategori] = useState('');
    const [bukti, setBukti] = useState('022.01');
    const [uraian, setUraian] = useState('');
    const [isKredit, setIsKredit] = useState(true);
    const [amount, setAmount] = useState<number | string>('');

    useEffect(() => {
        if (entryToEdit) {
            setTanggal(entryToEdit.tanggal);
            setKategori(entryToEdit.kategori || '');
            setBukti(entryToEdit.bukti);
            setUraian(entryToEdit.uraian);
            if (entryToEdit.kredit > 0) {
                setIsKredit(true);
                setAmount(entryToEdit.kredit);
            } else {
                setIsKredit(false);
                setAmount(entryToEdit.debet);
            }
        } else {
            // Reset form for new entry
            setTanggal(new Date().toISOString().split('T')[0]);
            setKategori('');
            setBukti('022.01');
            setUraian('');
            setIsKredit(true);
            setAmount('');
        }
    }, [entryToEdit, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = Number(amount) || 0;
        const data: Omit<BkpData, 'id' | 'saldo'> = {
            tanggal,
            kategori,
            bukti,
            uraian,
            debet: !isKredit ? numericAmount : 0,
            kredit: isKredit ? numericAmount : 0,
        };
        onSubmit(data, entryToEdit?.id);
    };

    if (!isOpen) return null;

    const terbilangText = amount ? numberToWords(Number(amount)) + ' Rupiah' : 'Nol Rupiah';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg m-4 border border-gray-700 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-teal-500">
                    <h3 className="text-xl font-semibold text-white">{entryToEdit ? 'Edit Data Buku Kas Pembantu' : 'Buat Data BKP Baru'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="sm:col-span-2 sm:text-right">
                            <label htmlFor="tanggal" className="block text-sm font-medium text-gray-300 mb-1">Tanggal</label>
                            <input type="date" id="tanggal" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full sm:w-auto bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                        </div>
                        <div>
                            <label htmlFor="kategori" className="block text-sm font-medium text-gray-300 mb-1">Kategori</label>
                            <input 
                                list="category-list"
                                type="text" 
                                id="kategori" 
                                value={kategori} 
                                onChange={e => setKategori(e.target.value)} 
                                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" 
                                placeholder="Pilih atau ketik baru..."
                            />
                            <datalist id="category-list">
                                {existingCategories.map((cat) => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="bukti" className="block text-sm font-medium text-gray-300 mb-1">Bukti/Nota Transaksi</label>
                            <input type="text" id="bukti" value={bukti} onChange={e => setBukti(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="uraian" className="block text-sm font-medium text-gray-300 mb-1">Uraian Transaksi</label>
                        <textarea id="uraian" value={uraian} onChange={e => setUraian(e.target.value)} rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" required placeholder="Contoh: Belanja Pulpen Boxy 1 Lusin"></textarea>
                    </div>

                    <div className="flex items-center">
                        <input id="isKredit" type="checkbox" checked={isKredit} onChange={() => setIsKredit(!isKredit)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                        <label htmlFor="isKredit" className="ml-2 block text-sm text-gray-300">Tandai sebagai Kredit (Pengeluaran)</label>
                    </div>

                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">{isKredit ? 'Jumlah Kredit' : 'Jumlah Debet'}</label>
                        <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="0" required />
                        <p className="text-xs text-gray-400 mt-1 italic capitalize">{terbilangText}</p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-md transition-colors">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md transition-colors">{entryToEdit ? 'Simpan Perubahan' : 'Simpan'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BkpFormModal;
