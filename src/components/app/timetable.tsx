
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Teacher, TimeSlot, SchoolClass, SubstitutionRecord, Lesson } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { daysOfWeek } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Coffee, UserCheck, UserX, Home } from 'lucide-react';
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

    useEffect(() => {
        if(isOpen) {
            setSelectedLessonId(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!substitute) return null;

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
                        {lessonsToCover.length > 0 ? `שבץ את ${substitute.name} להחליף באחד מהשיעורים הבאים.` : 'לא נמצאו שיעורים הדורשים החלפה כעת.'}
                    </DialogDescription>
                </DialogHeader>
                {lessonsToCover.length > 0 && (
                  <div className="py-4">
                      <RadioGroup onValueChange={setSelectedLessonId}>
                          {lessonsToCover.map((l, index) => {
                              const id = `${l.schoolClass.id}-${l.lesson.subject}-${l.time}`;
                              return (
                                  <div key={`${id}-${index}`} className="flex items-center space-x-2 space-x-reverse">
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
                )}
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">ביטול</Button></DialogClose>
                    {lessonsToCover.length > 0 ? (
                      <Button onClick={handleConfirm} disabled={!selectedLessonId || isSubmitting}>
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : "אישור שיבוץ"}
                      </Button>
                    ) : (
                      <Button onClick={() => onOpenChange(false)}>הבנתי</Button>
                    )}
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
    return startOfDay(new Date(new Date(date).setDate(diff)));
}

export default function Timetable({}: TimetableProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [assignDialogState, setAssignDialogState] = useState<{
      isOpen: boolean;
      substitute: Teacher | null;
      lessonsToCover: any[];
  }>({ isOpen: false, substitute: null, lessonsToCover: [] });
  const [availabilityFilter, setAvailabilityFilter] = useState('in_school'); // 'in_school' or 'all_not_teaching'


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

  const uncoveredLessons = useMemo(() => {
    const uncovered = new Map<string, { teacher: Teacher; lesson: Lesson }[]>();
    if (!allTeachers || !allSubstitutions) return uncovered;

    const weekStartDate = getStartOfWeek(new Date());

    allTeachers.forEach(teacher => {
      (teacher.absences || []).forEach(absence => {
        const absenceDate = startOfDay(new Date(absence.date as string));
        const dayOfWeek = daysOfWeek[getDay(absenceDate)];
        
        const dayDifference = (getDay(absenceDate) - getDay(weekStartDate) + 7) % 7;
        if(dayDifference < 0 || dayDifference >= daysOfWeek.length) return;

        const daySchedule = teacher.schedule?.[dayOfWeek] || {};

        Object.keys(daySchedule).forEach(time => {
          const lesson = daySchedule[time];
          if(lesson) {
            const slotStartNum = parseTimeToNumber(time);
            const isAbsentDuringLesson = absence.isAllDay || (
              slotStartNum >= parseTimeToNumber(absence.startTime) && 
              slotStartNum < parseTimeToNumber(absence.endTime)
            );

            if (isAbsentDuringLesson) {
               const isCovered = allSubstitutions.some(sub => 
                  isSameDay(startOfDay(new Date(sub.date)), absenceDate) &&
                  sub.time === time &&
                  sub.classId === lesson.classId
                );

                if (!isCovered) {
                  const key = `${dayOfWeek}-${time}`;
                  if (!uncovered.has(key)) {
                    uncovered.set(key, []);
                  }
                  uncovered.get(key)!.push({ teacher, lesson });
                }
            }
          }
        });
      });
    });

    return uncovered;
  }, [allTeachers, allSubstitutions, timeSlots]);


  const timetableData = useMemo(() => {
    const data: Record<string, Record<string, {name: string, id: string, isInSchool: boolean}[]>> = {};
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
        
        const absencesForCurrentDate = (teacher.absences || []).filter(absence => 
            isSameDay(startOfDay(new Date(absence.date as string)), currentDate)
        );

        timeSlots.forEach(slot => {
            if (slot.type === 'lesson') {
                const slotStartNum = parseTimeToNumber(slot.start);

                const isTeaching = teacher.schedule?.[day]?.[slot.start];
                if(isTeaching) return; // Skip if they are teaching

                let isAbsent = false;
                if (absencesForCurrentDate.length > 0) {
                    isAbsent = absencesForCurrentDate.some(absence => {
                        if (absence.isAllDay) return true;
                        const absenceStart = parseTimeToNumber(absence.startTime);
                        const absenceEnd = parseTimeToNumber(absence.endTime);
                        return slotStartNum >= absenceStart && slotStartNum < absenceEnd;
                    });
                }
                if(isAbsent) return; // Skip if they are absent

                const isSubstituting = (allSubstitutions || []).some(sub => 
                    sub.substituteTeacherId === teacher.id &&
                    isSameDay(startOfDay(new Date(sub.date)), currentDate) &&
                    sub.time === slot.start
                );
                if(isSubstituting) return; // Skip if they are substituting

                const availabilityForDay = teacher.availability.find(a => a.day === day);
                const isPresent = availabilityForDay?.slots.some(presenceSlot => {
                  const startNum = parseTimeToNumber(presenceSlot.start);
                  const endNum = parseTimeToNumber(presenceSlot.end);
                  return slotStartNum >= startNum && slotStartNum < endNum;
                });
                
                if (availabilityFilter === 'in_school') {
                  if (isPresent) {
                    data[day]?.[slot.start]?.push({ name: teacher.name, id: teacher.id, isInSchool: true });
                  }
                } else if (availabilityFilter === 'all_not_teaching') {
                  data[day]?.[slot.start]?.push({ name: teacher.name, id: teacher.id, isInSchool: !!isPresent });
                }
            }
        });
      });
    });

    return data;
  }, [allTeachers, timeSlots, allSubstitutions, availabilityFilter]);


 const openAssignDialog = (substitute: {id: string, name: string}, day: string, time: string) => {
    const weekStartDate = getStartOfWeek(new Date());
    const dayIndex = daysOfWeek.indexOf(day);
    const date = addDays(weekStartDate, dayIndex);
    
    const lessonsToCover: any[] = [];
    
    (allTeachers || []).forEach(absentTeacher => {
        const isAbsentNow = (absentTeacher.absences || []).some(absence =>
            isSameDay(startOfDay(new Date(absence.date as string)), date) &&
            (absence.isAllDay || (time >= absence.startTime && time < absence.endTime))
        );

        if (isAbsentNow) {
            const lesson = absentTeacher.schedule?.[day]?.[time];
            if (lesson && lesson.classId) {
                const schoolClass = (allClasses || []).find(c => c.id === lesson.classId);
                if (schoolClass) {
                    const isCovered = (allSubstitutions || []).some(sub => 
                        isSameDay(startOfDay(new Date(sub.date)), date) &&
                        sub.time === time &&
                        sub.classId === schoolClass.id
                    );

                    if (!isCovered) {
                        lessonsToCover.push({ date, time, absentTeacher, lesson, schoolClass });
                    }
                }
            }
        }
    });

    const substituteTeacher = allTeachers?.find(t => t.id === substitute.id);
    if (substituteTeacher) {
        setAssignDialogState({ isOpen: true, substitute: substituteTeacher, lessonsToCover });
    }
};


 const handleConfirmAssignment = async (substitute: Teacher, lessonToCover: any) => {
        if (!firestore || !user) return;
        
        const { date, time, absentTeacher, lesson, schoolClass } = lessonToCover;
        
        const batch = writeBatch(firestore);

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
        batch.set(subRef, { ...newSub, id: subRef.id });

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
          הטבלה מציגה מורים שאינם משובצים לשיעור. לחץ על שם מורה כדי לשבץ אותו כמחליף.
        </CardDescription>
        <div className="mt-4 pt-4 border-t">
          <RadioGroup 
              defaultValue="in_school" 
              className="flex items-center gap-4"
              onValueChange={setAvailabilityFilter}
              value={availabilityFilter}
            >
              <Label className="font-normal text-sm">הצג:</Label>
              <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="in_school" id="filter-in_school" />
                  <Label htmlFor="filter-in_school" className="font-normal">פנויים בביה"ס</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="all_not_teaching" id="filter-all_not_teaching" />
                  <Label htmlFor="filter-all_not_teaching" className="font-normal">כלל הלא-מלמדים</Label>
              </div>
          </RadioGroup>
        </div>
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
                                
                                const weekStartDate = getStartOfWeek(new Date());
                                const dayIndex = daysOfWeek.indexOf(day);
                                const currentDate = addDays(weekStartDate, dayIndex);
                                    
                                const substitutionsInSlot = (allSubstitutions || [])
                                    .filter(sub => isSameDay(startOfDay(new Date(sub.date)), currentDate) && sub.time === slot.start);
                                
                                const uncoveredInSlot = uncoveredLessons.get(`${day}-${slot.start}`);

                                return (
                                <td key={`${day}-${slot.start}`} className={cn("p-2 align-top h-24 border-r", slot.type === 'break' && 'bg-muted/30')}>
                                {slot.type === 'break' ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground' /> : (
                                    <div className="flex flex-col items-center gap-1.5 justify-center h-full">
                                        {uncoveredInSlot && uncoveredInSlot.map(({ teacher }, index) => (
                                            <Badge key={`${teacher.id}-${index}`} variant={'destructive'} className="font-normal">
                                                <UserX className="h-3 w-3 ml-1" />
                                                דרוש מחליף ({teacher.name})
                                            </Badge>
                                        ))}
                                         {substitutionsInSlot.map(sub => (
                                            <Badge key={sub.id} variant={'secondary'} className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 font-normal">
                                                <UserCheck className="h-3 w-3 ml-1" />
                                                {sub.substituteTeacherName}
                                            </Badge>
                                        ))}
                                        {availableSubs.map(teacher => (
                                           <Button 
                                             key={teacher.id} 
                                             variant={teacher.isInSchool ? 'secondary' : 'outline'} 
                                             size="sm" 
                                             className="h-auto px-2 py-1 font-normal"
                                             onClick={() => openAssignDialog(teacher, day, slot.start)}
                                            >
                                               {!teacher.isInSchool && <Home className="h-3 w-3 ml-1 text-muted-foreground"/>}
                                                {teacher.name}
                                           </Button>
                                        ))}
                                        {availableSubs.length === 0 && !uncoveredInSlot && substitutionsInSlot.length === 0 && (
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
        onOpenChange={(isOpen) => setAssignDialogState(s => ({...s, isOpen, substitute: isOpen ? s.substitute : null, lessonsToCover: isOpen ? s.lessonsToCover : []}))}
        substitute={assignDialogState.substitute}
        lessonsToCover={assignDialogState.lessonsToCover}
        onConfirm={handleConfirmAssignment}
    />
    </>
  );
}

    

    