
import React from 'react';
import { BkuData } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatter';
import { Pencil, Trash2, Wallet } from 'lucide-react';

interface BkuTableProps {
  data: BkuData[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const BkuTable: React.FC<BkuTableProps> = ({ data, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800 shadow-inner bg-white">
      <table className="w-full text-sm text-left text-gray-400">
        <thead className="text-[11px] text-white uppercase bg-slate-500 font-black tracking-widest">
          <tr>
            <th scope="col" className="px-2 py-1">Tanggal</th>
            <th scope="col" className="px-2 py-1">Kode</th>
            <th scope="col" className="px-1 py-1">Kategori</th>
            <th scope="col" className="px-3 py-1">Uraian Transaksi</th>
            <th scope="col" className="px-3 py-1 text-right">Penerimaan (D)</th>
            <th scope="col" className="px-3 py-1 text-right">Pengeluaran (K)</th>
            <th scope="col" className="px-3 py-1 text-right">Saldo Akhir</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-slate-400/30 transition-colors align-top">
              <td className="px-2 py-1 whitespace-nowrap font-mono text-[12px]">{formatDate(item.tanggal)}</td>
              <td className="px-2 py-1 font-mono text-[11px] text-gray-500">{item.kode}</td>
              <td className="px-1 py-1">
                <span className="text-[10px] text-green-600">
                    {item.kategori || '-'}
                </span>
              </td>
              <td className="px-3 py-1 text-gray-900 leading-relaxed text-[13px]" style={{ wordBreak: 'break-word', minWidth: '220px' }}>
                {item.uraian}
              </td>
              <td className="px-3 py-1 text-right text-green-400 font-bold text-[13px]">
                {item.penerimaan > 0 ? formatCurrency(item.penerimaan) : '-'}
              </td>
              <td className="px-3 py-1 text-right text-red-400 font-bold text-[13px]">
                {item.pengeluaran > 0 ? formatCurrency(item.pengeluaran) : '-'}
              </td>
              <td className="px-3 py-1 text-right bg-teal-50/5">
                <span className="text-gray-600 font-black text-[13px]">{formatCurrency(item.saldo)}</span>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-20 text-gray-600 italic tracking-widest text-base">
                <div className="flex flex-col items-center gap-2">
                    <Wallet size={48} className="opacity-20" />
                    Belum ada data transaksi Buku Kas Umum.
                </div>
              </td>
            </tr>
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-[12px]">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right uppercase font-extrabold text-[11px] text-slate-700">
                TOTAL MUTASI & SUB-TOTAL
              </td>
              <td className="px-3 py-2 text-right text-emerald-700 font-black">
                {formatCurrency(data.reduce((sum, item) => sum + (item.penerimaan || 0), 0))}
              </td>
              <td className="px-3 py-2 text-right text-rose-700 font-black">
                {formatCurrency(data.reduce((sum, item) => sum + (item.pengeluaran || 0), 0))}
              </td>
              <td className="px-3 py-2 text-right text-slate-900 font-black bg-teal-50/80">
                {formatCurrency(data[data.length - 1]?.saldo || 0)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default BkuTable;
