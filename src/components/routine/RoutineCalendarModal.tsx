"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from "lucide-react";
import { formatDateKey } from "@/lib/routineStorage";

interface RoutineCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  dateMap: Record<string, { total: number; completed: number; hasStudy: boolean; hasNormal: boolean }>;
}

export function RoutineCalendarModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
  dateMap,
}: RoutineCalendarModalProps) {
  const [selY, selM] = selectedDate.split("-").map(Number);
  const [viewYear, setViewYear] = useState<number>(selY);
  const [viewMonth, setViewMonth] = useState<number>(selM - 1); // 0-indexed

  if (!isOpen) return null;

  const todayStr = formatDateKey(new Date());

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onSelectDate(todayStr);
    onClose();
  };

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Calculate days for the month grid
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sun
  // Convert so Monday is 0: (day + 6) % 7
  const startOffset = (firstDayOfWeek + 6) % 7;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const days: Array<{
    dayNumber: number;
    dateKey: string;
    isCurrentMonth: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevM = viewMonth === 0 ? 12 : viewMonth;
    const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateKey = `${prevY}-${String(prevM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ dayNumber: d, dateKey, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ dayNumber: d, dateKey, isCurrentMonth: true });
  }

  // Next month leading days to complete grid (multiples of 7)
  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextM = viewMonth === 11 ? 1 : viewMonth + 2;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateKey = `${nextY}-${String(nextM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ dayNumber: d, dateKey, isCurrentMonth: false });
  }

  const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm rounded-3xl bg-card border border-white/10 shadow-2xl p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h3 className="font-black text-lg text-foreground">Select Day</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close calendar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between my-3 px-1">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold tracking-wide text-foreground">
            {monthName}
          </span>

          <button
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {weekLabels.map((lbl, idx) => (
            <span
              key={idx}
              className="text-[11px] font-bold text-muted-foreground uppercase py-1"
            >
              {lbl}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ dayNumber, dateKey, isCurrentMonth }) => {
            const isSelected = dateKey === selectedDate;
            const isToday = dateKey === todayStr;
            const data = dateMap[dateKey];
            const hasStudy = data?.hasStudy;
            const hasNormal = data?.hasNormal;
            const isAllCompleted = data && data.total > 0 && data.completed === data.total;

            return (
              <button
                key={dateKey}
                onClick={() => {
                  onSelectDate(dateKey);
                  onClose();
                }}
                className={`relative flex flex-col items-center justify-center h-10 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : isToday
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : isCurrentMonth
                    ? "text-foreground hover:bg-white/10"
                    : "text-muted-foreground/40 hover:bg-white/5"
                }`}
              >
                <span>{dayNumber}</span>

                {/* Day status dots / indicators */}
                <div className="flex items-center gap-0.5 mt-0.5 h-1">
                  {isAllCompleted ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-white" : "bg-emerald-400"
                      }`}
                    />
                  ) : (
                    <>
                      {hasStudy && (
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? "bg-white" : "bg-violet-400"
                          }`}
                        />
                      )}
                      {hasNormal && (
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? "bg-white/70" : "bg-zinc-400"
                          }`}
                        />
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Legend & Quick Jump */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Study
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> Normal
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Done
            </span>
          </div>

          <button
            onClick={handleJumpToday}
            className="font-bold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
          >
            Jump to Today
          </button>
        </div>
      </div>
    </div>
  );
}

