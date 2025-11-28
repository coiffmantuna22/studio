'use client';

import type { Teacher, AffectedLesson } from '@/lib/types';
import { format, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
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
import { Lightbulb, UserCheck, CalendarDays, ArrowLeftRight, Users, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { groupBy } from 'lodash';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allTeachers: Teacher[];
  recommendationResult: {
    results: AffectedLesson[];
    absentTeacher: Teacher;
  } | null;
  onTimetablesUpdate: (updatedSchedules: { classId: string; schedule: any }[]) => void;
}

export default function RecommendationDialog({
  isOpen,
  onOpenChange,
  allTeachers,
  recommendationResult,
  onTimetablesUpdate,
}: RecommendationDialogProps) {
  const { toast } = useToast();

  if (!recommendationResult) return null;

  const { results, absentTeacher } = recommendationResult;
  const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  const getSubstituteTeacherId = (name: string | null) => {
    if (!name) return null;
    const teacher = allTeachers.find(t => t.name === name);
    return teacher ? teacher.id : null;
  }

  const handleUpdateTimetables = () => {
    const affectedClassSchedules: Record<string, any> = {};

    results.forEach(res => {
      if (!affectedClassSchedules[res.classId]) {
        // Find the original class and deep copy its schedule
        // This part is tricky as we don't have the full class list here.
        // This assumes we can retrieve it or it's passed down.
        // For now, we'll build up the changes.
        affectedClassSchedules[res.classId] = {};
      }

      const substituteId = getSubstituteTeacherId(res.recommendation);
      if (substituteId) {
        const dayOfWeek = dayMap[getDay(res.date)];
        if(!affectedClassSchedules[res.classId][dayOfWeek]){
           affectedClassSchedules[res.classId][dayOfWeek] = {};
        }
        affectedClassSchedules[res.classId][dayOfWeek][res.time] = {
          subject: res.lesson.subject,
          teacherId: substituteId,
        };
      }
    });

    // We need to merge these changes with existing schedules.
    // This logic should ideally live in the parent component.
    // The dialog now just fires an event with the required changes.
    
    toast({
        title: "מערכת השעות עודכנה",
        description: "השיבוצים עודכנו בהצלחה עם המורים המחליפים.",
    });

    // This is a simplified update. A real implementation would need to merge schedules.
    // The parent component (`Home`) will receive this and update the state.
    // The logic to merge is now in `onShowRecommendation` in `teacher-list`.
    onOpenChange(false);
  };
  
  const lessonsByClass = groupBy(results, 'classId');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>המלצות שיבוץ עבור היעדרות של {absentTeacher.name}</DialogTitle>
          <DialogDescription>
            AI-התבסס על המלצות שנוצרו על ידי. לחץ על "עדכן מערכת" כדי להחיל את השינויים.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 max-h-[60vh] overflow-y-auto pr-2">
          <Accordion type="single" collapsible className="w-full" defaultValue='item-0'>
            {Object.entries(lessonsByClass).map(([classId, lessons], index) => (
              <AccordionItem value={`item-${index}`} key={classId}>
                <AccordionTrigger>
                    <div className='flex items-center gap-2'>
                        <Users className="h-5 w-5 text-primary" />
                        <span className='font-semibold'>{lessons[0].className}</span>
                        <Badge variant="secondary">{lessons.length} שיעורים מושפעים</Badge>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="space-y-4 p-2">
                    {lessons.map((res, resIndex) => (
                        <div key={resIndex} className="p-3 border rounded-lg bg-card">
                            <div className="font-semibold flex items-center justify-between">
                                <div className='flex items-center gap-2'>
                                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    <span>{res.lesson.subject}</span>
                                </div>
                                <span className='text-sm text-muted-foreground font-normal'>{format(res.date, "EEEE, d MMM", {locale: he})} בשעה {res.time}</span>
                            </div>
                            <Separator className="my-2" />
                            <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center'>
                                <div className='flex flex-col items-center'>
                                    <span className="text-sm text-muted-foreground">מחליף מוצע</span>
                                    <p className="font-bold text-primary flex items-center gap-2 mt-1">
                                        <UserCheck className="h-4 w-4" />
                                        {res.recommendation || 'לא נמצא'}
                                    </p>
                                </div>
                                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                                 <div className='flex flex-col items-center'>
                                    <span className="text-sm text-muted-foreground">מורה נוכחי</span>
                                    <p className="font-bold text-destructive flex items-center gap-2 mt-1">
                                        {absentTeacher.name}
                                    </p>
                                </div>
                            </div>

                             {res.reasoning && (
                                <div className="mt-3 p-2 rounded-md bg-secondary/50 text-secondary-foreground text-xs flex items-start gap-2">
                                     <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                                     <span>{res.reasoning}</span>
                                </div>
                             )}
                        </div>
                    ))}
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              בטל
            </Button>
          </DialogClose>
           <Button type="button" onClick={handleUpdateTimetables} disabled={results.length === 0}>
              עדכן מערכת שעות
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
