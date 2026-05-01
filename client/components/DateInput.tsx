import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
}

const toDisplay = (iso: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const toISO = (display: string) => {
  const s = display.replace(/\s+/g, '');
  const m = s.match(/^(\d{2})[\/](\d{2})[\/]?(\d{4})$/);
  if (!m) return '';
  const dd = m[1], mm = m[2], yyyy = m[3];
  if (Number(mm) < 1 || Number(mm) > 12) return '';
  if (Number(dd) < 1 || Number(dd) > 31) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

export const DateInput: React.FC<DateInputProps> = ({ value, onChange, className, required, disabled, min, max }) => {
  const [text, setText] = useState(toDisplay(value));
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const clampISO = (iso: string) => {
    if (!iso) return '';
    const cmp = (a: string, b: string) => a.localeCompare(b);
    if (min && cmp(iso, min) < 0) return min;
    if (max && cmp(iso, max) > 0) return max;
    return iso;
  };

  const handleBlur = () => {
    const iso = toISO(text);
    if (iso) onChange(clampISO(iso));
    else if (!text) onChange('');
    else setText(toDisplay(value));
  };

  const openPicker = () => {
    if (disabled) return;
    try {
      // Try modern showPicker API
      (dateRef.current as any)?.showPicker?.();
    } catch { }
    if (dateRef.current) {
      dateRef.current.focus();
      // Fallback: trigger a click to open native picker
      dateRef.current.click();
    }
  };

  const onNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // YYYY-MM-DD
    if (iso) {
      const clamped = clampISO(iso);
      onChange(clamped);
      setText(toDisplay(clamped));
    }
  };

  const onMaskedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    // Basic mask DD/MM/YYYY
    let s = e.target.value.replace(/[^0-9]/g, '');
    if (s.length > 8) s = s.slice(0, 8);
    if (s.length >= 5) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
    else if (s.length >= 3) s = `${s.slice(0, 2)}/${s.slice(2)}`;
    setText(s);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={text}
        onChange={onMaskedChange}
        onBlur={handleBlur}
        className={`${className} pr-10`}
        required={required}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-400 hover:text-brand-600 transition-colors"
        title="Selecionar data"
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      <input
        ref={dateRef}
        type="date"
        value={value || ''}
        onChange={onNativeChange}
        className="absolute right-0 opacity-0 w-0 h-0 overflow-hidden"
        lang="pt-BR"
        min={min}
        max={max}
        tabIndex={-1}
        aria-label="Abrir calendário para esta data"
      />
    </div>
  );
};

export default DateInput;
