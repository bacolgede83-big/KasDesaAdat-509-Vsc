// =========================================================================
// USER AUDIT LOG SERVICE (SECURITY & COMPLIANCE - TANPA KATA SANDI)
// Pencatatan aktivitas pendaftaran, percobaan login, dan 5 sesi login terakhir.
// =========================================================================

export interface UserRegistrationLog {
  id: string;
  timestamp: string;
  rawDate: number;
  email: string;
  status: 'Berhasil Terdaftar' | 'Gagal Registrasi';
  metode: string;
  perangkat: string;
}

export interface UserLoginAttemptLog {
  id: string;
  timestamp: string;
  rawDate: number;
  email: string;
  status: 'Sedang Memverifikasi' | 'Berhasil Masuk' | 'Gagal (Kredensial Salah)' | 'Gagal (Sistem)';
  keterangan: string;
  perangkat: string;
}

export interface UserSuccessfulLoginLog {
  id: string;
  timestamp: string;
  rawDate: number;
  email: string;
  status: 'Sesi Aktif' | 'Berhasil Masuk';
  perangkat: string;
  ipSimulasi?: string;
}

const STORAGE_KEY_REGISTRATIONS = 'bacol_audit_user_registrations';
const STORAGE_KEY_LOGIN_ATTEMPTS = 'bacol_audit_user_login_attempts';
const STORAGE_KEY_SUCCESSFUL_LOGINS = 'bacol_audit_user_successful_logins';

// Helper info perangkat sederhana
const getDeviceInfo = (): string => {
  if (typeof window === 'undefined' || !navigator) return 'Browser Klien';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android Mobile';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Device';
  if (/Windows/i.test(ua)) return 'Windows Desktop';
  if (/Mac/i.test(ua)) return 'Mac OS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web Browser';
};

