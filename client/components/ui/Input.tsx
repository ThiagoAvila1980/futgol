import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, label, error, icon, rightIcon, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={inputId} className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    id={inputId}
                    ref={ref}
                    className={cn(
                        "w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium",
                        icon && "pl-11",
                        rightIcon && "pr-11",
                        error && "border-red-300 focus:ring-red-500/20 focus:border-red-500",
                        className
                    )}
                    {...props}
                />
                {icon && (
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400">
                        {icon}
                    </div>
                )}
                {rightIcon && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-400">
                        {rightIcon}
                    </div>
                )}
            </div>
            {error && <p className="mt-1.5 ml-1 text-xs font-medium text-red-500 flex items-center gap-1">⚠️ {error}</p>}
        </div>
    );
});
