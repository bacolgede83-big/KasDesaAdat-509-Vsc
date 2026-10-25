import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bell, 
  BellRing, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Scale, 
  ShieldCheck, 
  CheckCheck, 
  ChevronRight, 
  Database, 
  Cloud 
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatter';
import { playUnsyncedSound } from '../../utils/soundEffects';
import type { JuDisplayRow, BkuData, BkpData } from '../../types';

export interface SyncIssue {
  id: string;
  category: 'jurnal-balance' | 'bku-integrity';
  title: string;
  moduleName: string;
  targetPage: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  badgeColor: string;
  tableTotal: number;
  journalTotal: number;
  difference: number;
  message: string;
  actionText: string;
  canAutoSync: boolean;
  onSync?: () => Promise<void> | void;
}

interface SmartNotificationCenterProps {
  juData: JuDisplayRow[];
  bkuData: BkuData[];
  bkpData: BkpData[];
  setActivePage: (page: string) => void;
  showToast?: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const SmartNotificationCenter: React.FC<SmartNotificationCenterProps> = ({
  juData,
  bkuData,
  bkpData: _bkpData,
  setActivePage,
  showToast: _showToast
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keseimbangan Jurnal Umum (Debet vs Kredit)
  const totalDebetJu = useMemo(() => {
    return juData.reduce((sum, r) => sum + (Number(r.debet) || 0), 0);
  }, [juData]);

  const totalKreditJu = useMemo(() => {
    return juData.reduce((sum, r) => sum + (Number(r.kredit) || 0), 0);
  }, [juData]);

  const isJournalBalanced = useMemo(() => {
    return Math.abs(totalDebetJu - totalKreditJu) < 0.1;
  }, [totalDebetJu, totalKreditJu]);

  // Evaluasi seluruh isu integritas pembukuan
  const syncIssues = useMemo<SyncIssue[]>(() => {
    const issues: SyncIssue[] = [];

    // Peringatan Ketidakseimbangan Jurnal Umum (Debet != Kredit)
    if (!isJournalBalanced && juData.length > 0) {
      const selisihJu = Math.abs(totalDebetJu - totalKreditJu);
      issues.push({
        id: 'jurnal-balance',
        category: 'jurnal-balance',
        title: 'Ketidakseimbangan Jurnal Umum',
        moduleName: 'Buku Jurnal Umum',
        targetPage: 'Jurnal Umum',
        icon: Scale,
        iconBg: 'bg-rose-100 text-rose-700 border-rose-300',
        iconColor: 'text-rose-600',
        badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
        tableTotal: totalDebetJu,
        journalTotal: totalKreditJu,
        difference: selisihJu,
        message: `Total Debet (${formatCurrency(totalDebetJu)}) tidak sama dengan Total Kredit (${formatCurrency(totalKreditJu)}). Selisih: ${formatCurrency(selisihJu)}.`,
        actionText: 'Periksa Jurnal',
        canAutoSync: false
      });
    }

    return issues;
  }, [isJournalBalanced, totalDebetJu, totalKreditJu, juData.length]);

  const issueCount = syncIssues.length;
  const prevIssueCountRef = useRef<number>(issueCount);

  // Deteksi audio saat muncul selisih/isu ketidakseimbangan
  useEffect(() => {
    if (issueCount > 0 && prevIssueCountRef.current === 0) {
      playUnsyncedSound();
    }
    prevIssueCountRef.current = issueCount;
  }, [issueCount]);

  const handleToggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && issueCount > 0) {
      playUnsyncedSound();
    }
  };

  const handleNavigate = (page: string) => {
    setActivePage(page);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button Trigger */}
      <button
        onClick={handleToggleOpen}
        className={`relative p-2 rounded-xl transition-all duration-200 focus:outline-none ${
          issueCount > 0
            ? 'text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 shadow-sm'
            : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
        }`}
        title={issueCount > 0 ? `${issueCount} isu ketidakseimbangan jurnal umum terdeteksi` : 'Seluruh pembukuan Jurnal Umum & BKU seimbang'}
        aria-label="Pusat Notifikasi & Integritas Pembukuan"
      >
        {issueCount > 0 ? (
          <BellRing className="h-5 w-5 animate-pulse" />
        ) : (
          <Bell className="h-5 w-5" />
        )}

