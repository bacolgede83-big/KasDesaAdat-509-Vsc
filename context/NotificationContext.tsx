import React, { createContext, useContext, useState, useCallback } from 'react';
import Notification from '../components/shared/Notification';
import { playSaveSuccessSound, playErrorSound, playUnsyncedSound } from '../utils/soundEffects';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationState {
  message: string;
  type: NotificationType;
  id: number;
}

export interface NotificationContextType {
  notification: NotificationState | null;
  showNotification: (message: string, type?: NotificationType) => void;
  showPermissionDenied: () => void;
  clearNotification: () => void;
}

export const PERMISSION_DENIED_MESSAGE = "Anda tidak punya izin, Hubungi Pengembang Aplikasi Bacol Enterprise System Untuk Mendapatkan Akses";

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType = 'warning') => {
    setNotification({ message, type, id: Date.now() });

    // Efek audio otomatis berdasarkan kategori notifikasi
    if (type === 'success') {
      playSaveSuccessSound();
    } else if (type === 'error') {
      playErrorSound();
    } else if (type === 'warning') {
      playUnsyncedSound();
    }
  }, []);

  const showPermissionDenied = useCallback(() => {
    showNotification(PERMISSION_DENIED_MESSAGE, 'warning');
  }, [showNotification]);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notification, showNotification, showPermissionDenied, clearNotification }}>
      {children}
      {notification && (
        <Notification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback object to avoid runtime crashes if used outside provider
    return {
      notification: null,
      showNotification: (msg: string) => alert(msg),
      showPermissionDenied: () => alert(PERMISSION_DENIED_MESSAGE),
      clearNotification: () => {}
    };
  }
  return context;
};
