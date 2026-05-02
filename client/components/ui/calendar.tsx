import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendário (react-day-picker) com locale pt-BR.
 * Use `captionLayout="dropdown"` para navegação por mês/ano nos selects.
 */
function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  captionLayout = "label",
  navLayout = "around",
  ...props
}: CalendarProps) {
  const useDropdown =
    captionLayout === "dropdown" ||
    captionLayout === "dropdown-months" ||
    captionLayout === "dropdown-years";

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={ptBR}
      captionLayout={captionLayout}
      navLayout={navLayout}
      className={cn("p-2", className)}
      components={{
        Chevron: ({ className: chClass, orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chClass)} aria-hidden />
          ) : (
            <ChevronRight className={cn("size-4", chClass)} aria-hidden />
          ),
        ...components,
      }}
      classNames={{
        root: "rdp-root",
        months: "flex flex-col gap-4 md:flex-row",
        month: cn(
          "relative flex flex-col gap-3 pt-1",
          useDropdown && "gap-2"
        ),
        /** Com dropdowns, manter linha única (mês + ano); flex-col empilhava duas linhas de combos. */
        month_caption: cn(
          "flex items-center justify-center px-1 pb-2",
          useDropdown &&
            "relative flex min-h-[var(--rdp-nav-height)] flex-row flex-nowrap items-center justify-center gap-2",
          !useDropdown && "relative flex-col gap-2 px-10"
        ),
        caption_label: cn(
          "relative z-[1] inline-flex items-center whitespace-nowrap font-semibold text-navy-900",
          captionLayout === "label" && "text-sm"
        ),
        dropdowns:
          "relative inline-flex flex-nowrap items-center justify-center gap-[var(--rdp-dropdown-gap)]",
        /** Caixa visível; o <select> nativo fica invisível por cima (padrão rdp). */
        dropdown_root:
          "relative inline-flex min-h-9 min-w-[5.5rem] items-center rounded-lg border border-navy-200 bg-white px-2 shadow-sm",
        /** Não aplicar borda/opacidade aqui: quebra o overlay (opacity-0) e duplica mês/ano. */
        dropdown:
          "absolute inset-0 z-[2] m-0 w-full cursor-pointer opacity-0 appearance-none border-0 bg-transparent p-0",
        /** Posicionamento vem do style.css do pacote; não forçar relative/order que quebra layout. */
        nav: "flex items-center gap-1",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:opacity-40",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex gap-1",
        weekday: "w-9 text-center text-[0.7rem] font-semibold uppercase text-navy-400",
        week: "mt-1 flex w-full gap-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-lg font-medium text-navy-900 hover:bg-brand-50 aria-selected:opacity-100",
        selected:
          "bg-brand-600 text-white hover:bg-brand-600 hover:text-white focus:bg-brand-600 focus:text-white",
        today: "bg-navy-100 font-bold text-navy-900",
        outside: "text-navy-300 aria-selected:text-navy-300",
        disabled: "text-navy-300 opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
