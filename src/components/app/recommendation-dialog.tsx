

'use client';

import { useState, useEffect } from 'react';
import type { Teacher, AffectedLesson } from '@/lib/types';
import { getDay } from 'date-fns';
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
import { Separator } from '@/components/ui/separator';
import { Lightbulb, UserCheck, ArrowLeft, Users, BookOpen, CalendarDays, Loader2 } from 'lucide-react';
import { groupBy } from 'lodash';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from '../ui/badge';
import { daysOfWeek } from '@/lib/constants';
import { ScrollArea } from '../ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';


interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recommendationResult: {
    results: AffectedLesson[];
    absentTeacher: Teacher;
    absenceDays: any[];
  } | null;
  onAssign: (substituteTeacher: Teacher, lesson: AffectedLesson) => Promise<void>;
}

const LessonRecommendation = ({ lesson, onAssign }: { lesson: AffectedLesson, onAssign: (substitute: Teacher, lesson: AffectedLesson) => Promise<void>}) => {
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(lesson.recommendationId);
    const [isAssigning, setIsAssigning] = useState(false);
    const hasOptions = lesson.substituteOptions && lesson.substituteOptions.length > 0;
    const absentTeacherName = lesson.absentTeacherName || 'לא ידוע';

    const handleAssign = async () => {
        if (!selectedTeacherId) return;
        const selectedTeacher = lesson.substituteOptions.find(t => t.id === selectedTeacherId);
        if (selectedTeacher) {
            setIsAssigning(true);
            await onAssign(selectedTeacher, lesson);
            setIsAssigning(false);
        }
    }

    return (
        <div className="p-3 border rounded-lg bg-card/50">
            <div className="font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div className='flex items-center gap-2'>
                    <Users className="ml-2 h-4 w-4 text-muted-foreground" />
                    <span>כיתה {lesson.className}</span>
                </div>
                <span className='text-sm text-muted-foreground font-normal mt-1 sm:mt-0'>{lesson.lesson.subject} בשעה {lesson.time}</span>
            </div>
            <Separator className="my-2" />
            <div className='flex items-center justify-center gap-4 text-center my-3'>
                <div className='flex flex-col items-center p-2 rounded-md'>
                    <span className="text-sm text-muted-foreground">מורה חסר/ה</span>
                    <p className="font-bold text-destructive/80 flex items-center justify-center gap-2 mt-1">
                        {absentTeacherName}
                    </p>
                </div>
            </div>

            {hasOptions ? (
                <>
                <p className="text-sm text-muted-foreground mb-2 text-center">בחר/י מורה מחליף/ה מהרשימה:</p>
                <RadioGroup 
                    dir="rtl" 
                    value={selectedTeacherId || ""} 
                    onValueChange={setSelectedTeacherId} 
                    className="space-y-2 max-h-48 overflow-y-auto pr-2"
                >
                    {lesson.substituteOptions.map(teacher => (
                        <Label 
                            key={teacher.id} 
                            htmlFor={`${lesson.classId}-${lesson.time}-${teacher.id}`} 
                            className={cn(
                                "flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all",
                                selectedTeacherId === teacher.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                            )}
                        >
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value={teacher.id} id={`${lesson.classId}-${lesson.time}-${teacher.id}`} />
                                <span className='font-medium'>{teacher.name}</span>
                            </div>
                            {teacher.id === lesson.recommendationId && <Badge variant="secondary" className='text-xs bg-green-100 text-green-800'>מומלץ</Badge>}
                        </Label>
                    ))}
                </RadioGroup>

                {lesson.reasoning && (
                  <div className="mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 text-right">
                       <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 ml-1" />
                       <span>
                        <strong>נימוק להמלצה:</strong> {lesson.reasoning}
                       </span>
                  </div>
                )}
                
                <div className="mt-4 flex justify-end">
                    <Button 
                        size="sm" 
                        onClick={handleAssign} 
                        disabled={!selectedTeacherId || isAssigning}
                    >
                        {isAssigning ? <Loader2 className='w-4 h-4 ml-2 animate-spin' /> : <UserCheck className='w-4 h-4 ml-2' />}
                        שבץ
                    </Button>
                </div>
                </>
            ) : (
                <p className="text-sm text-center text-muted-foreground py-4">לא נמצאו מורים פנויים לשיעור זה.</p>
            )}
        </div>
    )
}


export default function RecommendationDialog({
  isOpen,
  onOpenChange,
  recommendationResult,
  onAssign,
}: RecommendationDialogProps) {

  if (!recommendationResult) return null;

  const { results, absentTeacher } = recommendationResult;
  
  const lessonsByDay = groupBy(results, (res) => daysOfWeek[getDay(res.date)]);
  const orderedDays = daysOfWeek.filter(day => lessonsByDay[day]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>שיבוץ מחליפים עבור {absentTeacher.name}</DialogTitle>
          <DialogDescription>
            להלן השיעורים המושפעים מההיעדרות. בחר/י מורה מחליף/ה לכל שיעור.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="py-2 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
          <Accordion type="multiple" className="w-full" defaultValue={orderedDays.map(d => `day-${d}`)}>
            {orderedDays.map(day => (
              <AccordionItem value={`day-${day}`} key={day}>
                <AccordionTrigger>
                    <div className='flex items-center gap-2'>
                        <CalendarDays className="h-5 w-5 text-primary" />
                        <span className='font-semibold'>יום {day}</span>
                        <Badge variant="secondary">{lessonsByDay[day].length} שיעורים</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-4 p-2">
                    {lessonsByDay[day].map((res, resIndex) => (
                       <LessonRecommendation key={resIndex} lesson={res} onAssign={onAssign} />
                    ))}
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>

        <DialogFooter>
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

    
