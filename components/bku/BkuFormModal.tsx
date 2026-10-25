
import React, { useState, useEffect } from 'react';
import type { BkuData } from '../../types';
import { X } from 'lucide-react';
import { numberToWords } from '../../utils/formatter';
import { REFERENSI_REKENING, getKategoriFromAccountCode } from '../../constants';

interface BkuFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Omit<BkuData, 'id' | 'saldo'>, id?: string) => void;
    entryToEdit?: BkuData | null;
}

const BkuFormModal: React.FC<BkuFormModalProps> = ({ isOpen, onClose, onSubmit, entryToEdit }) => {
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [kode, setKode] = useState('1.1.1.01');
    const [kategori, setKategori] = useState('');
    const [uraian, setUraian] = useState('');
    const [isPengeluaran, setIsPengeluaran] = useState(true);
    const [amount, setAmount] = useState<number | string>('');

    useEffect(() => {
        if (entryToEdit) {
            setTanggal(entryToEdit.tanggal);
            setKode(entryToEdit.kode);
            setKategori(entryToEdit.kategori || '');
            setUraian(entryToEdit.uraian);
            if (entryToEdit.pengeluaran > 0) {
                setIsPengeluaran(true);
                setAmount(entryToEdit.pengeluaran);
            } else {
                setIsPengeluaran(false);
                setAmount(entryToEdit.penerimaan);
            }
        } else {
            // Reset form for new entry
            setTanggal(new Date().toISOString().split('T')[0]);
            setKode('1.1.1.01');
            setKategori('');
            setUraian('');
            setIsPengeluaran(true);
            setAmount('');
        }
    }, [entryToEdit, isOpen]);

    const handleKodeChange = (newKode: string) => {
        setKode(newKode);
        const autoCat = getKategoriFromAccountCode(newKode);
        if (autoCat && autoCat !== 'Umum' && !kategori) {
            setKategori(autoCat);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = Number(amount) || 0;
        const data: Omit<BkuData, 'id' | 'saldo'> = {
            tanggal,
            kode,
            kategori,
            uraian,
            penerimaan: !isPengeluaran ? numericAmount : 0,
            pengeluaran: isPengeluaran ? numericAmount : 0,
        };
        onSubmit(data, entryToEdit?.id);
    };

    if (!isOpen) return null;

    const terbilangText = amount ? numberToWords(Number(amount)) + ' Rupiah' : 'Nol Rupiah';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg m-4 border border-gray-700 animate-fade-in-up">
                <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-teal-500">
                    <h3 className="text-xl font-semibold text-white">{entryToEdit ? 'Edit Data Buku Kas Umum' : 'Buat Data Baru'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div>
                            <label htmlFor="tanggal" className="block text-sm font-medium text-gray-300 mb-1">Tanggal</label>
                            <input type="date" id="tanggal" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                        </div>
                        <div>
                            <label htmlFor="kode" className="block text-sm font-medium text-gray-300 mb-1">Kode Rekening</label>
                            <input type="text" id="kode" value={kode} onChange={e => handleKodeChange(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="kategori" className="block text-sm font-medium text-gray-300 mb-1">Kategori</label>
                        <input 
                            type="text" 
                            id="kategori" 
                            list="bku-kategori-options"
                            value={kategori} 
                            onChange={e => setKategori(e.target.value)} 
                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" 
                            placeholder="Pilih atau ketik kategori (mis: Bebantenan, Beban Listrik, Beras...)"
                        />
                        <datalist id="bku-kategori-options">
                            {REFERENSI_REKENING.map((r, idx) => (
                                <option key={idx} value={r.name}>{`${r.code} - ${r.name}`}</option>
                            ))}
                        </datalist>
                    </div>

                     <div>
                        <label htmlFor="uraian" className="block text-sm font-medium text-gray-300 mb-1">Uraian Transaksi</label>
                        <textarea id="uraian" value={uraian} onChange={e => setUraian(e.target.value)} rows={3} className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500" required placeholder="Contoh: Belanja ATK bulan Mei"></textarea>
                    </div>

                    <div className="flex items-center">
                        <input id="isPengeluaran" type="checkbox" checked={isPengeluaran} onChange={() => setIsPengeluaran(!isPengeluaran)} className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                        <label htmlFor="isPengeluaran" className="ml-2 block text-sm text-gray-300">Tandai sebagai Pengeluaran</label>
                    </div>

                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">{isPengeluaran ? 'Jumlah Pengeluaran' : 'Jumlah Penerimaan'}</label>
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

export default BkuFormModal;
