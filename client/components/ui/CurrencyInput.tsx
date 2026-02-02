import React from 'react';
import { Input } from './Input';

interface CurrencyInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
    label,
    value,
    onChange,
    placeholder,
    required,
    className
}) => {
    // Converts string value (cents) to BRL format (ex: "1250" -> "12,50")
    const formatDisplay = (val: string) => {
        const cleanValue = val.replace(/\D/g, '') || '0';
        const amount = parseInt(cleanValue, 10) / 100;

        return amount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Get only digits
        const rawValue = e.target.value.replace(/\D/g, '');

        // Prevent leading zeros unless the value is just "0"
        const finalValue = rawValue.replace(/^0+/, '') || '0';

        if (finalValue.length > 12) return;
        onChange(finalValue);
    };

    return (
        <Input
            label={label}
            value={formatDisplay(value)}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            className={className}
            icon={<span className="text-navy-400 font-bold text-xs">R$</span>}
        />
    );
};
