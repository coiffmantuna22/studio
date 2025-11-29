
'use client';

import { useMemo, useState } from 'react';
import type { Teacher, TimeSlot, SchoolClass, SubstitutionRecord, Lesson } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { daysOfWeek } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Coffee, UserCheck, UserX } from 'lucide-react';
import { isSameDay, startOfDay, getDay, addDays, format } from 'date-fns';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from '../ui/label';

interface TimetableProps {}

interface AssignSubstituteDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    substitute: Teacher | null;
    lessonsToCover: {
        date: Date;
        time: string;
        absentTeacher: Teacher;
        lesson: Lesson;
        schoolClass: SchoolClass;
    }[];
    onConfirm: (substitute: Teacher, lessonToCover: any) => Promise<void>;
}

const AssignSubstituteDialog = ({
    isOpen,
    onOpenChange,
    substitute,
    lessonsToCover,
    onConfirm,
}: AssignSubstituteDialogProps) => {
    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!substitute || lessonsToCover.length === 0) return null;

    const handleConfirm = async () => {
      if (!selectedLessonId) return;
      const lessonToCover = lessonsToCover.find(l => `${l.schoolClass.id}-${l.lesson.subject}-${l.time}` === selectedLessonId);
      if (lessonToCover) {
        setIsSubmitting(true);
        await onConfirm(substitute, lessonToCover);
        setIsSubmitting(false);
        onOpenChange(false);
      }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>שיבוץ מורה מחליף</DialogTitle>
                    <DialogDescription>
                        שבץ את {substitute.name} להחליף בשיעור הבא.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <RadioGroup onValueChange={setSelectedLessonId}>
                        {lessonsToCover.map((l) => {
                            const id = `${l.schoolClass.id}-${l.lesson.subject}-${l.time}`;
                            return (
                                <div key={id} className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value={id} id={id} />
                                    <Label htmlFor={id} className="flex flex-col">
                                        <span>{l.schoolClass.name} - {l.lesson.subject} ({l.time})</span>
                                        <span className='text-xs text-muted-foreground'>מורה חסר: {l.absentTeacher.name}</span>
                                    </Label>
                                </div>
                            )
                        })}
                    </RadioGroup>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">ביטול</Button></DialogClose>
                    <Button onClick={handleConfirm} disabled={!selectedLessonId || isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : "אישור שיבוץ"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

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

  const [assignDialogState, setAssignDialogState] = useState<{
      isOpen: boolean;
      substitute: Teacher | null;
      lessonsToCover: any[];
  }>({ isOpen: false, substitute: null, lessonsToCover: [] });


  const teachersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: allTeachers, isLoading: teachersLoading } = useCollection<Teacher>(teachersQuery);
  
  const classesQuery = useMemoFirebase(() => user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: allClasses, isLoading: classesLoading } = useCollection<SchoolClass>(classesQuery);

  const settingsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: settingsCollection, isLoading: settingsLoading } = useCollection(settingsQuery);

  const substitutionsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'substitutions'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: allSubstitutions, isLoading: substitutionsLoading } = useCollection<SubstitutionRecord>(substitutionsQuery);


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
    const data: Record<string, Record<string, {name: string, id: string, isAbsent: boolean}[]>> = {};
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
                              data[day][slot.start].push({ name: teacher.name, id: teacher.id, isAbsent: false });
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
  }, [allTeachers, timeSlots, allClasses, allSubstitutions]);


 const openAssignDialog = (substitute: {id: string, name: string}, day: string, time: string) => {
      const weekStartDate = getStartOfWeek(new Date());
      const dayIndex = daysOfWeek.indexOf(day);
      const date = addDays(weekStartDate, dayIndex);
      
      const absentLessons = (allTeachers || [])
        .flatMap(absentTeacher => {
            const isAbsent = (absentTeacher.absences || []).some(absence => 
                isSameDay(startOfDay(new Date(absence.date)), date) &&
                (absence.isAllDay || (time >= absence.startTime && time < absence.endTime))
            );

            if (!isAbsent) return [];

            return (allClasses || []).map(schoolClass => {
                const lesson = schoolClass.schedule?.[day]?.[time];
                if (lesson && lesson.teacherId === absentTeacher.id) {
                    return { date, time, absentTeacher, lesson, schoolClass };
                }
                return null;
            }).filter(Boolean);
        });

      const substituteTeacher = allTeachers?.find(t => t.id === substitute.id)
      if (substituteTeacher) {
          setAssignDialogState({ isOpen: true, substitute: substituteTeacher, lessonsToCover: absentLessons as any[] });
      }
  };

 const handleConfirmAssignment = async (substitute: Teacher, lessonToCover: any) => {
        if (!firestore || !user) return;
        
        const { date, time, absentTeacher, lesson, schoolClass } = lessonToCover;
        const day = daysOfWeek[getDay(date)];
        
        const batch = writeBatch(firestore);

        // 1. Create substitution record
        const subRef = doc(collection(firestore, 'substitutions'));
        const newSub: Omit<SubstitutionRecord, 'id'> = {
            date: format(date, 'yyyy-MM-dd'),
            time,
            classId: schoolClass.id,
            className: schoolClass.name,
            absentTeacherId: absentTeacher.id,
            absentTeacherName: absentTeacher.name,
            substituteTeacherId: substitute.id,
            substituteTeacherName: substitute.name,
            subject: lesson.subject,
            userId: user.uid,
            createdAt: new Date().toISOString(),
        };
        batch.set(subRef, newSub);

        // 2. Update substitute's schedule
        const subTeacherRef = doc(firestore, 'teachers', substitute.id);
        const newSubSchedule = { ...substitute.schedule };
        if (!newSubSchedule[day]) newSubSchedule[day] = {};
        newSubSchedule[day][time] = { ...lesson, classId: schoolClass.id };
        batch.update(subTeacherRef, { schedule: newSubSchedule });

        await commitBatchWithContext(batch, {
            operation: 'create',
            path: `substitutions/${subRef.id}`,
            data: newSub
        });
    };

  const isLoading = teachersLoading || settingsLoading || classesLoading || substitutionsLoading;

  if (isLoading) {
      return <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <>
    <Card className="mt-6 border-none shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">זמינות מורים להחלפה</CardTitle>
        <CardDescription>
          הטבלה מציגה מורים הנוכחים בבית הספר אך אינם משובצים לשיעור או בחופש. לחץ על שם מורה כדי לשבץ אותו.
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
                            {daysOfWeek.map(day => {
                                const availableSubs = timetableData[day]?.[slot.start] || [];
                                const absentTeachersInSlot = (allTeachers || [])
                                    .filter(t => {
                                        const weekStartDate = getStartOfWeek(new Date());
                                        const dayIndex = daysOfWeek.indexOf(day);
                                        const currentDate = addDays(weekStartDate, dayIndex);
                                        const isAbsent = (t.absences || []).some(a => isSameDay(startOfDay(new Date(a.date)), currentDate) && (a.isAllDay || (slot.start >= a.startTime && slot.start < a.endTime)));
                                        const isScheduled = t.schedule?.[day]?.[slot.start];
                                        return isAbsent && isScheduled;
                                    });

                                return (
                                <td key={`${day}-${slot.start}`} className={cn("p-2 align-top h-24 border-r", slot.type === 'break' && 'bg-muted/30')}>
                                {slot.type === 'break' ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground' /> : (
                                    <div className="flex flex-col items-center gap-1.5 justify-center">
                                        {absentTeachersInSlot.map(teacher => (
                                            <Badge key={teacher.id} variant={'destructive'} className="font-normal">
                                                <UserX className="h-3 w-3 ml-1" />
                                                {teacher.name} (חסר/ה)
                                            </Badge>
                                        ))}
                                        {availableSubs.map(teacher => (
                                           <Button 
                                             key={teacher.id} 
                                             variant={'secondary'} 
                                             size="sm" 
                                             className="h-auto px-2 py-1 font-normal"
                                             onClick={() => openAssignDialog(teacher, day, slot.start)}
                                            >
                                                <UserCheck className="h-3 w-3 ml-1" />
                                                {teacher.name}
                                           </Button>
                                        ))}
                                        {availableSubs.length === 0 && absentTeachersInSlot.length === 0 && (
                                            <span className="text-muted-foreground text-xs opacity-70">--</span>
                                        )}
                                    </div>
                                )}
                                </td>
                                )
                            })}
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
    <AssignSubstituteDialog 
        isOpen={assignDialogState.isOpen}
        onOpenChange={(isOpen) => setAssignDialogState(s => ({...s, isOpen}))}
        substitute={assignDialogState.substitute}
        lessonsToCover={assignDialogState.lessonsToCover}
        onConfirm={handleConfirmAssignment}
    />
    </>
  );
}
