import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import type { JuDisplayRow, BkuData, BkpData } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
  onLogout: () => void;
  onBackupExcel: () => void;
  onBackupJSON: () => void;
  onBackupCSV: () => void;
  onRestore: (file: File) => void;
  onReset: () => void;
  juData?: JuDisplayRow[];
  bkuData?: BkuData[];
  bkpData?: BkpData[];
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activePage, 
  setActivePage, 
  onLogout, 
  onBackupExcel, 
  onBackupJSON, 
  onBackupCSV, 
  onRestore, 
  onReset,
  juData,
  bkuData,
  bkpData
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);

  // Otomatis menutup sidebar di mobile saat navigasi / berpindah halaman
  useEffect(() => {
    setIsMobileOpen(false);
  }, [activePage]);

  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setIsDesktopOpen(!isDesktopOpen);
    } else {
      setIsMobileOpen(!isMobileOpen);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-gray-900 overflow-hidden">
      <Sidebar 
        isMobileOpen={isMobileOpen} 
        setIsMobileOpen={setIsMobileOpen} 
        isDesktopOpen={isDesktopOpen}
        activePage={activePage} 
        setActivePage={setActivePage}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
            toggleSidebar={toggleSidebar} 
            pageTitle={activePage}
            onLogout={onLogout}
            onBackupExcel={onBackupExcel}
            onBackupJSON={onBackupJSON}
            onBackupCSV={onBackupCSV}
            onRestore={onRestore}
            onReset={onReset}
            juData={juData}
            bkuData={bkuData}
            bkpData={bkpData}
            setActivePage={setActivePage}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
