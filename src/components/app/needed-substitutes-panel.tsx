'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserX, CalendarDays, ArrowRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { useAbsences } from '@/hooks/use-absences';
import { Teacher, SchoolClass, SubstitutionRecord, TimeSlot } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NeededSubstitutePanelProps {
  teachers: Teacher[];
  classes: SchoolClass[];
  substitutions: SubstitutionRecord[];
  timeSlots: TimeSlot[];
  onAssignSubstitute?: (lesson: any) => void;
}

export default function NeededSubstitutePanel({ 
  teachers, 
  classes, 
  substitutions, 
  timeSlots,
  onAssignSubstitute
}: NeededSubstitutePanelProps) {
  
  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      start: startOfWeek(today, { weekStartsOn: 0 }), // Sunday start
      end: endOfWeek(today, { weekStartsOn: 0 })
    };
  }, []);

  const allAffectedLessons = useAbsences({
    teachers,
    classes,
    substitutions,
    timeSlots,
    dateRange
  });

  const uncoveredLessons = useMemo(() => {
    return allAffectedLessons
      .filter(lesson => !lesson.isCovered)
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.time.localeCompare(b.time));
  }, [allAffectedLessons]);

  if (uncoveredLessons.length === 0) {
    return null;
  }

  // Group by date for better display
  const groupedLessons = useMemo(() => {
      const groups: Record<string, typeof uncoveredLessons> = {};
      uncoveredLessons.forEach(lesson => {
          const dateKey = format(lesson.date, 'yyyy-MM-dd');
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(lesson);
      });
      return groups;
  }, [uncoveredLessons]);

  return (
    <Card className="border-l-4 border-l-orange-500 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <CalendarDays className="text-orange-500 h-5 w-5" />
          שיעורים הדורשים החלפה השבוע
        </CardTitle>
        <CardDescription>
          רשימת השיעורים שעדיין לא נמצא להם מחליף לשבוע הקרוב.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
            {Object.entries(groupedLessons).map(([dateKey, lessons]) => {
                const date = new Date(dateKey);
                const isToday = isSameDay(date, new Date());
                
                return (
                    <div key={dateKey} className="space-y-3">
                        <h3 className={cn("font-semibold text-sm flex items-center gap-2", isToday ? "text-orange-600" : "text-muted-foreground")}>
                            <span className="w-2 h-2 rounded-full bg-current"></span>
                            {format(date, 'EEEE, d בMMMM', { locale: he })}
                            {isToday && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full mr-2">היום</span>}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {lessons.map((lesson, index) => (
                                <div key={`${dateKey}-${index}`} className="flex flex-col p-3 bg-secondary/30 rounded-lg border hover:bg-secondary/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-medium">{lesson.className}</span>
                                        <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border">
                                            {lesson.time}
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-3">
                                        <div>{lesson.subject}</div>
                                        <div className="text-xs mt-1 flex items-center gap-1">
                                            <UserX className="h-3 w-3" />
                                            {lesson.absentTeacherName}
                                        </div>
                                    </div>
                                    {onAssignSubstitute && (
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="mt-auto w-full text-xs h-8"
                                            onClick={() => onAssignSubstitute(lesson)}
                                        >
                                            שבץ מחליף
                                            <ArrowRight className="mr-1 h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
