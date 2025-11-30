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
import { isTeacherAlreadyScheduled } from '@/lib/substitute-finder';
import { startOfDay, addDays, getDay, format } from 'date-fns';
import { he } from 'date-fns/locale';
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
    lessons: Lesson[];
    onSave: (day: string, time: string, lessons: Lesson[]) => void;
    allTeachers: Teacher[];
    allClasses: SchoolClass[];
    schoolClass: SchoolClass;
    timeSlots: TimeSlot[];
}

const getStartOfWeek = (date: Date): Date => {
    const day = getDay(date); // Sunday is 0, Saturday is 6
    if (day === 6) { // If it's Saturday, start from next Sunday
        return startOfDay(addDays(date, 1));
    }
    const diff = date.getDate() - day;
    return startOfDay(new Date(new Date(date).setDate(diff)));
}


function EditSlotPopover({ day, time, lessons, onSave, allTeachers, allClasses, schoolClass, timeSlots }: EditSlotPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    const majorLessons = lessons.filter(l => l.majorId);
    const [regularLessons, setRegularLessons] = useState<Lesson[]>([]);

    // New lesson state
    const [newSubject, setNewSubject] = useState('');
    const [newTeacherId, setNewTeacherId] = useState<string | null>(null);

    useEffect(() => {
        if(isOpen) {
            setRegularLessons(lessons.filter(l => !l.majorId));
            setNewSubject('');
            setNewTeacherId(null);
        }
    }, [lessons, isOpen]);

    const availableTeachersForSlot = useMemo(() => {
        return allTeachers.filter(t => {
            const isScheduledElsewhere = isTeacherAlreadyScheduled(t.id, new Date(), time, allClasses, schoolClass.id);
            // If the teacher is already in one of the regular lessons we are editing, they are technically "busy" in this slot, 
            // but since we are editing THIS slot, we might want to allow re-selecting them if we are modifying that specific lesson.
            // However, for adding a NEW lesson, they should be free.
            // Simplified: Filter out teachers who are busy elsewhere.
            return !isScheduledElsewhere;
        });
    }, [time, allTeachers, allClasses, schoolClass.id]);


    const qualifiedTeachersForSlot = useMemo(() => {
        if (!newSubject) return availableTeachersForSlot;
        return availableTeachersForSlot.filter(t => t.subjects.includes(newSubject));
    }, [newSubject, availableTeachersForSlot]);
    
    const allSubjects = useMemo(() => {
        const subjects = new Set<string>();
        allTeachers.forEach(t => t.subjects.forEach(s => subjects.add(s)));
        return Array.from(subjects).sort().map(s => ({label: s, value: s}));
    }, [allTeachers]);


    const handleAddLesson = () => {
        if (newSubject && newTeacherId) {
            setRegularLessons(prev => [...prev, { subject: newSubject, teacherId: newTeacherId!, classId: schoolClass.id }]);
            setNewSubject('');
            setNewTeacherId(null);
        }
    };

    const handleRemoveLesson = (index: number) => {
        setRegularLessons(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        // If there's a pending new lesson that hasn't been added, we could auto-add it, or ignore it.
        // Let's ignore it to avoid accidental adds, but maybe warn? 
        // For now, just save the list of regular lessons + major lessons.
        const finalLessons = [...majorLessons, ...regularLessons];
        if (newSubject && newTeacherId) {
             finalLessons.push({ subject: newSubject, teacherId: newTeacherId, classId: schoolClass.id });
        }
        onSave(day, time, finalLessons);
        setIsOpen(false);
    };

    const handleClearAllRegular = () => {
        onSave(day, time, [...majorLessons]);
        setIsOpen(false);
    };
    
    const canAdd = newSubject && newTeacherId;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className={cn(
                    "w-full h-full p-1 flex flex-col justify-start items-center text-center cursor-pointer min-h-[6rem] transition-colors rounded-md gap-1 overflow-y-auto",
                    lessons.length > 0 ? 'bg-primary/5 hover:bg-primary/10' : 'bg-card hover:bg-muted'
                )}>
                    {lessons.length === 0 && <span className="text-muted-foreground text-xs mt-2">ריקה</span>}
                    
                    {lessons.map((lesson, idx) => {
                         const teacher = allTeachers.find(t => t.id === lesson.teacherId);
                         return (
                            <div key={idx} className={cn(
                                "w-full p-1 rounded text-xs border",
                                lesson.majorId ? "bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800" : "bg-background border-border"
                            )}>
                                <p className="font-bold truncate">{lesson.subject}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{teacher?.name}</p>
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
                         <p className='text-sm text-muted-foreground'>{schoolClass.name} - {day}, {time}</p>
                    </div>
                    
                    {majorLessons.length > 0 && (
                        <div className="bg-muted p-2 rounded-md text-xs space-y-1">
                            <p className="font-medium">שיעורי מגמה (לא ניתן לערוך כאן):</p>
                            {majorLessons.map((l, i) => (
                                <div key={i} className="flex justify-between">
                                    <span>{l.subject}</span>
                                    <span className="text-muted-foreground">{allTeachers.find(t => t.id === l.teacherId)?.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">שיעורים רגילים:</p>
                        {regularLessons.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-2">אין שיעורים רגילים</p>
                        ) : (
                            <div className="space-y-2">
                                {regularLessons.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between bg-secondary/30 p-2 rounded-md text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{l.subject}</span>
                                            <span className="text-xs text-muted-foreground">{allTeachers.find(t => t.id === l.teacherId)?.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveLesson(i)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-3 bg-muted/30 p-2 rounded-md">
                        <p className="text-xs font-medium">הוספת שיעור:</p>
                        <div className="space-y-2">
                            <Combobox
                                items={allSubjects}
                                value={newSubject}
                                onChange={(val) => {
                                    setNewSubject(val);
                                    setNewTeacherId(null);
                                }}
                                placeholder="בחר מקצוע..."
                                searchPlaceholder="חיפוש..."
                                noItemsMessage="לא נמצא"
                            />
                            <Select onValueChange={setNewTeacherId} value={newTeacherId || ''} disabled={!newSubject}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="בחר מורה" />
                                </SelectTrigger>
                                <SelectContent>
                                    {qualifiedTeachersForSlot.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button size="sm" variant="secondary" className="w-full h-8" onClick={handleAddLesson} disabled={!canAdd}>
                                <Book className="w-3 h-3 mr-2" />
                                הוסף לשיבוץ
                            </Button>
                        </div>
                    </div>
                    
                    <Separator />
                    <div className="flex justify-between items-center">
                         <Button variant="ghost" size="sm" onClick={handleClearAllRegular} className="text-destructive hover:text-destructive text-xs">
                            נקה הכל
                        </Button>
                        <Button size="sm" onClick={handleSave}>שמור שינויים</Button>
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

  const weekStartDate = useMemo(() => getStartOfWeek(new Date()), []);

  if (!schoolClass) return null;

  const handleSaveSlot = (day: string, time: string, lessons: Lesson[]) => {
    setLocalSchedule(prev => {
        const newSchedule = { ...prev };
        if (!newSchedule[day]) newSchedule[day] = {};
        
        newSchedule[day][time] = lessons;

        return newSchedule;
    })
  }

  const handleSaveChanges = () => {
    if(onUpdateSchedule) {
        onUpdateSchedule(schoolClass.id, localSchedule);
    }
  }
  
  const DayView = ({ day }: { day: string }) => {
    const dayIndex = daysOfWeek.indexOf(day);
    const date = addDays(weekStartDate, dayIndex);
     return (
     <table className="w-full text-sm text-center table-fixed">
        <thead className='bg-muted/40'>
          <tr className='bg-muted/40'>
            <th className="sticky top-0 bg-muted/40 p-2 w-40 z-20">שעה</th>
            <th className="sticky top-0 bg-muted/40 p-2 min-w-[140px]">
                <div>{day}</div>
                <div className="font-normal text-xs text-muted-foreground">{format(date, 'dd/MM')}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot => {
            const lessons = localSchedule?.[day]?.[slot.start] || [];
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
                            lessons={lessons}
                            onSave={handleSaveSlot}
                            allTeachers={allTeachers}
                            allClasses={allClasses}
                            schoolClass={schoolClass}
                            timeSlots={timeSlots}
                        />
                    ) : (
                        <div className="p-1.5 h-full min-h-[6rem] flex flex-col justify-start gap-1">
                        {isBreak ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground mt-4' /> : (
                            lessons.length > 0 ? (
                                lessons.map((lesson, idx) => {
                                    const teacher = allTeachers.find(t => t.id === lesson.teacherId);
                                    return (
                                        <div key={idx} className={cn(
                                            "bg-secondary/50 rounded-md p-2 text-right flex flex-col justify-center",
                                            lesson.majorId && "border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="h-3 w-3 text-primary shrink-0" />
                                                <p className="font-semibold text-primary text-xs">{lesson.subject}</p>
                                                {lesson.majorId && <Badge variant="secondary" className="text-[8px] h-3 px-1 mr-auto">מגמה</Badge>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <p className="text-xs text-muted-foreground">{teacher?.name}</p>
                                            </div>
                                        </div>
                                    )
                                })
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
    )
  };

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

        <div className="flex-grow overflow-auto">
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
                    <ScrollArea className='absolute inset-0'>
                        <TabsContent value="all">
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
                                            return (
                                            <td key={`${day}-${slot.start}`} className={cn("p-0 align-top border-r", isBreak && 'bg-muted/30')}>
                                                {isEditing && !isBreak ? (
                                                    <EditSlotPopover 
                                                        day={day} 
                                                        time={slot.start}
                                                        lessons={lessons}
                                                        onSave={handleSaveSlot}
                                                        allTeachers={allTeachers}
                                                        allClasses={allClasses}
                                                        schoolClass={schoolClass}
                                                        timeSlots={timeSlots}
                                                    />
                                                ) : (
                                                    <div className="p-1.5 h-full min-h-[6rem] flex flex-col justify-start gap-1">
                                                    {isBreak ? <Coffee className='w-5 h-5 mx-auto text-muted-foreground mt-4' /> : (
                                                        lessons.length > 0 ? (
                                                            lessons.map((lesson, idx) => {
                                                                const teacher = allTeachers.find(t => t.id === lesson.teacherId);
                                                                return (
                                                                    <div key={idx} className={cn(
                                                                        "bg-secondary/50 rounded-md p-2 text-right flex flex-col justify-center",
                                                                        lesson.majorId && "border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800"
                                                                    )}>
                                                                        <div className="flex items-center gap-2">
                                                                            <BookOpen className="h-3 w-3 text-primary shrink-0" />
                                                                            <p className="font-semibold text-primary text-xs">{lesson.subject}</p>
                                                                            {lesson.majorId && <Badge variant="secondary" className="text-[8px] h-3 px-1 mr-auto">מגמה</Badge>}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                            <p className="text-xs text-muted-foreground">{teacher?.name}</p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })
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
        
        <DialogFooter className="shrink-0 pt-4 border-t mt-4">
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