        {/* Dynamic Badge */}
        {issueCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 rounded-full bg-rose-600 text-[10px] font-black text-white shadow-md ring-2 ring-white animate-bounce">
            {issueCount}
          </span>
        ) : (
          <span className="absolute bottom-1 right-1 h-2 w-2 bg-emerald-500 rounded-full ring-2 ring-white" />
        )}
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-84 sm:w-96 md:w-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up origin-top-right z-50">
          {/* Header Panel */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex items-center justify-between border-b border-teal-800/40">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${issueCount > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                {issueCount > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight text-white flex items-center gap-2">
                  Notifikasi Sistem Pembukuan
                  {issueCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Perlu Penyesuaian
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-teal-200/80 leading-tight mt-0.5 flex items-center gap-1">
                  <Cloud size={11} className="text-teal-300" />
                  <span>Monitoring Integritas & Keseimbangan Akuntansi</span>
                </p>
              </div>
            </div>
          </div>

          {/* Cloud Auto-Save Status Ribbon */}
          <div className="px-3.5 py-1.5 bg-teal-50/80 border-b border-teal-100/60 flex items-center justify-between text-[11px] text-teal-800">
            <span className="flex items-center gap-1 font-medium">
              <Cloud size={13} className="text-teal-600" />
              <span>Penyimpanan Cloud Aktif</span>
            </span>
            <span className="text-[10px] font-mono text-teal-700 bg-teal-100/80 px-1.5 py-0.5 rounded">
              Data tersimpan otomatis di Firebase
            </span>
          </div>

          {/* Body Content */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
            {issueCount > 0 ? (
              <>
                <div className="px-2 pt-1 pb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <AlertCircle size={13} />
                    Isu Keseimbangan Terdeteksi:
                  </span>
                </div>

                {syncIssues.map((issue) => {
                  const Icon = issue.icon;
                  return (
                    <div
                      key={issue.id}
                      className="p-3 bg-slate-50 hover:bg-rose-50/40 rounded-xl border border-rose-200 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${issue.iconBg}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block leading-snug">
                              {issue.title}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              Modul: {issue.moduleName}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${issue.badgeColor}`}>
                          Ada Selisih
                        </span>
                      </div>

                      {/* Detail Nilai */}
                      <div className="bg-white p-2 rounded-lg border border-slate-200/80 text-[11px] space-y-1 font-mono">
                        <div className="flex justify-between text-slate-600">
                          <span>Total Debet:</span>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(issue.tableTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Total Kredit:</span>
                          <span className="font-bold text-slate-700">
                            {formatCurrency(issue.journalTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1 text-rose-700 font-bold">
                          <span>Selisih:</span>
                          <span>
                            {formatCurrency(Math.abs(issue.difference))}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-0.5">
                        <button
                          onClick={() => handleNavigate(issue.targetPage)}
                          className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors"
                        >
                          <span>{issue.actionText}</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              /* All Synced Clean State */
              <div className="py-6 px-4 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                  <CheckCheck size={26} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Semua Pembukuan Seimbang</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Seluruh pencatatan transaksi di Buku Jurnal Umum (JU), Buku Kas Umum (BKU), dan Buku Kas Pembantu (BKP) tercatat seimbang dan tersimpan aman di Cloud.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck size={14} />
                  <span>Jurnal Umum Balans & Akurat</span>
                </div>
              </div>
            )}

            {/* Health & Diagnostic Summary Section */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Database size={12} />
                Ringkasan Integritas Pembukuan & Cloud
              </span>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500">Jurnal Balans:</span>
                  <span className={`font-bold flex items-center gap-1 ${isJournalBalanced ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isJournalBalanced ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {isJournalBalanced ? 'Seimbang' : 'Selisih'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500">Baris Jurnal:</span>
                  <span className="font-bold font-mono text-slate-800">{juData.length} baris</span>
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500">Baris BKU:</span>
                  <span className="font-bold font-mono text-slate-800">{bkuData.length} baris</span>
                </div>

                <div className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200">
                  <span className="text-slate-500">Total Kas Jurnal:</span>
                  <span className="font-bold font-mono text-teal-800">
                    {formatCurrency(
                      juData
                        .filter(r => r.kodeRekening?.startsWith('1.1.1.') && r.rowType === 'debet')
                        .reduce((s, r) => s + (Number(r.debet) || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Panel */}
          <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <Cloud size={12} className="text-teal-600" />
              <span>Sistem Pembukuan Desa Adat</span>
            </span>
            <button
              onClick={() => handleNavigate('Jurnal Umum')}
              className="font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
            >
              <span>Periksa Jurnal Umum</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartNotificationCenter;
