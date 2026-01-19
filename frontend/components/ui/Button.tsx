import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    className,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-heading font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

    const variants = {
        primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40 focus-visible:ring-brand-600',
        secondary: 'bg-navy-800 hover:bg-navy-900 text-white shadow-lg shadow-navy-800/20 hover:shadow-navy-800/40 focus-visible:ring-navy-800',
        outline: 'border-2 border-navy-200 hover:border-brand-600 text-navy-700 hover:text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-500',
        ghost: 'text-navy-600 hover:bg-navy-100 hover:text-navy-900 focus-visible:ring-navy-500',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 focus-visible:ring-red-600',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs gap-1.5',
        md: 'px-5 py-2.5 text-sm gap-2',
        lg: 'px-6 py-3.5 text-base gap-2.5',
    };

    return (
        <button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin -ml-1 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </button>
    );
};
