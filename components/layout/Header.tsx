import React, { useState, useRef, useEffect } from 'react';
import { Menu, UserCircle, ChevronDown, LogOut, RotateCcw, Trash2, AlertCircle, FileSpreadsheet, FileText, FileCode } from 'lucide-react';
import Notification from '../shared/Notification';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useNotification } from '../../context/NotificationContext';
import { SmartNotificationCenter } from './SmartNotificationCenter';
import type { JuDisplayRow, BkuData, BkpData } from '../../types';

interface HeaderProps {
  toggleSidebar: () => void;
  pageTitle: string;
  onLogout: () => void;
  onBackupExcel: () => void;
  onBackupJSON: () => void;
  onBackupCSV: () => void;
  onRestore: (file: File) => void;
  onReset: () => void;
  juData?: JuDisplayRow[];
  bkuData?: BkuData[];
  bkpData?: BkpData[];
  setActivePage?: (page: string) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  toggleSidebar, 
  pageTitle, 
  onLogout, 
  onBackupExcel, 
  onBackupJSON, 
  onBackupCSV, 
  onRestore, 
  onReset,
  juData = [],
  bkuData = [],
  bkpData = [],
  setActivePage = () => {}
}) => {
  const { showPermissionDenied, showNotification } = useNotification();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const dateString = today.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogoutConfirm = () => {
    onLogout();
    setIsLogoutModalOpen(false);
  };

  const handleRestoreClick = () => {
    showPermissionDenied();
    setIsProfileMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        onRestore(file);
    }
    e.target.value = '';
  };
  
  const handleResetClick = () => {
      showPermissionDenied();
      setIsProfileMenuOpen(false);
  };

  const confirmReset = async () => {
      try {
          await onReset();
          setIsResetModalOpen(false);
          setNotification({ message: 'Semua data aplikasi berhasil dihapus.', type: 'success' });
      } catch (err) {
          console.error("Gagal menghapus data:", err);
          setIsResetModalOpen(false);
          setNotification({ message: 'Gagal menghapus data aplikasi.', type: 'error' });
      }
  };

  const handleBackupExcelClick = () => {
      showPermissionDenied();
      setIsProfileMenuOpen(false);
  };

  const handleBackupJSONClick = () => {
      showPermissionDenied();
      setIsProfileMenuOpen(false);
  };

  const handleBackupCSVClick = () => {
      showPermissionDenied();
      setIsProfileMenuOpen(false);
  };

  return (
    <>
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-white border-b border-slate-200 relative z-20 print:hidden min-h-[48px] max-h-[52px]">
        <div className="flex items-center">
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition-colors print:hidden cursor-pointer"
            aria-label="Toggle Sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base md:text-lg font-bold ml-2.5 md:ml-3 text-slate-800 tracking-tight truncate print:hidden">{pageTitle}</h1>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3.5 print:hidden">
          <div className="hidden md:block text-xs text-slate-500 font-medium">{dateString}</div>
          
          {/* Smart Notification Center */}
          <SmartNotificationCenter 
            juData={juData}
            bkuData={bkuData}
            bkpData={bkpData}
            setActivePage={setActivePage}
            showToast={(msg, type) => showNotification(msg, type || 'info')}
          />

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-1.5 text-slate-600 hover:text-emerald-600 focus:outline-none transition-colors cursor-pointer py-0.5"
            >
                <div className="bg-teal-900/50 p-0.5 rounded-full border border-teal-500 shrink-0">
                    <UserCircle className="h-6 w-6 text-white" />
                </div>
                <div className="hidden sm:flex flex-col items-start text-left">
                    <span className="font-bold text-xs leading-tight text-slate-800">Juru Raksa</span>
                    <span className="text-[10px] text-slate-500 leading-tight">Bacol Bigalow</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isProfileMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 animate-fade-in-up origin-top-right z-30">
                    <div className="px-3.5 py-1.5 border-b border-slate-100 mb-1 sm:hidden">
                        <span className="font-bold text-xs text-teal-800 block">Juru Raksa</span>
                        <span className="text-[10px] text-slate-500">Bacol Bigalow</span>
                    </div>
                    <div className="px-1.5">
                        <button onClick={() => setIsLogoutModalOpen(true)} 
                        className="w-full text-left px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer">
                          <LogOut size={14} />Keluar Sistem</button>
                    </div>
                </div>
            )}
          </div>
        </div>
      </header>

      {notification && (
        <div className="fixed top-14 right-4 z-50 w-80 print:hidden">
            <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}

      <ConfirmationModal 
        isOpen={isLogoutModalOpen} 
        onClose={() => setIsLogoutModalOpen(false)} 
        onConfirm={handleLogoutConfirm} 
        title="Konfirmasi Keluar" 
        message="Apakah Anda yakin ingin keluar dari sistem? Seluruh sesi aktif akan dihentikan." 
      />

      <ConfirmationModal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)} 
        onConfirm={confirmReset} 
        title="Hapus Database" 
        message="Tindakan ini akan menghapus SELURUH data keuangan secara permanen. Pastikan Anda telah melakukan backup." 
      />      
    </>
  );
};

export default Header;