import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  LogIn, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Download, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Laptop, 
  Smartphone, 
  ShieldAlert,
  Activity
} from 'lucide-react';
import { 
  userLogService, 
  UserRegistrationLog, 
  UserLoginAttemptLog, 
  UserSuccessfulLoginLog 
} from '../../services/userLogService';
import { playSaveSuccessSound, playDeleteSuccessSound } from '../../utils/soundEffects';

interface UserLogViewProps {
  onNotify?: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
}

export const UserLogView: React.FC<UserLogViewProps> = ({ onNotify }) => {
  const [registrations, setRegistrations] = useState<UserRegistrationLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<UserLoginAttemptLog[]>([]);
  const [successfulLogins, setSuccessfulLogins] = useState<UserSuccessfulLoginLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'registrations' | 'attempts' | 'successful'>('all');

  const loadAllLogs = () => {
    setRegistrations(userLogService.getRegistrationLogs());
    setLoginAttempts(userLogService.getLoginAttemptLogs());
    setSuccessfulLogins(userLogService.getSuccessfulLoginLogs(5)); // Persis 5 login terakhir
  };

  useEffect(() => {
    loadAllLogs();
  }, []);

  const handleRefresh = () => {
    loadAllLogs();
    playSaveSuccessSound();
    if (onNotify) onNotify('Data Log Aktivitas Pengguna berhasil dimuat ulang.', 'info');
  };

  const handleClearRegistrations = () => {
    if (window.confirm('Hapus seluruh riwayat log pendaftar akun baru?')) {
      userLogService.clearRegistrationLogs();
      setRegistrations([]);
      playDeleteSuccessSound();
      if (onNotify) onNotify('Riwayat log pendaftar akun baru telah dibersihkan.', 'info');
    }
  };

  const handleClearAttempts = () => {
    if (window.confirm('Hapus seluruh riwayat log percobaan login?')) {
      userLogService.clearLoginAttemptLogs();
      setLoginAttempts([]);
      playDeleteSuccessSound();
      if (onNotify) onNotify('Riwayat log percobaan login telah dibersihkan.', 'info');
    }
  };

  const handleClearSuccessful = () => {
    if (window.confirm('Hapus riwayat 5 log sesi login terakhir?')) {
      userLogService.clearSuccessfulLoginLogs();
      setSuccessfulLogins([]);
      playDeleteSuccessSound();
      if (onNotify) onNotify('Riwayat 5 log sesi login terakhir telah dibersihkan.', 'info');
    }
  };

  const handleExportCSV = () => {
    try {
      let csv = 'KATEGORI;WAKTU;EMAIL;STATUS;KETERANGAN_PERANGKAT\r\n';
      
      registrations.forEach(r => {
        csv += `PENDAFTARAN;${r.timestamp};${r.email};${r.status};${r.perangkat} - ${r.metode}\r\n`;
      });
      loginAttempts.forEach(a => {
        csv += `PERCOBAAN_LOGIN;${a.timestamp};${a.email};${a.status};${a.perangkat} - ${a.keterangan}\r\n`;
      });
      successfulLogins.forEach(s => {
        csv += `SESI_BERHASIL;${s.timestamp};${s.email};${s.status};${s.perangkat} - IP: ${s.ipSimulasi || '-'}\r\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AUDIT_LOG_USER_BACOL_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      playSaveSuccessSound();
      if (onNotify) onNotify('Audit Log User berhasil diekspor ke file CSV.', 'success');
    } catch {
      if (onNotify) onNotify('Gagal mengekspor log ke CSV.', 'error');
    }
  };

  // Filter function by email or keyword
  const filterByTerm = <T extends { email: string }>(items: T[]): T[] => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => item.email.toLowerCase().includes(term));
  };

  const filteredRegistrations: UserRegistrationLog[] = filterByTerm<UserRegistrationLog>(registrations);
  const filteredAttempts: UserLoginAttemptLog[] = filterByTerm<UserLoginAttemptLog>(loginAttempts);
  const filteredSuccessful: UserSuccessfulLoginLog[] = filterByTerm<UserSuccessfulLoginLog>(successfulLogins);

  const getDeviceIcon = (dev: string) => {
    if (/Android|iOS|Mobile/i.test(dev)) return <Smartphone size={14} className="text-teal-400" />;
    return <Laptop size={14} className="text-blue-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Control Bar */}
      <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 border border-teal-500/30 rounded-2xl shadow-xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-48 bg-teal-500/10 blur-3xl pointer-events-none rounded-full"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-teal-500/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-teal-500/20 border border-teal-400/40 text-teal-300 shadow-inner">
              <Users size={26} className="text-teal-400 drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white uppercase font-document-title">
                  Audit Log Pengguna (Log User)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-900/80 text-teal-300 border border-teal-500/40">
                  Security Standard
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Monitoring audit aktivitas: pendaftar akun baru, pencatatan percobaan login saat loading, dan 5 sesi login terakhir.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 hover:text-white border border-teal-500/30 text-xs font-bold transition-all shadow cursor-pointer"
              title="Perbarui log aktivitas"
            >
              <RefreshCw size={14} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Unduh seluruh data log dalam format CSV"
            >
              <Download size={14} />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Counter Summary Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <UserPlus size={18} className="text-amber-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Total Pendaftar</div>
                <div className="text-base font-black text-white">{registrations.length} Pengguna</div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">Akun Baru</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Activity size={18} className="text-teal-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Percobaan Login</div>
                <div className="text-base font-black text-white">{loginAttempts.length} Percobaan</div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-teal-400/80 bg-teal-400/10 px-2 py-0.5 rounded-md border border-teal-400/20">Real-Time</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={18} className="text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Sesi Berhasil</div>
                <div className="text-base font-black text-white">{successfulLogins.length} / 5 Terakhir</div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">Terverifikasi</span>
          </div>
        </div>

        {/* Search & Sub-tabs */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua Tabel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('registrations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'registrations'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendaftar ({registrations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attempts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'attempts'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Percobaan Login ({loginAttempts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('successful')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'successful'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              5 Login Terakhir ({successfulLogins.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari alamat email..."
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TABEL PENDAFTAR AKUN BARU                                              */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'registrations') && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <UserPlus size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider font-mono text-amber-400 flex items-center gap-2">
                  1. Log Pendaftar Akun Baru
                </h4>
                <p className="text-[11px] text-slate-400">
                  Data pengguna yang telah mendaftarkan akun ke dalam sistem aplikasi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                {filteredRegistrations.length} Data
              </span>
              {registrations.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRegistrations}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition cursor-pointer"
                  title="Hapus seluruh riwayat pendaftar"
                >
                  <Trash2 size={12} />
                  <span>Bersihkan</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Waktu Pendaftaran</th>
                  <th className="py-3 px-4">Alamat Email Pengguna</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4">Jalur Pendaftaran</th>
                  <th className="py-3 px-4">Perangkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-200">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-mono text-xs">
                      Tidak ada riwayat pendaftaran akun yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-500" />
                          <span>{item.timestamp}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          {item.email}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Berhasil Terdaftar'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}>
                          {item.status === 'Berhasil Terdaftar' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          <span>{item.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {item.metode}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {getDeviceIcon(item.perangkat)}
                          <span>{item.perangkat}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TABEL PERCOBAAN LOGIN (SAAT TOMBOL "MASUK SEKARANG" DIKLIK)            */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'attempts') && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <LogIn size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider font-mono text-teal-400 flex items-center gap-2">
                  2. Log Percobaan Login (Saat "Masuk Sekarang" Diklik)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Tercatat seketika saat tombol <strong>Masuk Sekarang</strong> diklik saat loading proses verifikasi akun.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                {filteredAttempts.length} Percobaan
              </span>
              {loginAttempts.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAttempts}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition cursor-pointer"
                  title="Hapus seluruh log percobaan login"
                >
                  <Trash2 size={12} />
                  <span>Bersihkan</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Waktu Percobaan</th>
                  <th className="py-3 px-4">Alamat Email Input</th>
                  <th className="py-3 px-4">Status Verifikasi</th>
                  <th className="py-3 px-4">Keterangan Aktivitas</th>
                  <th className="py-3 px-4">Perangkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-200">
                {filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-mono text-xs">
                      Belum ada percobaan login yang terekam pada sesi ini.
                    </td>
                  </tr>
                ) : (
                  filteredAttempts.map((item, idx) => {
                    const isSuccess = item.status === 'Berhasil Masuk';
                    const isLoading = item.status === 'Sedang Memverifikasi';
                    const isFailed = item.status.includes('Gagal');

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-500" />
                            <span>{item.timestamp}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                            {item.email}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : isLoading
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}>
                            {isSuccess && <CheckCircle2 size={11} />}
                            {isLoading && <Activity size={11} className="animate-spin" />}
                            {isFailed && <XCircle size={11} />}
                            <span>{item.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {item.keterangan}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {getDeviceIcon(item.perangkat)}
                            <span>{item.perangkat}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TABEL 5 LOG TERAKHIR YANG BISA LOG IN KE APLIKASI                      */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'successful') && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider font-mono text-emerald-400 flex items-center gap-2">
                  3. Log 5 Sesi Terakhir yang Berhasil Masuk ke Aplikasi
                </h4>
                <p className="text-[11px] text-slate-400">
                  Daftar 5 aktivitas login resmi terakhir yang berhasil terotentikasi ke sistem Desa Adat.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono bg-emerald-950/60 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                Maksimal 5 Sesi Terakhir
              </span>
              {successfulLogins.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSuccessful}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 transition cursor-pointer"
                  title="Hapus riwayat 5 login terakhir"
                >
                  <Trash2 size={12} />
                  <span>Bersihkan</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Urutan</th>
                  <th className="py-3 px-4">Waktu Berhasil Masuk</th>
                  <th className="py-3 px-4">Akun Email Login</th>
                  <th className="py-3 px-4">Status Sesi</th>
                  <th className="py-3 px-4">Perangkat / Device</th>
                  <th className="py-3 px-4">Alamat IP Klien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-200">
                {filteredSuccessful.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-mono text-xs">
                      Tidak ada data sesi login berhasil yang tercatat.
                    </td>
                  </tr>
                ) : (
                  filteredSuccessful.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[11px] border border-emerald-500/30">
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-emerald-500" />
                          <span>{item.timestamp}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          {item.email}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Sesi Aktif'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                            : 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                        }`}>
                          <CheckCircle2 size={11} className="text-emerald-400" />
                          <span>{item.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {getDeviceIcon(item.perangkat)}
                          <span>{item.perangkat}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                          {item.ipSimulasi || '127.0.0.1'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserLogView;
