import React, { useState, useMemo } from 'react';
import type { PepesonItem } from '../types';
import { Plus, Trash2, ShoppingBag, Printer, Edit2, Info } from 'lucide-react';
import Modal from '../components/shared/Modal';
import ConfirmationModal from '../components/shared/ConfirmationModal';
import { useNotification } from '../context/NotificationContext';
import ExportPdfButton from '../components/shared/ExportPdfButton';

interface PepesonProps {
    items: PepesonItem[];
    setItems: React.Dispatch<React.SetStateAction<PepesonItem[]>>;
}

const Pepeson: React.FC<PepesonProps> = ({ items, setItems }) => {
    const { showNotification } = useNotification();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);

    const particles = useMemo(() => {
        return Array.from({ length: 30 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            duration: `${10 + Math.random() * 15}s`,
            delay: `${Math.random() * 10}s`,
            size: `${2 + Math.random() * 4}px`,
            opacity: 0.1 + Math.random() * 0.3
        }));
    }, []);

    const [formNama, setFormNama] = useState('');
    const [formKrama, setFormKrama] = useState('Desa TigaLikur');
    const [formQty, setFormQty] = useState<number | ''>('');
    const [formSatuan, setFormSatuan] = useState('');
    const [formJumlahKrama, setFormJumlahKrama] = useState<number | ''>('');

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = Number(formQty) || 0;
        const jumlahKrama = Number(formJumlahKrama) || 0;
        const total = qty * jumlahKrama;

        if (editingId) {
            setItems(prev => prev.map(item => item.id === editingId ? {
                ...item,
                nama: formNama,
                krama: formKrama,
                qty,
                satuan: formSatuan,
                jumlahKrama,
                total
            } : item));
            showNotification(`Item Pepeson "${formNama}" berhasil diperbarui!`, 'success');
        } else {
            const newItem: PepesonItem = {
                id: Date.now().toString(),
                nama: formNama,
                krama: formKrama,
                qty,
                satuan: formSatuan,
                jumlahKrama,
                total
            };
            setItems(prev => [...prev, newItem]);
            showNotification(`Item Pepeson "${formNama}" berhasil ditambahkan!`, 'success');
        }
        setIsModalOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setEditingId(null);
        setFormNama('');
        setFormKrama('Desa TigaLikur');
        setFormQty('');
        setFormSatuan('');
        setFormJumlahKrama('');
    };

    const handleEdit = (item: PepesonItem) => {
        setEditingId(item.id);
        setFormNama(item.nama);
        setFormKrama(item.krama);
        setFormQty(item.qty);
        setFormSatuan(item.satuan);
        setFormJumlahKrama(item.jumlahKrama);
        setIsModalOpen(true);
    };

    const confirmDelete = () => {
        if (idToDelete) {
            const itemToDelete = items.find(i => i.id === idToDelete);
            setItems(prev => prev.filter(i => i.id !== idToDelete));
            setIsConfirmDeleteOpen(false);
            setIdToDelete(null);
            showNotification(`Item Pepeson "${itemToDelete?.nama || ''}" berhasil dihapus!`, 'success');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const printStyles = `
        @media print {
            @page { size: auto; margin: 15mm; }
            body * { visibility: hidden; }
            #printable-area-pepeson, #printable-area-pepeson * { visibility: visible; }
            #printable-area-pepeson { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 100%; 
                background: white !important; 
                color: black !important;
                display: block !important;
            }
            .no-print { display: none !important; }
            
            /* Excel-Style Grid Table */
            table { 
                width: 100% !important; 
                border-collapse: collapse !important; 
                font-size: 9pt !important;
                color: black !important;
            }
            th, td { 
                border: 0.5pt solid black !important; 
                padding: 4px 6px !important; 
                color: black !important;
                background: white !important;
                word-wrap: break-word !important;
            }
            thead th { 
                background-color: #f2f2f2 !important; 
                font-weight: bold !important;
                text-align: center !important;
                text-transform: uppercase !important;
                -webkit-print-color-adjust: exact;
            }
            
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .font-bold { font-weight: bold !important; }
            tr { page-break-inside: avoid; }

            /* Signature */
            .signature-section { 
                display: flex !important; 
                justify-content: space-between; 
                margin-top: 50px; 
                page-break-inside: avoid; 
                color: black !important;
                font-weight: bold !important;
            }

            /* Clean UI */
            .text-white, .text-gray-400, .text-gray-300, .text-teal-400, .text-purple-400 { 
                color: black !important; 
            }
            .bg-gray-900, .bg-purple-900 { background: white !important; border-color: black !important; }
        }

        @keyframes falling {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(110vh) translateX(20px); opacity: 0; }
        }
        .animate-falling {
            animation: falling linear infinite;
        }
    `;

    return (
        <div className="space-y-6 animate-fade-in-up relative overflow-hidden" id="printable-area-pepeson">
            {/* Falling Particles Wrapper */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none no-print" style={{ zIndex: 0 }}>
                {particles.map((p) => (
                    <div 
                        key={p.id}
                        className="absolute bg-slate-400 rounded-full animate-falling"
                        style={{
                            left: p.left,
                            width: p.size,
                            height: p.size,
                            opacity: p.opacity,
                            animationDuration: p.duration,
                            animationDelay: p.delay,
                            top: '-5vh'
                        }}
                    />
                ))}
            </div>
            <style>{printStyles}</style>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-800 print:bg-white print:border-none print:shadow-none">
                
                {/* Print Title (Hidden on Screen) */}
                <div className="hidden print:block text-slate-900 mb-6 pb-2">
                    <div className="print-formal-header text-center border-b-4 border-double border-slate-900 pb-3 mb-4">
                        <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 font-serif m-0">
                            DESA ADAT BASANGALAS
                        </h2>
                        <p className="text-sm font-bold text-slate-800 font-serif my-0.5">
                            Aci Usaba Dalem
                        </p>
                        <p className="text-xs font-semibold text-slate-700 font-serif m-0">
                            Jl. Raya Basangalas, Tribuana, Abang, Karangasem-Bali
                        </p>
                    </div>

                    <div className="text-center mb-4">
                        <h3 className="text-base font-black uppercase tracking-widest text-slate-900 font-serif">
                            DAFTAR PEPESON
                        </h3>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 no-print">
                    <div className="flex items-start gap-4">
                        <div className="p-3.5 bg-purple-900/20 rounded-2xl text-purple-700 shrink-0 mt-1">
                            <ShoppingBag size={28} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h2 className="text-2xl font-bold text-gray-900">Pepeson</h2>
                                <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-300">
                                    Alokasi Logistik &amp; Upakara Adat
                                </span>
                            </div>
                            <p className="text-emerald-700 text-sm font-medium">Daftar kebutuhan/pepeson upacara per krama desa.</p>
                            <div className="mt-2 text-xs text-slate-600 bg-purple-50/90 border border-purple-200 rounded-xl px-3 py-1.5 max-w-2xl flex items-start gap-2 shadow-2xs">
                                <Info size={14} className="text-purple-700 mt-0.5 shrink-0" />
                                <p className="leading-snug">
                                    <strong className="text-purple-950 font-bold">Definisi Pepeson:</strong> Daftar alokasi pembagian kebutuhan logistik, sarana upakara, atau porsi kewajiban material per krama desa adat yang dihitung proporsional berdasarkan jumlah krama.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <ExportPdfButton 
                            elementId="printable-area-pepeson" 
                            filename={`Daftar_Pepeson_${new Date().toISOString().split('T')[0]}.pdf`} 
                            buttonText="Unduh PDF" 
                            variant="default"
                            defaultOrientation="portrait"
                            options={{ watermarkText: 'DESA ADAT BASANGALAS', orientation: 'portrait' }}
                        />
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors text-xs"
                        >
                            <Printer size={18} />
                            <span>Cetak Tabel</span>
                        </button>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow transition-colors text-xs"
                        >
                            <Plus size={18} />
                            <span>Tambah Pepeson</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-700 print:border-none print:shadow-none print:rounded-none">
                    <table className="w-full text-xs text-left text-gray-400 table-auto">
                        <thead className="text-[10px] text-gray-300 uppercase bg-gray-800">
                            <tr>
                                <th className="px-3 py-3 w-10 text-center">No</th>
                                <th className="px-3 py-3">Nama Item</th>
                                <th className="px-3 py-3 text-center">Krama</th>
                                <th className="px-3 py-3 text-center w-20">Kuantitas</th>
                                <th className="px-3 py-3 text-center w-20">Satuan</th>
                                <th className="px-3 py-3 text-center w-24">Jml Krama</th>
                                <th className="px-3 py-3 text-center w-24">Total</th>
                                <th className="px-3 py-3 text-center w-16 no-print">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-gray-500 italic">Belum ada data pepeson.</td>
                                </tr>
                            ) : (
                                items.map((item, index) => (
                                    <tr key={item.id} className="bg-white border-b border-gray-800 hover:bg-amber-800/30 print:bg-white print:text-black">
                                        <td className="px-3 py-3 text-center text-gray-900 print:text-black">{index + 1}</td>
                                        <td className="px-3 py-3 font-medium text-blue-600 print:text-black truncate max-w-[150px]" title={item.nama}>{item.nama}</td>
                                        <td className="px-3 py-3 text-center text-gray-900 print:text-black">{item.krama}</td>
                                        <td className="px-3 py-3 text-center font-bold text-teal-400 print:text-black">{item.qty}</td>
                                        <td className="px-3 py-3 text-center text-gray-900 print:text-black">{item.satuan}</td>
                                        <td className="px-3 py-3 text-center text-gray-900 print:text-black">{item.jumlahKrama}</td>
                                        <td className="px-3 py-3 text-center font-bold text-purple-900 print:text-black">{item.total}</td>
                                        <td className="px-3 py-3 text-center no-print">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handleEdit(item)} className="text-indigo-400 hover:text-indigo-300 p-1.5 hover:bg-indigo-900/20 rounded-full transition-colors"><Edit2 size={14} /></button>
                                                <button onClick={() => { setIdToDelete(item.id); setIsConfirmDeleteOpen(true); }} 
                                                className="text-red-900 hover:text-red-300 p-1.5 hover:bg-red-900/20 rounded-full transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* SIGNATURE SECTION (Hidden on Screen) */}
                <div className="hidden print:flex signature-section text-black px-10">
                    <div className="text-center w-64 space-y-20">
                        <p>Mengetahui,<br/>Keliang Adat Basangalas</p>
                        <p className="border-b-2 border-black inline-block px-10">I Made Mudita</p>
                    </div>
                    <div className="text-center w-64 space-y-20">
                        <p>Basangalas, {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br/>Juru Raksa</p>
                        <p className="border-b-2 border-black inline-block px-10">I Putu Gede Sutrana</p>
                    </div>
                </div>
                {/* Formal Footer Layout */}
                <div className="hidden print:flex justify-between items-center mt-12 px-10 text-slate-900">
                    <div>
                        <p className="font-semibold">Dokumen Resmi Sistem Informasi Keuangan Desa Adat Basangalas.</p>
                        <p className="text-[10px] text-slate-500">Kerahasiaan dan integritas data keuangan terjamin & terautentikasi secara digital.</p>
                    </div>
                    <div className="text-right font-mono text-[8px] text-slate-500">
                        <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>

            {/* MODAL */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Pepeson" : "Tambah Pepeson Baru"}>
                <form onSubmit={handleAddItem} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-800 mb-1">Nama Pepeson</label>
                        <input type="text" value={formNama} onChange={e => setFormNama(e.target.value)} 
                        className="w-full bg-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Contoh: Busung" required autoFocus />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-800 mb-1">Krama</label>
                        <select 
                            value={formKrama} 
                            onChange={e => setFormKrama(e.target.value)}
                            className="w-full bg-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="Desa TigaLikur">Desa TigaLikur</option>
                            <option value="Desa Roban">Desa Roban</option>
                            <option value="Saye Desa TigaLikur">Saye Desa TigaLikur</option>
                            <option value="Saye Penempek">Saye Penempek</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-800 mb-1">Kuantitas (Qty)</label><input type="number" value={formQty} onChange={e => setFormQty(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-gray-900 focus:outline-none" placeholder="0" required /></div>
                        <div><label className="block text-sm font-medium text-gray-800 mb-1">Satuan</label><input type="text" value={formSatuan} onChange={e => setFormSatuan(e.target.value)} className="w-full bg-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-gray-900 focus:outline-none" placeholder="Pcs/Ikat/Kg" required /></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-800 mb-1">Jumlah Krama</label>
                        <input type="number" value={formJumlahKrama} onChange={e => setFormJumlahKrama(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-100 border border-gray-600 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="0" required />
                    </div>
                    <div className="bg-gray-500 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
                        <span className="text-gray-100 text-sm">Total Perhitungan:</span>
                        <span className="text-gray-100 font-bold text-lg">
                            {(Number(formQty) || 0) * (Number(formJumlahKrama) || 0)}
                        </span>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 bg-gray-600 text-white rounded-lg">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg">{editingId ? 'Simpan Perubahan' : 'Simpan'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal 
                isOpen={isConfirmDeleteOpen} 
                onClose={() => setIsConfirmDeleteOpen(false)} 
                onConfirm={confirmDelete} 
                title="Hapus Pepeson" 
                message="Apakah Anda yakin ingin menghapus item pepeson ini?"
            />
        </div>
    );
};

export default Pepeson;
