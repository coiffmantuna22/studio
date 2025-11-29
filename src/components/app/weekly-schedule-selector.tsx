'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DayAvailability, TimeSlot } from '@/lib/types';
import { Button } from '../ui/button';
import { Trash2 } from 'lucide-react';

interface WeeklyScheduleSelectorProps {
  value: DayAvailability[];
  onChange: (value: DayAvailability[]) => void;
  timeSlots: TimeSlot[];
}

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

const parseTimeToNumber = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
};

const groupConsecutiveSlots = (slots: number[], allSlots: TimeSlot[]) => {
    if (slots.length === 0) return [];
    
    const sortedSlots = [...slots].sort((a,b) => a-b);
    const groups = [];
    let currentGroup: {start: number, end: number} | null = null;
    
    sortedSlots.forEach(slotIndex => {
        if(allSlots[slotIndex].type === 'break') return;

        if (currentGroup === null) {
            currentGroup = { start: slotIndex, end: slotIndex };
        } else if (slotIndex === currentGroup.end + 1) {
            currentGroup.end = slotIndex;
        } else {
            groups.push({
                start: allSlots[currentGroup.start].start,
                end: allSlots[currentGroup.end].end,
            });
            currentGroup = { start: slotIndex, end: slotIndex };
        }
    });

    if (currentGroup !== null) {
         groups.push({
            start: allSlots[currentGroup.start].start,
            end: allSlots[currentGroup.end].end,
        });
    }

    return groups;
};


export default function WeeklyScheduleSelector({ value, onChange, timeSlots }: WeeklyScheduleSelectorProps) {
  const [selectedSlots, setSelectedSlots] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const initialSlots: Record<string, number[]> = {};
    daysOfWeek.forEach(day => {
      initialSlots[day] = [];
    });

    if (Array.isArray(value)) {
        value.forEach(dayAvailability => {
            if (dayAvailability.slots && initialSlots[dayAvailability.day]) {
                dayAvailability.slots.forEach(slotRange => {
                    const startNum = parseTimeToNumber(slotRange.start);
                    const endNum = parseTimeToNumber(slotRange.end);
                    timeSlots.forEach((slot, index) => {
                        if (slot.type === 'lesson') {
                            const slotStartNum = parseTimeToNumber(slot.start);
                            if (slotStartNum >= startNum && slotStartNum < endNum) {
                                initialSlots[dayAvailability.day]?.push(index);
                            }
                        }
                    });
                });
            }
        });
    }
    setSelectedSlots(initialSlots);
  }, [value, timeSlots]);

  const handleSlotClick = (day: string, slotIndex: number) => {
    if (timeSlots[slotIndex].type === 'break') return;
    
    const newSelectedSlots = { ...selectedSlots };
    if (!newSelectedSlots[day]) {
      newSelectedSlots[day] = [];
    }

    const daySlots = newSelectedSlots[day];
    const indexInDay = daySlots.indexOf(slotIndex);

    if (indexInDay > -1) {
      daySlots.splice(indexInDay, 1);
    } else {
      daySlots.push(slotIndex);
    }

    updateAvailability(newSelectedSlots);
  };
  
  const clearDay = (day: string) => {
    const newSelectedSlots = { ...selectedSlots, [day]: [] };
    updateAvailability(newSelectedSlots);
  }

  const updateAvailability = (newSelectedSlots: Record<string, number[]>) => {
    setSelectedSlots(newSelectedSlots);
    
    const updatedAvailability: DayAvailability[] = Object.entries(newSelectedSlots).map(([day, slotIndices]) => ({
      day,
      slots: groupConsecutiveSlots(slotIndices, timeSlots),
    }));
    
    onChange(updatedAvailability);
  }
  
  const totalSlots = timeSlots.length;

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <div className="grid grid-cols-[1fr_auto] gap-x-2">
        <div className="grid text-center text-xs text-muted-foreground" style={{gridTemplateColumns: `repeat(${totalSlots}, minmax(0, 1fr))`}}>
          {timeSlots.map(time => (
            <div key={time.id}>{time.start}</div>
          ))}
        </div>
        <div className="w-24"></div>
      </div>
      {daysOfWeek.map(day => (
        <div key={day} className="grid grid-cols-[1fr_auto] items-center gap-x-2">
            <div className="grid gap-px bg-border rounded-md overflow-hidden" style={{gridTemplateColumns: `repeat(${totalSlots}, minmax(0, 1fr))`}} dir="ltr">
                {timeSlots.map((slot, index) => {
                const isSelected = selectedSlots[day]?.includes(index);
                const isBreak = slot.type === 'break';
                return (
                    <div
                    key={`${day}-${slot.id}`}
                    onClick={() => handleSlotClick(day, index)}
                    className={cn(
                        'h-7 w-full transition-colors',
                        isBreak 
                          ? 'bg-muted/50 cursor-not-allowed'
                          : 'cursor-pointer',
                        !isBreak && (isSelected ? 'bg-primary' : 'bg-card hover:bg-secondary')
                    )}
                    />
                );
                })}
            </div>
            <div className="flex items-center justify-end gap-2 w-24">
                <span className="font-semibold text-sm">{day}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => clearDay(day)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground"/>
                </Button>
            </div>
        </div>
      ))}
    </div>
  );
}
