
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
import { Lightbulb, UserCheck, ArrowLeft, Users, BookOpen, CalendarDays } from 'lucide-react';
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


interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recommendationResult: {
    results: AffectedLesson[];
    absentTeacher: Teacher;
    absenceDays: any[];
  } | null;
  onConfirm: () => void;
}

export default function RecommendationDialog({
  isOpen,
  onOpenChange,
  recommendationResult,
  onConfirm,
}: RecommendationDialogProps) {

  if (!recommendationResult) return null;

  const { results, absentTeacher, absenceDays } = recommendationResult;
  
  const lessonsByDay = groupBy(results, (res) => daysOfWeek[getDay(res.date)]);
  const orderedDays = daysOfWeek.filter(day => lessonsByDay[day]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>שיעורים מושפעים עבור {absentTeacher.name}</DialogTitle>
          <DialogDescription>
            להלן השיעורים המושפעים מההיעדרות. לחץ על "אישור" כדי לעבור לטבלת הזמינות ולשבץ מחליפים.
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
                    {lessonsByDay[day].map((res, resIndex) => {
                       const recommendation = res.substituteOptions?.find(sub => sub.id === res.recommendationId);

                       return (
                        <div key={resIndex} className="p-3 border rounded-lg bg-card">
                            <div className="font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between">
                                <div className='flex items-center gap-2'>
                                    <Users className="ml-2 h-4 w-4 text-muted-foreground" />
                                    <span>כיתה {res.className}</span>
                                </div>
                                <span className='text-sm text-muted-foreground font-normal mt-1 sm:mt-0'>{res.lesson.subject} בשעה {res.time}</span>
                            </div>
                            <Separator className="my-2" />
                            <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 text-center'>
                                <div className='flex flex-col items-center p-2 rounded-md bg-secondary/50'>
                                    <span className="text-sm text-muted-foreground">מחליף מומלץ</span>
                                    {recommendation ? (
                                        <p className="font-bold text-primary flex items-center justify-center gap-2 mt-1">
                                            <UserCheck className="h-4 w-4" />
                                            {recommendation.name}
                                        </p>
                                    ) : (
                                        <p className="font-bold text-muted-foreground mt-1">אין מחליף</p>
                                    )}
                                </div>
                                <div className='flex flex-col items-center'>
                                    <span className="text-sm text-muted-foreground">מורה מקורי</span>
                                    <p className="font-bold text-destructive/80 flex items-center justify-center gap-2 mt-1">
                                        {absentTeacher.name}
                                    </p>
                                </div>
                                <ArrowLeft className="h-4 w-4 text-muted-foreground mx-auto my-2 sm:my-0" />
                            </div>
                            {recommendation && res.reasoning && (
                              <div className="mt-3 p-2 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-xs flex items-start gap-2 text-right">
                                   <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 ml-1" />
                                   <span>
                                    <strong>נימוק:</strong> {res.reasoning}
                                   </span>
                              </div>
                            )}
                        </div>
                       )
                    })}
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              ביטול
            </Button>
          </DialogClose>
           <Button type="button" onClick={onConfirm}>
              אישור
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
