import React from 'react';
import { Input, InputProps } from './Input';

export const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
        // (99) 9999-9999
        return digits
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 14);
    } else {
        // (99) 99999-9999
        return digits
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 15);
    }
};

interface PhoneInputProps extends Omit<InputProps, 'onChange'> {
    value: string;
    onChange: (value: string) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(({ value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhone(e.target.value);
        onChange(formatted);
    };

    return (
        <Input
            {...props}
            ref={ref}
            type="tel"
            value={formatPhone(value)}
            onChange={handleChange}
            maxLength={15}
        />
    );
});
