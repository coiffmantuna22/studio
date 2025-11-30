
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { DayAvailability, TimeSlot } from '@/lib/types';
import { Button } from '../ui/button';
import { Trash2, Plus } from 'lucide-react';
import { Input } from '../ui/input';

interface WeeklyScheduleSelectorProps {
  value: DayAvailability[];
  onChange: (value: DayAvailability[]) => void;
  timeSlots: TimeSlot[]; // Kept for potential future use, but not used in new UI
}

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

export default function WeeklyScheduleSelector({ value, onChange }: WeeklyScheduleSelectorProps) {
  const [dayAvailabilities, setDayAvailabilities] = useState<DayAvailability[]>([]);

  useEffect(() => {
    // Initialize with a full structure for all days if value is empty
    if (value && value.length > 0) {
      setDayAvailabilities(value);
    } else {
      setDayAvailabilities(daysOfWeek.map(day => ({ day, slots: [] })));
    }
  }, [value]);

  const updateAvailability = (newAvailabilities: DayAvailability[]) => {
    setDayAvailabilities(newAvailabilities);
    onChange(newAvailabilities);
  };

  const addSlot = (day: string) => {
    const newAvailabilities = dayAvailabilities.map(d => {
      if (d.day === day) {
        return {
          ...d,
          slots: [...d.slots, { start: '08:00', end: '16:00' }]
        };
      }
      return d;
    });
    updateAvailability(newAvailabilities);
  };

  const removeSlot = (day: string, slotIndex: number) => {
    const newAvailabilities = dayAvailabilities.map(d => {
      if (d.day === day) {
        return {
          ...d,
          slots: d.slots.filter((_, index) => index !== slotIndex)
        };
      }
      return d;
    });
    updateAvailability(newAvailabilities);
  };

  const handleSlotChange = (day: string, slotIndex: number, part: 'start' | 'end', time: string) => {
    const newAvailabilities = dayAvailabilities.map(d => {
      if (d.day === day) {
        const newSlots = [...d.slots];
        newSlots[slotIndex] = { ...newSlots[slotIndex], [part]: time };
        return { ...d, slots: newSlots };
      }
      return d;
    });
    updateAvailability(newAvailabilities);
  };
  
  const clearDay = (day: string) => {
     const newAvailabilities = dayAvailabilities.map(d => {
      if (d.day === day) {
        return { ...d, slots: [] };
      }
      return d;
    });
    updateAvailability(newAvailabilities);
  }

  return (
    <div className="space-y-4" dir="rtl">
      {daysOfWeek.map(day => {
        const currentDayAvailability = dayAvailabilities.find(d => d.day === day) || { day, slots: [] };
        
        return (
            <div key={day} className="p-4 border rounded-lg bg-background">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold">{day}</h4>
                    <div className='flex items-center gap-2'>
                        <Button type="button" variant="outline" size="sm" onClick={() => addSlot(day)}>
                            <Plus className="ml-1 h-4 w-4" />
                            הוסף טווח
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => clearDay(day)}>
                             <Trash2 className="h-4 w-4 text-muted-foreground"/>
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    {currentDayAvailability.slots.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">אין שעות נוכחות ליום זה</p>
                    ) : (
                        currentDayAvailability.slots.map((slot, index) => (
                            <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
                                <Input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) => handleSlotChange(day, index, 'start', e.target.value)}
                                    className="h-9"
                                />
                                <span className="text-muted-foreground">-</span>
                                <Input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) => handleSlotChange(day, index, 'end', e.target.value)}
                                    className="h-9"
                                />
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSlot(day, index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )
      })}
    </div>
  );
}
