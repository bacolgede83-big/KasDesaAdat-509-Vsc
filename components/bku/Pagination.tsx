import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const maxVisible = 10;
  let start = Math.max(1, currentPage - 5);
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
  }
  const pages = [];
  for (let i = start; i <= end; i++) {
      pages.push(i);
  }

  const buttonClass = "flex items-center gap-1 px-3 py-1.5 bg-slate-900 rounded-md border border-gray-500 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
  const pageButtonClass = (isActive: boolean) => `w-8 h-8 flex items-center justify-center rounded-md border ${isActive ? 'bg-teal-600 border-teal-500 text-white font-bold' : 'bg-slate-900 border-gray-500 text-gray-300 hover:bg-gray-700'} transition-colors text-xs`;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-800 mt-4 gap-4 w-full">
        <div>
            Halaman <span className="font-bold text-gray-900">{currentPage}</span> dari <span className="font-bold text-gray-900">{totalPages}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-center">
            <button
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1}
                className={buttonClass}
                title="Halaman Awal"
            >
                <ChevronsLeft size={14} />
                <span className="hidden sm:inline">Awal</span>
            </button>
            
            <div className="flex items-center gap-1 mx-1">
                {pages.map(num => (
                    <button
                        key={num}
                        onClick={() => onPageChange(num)}
                        className={pageButtonClass(currentPage === num)}
                    >
                        {num}
                    </button>
                ))}
            </div>

             <button
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages}
                className={buttonClass}
                title="Halaman Akhir"
            >
                 <span className="hidden sm:inline">Akhir</span>
                <ChevronsRight size={14} />
            </button>
        </div>
    </div>
  );
};

export default Pagination;