const formatTimestamp = (date: Date = new Date()): string => {
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Initial Seed Data (Contoh riwayat audit awal agar tabel informatif)
const initialRegistrationSeed: UserRegistrationLog[] = [
  {
    id: 'reg-seed-1',
    timestamp: formatTimestamp(new Date(Date.now() - 86400000 * 3)),
    rawDate: Date.now() - 86400000 * 3,
    email: 'admin@bacol.dev',
    status: 'Berhasil Terdaftar',
    metode: 'Inisialisasi Sistem Bacol',
    perangkat: 'Windows Desktop'
  },
  {
    id: 'reg-seed-2',
    timestamp: formatTimestamp(new Date(Date.now() - 86400000 * 2)),
    rawDate: Date.now() - 86400000 * 2,
    email: 'Basangalasjururaksa@gmail.com',
    status: 'Berhasil Terdaftar',
    metode: 'Pendaftaran Akun Baru',
    perangkat: 'Android Mobile'
  },
  {
    id: 'reg-seed-3',
    timestamp: formatTimestamp(new Date(Date.now() - 86400000 * 1)),
    rawDate: Date.now() - 86400000 * 1,
    email: 'bacolgede83@gmail.com',
    status: 'Berhasil Terdaftar',
    metode: 'Pendaftaran Akun Baru',
    perangkat: 'Windows Desktop'
  }
];

const initialSuccessfulSeed: UserSuccessfulLoginLog[] = [
  {
    id: 'suc-seed-1',
    timestamp: formatTimestamp(new Date(Date.now() - 3600000 * 24)),
    rawDate: Date.now() - 3600000 * 24,
    email: 'admin@bacol.dev',
    status: 'Berhasil Masuk',
    perangkat: 'Windows Desktop',
    ipSimulasi: '192.168.1.101'
  },
  {
    id: 'suc-seed-2',
    timestamp: formatTimestamp(new Date(Date.now() - 3600000 * 18)),
    rawDate: Date.now() - 3600000 * 18,
    email: 'Basangalasjururaksa@gmail.com',
    status: 'Berhasil Masuk',
    perangkat: 'Android Mobile',
    ipSimulasi: '192.168.1.104'
  },
  {
    id: 'suc-seed-3',
    timestamp: formatTimestamp(new Date(Date.now() - 3600000 * 8)),
    rawDate: Date.now() - 3600000 * 8,
    email: 'bacolgede83@gmail.com',
    status: 'Berhasil Masuk',
    perangkat: 'Windows Desktop',
    ipSimulasi: '192.168.1.105'
  },
  {
    id: 'suc-seed-4',
    timestamp: formatTimestamp(new Date(Date.now() - 3600000 * 3)),
    rawDate: Date.now() - 3600000 * 3,
    email: 'admin@bacol.dev',
    status: 'Berhasil Masuk',
    perangkat: 'Windows Desktop',
    ipSimulasi: '192.168.1.101'
  },
  {
    id: 'suc-seed-5',
    timestamp: formatTimestamp(new Date(Date.now() - 1800000)),
    rawDate: Date.now() - 1800000,
    email: 'bacolgede83@gmail.com',
    status: 'Sesi Aktif',
    perangkat: 'Windows Desktop',
    ipSimulasi: '192.168.1.105'
  }
];

export const userLogService = {
  // --- 1. LOG PENDAFTAR AKUN BARU ---
  getRegistrationLogs: (): UserRegistrationLog[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_REGISTRATIONS);
      if (!data) {
        localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(initialRegistrationSeed));
        return initialRegistrationSeed;
      }
      return JSON.parse(data);
    } catch {
      return initialRegistrationSeed;
    }
  },

  recordRegistration: (email: string, status: 'Berhasil Terdaftar' | 'Gagal Registrasi' = 'Berhasil Terdaftar'): UserRegistrationLog => {
    const list = userLogService.getRegistrationLogs();
    const item: UserRegistrationLog = {
      id: `reg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: formatTimestamp(),
      rawDate: Date.now(),
      email: email.trim(),
      status,
      metode: 'Formulir Pendaftaran Akun',
      perangkat: getDeviceInfo()
    };
    const updated = [item, ...list];
    try {
      localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage error on recordRegistration:', e);
    }
    return item;
  },

  clearRegistrationLogs: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_REGISTRATIONS);
    } catch {}
  },

  // --- 2. LOG PERCOBAAN LOGIN (Saat tombol "Masuk Sekarang" diklik saat loading) ---
  getLoginAttemptLogs: (): UserLoginAttemptLog[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LOGIN_ATTEMPTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  recordLoginAttempt: (email: string): string => {
    const list = userLogService.getLoginAttemptLogs();
    const id = `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const item: UserLoginAttemptLog = {
      id,
      timestamp: formatTimestamp(),
      rawDate: Date.now(),
      email: email.trim(),
      status: 'Sedang Memverifikasi',
      keterangan: 'Tombol Masuk Sekarang diklik, memulai verifikasi autentikasi.',
      perangkat: getDeviceInfo()
    };
    const updated = [item, ...list].slice(0, 100); // Batasi 100 entri terbaru
    try {
      localStorage.setItem(STORAGE_KEY_LOGIN_ATTEMPTS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage error on recordLoginAttempt:', e);
    }
    return id;
  },

  updateLoginAttemptStatus: (id: string, status: 'Berhasil Masuk' | 'Gagal (Kredensial Salah)' | 'Gagal (Sistem)', keterangan?: string) => {
    const list = userLogService.getLoginAttemptLogs();
    const updated = list.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status,
          keterangan: keterangan || (status === 'Berhasil Masuk' ? 'Verifikasi sukses, akun login aktif.' : 'Gagal memverifikasi akun.')
        };
      }
      return item;
    });
    try {
      localStorage.setItem(STORAGE_KEY_LOGIN_ATTEMPTS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage error on updateLoginAttemptStatus:', e);
    }
  },

  clearLoginAttemptLogs: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_LOGIN_ATTEMPTS);
    } catch {}
  },

  // --- 3. LOG 5 SESI LOGIN TERAKHIR (YANG BERHASIL MASUK) ---
  getSuccessfulLoginLogs: (limit: number = 5): UserSuccessfulLoginLog[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SUCCESSFUL_LOGINS);
      if (!data) {
        localStorage.setItem(STORAGE_KEY_SUCCESSFUL_LOGINS, JSON.stringify(initialSuccessfulSeed));
        return initialSuccessfulSeed.slice(0, limit);
      }
      const parsed: UserSuccessfulLoginLog[] = JSON.parse(data);
      return parsed.slice(0, limit);
    } catch {
      return initialSuccessfulSeed.slice(0, limit);
    }
  },

  recordSuccessfulLogin: (email: string) => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SUCCESSFUL_LOGINS);
      let list: UserSuccessfulLoginLog[] = data ? JSON.parse(data) : [...initialSuccessfulSeed];
      
      const item: UserSuccessfulLoginLog = {
        id: `suc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: formatTimestamp(),
        rawDate: Date.now(),
        email: email.trim(),
        status: 'Sesi Aktif',
        perangkat: getDeviceInfo(),
        ipSimulasi: '192.168.1.' + (100 + Math.floor(Math.random() * 50))
      };

      // Set item sebelumnya ke status 'Berhasil Masuk'
      list = list.map(l => ({ ...l, status: 'Berhasil Masuk' as const }));

      const updated = [item, ...list].slice(0, 20); // Simpan riwayat, Pengaturan akan mengambil 5 terakhir
      localStorage.setItem(STORAGE_KEY_SUCCESSFUL_LOGINS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Storage error on recordSuccessfulLogin:', e);
    }
  },

  clearSuccessfulLoginLogs: () => {
    try {
      localStorage.removeItem(STORAGE_KEY_SUCCESSFUL_LOGINS);
    } catch {}
  }
};
