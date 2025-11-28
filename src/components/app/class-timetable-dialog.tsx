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
import { X } from 'lucide-react';

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
}

function EditSlotPopover({ day, time, lesson, onSave, allTeachers }: EditSlotPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState(lesson?.subject || '');
    const [teacherId, setTeacherId] = useState(lesson?.teacherId || null);

    useEffect(() => {
        setSubject(lesson?.subject || '');
        setTeacherId(lesson?.teacherId || null);
    }, [lesson, isOpen]);

    const availableTeachersForSubject = useMemo(() => {
        if (!subject) return allTeachers;
        return allTeachers.filter(t => t.subjects.includes(subject));
    }, [subject, allTeachers]);
    
    const allSubjects = useMemo(() => {
        const subjects = new Set<string>();
        allTeachers.forEach(t => t.subjects.forEach(s => subjects.add(s)));
        return Array.from(subjects);
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

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className={cn(
                    "w-full h-full p-2 flex flex-col justify-center items-center text-center cursor-pointer min-h-[6rem] transition-colors",
                    lesson ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted'
                )}>
                    {lesson ? (
                        <>
                            <p className="font-bold text-sm">{lesson.subject}</p>
                            <p className="text-xs text-muted-foreground">{allTeachers.find(t => t.id === lesson.teacherId)?.name}</p>
                        </>
                    ) : <span className="text-muted-foreground text-xs">ריקה</span>}
                </div>
            </PopoverTrigger>
            <PopoverContent>
                <div className="space-y-4">
                    <h4 className="font-semibold">ערוך שיעור</h4>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">מקצוע</label>
                        <Select onValueChange={setSubject} value={subject}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר מקצוע" />
                            </SelectTrigger>
                            <SelectContent>
                                {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium">מורה</label>
                        <Select onValueChange={setTeacherId} value={teacherId || ''} disabled={!subject}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר מורה" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTeachersForSubject.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-between items-center">
                        <Button onClick={handleSave} disabled={!subject || !teacherId}>שמור</Button>
                        <Button variant="ghost" onClick={handleClear} className="text-destructive hover:text-destructive">
                            <X className="w-4 h-4 mr-2"/>
                            נקה שיבוץ
                        </Button>
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
        newSchedule[day][time] = lesson;
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
                  <th className="sticky right-0 bg-muted p-2 w-24 z-10">שעה</th>
                  {daysOfWeek.map(day => (
                    <th key={day} className="p-2 min-w-[150px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(time => (
                  <tr key={time} className="border-t">
                    <td className="sticky right-0 font-semibold bg-card p-2 w-24 z-10">{time}</td>
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
                                />
                            ) : (
                                <div className="p-2 min-h-[6rem] flex flex-col justify-center items-center">
                                {lesson && teacher ? (
                                    <>
                                    <p className="font-semibold">{lesson.subject}</p>
                                    <Badge variant="secondary" className="mt-1">
                                        {teacher.name}
                                    </Badge>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground text-xs">--</span>
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
