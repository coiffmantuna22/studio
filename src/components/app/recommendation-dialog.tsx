'use client';

import type { Teacher, AbsenceDay } from '@/lib/types';
import type { RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import { format, formatISO } from 'date-fns';
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
import { Lightbulb, UserCheck, CalendarDays } from 'lucide-react';

interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recommendationResult: {
    result: RecommendSubstituteTeachersOutput;
    absentTeacher: Teacher;
    absenceDays: AbsenceDay[];
  } | null;
}

export default function RecommendationDialog({
  isOpen,
  onOpenChange,
  recommendationResult,
}: RecommendationDialogProps) {
  if (!recommendationResult) return null;

  const { result, absentTeacher, absenceDays } = recommendationResult;
  const { recommendations, reasoning } = result;

  const formatDateRange = (days: AbsenceDay[]) => {
    if (days.length === 0) return '';
    const start = days[0].date;
    const end = days[days.length - 1].date;
    if (start === end) {
      return format(start, "d MMM, yyyy", { locale: he });
    }
    return `${format(start, "d MMM", { locale: he })} - ${format(end, "d MMM, yyyy", { locale: he })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>המלצות למורים מחליפים</DialogTitle>
          <DialogDescription>
            עבור היעדרות של {absentTeacher.name} בתאריכים {formatDateRange(absenceDays)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserCheck className="h-4 w-4 text-primary" />
              המלצות מובילות
            </h3>
            {recommendations.length > 0 ? (
              <ul className="space-y-2 rounded-md border bg-card p-3">
                {recommendations.map((name) => (
                  <li key={name} className="font-medium">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic p-3 border rounded-md">
                לא נמצאו מחליפים מתאימים על פי הקריטריונים.
              </p>
            )}
          </div>

          <Separator />
          
           <div>
             <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                פרטי ההיעדרות
            </h3>
            <div className="space-y-2 rounded-md border bg-card p-3">
              {absenceDays.map(day => (
                <div key={formatISO(day.date)} className="text-sm">
                  <span className="font-semibold">{format(day.date, "EEEE, d MMM", {locale: he})}: </span>
                  <span className="text-muted-foreground">{day.isAllDay ? 'יום שלם' : `${day.startTime} - ${day.endTime}`}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />
          
          <div>
             <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lightbulb className="h-4 w-4 text-primary" />
                נימוקי AI
            </h3>
            <div className="space-y-2 rounded-md border bg-secondary p-3">
              <p className="text-sm text-secondary-foreground">{reasoning}</p>
            </div>
          </div>
        </div>

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
