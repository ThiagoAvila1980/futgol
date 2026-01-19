import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, width = 'md' }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 200);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    const widths = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return createPortal(
        <div className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200",
            isOpen ? "visible opacity-100" : "invisible opacity-0"
        )}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Content */}
            <div className={cn(
                "relative bg-white rounded-2xl shadow-2xl w-full border border-white/20 transform transition-all duration-300 max-h-[90vh] flex flex-col",
                widths[width],
                isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
            )}>
                {title && (
                    <div className="px-6 py-4 border-b border-navy-50 flex items-center justify-between shrink-0">
                        <h3 className="text-xl font-heading font-bold text-navy-900">{title}</h3>
                        <button
                            onClick={onClose}
                            className="text-navy-400 hover:text-navy-700 transition-colors p-1 hover:bg-navy-50 rounded-lg"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
