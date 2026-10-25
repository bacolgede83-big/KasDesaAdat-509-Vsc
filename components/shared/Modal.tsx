
import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string; // Optional prop for custom width/classes
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
    if (!isOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 bg-black/70 z-[99999] flex justify-center items-center backdrop-blur-sm p-4 print:p-0 print:bg-transparent print:static print:block print:inset-auto print:z-auto" 
            onClick={onClose}
        >
            <div 
                className={`bg-white rounded-lg shadow-xl w-full m-4 border border-gray-700 animate-fade-in-up flex flex-col max-h-[90vh] print:bg-transparent print:p-0 print:m-0 print:border-none print:shadow-none print:max-h-none print:w-full print:static ${className || 'max-w-2xl'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b-2 border-teal-500 no-print">
                    <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar print:p-0 print:overflow-visible">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
