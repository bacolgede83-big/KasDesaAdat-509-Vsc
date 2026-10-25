
import React from 'react';
import { BkpData } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatter';

interface BkpTableProps {
  data: BkpData[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const BkpTable: React.FC<BkpTableProps> = ({ data }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800 shadow-inner bg-white">
      <table className="w-full text-sm text-left text-gray-400">
        <thead className="text-xs text-white uppercase bg-slate-400">
          <tr>
            <th scope="col" className="px-4 py-2">Tanggal</th>
            <th scope="col" className="px-4 py-2">Bukti Transaksi</th>
            <th scope="col" className="px-4 py-2">Kategori</th>
            <th scope="col" className="px-4 py-2">Uraian</th>
            <th scope="col" className="px-4 py-2 text-right">Debet</th>
            <th scope="col" className="px-4 py-2 text-right">Kredit</th>
            <th scope="col" className="px-4 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr key={item.id || idx} className="bg-slate-50 border-b border-gray-800 hover:bg-slate-200 align-top">
              <td className="px-4 py-2 whitespace-wrap">{formatDate(item.tanggal)}</td>
              <td className="px-4 py-2 whitespace-wrap font-mono text-[11px]">{item.bukti}</td>
              <td className="px-4 py-2 text-green-500 text-[11px]">{item.kategori || '-'}</td>
              <td className="px-4 py-2 text-gray-900" style={{ wordBreak: 'break-word', minWidth: '250px', whiteSpace: 'normal' }}>{item.uraian}</td>
              <td className="px-4 py-2 text-right text-green-500 font-bold">{item.debet > 0 ? formatCurrency(item.debet) : '-'}</td>
              <td className="px-4 py-2 text-right text-red-500 font-bold">{item.kredit > 0 ? formatCurrency(item.kredit) : '-'}</td>
              <td className="px-4 py-2 text-right font-black text-gray-900">{formatCurrency(item.saldo)}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-8 text-gray-500 italic">
                Tidak ada data transaksi ditemukan.
              </td>
            </tr>
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right uppercase font-extrabold text-[11px] text-slate-700">
                TOTAL MUTASI & SUB-TOTAL
              </td>
              <td className="px-4 py-2 text-right text-emerald-700 font-black">
                {formatCurrency(data.reduce((sum, item) => sum + (item.debet || 0), 0))}
              </td>
              <td className="px-4 py-2 text-right text-rose-700 font-black">
                {formatCurrency(data.reduce((sum, item) => sum + (item.kredit || 0), 0))}
              </td>
              <td className="px-4 py-2 text-right text-slate-900 font-black bg-teal-50/80">
                {formatCurrency(data[data.length - 1]?.saldo || 0)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default BkpTable;
