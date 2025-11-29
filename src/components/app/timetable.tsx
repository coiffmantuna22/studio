'use client';

import { useMemo } from 'react';
import type { Teacher } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { timeSlots, daysOfWeek } from '@/lib/constants';

interface TimetableProps {
  allTeachers: Teacher[];
}

const parseTimeToNumber = (time: string) => parseInt(time.split(':')[0], 10);

export default function Timetable({ allTeachers }: TimetableProps) {
  const timetableData = useMemo(() => {
    const data: Record<string, Record<string, string[]>> = {};

    daysOfWeek.forEach(day => {
      data[day] = {};
      timeSlots.forEach(slot => {
        data[day][slot] = [];
      });
    });

    allTeachers.forEach(teacher => {
      teacher.availability.forEach(availDay => {
        if (daysOfWeek.includes(availDay.day)) {
          availDay.slots.forEach(timeRange => {
            const startHour = parseTimeToNumber(timeRange.start);
            const endHour = parseTimeToNumber(timeRange.end);
            for (let hour = startHour; hour < endHour; hour++) {
              const slot = `${hour.toString().padStart(2, '0')}:00`;
              if (data[availDay.day][slot]) {
                data[availDay.day][slot].push(teacher.name);
              }
            }
          });
        }
      });
    });

    return data;
  }, [allTeachers]);

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
                    <thead className='bg-muted/50'>
                        <tr>
                        <th className="sticky right-0 bg-muted/50 p-2 w-24 z-10 font-semibold">שעה</th>
                        {daysOfWeek.map(day => (
                            <th key={day} className="p-2 min-w-[150px] font-semibold">{day}</th>
                        ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(time => (
                        <tr key={time} className="border-t">
                            <td className="sticky right-0 font-semibold bg-card p-2 w-24 z-10">{time}</td>
                            {daysOfWeek.map(day => (
                            <td key={`${day}-${time}`} className="p-2 align-top h-24 border-l">
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {timetableData[day]?.[time]?.length > 0 ? (
                                        timetableData[day][time].map(teacherName => (
                                        <Badge key={teacherName} variant="secondary" className="font-normal">
                                            {teacherName}
                                        </Badge>
                                        ))
                                    ) : (
                                        <span className="text-muted-foreground text-xs opacity-70">--</span>
                                    )}
                                </div>
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
