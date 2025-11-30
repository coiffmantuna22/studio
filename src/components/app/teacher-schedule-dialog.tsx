'use client';

import { useState, useMemo, useEffect } from 'react';
import type { SchoolClass, Teacher, Lesson, ClassSchedule, TimeSlot, AbsenceDay } from '@/lib/types';
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
import { X, Book, Home, Coffee, UserX } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { Badge } from '../ui/badge';
import { startOfDay, addDays, getDay, format, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';


interface TeacherScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teacher: Teacher | null;
  allClasses: SchoolClass[];
  timeSlots: TimeSlot[];
  onUpdateSchedule: (teacherId: string, schedule: ClassSchedule) => void;
  onUpdateAbsences: (teacherId: string, absences: AbsenceDay[]) => void;
}

interface EditSlotPopoverProps {
    day: string;
    time: string;
    lessons: Lesson[];
    onSave: (day: string, time: string, lessons: Lesson[]) => void;
    teacher: Teacher;
    allClasses: SchoolClass[];
    isAbsent: boolean;
    onToggleAbsence: (isAbsent: boolean) => void;
}

const getStartOfWeek = (date: Date): Date => {
    const day = getDay(date); // Sunday is 0, Saturday is 6
    if (day === 6) { // If it's Saturday, start from next Sunday
        return startOfDay(addDays(date, 1));
    }
    const diff = date.getDate() - day;
    return startOfDay(new Date(new Date(date).setDate(diff)));
}

