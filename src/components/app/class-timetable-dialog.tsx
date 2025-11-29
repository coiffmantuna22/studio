
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { SchoolClass, Teacher, Lesson, ClassSchedule, TimeSlot } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { daysOfWeek } from '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { X, Book, User, BookOpen, Coffee } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { isTeacherAvailable, isTeacherAlreadyScheduled } from '@/lib/substitute-finder';
import { startOfToday } from 'date-fns';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


interface ClassTimetableDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolClass: SchoolClass | null;
  allTeachers: Teacher[];
  allClasses: SchoolClass[];
  timeSlots: TimeSlot[];
  isEditing: boolean;
  onUpdateSchedule?: (classId: string, schedule: ClassSchedule) => void;
}

interface EditSlotPopoverProps {
    day: string;
    time: string;
    lesson: Lesson | null;
    onSave: (day: string, time: string, lesson: Lesson | null) => void;
    allTeachers: Teacher[];
    allClasses: SchoolClass[];
    schoolClass: SchoolClass;
    timeSlots: TimeSlot[];
}

function EditSlotPopover({ day, time, lesson, onSave, allTeachers, allClasses, schoolClass, timeSlots }: EditSlotPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState(lesson?.subject || '');
    const [teacherId, setTeacherId] = useState(lesson?.teacherId || null);

    useEffect(() => {
        if(isOpen) {
            setSubject(lesson?.subject || '');
            setTeacherId(lesson?.teacherId || null);
        }
    }, [lesson, isOpen]);

    const availableTeachersForSlot = useMemo(() => {
        const dayIndex = daysOfWeek.indexOf(day);
        const today = startOfToday();
        const todayIndex = today.getDay();
        const date = new Date(today.setDate(today.getDate() - todayIndex + dayIndex));
        
        return allTeachers.filter(t => {
            const isGenerallyAvailable = isTeacherAvailable(t, date, time, timeSlots);
            const isScheduledElsewhere = isTeacherAlreadyScheduled(t.id, date, time, allClasses, schoolClass.id);
            const isCurrentTeacher = t.id === lesson?.teacherId;
            return (isGenerallyAvailable && !isScheduledElsewhere) || isCurrentTeacher;
        });
    }, [day, time, allTeachers, allClasses, schoolClass.id, lesson?.teacherId, timeSlots]);


    const qualifiedTeachersForSlot = useMemo(() => {
        if (!subject) return availableTeachersForSlot;
        return availableTeachersForSlot.filter(t => t.subjects.includes(subject));
    }, [subject, availableTeachersForSlot]);
    
    const allSubjects = useMemo(() => {
        const subjects = new Set<string>();
        allTeachers.forEach(t => t.subjects.forEach(s => subjects.add(s)));
        return Array.from(subjects).sort().map(s => ({label: s, value: s}));
    }, [allTeachers]);


    const handleSave = () => {
        if (subject && teacherId) {
            onSave(day, time, { subject, teacherId });
        } else {
             onSave(day, time, null);
        }
        setIsOpen(false);
    };

    const handleClear = () => {
        onSave(day, time, null);
        setIsOpen(false);
    };
    
    const currentTeacher = lesson?.teacherId ? allTeachers.find(t => t.id === lesson.teacherId) : null;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className={cn(
                    "w-full h-full p-2 flex flex-col justify-center items-center text-center cursor-pointer min-h-[6rem] transition-colors rounded-md",
                    lesson ? 'bg-primary/10 hover:bg-primary/20' : 'bg-card hover:bg-muted'
                )}>
                    {lesson && currentTeacher ? (
                        <>
                            <p className="font-bold text-sm">{lesson.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1">{currentTeacher?.name}</p>
                        </>
                    ) : <span className="text-muted-foreground text-xs">ריקה</span>}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-4">
                    <div className='text-center'>
                         <h4 className="font-semibold">עריכת שיבוץ</h4>
                         <p className='text-sm text-muted-foreground'>{schoolClass.name} - {day}, {time}</p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2"><Book className='w-4 h-4 text-muted-foreground'/>מקצוע</label>
                        <Combobox
                            items={allSubjects}
                            value={subject}
                            onChange={(newSubject) => {
                                setSubject(newSubject);
                                // If the currently selected teacher cannot teach the new subject, clear the teacher selection.
                                const currentTeacher = allTeachers.find(t => t.id === teacherId);
                                if (currentTeacher && !currentTeacher.subjects.includes(newSubject)) {
                                    setTeacherId(null);
                                }
                            }}
                            placeholder="בחר או צור מקצוע..."
                            searchPlaceholder="חיפוש מקצוע..."
                            noItemsMessage="לא נמצאו מקצועות."
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2"><User className='w-4 h-4 text-muted-foreground'/>מורה</label>
                        <Select onValueChange={(v) => setTeacherId(v)} value={teacherId || ''} disabled={!subject}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר מורה" />
                            </SelectTrigger>
                            <SelectContent>
                                {qualifiedTeachersForSlot.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <Separator />
                    <div className="flex justify-between items-center">
                         <Button variant="ghost" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
                            <X className="w-4 h-4 ml-2"/>
                            נקה שיבוץ
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={!(subject && teacherId)}>שמור</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default function ClassTimetableDialog({
  isOpen,
  onOpenChange,
  schoolClass,
  allTeachers,
  allClasses,
  timeSlots,
  isEditing,
  onUpdateSchedule
}: ClassTimetableDialogProps) {
  
  const [localSchedule, setLocalSchedule] = useState<ClassSchedule>({});

  useEffect(() => {
    if(schoolClass) {
        setLocalSchedule(JSON.parse(JSON.stringify(schoolClass.schedule || {})));
    }
  }, [schoolClass]);

  if (!schoolClass) return null;

  const handleSaveSlot = (day: string, time: string, lesson: Lesson | null) => {
    setLocalSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[day]) newSchedule[day] = {};
        
        if(lesson === null){
            if(newSchedule[day]) {
              delete newSchedule[day][time];
            }
        } else {
             newSchedule[day][time] = lesson;
        }

        return newSchedule;
    })
  }

  const handleSaveChanges = () => {
    if(onUpdateSchedule) {
        onUpdateSchedule(schoolClass.id, localSchedule);
    }
  }
  
  const DayView = ({ day }: { day: string }) => (
     <table className="w-full text-sm text-center table-fixed">
        <thead className='bg-muted/40'>
          <tr className='bg-muted/40'>
            <th className="sticky top-0 bg-muted/40 p-2 w-40 z-20">שעה</th>
            <th className="sticky top-0 bg-muted/40 p-2 min-w-[140px]">{day}</th>
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot => {
            const lesson = localSchedule?.[day]?.[slot.start] || null;
            const teacher = lesson?.teacherId ? allTeachers.find(t => t.id === lesson.teacherId) : null;
            const isBreak = slot.type === 'break';
            return (
              <tr key={slot.id} className="border-t">
                <td className="sticky left-0 font-semibold bg-card p-2 w-40 z-10 text-center">
                    <div>{slot.start} - {slot.end}</div>
                    {isBreak && <Badge variant="outline" className='mt-1'>הפסקה</Badge>}
                </td>
                 <td className={cn("p-0 align-top border-r", isBreak && 'bg-muted/30')}>
                    {isEditing && !isBreak ? (
                        <EditSlotPopover 
                            day={day} 
                            time={slot.start}
                            lesson={lesson}
                            onSave={handleSaveSlot}
                            allTeachers={allTeachers}
                            allClasses={allClasses}
                            schoolClass={schoolClass}
                            timeSlots={timeSlots}
                        />
                    ) : (
                        <div className="p-1.5 h-full min-h-[6rem] flex flex-col justify-center">
                        {isBreak ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground' /> : (
                            lesson && teacher ? (
                                <div className="bg-secondary/50 rounded-md p-2 text-right h-full flex flex-col justify-center">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                    <p className="font-semibold text-primary">{lesson.subject}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <p className="text-sm text-muted-foreground">{teacher.name}</p>
                                </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <span className="text-muted-foreground text-xs">--</span>
                                </div>
                            )
                        )}
                        </div>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `עריכת מערכת שעות: ${schoolClass.name}` : `מערכת שעות: ${schoolClass.name}`}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "לחץ על משבצת כדי לשבץ שיעור ומורה." : "צפייה במערכת השעות הכיתתית."}
          </DialogDescription>
        </DialogHeader>

        <div className='flex-grow overflow-hidden'>
            <Tabs defaultValue="all" className="w-full h-full flex flex-col" dir='rtl'>
                <div className='flex justify-center shrink-0'>
                <TabsList>
                    <TabsTrigger value="all">כל השבוע</TabsTrigger>
                    {daysOfWeek.map(day => (
                    <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
                    ))}
                </TabsList>
                </div>
                
                <div className='flex-grow mt-4 relative'>
                    <ScrollArea className='absolute inset-0' viewportClassName="pb-4">
                        <TabsContent value="all">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-center table-fixed min-w-[900px]">
                                    <thead className='bg-muted/40'>
                                    <tr className='bg-muted/40'>
                                        <th className="sticky left-0 top-0 bg-muted/40 p-2 w-40 z-20">שעה</th>
                                        {daysOfWeek.map(day => (
                                        <th key={day} className="sticky top-0 bg-muted/40 p-2 min-w-[140px]">{day}</th>
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
                                            const lesson = localSchedule?.[day]?.[slot.start] || null;
                                            const teacher = lesson?.teacherId ? allTeachers.find(t => t.id === lesson.teacherId) : null;
                                            const isBreak = slot.type === 'break';
                                            return (
                                            <td key={`${day}-${slot.start}`} className={cn("p-0 align-top border-r", isBreak && 'bg-muted/30')}>
                                                {isEditing && !isBreak ? (
                                                    <EditSlotPopover 
                                                        day={day} 
                                                        time={slot.start}
                                                        lesson={lesson}
                                                        onSave={handleSaveSlot}
                                                        allTeachers={allTeachers}
                                                        allClasses={allClasses}
                                                        schoolClass={schoolClass}
                                                        timeSlots={timeSlots}
                                                    />
                                                ) : (
                                                    <div className="p-1.5 h-full min-h-[6rem] flex flex-col justify-center">
                                                    {isBreak ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground' /> : (
                                                        lesson && teacher ? (
                                                            <div className="bg-secondary/50 rounded-md p-2 text-right h-full flex flex-col justify-center">
                                                            <div className="flex items-center gap-2">
                                                                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                                                                <p className="font-semibold text-primary">{lesson.subject}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                                <p className="text-sm text-muted-foreground">{teacher.name}</p>
                                                            </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full">
                                                                <span className="text-muted-foreground text-xs">--</span>
                                                            </div>
                                                        )
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
                        </TabsContent>
                        {daysOfWeek.map(day => (
                        <TabsContent key={day} value={day}>
                            <DayView day={day} />
                        </TabsContent>
                        ))}
                        <ScrollBar orientation="horizontal" />
                     </ScrollArea>
                </div>
            </Tabs>
        </div>
        
        <DialogFooter className="shrink-0 pt-4">
          {isEditing && <Button onClick={handleSaveChanges}>שמור שינויים</Button>}
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {isEditing ? "ביטול" : "סגור"}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

