
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
import { X, Book, Home, Coffee } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';
import { Badge } from '../ui/badge';

interface TeacherScheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teacher: Teacher | null;
  allClasses: SchoolClass[];
  timeSlots: TimeSlot[];
  onUpdateSchedule: (teacherId: string, schedule: ClassSchedule) => void;
}

interface EditSlotPopoverProps {
    day: string;
    time: string;
    lesson: Lesson | null;
    onSave: (day: string, time: string, lesson: Lesson | null) => void;
    teacher: Teacher;
    allClasses: SchoolClass[];
}

function EditSlotPopover({ day, time, lesson, onSave, teacher, allClasses }: EditSlotPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState(lesson?.subject || '');
    const [classId, setClassId] = useState(lesson?.classId || null);

    useEffect(() => {
        if(isOpen) {
            setSubject(lesson?.subject || '');
            setClassId(lesson?.classId || null);
        }
    }, [lesson, isOpen]);
    
    const teacherSubjects = useMemo(() => {
        return teacher.subjects.map(s => ({label: s, value: s}));
    }, [teacher.subjects]);


    const handleSave = () => {
        if (subject && classId) {
            onSave(day, time, { subject, teacherId: teacher.id, classId });
        } else {
             onSave(day, time, null);
        }
        setIsOpen(false);
    };

    const handleClear = () => {
        onSave(day, time, null);
        setIsOpen(false);
    };
    
    const currentClass = lesson?.classId ? allClasses.find(c => c.id === lesson.classId) : null;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className={cn(
                    "w-full h-full p-2 flex flex-col justify-center items-center text-center cursor-pointer min-h-[6rem] transition-colors rounded-md",
                    lesson ? 'bg-primary/10 hover:bg-primary/20' : 'bg-card hover:bg-muted'
                )}>
                    {lesson && currentClass ? (
                        <>
                            <p className="font-bold text-sm">{lesson.subject}</p>
                            <p className="text-xs text-muted-foreground mt-1">{currentClass?.name}</p>
                        </>
                    ) : <span className="text-muted-foreground text-xs">ריקה</span>}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-4">
                    <div className='text-center'>
                         <h4 className="font-semibold">עריכת שיבוץ</h4>
                         <p className='text-sm text-muted-foreground'>{teacher.name} - {day}, {time}</p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2"><Book className='w-4 h-4 text-muted-foreground'/>מקצוע</label>
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
                            נקה שיבוץ
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={!(subject && classId)}>שמור</Button>
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
  onUpdateSchedule
}: TeacherScheduleDialogProps) {
  
  const [localSchedule, setLocalSchedule] = useState<ClassSchedule>({});

  useEffect(() => {
    if(teacher) {
        setLocalSchedule(JSON.parse(JSON.stringify(teacher.schedule || {})));
    }
  }, [teacher]);

  if (!teacher) return null;

  const handleSaveSlot = (day: string, time: string, lesson: Lesson | null) => {
    setLocalSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[day]) newSchedule[day] = {};
        
        if(lesson === null){
            if(newSchedule[day] && newSchedule[day][time]) {
              newSchedule[day][time] = null;
            }
        } else {
             newSchedule[day][time] = lesson;
        }

        return newSchedule;
    })
  }

  const handleSaveChanges = () => {
    onUpdateSchedule(teacher.id, localSchedule);
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-full flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            מערכת שעות: {teacher.name}
          </DialogTitle>
          <DialogDescription>
            כאן ניתן לצפות ולערוך את מערכת השעות האישית של המורה.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow relative overflow-auto">
            <ScrollArea className="absolute inset-0">
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
                                const isBreak = slot.type === 'break';
                                return (
                                <td key={`${day}-${slot.start}`} className={cn("p-0 align-top border-r", isBreak && 'bg-muted/30')}>
                                    {!isBreak ? (
                                        <EditSlotPopover 
                                            day={day} 
                                            time={slot.start}
                                            lesson={lesson}
                                            onSave={handleSaveSlot}
                                            teacher={teacher}
                                            allClasses={allClasses}
                                        />
                                    ) : (
                                        <div className="p-1.5 h-full min-h-[6rem] flex flex-col justify-center">
                                            <Coffee className='w-5 h-5 mx-auto text-muted-foreground' />
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