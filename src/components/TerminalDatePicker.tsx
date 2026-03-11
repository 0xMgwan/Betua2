"use client";
import { useState, forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";

interface TerminalDatePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  locale?: "en" | "sw";
}

// Custom input component with terminal styling
const TerminalInput = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
  ({ value, onClick }, ref) => (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className="w-full text-left px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent)]/30 transition-colors font-mono text-sm font-bold text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]/50 flex items-center gap-3 group"
    >
      <CalendarBlank size={14} weight="fill" className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors" />
      <span>{value || "SELECT DATE & TIME"}</span>
    </button>
  )
);
TerminalInput.displayName = "TerminalInput";

export function TerminalDatePicker({ selected, onChange, minDate, locale = "en" }: TerminalDatePickerProps) {
  const [startDate, setStartDate] = useState<Date | null>(selected);

  const handleChange = (date: Date | null) => {
    setStartDate(date);
    onChange(date);
  };

  return (
    <div className="terminal-datepicker">
      <DatePicker
        selected={startDate}
        onChange={handleChange}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={5}
        dateFormat="dd/MM/yyyy, HH:mm"
        minDate={minDate}
        customInput={<TerminalInput />}
        calendarClassName="terminal-calendar"
        popperClassName="terminal-popper"
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[var(--card-border)] bg-[var(--card)]">
            <button
              type="button"
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
              className="p-1 hover:bg-[var(--background)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <CaretLeft size={14} weight="bold" className="text-[var(--accent)]" />
            </button>
            <span className="text-xs font-mono font-bold text-[var(--accent)] uppercase tracking-wider">
              {date.toLocaleString(locale === "sw" ? "sw-TZ" : "en-US", { month: "short", year: "numeric" }).toUpperCase()}
            </span>
            <button
              type="button"
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
              className="p-1 hover:bg-[var(--background)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <CaretRight size={14} weight="bold" className="text-[var(--accent)]" />
            </button>
          </div>
        )}
      />
    </div>
  );
}
