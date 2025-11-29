'use client';

import { useMemo } from 'react';
import type { Teacher, TimeSlot } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { daysOfWeek } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Coffee } from 'lucide-react';

interface TimetableProps {
  allTeachers: Teacher[];
  timeSlots: TimeSlot[];
}

const parseTimeToNumber = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
};

export default function Timetable({ allTeachers, timeSlots }: TimetableProps) {
  const timetableData = useMemo(() => {
    const data: Record<string, Record<string, string[]>> = {};

    daysOfWeek.forEach(day => {
      data[day] = {};
      timeSlots.forEach(slot => {
        if (slot.type !== 'break') {
          data[day][slot.start] = [];
        }
      });
    });

    allTeachers.forEach(teacher => {
      teacher.availability.forEach(availDay => {
        if (daysOfWeek.includes(availDay.day)) {
          availDay.slots.forEach(timeRange => {
            const startNum = parseTimeToNumber(timeRange.start);
            const endNum = parseTimeToNumber(timeRange.end);
            
            timeSlots.forEach(slot => {
                if (slot.type === 'lesson') {
                    const slotStartNum = parseTimeToNumber(slot.start);
                    if (slotStartNum >= startNum && slotStartNum < endNum) {
                        if (data[availDay.day]?.[slot.start]) {
                           data[availDay.day][slot.start].push(teacher.name);
                        }
                    }
                }
            });
          });
        }
      });
    });

    return data;
  }, [allTeachers, timeSlots]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-xl">זמינות כלל המורים המחליפים</CardTitle>
        <CardDescription>
          הצגת זמינות המורים המחליפים לפי שעה.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <div className="relative">
                <table className="w-full text-sm text-center table-fixed">
                    <thead>
                        <tr className="bg-muted/40">
                        <th className="sticky right-0 top-0 bg-muted/40 p-2 w-40 z-20">שעה</th>
                        {daysOfWeek.map(day => (
                            <th key={day} className="sticky top-0 bg-muted/40 p-2 min-w-[150px]">{day}</th>
                        ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(slot => (
                        <tr key={slot.id} className="border-t">
                            <td className="sticky right-0 font-semibold bg-card p-2 w-40 z-10 text-center">
                                <div>{slot.start} - {slot.end}</div>
                                {slot.type === 'break' && <Badge variant="outline" className='mt-1'>הפסקה</Badge>}
                            </td>
                            {daysOfWeek.map(day => (
                            <td key={`${day}-${slot.start}`} className={cn("p-2 align-top h-24 border-l", slot.type === 'break' && 'bg-muted/30')}>
                               {slot.type === 'break' ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground' /> : (
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {timetableData[day]?.[slot.start]?.length > 0 ? (
                                        timetableData[day][slot.start].map(teacherName => (
                                        <Badge key={teacherName} variant="secondary" className="font-normal">
                                            {teacherName}
                                        </Badge>
                                        ))
                                    ) : (
                                        <span className="text-muted-foreground text-xs opacity-70">--</span>
                                    )}
                                </div>
                               )}
                            </td>
                            ))}
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
