'use client';

import { useState, useMemo, useEffect } from 'react';
import type { SchoolClass, Teacher, Lesson, ClassSchedule } from '@/lib/types';
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
import { timeSlots, daysOfWeek } from '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { X, Book, User, BookOpen } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Combobox } from '../ui/combobox';

interface ClassTimetableDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  schoolClass: SchoolClass | null;
  allTeachers: Teacher[];
  isEditing: boolean;
  onUpdateSchedule?: (classId: string, schedule: ClassSchedule) => void;
}

interface EditSlotPopoverProps {
    day: string;
    time: string;
    lesson: Lesson | null;
    onSave: (day: string, time: string, lesson: Lesson | null) => void;
    allTeachers: Teacher[];
    schoolClass: SchoolClass;
}

function EditSlotPopover({ day, time, lesson, onSave, allTeachers, schoolClass }: EditSlotPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState(lesson?.subject || '');
    const [teacherId, setTeacherId] = useState(lesson?.teacherId || null);

    useEffect(() => {
        if(isOpen) {
            setSubject(lesson?.subject || '');
            setTeacherId(lesson?.teacherId || null);
        }
    }, [lesson, isOpen]);

    const availableTeachersForSubject = useMemo(() => {
        if (!subject) return allTeachers;
        return allTeachers.filter(t => t.subjects.includes(subject));
    }, [subject, allTeachers]);
    
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
                            onChange={setSubject}
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
                                {availableTeachersForSubject.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <Separator />
                    <div className="flex justify-between items-center">
                         <Button variant="ghost" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
                            <X className="w-4 h-4 ml-2"/>
                            נקה שיבוץ
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={!subject || !teacherId}>שמור</Button>
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
  isEditing,
  onUpdateSchedule
}: ClassTimetableDialogProps) {
  
  const [localSchedule, setLocalSchedule] = useState<ClassSchedule>({});

  useEffect(() => {
    if(schoolClass) {
        // Deep copy of schedule
        setLocalSchedule(JSON.parse(JSON.stringify(schoolClass.schedule || {})));
    }
  }, [schoolClass]);


  if (!schoolClass) return null;

  const handleSaveSlot = (day: string, time: string, lesson: Lesson | null) => {
    setLocalSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[day]) newSchedule[day] = {};
        
        if(lesson === null){
            delete newSchedule[day][time];
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


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `עריכת מערכת שעות: ${schoolClass.name}` : `מערכת שעות: ${schoolClass.name}`}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "לחץ על משבצת כדי לשבץ שיעור ומורה." : "צפייה במערכת השעות הכיתתית."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <div className="relative">
            <table className="w-full text-sm text-center table-fixed">
              <thead>
                <tr className="bg-muted">
                  <th className="sticky right-0 bg-muted p-2 w-28 z-10">שעה</th>
                  {daysOfWeek.map(day => (
                    <th key={day} className="p-2 min-w-[150px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(time => (
                  <tr key={time} className="border-t">
                    <td className="sticky right-0 font-semibold bg-card p-2 w-28 z-10">{time}</td>
                    {daysOfWeek.map(day => {
                      const lesson = localSchedule?.[day]?.[time] || null;
                      const teacher = lesson?.teacherId ? allTeachers.find(t => t.id === lesson.teacherId) : null;
                      return (
                        <td key={`${day}-${time}`} className="p-0 align-top border-l">
                            {isEditing ? (
                                <EditSlotPopover 
                                    day={day} 
                                    time={time}
                                    lesson={lesson}
                                    onSave={handleSaveSlot}
                                    allTeachers={allTeachers}
                                    schoolClass={schoolClass}
                                />
                            ) : (
                                <div className="p-1.5 h-full">
                                {lesson && teacher ? (
                                    <div className="bg-secondary/50 rounded-md p-2 text-right h-full flex flex-col justify-center">
                                      <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                        <p className="font-semibold text-primary">{lesson.subject}</p>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">{teacher.name}</p>
                                      </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full min-h-[6rem]">
                                        <span className="text-muted-foreground text-xs">--</span>
                                    </div>
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

        <DialogFooter>
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
