'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DayAvailability } from '@/lib/types';
import { Button } from '../ui/button';
import { Trash2 } from 'lucide-react';

interface WeeklyScheduleSelectorProps {
  value: DayAvailability[];
  onChange: (value: DayAvailability[]) => void;
}

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 07:00 to 18:00

const parseTimeToNumber = (time: string) => parseInt(time.split(':')[0], 10);

const groupConsecutiveSlots = (slots: number[]) => {
  if (slots.length === 0) return [];
  const sortedSlots = [...slots].sort((a, b) => a - b);
  const groups = [];
  let currentGroup = { start: sortedSlots[0], end: sortedSlots[0] };

  for (let i = 1; i < sortedSlots.length; i++) {
    if (sortedSlots[i] === currentGroup.end + 1) {
      currentGroup.end = sortedSlots[i];
    } else {
      groups.push({
        start: `${currentGroup.start.toString().padStart(2, '0')}:00`,
        end: `${(currentGroup.end + 1).toString().padStart(2, '0')}:00`,
      });
      currentGroup = { start: sortedSlots[i], end: sortedSlots[i] };
    }
  }
  groups.push({
    start: `${currentGroup.start.toString().padStart(2, '0')}:00`,
    end: `${(currentGroup.end + 1).toString().padStart(2, '0')}:00`,
  });

  return groups;
};

export default function WeeklyScheduleSelector({ value, onChange }: WeeklyScheduleSelectorProps) {
  const [selectedSlots, setSelectedSlots] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const initialSlots: Record<string, number[]> = {};
    daysOfWeek.forEach(day => {
      initialSlots[day] = [];
    });

    if (Array.isArray(value)) {
        value.forEach(dayAvailability => {
            if (dayAvailability.slots && initialSlots[dayAvailability.day]) {
                dayAvailability.slots.forEach(slot => {
                    const startHour = parseTimeToNumber(slot.start);
                    const endHour = parseTimeToNumber(slot.end);
                    for (let hour = startHour; hour < endHour; hour++) {
                    initialSlots[dayAvailability.day]?.push(hour);
                    }
                });
            }
        });
    }
    setSelectedSlots(initialSlots);
  }, [value]);

  const handleSlotClick = (day: string, hour: number) => {
    const newSelectedSlots = { ...selectedSlots };
    if (!newSelectedSlots[day]) {
      newSelectedSlots[day] = [];
    }

    const daySlots = newSelectedSlots[day];
    const slotIndex = daySlots.indexOf(hour);

    if (slotIndex > -1) {
      daySlots.splice(slotIndex, 1);
    } else {
      daySlots.push(hour);
    }

    updateAvailability(newSelectedSlots);
  };
  
  const clearDay = (day: string) => {
    const newSelectedSlots = { ...selectedSlots, [day]: [] };
    updateAvailability(newSelectedSlots);
  }

  const updateAvailability = (newSelectedSlots: Record<string, number[]>) => {
    setSelectedSlots(newSelectedSlots);
    
    const updatedAvailability: DayAvailability[] = Object.entries(newSelectedSlots).map(([day, slots]) => ({
      day,
      slots: groupConsecutiveSlots(slots),
    }));
    onChange(updatedAvailability);
  }

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className="w-24"></div> {/* Spacer for alignment */}
        <div className="grid grid-cols-12 text-center text-xs text-muted-foreground">
          {timeSlots.map(time => (
            <div key={time}>{time}</div>
          ))}
        </div>
      </div>
      {daysOfWeek.map(day => (
        <div key={day} className="grid grid-cols-[auto_1fr] items-center gap-x-2">
          <div className="flex items-center justify-end gap-2 w-24">
            <span className="font-semibold text-sm">{day}</span>
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => clearDay(day)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground"/>
             </Button>
          </div>
          <div className="grid grid-cols-12 gap-px bg-border rounded-md overflow-hidden" dir="ltr">
            {timeSlots.map((time, index) => {
              const hour = index + 7;
              const isSelected = selectedSlots[day]?.includes(hour);
              return (
                <div
                  key={`${day}-${time}`}
                  onClick={() => handleSlotClick(day, hour)}
                  className={cn(
                    'h-7 w-full cursor-pointer transition-colors',
                    isSelected ? 'bg-primary' : 'bg-card hover:bg-secondary'
                  )}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
