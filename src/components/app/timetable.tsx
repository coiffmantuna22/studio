
'use client';

import { useMemo } from 'react';
import type { Teacher, TimeSlot } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { daysOfWeek } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Coffee, UserCheck } from 'lucide-react';
import { isSameDay, startOfDay, getDay, addDays } from 'date-fns';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2 } from 'lucide-react';

interface TimetableProps {}

const parseTimeToNumber = (time: string) => {
    if (!time || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
};

const getStartOfWeek = (date: Date): Date => {
    const day = getDay(date); // Sunday is 0, Saturday is 6
    if (day === 6) { // If it's Saturday, start from next Sunday
        return startOfDay(addDays(date, 1));
    }
    const diff = date.getDate() - day;
    return startOfDay(new Date(date.setDate(diff)));
}

export default function Timetable({}: TimetableProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const teachersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: allTeachers, isLoading: teachersLoading } = useCollection<Teacher>(teachersQuery);
  
  const settingsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: settingsCollection, isLoading: settingsLoading } = useCollection(settingsQuery);

  const timeSlots: TimeSlot[] = useMemo(() => {
    if (settingsCollection) {
      const settingsDoc = settingsCollection.find(d => d.id === `timetable_${user?.uid}`);
      if (settingsDoc) {
        return settingsDoc.slots || [];
      }
    }
    return [];
  }, [settingsCollection, user]);


  const timetableData = useMemo(() => {
    const data: Record<string, Record<string, {name: string, isAbsent: boolean}[]>> = {};
    const weekStartDate = getStartOfWeek(new Date());

    daysOfWeek.forEach((day) => {
      data[day] = {};
      timeSlots.forEach(slot => {
        if (slot.type !== 'break') {
          data[day][slot.start] = [];
        }
      });
    });

    (allTeachers || []).forEach(teacher => {
      daysOfWeek.forEach((day, dayIndex) => {
        const currentDate = addDays(weekStartDate, dayIndex);
        const availabilityForDay = teacher.availability.find(a => a.day === day);
        
        const absencesForCurrentDate = (teacher.absences || []).filter(absence => 
            isSameDay(startOfDay(new Date(absence.date)), currentDate)
        );

        if (availabilityForDay) {
          availabilityForDay.slots.forEach(timeRange => {
            const startNum = parseTimeToNumber(timeRange.start);
            const endNum = parseTimeToNumber(timeRange.end);
            
            timeSlots.forEach(slot => {
                if (slot.type === 'lesson') {
                    const slotStartNum = parseTimeToNumber(slot.start);

                    if (slotStartNum >= startNum && slotStartNum < endNum) {
                        const isTeaching = teacher.schedule?.[day]?.[slot.start];

                        let isAbsent = false;
                        if (absencesForCurrentDate.length > 0) {
                            isAbsent = absencesForCurrentDate.some(absence => {
                                if (absence.isAllDay) return true;
                                const absenceStart = parseTimeToNumber(absence.startTime);
                                const absenceEnd = parseTimeToNumber(absence.endTime);
                                return slotStartNum >= absenceStart && slotStartNum < absenceEnd;
                            });
                        }

                        if (!isTeaching && !isAbsent) {
                            if (data[day]?.[slot.start]) {
                              data[day][slot.start].push({ name: teacher.name, isAbsent: false });
                            }
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

  if (teachersLoading || settingsLoading) {
      return <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <Card className="mt-6 border-none shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">זמינות מורים להחלפה</CardTitle>
        <CardDescription>
          הטבלה מציגה מורים הנוכחים בבית הספר אך אינם משובצים לשיעור או בחופש.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-center table-fixed min-w-[900px]">
                    <thead>
                        <tr className="bg-muted/40">
                        <th className="sticky left-0 top-0 bg-muted/40 p-2 w-40 z-20">שעה</th>
                        {daysOfWeek.map(day => (
                            <th key={day} className="sticky top-0 bg-muted/40 p-2 min-w-[150px]">{day}</th>
                        ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map(slot => (
                        <tr key={slot.id} className="border-t">
                            <td className="sticky left-0 font-semibold bg-card p-2 w-40 z-10 text-center">
                                <div>{slot.start} - {slot.end}</div>
                                {slot.type === 'break' && <Badge variant="outline" className='mt-1'>הפסקה</Badge>}
                            </td>
                            {daysOfWeek.map(day => (
                            <td key={`${day}-${slot.start}`} className={cn("p-2 align-top h-24 border-r", slot.type === 'break' && 'bg-muted/30')}>
                               {slot.type === 'break' ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground' /> : (
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {timetableData[day]?.[slot.start]?.length > 0 ? (
                                        timetableData[day][slot.start].map(teacher => (
                                        <Badge key={teacher.name} variant={'secondary'} className="font-normal">
                                            <UserCheck className="h-3 w-3 ml-1" />
                                            {teacher.name}
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
