import React, { useState, useEffect } from "react";
import { format, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, subYears } from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DateRange {
  startDate: string; // Format 'yyyy-MM-dd'
  endDate: string;
}

interface DateRangeFilterProps {
  initialRange?: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ 
  initialRange, 
  onChange,
  className = "" 
}) => {
  const [startDate, setStartDate] = useState(initialRange?.startDate || format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initialRange?.endDate || format(new Date(), "yyyy-MM-dd"));
  
  // Quick presets in English
  const quickSelects = [
    { label: "Today", getRange: () => ({ start: new Date(), end: new Date() }) },
    { label: "This Week", getRange: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
    { label: "This Month", getRange: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
    { label: "This Year", getRange: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
    { label: "Last Year", getRange: () => ({ start: startOfYear(subYears(new Date(), 1)), end: endOfYear(subYears(new Date(), 1)) }) },
    { label: "All Time", getRange: () => ({ start: new Date(2020, 0, 1), end: new Date() }) }, // Using a past date as "All Time"
  ];

  useEffect(() => {
     if (initialRange) {
         setStartDate(initialRange.startDate);
         setEndDate(initialRange.endDate);
     }
  }, [initialRange]);

  const handleApply = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    onChange({ startDate: newStart, endDate: newEnd });
  };

  const handleQuickSelect = (getRange: () => { start: Date; end: Date }) => {
    const range = getRange();
    handleApply(format(range.start, "yyyy-MM-dd"), format(range.end, "yyyy-MM-dd"));
  };

  return (
    <div className={`flex flex-col xl:flex-row items-center gap-4 p-4 bg-card border rounded-xl shadow-sm ${className}`}>
      <div className="flex flex-col sm:flex-row items-center gap-4 mr-auto w-full xl:w-auto">
        {/* Start Date */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[140px] w-full">
          <Label className="text-[11px] font-bold text-primary uppercase flex items-center gap-1.5 tracking-wider">
             <Calendar className="h-3.5 w-3.5" /> Start Date
          </Label>
          <Input 
             type="date" 
             value={startDate} 
             onChange={(e) => handleApply(e.target.value, endDate)} 
             className="h-10 text-sm focus-visible:ring-1" 
          />
        </div>
        
        {/* End Date */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[140px] w-full">
          <Label className="text-[11px] font-bold text-primary uppercase flex items-center gap-1.5 tracking-wider">
             <Calendar className="h-3.5 w-3.5" /> End Date
          </Label>
          <Input 
             type="date" 
             value={endDate} 
             onChange={(e) => handleApply(startDate, e.target.value)} 
             className="h-10 text-sm focus-visible:ring-1" 
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-2 xl:mt-0">
        {quickSelects.map((select) => (
          <Button 
            key={select.label} 
            variant="ghost" 
            size="sm" 
            className="text-sm font-medium whitespace-nowrap px-3 hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={() => handleQuickSelect(select.getRange)}
          >
            {select.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