const parseTimeToNumber = (time: string) => {
    if (!time || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
};


function EditSlotPopover({ day, time, lessons, onSave, teacher, allClasses, isAbsent, onToggleAbsence }: EditSlotPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Filter out major lessons for editing purposes
    const majorLessons = lessons.filter(l => l.majorId);
    const regularLesson = lessons.find(l => !l.majorId) || null;

    const [subject, setSubject] = useState(regularLesson?.subject || '');
    const [classId, setClassId] = useState(regularLesson?.classId || null);

    useEffect(() => {
        if(isOpen) {
            setSubject(regularLesson?.subject || '');
            setClassId(regularLesson?.classId || null);
        }
    }, [regularLesson, isOpen]);
    
    const teacherSubjects = useMemo(() => {
        return teacher.subjects.map(s => ({label: s, value: s}));
    }, [teacher.subjects]);


    const handleSave = () => {
        const newLessons = [...majorLessons];
        if (subject && classId) {
            newLessons.push({ subject, teacherId: teacher.id, classId });
        }
        onSave(day, time, newLessons);
        setIsOpen(false);
    };

    const handleClear = () => {
        onSave(day, time, [...majorLessons]);
        setIsOpen(false);
    };
    
    const currentClass = regularLesson?.classId ? allClasses.find(c => c.id === regularLesson.classId) : null;
    
    const canSave = (subject && classId) || (!subject && !classId && regularLesson !== null);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                 <div className={cn(
                    "w-full h-full p-1 flex flex-col justify-start items-center text-center cursor-pointer min-h-[6rem] transition-colors rounded-md gap-1 overflow-y-auto",
                    isAbsent && 'bg-destructive/10',
                    lessons.length > 0 ? 'bg-primary/5 hover:bg-primary/10' : 'bg-card hover:bg-muted',
                    isAbsent && lessons.length > 0 && 'bg-destructive/20 hover:bg-destructive/30'
                )}>
                    {lessons.length === 0 && <span className="text-muted-foreground text-xs mt-2">ריקה</span>}
                    {isAbsent && <Badge variant="destructive" className="mt-1 mb-1">נעדר/ת</Badge>}
                    
                    {lessons.map((lesson, idx) => {
                         const schoolClass = allClasses.find(c => c.id === lesson.classId);
                         return (
                            <div key={idx} className={cn(
                                "w-full p-1 rounded text-xs border",
                                lesson.majorId ? "bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800" : "bg-background border-border"
                            )}>
                                <p className="font-bold truncate">{lesson.subject}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{schoolClass?.name}</p>
                                {lesson.majorId && <Badge variant="secondary" className="text-[8px] h-3 px-1 mt-0.5">מגמה</Badge>}
                            </div>
                         )
                    })}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-4">
                    <div className='text-center'>
                         <h4 className="font-semibold">עריכת שיבוץ</h4>
                         <p className='text-sm text-muted-foreground'>{teacher.name} - {day}, {time}</p>
                    </div>

                    <div className="flex items-center space-x-2 space-x-reverse justify-center p-2 bg-muted/50 rounded-md">
                        <Label htmlFor={`absence-toggle-${day}-${time}`} className='font-normal'>סמן כנעדר/ת</Label>
                        <Switch
                            id={`absence-toggle-${day}-${time}`}
                            checked={isAbsent}
                            onCheckedChange={onToggleAbsence}
                        />
                    </div>
                    
                    {majorLessons.length > 0 && (
                        <div className="bg-muted p-2 rounded-md text-xs space-y-1">
                            <p className="font-medium">שיעורי מגמה (לא ניתן לערוך כאן):</p>
                            {majorLessons.map((l, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>{l.subject}</span>
                                    <span className="text-muted-foreground">{allClasses.find(c => c.id === l.classId)?.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <Separator />

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2"><Book className='w-4 h-4 text-muted-foreground'/>מקצוע (רגיל)</label>
                        <Combobox
                            items={teacherSubjects}
                            value={subject}
                            onChange={(newSubject) => setSubject(newSubject)}
                            placeholder="בחר מקצוע..."
                            searchPlaceholder="חיפוש מקצוע..."
                            noItemsMessage="לא נמצאו מקצועות."
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2"><Home className='w-4 h-4 text-muted-foreground'/>כיתה</label>
                        <Select onValueChange={(v) => setClassId(v)} value={classId || ''} disabled={!subject}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר כיתה" />
                            </SelectTrigger>
                            <SelectContent>
                                {allClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <Separator />
                    <div className="flex justify-between items-center">
                         <Button variant="ghost" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
                            <X className="w-4 h-4 ml-2"/>
                            נקה שיבוץ רגיל
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={!canSave}>שמור</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default function TeacherScheduleDialog({
  isOpen,
  onOpenChange,
  teacher,
  allClasses,
  timeSlots,
  onUpdateSchedule,
  onUpdateAbsences
}: TeacherScheduleDialogProps) {
  
  const [localSchedule, setLocalSchedule] = useState<ClassSchedule>({});
  const [localAbsences, setLocalAbsences] = useState<AbsenceDay[]>([]);


  useEffect(() => {
    if(teacher) {
        setLocalSchedule(JSON.parse(JSON.stringify(teacher.schedule || {})));
        setLocalAbsences(JSON.parse(JSON.stringify(teacher.absences || [])));
    }
  }, [teacher]);
  
  const weekStartDate = useMemo(() => getStartOfWeek(new Date()), []);

  if (!teacher) return null;

  const handleSaveSlot = (day: string, time: string, lessons: Lesson[]) => {
    setLocalSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[day]) newSchedule[day] = {};
        
        newSchedule[day][time] = lessons;

        return newSchedule;
    })
  }

  const handleSaveChanges = () => {
    onUpdateSchedule(teacher.id, localSchedule);
    onUpdateAbsences(teacher.id, localAbsences);
    onOpenChange(false);
  }

  const handleToggleAbsence = (day: string, slot: TimeSlot, isMarkingAsAbsent: boolean) => {
    const dayIndex = daysOfWeek.indexOf(day);
    const date = addDays(weekStartDate, dayIndex);
    const absenceId = `absence-${date.toISOString()}-${slot.start}`;

    if (isMarkingAsAbsent) {
        // Add absence if it doesn't already exist
        if (!localAbsences.some(a => a.id === absenceId)) {
            const newAbsence: AbsenceDay = {
                id: absenceId,
                date: date.toISOString(),
                isAllDay: false,
                startTime: slot.start,
                endTime: slot.end,
            };
            setLocalAbsences(prev => [...prev, newAbsence]);
        }
    } else {
        // Remove absence
        setLocalAbsences(prev => prev.filter(a => a.id !== absenceId));
    }
};

  const isSlotAbsent = (day: string, slotTime: string): boolean => {
    if (localAbsences.length === 0) {
      return false;
    }
    const dayIndex = daysOfWeek.indexOf(day);
    const date = addDays(weekStartDate, dayIndex);

    const todaysAbsences = localAbsences.filter(absence => {
        try {
            return isSameDay(startOfDay(new Date(absence.date)), startOfDay(date))
        } catch (e) {
            return false;
        }
    });
    
    if (todaysAbsences.length === 0) return false;

    const slotStartNum = parseTimeToNumber(slotTime);

    return todaysAbsences.some(absence => {
      if (absence.isAllDay) return true;
      const absenceStart = parseTimeToNumber(absence.startTime);
      const absenceEnd = parseTimeToNumber(absence.endTime);
      return slotStartNum >= absenceStart && slotStartNum < absenceEnd;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            מערכת שעות: {teacher.name}
          </DialogTitle>
          <DialogDescription>
            כאן ניתן לצפות ולערוך את מערכת השעות האישית של המורה, ולסמן היעדרויות.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow relative overflow-auto">
            <ScrollArea className="absolute inset-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center table-fixed min-w-[900px]">
                        <thead className='bg-muted/40'>
                        <tr className='bg-muted/40'>
                            <th className="sticky left-0 top-0 bg-muted/40 p-2 w-40 z-20">שעה</th>
                            {daysOfWeek.map((day, dayIndex) => {
                                const date = addDays(weekStartDate, dayIndex);
                                return (
                                <th key={day} className="sticky top-0 bg-muted/40 p-2 min-w-[140px]">
                                    <div>{day}</div>
                                    <div className="font-normal text-xs text-muted-foreground">{format(date, 'dd/MM')}</div>
                                </th>
                                )
                            })}
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
                                const lessons = localSchedule?.[day]?.[slot.start] || [];
                                const isBreak = slot.type === 'break';
                                const isAbsent = isSlotAbsent(day, slot.start);
                                return (
                                <td key={`${day}-${slot.start}`} className={cn("p-0 align-top border-r", isBreak && 'bg-muted/30')}>
                                    {!isBreak ? (
                                        <EditSlotPopover 
                                            day={day} 
                                            time={slot.start}
                                            lessons={lessons}
                                            onSave={handleSaveSlot}
                                            teacher={teacher}
                                            allClasses={allClasses}
                                            isAbsent={isAbsent}
                                            onToggleAbsence={(markAbsent) => handleToggleAbsence(day, slot, markAbsent)}
                                        />
                                    ) : (
                                        <div className={cn("p-1.5 h-full min-h-[6rem] flex flex-col justify-center", isAbsent && 'bg-destructive/10')}>
                                            <Coffee className='w-5 h-5 mx-auto text-muted-foreground' />
                                            {isAbsent && <Badge variant="destructive" className="mt-2">נעדר/ת</Badge>}
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
        </div>
        
        <DialogFooter className="shrink-0 pt-4 border-t mt-4">
          <Button onClick={handleSaveChanges}>שמור שינויים</Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              סגור
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
