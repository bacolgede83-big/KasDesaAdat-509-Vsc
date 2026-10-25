
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // 5 seconds auto dismiss
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const getStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shadow-emerald-100/50 dark:shadow-none';
      case 'error':
        return 'bg-rose-50 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 shadow-rose-100/50 dark:shadow-none';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 shadow-amber-100/50 dark:shadow-none';
      case 'info':
      default:
        return 'bg-sky-50 dark:bg-sky-950/90 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800 shadow-sky-100/50 dark:shadow-none';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'info': default: return <Info className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
    }
  };

  return (
    <div 
      onClick={onClose}
      className={`no-print print:hidden fixed top-6 right-6 z-[9999] w-[calc(100vw-3rem)] md:w-96 flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-opacity-95 transition-all duration-300 shadow-2xl backdrop-blur-md ${getStyle()} animate-fade-in-up`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        {getIcon()}
        <span className="text-xs font-semibold leading-relaxed">{message}</span>
      </div>
      <button 
        onClick={(e) => {
            e.stopPropagation();
            onClose();
        }} 
        className="hover:opacity-75 transition-opacity p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 shrink-0 ml-2"
      >
        <X className="w-4 h-4 opacity-60" />
      </button>
    </div>
  );
};

export default Notification;
