import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function parseIsoDateOnly(iso: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

export function toIsoDateOnly(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Aceita DD/MM/AAAA digitado; devolve ISO ou null se incompleto/inválido. */
export function parseDisplayDateToIso(display: string): string | null {
  const s = display.replace(/\s+/g, "");
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  const yyyy = m[3];
  const mi = Number(mm);
  const di = Number(dd);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  const test = new Date(Number(yyyy), mi - 1, di);
  if (
    test.getFullYear() !== Number(yyyy) ||
    test.getMonth() !== mi - 1 ||
    test.getDate() !== di
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function maskDigitsToDisplay(raw: string): string {
  let s = raw.replace(/\D/g, "").slice(0, 8);
  if (s.length >= 5) return `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4)}`;
  if (s.length >= 3) return `${s.slice(0, 2)}/${s.slice(2)}`;
  return s;
}

function clampIso(iso: string, min?: string, max?: string): string {
  let v = iso;
  if (min && v < min) v = min;
  if (max && v > max) v = max;
  return v;
}

export interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
}

/**
 * Campo de data estilo shadcn: digitação DD/MM/AAAA + popover com calendário
 * (setas e selects de mês/ano quando aplicável).
 */
export function DatePicker({
  value,
  onChange,
  className,
  required,
  disabled,
  min,
  max,
  id,
  placeholder = "DD/MM/AAAA",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => isoToDisplay(value));

  React.useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const selected = parseIsoDateOnly(value);

  const disabledDays = React.useMemo<Matcher | Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (min) {
      const d = parseIsoDateOnly(min);
      if (d) matchers.push({ before: d });
    }
    if (max) {
      const d = parseIsoDateOnly(max);
      if (d) matchers.push({ after: d });
    }
    return matchers.length ? matchers : undefined;
  }, [min, max]);

  const navigationStart = min ? parseIsoDateOnly(min) : undefined;
  const navigationEnd = max ? parseIsoDateOnly(max) : undefined;

  const commitText = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const iso = parseDisplayDateToIso(trimmed);
    if (!iso) {
      setText(isoToDisplay(value));
      return;
    }
    onChange(clampIso(iso, min, max));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(maskDigitsToDisplay(e.target.value));
  };

  return (
    <div className={cn("relative flex w-full gap-2", className)}>
      {required ? (
        <input
          type="text"
          name={`${id ?? "date"}-required`}
          value={value}
          readOnly
          required
          tabIndex={-1}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          aria-hidden
        />
      ) : null}
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={onInputChange}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="min-h-[2.75rem] flex-1 font-medium tabular-nums"
        aria-invalid={text.length > 0 && text.length >= 10 && !parseDisplayDateToIso(text)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="shrink-0"
            aria-label="Abrir calendário"
          >
            <CalendarIcon className="size-4 text-navy-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            navLayout="around"
            selected={selected}
            startMonth={navigationStart}
            endMonth={navigationEnd}
            onSelect={(d) => {
              if (d) {
                const iso = clampIso(toIsoDateOnly(d), min, max);
                onChange(iso);
                setText(isoToDisplay(iso));
              } else {
                onChange("");
                setText("");
              }
              setOpen(false);
            }}
            disabled={disabledDays}
            defaultMonth={selected ?? navigationStart ?? new Date()}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
