import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, children, hoverEffect = false, ...props }) => {
    return (
        <div
            className={cn(
                "bg-white rounded-2xl border border-navy-100 shadow-premium p-6",
                hoverEffect && "transition-transform hover:-translate-y-1 hover:shadow-premium-hover cursor-pointer",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
