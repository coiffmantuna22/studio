'use client';

import type { Teacher } from '@/lib/types';
import type { RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import { format } from 'date-fns';
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
import { Badge } from '@/components/ui/badge';
import { Lightbulb, UserCheck } from 'lucide-react';

interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recommendationResult: {
    result: RecommendSubstituteTeachersOutput;
    absentTeacher: Teacher;
    details: { from: Date; to: Date; startTime: string; endTime: string };
  } | null;
}

export default function RecommendationDialog({
  isOpen,
  onOpenChange,
  recommendationResult,
}: RecommendationDialogProps) {
  if (!recommendationResult) return null;

  const { result, absentTeacher, details } = recommendationResult;
  const { recommendations, reasoning } = result;

  const formatDate = (date: Date) => format(date, 'd MMM, yyyy');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>המלצות למורים מחליפים</DialogTitle>
          <DialogDescription>
            עבור היעדרות של {absentTeacher.name} מה-
            {formatDate(details.from)} עד {formatDate(details.to)}, בין השעות {details.startTime}-{details.endTime}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
