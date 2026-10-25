
import React, { useMemo } from 'react';
import { X, Landmark, Droplets } from 'lucide-react';
import { SIDEBAR_MENU } from '../../constants';
import type { SidebarMenuItem } from '../../types';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isDesktopOpen: boolean;
  activePage: string;
  setActivePage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, setIsMobileOpen, isDesktopOpen, activePage, setActivePage }) => {
  
    // Generate random particles
    const particles = useMemo(() => {
      return Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        duration: `${10 + Math.random() * 15}s`,
        delay: `${Math.random() * 10}s`,
        size: `${2 + Math.random() * 4}px`,
        opacity: 0.1 + Math.random() * 0.3
      }));
    }, []);
  
  const handleItemClick = (name: string) => {
    setActivePage(name);
    // Selalu tutup sidebar di mobile saat navigasi diklik
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity lg:hidden ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
      ></div>
      
      {/* Sidebar Container */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 bg-white border-r border-gray-500 
          transform transition-all duration-300 ease-in-out z-50 lg:z-30 overflow-hidden flex flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0 
          ${isDesktopOpen ? 'lg:w-64' : 'lg:w-20'}
          w-64
        `}
      >
          {/* Particle Background */}
           {/* Falling Particles */}
          {particles.map((p) => (
            <div 
              key={p.id}
              className="absolute bg-gray-300 rounded-full animate-falling"
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

        {/* Header / Branding */}
        <div className={`flex items-center p-4 h-16 border-b border-gray-500 shrink-0 ${isDesktopOpen ? 'justify-between' : 'justify-center'}`}>
            <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
              <Droplets className={`h-7 w-7 text-teal-700 transition-all ${isDesktopOpen ? '' : 'mx-auto'}`} />
              <div className={`flex flex-col transition-opacity duration-200 ${isDesktopOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                <span className="text-xm font-bold text-slate-600 leading-none normal-case">
                  Desa Adat Basangalas</span>
                <span className="text-[12px] font-medium text-teal-700 mt-0.5 normal-case">
                  Kas Desa Adat V.5.0.9 (VSC)</span>
              </div>
            </div>
            <button onClick={() => setIsMobileOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 p-2 lg:p-3 overflow-y-auto sidebar-scrollbar custom-scrollbar overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
            <ul>
              {SIDEBAR_MENU.map((item: SidebarMenuItem) => (
                <React.Fragment key={item.name}>
                  {item.sectionHeader && (
                    <li className="pt-3 pb-1 select-none">
                      {isDesktopOpen ? (
                        <div className="flex items-center gap-2 px-2 text-[10px] font-black tracking-widest text-gray-500 uppercase">
                          <span>{item.sectionHeader}</span>
                          <div className="flex-1 h-[1px] bg-slate-800"></div>
                        </div>
                      ) : (
                        <div className="my-1.5 border-t border-slate-800" title={item.sectionHeader} />
                      )}
                    </li>
                  )}
                  <li>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleItemClick(item.name);
                      }}
                      title={!isDesktopOpen ? item.name : ''}
                      className={`
                          flex items-center my-0.5 rounded-lg transition-colors duration-200 text-xs normal-case
                          ${isDesktopOpen ? 'p-2 justify-start' : 'p-2 justify-center'}
                          ${activePage === item.name
                          ? 'bg-teal-600 bg-opacity-20 text-teal-900 font-semibold'
                          : 'text-gray-500 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isDesktopOpen ? 'mr-2.5' : ''}`} />
                      <span className={`text-xs font-medium normal-case transition-opacity duration-200 leading-tight ${isDesktopOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                          {item.name}
                      </span>
                    </a>
                  </li>
                </React.Fragment>
              ))}
            </ul>
        </nav>
        
        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
             <p className={`text-[10px] text-gray-600 font-bold tracking-widest transition-opacity duration-200 ${isDesktopOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                Bacol Enterprise System 2026
             </p>
        </div>
      </aside>
       <style>{`
          @keyframes falling {
              0% { transform: translateY(0) translateX(0); opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateY(110vh) translateX(20px); opacity: 0; }
          }
          .animate-falling {
              animation: falling linear infinite;
          }
      `}</style>

    </>
  );
};

export default Sidebar;
